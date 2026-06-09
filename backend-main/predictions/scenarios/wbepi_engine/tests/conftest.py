"""
Shared fixtures for wbepi_engine tests.
"""

from pathlib import Path

import numpy as np
import pytest


@pytest.fixture
def rng():
    """Deterministic RNG for reproducible tests."""
    return np.random.default_rng(42)


@pytest.fixture
def toy_data_path():
    """Path to the R reference toy_data.xlsx (10 sims).

    Vendored alongside the engine at ``tests/data/toy_data.xlsx``. Original
    source: World Bank wbepi R package (run.R with ``set.seed(1)``).
    """
    p = Path(__file__).resolve().parent / "data" / "toy_data.xlsx"
    if not p.exists():
        pytest.skip(
            f"R reference file not found at {p}. "
            "Tier-2 distributional tests require the vendored toy_data.xlsx."
        )
    return p


@pytest.fixture
def toy_data_n1000_path():
    """
    Path to the large R reference (1000 sims).

    Generate with::

        Rscript -e '
          library(wbepi); set.seed(1)
          x <- run_seirdv(n_populations=4, ini_S=c(1000,3000,12000,2000),
                          ini_I=c(10,0,0,1), beta=0.2, sigma=1/7, gamma=1/14,
                          mu=0.3, interv_delay=10, interv_efficacy=0.25,
                          interv_vacc_type=2L, target_size=200, interv_release=28,
                          time=365, diffusion=0.1, n_sims=1000)
          rio::export(x, file="toy_data_n1000.xlsx")
        '
    """
    p = Path(__file__).resolve().parent / "data" / "toy_data_n1000.xlsx"
    if not p.exists():
        pytest.skip(
            f"Large R reference file not found at {p}. "
            "See conftest.py docstring for generation instructions."
        )
    return p
