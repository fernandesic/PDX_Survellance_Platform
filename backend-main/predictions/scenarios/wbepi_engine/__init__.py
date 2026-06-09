"""
wbepi_engine — SEIRDV stochastic epidemic simulator.

Calls the upstream R ``wbepi`` package via rpy2 (Approach 2 from
the original integration plan; see ``wbepi-rpy2/plan.md``).

Original R implementation: Thibaut Jombart
(World Bank Group / LSTM = London School of Tropical Medicine).

License: MIT — see ``LICENSE.md`` in this folder for the full notice.
Upstream reference: wbepi v0.1.0.9000 (R package).

Usage::

    from predictions.scenarios.wbepi_engine import run_seirdv

    df = run_seirdv(
        n_populations=4,
        ini_S=[1000, 3000, 12000, 2000],
        ini_I=[10, 0, 0, 1],
        beta=0.2, sigma=1/7, gamma=1/14, mu=0.3,
        interv_delay=10, interv_efficacy=0.25,
        interv_vacc_type=2, target_size=200,
        interv_release=28, time=365, diffusion=0.1,
        n_sims=10,
    )
"""

from predictions.scenarios.wbepi_engine.r_engine import run_seirdv


def get_active_engine() -> str:
    """Return the name of the active simulation engine."""
    return "r"


__all__ = ["run_seirdv", "get_active_engine"]
__version__ = "1.0.0"
