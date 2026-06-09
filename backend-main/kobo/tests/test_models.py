"""
Tests for KoboSubmission model — field validation, constraints, anomaly flagging.
"""

from django.test import TestCase
from django.db import IntegrityError

from kobo.models import KoboSubmission


class KoboSubmissionModelTest(TestCase):
    """Test KoboSubmission model basics."""

    def _make_submission(self, **overrides) -> KoboSubmission:
        """Helper to create a submission with sensible defaults."""
        defaults = {
            'kobo_id': 100001,
            'kobo_uuid': 'test-uuid-100001',
            'chw_name': 'Test CHW',
            'chw_clinic': 'Test Clinic',
            'description': 'Patients presenting with fever',
            'event_type': 'fever_unknown',
            'case_count': 5,
            'severity': '2_moderate',
            'age_group': 'all_ages',
        }
        defaults.update(overrides)
        return KoboSubmission.objects.create(**defaults)

    def test_create_submission(self):
        """Basic creation works."""
        sub = self._make_submission()
        self.assertEqual(sub.kobo_id, 100001)
        self.assertEqual(sub.case_count, 5)
        self.assertFalse(sub.anomaly_flag)

    def test_str_representation(self):
        """__str__ returns a useful description."""
        sub = self._make_submission()
        s = str(sub)
        self.assertIn('100001', s)
        self.assertIn('fever_unknown', s)

    def test_unique_kobo_id(self):
        """Duplicate kobo_id raises IntegrityError."""
        self._make_submission(kobo_id=200001, kobo_uuid='uuid-a')
        with self.assertRaises(IntegrityError):
            self._make_submission(kobo_id=200001, kobo_uuid='uuid-b')

    def test_unique_kobo_uuid(self):
        """Duplicate kobo_uuid raises IntegrityError."""
        self._make_submission(kobo_id=300001, kobo_uuid='shared-uuid')
        with self.assertRaises(IntegrityError):
            self._make_submission(kobo_id=300002, kobo_uuid='shared-uuid')

    def test_anomaly_flag_set_on_high_case_count(self):
        """case_count > 1000 sets anomaly_flag = True."""
        sub = self._make_submission(
            kobo_id=400001, kobo_uuid='uuid-anomaly',
            case_count=1500,
        )
        self.assertTrue(sub.anomaly_flag)

    def test_anomaly_flag_not_set_on_normal_case_count(self):
        """case_count <= 1000 does NOT set anomaly_flag."""
        sub = self._make_submission(
            kobo_id=400002, kobo_uuid='uuid-normal',
            case_count=100,
        )
        self.assertFalse(sub.anomaly_flag)

    def test_signal_fk_nullable(self):
        """signal FK is nullable (submission can exist without a signal)."""
        sub = self._make_submission(
            kobo_id=500001, kobo_uuid='uuid-nosignal',
        )
        self.assertIsNone(sub.signal)

    def test_default_values(self):
        """Default empty strings and dicts are set correctly."""
        sub = self._make_submission(
            kobo_id=600001, kobo_uuid='uuid-defaults',
        )
        self.assertEqual(sub.whatsapp_number, '')
        self.assertEqual(sub.whatsapp_transcript, '')
        self.assertEqual(sub.gps_location, '')
        self.assertIsInstance(sub.raw_payload, dict)
