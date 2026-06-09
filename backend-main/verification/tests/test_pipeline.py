"""
Integration tests — the full CAPTURE → MATCH → SCORE → FEEDBACK pipeline.

These require the database (pytest-django). They build snapshots and outcomes
directly, run each stage, and assert on the verdicts/metrics/tickets produced.

Run:  pytest verification/tests/test_pipeline.py -v
"""

from datetime import timedelta

import pytest
from django.utils import timezone

from verification.models import (
    PredictionSnapshot, OutcomeEvent, MatchVerdict, ScoreCard,
    VeracityIndex, ReviewTicket, CalibrationRecord,
)
from verification.services import matching, scoring, feedback


# ─── helpers ───────────────────────────────────────────────────────

def _snap(**kw):
    now = timezone.now()
    defaults = dict(
        source_module="predictions",
        prediction_class="risk_level",
        country_iso="COD",
        disease_name="ebola",
        predicted_label="CRITICAL",
        window_start=now - timedelta(days=40),
        window_end=now - timedelta(days=10),   # closed
        model_version="test-v1",
        computed_at=now - timedelta(days=40),
        raw_payload={"k": "v"},
    )
    defaults.update(kw)
    return PredictionSnapshot.objects.create(**defaults)


def _outcome(**kw):
    now = timezone.now()
    defaults = dict(
        outcome_type="outbreak_confirmed",
        source_feed="who_don",
        country_iso="COD",
        disease_name="ebola",
        occurred_at=now - timedelta(days=20),
        raw_payload={"o": 1},
    )
    defaults.update(kw)
    return OutcomeEvent.objects.create(**defaults)


# ─── CAPTURE: fingerprint + provenance ─────────────────────────────

@pytest.mark.django_db
def test_fingerprint_is_deterministic_and_set_on_save():
    s = _snap(raw_payload={"b": 2, "a": 1})
    assert len(s.payload_fingerprint) == 64
    # same payload, different key order → same fingerprint
    assert (PredictionSnapshot.compute_fingerprint({"a": 1, "b": 2})
            == PredictionSnapshot.compute_fingerprint({"b": 2, "a": 1}))


@pytest.mark.django_db
def test_missing_provenance_flags_incomplete():
    s = _snap(model_version="", computed_at=None)
    assert s.payload_complete is False
    assert s.is_scorable is False


@pytest.mark.django_db
def test_counterfactual_not_scorable():
    s = _snap(is_counterfactual=True)
    assert s.is_scorable is False


# ─── MATCH: verdict logic per class ────────────────────────────────

@pytest.mark.django_db
def test_risk_level_hit_when_outbreak_occurs():
    s = _snap(prediction_class="risk_level", predicted_label="CRITICAL")
    _outcome(outcome_type="outbreak_confirmed")
    v = matching.match_snapshot(s)
    assert v.verdict == MatchVerdict.VERDICT_HIT


@pytest.mark.django_db
def test_risk_level_false_alarm_when_nothing_happens():
    s = _snap(prediction_class="risk_level", predicted_label="CRITICAL")
    v = matching.match_snapshot(s)
    assert v.verdict == MatchVerdict.VERDICT_FALSE_ALARM


@pytest.mark.django_db
def test_counterfactual_excluded():
    s = _snap(is_counterfactual=True)
    v = matching.match_snapshot(s)
    assert v.verdict == MatchVerdict.VERDICT_EXCLUDED


@pytest.mark.django_db
def test_incomplete_excluded():
    s = _snap(model_version="", computed_at=None)
    v = matching.match_snapshot(s)
    assert v.verdict == MatchVerdict.VERDICT_EXCLUDED


@pytest.mark.django_db
def test_open_window_is_pending():
    now = timezone.now()
    s = _snap(window_end=now + timedelta(days=5))
    v = matching.match_snapshot(s)
    assert v.verdict == MatchVerdict.VERDICT_PENDING


@pytest.mark.django_db
def test_case_count_within_band_is_hit():
    s = _snap(prediction_class="case_count", predicted_value=100.0, disease_name="cholera")
    _outcome(outcome_type="case_observation", disease_name="cholera", observed_cases=110)
    v = matching.match_snapshot(s)
    assert v.verdict == MatchVerdict.VERDICT_HIT       # 10% error ≤ 25%
    assert v.abs_error == 10.0


@pytest.mark.django_db
def test_case_count_partial_band():
    s = _snap(prediction_class="case_count", predicted_value=100.0, disease_name="cholera")
    _outcome(outcome_type="case_observation", disease_name="cholera", observed_cases=140)
    v = matching.match_snapshot(s)
    assert v.verdict == MatchVerdict.VERDICT_PARTIAL   # 40% error in (25%,50%]


@pytest.mark.django_db
def test_probability_brier_recorded():
    s = _snap(prediction_class="spillover_probability", predicted_probability=0.8,
              disease_name="ebola")
    _outcome(outcome_type="first_human_case", disease_name="ebola")
    v = matching.match_snapshot(s)
    assert v.verdict == MatchVerdict.VERDICT_HIT
    assert abs(v.brier_component - (0.8 - 1.0) ** 2) < 1e-9


@pytest.mark.django_db
def test_intervention_tier_off_by_one_partial():
    s = _snap(prediction_class="intervention_tier", predicted_label="STOCK_ORS",
              disease_name="cholera")
    _outcome(outcome_type="intervention_action", source_feed="decision_log",
             disease_name="cholera", observed_label="MASS_CHLORINATION")
    v = matching.match_snapshot(s)
    assert v.verdict == MatchVerdict.VERDICT_PARTIAL


@pytest.mark.django_db
def test_ebola_lead_time_recorded_vs_pheic():
    # computed_at after PHEIC → positive lead; before → negative (early).
    early = matching.PHEIC_DECLARATION - timedelta(days=12)
    s = _snap(prediction_class="imminent_class", disease_name="ebola",
              computed_at=early, window_start=early,
              window_end=timezone.now() - timedelta(days=1))
    _outcome(outcome_type="pheic_declared", source_feed="who_don", disease_name="ebola")
    v = matching.match_snapshot(s)
    assert v.verdict == MatchVerdict.VERDICT_HIT
    assert v.lead_time_days is not None
    assert v.lead_time_days < 0          # signal was ahead of the declaration


# ─── stale resolution ──────────────────────────────────────────────

@pytest.mark.django_db
def test_resolve_stale_pending_forces_verdict():
    now = timezone.now()
    s = _snap(prediction_class="risk_level", predicted_label="CRITICAL",
              window_end=now - timedelta(days=30))
    # Manually leave it pending
    MatchVerdict.objects.create(snapshot=s, verdict=MatchVerdict.VERDICT_PENDING)
    out = matching.resolve_stale_pending(grace_days=7, now=now)
    s.verdict.refresh_from_db()
    assert out["resolved"] == 1
    assert s.verdict.verdict != MatchVerdict.VERDICT_PENDING


# ─── SCORE ──────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_scorecards_and_veracity_generated():
    # two hits, one false alarm
    for _ in range(2):
        s = _snap()
        _outcome()
        matching.match_snapshot(s)
    s_fa = _snap(country_iso="UGA")
    matching.match_snapshot(s_fa)   # no outcome in UGA → false alarm

    n_cards = scoring.generate_scorecards()
    assert n_cards > 0
    assert ScoreCard.objects.filter(granularity="global").exists()

    indices = scoring.compute_veracity_indices()
    assert any(vi.level == VeracityIndex.LEVEL_PLATFORM for vi in indices)
    platform = VeracityIndex.objects.filter(level=VeracityIndex.LEVEL_PLATFORM).first()
    assert 0 <= platform.index_value <= 100


# ─── FEEDBACK ───────────────────────────────────────────────────────

@pytest.mark.django_db
def test_tickets_open_for_false_alarm(monkeypatch):
    # don't actually send notifications
    monkeypatch.setattr("verification.services.notifications.notify_ticket",
                        lambda t: {"email": False, "telegram": False})
    s = _snap(country_iso="UGA")
    matching.match_snapshot(s)   # false alarm
    created = feedback.open_review_tickets()
    assert len(created) == 1
    assert created[0].reason == ReviewTicket.REASON_FALSE_ALARM
    # idempotent: second run opens nothing new
    assert feedback.open_review_tickets() == []


@pytest.mark.django_db
def test_calibration_multiplier_clamped(monkeypatch):
    # Build 25 overconfident probability verdicts (stated high, outcome 0)
    now = timezone.now()
    for i in range(25):
        s = _snap(prediction_class="spillover_probability",
                  predicted_probability=0.9, disease_name="ebola",
                  raw_payload={"i": i})
        MatchVerdict.objects.create(
            snapshot=s, verdict=MatchVerdict.VERDICT_FALSE_ALARM,
            match_detail={"p": 0.9, "outcome": 0.0},
        )
    recs = feedback.compute_calibration(min_samples=20)
    assert len(recs) == 1
    r = recs[0]
    assert 0.5 <= r.suggested_multiplier <= 1.5
    assert r.suggested_multiplier < 1.0     # overconfident → scale down


@pytest.mark.django_db
def test_full_pipeline_end_to_end(monkeypatch):
    monkeypatch.setattr("verification.services.notifications.notify_ticket",
                        lambda t: {"email": False, "telegram": False})
    # one hit, one false alarm
    s_hit = _snap()
    _outcome()
    s_fa = _snap(country_iso="UGA")

    matching.match_due_snapshots()
    scoring.generate_scorecards()
    scoring.compute_veracity_indices()
    tickets = feedback.open_review_tickets()

    assert MatchVerdict.objects.filter(verdict=MatchVerdict.VERDICT_HIT).count() == 1
    assert MatchVerdict.objects.filter(verdict=MatchVerdict.VERDICT_FALSE_ALARM).count() == 1
    assert VeracityIndex.objects.exists()
    assert len(tickets) == 1
