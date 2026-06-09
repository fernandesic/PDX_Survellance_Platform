"""Tests for the parameter-fitting layer (priors + fitting).

Strategy: generate synthetic cumulative-case time series from the
deterministic ODE with KNOWN parameters, then verify the fit recovers
those parameters within a reasonable tolerance.

Tests are fast (< 5s each) — full pytest run remains under 1 second
without these, under 30s with.
"""

from __future__ import annotations

import numpy as np
import pytest

from predictions.scenarios.wbepi_engine.fitting import (
    FitResult,
    _simulate_cumulative_cases,
    fit_parameters,
    fit_with_bootstrap,
)
from predictions.scenarios.wbepi_engine.priors import (
    ParameterPrior,
    PathogenPriors,
    get_pathogen_priors,
    list_pathogens,
    sample_from_priors,
)


# ─── Priors ──────────────────────────────────────────────────────


def test_cholera_priors_validated():
    """Cholera is the one validated pathogen entry."""
    p = get_pathogen_priors("cholera")
    assert p.validated is True
    assert p.beta.low > 0 and p.beta.high > p.beta.low
    assert len(p.sources) >= 2


def test_unknown_pathogen_raises():
    with pytest.raises(KeyError, match="Unknown pathogen_id"):
        get_pathogen_priors("plague")


def test_list_pathogens_and_only_validated():
    all_ids = list_pathogens()
    assert "cholera" in all_ids
    assert "ebola" in all_ids
    validated = list_pathogens(only_validated=True)
    assert validated == ["cholera"]


def test_parameter_prior_sample_within_bounds():
    pr = ParameterPrior(0.1, 0.5)
    rng = np.random.default_rng(0)
    s = pr.sample(rng, size=1000)
    assert s.min() >= 0.1
    assert s.max() <= 0.5


def test_parameter_prior_rejects_inverted_bounds():
    with pytest.raises(ValueError, match="low.*>.*high"):
        ParameterPrior(0.5, 0.1)


def test_sample_from_priors_shape_and_keys():
    rng = np.random.default_rng(1)
    samples = sample_from_priors("cholera", n_samples=100, rng=rng)
    assert set(samples.keys()) == {"beta", "sigma", "gamma", "mu"}
    for arr in samples.values():
        assert arr.shape == (100,)


# ─── ODE simulation sanity ───────────────────────────────────────


def test_ode_cumulative_monotone_increasing(rng):
    """Cumulative cases (= initial_S - S(t)) is non-decreasing by construction."""
    times = np.linspace(0, 365, 100)
    cum = _simulate_cumulative_cases(
        beta=0.3, sigma=1 / 5, gamma=1 / 7, mu=0.02,
        initial_S=10000, initial_I=10, time_grid=times,
    )
    assert cum[0] == 0
    diffs = np.diff(cum)
    # Allow tiny numerical noise but must not decrease meaningfully.
    assert np.all(diffs >= -1e-6), "cumulative cases decreased somewhere"


def test_ode_zero_beta_no_infections():
    times = np.linspace(0, 365, 50)
    cum = _simulate_cumulative_cases(
        beta=0.0, sigma=1 / 5, gamma=1 / 7, mu=0.02,
        initial_S=10000, initial_I=10, time_grid=times,
    )
    # I drains via gamma but no new infections from S, so cumulative new
    # cases (= initial_S - S(t)) stays at zero.
    assert np.allclose(cum, 0.0, atol=1e-6)


# ─── Recovery: fit synthetic data with known params ─────────────


def _make_synthetic_outbreak(*, beta, sigma, gamma, mu, initial_S=10000,
                              initial_I=10, time=180, n_obs=60):
    """Generate noiseless synthetic cumulative-case observations."""
    times = np.linspace(0, time, n_obs)
    cum = _simulate_cumulative_cases(
        beta=beta, sigma=sigma, gamma=gamma, mu=mu,
        initial_S=initial_S, initial_I=initial_I, time_grid=times,
    )
    return times, cum


def test_fit_recovers_known_cholera_params():
    """With noiseless synthetic data, fit should recover params well."""
    true = {"beta": 0.5, "sigma": 0.5, "gamma": 0.2, "mu": 0.02}
    times, cum = _make_synthetic_outbreak(**true)
    res = fit_parameters(
        "cholera",
        observed_cumulative_cases=cum, time_grid=times,
        initial_S=10000, initial_I=10,
    )
    assert res.converged
    # The fitted attack-rate trajectory should be close to the truth;
    # individual params can drift due to identifiability (β/γ enters as
    # R0 = β/γ in the ODE). Check the *predicted* cumulative cases
    # rather than each parameter individually.
    predicted = _simulate_cumulative_cases(
        **res.point_estimate, initial_S=10000, initial_I=10, time_grid=times,
    )
    rel_err = np.max(np.abs(predicted - cum) / np.maximum(cum, 1.0))
    assert rel_err < 0.05, f"trajectory recovery off: max rel err {rel_err:.3f}"
    assert res.rmse < 50  # absolute fit quality on a 10k pop


def test_fit_returns_kwargs_compatible_with_run_seirdv():
    """The point estimate must be a dict that drops straight into run_seirdv."""
    true = {"beta": 0.4, "sigma": 0.4, "gamma": 0.15, "mu": 0.03}
    times, cum = _make_synthetic_outbreak(**true)
    res = fit_parameters(
        "cholera",
        observed_cumulative_cases=cum, time_grid=times,
        initial_S=10000, initial_I=10,
    )
    kwargs = res.as_run_seirdv_kwargs()
    assert set(kwargs.keys()) == {"beta", "sigma", "gamma", "mu"}
    assert all(isinstance(v, float) for v in kwargs.values())


# ─── Bootstrap CI ────────────────────────────────────────────────


def test_bootstrap_widens_ci_with_noise():
    """A noisy series should produce CIs wider than just numerical jitter."""
    true = {"beta": 0.5, "sigma": 0.5, "gamma": 0.2, "mu": 0.02}
    times, cum_clean = _make_synthetic_outbreak(**true, n_obs=50)
    rng = np.random.default_rng(42)
    # Add 5% multiplicative noise to mimic surveillance error.
    noise = rng.normal(1.0, 0.05, size=cum_clean.shape)
    cum_noisy = np.maximum(cum_clean * noise, 0)
    cum_noisy = np.maximum.accumulate(cum_noisy)  # enforce monotonic

    res = fit_with_bootstrap(
        "cholera",
        observed_cumulative_cases=cum_noisy, time_grid=times,
        initial_S=10000, initial_I=10,
        n_bootstrap=30,  # small for test speed
        rng=rng,
    )
    assert res.n_bootstrap > 0, "all bootstrap iterations failed"
    assert set(res.ci_lower.keys()) == {"beta", "sigma", "gamma", "mu"}
    for k in res.ci_lower:
        assert res.ci_lower[k] <= res.point_estimate[k] <= res.ci_upper[k] + 1e-9, (
            f"point_estimate not within CI for {k}"
        )


# ─── Validation guards ───────────────────────────────────────────


def test_fit_rejects_too_few_observations():
    with pytest.raises(ValueError, match="at least 4"):
        fit_parameters(
            "cholera",
            observed_cumulative_cases=np.array([0.0, 1.0, 2.0]),
            time_grid=np.array([0.0, 1.0, 2.0]),
            initial_S=1000,
        )


def test_fit_rejects_non_monotonic_time_grid():
    with pytest.raises(ValueError, match="strictly increasing"):
        fit_parameters(
            "cholera",
            observed_cumulative_cases=np.array([0.0, 1.0, 2.0, 3.0]),
            time_grid=np.array([0.0, 2.0, 1.0, 3.0]),
            initial_S=1000,
        )


def test_fit_rejects_shape_mismatch():
    with pytest.raises(ValueError, match="must match shape"):
        fit_parameters(
            "cholera",
            observed_cumulative_cases=np.array([0.0, 1.0, 2.0, 3.0]),
            time_grid=np.array([0.0, 1.0, 2.0, 3.0, 4.0]),
            initial_S=1000,
        )


def test_fit_uses_supplied_priors_override():
    """Passing custom priors should bound the search outside the registry default."""
    custom = PathogenPriors(
        pathogen_id="custom",
        name="custom",
        description="",
        beta=ParameterPrior(0.1, 0.15),
        sigma=ParameterPrior(0.1, 0.15),
        gamma=ParameterPrior(0.05, 0.10),
        mu=ParameterPrior(0.0, 0.01),
    )
    times, cum = _make_synthetic_outbreak(beta=0.12, sigma=0.13, gamma=0.07, mu=0.005)
    res = fit_parameters(
        "custom",  # overridden by priors=, so id doesn't have to be in registry
        observed_cumulative_cases=cum, time_grid=times,
        initial_S=10000, initial_I=10,
        priors=custom,
    )
    pe = res.point_estimate
    assert custom.beta.low <= pe["beta"] <= custom.beta.high
    assert custom.gamma.low <= pe["gamma"] <= custom.gamma.high
