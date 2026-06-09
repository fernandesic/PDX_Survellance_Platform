"""
Celery tasks for scheduled verification runs.

PDX already runs Celery Beat (see datarepr/settings/base.py CELERY_BEAT_SCHEDULE).
Registering these two tasks there gives near-real-time verification with no new
infrastructure. See DEPLOYMENT_AND_HANDOFF.md for the exact schedule entries.

If PDX's Celery worker is not running in your environment, use the
django_crontab or system-cron fallback in the handoff doc instead — the
management commands do the same work.
"""

import logging

logger = logging.getLogger(__name__)

try:
    from celery import shared_task
except ImportError:  # Celery not importable in some contexts; degrade gracefully.
    def shared_task(*dargs, **dkwargs):
        def wrap(fn):
            return fn
        return wrap if not (len(dargs) == 1 and callable(dargs[0])) else dargs[0]


@shared_task(name='verification.capture')
def capture_task(horizon_days=30):
    """CAPTURE: snapshot predictions + alerts/incidents + scenario runs."""
    from verification.services import capture
    n_pred = capture.collect_predictions_module(horizon_days=horizon_days)
    alerts = capture.collect_alerts_incidents(window_days=horizon_days)
    official = capture.collect_official_outcomes()
    n_scen = capture.collect_scenario_runs()
    ebola = capture.collect_pdx_outbreak_events(lookback_days=horizon_days)
    logger.info('verification.capture: predictions=%s alerts=%s official=%s scenarios=%s ebola=%s',
                n_pred, alerts, official, n_scen, ebola)
    return {'predictions': n_pred, 'alerts': alerts,
            'official_outcomes': official, 'scenarios': n_scen, 'ebola': ebola}


@shared_task(name='verification.run_pipeline')
def run_pipeline_task(stale_grace_days=7):
    """MATCH → SCORE → FEEDBACK over everything whose window has closed."""
    from verification.services import matching, scoring, feedback
    match_summary = matching.match_due_snapshots()
    stale = matching.resolve_stale_pending(grace_days=stale_grace_days)
    n_cards = scoring.generate_scorecards()
    indices = scoring.compute_veracity_indices()
    tickets = feedback.open_review_tickets()
    calib = feedback.compute_calibration()
    result = {
        'match': match_summary,
        'stale_resolved': stale,
        'scorecards': n_cards,
        'veracity_indices': len(indices),
        'tickets_opened': len(tickets),
        'calibration_records': len(calib),
    }
    logger.info('verification.run_pipeline: %s', result)
    return result
