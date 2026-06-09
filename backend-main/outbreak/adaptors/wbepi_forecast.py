"""
wbepi forecast adaptor (T-050).

Triggers a scenario via the existing predictions API and stores the
resulting trajectory as an `OutbreakEvent` (kind=forecast). Kept thin —
the heavy lifting lives in `predictions/scenarios/wbepi_engine`.

We don't call `predictions/scenarios/wbepi_engine/py_engine.py` directly
from inside this adaptor; instead we wrap whatever scenario the caller
already ran. The view exposes the trigger.
"""

import logging
from typing import Iterable

from django.utils import timezone

from outbreak.adaptors.base import SourceAdaptor
from outbreak.models import EventKind, Outbreak

logger = logging.getLogger(__name__)


# Default BDBV-calibrated parameters that match the frontend ScenarioRunner.
BDBV_DEFAULTS = {
    'beta': 0.18,
    'sigma': 1 / 8,
    'gamma': 1 / 12,
    'mu': 0.30,
    'interv_delay': 14,
    'interv_efficacy': 0.4,
    'n_populations': 3,
    'ini_S': [500000, 200000, 100000],
    'ini_I': [10, 2, 0],
    'time': 180,
    'n_sims': 5,
}


class WbepiForecastAdaptor(SourceAdaptor):
    name = 'wbepi_forecast'
    kinds_emitted = [EventKind.FORECAST]

    def is_healthy(self) -> bool:
        try:
            from predictions.scenarios.wbepi_engine import py_engine  # noqa: F401
            return True
        except ImportError:
            return False

    def fetch(self, outbreak: Outbreak) -> Iterable[dict]:
        """
        Run one stochastic SEIRDV projection with BDBV defaults and emit a
        single forecast event. The full quantile blob is stored in payload.

        Idempotent for the current day: source_ref encodes (iso3, YYYY-MM-DD).
        """
        try:
            from predictions.scenarios.wbepi_engine.py_engine import run_seirdv_simulation
        except ImportError:
            logger.warning("wbepi_forecast: py_engine import failed, skipping")
            return

        params = dict(BDBV_DEFAULTS)
        # Calibrate R0 from pathogen profile when available.
        r0_mid = float((outbreak.pathogen.r0_min or 0) + (outbreak.pathogen.r0_max or 0)) / 2.0
        if r0_mid > 0:
            params['beta'] = round(r0_mid * params['gamma'], 4)

        try:
            result = run_seirdv_simulation(seed=42, **params)
        except (ValueError, RuntimeError, TypeError, ArithmeticError) as e:
            logger.exception("wbepi_forecast: run_seirdv_simulation crashed: %s", e)
            return

        today = timezone.now().date().isoformat()
        yield {
            'ts': timezone.now(),
            'kind': EventKind.FORECAST,
            'geo': outbreak.iso3,
            'payload_json': {
                'engine': 'wbepi.seirdv',
                'params': params,
                'summary_stats': result,
                'headline': (
                    f"wbepi SEIRDV projection ({params['time']}d) for "
                    f"{outbreak.pathogen.name} in {outbreak.iso3}"
                ),
            },
            'confidence': 0.50,
            'source_ref': f"{outbreak.iso3}:{today}",
        }
