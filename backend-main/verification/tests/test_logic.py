"""
Pure-logic unit tests — scoring & matching math.

These cover the parts that are pure Python (no database, no Django models), so
they run fast and anywhere. Reference values were computed independently.

Run:  pytest verification/tests/test_logic.py -v
"""

import math
import pytest


# ─── WIS (Weighted Interval Score) ─────────────────────────────────

def _wis():
    from verification.services.matching import _weighted_interval_score
    return _weighted_interval_score


def test_wis_centered_observation_is_small():
    q = {"0.025": 8.0, "0.25": 9.0, "0.5": 10.0, "0.75": 11.0, "0.975": 12.0}
    assert round(_wis()(q, 10), 2) == 0.24


def test_wis_far_observation_is_penalised():
    q = {"0.025": 8.0, "0.25": 9.0, "0.5": 10.0, "0.75": 11.0, "0.975": 12.0}
    assert round(_wis()(q, 20), 2) == 9.04


def test_wis_median_only_perfect():
    assert _wis()({"0.5": 10.0}, 10) == 0.0


def test_wis_empty_is_inf():
    assert _wis()({}, 5) == float("inf")


def test_wis_monotonic_in_distance():
    q = {"0.25": 9.0, "0.5": 10.0, "0.75": 11.0}
    near = _wis()(q, 10)
    far = _wis()(q, 15)
    assert far > near


# ─── safe division & metrics helpers ───────────────────────────────

def test_safe_div():
    from verification.services.scoring import _safe_div
    assert _safe_div(3, 4) == 0.75
    assert _safe_div(1, 0) is None
    assert _safe_div(0, 5) == 0.0


# ─── Veracity contribution ─────────────────────────────────────────

def test_veracity_perfect_is_100():
    from verification.services.scoring import _veracity_contribution
    assert _veracity_contribution(1.0, 1.0, 0.0, 0.0, None) == 100.0


def test_veracity_hit_rate_only():
    from verification.services.scoring import _veracity_contribution
    assert _veracity_contribution(0.5, None, None, None, None) == 50.0


def test_veracity_early_lead_bonus():
    from verification.services.scoring import _veracity_contribution
    base = _veracity_contribution(0.5, None, None, None, None)
    bonus = _veracity_contribution(0.5, None, None, None, -10)
    assert bonus > base
    assert bonus == 55.0


def test_veracity_none_when_no_metrics():
    from verification.services.scoring import _veracity_contribution
    assert _veracity_contribution(None, None, None, None, None) is None


# ─── Reliability binning ───────────────────────────────────────────

class _FakeSnap:
    def __init__(self, pc):
        self.prediction_class = pc


class _FakeVerdict:
    def __init__(self, p, outcome, pc="climate_confidence"):
        self.match_detail = {"p": p, "outcome": outcome}
        self.snapshot = _FakeSnap(pc)


def test_reliability_bins():
    from verification.services.scoring import _reliability_bins
    bins = _reliability_bins([
        _FakeVerdict(0.95, 1), _FakeVerdict(0.92, 1), _FakeVerdict(0.91, 0),
    ])
    assert len(bins) == 1
    b = bins[0]
    assert b["prob_bin"] == "0.9-1.0"
    assert b["n"] == 3
    assert round(b["observed"], 4) == 0.6667


# ─── Weighted Cohen κ ──────────────────────────────────────────────

def test_weighted_kappa_perfect():
    from verification.services.scoring import _weighted_cohen_kappa
    v = [
        _FakeVerdict_tier("MONITOR", "MONITOR"),
        _FakeVerdict_tier("DEPLOY_CTC", "DEPLOY_CTC"),
        _FakeVerdict_tier("STOCK_ORS", "STOCK_ORS"),
    ]
    assert _weighted_cohen_kappa(v) == 1.0


def test_weighted_kappa_too_few():
    from verification.services.scoring import _weighted_cohen_kappa
    assert _weighted_cohen_kappa([_FakeVerdict_tier("MONITOR", "MONITOR")]) is None


def _FakeVerdict_tier(pred, obs):
    v = _FakeVerdict(None, None, pc="intervention_tier")
    v.match_detail = {"predicted_tier": pred, "observed_tier": obs}
    return v


# ─── compute_metrics aggregate ─────────────────────────────────────

class _Snap:
    def __init__(self, pc="risk_level"):
        self.prediction_class = pc
        self.captured_at = None


class _Verd:
    def __init__(self, verdict, brier=None, wis=None, lead=None, pc="risk_level"):
        self.verdict = verdict
        self.brier_component = brier
        self.wis_component = wis
        self.lead_time_days = lead
        self.match_detail = {}
        self.snapshot = _Snap(pc)


def test_compute_metrics_counts_and_rates():
    from verification.services.scoring import compute_metrics
    from verification.models import MatchVerdict as MV
    verds = [
        _Verd(MV.VERDICT_HIT), _Verd(MV.VERDICT_HIT),
        _Verd(MV.VERDICT_MISS), _Verd(MV.VERDICT_FALSE_ALARM),
        _Verd(MV.VERDICT_PENDING), _Verd(MV.VERDICT_EXCLUDED),
    ]
    m = compute_metrics(verds)
    assert m["n_total"] == 6
    assert m["n_hit"] == 2
    assert m["n_miss"] == 1
    assert m["n_false_alarm"] == 1
    assert m["n_pending"] == 1
    assert m["n_excluded"] == 1
    # scorable = HIT,HIT,MISS,FA = 4; effective hits = 2
    assert m["hit_rate"] == 0.5
    # precision = tp/(tp+fp) = 2/(2+1)
    assert round(m["precision"], 4) == round(2 / 3, 4)


def test_compute_metrics_partial_counts_half():
    from verification.services.scoring import compute_metrics
    from verification.models import MatchVerdict as MV
    m = compute_metrics([_Verd(MV.VERDICT_PARTIAL), _Verd(MV.VERDICT_MISS)])
    # effective hits = 0.5 over 2 scorable
    assert m["hit_rate"] == 0.25
