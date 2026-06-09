"""
Tests for the Sentinel DRF API — /api/v1/sentinel/signals/ and /stats/.

Covers authentication, filtering, and the detail payload shape.
"""

from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from sentinel.models import (
    DiseaseCategory,
    Signal,
    SignalPriority,
    SignalStatus,
    SourceTier,
)

User = get_user_model()


def _create_test_user(email: str = "analyst@who.int") -> "User":
    """Create a minimally-populated authenticated user.

    The User model declares `blank=False` on several fields (full_name,
    date_of_birth, country, phone_number) — those are form-level constraints,
    so the ORM accepts empty / unique values fine.
    """
    return User.objects.create_user(
        email=email,
        password="correcthorsebatterystaple",
        full_name="Test Analyst",
        date_of_birth="1990-01-01",
        country="Nigeria",
    )


def _create_signal(**overrides) -> Signal:
    defaults = dict(
        signal_type="disease",
        disease_name="Cholera",
        disease_category=DiseaseCategory.ENTERIC,
        location_country="Nigeria",
        location_country_iso="NGA",
        original_text="Cholera cases confirmed in Lagos",
        original_language="en",
        source_name="GDELT",
        source_url="https://example.com/a",
        source_tier=SourceTier.TIER_2,
        priority=SignalPriority.P2,
        confidence_score=75,
        status=SignalStatus.NEW,
        ingestion_source="GDELT-V2",
        duplicate_hash="hash_a",
    )
    defaults.update(overrides)
    return Signal.objects.create(**defaults)


class SignalsListAuthTests(APITestCase):
    """Auth gating on the signals list endpoint."""

    def setUp(self):
        self.user = _create_test_user()
        _create_signal()

    def test_signals_list_authenticated(self):
        """Authenticated GET /signals/ returns 200 and a list of signals."""
        client = APIClient()
        client.force_authenticate(user=self.user)

        response = client.get(reverse("signal-list"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsInstance(response.data, list)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["disease_name"], "Cholera")

    def test_signals_list_unauthenticated(self):
        """Unauthenticated GET /signals/ returns 401 (custom auth sets WWW-Authenticate)."""
        client = APIClient()
        response = client.get(reverse("signal-list"))
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class SignalsStatsTests(APITestCase):
    """Shape of the /signals/stats/ aggregation."""

    def setUp(self):
        self.user = _create_test_user()
        _create_signal(priority=SignalPriority.P1, duplicate_hash="h1")
        _create_signal(priority=SignalPriority.P2, duplicate_hash="h2")
        _create_signal(priority=SignalPriority.P3, duplicate_hash="h3")
        _create_signal(
            priority=SignalPriority.P1,
            status=SignalStatus.VALIDATED,
            duplicate_hash="h4",
        )

    def test_signals_stats_shape(self):
        """Stats response carries total, by_priority, by_status, by_country."""
        client = APIClient()
        client.force_authenticate(user=self.user)

        response = client.get(reverse("signal-stats"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.data
        for key in ("total", "by_priority", "by_status", "by_country"):
            self.assertIn(key, data, f"stats missing `{key}` key")

        self.assertEqual(data["total"], 4)
        self.assertEqual(data["by_priority"]["P1"], 2)
        self.assertEqual(data["by_priority"]["P2"], 1)
        self.assertEqual(data["by_priority"]["P3"], 1)
        self.assertEqual(data["by_priority"]["P4"], 0)
        self.assertEqual(data["by_status"]["new"], 3)
        self.assertEqual(data["by_status"]["validated"], 1)


class SignalsFilterTests(APITestCase):
    """Query-param filtering (django-filter + DRF filter backend)."""

    def setUp(self):
        self.user = _create_test_user()
        _create_signal(
            priority=SignalPriority.P1,
            location_country="Nigeria",
            location_country_iso="NGA",
            duplicate_hash="h1",
        )
        _create_signal(
            priority=SignalPriority.P1,
            location_country="Kenya",
            location_country_iso="KEN",
            duplicate_hash="h2",
        )
        _create_signal(
            priority=SignalPriority.P2,
            location_country="Nigeria",
            location_country_iso="NGA",
            duplicate_hash="h3",
        )
        _create_signal(
            priority=SignalPriority.P3,
            location_country="Ghana",
            location_country_iso="GHA",
            duplicate_hash="h4",
        )

    def test_signals_filter_by_priority(self):
        """`?priority=P1` returns only P1 signals."""
        client = APIClient()
        client.force_authenticate(user=self.user)

        response = client.get(reverse("signal-list"), {"priority": "P1"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)
        for sig in response.data:
            self.assertEqual(sig["priority"], "P1")

    def test_signals_filter_by_country(self):
        """`?location_country_iso=NGA` returns only Nigerian signals."""
        client = APIClient()
        client.force_authenticate(user=self.user)

        response = client.get(
            reverse("signal-list"), {"location_country_iso": "NGA"}
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)
        for sig in response.data:
            self.assertEqual(sig["location_country_iso"], "NGA")


class SignalDetailTests(APITestCase):
    """/signals/{id}/ returns the full detail serializer."""

    def setUp(self):
        self.user = _create_test_user()
        self.signal = _create_signal(
            ai_classification="area_alert",
            ai_severity="high",
            ai_notification_scope="local",
            ai_reasoning="Cases rising in Lagos with cross-border risk.",
            reported_cases=120,
            reported_deaths=5,
            cross_border_risk=True,
            pillar="outbreak",
        )

    def test_signal_detail(self):
        """GET /signals/{id}/ returns every field SignalDetailSerializer exposes."""
        client = APIClient()
        client.force_authenticate(user=self.user)

        response = client.get(reverse("signal-detail", args=[self.signal.id]))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.data

        # Identity + content
        self.assertEqual(data["id"], self.signal.id)
        self.assertEqual(data["disease_name"], "Cholera")
        self.assertEqual(data["location_country_iso"], "NGA")
        self.assertEqual(data["original_text"], "Cholera cases confirmed in Lagos")

        # AI fields (populated in fixture)
        self.assertEqual(data["ai_classification"], "area_alert")
        self.assertEqual(data["ai_severity"], "high")
        self.assertEqual(data["ai_notification_scope"], "local")
        self.assertIn("Cases rising", data["ai_reasoning"])

        # Outbreak metadata
        self.assertEqual(data["reported_cases"], 120)
        self.assertEqual(data["reported_deaths"], 5)
        self.assertTrue(data["cross_border_risk"])
        self.assertEqual(data["pillar"], "outbreak")

        # Detail-only keys that must be present even when null
        for key in (
            "triaged_by",
            "triaged_by_name",
            "validated_by",
            "validated_by_name",
            "raw_payload",
            "duplicate_hash",
        ):
            self.assertIn(key, data, f"detail response missing `{key}`")
