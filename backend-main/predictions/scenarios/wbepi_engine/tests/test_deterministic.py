"""
Tier 1 — Deterministic parity tests.

These force the model into regimes where the outcome is fully
determined (or extremely close), so R and Python must agree to the
integer.  Maps directly to ``validation.md`` §Tier 1 and to many of
the R tests in ``test_run_seirdv.R``.
"""

import numpy as np
import pytest

from predictions.scenarios.wbepi_engine import run_seirdv


# -----------------------------------------------------------------------
# T1.1 — No infection, no vaccination → everything static
# -----------------------------------------------------------------------

class TestNoInfectionNoVaccination:
    """T1.1: beta=0, vacc_coverage=0, ini_E=ini_I=0 → all columns constant."""

    def test_single_pop_all_static(self, rng):
        df = run_seirdv(
            n_populations=1,
            ini_S=[500],
            beta=0.0,
            vacc_coverage=0.0,
            time=20,
            rng=rng,
        )
        for col in ["S[1]", "E[1]", "I[1]", "R[1]", "D[1]", "V[1]"]:
            assert df[col].nunique() == 1, f"{col} changed unexpectedly"

    def test_two_pop_static(self, rng):
        df = run_seirdv(
            n_populations=2,
            ini_S=[100, 200],
            ini_R=[10, 20],
            beta=0.0,
            time=10,
            rng=rng,
        )
        for p in [1, 2]:
            for c in "SEIRDV":
                col = f"{c}[{p}]"
                assert df[col].nunique() == 1, f"{col} changed"


# -----------------------------------------------------------------------
# T1.2 — Initial step preserved
# -----------------------------------------------------------------------

class TestInitialStepPreserved:
    """T1.2: step==1 row must equal the initial vectors for every sim."""

    def test_initial_row(self, rng):
        df = run_seirdv(
            n_populations=2,
            ini_S=[10, 11],
            ini_E=[66, 3],
            ini_I=[3, 1],
            ini_R=[10, 20],
            ini_D=69,
            ini_V=[2, 3],
            time=5,
            n_sims=3,
            rng=rng,
        )
        first = df[df["step"] == 1]
        # Every sim's step-1 row should be identical
        assert len(first) == 3
        for _, row in first.iterrows():
            assert row["S[1]"] == 10
            assert row["S[2]"] == 11
            assert row["E[1]"] == 66
            assert row["E[2]"] == 3
            assert row["I[1]"] == 3
            assert row["I[2]"] == 1
            assert row["R[1]"] == 10
            assert row["R[2]"] == 20
            assert row["D[1]"] == 69
            assert row["D[2]"] == 69  # scalar broadcast
            assert row["V[1]"] == 2
            assert row["V[2]"] == 3


# -----------------------------------------------------------------------
# T1.3 — Conservation of population
# -----------------------------------------------------------------------

class TestConservation:
    """T1.3: S+E+I+R+D+V = constant for every (sim, pop, step)."""

    def test_conservation_with_transmission(self, rng):
        df = run_seirdv(
            n_populations=2,
            ini_S=[1000, 2000],
            ini_I=[10, 5],
            beta=0.3,
            sigma=1 / 7,
            gamma=1 / 14,
            mu=0.2,
            vacc_coverage=0.05,
            vacc_efficacy=0.9,
            diffusion=0.1,
            time=50,
            n_sims=5,
            rng=rng,
        )
        for p in [1, 2]:
            total = (
                df[f"S[{p}]"]
                + df[f"E[{p}]"]
                + df[f"I[{p}]"]
                + df[f"R[{p}]"]
                + df[f"D[{p}]"]
                + df[f"V[{p}]"]
            )
            ini_total = total.iloc[0]
            assert (total == ini_total).all(), (
                f"Population {p} total changed"
            )


# -----------------------------------------------------------------------
# T1.4 — Extreme β drains S in one step
# -----------------------------------------------------------------------

class TestExtremeBeta:
    """T1.4: β=1e6 → S should be 0 after one step."""

    def test_extreme_beta(self, rng):
        df = run_seirdv(
            n_populations=1,
            ini_S=[100],
            ini_I=[1],
            beta=1e6,
            sigma=0.0,
            gamma=0.0,
            time=3,
            rng=rng,
        )
        assert df.loc[df["step"] == 2, "S[1]"].iloc[0] == 0


# -----------------------------------------------------------------------
# T1.5 — Extreme γ drains I in one step
# -----------------------------------------------------------------------

class TestExtremeGamma:
    """T1.5: γ=1e6, μ=0 → I drains to R in one step."""

    def test_extreme_gamma(self, rng):
        df = run_seirdv(
            n_populations=1,
            ini_S=[0],
            ini_I=[100],
            beta=0.0,
            sigma=0.0,
            gamma=1e6,
            mu=0.0,
            time=3,
            rng=rng,
        )
        row2 = df[df["step"] == 2].iloc[0]
        assert row2["I[1]"] == 0
        assert row2["R[1]"] == 100


# -----------------------------------------------------------------------
# T1.6 — μ=1 sends all to D
# -----------------------------------------------------------------------

class TestMuOne:
    """T1.6: μ=1 → every individual leaving I goes to D, never R."""

    def test_all_die(self, rng):
        df = run_seirdv(
            n_populations=1,
            ini_S=[1000],
            ini_E=[1],
            beta=1e6,
            sigma=1e6,
            gamma=1e6,
            mu=1.0,
            time=7,
            rng=rng,
        )
        # R column should stay 0
        assert (df["R[1]"] == 0).all()
        # All 1001 individuals end up dead
        assert df.loc[df["step"] == 7, "D[1]"].iloc[0] == 1001


# -----------------------------------------------------------------------
# T1.7 — Response trigger and release
# -----------------------------------------------------------------------

class TestResponseTrigger:
    """T1.7: status flips at expected steps."""

    def test_trigger_with_delay_2(self, rng):
        """
        Mirrors R test: 3 populations, interv_delay=2.
        - Pop 1 has ini_I=1 → active from step 1, status=1 at step 3
        - Pop 2 has ini_E=1 → I>0 at step 2, status=1 at step 4
        - Pop 3 has nothing → status stays 0
        """
        df = run_seirdv(
            n_populations=3,
            ini_S=[1000, 1000, 1000],
            ini_E=[0, 1, 0],
            ini_I=[1, 0, 0],
            beta=1e6,
            sigma=1e6,
            gamma=1e6,
            interv_delay=2,
            time=8,
            rng=rng,
        )
        s1 = df["status[1]"].tolist()
        s2 = df["status[2]"].tolist()
        s3 = df["status[3]"].tolist()

        # Pop 1: status=0 for steps 1-2, then 1 for steps 3-8
        assert s1 == [0, 0, 1, 1, 1, 1, 1, 1]
        # Pop 2: status=0 for steps 1-3, then 1 for steps 4-8
        assert s2 == [0, 0, 0, 1, 1, 1, 1, 1]
        # Pop 3: always 0
        assert s3 == [0] * 8

    def test_trigger_with_delay_0(self, rng):
        """
        Mirrors R test: interv_delay=0.
        - Pop 1 has ini_I=1 → status=1 from step 1 (immediate)
        - Pop 2 has ini_E=1 → I>0 at step 2, status=1 from step 2
        - Pop 3: never
        """
        df = run_seirdv(
            n_populations=3,
            ini_S=[1000, 1000, 1000],
            ini_E=[0, 1, 0],
            ini_I=[1, 0, 0],
            beta=1e6,
            sigma=1e6,
            gamma=1e6,
            interv_delay=0,
            time=5,
            rng=rng,
        )
        s1 = df["status[1]"].tolist()
        s2 = df["status[2]"].tolist()
        s3 = df["status[3]"].tolist()

        assert s1 == [1] * 5
        assert s2 == [0, 1, 1, 1, 1]
        assert s3 == [0] * 5

    def test_response_release(self, rng):
        """
        Mirrors R test: interv_delay=5, interv_release=3.
        Pop 1 (ini_I=10): immediate I, response at step 6,
        with extreme σ + γ and vacc_coverage=1 + vacc_eff=1 → S drains
        → I drops to 0 quickly → release after 3 consecutive zero days.
        """
        df = run_seirdv(
            n_populations=2,
            ini_S=[1_000_000, 1_000_000],
            ini_I=[10, 0],
            beta=2.456,
            sigma=1e30,
            gamma=1e30,
            vacc_efficacy=1.0,
            interv_delay=5,
            interv_vacc_coverage=1.0,
            interv_release=3,
            time=15,
            rng=rng,
        )
        s1 = df["status[1]"].tolist()
        s2 = df["status[2]"].tolist()

        # Pop 1: 0 for steps 1-5, 1 for steps 6-10, 0 for steps 11-15
        assert s1 == [0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0]
        # Pop 2: always 0
        assert s2 == [0] * 15


# -----------------------------------------------------------------------
# T1.8 — Spatial isolation when diffusion == 0
# -----------------------------------------------------------------------

class TestSpatialIsolation:
    """T1.8: diffusion=0 → populations are independent."""

    def test_no_cross_infection(self, rng):
        df = run_seirdv(
            n_populations=2,
            ini_S=[1000, 1000],
            ini_I=[10, 0],
            beta=0.5,
            sigma=1 / 7,
            gamma=1 / 14,
            diffusion=0.0,
            time=100,
            n_sims=3,
            rng=rng,
        )
        # Pop 2 should have zero E, I, R, D for all steps and sims
        for c in ["E[2]", "I[2]", "R[2]", "D[2]"]:
            assert (df[c] == 0).all(), f"{c} should stay zero with no diffusion"


# -----------------------------------------------------------------------
# Additional deterministic tests (from R test_run_seirdv.R)
# -----------------------------------------------------------------------

class TestDefaultParams:
    """Default call produces 1 row with all zeros except sim=1, step=1."""

    def test_defaults(self):
        df = run_seirdv()
        assert df.shape == (1, 9)
        assert list(df.columns) == [
            "sim", "step", "S[1]", "E[1]", "I[1]", "R[1]", "D[1]", "V[1]", "status[1]"
        ]
        assert df.iloc[0].tolist() == [1, 1, 0, 0, 0, 0, 0, 0, 0]


class TestDimensions:
    """Output dimensions match n_populations × time × n_sims."""

    def test_3pop_10steps(self):
        df = run_seirdv(n_populations=3, time=10)
        assert df.shape == (10, 23)

    def test_2pop_3steps(self):
        df = run_seirdv(n_populations=2, time=3)
        assert df.shape == (3, 16)

    def test_multi_sim(self):
        df = run_seirdv(n_populations=2, time=4, n_sims=3)
        assert df.shape == (12, 16)
        assert df["sim"].tolist() == [1]*4 + [2]*4 + [3]*4
        assert df["step"].tolist() == [1, 2, 3, 4] * 3


class TestBasicProgression:
    """With extreme params, verify deterministic spread (R snapshot test)."""

    def test_patch1_spreads_patch2_safe(self, rng):
        df = run_seirdv(
            time=10,
            n_populations=2,
            ini_S=1000,
            ini_E=[1, 0],
            beta=1e6,
            sigma=1e6,
            gamma=1e6,
            time_=None,  # not a real param, will be ignored
            rng=rng,
        ) if False else run_seirdv(
            time=10,
            n_populations=2,
            ini_S=1000,
            ini_E=[1, 0],
            beta=1e6,
            sigma=1e6,
            gamma=1e6,
            rng=rng,
        )
        # Patch 1: all go through S→E→I→R quickly
        # After a few steps, S[1] should be 0
        final = df[df["step"] == 10].iloc[0]
        assert final["S[1]"] == 0
        # Patch 2: no infection (diffusion=0 by default)
        assert (df["I[2]"] == 0).all()
        assert (df["E[2]"] == 0).all()


class TestSpatialDiffusion:
    """With diffusion>0, infection crosses populations."""

    def test_diffusion_spreads(self, rng):
        df = run_seirdv(
            time=10,
            n_populations=2,
            ini_S=1000,
            ini_E=[1, 0],
            beta=1e6,
            sigma=1e6,
            gamma=1e6,
            diffusion=0.1,
            rng=rng,
        )
        # Patch 2 should eventually get infection via diffusion
        assert df["R[2]"].iloc[-1] > 0


class TestDeltaMatrix:
    """Explicit delta matrix controls which populations get FOI."""

    def test_selective_diffusion(self, rng):
        delta_mat = np.array([
            [0.5, 0.5, 0.0],
            [0.0, 1.0, 0.0],
            [0.0, 0.0, 1.0],
        ])
        df = run_seirdv(
            time=10,
            n_populations=3,
            ini_S=1000,
            ini_E=[1, 0, 0],
            beta=1e6,
            sigma=1e6,
            gamma=1e6,
            delta=delta_mat,
            rng=rng,
        )
        # Pop 1 and 2 get infected (pop 1 spreads to pop 2)
        assert df["R[1]"].iloc[-1] > 0
        assert df["R[2]"].iloc[-1] > 0
        # Pop 3 is isolated — no infection
        assert (df["E[3]"] == 0).all()
        assert (df["I[3]"] == 0).all()
        assert (df["R[3]"] == 0).all()


class TestRoutineVaccination:
    """Routine vaccination moves S → V."""

    def test_vaccination_reduces_S(self, rng):
        df = run_seirdv(
            time=10,
            n_populations=2,
            ini_S=1000,
            ini_E=[10, 0],
            beta=1.0,
            sigma=1e6,
            gamma=0.0,
            vacc_coverage=0.1,
            vacc_efficacy=1.0,
            rng=rng,
        )
        # S should decrease in both populations
        assert all(df.loc[df["step"] > 1, "S[1]"] < 1000)
        assert all(df.loc[df["step"] > 1, "S[2]"] < 1000)
        # V should increase
        assert all(df.loc[df["step"] > 1, "V[1]"] > 0)
        assert all(df.loc[df["step"] > 1, "V[2]"] > 0)
        # No infection in pop 2
        assert (df["I[2]"] == 0).all()

    def test_50pct_coverage(self, rng):
        """50% coverage + 100% efficacy → ~50% of S vaccinated after 1 step."""
        df = run_seirdv(
            time=3,
            ini_S=100_000_000,
            vacc_coverage=0.5,
            vacc_efficacy=1.0,
            rng=rng,
        )
        ratio = df.loc[df["step"] == 2, "V[1]"].iloc[0] / 100_000_000
        assert 0.49 < ratio < 0.51

    def test_coverage_times_efficacy(self, rng):
        """50% coverage + 20% efficacy → ~10% vaccinated."""
        df = run_seirdv(
            time=3,
            ini_S=100_000_000,
            vacc_coverage=0.5,
            vacc_efficacy=0.2,
            rng=rng,
        )
        ratio = df.loc[df["step"] == 2, "V[1]"].iloc[0] / 100_000_000
        assert 0.09 < ratio < 0.11


class TestMortality:
    """Mortality distributes I exits between R and D."""

    def test_mu_1_all_die(self, rng):
        df = run_seirdv(
            time=7,
            ini_S=[1000],
            ini_E=[1],
            beta=1e6,
            sigma=1e6,
            gamma=1e6,
            mu=1.0,
            rng=rng,
        )
        assert df.loc[df["step"] == 7, "D[1]"].iloc[0] == 1001

    def test_mu_02_about_20pct(self, rng):
        df = run_seirdv(
            time=7,
            ini_S=[100_000_000],
            ini_E=[1],
            beta=1e6,
            sigma=1e6,
            gamma=1e6,
            mu=0.2,
            rng=rng,
        )
        mortality = df.loc[df["step"] == 7, "D[1]"].iloc[0] / 100_000_000
        assert 0.19 < mortality < 0.21


class TestReactiveGlobalVaccination:
    """interv_vacc_type=1 reactive vaccination."""

    def test_all_S_vaccinated_after_response(self, rng):
        df = run_seirdv(
            time=10,
            n_populations=2,
            ini_S=1_000_000,
            ini_I=[10, 0],
            beta=2.456,
            sigma=1e30,
            gamma=1 / 14,
            vacc_coverage=0.1,
            vacc_efficacy=1.0,
            interv_delay=5,
            interv_vacc_coverage=1.0,
            rng=rng,
        )
        # After response (step 7+), pop 1 S should be 0
        assert all(df.loc[df["step"] >= 7, "S[1]"] == 0)
        # Pop 2 never enters response → S stays > 0
        assert all(df["S[2]"] > 0)

    def test_double_coverage_ratio(self, rng):
        """Pop 1 (in response) gets ~2x vaccination vs pop 2 (routine only)."""
        df = run_seirdv(
            time=200,
            n_populations=2,
            ini_S=1_000_000,
            ini_I=[10, 0],
            beta=0.0,
            vacc_coverage=0.001,
            vacc_efficacy=0.5,
            interv_delay=0,
            interv_vacc_coverage=0.001,
            rng=rng,
        )
        vacc_ratio = df.loc[df["step"] > 1, "V[1]"].values / df.loc[df["step"] > 1, "V[2]"].values
        mean_ratio = vacc_ratio.mean()
        assert 1.9 < mean_ratio < 2.1


class TestReactiveTargetedVaccination:
    """interv_vacc_type=2 ring vaccination."""

    def test_target_size_zero_no_vaccination(self, rng):
        df = run_seirdv(
            time=10,
            n_populations=2,
            ini_S=1_000_000,
            ini_I=[10, 0],
            beta=2.456,
            sigma=1e30,
            gamma=1 / 14,
            vacc_coverage=0.0,
            vacc_efficacy=1.0,
            interv_delay=3,
            interv_vacc_type=2,
            target_size=0,
            rng=rng,
        )
        assert (df["V[1]"] == 0).all()
        assert (df["V[2]"] == 0).all()

    def test_ring_vaccination_proportional_to_I(self, rng):
        """
        3 populations, ini_I=[10, 20, 0], target_size=100.
        Pop 2 should get ~2x vaccination of pop 1; pop 3 gets none.
        """
        df = run_seirdv(
            time=20,
            n_populations=3,
            delta=np.eye(3),
            ini_S=1_000_000,
            ini_I=[10, 20, 0],
            beta=0.0,
            gamma=0.0,
            vacc_coverage=0.0,
            vacc_efficacy=1.0,
            interv_delay=1,
            interv_vacc_type=2,
            target_size=100,
            rng=rng,
        )
        v1_step3 = df.loc[df["step"] == 3, "V[1]"].iloc[0]
        v2_step3 = df.loc[df["step"] == 3, "V[2]"].iloc[0]
        assert 900 < v1_step3 < 1100
        assert 1900 < v2_step3 < 2100
        assert (df["V[3]"] == 0).all()

        # Ratio check across later steps
        later = df[df["step"] >= 4]
        ratio = later["V[2]"].values / later["V[1]"].values
        assert 1.9 < ratio.mean() < 2.1


class TestResponseDecreasesTransmission:
    """interv_efficacy=1 should stop new infections once response activates."""

    def test_efficacy_1_stops_transmission(self, rng):
        delta_mat = np.array([[0.5, 0.5], [0.0, 1.0]])
        df = run_seirdv(
            time=20,
            n_populations=2,
            ini_S=1_000_000,
            ini_I=[10, 0],
            beta=11.123,
            sigma=1e30,
            gamma=1 / 14,
            interv_delay=2,
            interv_efficacy=1.0,
            delta=delta_mat,
            rng=rng,
        )
        # Pop 1: E > 0 on steps 2-3, then E == 0 from step 4 onwards
        assert all(df.loc[df["step"].isin([2, 3]), "E[1]"] > 0)
        assert all(df.loc[df["step"] >= 4, "E[1]"] == 0)
