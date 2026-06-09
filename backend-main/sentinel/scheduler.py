"""
APScheduler configuration for automatic signal ingestion.
This runs every 15 minutes without requiring Redis or Celery.

To start the scheduler, add to your Django app ready() method or run as management command.
"""

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger
from apscheduler.triggers.cron import CronTrigger
from django.conf import settings
import logging

logger = logging.getLogger(__name__)

scheduler = None


def _with_db_cleanup(func):
    """Wrap APScheduler jobs so Django DB connections are released properly.

    APScheduler runs jobs in ThreadPoolExecutor threads. These threads
    bypass Django's request/response cycle, so CONN_MAX_AGE cleanup
    never fires. Without this, each job holds a connection indefinitely
    and the remote DB runs out of slots.
    """
    from functools import wraps

    @wraps(func)
    def wrapper(*args, **kwargs):
        from django.db import close_old_connections
        close_old_connections()
        try:
            return func(*args, **kwargs)
        finally:
            close_old_connections()
    return wrapper


def _run_management_command(name):
    """Run a Django management command with proper DB connection cleanup."""
    from django.db import close_old_connections
    from django.core.management import call_command
    close_old_connections()
    try:
        call_command(name)
    finally:
        close_old_connections()


def start_scheduler():
    """Start the background scheduler for automatic signal ingestion."""
    global scheduler
    
    if scheduler is not None:
        logger.warning("Scheduler already running")
        return
    
    from sentinel.ingestion import (
        ingest_from_gdelt, ingest_from_reliefweb,
        ingest_from_who_news, ingest_from_allafrica
    )
    
    import atexit
    
    scheduler = BackgroundScheduler(daemon=True)
    atexit.register(stop_scheduler)
    
    # Sync from GDELT every 15 minutes
    scheduler.add_job(
        _with_db_cleanup(ingest_from_gdelt),
        trigger=IntervalTrigger(minutes=15),
        id='gdelt_sync',
        name='Sync signals from GDELT',
        replace_existing=True,
        max_instances=1
    )
    
    # Sync from ReliefWeb every 30 minutes (official UN source)
    scheduler.add_job(
        _with_db_cleanup(ingest_from_reliefweb),
        trigger=IntervalTrigger(minutes=30),
        id='reliefweb_sync',
        name='Sync signals from ReliefWeb',
        replace_existing=True,
        max_instances=1
    )

    # Sync from AllAfrica RSS every 20 minutes (largest African news aggregator)
    scheduler.add_job(
        _with_db_cleanup(ingest_from_allafrica),
        trigger=IntervalTrigger(minutes=20),
        id='allafrica_sync',
        name='Sync signals from AllAfrica',
        replace_existing=True,
        max_instances=1
    )

    # Sync from WHO News RSS every 60 minutes (Tier 1 official updates less frequent)
    scheduler.add_job(
        _with_db_cleanup(ingest_from_who_news),
        trigger=IntervalTrigger(minutes=60),
        id='who_news_sync',
        name='Sync signals from WHO News RSS',
        replace_existing=True,
        max_instances=1
    )

    # Refresh spillover cache every 30 minutes (pre-compute engine results)
    try:
        from onehealth.spillover_cache import compute_and_cache
        scheduler.add_job(
            _with_db_cleanup(compute_and_cache),
            trigger=IntervalTrigger(minutes=30),
            id='spillover_cache_refresh',
            name='Refresh spillover early-warning cache',
            replace_existing=True,
            max_instances=1
        )
    except (ImportError, AttributeError) as e:
        logger.warning("Could not register spillover cache job: %s", e)

    # AI Agent classification of new signals every 5 minutes
    try:
        from sentinel.agent_classifier import classify_new_signals
        scheduler.add_job(
            _with_db_cleanup(classify_new_signals),
            trigger=IntervalTrigger(minutes=5),
            id='ai_classification',
            name='AI Agent classification of new signals',
            replace_existing=True,
            max_instances=1
        )
    except (ImportError, AttributeError) as e:
        logger.warning("Could not register AI classifier job: %s", e)

    # Hourly Telegram status pin — what the agent did in the last hour
    try:
        from sentinel.telegram_bot import send_hourly_status
        scheduler.add_job(
            _with_db_cleanup(send_hourly_status),
            trigger=IntervalTrigger(hours=1),
            id='telegram_hourly_status',
            name='Telegram hourly watchtower status (pinned)',
            replace_existing=True,
            max_instances=1
        )
    except (ImportError, AttributeError) as e:
        logger.warning("Could not register Telegram hourly status job: %s", e)

    # ── One Health dashboard pipeline (recurring, fast) ────────────────
    # Convert ingested sentinel signals → oh_alerts every 5 minutes so the
    # dashboard reflects real outbreak data without manual command runs.
    try:
        scheduler.add_job(
            lambda: _run_management_command('import_sentinel_to_oh_alerts'),
            trigger=IntervalTrigger(minutes=5),
            id='oh_import_signals',
            name='Import sentinel signals → oh_alerts',
            replace_existing=True,
            max_instances=1,
        )
        scheduler.add_job(
            lambda: _run_management_command('refresh_oh_agents'),
            trigger=IntervalTrigger(minutes=1),
            id='oh_refresh_agents',
            name='Refresh AI Agent Status from real system state',
            replace_existing=True,
            max_instances=1,
        )
        scheduler.add_job(
            lambda: _run_management_command('refresh_oh_hitl'),
            trigger=IntervalTrigger(minutes=2),
            id='oh_refresh_hitl',
            name='Refresh HITL pending queue from real alerts',
            replace_existing=True,
            max_instances=1,
        )
    except (ImportError, AttributeError) as e:
        logger.warning("Could not register One Health dashboard jobs: %s", e)

    # ── Real reference data refresh (slow, weekly) ─────────────────────
    # Runs the full external-data pipeline (World Bank, WHO GHO, IHR
    # SPAR, FAOSTAT, FSI, GHS, GFW, WOAH, NASA POWER, ACLED if keys set)
    # then loads the produced CSVs into local Postgres oh_* tables.
    # Sunday 02:00 UTC keeps load off business hours.
    try:
        from django.core.management import call_command
        import sys, subprocess, os, tempfile

        def run_oh_reference_pipeline():
            """Fetch + merge + load real reference data into oh_* tables."""
            outdir = os.path.join(tempfile.gettempdir(), 'oh-pipeline')
            os.makedirs(outdir, exist_ok=True)
            logger.info("[OH pipeline] starting weekly fetch → %s", outdir)
            # Fetch + merge in one subprocess so it can't crash the scheduler
            cmd = [sys.executable, '-m', 'onehealth.pipeline',
                   '--skip-acled' if not os.getenv('ACLED_KEY') else '',
                   '--output-dir', outdir]
            cmd = [c for c in cmd if c]  # drop empty strings
            res = subprocess.run(cmd, capture_output=True, text=True, timeout=3600)
            if res.returncode != 0:
                logger.error("[OH pipeline] fetch failed: %s", res.stderr[-2000:])
                return
            logger.info("[OH pipeline] fetch done, loading CSVs into DB")
            call_command('load_oh_pipeline_csvs', outdir)
            logger.info("[OH pipeline] load complete")

        scheduler.add_job(
            _with_db_cleanup(run_oh_reference_pipeline),
            trigger=CronTrigger(day_of_week='sun', hour=2, minute=0),
            id='oh_reference_pipeline_weekly',
            name='Weekly real reference-data refresh (WB / WHO / NASA / WOAH / etc.)',
            replace_existing=True,
            max_instances=1,
            coalesce=True,
        )
    except (ImportError, AttributeError, OSError) as e:
        logger.warning("Could not register weekly OH pipeline job: %s", e)

    scheduler.start()
    logger.info("Signal ingestion scheduler started (GDELT:15min, ReliefWeb:30min, AllAfrica:20min, WHO:60min, SpilloverCache:30min, AIClassifier:5min, TelegramHourly:60min)")


def stop_scheduler():
    """Stop the background scheduler."""
    global scheduler
    if scheduler:
        scheduler.shutdown(wait=False)
        scheduler = None
        logger.info("Signal ingestion scheduler stopped")
