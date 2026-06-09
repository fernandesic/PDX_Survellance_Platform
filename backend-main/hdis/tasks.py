"""
HDIS Celery Tasks — periodic processing and manual triggers.

All tasks use @with_tenant('0') to set app.current_tenant = '0'
(super-admin) on the PostgreSQL session before the task body runs.
This ensures queries and writes work correctly once RLS is enabled.

Celery workers do NOT go through Django's TenantMiddleware, so without
this decorator, the connection_created signal sets app.current_tenant
to '-1' (deny-all), causing all queries to return 0 rows under RLS.

Note: Ingestion tasks (sentinel/ingestion.py, hdis/ingestion.py) already
set tenant_id explicitly on every INSERT, but they ALSO need the session
variable set so that SELECT queries (dedup checks, corroboration lookups)
work under RLS.
"""
import logging
from datetime import timedelta

from celery import shared_task
from django.conf import settings
from django.db import DatabaseError
from django.utils import timezone

from utils.tenant_tasks import with_tenant

logger = logging.getLogger(__name__)


@shared_task
@with_tenant('0')
def update_trust_scores_task():
    """Recompute trust scores for recent signals.

    Reads signals cross-tenant, creates/updates TrustScore rows
    with tenant_id denormalized from the parent signal.
    Needs super-admin context for the cross-tenant SELECT.
    """
    from hdis.trust_engine import update_trust_scores
    count = update_trust_scores()
    return {'updated': count}


@shared_task
@with_tenant('0')
def run_alert_engine_task():
    """Run alert engine on recent signals.

    Reads signals cross-tenant, creates Alert rows with
    tenant_id denormalized from the parent signal.
    Needs super-admin context for the cross-tenant SELECT.
    """
    from hdis.alert_engine import run_alert_engine
    count = run_alert_engine(hours_back=1)
    return {'alerts_created': count}


@shared_task
@with_tenant('0')
def data_retention_task():
    """
    Soft-archive signals older than HDIS_RETENTION_DAYS.
    Sets status to 'archived' but does NOT delete.
    Data is always preserved — just hidden from active views.

    Cross-tenant UPDATE — archives signals for ALL tenants.
    Needs super-admin context so the bulk .update() can see all rows.
    """
    from sentinel.models import Signal
    retention_days = getattr(settings, 'HDIS_RETENTION_DAYS', 90)
    cutoff = timezone.now() - timedelta(days=retention_days)

    archived = Signal.objects.filter(
        created_at__lt=cutoff,
    ).exclude(
        status='archived',
    ).update(status='archived')

    logger.info(f"Data retention: archived {archived} signals older than {retention_days} days")
    return {'archived': archived}


@shared_task
@with_tenant('0')
def generate_daily_briefing_task():
    """Generate the daily global briefing (scheduled daily at 06:00 UTC).

    Idempotent: skips if today's daily_global briefing already exists.
    Reads signals/alerts/briefings cross-tenant for the continental
    briefing. Creates a Briefing row and marks it as PUBLISHED so it
    appears on the dashboard immediately.
    """
    from hdis.briefing_engine import generate_briefing
    from hdis.models import Briefing, BriefingStatus

    # ── Idempotency: skip if today's briefing already exists ──
    today_start = timezone.now().replace(hour=0, minute=0, second=0, microsecond=0)
    existing = Briefing.objects.filter(
        scope='daily_global',
        generated_at__gte=today_start,
    ).first()
    if existing:
        logger.info(f"Daily briefing already exists for today (id={existing.id}), skipping.")
        return {'briefing_id': existing.id, 'status': existing.status, 'skipped': True}

    # ── Generate and publish ──
    try:
        briefing = generate_briefing(scope='daily_global', hours_back=48)
    except Exception as e:  # noqa: BLE001 — Celery task wrapper: any failure must return a structured error payload
        logger.exception(f"Daily briefing generation failed: {e}")
        return {'error': str(e), 'briefing_id': None}

    if briefing is None:
        logger.error("generate_briefing() returned None — no briefing created.")
        return {'error': 'generate_briefing returned None', 'briefing_id': None}

    # Auto-publish so it shows up on the dashboard
    try:
        briefing.status = BriefingStatus.PUBLISHED
        briefing.save()
    except (DatabaseError, AttributeError, ValueError) as e:
        logger.exception(f"Failed to publish briefing id={briefing.id}: {e}")
        return {'briefing_id': briefing.id, 'status': briefing.status, 'publish_error': str(e)}

    logger.info(f"Daily briefing published: id={briefing.id}")
    return {'briefing_id': briefing.id, 'status': briefing.status}


@shared_task
@with_tenant('0')
def manual_refresh_task():
    """
    Full manual refresh: ingest all sources → trust scores → alerts.
    Called from the UI "Refresh Now" button.

    Chains ingest (cross-tenant dedup) → trust (cross-tenant read) →
    alerts (cross-tenant read). All sub-functions already set tenant_id
    explicitly on INSERTs, but need super-admin context for SELECTs.
    """
    from hdis.ingestion import ingest_all_sources
    from hdis.trust_engine import update_trust_scores
    from hdis.alert_engine import run_alert_engine
    from django.core.cache import cache

    # Step 1: Ingest
    ingest_results = ingest_all_sources()

    # Step 2: Trust scores
    trust_count = update_trust_scores()

    # Step 3: Alerts
    alert_count = run_alert_engine(hours_back=1)

    # Step 4: Clear cache so dashboard shows fresh data
    cache.clear()

    total_ingested = sum(
        r.get('ingested', 0) for r in ingest_results.values()
        if isinstance(r, dict)
    )

    return {
        'sources_processed': len(ingest_results),
        'signals_ingested': total_ingested,
        'trust_scores_updated': trust_count,
        'alerts_created': alert_count,
    }
