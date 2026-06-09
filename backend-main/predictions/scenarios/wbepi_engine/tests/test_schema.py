"""
Tier 3 — Schema parity tests.

Column names, ordering, row count, dtypes, and indexing conventions must
match the R output exactly.  Maps to ``validation.md`` §Tier 3.
"""

import numpy as np
import pytest

from predictions.scenarios.wbepi_engine import run_seirdv


class TestColumnNames:
    """T3.1: Column names must be R-style 1-indexed bracketed names."""

    def test_single_pop(self):
        df = run_seirdv(n_populations=1, time=1)
        expected = [
            "sim", "step",
            "S[1]", "E[1]", "I[1]", "R[1]", "D[1]", "V[1]",
            "status[1]",
        ]
        assert list(df.columns) == expected

    def test_four_pop(self):
        df = run_seirdv(n_populations=4, time=1)
        expected = ["sim", "step"]
        for comp in ["S", "E", "I", "R", "D", "V"]:
            for p in range(1, 5):
                expected.append(f"{comp}[{p}]")
        for p in range(1, 5):
            expected.append(f"status[{p}]")
        assert list(df.columns) == expected

    def test_column_count(self):
        """Total columns: 2 + 7 * n_populations."""
        for n in [1, 2, 4, 10]:
            df = run_seirdv(n_populations=n, time=1)
            assert len(df.columns) == 2 + 7 * n, f"Wrong column count for n={n}"


class TestRowCountAndOrdering:
    """T3.2: Rows = n_sims * time, ordered by (sim, step) ascending."""

    def test_row_count(self):
        for time, n_sims in [(1, 1), (10, 1), (5, 3), (365, 10)]:
            df = run_seirdv(time=time, n_sims=n_sims)
            assert len(df) == n_sims * time

    def test_ordering(self):
        df = run_seirdv(time=5, n_sims=3)
        sims = df["sim"].tolist()
        steps = df["step"].tolist()
        # Should be sorted by (sim, step)
        assert sims == sorted(sims)
        for s in [1, 2, 3]:
            sim_steps = df.loc[df["sim"] == s, "step"].tolist()
            assert sim_steps == list(range(1, 6))

    def test_sim_1_indexed(self):
        df = run_seirdv(n_sims=3, time=2)
        assert df["sim"].min() == 1
        assert df["sim"].max() == 3

    def test_step_1_indexed(self):
        df = run_seirdv(time=10)
        assert df["step"].min() == 1
        assert df["step"].max() == 10


class TestDtype:
    """T3.3: sim, step are int; compartments are int; status is int (0/1)."""

    def test_all_int(self):
        df = run_seirdv(
            n_populations=2,
            ini_S=[100, 200],
            ini_I=[5, 0],
            beta=0.3,
            sigma=1 / 7,
            gamma=1 / 14,
            mu=0.1,
            time=20,
            n_sims=2,
            rng=np.random.default_rng(99),
        )
        for col in df.columns:
            assert np.issubdtype(df[col].dtype, np.integer), (
                f"Column '{col}' has dtype {df[col].dtype}, expected integer"
            )

    def test_status_binary(self):
        df = run_seirdv(
            n_populations=2,
            ini_S=[1000, 1000],
            ini_I=[10, 0],
            beta=0.5,
            sigma=1 / 7,
            gamma=1 / 14,
            interv_delay=5,
            time=50,
            rng=np.random.default_rng(99),
        )
        for p in [1, 2]:
            vals = df[f"status[{p}]"].unique()
            assert set(vals).issubset({0, 1}), (
                f"status[{p}] has non-binary values: {vals}"
            )
