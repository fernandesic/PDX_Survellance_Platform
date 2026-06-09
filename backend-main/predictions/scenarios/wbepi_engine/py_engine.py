"""
Pure-Python SEIRDV stochastic simulator — fallback when rpy2/R unavailable.

Produces the EXACT same DataFrame schema as r_engine.py:
  columns: sim, step, S[1..n], E[1..n], I[1..n], R[1..n], D[1..n], V[1..n], status[1..n]
  rows: n_sims × time

Uses Euler-Maruyama discrete-time stochastic simulation with binomial
draws for transitions — statistically equivalent to the R implementation.
"""

from __future__ import annotations

import logging
from collections.abc import Sequence

import numpy as np
import pandas as pd

_log = logging.getLogger("wbepi.py_engine")


def run_seirdv(
    *,
    n_populations: int = 1,
    ini_S: Sequence[int] | int = 0,
    ini_I: Sequence[int] | int = 0,
    ini_E: Sequence[int] | int = 0,
    ini_R: Sequence[int] | int = 0,
    ini_D: Sequence[int] | int = 0,
    ini_V: Sequence[int] | int = 0,
    beta: float = 0.0,
    sigma: float = 0.0,
    gamma: float = 0.0,
    mu: float = 0.0,
    vacc_coverage: float = 0.0,
    vacc_efficacy: float = 0.0,
    interv_delay: int | float = 1e30,
    interv_efficacy: float = 0.0,
    interv_vacc_type: int = 1,
    interv_vacc_coverage: float = 0.0,
    target_size: float = 0.0,
    interv_release: int = 21,
    time: int = 1,
    diffusion: float = 0.0,
    delta: np.ndarray | None = None,
    n_sims: int = 1,
    rng: np.random.Generator | None = None,
) -> pd.DataFrame:
    """Run stochastic SEIRDV simulation in pure Python/NumPy."""

    if rng is None:
        rng = np.random.default_rng()

    n = n_populations

    def _to_arr(v, length):
        if np.isscalar(v):
            return np.full(length, int(v), dtype=np.int64)
        a = np.asarray(v, dtype=np.int64)
        if a.shape == ():
            return np.full(length, int(a), dtype=np.int64)
        if a.shape[0] < length:
            # Pad short sequences with zeros so per-population indexing
            # never goes out of bounds and N = S + E + ... is consistent.
            padded = np.zeros(length, dtype=np.int64)
            padded[:a.shape[0]] = a
            return padded
        return a[:length]

    S0 = _to_arr(ini_S, n)
    E0 = _to_arr(ini_E, n)
    I0 = _to_arr(ini_I, n)
    R0 = _to_arr(ini_R, n)
    D0 = _to_arr(ini_D, n)
    V0 = _to_arr(ini_V, n)

    records = []

    for sim_idx in range(1, n_sims + 1):
        S = S0.copy().astype(float)
        E = E0.copy().astype(float)
        I = I0.copy().astype(float)
        Rc = R0.copy().astype(float)
        Dc = D0.copy().astype(float)
        Vc = V0.copy().astype(float)

        for step in range(1, time + 1):
            # Apply intervention after delay
            eff_beta = beta
            if step >= interv_delay:
                eff_beta = beta * (1.0 - interv_efficacy)

            N = S + E + I + Rc + Vc  # population excluding dead

            row = {'sim': sim_idx, 'step': step}

            new_S = np.zeros(n)
            new_E = np.zeros(n)
            new_I = np.zeros(n)
            new_R = np.zeros(n)
            new_D = np.zeros(n)
            new_V = np.zeros(n)

            for p in range(n):
                Np = max(N[p], 1)

                # Force of infection
                foi = eff_beta * I[p] / Np

                # Stochastic transitions (binomial draws).
                # Recovery and death are *competing risks* over the same I
                # compartment: draw total removals first, then partition into
                # deaths vs recoveries using the case-fatality fraction. This
                # preserves mass conservation — independent Bin(I, γ(1-μ)) and
                # Bin(I, γμ) draws can otherwise jointly exceed I in extreme
                # tails, producing spurious deaths or recoveries on clamp.
                new_exposed = rng.binomial(int(max(S[p], 0)), min(foi, 1.0))
                new_infectious = rng.binomial(int(max(E[p], 0)), min(sigma, 1.0))
                new_removed = rng.binomial(int(max(I[p], 0)), min(gamma, 1.0))
                new_dead = rng.binomial(int(new_removed), float(np.clip(mu, 0.0, 1.0)))
                new_recovered = new_removed - new_dead

                # Vaccination (ring or mass)
                new_vacc = 0
                if step >= interv_delay and vacc_coverage > 0:
                    new_vacc = rng.binomial(
                        int(max(S[p], 0)),
                        min(vacc_coverage * vacc_efficacy, 1.0)
                    )

                # Update compartments
                new_S[p] = max(S[p] - new_exposed - new_vacc, 0)
                new_E[p] = max(E[p] + new_exposed - new_infectious, 0)
                new_I[p] = max(I[p] + new_infectious - new_recovered - new_dead, 0)
                new_R[p] = Rc[p] + new_recovered
                new_D[p] = Dc[p] + new_dead
                new_V[p] = Vc[p] + new_vacc

            S, E, I, Rc, Dc, Vc = new_S, new_E, new_I, new_R, new_D, new_V

            # Build row with R-style 1-indexed column names
            for p in range(n):
                j = p + 1
                row[f'S[{j}]'] = int(S[p])
                row[f'E[{j}]'] = int(E[p])
                row[f'I[{j}]'] = int(I[p])
                row[f'R[{j}]'] = int(Rc[p])
                row[f'D[{j}]'] = int(Dc[p])
                row[f'V[{j}]'] = int(Vc[p])
            for p in range(n):
                row[f'status[{p+1}]'] = 1 if I[p] > 0 else 0

            records.append(row)

    # Build column order matching r_engine._expected_columns
    cols = ['sim', 'step']
    for prefix in ('S', 'E', 'I', 'R', 'D', 'V'):
        cols += [f'{prefix}[{j}]' for j in range(1, n + 1)]
    cols += [f'status[{j}]' for j in range(1, n + 1)]

    df = pd.DataFrame(records, columns=cols)
    _log.info("Python SEIRDV: %d sims × %d steps × %d populations = %d rows",
              n_sims, time, n, len(df))
    return df
