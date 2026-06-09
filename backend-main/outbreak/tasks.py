"""
Outbreak Celery tasks — periodic auto-ingest of signals into OutbreakEvents.

Registered in CELERY_BEAT_SCHEDULE (settings/base.py) to run every 30 minutes
for any active/confirmed outbreak. Case-count ground truth is uploaded
manually through `POST /api/outbreak/upload-tracker/`, not pulled from
external surveillance feeds.
"""

import logging

from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task(
    name='outbreak.tasks.ingest_active_outbreaks',
    bind=True,
    max_retries=2,
    default_retry_delay=60,
    soft_time_limit=300,
    time_limit=360,
)
def ingest_active_outbreaks(self):
    """
    Run all adaptors for every active/confirmed outbreak.

    Idempotent — adaptors skip signals already stored via `source_ref`
    deduplication.

    Returns a summary dict: {outbreak_id: {adaptor: result}}.
    """
    from outbreak.models import Outbreak
    from outbreak.views import _adaptor_registry
    from utils.tenant_tasks import tenant_context

    active_outbreaks = Outbreak.objects.filter(
        status__in=['suspected', 'confirmed']
    ).select_related('pathogen')

    if not active_outbreaks.exists():
        logger.info("[outbreak.ingest] No active outbreaks — skipping.")
        return {'skipped': True, 'reason': 'no active outbreaks'}

    adaptors = _adaptor_registry()
    summary = {}

    for outbreak in active_outbreaks:
        outbreak_results = {}
        logger.info(
            "[outbreak.ingest] Processing outbreak %d — %s (%s)",
            outbreak.id, outbreak.pathogen.name, outbreak.iso3,
        )

        try:
            with tenant_context('0'):
                for adaptor in adaptors:
                    if not adaptor.is_healthy():
                        logger.warning(
                            "[outbreak.ingest] Adaptor %s unhealthy — skipping.",
                            adaptor.name,
                        )
                        outbreak_results[adaptor.name] = {'status': 'unhealthy'}
                        continue

                    result = adaptor.run(outbreak)
                    outbreak_results[adaptor.name] = result
                    logger.info(
                        "[outbreak.ingest] %s → emitted=%d skipped=%d status=%s",
                        adaptor.name, result['emitted'],
                        result['skipped'], result['status'],
                    )
        except Exception as exc:  # noqa: BLE001 — per-outbreak batch wrapper: one bad outbreak must not abort the rest
            logger.exception(
                "[outbreak.ingest] Error processing outbreak %d: %s",
                outbreak.id, exc,
            )
            outbreak_results['error'] = str(exc)

        summary[outbreak.id] = outbreak_results

    logger.info("[outbreak.ingest] Done. Summary: %s", summary)
    return summary
