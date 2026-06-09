"""
Tests for alerts/incidents capture, official-outcome derivation, and the
notification wiring (channels mocked — no real Telegram/email).

Run:  pytest verification/tests/test_alerts_and_notify.py -v
"""

from datetime import timedelta
from unittest.mock import MagicMock

import pytest
from django.utils import timezone

from verification.models import (
    PredictionSnapshot, OutcomeEvent, MatchVerdict, ReviewTicket,
)


# ─── Notifications (no DB needed for compose; mocked sends) ─────────

def test_compose_includes_key_fields():
    from verification.services import notifications
    t = MagicMock()
    t.title = "Miss: Predictions COD ebola"
    t.reason = "MISS"
    t.get_reason_display.return_value = "Significant miss"
    t.source_module = "predictions"
    t.country_iso = "COD"
    t.disease_name = "ebola"
    t.detail = "details here"
    subject, text, html = notifications._compose(t)
    assert "PDX Verification" in subject
    assert "COD" in text and "ebola" in text
    assert "<h3>" in html


def test_email_skipped_without_recipients(monkeypatch):
    from verification.services import notifications
    monkeypatch.setattr(notifications, "_notify_emails", lambda: [])
    assert notifications.send_email(MagicMock(id=1)) is False


def test_telegram_skipped_without_chat(monkeypatch):
    from verification.services import notifications
    monkeypatch.setattr(notifications, "_telegram_chat_id", lambda: "")
    assert notifications.send_telegram(MagicMock(id=1)) is False


def test_notify_ticket_never_raises(monkeypatch):
    from verification.services import notifications

    def boom(_t):
        raise RuntimeError("smtp down")

    monkeypatch.setattr(notifications, "send_email", boom)
    monkeypatch.setattr(notifications, "send_telegram", boom)
    # Must swallow errors and return a result dict
    out = notifications.notify_ticket(MagicMock(id=1))
    assert out == {"email": False, "telegram": False}


def test_email_calls_send_mail(monkeypatch):
    from verification.services import notifications
    monkeypatch.setattr(notifications, "_notify_emails", lambda: ["a@who.int"])
    calls = {}

    def fake_send_mail(**kw):
        calls.update(kw)

    monkeypatch.setattr("django.core.mail.send_mail", fake_send_mail)
    t = MagicMock()
    t.title = "x"; t.reason = "MISS"; t.get_reason_display.return_value = "Miss"
    t.source_module = "predictions"; t.country_iso = "COD"; t.disease_name = "ebola"
    t.detail = ""
    assert notifications.send_email(t) is True
    assert calls["recipient_list"] == ["a@who.int"]


# ─── Alerts collector (DB) ─────────────────────────────────────────

@pytest.mark.django_db
def test_collect_alerts_validated_signal_becomes_hit(monkeypatch):
    """
    A validated sentinel Signal should be captured as an alert prediction AND
    produce a ground-truth outcome, so it scores as a Hit.
    """
    from verification.services import capture, matching

    now = timezone.now()

    # Fake sentinel.Signal queryset/iterator with one validated signal.
    sig = MagicMock()
    sig.id = 1
    sig.location_country_iso = "COD"
    sig.location_country = "DR Congo"
    sig.disease_name = "ebola"
    sig.location_admin1 = "Nord-Kivu"
    sig.location_admin2 = ""
    sig.created_at = now - timedelta(days=40)
    sig.priority = "P1"
    sig.status = "validated"
    sig.confidence_score = 90
    sig.source_name = "WHO"
    sig.source_tier = 1
    sig.source_url = "https://who.int/x"
    sig.ai_classification = "area_alert"
    sig.ai_severity = "high"
    sig.reported_cases = 12
    sig.reported_deaths = 3
    sig.validated_at = now - timedelta(days=30)
    sig.triaged_at = None
    sig.ingestion_source = "who_news"
    sig.signal_type = "disease"

    fake_qs = MagicMock()
    fake_qs.order_by.return_value = fake_qs
    fake_qs.iterator.return_value = iter([sig])

    fake_signal_cls = MagicMock()
    fake_signal_cls.objects.all.return_value = fake_qs

    import sys, types
    mod = types.ModuleType("sentinel.models")
    mod.Signal = fake_signal_cls
    monkeypatch.setitem(sys.modules, "sentinel.models", mod)

    result = capture.collect_alerts_incidents(window_days=30)
    assert result["snapshots"] == 1
    assert result["outcomes"] == 1

    snap = PredictionSnapshot.objects.get(source_module="alerts")
    assert snap.prediction_class == "alert_cluster"
    assert snap.country_iso == "COD"

    # window already closed (created 40d ago, 30d window) → match → HIT
    v = matching.match_snapshot(snap)
    assert v.verdict == MatchVerdict.VERDICT_HIT


@pytest.mark.django_db
def test_alerts_coverage_endpoint_logic():
    """alerts-coverage aggregates verdicts for the alerts module."""
    now = timezone.now()

    def mk(verdict, iso="COD"):
        s = PredictionSnapshot.objects.create(
            source_module="alerts", prediction_class="alert_cluster",
            country_iso=iso, disease_name="ebola",
            window_start=now - timedelta(days=40), window_end=now - timedelta(days=10),
            model_version="v", computed_at=now - timedelta(days=40),
            raw_payload={"v": verdict + iso},
        )
        MatchVerdict.objects.create(snapshot=s, verdict=verdict)

    mk(MatchVerdict.VERDICT_HIT)
    mk(MatchVerdict.VERDICT_FALSE_ALARM)
    mk(MatchVerdict.VERDICT_PENDING, iso="UGA")

    from verification.views import MatchVerdictViewSet
    vs = MatchVerdictViewSet()
    vs.request = MagicMock()
    vs.request.query_params = {}
    vs.format_kwarg = None
    resp = vs.alerts_coverage(vs.request)
    data = resp.data
    assert data["total_alerts_tracked"] == 3
    assert data["confirmed_real"] == 1
    assert data["false_alarms"] == 1
    assert data["unverified_pending"] == 1
    assert "COD" in data["by_country"]
    assert "UGA" in data["by_country"]


@pytest.mark.django_db
def test_official_outcomes_from_validated_tier1(monkeypatch):
    """Validated Tier-1 signal → who_don outcome; cross-border flag → import."""
    from verification.services import capture
    now = timezone.now()

    sig = MagicMock()
    sig.id = 7
    sig.location_country_iso = "COD"
    sig.disease_name = "ebola"
    sig.location_admin1 = ""
    sig.location_admin2 = ""
    sig.validated_at = now - timedelta(days=5)
    sig.source_timestamp = None
    sig.created_at = now - timedelta(days=6)
    sig.status = "validated"
    sig.source_tier = 1
    sig.source_name = "WHO"
    sig.source_url = ""
    sig.priority = "P1"
    sig.reported_cases = 5
    sig.reported_deaths = 1
    sig.cross_border_risk = True

    fake_qs = MagicMock()
    fake_qs.order_by.return_value = fake_qs
    fake_qs.iterator.return_value = iter([sig])
    fake_signal_cls = MagicMock()
    fake_signal_cls.objects.filter.return_value = fake_qs

    import sys, types
    mod = types.ModuleType("sentinel.models")
    mod.Signal = fake_signal_cls
    monkeypatch.setitem(sys.modules, "sentinel.models", mod)

    counts = capture.collect_official_outcomes(window_days=120)
    assert counts["who_don"] == 1
    assert counts["cross_border_import"] == 1
    assert OutcomeEvent.objects.filter(outcome_type="who_don").exists()
