"""
spillover_hazard.py
-------------------
Cross-border importation hazard model for the OneHealth Spillover Simulation Engine.

This is the model that produced the Ituri Bundibugyo spillover numbers in the
PDX reports (Uganda 79.9%, South Sudan 37.5%, Rwanda 3.0%, Burundi 0.4%).

Design principles
-----------------
1. Transparent. Every output number can be traced back to a small number of
   named inputs. No hidden constants. No magic.
2. Composable. The hazard function for a single country on a single day is
   pure; the cumulative versions are simple folds over it.
3. Defensible. Stochastic uncertainty is NOT mixed with parameter uncertainty.
   Sensitivity analysis is a first-class operation, not an afterthought.

Mathematical model
------------------
For each neighbouring country i and each day t in the projection horizon:

    lambda_i(t)  =  M_i  *  c_i  *  o_i
                  * ( I(t) * p_inf / N )
                  * ( 1 - d )

where:
    M_i  : daily cross-border crossings, Ituri-relevant share
    c_i  : catchment share (fraction of crossings touching affected zones)
    o_i  : border-open factor (1.0 = fully open, < 1.0 if conflict-restricted)
    I(t) : active-infectious prevalence in source catchment on day t
    p_inf: probability an infectious person travels (travel-while-infectious)
    N    : source catchment population
    d    : detection-at-Points-of-Entry fraction

Then over the projection horizon T:

    Lambda_i      = sum over t in [today, today+T] of lambda_i(t)
    E[imports]_i  = Lambda_i
    P(>=1)_i      = 1 - exp(-Lambda_i)

Author : Isaias Fernandes Co, ML Specialist, WHO AFRO HEP
"""

from __future__ import annotations

from dataclasses import dataclass, field, asdict
from typing import Dict, List, Optional, Sequence, Tuple

import math


# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------
@dataclass(frozen=True)
class CountryConfig:
    """Per-country inputs to the importation hazard."""

    name: str
    iso3: str
    daily_crossings: float          # M_i — total Ituri-relevant daily crossings
    catchment_share: float          # c_i — in [0, 1]
    border_open: float = 1.0        # o_i — in [0, 1]; 1.0 = fully open
    direct_border: bool = True      # whether the country shares a direct land
                                    # border with the affected sub-zones
    ghs_index: Optional[float] = None        # 0-100, context only
    readiness_composite: Optional[float] = None  # 0-1, context only
    note: str = ""

    def validate(self) -> None:
        if not (0.0 <= self.catchment_share <= 1.0):
            raise ValueError(f"{self.name}: catchment_share must be in [0,1]")
        if not (0.0 <= self.border_open <= 1.0):
            raise ValueError(f"{self.name}: border_open must be in [0,1]")
        if self.daily_crossings < 0:
            raise ValueError(f"{self.name}: daily_crossings must be non-negative")


@dataclass
class HazardParams:
    """Global parameters that apply to all countries in a run."""

    travel_while_infectious: float = 0.15   # p_inf — baseline 15%
    detection_at_poe: float = 0.20          # d — baseline 20%
    source_catchment_population: int = 250_000  # N
    horizon_days: int = 84                  # 12 weeks forward

    def validate(self) -> None:
        if not (0.0 <= self.travel_while_infectious <= 1.0):
            raise ValueError("travel_while_infectious must be in [0,1]")
        if not (0.0 <= self.detection_at_poe <= 1.0):
            raise ValueError("detection_at_poe must be in [0,1]")
        if self.source_catchment_population <= 0:
            raise ValueError("source_catchment_population must be positive")
        if self.horizon_days <= 0:
            raise ValueError("horizon_days must be positive")


@dataclass
class CountryOutput:
    """Per-country result for a single run."""

    name: str
    iso3: str
    expected_imports: float           # E[imports] over the horizon
    p_any_import: float               # P(>=1 import) over the horizon
    tier: str                         # HIGH / HIGH-MODERATE / MODERATE / LOW / VERY LOW
    daily_lambda: List[float]         # daily hazard rate over horizon
    cumulative_lambda: List[float]    # running sum of daily_lambda

    # Per-horizon snapshots (4w, 8w, 12w) — used by the UI
    expected_imports_w4: float = 0.0
    expected_imports_w8: float = 0.0
    expected_imports_w12: float = 0.0
    p_any_w4: float = 0.0
    p_any_w8: float = 0.0
    p_any_w12: float = 0.0

    def to_dict(self) -> dict:
        return asdict(self)


# ---------------------------------------------------------------------------
# Core model
# ---------------------------------------------------------------------------
def daily_hazard(country: CountryConfig,
                 active_I: float,
                 params: HazardParams) -> float:
    """
    Compute lambda_i(t) for one country on one day.

    This is the building block of everything else in this module. It is a
    pure function — no state, no side effects, no globals.
    """
    traveller_pool = (
        country.daily_crossings
        * country.catchment_share
        * country.border_open
    )

    if traveller_pool <= 0 or active_I <= 0:
        return 0.0

    p_traveller_is_infectious = (
        active_I * params.travel_while_infectious
        / params.source_catchment_population
    )

    expected_infectious_arrivals = traveller_pool * p_traveller_is_infectious
    expected_undetected = expected_infectious_arrivals * (1.0 - params.detection_at_poe)
    return float(expected_undetected)


def country_run(country: CountryConfig,
                active_I_series: Sequence[float],
                params: HazardParams) -> CountryOutput:
    """
    Run the importation hazard model for one country over the horizon.
    """
    country.validate()
    params.validate()

    horizon = min(params.horizon_days, len(active_I_series))
    daily = [daily_hazard(country, float(active_I_series[t]), params)
             for t in range(horizon)]
    cum = []
    running = 0.0
    for v in daily:
        running += v
        cum.append(running)

    # snapshots at 4, 8, 12 weeks (or as close as the horizon allows)
    def snap(week: int) -> Tuple[float, float]:
        idx = min(week * 7 - 1, horizon - 1)
        if idx < 0:
            return 0.0, 0.0
        cumL = cum[idx]
        return cumL, 1.0 - math.exp(-cumL)

    ei_w4, p_w4 = snap(4)
    ei_w8, p_w8 = snap(8)
    ei_w12, p_w12 = snap(12)

    total_L = cum[-1] if cum else 0.0
    p_any = 1.0 - math.exp(-total_L)

    return CountryOutput(
        name=country.name,
        iso3=country.iso3,
        expected_imports=total_L,
        p_any_import=p_any,
        tier=tier_from_p(p_any),
        daily_lambda=daily,
        cumulative_lambda=cum,
        expected_imports_w4=ei_w4,
        expected_imports_w8=ei_w8,
        expected_imports_w12=ei_w12,
        p_any_w4=p_w4,
        p_any_w8=p_w8,
        p_any_w12=p_w12,
    )


def tier_from_p(p_any: float) -> str:
    """Convert P(>=1) into a five-tier risk label."""
    if p_any >= 0.70:
        return "HIGH"
    if p_any >= 0.35:
        return "HIGH-MODERATE"
    if p_any >= 0.15:
        return "MODERATE"
    if p_any >= 0.02:
        return "LOW"
    return "VERY LOW"


# ---------------------------------------------------------------------------
# Multi-country run
# ---------------------------------------------------------------------------
def run_all_countries(countries: Sequence[CountryConfig],
                      active_I_series: Sequence[float],
                      params: HazardParams) -> List[CountryOutput]:
    """
    Run the importation hazard model for a set of neighbouring countries.

    Parameters
    ----------
    countries : ordered list of CountryConfig (one per neighbouring country)
    active_I_series : daily active-infectious prevalence in the source catchment,
                      length >= params.horizon_days. Usually the median trajectory
                      from the wbepi central scenario for a confirmed outbreak.
    params : global HazardParams
    """
    if len(active_I_series) < params.horizon_days:
        raise ValueError(
            f"active_I_series length {len(active_I_series)} is shorter than "
            f"horizon_days {params.horizon_days}"
        )
    return [country_run(c, active_I_series, params) for c in countries]


# ---------------------------------------------------------------------------
# Sensitivity sweep
# ---------------------------------------------------------------------------
def sensitivity_travel_while_infectious(
        countries: Sequence[CountryConfig],
        active_I_series: Sequence[float],
        params: HazardParams,
        twi_values: Sequence[float] = (0.05, 0.10, 0.15, 0.25, 0.40),
) -> Dict[str, Dict[float, float]]:
    """
    Sweep the travel-while-infectious probability across a set of plausible
    values and return the expected imports at horizon for each country.

    Returns a dict: country_name -> {twi: expected_imports_at_horizon}.
    """
    out: Dict[str, Dict[float, float]] = {c.name: {} for c in countries}
    for twi in twi_values:
        swept_params = HazardParams(
            travel_while_infectious=float(twi),
            detection_at_poe=params.detection_at_poe,
            source_catchment_population=params.source_catchment_population,
            horizon_days=params.horizon_days,
        )
        runs = run_all_countries(countries, active_I_series, swept_params)
        for r in runs:
            out[r.name][float(twi)] = r.expected_imports
    return out


# ---------------------------------------------------------------------------
# Country corridor presets
# ---------------------------------------------------------------------------
def ituri_corridor() -> List[CountryConfig]:
    """
    Pre-tuned country configurations for an Ituri-source outbreak.
    These are the inputs that produced the report numbers.
    """
    return [
        CountryConfig(
            name="Uganda",
            iso3="UGA",
            daily_crossings=4500,
            catchment_share=0.35,
            border_open=1.0,
            direct_border=True,
            ghs_index=49.6,
            readiness_composite=0.62,
            note=("Direct Mahagi-Goli-Paidha border. Strong national EVD "
                  "response history; PoE screening at 22 sites. Vulnerability "
                  "concentrates in West Nile border districts (Zombo, Nebbi, Arua)."),
        ),
        CountryConfig(
            name="South Sudan",
            iso3="SSD",
            daily_crossings=1200,
            catchment_share=0.55,
            border_open=0.7,
            direct_border=True,
            ghs_index=28.6,
            readiness_composite=0.28,
            note=("Direct Aru-Mahagi border with Yei River and Morobo counties. "
                  "Lowest readiness of any neighbour; severe IPC and coordination "
                  "gaps in border facilities; active refugee bidirectional flow."),
        ),
        CountryConfig(
            name="Rwanda",
            iso3="RWA",
            daily_crossings=600,
            catchment_share=0.05,
            border_open=1.0,
            direct_border=False,
            ghs_index=44.1,
            readiness_composite=0.75,
            note=("No direct Ituri border. Pathway is indirect (Ituri -> "
                  "North Kivu -> Goma -> Rusizi/Cyanika). High national readiness."),
        ),
        CountryConfig(
            name="Burundi",
            iso3="BDI",
            daily_crossings=200,
            catchment_share=0.02,
            border_open=1.0,
            direct_border=False,
            ghs_index=33.5,
            readiness_composite=0.48,
            note=("No direct Ituri border. Pathway only via North/South Kivu transit. "
                  "Lowest crossing volume; importation probability lowest of the four."),
        ),
    ]


def north_kivu_goma_corridor() -> List[CountryConfig]:
    """Cross-border corridor for a North Kivu / Goma source outbreak."""
    return [
        CountryConfig(name="Uganda",   iso3="UGA", daily_crossings=2500, catchment_share=0.25, border_open=1.0, direct_border=True,  ghs_index=49.6, readiness_composite=0.62),
        CountryConfig(name="Rwanda",   iso3="RWA", daily_crossings=8000, catchment_share=0.65, border_open=1.0, direct_border=True,  ghs_index=44.1, readiness_composite=0.75),
        CountryConfig(name="Burundi",  iso3="BDI", daily_crossings=1500, catchment_share=0.15, border_open=1.0, direct_border=False, ghs_index=33.5, readiness_composite=0.48),
        CountryConfig(name="Tanzania", iso3="TZA", daily_crossings=2000, catchment_share=0.10, border_open=1.0, direct_border=True,  ghs_index=39.1, readiness_composite=0.55),
    ]


def equateur_corridor() -> List[CountryConfig]:
    """Cross-border corridor for an Equateur / Mbandaka source outbreak."""
    return [
        CountryConfig(name="Republic of the Congo",       iso3="COG", daily_crossings=800, catchment_share=0.40, border_open=1.0, direct_border=True, ghs_index=27.8, readiness_composite=0.32),
        CountryConfig(name="Central African Republic",   iso3="CAF", daily_crossings=400, catchment_share=0.25, border_open=0.6, direct_border=True, ghs_index=23.6, readiness_composite=0.20),
    ]


CORRIDOR_PRESETS = {
    "ituri":           ituri_corridor,
    "north-kivu-goma": north_kivu_goma_corridor,
    "equateur":        equateur_corridor,
}


def get_corridor(name: str) -> List[CountryConfig]:
    """Look up a corridor preset by name."""
    key = name.lower().strip()
    if key not in CORRIDOR_PRESETS:
        raise ValueError(
            f"Unknown corridor preset {name!r}. Available: {list(CORRIDOR_PRESETS)}"
        )
    return CORRIDOR_PRESETS[key]()


# ---------------------------------------------------------------------------
# Module quick-self-test (only runs if invoked directly)
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    # Use a hand-crafted active-I trajectory roughly matching the wbepi
    # central scenario for the Ituri Bundibugyo outbreak.
    # Active-I rises from a few to ~30 over 84 days; this is the median.
    horizon = 84
    seed_I = 4.0
    growth = 1.025
    active_I = [seed_I * (growth ** t) for t in range(horizon)]
    # Cap at a realistic ceiling for the central scenario
    active_I = [min(v, 35.0) for v in active_I]

    countries = ituri_corridor()
    params = HazardParams(
        travel_while_infectious=0.15,
        detection_at_poe=0.20,
        source_catchment_population=250_000,
        horizon_days=horizon,
    )
    results = run_all_countries(countries, active_I, params)

    print("Ituri corridor — cross-border importation, 12 weeks forward")
    print("-" * 64)
    for r in results:
        print(f"  {r.name:13s}  E[imports]={r.expected_imports:5.2f}  "
              f"P(>=1)={r.p_any_import*100:5.1f}%  tier={r.tier}")
