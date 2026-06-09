"""
Forecast Engine — Django port
Ported from triad_forecast_engine.py (FastAPI → Django).

Priority 1: Live Dynamic Risk Score (LiveRiskStore)
Priority 3: 3-model ensemble forecast (SEIR + Exponential Growth + Bayesian Network)
"""
from __future__ import annotations

import math
from datetime import datetime
from typing import Optional

import numpy as np


# ═════════════════════════════════════════════════════════════════════════════
# PRIORITY 1 — LIVE RISK STORE
# ═════════════════════════════════════════════════════════════════════════════

class LiveRiskStore:
    """In-memory store for engine-computed composite spillover risk scores."""

    def __init__(self):
        self._scores: dict[str, float] = {}
        self._last_run: Optional[datetime] = None
        self._imminent_count: int = 0
        self._warning_count: int = 0

    def update(self, assessments: list[dict]):
        self._scores = {a["iso3"]: a["composite_score"] for a in assessments}
        self._last_run = datetime.utcnow()
        stages = [a["stage"] for a in assessments]
        self._imminent_count = sum(1 for s in stages if s >= 3)
        self._warning_count = sum(1 for s in stages if s == 2)

    def get_regional_index(self) -> float:
        """Returns regional spillover risk index on 0–10 scale."""
        if not self._scores:
            return 6.2
        top5 = sorted(self._scores.values(), reverse=True)[:5]
        return round(sum(top5) / len(top5) / 10, 1)

    def is_stale(self, max_age_hours: int = 25) -> bool:
        if self._last_run is None:
            return True
        age = (datetime.utcnow() - self._last_run).total_seconds() / 3600
        return age > max_age_hours

    def summary(self) -> dict:
        return {
            "regional_index_0_10": self.get_regional_index(),
            "imminent_events": self._imminent_count,
            "warning_events": self._warning_count,
            "countries_scored": len(self._scores),
            "last_computed": self._last_run.isoformat() + "Z" if self._last_run else None,
            "is_stale": self.is_stale(),
        }


LIVE_RISK_STORE = LiveRiskStore()


# ═════════════════════════════════════════════════════════════════════════════
# PRIORITY 3 — ENSEMBLE FORECAST MODELS
# ═════════════════════════════════════════════════════════════════════════════

ENSEMBLE_WEIGHTS = {"seir": 0.40, "exponential": 0.30, "bayesian": 0.30}


def _seir_trajectory(params: dict) -> np.ndarray:
    """SEIR model — mechanistic backbone (40% weight)."""
    N = params.get("population", 10_000_000)
    gamma = 1.0 / (params.get("incubation_days", 3) * 2)
    sigma = 1.0 / params.get("incubation_days", 3)
    r0 = params.get("r0", 1.85)
    host = params.get("host_interface", 0.72)
    deforest = params.get("deforestation", 0.58)
    livestock = params.get("livestock_density", 0.81)
    lab = params.get("lab_capacity", 0.51)
    vax = params.get("vaccination_pct", 0.43)
    days = params.get("days", 30)

    r0_adj = r0 * (0.5 + host * 0.5) * (0.6 + deforest * 0.4) * (0.7 + livestock * 0.3)
    gamma_adj = gamma * (1 + lab * 0.3)
    beta = r0_adj * gamma_adj

    I = float(params.get("initial_cases", 1))
    E = float(I * 2)
    S = float(N - I - E)
    R = 0.0

    trajectory = np.zeros(days + 1)
    for d in range(days + 1):
        vax_eff = 1.0 - vax * 0.6 * min(1.0, d / 30.0)
        dS = -beta * S * vax_eff * I
        dE = beta * S * vax_eff * I - sigma * E
        dI = sigma * E - gamma_adj * I
        S = max(0.0, S + dS)
        E = max(0.0, E + dE)
        I = max(0.0, I + dI)
        R = max(0.0, R + gamma_adj * I)
        trajectory[d] = I
    return trajectory


def _exponential_trajectory(params: dict) -> np.ndarray:
    """Exponential growth — early doubling-time dynamics (30% weight)."""
    r0 = params.get("r0", 1.85)
    host = params.get("host_interface", 0.72)
    inc = params.get("incubation_days", 3)
    surv_gap = params.get("surveillance_gap", 0.49)
    vax = params.get("vaccination_pct", 0.43)
    pop = params.get("population", 10_000_000)
    days = params.get("days", 30)
    init = params.get("initial_cases", 1)

    r0_adj = r0 * (0.5 + host * 0.5)
    serial_interval = inc + (1.0 / (1.0 / (inc * 2)))
    r = (r0_adj - 1.0) / serial_interval
    surv_factor = 1.0 + surv_gap * 0.5

    trajectory = np.zeros(days + 1)
    for d in range(days + 1):
        vax_dampen = 1.0 - (vax * 0.4 * min(1.0, max(0, d - 14) / 16.0))
        growth = r * vax_dampen * surv_factor
        val = init * math.exp(growth * d)
        trajectory[d] = min(val, pop * 0.05)
    return trajectory


def _bayesian_trajectory(params: dict) -> np.ndarray:
    """Bayesian network — context-sensitive probability correction (30% weight)."""
    pathogen = params.get("pathogen", "HPAI H5N1")
    r0 = params.get("r0", 1.85)
    vax = params.get("vaccination_pct", 0.43)
    surv_gap = params.get("surveillance_gap", 0.49)
    lab = params.get("lab_capacity", 0.51)
    host = params.get("host_interface", 0.72)
    deforest = params.get("deforestation", 0.58)
    livestock = params.get("livestock_density", 0.81)
    pop = params.get("population", 10_000_000)
    days = params.get("days", 30)
    init = params.get("initial_cases", 1)

    p_base = {"HPAI H5N1": 0.25, "Ebola VD": 0.65, "Mpox Clade I": 0.55,
              "Rift Valley Fever": 0.40, "Cholera": 0.75}.get(pathogen, 0.45)

    factors = [
        1.0 - vax * 0.6,
        1.0 + surv_gap * 0.3,
        1.0 - lab * 0.25,
        1.0 + host * 0.4,
        1.0 + deforest * 0.2,
        1.0 + livestock * 0.15,
    ]
    p_post = p_base
    for f in factors:
        p_post = min(0.99, max(0.01, p_post * f))

    k_disp = 0.5
    trajectory = np.zeros(days + 1)
    for d in range(days + 1):
        if d == 0:
            trajectory[d] = float(init)
            continue
        mu = init * (1.0 + p_post * r0) ** (d * 0.5)
        vax_eff = 1.0 - vax * 0.5 * min(1.0, d / 30.0)
        trajectory[d] = min(mu * vax_eff, pop * 0.08)
    return trajectory


def compute_ensemble_forecast(params: dict) -> dict:
    """Full 3-model ensemble forecast."""
    seir_t = _seir_trajectory(params)
    exp_t = _exponential_trajectory(params)
    bayes_t = _bayesian_trajectory(params)
    days = params.get("days", 30)

    ensemble = (ENSEMBLE_WEIGHTS["seir"] * seir_t +
                ENSEMBLE_WEIGHTS["exponential"] * exp_t +
                ENSEMBLE_WEIGHTS["bayesian"] * bayes_t)

    stacked = np.stack([seir_t, exp_t, bayes_t])
    ci_lower = np.percentile(stacked, 10, axis=0)
    ci_upper = np.percentile(stacked, 90, axis=0)

    trajectory = []
    for d in range(days + 1):
        trajectory.append({
            "day": d,
            "ensemble": round(float(ensemble[d])),
            "seir": round(float(seir_t[d])),
            "exponential": round(float(exp_t[d])),
            "bayesian": round(float(bayes_t[d])),
            "ci_lower": round(float(ci_lower[d])),
            "ci_upper": round(float(ci_upper[d])),
            "hospitalised": round(float(ensemble[d]) * 0.12),
        })

    peak_day = int(np.argmax(ensemble))
    peak_val = round(float(ensemble[peak_day]))

    max_30 = float(np.max(ensemble[:min(31, len(ensemble))]))
    p_epidemic = min(0.98, max_30 / (max_30 + 50))
    p_cluster = min(0.95, max_30 / (max_30 + 100)) * 0.6

    doubling_time = None
    if len(exp_t) > 7 and exp_t[7] > exp_t[1] and exp_t[1] > 0:
        doubling_time = round(7 * math.log(2) / math.log(exp_t[7] / exp_t[1]), 1)

    cfr = params.get("cfr_pct", 5)
    total_cases = round(float(np.sum(ensemble[:min(31, len(ensemble))])))

    return {
        "trajectory": trajectory,
        "peak_day": peak_day,
        "peak_cases": peak_val,
        "doubling_time_days": doubling_time,
        "p_epidemic_30d": round(p_epidemic, 3),
        "p_cluster_30d": round(p_cluster, 3),
        "total_cases_30d": total_cases,
        "total_deaths_30d": round(total_cases * (cfr / 100)),
        "model_weights": ENSEMBLE_WEIGHTS,
        "models_used": ["SEIR", "ExponentialGrowth", "BayesianNetwork"],
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "model_day30": {
            "seir": round(float(seir_t[min(30, days)])),
            "exponential": round(float(exp_t[min(30, days)])),
            "bayesian": round(float(bayes_t[min(30, days)])),
        },
    }
