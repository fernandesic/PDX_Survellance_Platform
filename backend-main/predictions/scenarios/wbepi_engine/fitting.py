"""
SEIRDV parameter fitting from observed case data.

This module estimates the four core epidemic parameters
(``beta``, ``sigma``, ``gamma``, ``mu``) from a time series of observed
cases using a **deterministic ODE approximation** of the stochastic
SEIRDV engine, fitted by **least-squares**, with **bootstrap confidence
intervals**.

Why deterministic ODE for fitting (and not the stochastic engine itself)?
------------------------------------------------------------------------
Stochastic likelihood-free inference (ABC, particle filters, PyMC) is
the rigorous approach but is much slower and requires careful tuning
that is overkill for a counterfactual-scenario tool. The deterministic
ODE is:

- **Fast**: solves in milliseconds, so 1000-bootstrap-sample fits run
  in seconds rather than hours.
- **Industry-standard**: most outbreak parameter estimation in the
  applied epi literature uses this approach (e.g. Mukandavire 2011 for
  cholera, Legrand 2007 for Ebola).
- **Sufficient**: the resulting point estimates seed the stochastic
  engine; uncertainty propagation in the simulator captures the
  remaining variance.

A future enhancement (Phase 3) can swap in PyMC or particle filtering
without changing the public API.

Public API
----------
- ``fit_parameters(pathogen_id, observed_cases, ...)`` — point fit
- ``fit_with_bootstrap(...)`` — fit + percentile CIs over N resamples
- ``FitResult`` — dataclass capturing point estimate, CIs, and
  diagnostics

The fit observes the **cumulative case count** time series, since that
is the most commonly available outbreak data shape (e.g. WHO/AFRO
weekly situation reports).
"""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
from scipy.integrate import solve_ivp
from scipy.optimize import minimize

from predictions.scenarios.wbepi_engine.priors import (
    PathogenPriors,
    get_pathogen_priors,
)


# ─── Deterministic ODE (no vaccination, no intervention) ────────────


def _seirdv_ode(t: float, y: np.ndarray, beta: float, sigma: float,
                gamma: float, mu: float) -> np.ndarray:
    """Right-hand side of the deterministic SEIRDV ODE for fitting.

    State ``y = [S, E, I, R, D]``. Cumulative cases (the observable for
    fitting) is ``N - S`` where ``N = sum(y)`` is constant.

    Frequency-dependent FOI: ``β S I / N``.
    """
    S, E, I, R, D = y
    N = S + E + I + R + D
    if N <= 0:
        return np.zeros_like(y)
    foi = beta * S * I / N
    dS = -foi
    dE = foi - sigma * E
    dI = sigma * E - gamma * I
    dR = (1.0 - mu) * gamma * I
    dD = mu * gamma * I
    return np.array([dS, dE, dI, dR, dD])


def _simulate_cumulative_cases(
    *,
    beta: float, sigma: float, gamma: float, mu: float,
    initial_S: float, initial_I: float,
    time_grid: np.ndarray,
) -> np.ndarray:
    """Integrate the ODE and return the cumulative-case time series.

    Cumulative cases at time t = (S(0) - S(t)).
    """
    y0 = np.array([initial_S, 0.0, initial_I, 0.0, 0.0])
    sol = solve_ivp(
        _seirdv_ode,
        t_span=(time_grid[0], time_grid[-1]),
        y0=y0,
        t_eval=time_grid,
        args=(beta, sigma, gamma, mu),
        method="RK45",
        rtol=1e-6, atol=1e-9,
    )
    if not sol.success:
        raise RuntimeError(f"ODE integration failed: {sol.message}")
    S = sol.y[0]
    return initial_S - S


# ─── Fit results ────────────────────────────────────────────────────


@dataclass
class FitResult:
    """Outcome of a parameter fit."""

    pathogen_id: str
    point_estimate: dict[str, float]
    """Best-fit parameter values: keys ``beta``, ``sigma``, ``gamma``, ``mu``."""

    ci_lower: dict[str, float] = field(default_factory=dict)
    """Lower bound of the 95% bootstrap CI (empty when bootstrap not run)."""

    ci_upper: dict[str, float] = field(default_factory=dict)
    """Upper bound of the 95% bootstrap CI."""

    rmse: float = float("nan")
    """Root-mean-square error of point fit on the observed series."""

    n_bootstrap: int = 0
    """Number of successful bootstrap iterations."""

    converged: bool = True
    """Whether the underlying optimiser converged."""

    notes: str = ""

    def as_run_seirdv_kwargs(self) -> dict[str, float]:
        """Return the point estimate as kwargs for ``run_seirdv``."""
        return dict(self.point_estimate)


# ─── Point fit (single least-squares) ───────────────────────────────


def fit_parameters(
    pathogen_id: str,
    *,
    observed_cumulative_cases: np.ndarray,
    time_grid: np.ndarray,
    initial_S: float,
    initial_I: float = 1.0,
    priors: PathogenPriors | None = None,
) -> FitResult:
    """Single least-squares fit of (β, σ, γ, μ) to observed cumulative cases.

    Parameters
    ----------
    pathogen_id
        Pathogen library key, used to look up priors that bound the
        search.
    observed_cumulative_cases
        Length-T array of cumulative case counts.
    time_grid
        Length-T array of times (days) at which the observations were
        recorded. Must be strictly increasing and start at 0 or later.
    initial_S
        Population size of the susceptible pool at outbreak start.
    initial_I
        Initial number of infectious individuals (seed). Defaults to 1.
    priors
        Optional override of the registry priors (useful for tests).

    Returns
    -------
    FitResult with point_estimate populated. CI fields are empty —
    use ``fit_with_bootstrap`` for those.
    """
    priors = priors if priors is not None else get_pathogen_priors(pathogen_id)
    obs = np.asarray(observed_cumulative_cases, dtype=float)
    times = np.asarray(time_grid, dtype=float)

    if obs.shape != times.shape:
        raise ValueError(
            f"observed_cumulative_cases and time_grid must match shape; "
            f"got {obs.shape} vs {times.shape}"
        )
    if obs.size < 4:
        raise ValueError("Need at least 4 observations to fit 4 parameters.")
    if not np.all(np.diff(times) > 0):
        raise ValueError("time_grid must be strictly increasing.")

    bounds = [
        (priors.beta.low, priors.beta.high),
        (priors.sigma.low, priors.sigma.high),
        (priors.gamma.low, priors.gamma.high),
        (priors.mu.low, priors.mu.high),
    ]
    x0 = np.array([priors.beta.midpoint, priors.sigma.midpoint,
                   priors.gamma.midpoint, priors.mu.midpoint])

    def loss(params: np.ndarray) -> float:
        beta, sigma, gamma, mu = params
        try:
            pred = _simulate_cumulative_cases(
                beta=beta, sigma=sigma, gamma=gamma, mu=mu,
                initial_S=initial_S, initial_I=initial_I,
                time_grid=times,
            )
        except RuntimeError:
            return 1e18
        residuals = pred - obs
        return float(np.sum(residuals * residuals))

    result = minimize(
        loss, x0, method="L-BFGS-B", bounds=bounds,
        options={"maxiter": 200, "ftol": 1e-9},
    )

    pe = {
        "beta": float(result.x[0]),
        "sigma": float(result.x[1]),
        "gamma": float(result.x[2]),
        "mu": float(result.x[3]),
    }
    pred = _simulate_cumulative_cases(
        **pe, initial_S=initial_S, initial_I=initial_I, time_grid=times,
    )
    rmse = float(np.sqrt(np.mean((pred - obs) ** 2)))

    return FitResult(
        pathogen_id=pathogen_id,
        point_estimate=pe,
        rmse=rmse,
        converged=bool(result.success),
        notes=str(result.message),
    )


# ─── Bootstrap CI ───────────────────────────────────────────────────


def fit_with_bootstrap(
    pathogen_id: str,
    *,
    observed_cumulative_cases: np.ndarray,
    time_grid: np.ndarray,
    initial_S: float,
    initial_I: float = 1.0,
    n_bootstrap: int = 200,
    rng: np.random.Generator | None = None,
    priors: PathogenPriors | None = None,
) -> FitResult:
    """Point fit + 95% percentile bootstrap CI.

    Generates ``n_bootstrap`` resamples of the observed series (with
    replacement), refits each, and returns the 2.5/97.5 percentiles
    of the resulting parameter distributions as the CI.

    A bootstrap iteration that fails to converge is silently dropped.
    The number of *successful* iterations is recorded in
    ``FitResult.n_bootstrap``.

    Notes on the resampling strategy
    --------------------------------
    We resample observation **indices** (not individual residuals), so
    each bootstrap sample is itself a coherent time series of
    cumulative-case observations. This is "non-parametric residual
    bootstrap" — appropriate when the noise structure is unknown.
    """
    rng = rng if rng is not None else np.random.default_rng()
    obs = np.asarray(observed_cumulative_cases, dtype=float)
    times = np.asarray(time_grid, dtype=float)

    point = fit_parameters(
        pathogen_id,
        observed_cumulative_cases=obs,
        time_grid=times,
        initial_S=initial_S,
        initial_I=initial_I,
        priors=priors,
    )

    samples: dict[str, list[float]] = {k: [] for k in ("beta", "sigma", "gamma", "mu")}

    n_obs = obs.shape[0]
    for _ in range(n_bootstrap):
        idx = np.sort(rng.integers(0, n_obs, size=n_obs))
        # Drop duplicates so the time grid is still monotonic strict.
        idx = np.unique(idx)
        if idx.size < 4:
            continue
        try:
            r = fit_parameters(
                pathogen_id,
                observed_cumulative_cases=obs[idx],
                time_grid=times[idx],
                initial_S=initial_S,
                initial_I=initial_I,
                priors=priors,
            )
        except (ValueError, RuntimeError):
            continue
        if not r.converged:
            continue
        for k in samples:
            samples[k].append(r.point_estimate[k])

    n_success = len(samples["beta"])
    ci_lower: dict[str, float] = {}
    ci_upper: dict[str, float] = {}
    for k, vals in samples.items():
        if vals:
            arr = np.asarray(vals)
            ci_lower[k] = float(np.quantile(arr, 0.025))
            ci_upper[k] = float(np.quantile(arr, 0.975))

    point.ci_lower = ci_lower
    point.ci_upper = ci_upper
    point.n_bootstrap = n_success
    return point
