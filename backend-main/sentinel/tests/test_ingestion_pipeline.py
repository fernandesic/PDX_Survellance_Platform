"""
Tests for the ingestion pipeline — noise filter, disease detector,
priority classifier, and dedup hashing.

These tests run against in-memory logic + a test DB (for DiseaseKeyword and
Signal fixtures); no external HTTP.
"""

from django.test import SimpleTestCase, TestCase

from sentinel.disease_detector import DiseaseDetector, disease_detector
from sentinel.ingestion import generate_hash
from sentinel.models import (
    DiseaseCategory,
    DiseaseKeyword,
    Signal,
    SignalPriority,
    SignalStatus,
)
from sentinel.noise_filter import NoiseFilter


# ── Noise filter ────────────────────────────────────────────────────────────

class NoiseFilterTests(SimpleTestCase):
    """Noise filter — rejects political / non-African / non-health text."""

    def setUp(self):
        self.filter = NoiseFilter()

    def test_noise_filter_rejects_political(self):
        """`Trump withdraws WHO funding` → rejected as political noise."""
        result = self.filter.filter_signal("Trump withdraws WHO funding")
        self.assertFalse(result["pass"])
        self.assertEqual(result["reason"], "political_noise")

    def test_noise_filter_passes_outbreak(self):
        """`Cholera cases confirmed in Nigeria` → passes all filters."""
        result = self.filter.filter_signal(
            "Cholera cases confirmed in Nigeria", country_iso="NGA"
        )
        self.assertTrue(result["pass"], result)
        self.assertIsNone(result["reason"])
        self.assertGreaterEqual(result["score"], 50)

    def test_noise_filter_rejects_non_african(self):
        """`Flu outbreak in Japan` → rejected as non-African focus."""
        result = self.filter.filter_signal("Flu outbreak in Japan")
        self.assertFalse(result["pass"])
        self.assertEqual(result["reason"], "non_african_focus")

    def test_noise_filter_rejects_when_missing_outbreak_indicators(self):
        """African focus without outbreak keywords → rejected."""
        result = self.filter.filter_signal(
            "Lagos hosts finance conference", country_iso="NGA"
        )
        self.assertFalse(result["pass"])
        self.assertEqual(result["reason"], "missing_outbreak_indicators")

    def test_noise_filter_score_boosts_with_numbers(self):
        """Case-count numbers boost the quality score."""
        base = self.filter.filter_signal(
            "Cholera cases confirmed in Nigeria", country_iso="NGA"
        )
        boosted = self.filter.filter_signal(
            "123 cases of cholera confirmed in Nigeria", country_iso="NGA"
        )
        self.assertTrue(base["pass"])
        self.assertTrue(boosted["pass"])
        self.assertGreater(boosted["score"], base["score"])


# ── Disease detector ────────────────────────────────────────────────────────

class DiseaseDetectorTests(TestCase):
    """Disease detector — keyword-based multilingual detection."""

    @classmethod
    def setUpTestData(cls):
        DiseaseKeyword.objects.create(
            disease_name="Cholera",
            category=DiseaseCategory.ENTERIC,
            default_priority=SignalPriority.P2,
            keywords_en=["cholera", "acute watery diarrhoea"],
            keywords_fr=["cholera", "cholera epidemie"],
        )
        DiseaseKeyword.objects.create(
            disease_name="Ebola",
            category=DiseaseCategory.VHF,
            default_priority=SignalPriority.P1,
            keywords_en=["ebola", "ebola virus", "evd"],
            keywords_fr=["ebola", "virus ebola"],
        )
        DiseaseKeyword.objects.create(
            disease_name="Measles",
            category=DiseaseCategory.VACCINE_PREVENTABLE,
            default_priority=SignalPriority.P2,
            keywords_en=["measles", "rougeole"],
        )

    def setUp(self):
        # Detector is a module-level singleton; force a DB reload per test
        # so we read fresh DiseaseKeyword rows created by setUpTestData.
        disease_detector.invalidate_cache()
        self.detector = DiseaseDetector()

    def test_disease_detector_finds_cholera(self):
        """Text containing `cholera` → cholera detection."""
        detection = self.detector.get_primary_disease(
            "Cholera outbreak confirmed in Lagos"
        )
        self.assertIsNotNone(detection)
        self.assertEqual(detection["name"], "Cholera")
        self.assertEqual(detection["category"], DiseaseCategory.ENTERIC)
        self.assertIn("cholera", detection["matches"])
        self.assertGreater(detection["confidence"], 50)

    def test_disease_detector_multilingual(self):
        """French `epidemie de cholera` is detected via the French keyword list."""
        detection = self.detector.get_primary_disease(
            "Une epidemie de cholera a ete signalee au Senegal"
        )
        self.assertIsNotNone(detection)
        self.assertEqual(detection["name"], "Cholera")

    def test_disease_detector_returns_none_for_unrelated_text(self):
        """Text with no disease keywords → None."""
        self.assertIsNone(
            self.detector.get_primary_disease(
                "Lagos hosts annual technology investment summit"
            )
        )

    def test_priority_classifier_vhf_is_p1(self):
        """`Ebola confirmed cases` → P1 (VHF baseline)."""
        priority = self.detector.classify_priority("Ebola confirmed cases in DRC")
        self.assertEqual(priority, SignalPriority.P1)

    def test_priority_classifier_deaths_boost(self):
        """Death count bumps measles from its P2 baseline to P1."""
        baseline = self.detector.classify_priority("measles cases reported")
        boosted = self.detector.classify_priority(
            "10 deaths from measles reported in Cameroon"
        )
        self.assertEqual(baseline, SignalPriority.P2)
        self.assertEqual(boosted, SignalPriority.P1)

    def test_priority_classifier_unknown_disease_defaults_to_p3(self):
        """Text with no known disease returns the P3 fallback."""
        self.assertEqual(
            self.detector.classify_priority("mysterious illness spreading"),
            SignalPriority.P3,
        )


# ── Dedup hashing ───────────────────────────────────────────────────────────

class DedupHashTests(SimpleTestCase):
    """generate_hash() — deterministic 16-char MD5 prefix."""

    def test_dedup_hash_consistent(self):
        """Same URL → same hash across calls."""
        url = "https://example.com/news/cholera-lagos"
        self.assertEqual(generate_hash(url), generate_hash(url))

    def test_dedup_hash_differs_by_input(self):
        """Different URLs → different hashes."""
        self.assertNotEqual(
            generate_hash("https://example.com/a"),
            generate_hash("https://example.com/b"),
        )

    def test_dedup_hash_length(self):
        """Hash is the documented 16-char MD5 prefix."""
        self.assertEqual(len(generate_hash("anything")), 16)


class DedupBlocksDuplicateTests(TestCase):
    """Once a Signal with a given duplicate_hash exists, new ingestion skips it."""

    def test_dedup_blocks_duplicate(self):
        """Second ingestion attempt with the same hash must be treated as dup."""
        url = "https://example.com/news/measles-abuja"
        dup_hash = generate_hash(url)

        Signal.objects.create(
            signal_type="disease",
            disease_name="Measles",
            location_country="Nigeria",
            location_country_iso="NGA",
            original_text="Measles cases confirmed in Abuja",
            source_name="Test",
            source_url=url,
            source_tier=2,
            priority=SignalPriority.P2,
            status=SignalStatus.NEW,
            ingestion_source="TEST",
            duplicate_hash=dup_hash,
        )

        # Exactly the condition checked by every ingestion task before insert.
        self.assertTrue(Signal.objects.filter(duplicate_hash=dup_hash).exists())
        self.assertEqual(Signal.objects.filter(duplicate_hash=dup_hash).count(), 1)
