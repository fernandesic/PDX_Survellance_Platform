"""
test_reproduction.py
--------------------
Automated test that verifies the cross-border importation module reproduces
the report numbers exactly.

Run:
    python3 test_reproduction.py

Expected output:
    Uganda       E[imports]=1.60  P(>=1)=79.9%
    South Sudan  E[imports]=0.47  P(>=1)=37.5%
    Rwanda       E[imports]=0.03  P(>=1)=3.0%
    Burundi      E[imports]=0.00  P(>=1)=0.4%

    All tests passed.

Author: Isaias Fernandes Co
"""

import math
import sys
import os

# Ensure the onehealth package directory is importable
sys.path.insert(0, os.path.dirname(__file__))

from spillover_hazard import (
    ituri_corridor,
    HazardParams,
    run_all_countries,
    sensitivity_travel_while_infectious,
    daily_hazard,
    tier_from_p,
)


# Tolerance for floating-point comparisons against the report
EXPECTED_TOLERANCE = 0.01   # E[imports] tolerance
P_ANY_TOLERANCE    = 0.5    # percentage-point tolerance for P(>=1)


# The active-infectious median trajectory from the wbepi central scenario
# for the Ituri Bundibugyo outbreak. This is the actual series that drove
# the report numbers. Truncated to 84 days forward from today (day 42).
#
# Source: /home/claude/work/v2/central_active_I.npy, days 42-126
ACTIVE_I_FORWARD_84D = [
    20.00, 20.50, 21.00, 21.00, 21.00, 22.00, 22.00, 22.00, 22.00, 22.00,
    23.00, 23.00, 23.00, 23.00, 23.00, 23.00, 23.00, 23.00, 24.00, 24.00,
    23.50, 24.00, 24.00, 24.00, 24.00, 24.00, 24.00, 24.00, 24.00, 24.00,
    24.00, 24.00, 25.00, 25.00, 25.00, 25.00, 25.00, 24.50, 25.00, 25.00,
    25.00, 25.00, 25.00, 24.00, 25.00, 25.00, 26.00, 25.00, 26.00, 26.00,
    26.00, 26.00, 26.00, 26.00, 26.00, 26.00, 26.00, 27.00, 26.50, 27.00,
    27.00, 27.00, 28.00, 28.00, 27.50, 28.00, 28.00, 27.00, 27.00, 27.00,
    29.00, 28.00, 29.00, 28.00, 29.00, 28.00, 29.00, 28.50, 28.00, 28.00,
    28.00, 28.50, 29.00, 29.00
]
assert len(ACTIVE_I_FORWARD_84D) == 84, \
    f"Expected 84 days, got {len(ACTIVE_I_FORWARD_84D)}"


EXPECTED_RESULTS = {
    "Uganda":      {"E": 1.60, "P": 79.9},
    "South Sudan": {"E": 0.47, "P": 37.5},
    "Rwanda":      {"E": 0.03, "P":  3.0},
    "Burundi":     {"E": 0.00, "P":  0.4},
}


# ---------------------------------------------------------------------------
# Test 1 — Reproducibility against report numbers
# ---------------------------------------------------------------------------
def test_reproduction():
    print("\n[TEST 1] Reproducing report numbers (Ituri Bundibugyo, central scenario)")
    print("-" * 76)

    countries = ituri_corridor()
    params = HazardParams(
        travel_while_infectious=0.15,
        detection_at_poe=0.20,
        source_catchment_population=250_000,
        horizon_days=84,
    )
    results = run_all_countries(countries, ACTIVE_I_FORWARD_84D, params)

    all_pass = True
    for r in results:
        exp = EXPECTED_RESULTS[r.name]
        e_diff = abs(r.expected_imports - exp["E"])
        p_diff = abs(r.p_any_import * 100 - exp["P"])
        ok = e_diff < EXPECTED_TOLERANCE and p_diff < P_ANY_TOLERANCE
        flag = "OK " if ok else "FAIL"
        print(f"  [{flag}] {r.name:13s}  E={r.expected_imports:.2f} "
              f"(report {exp['E']:.2f}, diff {e_diff:.3f}) "
              f"P={r.p_any_import*100:.1f}% "
              f"(report {exp['P']:.1f}%, diff {p_diff:.2f}pp)")
        if not ok:
            all_pass = False
    return all_pass


# ---------------------------------------------------------------------------
# Test 2 — Tier classification
# ---------------------------------------------------------------------------
def test_tiers():
    print("\n[TEST 2] Tier classification thresholds")
    print("-" * 76)
    cases = [
        (0.85, "HIGH"),
        (0.55, "HIGH-MODERATE"),
        (0.25, "MODERATE"),
        (0.05, "LOW"),
        (0.01, "VERY LOW"),
    ]
    all_pass = True
    for p, expected in cases:
        actual = tier_from_p(p)
        ok = actual == expected
        flag = "OK " if ok else "FAIL"
        print(f"  [{flag}] P={p:.2f}  expected={expected:15s}  actual={actual}")
        if not ok:
            all_pass = False
    return all_pass


# ---------------------------------------------------------------------------
# Test 3 — Daily hazard zero cases
# ---------------------------------------------------------------------------
def test_zero_cases():
    print("\n[TEST 3] Daily hazard with zero active-I should return zero")
    print("-" * 76)
    countries = ituri_corridor()
    params = HazardParams()
    all_pass = True
    for c in countries:
        h = daily_hazard(c, active_I=0.0, params=params)
        ok = h == 0.0
        flag = "OK " if ok else "FAIL"
        print(f"  [{flag}] {c.name:13s}  hazard={h}")
        if not ok:
            all_pass = False
    return all_pass


# ---------------------------------------------------------------------------
# Test 4 — Sensitivity sweep monotone in twi
# ---------------------------------------------------------------------------
def test_sensitivity_monotone():
    print("\n[TEST 4] Sensitivity sweep — expected imports monotone increasing in twi")
    print("-" * 76)
    countries = ituri_corridor()
    params = HazardParams(horizon_days=84)
    sweep = sensitivity_travel_while_infectious(
        countries, ACTIVE_I_FORWARD_84D, params,
        twi_values=[0.05, 0.10, 0.15, 0.25, 0.40],
    )
    all_pass = True
    for name, by_twi in sweep.items():
        twis = sorted(by_twi.keys())
        values = [by_twi[t] for t in twis]
        monotone = all(values[i] <= values[i+1] + 1e-9 for i in range(len(values)-1))
        flag = "OK " if monotone else "FAIL"
        print(f"  [{flag}] {name:13s}  values: {[f'{v:.2f}' for v in values]}")
        if not monotone:
            all_pass = False
    return all_pass


# ---------------------------------------------------------------------------
# Test 5 — P(>=1) and E[imports] consistency  P = 1 - exp(-Lambda)
# ---------------------------------------------------------------------------
def test_p_E_consistency():
    print("\n[TEST 5] P(>=1) = 1 - exp(-E[imports]) — internal consistency")
    print("-" * 76)
    countries = ituri_corridor()
    params = HazardParams(horizon_days=84)
    results = run_all_countries(countries, ACTIVE_I_FORWARD_84D, params)
    all_pass = True
    for r in results:
        expected_p = 1.0 - math.exp(-r.expected_imports)
        diff = abs(expected_p - r.p_any_import)
        ok = diff < 1e-9
        flag = "OK " if ok else "FAIL"
        print(f"  [{flag}] {r.name:13s}  P_reported={r.p_any_import:.6f}  "
              f"P_recomputed={expected_p:.6f}  diff={diff:.2e}")
        if not ok:
            all_pass = False
    return all_pass


# ---------------------------------------------------------------------------
# Test 6 — Validation rejects bad inputs
# ---------------------------------------------------------------------------
def test_validation():
    print("\n[TEST 6] Validation rejects bad inputs")
    print("-" * 76)
    from spillover_hazard import CountryConfig

    bad_cases = [
        ("catchment_share > 1", lambda: CountryConfig(
            name="X", iso3="XXX", daily_crossings=100, catchment_share=1.5).validate()),
        ("catchment_share < 0", lambda: CountryConfig(
            name="X", iso3="XXX", daily_crossings=100, catchment_share=-0.1).validate()),
        ("border_open > 1", lambda: CountryConfig(
            name="X", iso3="XXX", daily_crossings=100, catchment_share=0.3, border_open=1.2).validate()),
        ("negative crossings", lambda: CountryConfig(
            name="X", iso3="XXX", daily_crossings=-10, catchment_share=0.3).validate()),
        ("twi > 1", lambda: HazardParams(travel_while_infectious=1.5).validate()),
        ("horizon <= 0", lambda: HazardParams(horizon_days=0).validate()),
    ]
    all_pass = True
    for desc, fn in bad_cases:
        try:
            fn()
            print(f"  [FAIL] {desc:30s}  did not raise")
            all_pass = False
        except ValueError:
            print(f"  [OK ] {desc:30s}  correctly raised ValueError")
    return all_pass


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    print("=" * 76)
    print("Cross-border importation hazard — reproduction test suite")
    print("=" * 76)

    tests = [
        ("Reproduction of report numbers",     test_reproduction),
        ("Tier classification",                test_tiers),
        ("Zero cases yield zero hazard",       test_zero_cases),
        ("Sensitivity sweep monotone in twi",  test_sensitivity_monotone),
        ("P(>=1) and E[imports] consistency",  test_p_E_consistency),
        ("Validation rejects bad inputs",      test_validation),
    ]
    results = [(name, fn()) for name, fn in tests]

    print("\n" + "=" * 76)
    print("SUMMARY")
    print("=" * 76)
    for name, ok in results:
        flag = "PASS" if ok else "FAIL"
        print(f"  [{flag}] {name}")

    all_passed = all(ok for _, ok in results)
    print()
    if all_passed:
        print("All tests passed.")
        sys.exit(0)
    else:
        print("Some tests FAILED.")
        sys.exit(1)


if __name__ == "__main__":
    main()
