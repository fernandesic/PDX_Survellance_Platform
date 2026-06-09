"""
Tests for signal_mapper — CHW submission → Signal kwargs.

Validates:
  - Correct source_tier (0 = TIER_0)
  - Correct source_name ('KoboToolbox CHW')
  - GPS extraction (device + geocoded fallback)
  - case_count is int (not string)
  - Symptom descriptions (not disease diagnoses)
  - Country ISO resolution
"""

from django.test import TestCase

from kobo.models import KoboSubmission
from kobo.signal_mapper import (
    map_submission_to_signal,
    KOBO_SOURCE_NAME,
    KOBO_SOURCE_TIER,
    EVENT_TYPE_TO_SYMPTOMS,
    _extract_coordinates,
    _resolve_country_iso,
    _build_disease_name,
)


class SignalMapperTest(TestCase):
    """Test the signal mapper output."""

    def _make_submission(self, **overrides) -> KoboSubmission:
        defaults = {
            'kobo_id': 700001,
            'kobo_uuid': 'uuid-mapper-test',
            'chw_name': 'Marie Dupont',
            'chw_clinic': 'Bunia Health Center',
            'description': 'Multiple patients with bloody diarrhea in village',
            'event_type': 'diarrhea_vomiting fever_unknown',
            'case_count': 12,
            'severity': '3_severe',
            'age_group': 'under5',
            'adm0_pcode': 'CD',
            'adm0_name': 'République démocratique du Congo',
            'adm1_name': 'Ituri',
            'adm2_name': 'Bunia',
            'geocoded_latitude': 1.574278,
            'geocoded_longitude': 30.239734,
        }
        defaults.update(overrides)
        return KoboSubmission.objects.create(**defaults)

    def test_source_tier_is_zero(self):
        """Signal has source_tier=0 (Ground Truth)."""
        sub = self._make_submission()
        kwargs = map_submission_to_signal(sub)
        self.assertEqual(kwargs['source_tier'], 0)
        self.assertEqual(kwargs['source_tier'], KOBO_SOURCE_TIER)

    def test_source_name(self):
        """Signal source_name is 'KoboToolbox CHW'."""
        sub = self._make_submission()
        kwargs = map_submission_to_signal(sub)
        self.assertEqual(kwargs['source_name'], 'KoboToolbox CHW')
        self.assertEqual(kwargs['source_name'], KOBO_SOURCE_NAME)

    def test_case_count_is_int(self):
        """reported_cases is an integer, not a string."""
        sub = self._make_submission()
        kwargs = map_submission_to_signal(sub)
        self.assertIsInstance(kwargs['reported_cases'], int)
        self.assertEqual(kwargs['reported_cases'], 12)

    def test_disease_name_is_symptoms_not_diagnosis(self):
        """disease_name contains symptom descriptions, not diagnoses."""
        sub = self._make_submission(event_type='diarrhea_vomiting fever_unknown')
        kwargs = map_submission_to_signal(sub)
        # Should contain symptom descriptions
        self.assertIn('diarrhea', kwargs['disease_name'].lower())
        self.assertIn('fever', kwargs['disease_name'].lower())
        # Should NOT contain disease diagnoses
        self.assertNotIn('cholera', kwargs['disease_name'].lower())
        self.assertNotIn('malaria', kwargs['disease_name'].lower())

    def test_gps_from_device(self):
        """GPS extracted from device gps_location field."""
        sub = self._make_submission(
            kobo_id=700002, kobo_uuid='uuid-gps-device',
            gps_location='1.574278 30.239734 0 10',
        )
        lat, lng = _extract_coordinates(sub)
        self.assertAlmostEqual(lat, 1.574278, places=5)
        self.assertAlmostEqual(lng, 30.239734, places=5)

    def test_gps_from_geocoded_fallback(self):
        """GPS falls back to geocoded coordinates when device GPS is empty."""
        sub = self._make_submission(
            kobo_id=700003, kobo_uuid='uuid-gps-geocoded',
            gps_location='',
            geocoded_latitude=1.574278,
            geocoded_longitude=30.239734,
        )
        lat, lng = _extract_coordinates(sub)
        self.assertAlmostEqual(lat, 1.574278, places=5)
        self.assertAlmostEqual(lng, 30.239734, places=5)

    def test_gps_none_when_no_data(self):
        """GPS is (None, None) when no location data available."""
        sub = self._make_submission(
            kobo_id=700004, kobo_uuid='uuid-gps-none',
            gps_location='',
            geocoded_latitude=None,
            geocoded_longitude=None,
        )
        lat, lng = _extract_coordinates(sub)
        self.assertIsNone(lat)
        self.assertIsNone(lng)

    def test_country_iso_from_adm0_pcode(self):
        """Country ISO3 resolved from geocoded adm0_pcode (alpha-2)."""
        sub = self._make_submission(
            kobo_id=700005, kobo_uuid='uuid-iso-cd',
            adm0_pcode='CD',
        )
        iso3 = _resolve_country_iso(sub)
        self.assertEqual(iso3, 'COD')

    def test_country_iso_nigeria(self):
        """Country ISO3 resolved for Nigeria."""
        sub = self._make_submission(
            kobo_id=700006, kobo_uuid='uuid-iso-ng',
            adm0_pcode='NG',
        )
        iso3 = _resolve_country_iso(sub)
        self.assertEqual(iso3, 'NGA')

    def test_severity_to_priority_mapping(self):
        """Severity levels map to correct priorities."""
        test_cases = [
            ('1_mild', 'P4'),
            ('2_moderate', 'P3'),
            ('3_severe', 'P2'),
            ('4_critical', 'P1'),
        ]
        for i, (severity, expected_priority) in enumerate(test_cases):
            sub = self._make_submission(
                kobo_id=700010 + i,
                kobo_uuid=f'uuid-priority-{i}',
                severity=severity,
            )
            kwargs = map_submission_to_signal(sub)
            self.assertEqual(
                kwargs['priority'], expected_priority,
                f"Severity {severity} should map to {expected_priority}",
            )

    def test_animal_deaths_event_type(self):
        """animal_deaths event type produces correct symptom description."""
        sub = self._make_submission(
            kobo_id=700020, kobo_uuid='uuid-animal',
            event_type='animal_deaths',
        )
        disease_name = _build_disease_name(sub)
        self.assertIn('animal', disease_name.lower())

    def test_event_other_included(self):
        """event_other text is included in disease_name."""
        sub = self._make_submission(
            kobo_id=700021, kobo_uuid='uuid-other',
            event_type='other',
            event_other='Strange rash with blisters',
        )
        disease_name = _build_disease_name(sub)
        self.assertIn('Strange rash with blisters', disease_name)

    def test_signal_kwargs_complete(self):
        """Signal kwargs contain all required fields."""
        sub = self._make_submission()
        kwargs = map_submission_to_signal(sub)

        required_fields = [
            'signal_type', 'disease_name', 'location_country',
            'location_country_iso', 'original_text', 'source_name',
            'source_tier', 'priority', 'status', 'ingestion_source',
            'reported_cases',
        ]
        for field in required_fields:
            self.assertIn(field, kwargs, f"Missing required field: {field}")
