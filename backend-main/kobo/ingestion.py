"""
KoboToolbox Ingestion — Poll-Based Sync

Follows the GDELT ingestion pattern from sentinel/ingestion.py:
  fetch → dedup via get_or_create → create Signal → return stats

Per Anti-Pattern #2: AI classifier is NEVER called inline.
Per Anti-Pattern #5: get_or_create handles webhook/poll race condition.
"""

import logging
from datetime import datetime
from typing import Any, Optional

from django.db import IntegrityError
from django.utils.dateparse import parse_datetime

from utils.tenant_tasks import tenant_context

from kobo.client import KoboClient
from kobo.models import KoboSubmission
from kobo.signal_mapper import map_submission_to_signal
from sentinel.models import Signal
from utils.tenant_resolver import resolve_tenant

logger = logging.getLogger(__name__)


def sync_kobo_submissions(
    *,
    dry_run: bool = False,
    limit: int = 100,
    since: Optional[datetime] = None,
) -> dict[str, int]:
    """
    Poll KoboToolbox API and ingest new CHW submissions.

    Args:
        dry_run: If True, fetch and preview but don't save.
        limit: Max submissions to fetch.
        since: Only fetch submissions after this datetime.

    Returns:
        Stats dict: {'created': N, 'skipped': N, 'errors': N}
    """
    stats: dict[str, int] = {'created': 0, 'skipped': 0, 'errors': 0}

    client = KoboClient()
    raw_submissions = client.fetch_submissions(since=since, limit=limit)

    if not raw_submissions:
        logger.info("Kobo sync: no submissions returned from API")
        return stats

    logger.info(
        "Kobo sync: processing %d submissions (dry_run=%s)",
        len(raw_submissions), dry_run,
    )

    for raw in raw_submissions:
        try:
            result = _process_one_submission(raw, dry_run=dry_run)
            if result == 'created':
                stats['created'] += 1
            elif result == 'skipped':
                stats['skipped'] += 1
        except IntegrityError:
            # Dedup via unique constraint — another process already created it
            logger.debug(
                "Duplicate kobo_id=%s, skipping (webhook/poll overlap)",
                raw.get('_id'),
            )
            stats['skipped'] += 1
        except (KeyError, ValueError) as exc:
            logger.error(
                "Bad submission kobo_id=%s: %s",
                raw.get('_id'), exc,
            )
            stats['errors'] += 1
        except Exception as exc:  # noqa: BLE001 — batch ingestion loop: one bad row must not abort the batch
            logger.exception(
                "Unexpected error on kobo_id=%s: %s",
                raw.get('_id'), exc,
            )
            stats['errors'] += 1

    logger.info(
        "Kobo sync complete: %d created, %d skipped, %d errors",
        stats['created'], stats['skipped'], stats['errors'],
    )
    return stats


def _process_one_submission(
    raw: dict[str, Any],
    *,
    dry_run: bool = False,
) -> str:
    """
    Process a single raw Kobo submission dict.

    Returns:
        'created' if a new KoboSubmission + Signal was created.
        'skipped' if the submission already existed.
    """
    kobo_id = int(raw['_id'])
    kobo_uuid = str(raw.get('_uuid', ''))

    if dry_run:
        logger.info(
            "[DRY RUN] Would process kobo_id=%d, uuid=%s, event_type=%s",
            kobo_id, kobo_uuid, raw.get('event_type', ''),
        )
        return 'created'

    # Parse submission fields from raw payload
    defaults = _parse_submission_fields(raw)

    # Idempotent: get_or_create by kobo_id (handles webhook/poll race)
    submission, created = KoboSubmission.objects.get_or_create(
        kobo_id=kobo_id,
        defaults=defaults,
    )

    if not created:
        logger.debug(
            "Submission kobo_id=%d already exists, skipping",
            kobo_id,
        )
        return 'skipped'

    # Create the Signal from this submission
    signal = _create_signal_from_submission(submission)
    if signal:
        submission.signal = signal
        submission.save(update_fields=['signal'])

    logger.info(
        "Kobo submission %d → Signal %d created (tier=%d, iso=%s)",
        kobo_id,
        signal.id if signal else 0,
        0,  # TIER_0
        signal.location_country_iso if signal else 'N/A',
    )

    return 'created'


def process_webhook_payload(raw: dict[str, Any]) -> KoboSubmission:
    """
    Process a single webhook payload from KoboToolbox.

    Called by the webhook view. Uses the same get_or_create pattern
    as poll ingestion for idempotency.

    Returns:
        The KoboSubmission instance (created or existing).
    """
    kobo_id = int(raw['_id'])
    defaults = _parse_submission_fields(raw)

    submission, created = KoboSubmission.objects.get_or_create(
        kobo_id=kobo_id,
        defaults=defaults,
    )

    if created:
        signal = _create_signal_from_submission(submission)
        if signal:
            submission.signal = signal
            submission.save(update_fields=['signal'])

        logger.info(
            "Webhook: Kobo submission %d → Signal %d created",
            kobo_id,
            signal.id if signal else 0,
        )

    return submission


def _parse_submission_fields(raw: dict[str, Any]) -> dict[str, Any]:
    """
    Parse raw Kobo API response dict into KoboSubmission model field values.
    """
    # Parse submission timestamp
    submitted_at = None
    raw_ts = raw.get('_submission_time', '')
    if raw_ts:
        submitted_at = parse_datetime(str(raw_ts))

    # Cast case_count from string to int (Anti-Pattern #4)
    try:
        case_count = int(raw.get('case_count') or 0)
    except (ValueError, TypeError):
        case_count = 0

    return {
        'kobo_uuid': str(raw.get('_uuid', '')),
        'xform_id_string': str(raw.get('_xform_id_string', '')),
        'form_version': str(raw.get('__version__', '')),
        'chw_name': str(raw.get('chw_name', ''))[:200],
        'chw_clinic': str(raw.get('chw_clinic', ''))[:300],
        'description': str(raw.get('description', '')),
        'event_type': str(raw.get('event_type', ''))[:500],
        'event_other': str(raw.get('event_other', ''))[:300],
        'case_count': case_count,
        'age_group': str(raw.get('age_group', ''))[:50],
        'severity': str(raw.get('severity', ''))[:50],
        'gps_location': str(raw.get('gps_location', ''))[:200],
        'text_location': str(raw.get('text_location', '')),
        'adm0_pcode': str(raw.get('text_location_adm0_pcode', ''))[:10],
        'adm0_name': str(raw.get('text_location_adm0_name', ''))[:200],
        'adm1_pcode': str(raw.get('text_location_adm1_pcode', ''))[:20],
        'adm1_name': str(raw.get('text_location_adm1_name', ''))[:200],
        'adm2_pcode': str(raw.get('text_location_adm2_pcode', ''))[:20],
        'adm2_name': str(raw.get('text_location_adm2_name', ''))[:200],
        'geocoded_latitude': _safe_decimal(raw.get('text_location_latitude')),
        'geocoded_longitude': _safe_decimal(raw.get('text_location_longitude')),
        'geocoding_confidence': str(raw.get('text_location_confidence', ''))[:50],
        'photo_evidence': str(raw.get('photo_evidence', ''))[:500],
        'comments_text': str(raw.get('comments_text', '')),
        'comments_audio': str(raw.get('comments_audio', ''))[:500],
        'whatsapp_number': str(raw.get('_whatsapp_number', ''))[:50],
        'whatsapp_transcript': str(raw.get('_whatsapp_transcript', '')),
        'submitted_at': submitted_at,
        'submitted_by': str(raw.get('_submitted_by', ''))[:200],
        'submission_status': str(raw.get('_status', ''))[:100],
        'raw_payload': raw,
    }


def _create_signal_from_submission(submission: KoboSubmission) -> Optional[Signal]:
    """
    Create a sentinel.Signal from a KoboSubmission.

    Uses the signal_mapper to produce kwargs, then resolves the tenant.
    Also inserts an oh_alerts row for animal_deaths events so the
    SpilloverEngine picks it up.
    Returns the created Signal, or None on failure.
    """
    try:
        signal_kwargs = map_submission_to_signal(submission)
        country_iso = signal_kwargs.get('location_country_iso')

        # Webhook runs outside Django middleware, so no tenant context is set.
        # Wrap in tenant_context('0') to bypass RLS — same pattern as
        # outbreak ingest, agent classifier, and management commands.
        with tenant_context('0'):
            signal = Signal.objects.create(
                tenant=resolve_tenant(iso=country_iso),
                **signal_kwargs,
            )

            # Wire animal_deaths into oh_alerts for SpilloverEngine (Step 14)
            from kobo.signal_mapper import insert_oh_alert_for_animal_deaths
            insert_oh_alert_for_animal_deaths(submission)

        # Push to live SSE subscribers (CHW Field Intelligence panel etc.).
        # Best-effort: failure here must not block the webhook 2xx response.
        try:
            from sentinel.realtime import publish_signal_event
            publish_signal_event(signal)
        except Exception as exc:  # noqa: BLE001 — best-effort realtime publish: a Redis blip must not block the webhook 2xx
            logger.warning("kobo: realtime publish failed for signal %s: %s", signal.id, exc)

        return signal
    except Exception as exc:  # noqa: BLE001 — top-level Signal-create wrapper: any failure returns None and the caller decides
        logger.error(
            "Failed to create Signal from Kobo submission %d: %s",
            submission.kobo_id, exc,
            exc_info=True,
        )
        return None


def _safe_decimal(value: Any) -> Optional[float]:
    """Safely convert a value to Decimal-compatible float, or None."""
    if value is None or value == '':
        return None
    try:
        return float(value)
    except (ValueError, TypeError):
        return None
