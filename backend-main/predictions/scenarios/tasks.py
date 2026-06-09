"""
Celery task for running wbepi_engine simulations asynchronously.

Uses predictions.models.ScenarioRun (main repo's model with
STATUS_PENDING/RUNNING/SUCCESS/FAILED, parameters_snapshot, seed,
output_blob, summary_stats, error_message).

Sprint R4 hardening:
- ``soft_time_limit`` (9 min) fires ``SoftTimeLimitExceeded`` so we
  can mark the row FAILED with a human-readable message before the
  hard ``time_limit`` (10 min 30 s) kills the process.
- ``acks_late=True`` so the broker only removes the message after the
  task body finishes — if the worker is recycled mid-task the message
  is redelivered.
"""

import gc
import gzip
import json
import logging
import time

import numpy as np
from celery import shared_task
from celery.exceptions import SoftTimeLimitExceeded
from django.utils import timezone

logger = logging.getLogger("wbepi")

# Maximum runtime in seconds before we consider it a timeout
MAX_RUNTIME_SECONDS = 600  # 10 minutes


@shared_task(
    bind=True,
    max_retries=0,
    acks_late=True,
    time_limit=MAX_RUNTIME_SECONDS + 30,       # hard kill after 10m30s
    soft_time_limit=MAX_RUNTIME_SECONDS - 60,   # soft abort after 9m
)
def run_scenario_task(self, run_id: int, tenant_id: str = None):
    """
    Execute a wbepi_engine simulation for the given ScenarioRun.

    Lifecycle: PENDING → RUNNING → SUCCESS | FAILED
    """
    from django.db import DatabaseError, connection
    from predictions.models import ScenarioRun

    if tenant_id is not None:
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT set_config('app.current_tenant', %s, false)", [str(tenant_id)])
        except DatabaseError as e:
            logger.error(f"Task {self.request.id}: Failed to set app.current_tenant: {e}")

    try:
        run = ScenarioRun.objects.get(pk=run_id)
    except ScenarioRun.DoesNotExist:
        logger.error(f"ScenarioRun {run_id} not found")
        return {'error': f'ScenarioRun {run_id} not found'}

    # Mark as running
    run.status = ScenarioRun.STATUS_RUNNING
    run.started_at = timezone.now()
    run.save(update_fields=['status', 'started_at'])

    try:
        # Import here to avoid loading numpy at Celery boot
        from predictions.scenarios.wbepi_engine import run_seirdv

        config = run.parameters_snapshot
        start_time = time.monotonic()

        # Build kwargs for run_seirdv
        kwargs = {}
        direct_keys = [
            'n_populations', 'beta', 'sigma', 'gamma', 'mu',
            'vacc_coverage', 'vacc_efficacy',
            'interv_delay', 'interv_efficacy', 'interv_vacc_type',
            'interv_vacc_coverage', 'target_size', 'interv_release',
            'time', 'n_sims', 'diffusion',
        ]
        for key in direct_keys:
            if key in config:
                kwargs[key] = config[key]

        # Compartment arrays
        for comp in ['ini_S', 'ini_E', 'ini_I', 'ini_R', 'ini_D', 'ini_V']:
            if comp in config:
                kwargs[comp] = config[comp]

        # Delta matrix
        if config.get('delta') is not None:
            kwargs['delta'] = np.array(config['delta'])

        # RNG seed
        seed = run.seed
        if seed is not None:
            kwargs['rng'] = np.random.default_rng(int(seed))
        else:
            # Generate a seed, record it for reproducibility
            seed = int(np.random.default_rng().integers(0, 2**31))
            run.seed = seed
            kwargs['rng'] = np.random.default_rng(seed)

        # Run the simulation
        logger.info(f"ScenarioRun {run_id}: starting simulation "
                     f"(n_sims={kwargs.get('n_sims', 1)}, "
                     f"time={kwargs.get('time', 1)}, "
                     f"n_populations={kwargs.get('n_populations', 1)})")

        cost_inputs_dict = config.get('cost_inputs')
        if cost_inputs_dict:
            from predictions.scenarios.wbepi_engine.cost_effectiveness import CostInputs, run_with_cea
            import dataclasses
            cost_inputs = CostInputs(**cost_inputs_dict)
            baseline_df, df, cea_result = run_with_cea(kwargs, cost_inputs)
            cea_data = dataclasses.asdict(cea_result)
        else:
            df = run_seirdv(**kwargs)
            cea_data = None

        elapsed = time.monotonic() - start_time
        logger.info(f"ScenarioRun {run_id}: simulation completed in {elapsed:.2f}s "
                     f"({len(df)} rows)")

        # ── Compute summary stats ──────────────────────────────────
        summary = _compute_summary_stats(df, kwargs.get('n_populations', 1))
        if cea_data:
            summary['cost_effectiveness'] = cea_data

        # ── Store output ───────────────────────────────────────────
        # For small runs, store inline in output_blob.
        # For large runs (>50k rows), compress and store as null + note.
        output_data = json.loads(df.to_json(orient='split'))

        # ── Mark success ───────────────────────────────────────────
        run.status = ScenarioRun.STATUS_SUCCESS
        run.summary_stats = summary
        run.output_blob = output_data
        run.completed_at = timezone.now()
        run.save(update_fields=[
            'status', 'summary_stats', 'output_blob',
            'completed_at', 'seed',
        ])

        return {
            'status': 'success',
            'run_id': run_id,
            'rows': len(df),
            'elapsed_seconds': round(elapsed, 2),
        }

    except SoftTimeLimitExceeded:
        # Sprint R4: graceful abort on soft timeout.
        # The row gets a useful error message rather than a silent kill.
        elapsed = time.monotonic() - start_time if 'start_time' in dir() else 0
        msg = (
            f"Simulation timed out after {elapsed:.0f}s "
            f"(soft limit {MAX_RUNTIME_SECONDS - 60}s). "
            f"Try reducing n_sims or time steps."
        )
        logger.warning(f"ScenarioRun {run_id}: {msg}")
        run.status = ScenarioRun.STATUS_FAILED
        run.error_message = msg
        run.completed_at = timezone.now()
        run.save(update_fields=['status', 'error_message', 'completed_at'])
        return {'status': 'timeout', 'error': msg}

    except Exception as exc:  # noqa: BLE001 — scenario task wrapper: must mark the ScenarioRun FAILED regardless of root cause
        logger.exception(f"ScenarioRun {run_id} failed: {exc}")
        run.status = ScenarioRun.STATUS_FAILED
        run.error_message = str(exc)[:2000]
        run.completed_at = timezone.now()
        run.save(update_fields=['status', 'error_message', 'completed_at'])
        return {'status': 'failed', 'error': str(exc)[:500]}


def _compute_summary_stats(df, n_populations: int) -> dict:
    """
    Compute per-step quantile summaries for the frontend chart.

    Returns::

        {
            "compartments": ["S", "E", "I", "R", "D", "V"],
            "populations": [1, 2, ...],
            "steps": [1, 2, ...],
            "quantiles": {
                "S[1]": {"median": [...], "q05": [...], "q25": [...], "q75": [...], "q95": [...]},
                ...
            }
        }
    """
    steps = sorted(df['step'].unique().tolist())
    compartments = ['S', 'E', 'I', 'R', 'D', 'V']
    populations = list(range(1, n_populations + 1))

    quantiles = {}
    for comp in compartments:
        for p in populations:
            col = f"{comp}[{p}]"
            if col not in df.columns:
                continue
            grouped = df.groupby('step')[col]
            quantiles[col] = {
                'median': grouped.median().tolist(),
                'q05': grouped.quantile(0.05).tolist(),
                'q25': grouped.quantile(0.25).tolist(),
                'q75': grouped.quantile(0.75).tolist(),
                'q95': grouped.quantile(0.95).tolist(),
            }

    return {
        'compartments': compartments,
        'populations': populations,
        'steps': steps,
        'quantiles': quantiles,
    }
