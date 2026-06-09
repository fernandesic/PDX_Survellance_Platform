"""
Tests for kobo/ingestion.py — dedup, signal creation, field parsing.

Validates:
  - Same submission doesn't create duplicate Signals
  - Webhook + poll for the same submission = one KoboSubmission + one Signal
  - Field parsing from raw Kobo API payload
"""

from unittest.mock import patch, MagicMock

from django.test import TestCase

from kobo.ingestion import (
    _parse_submission_fields,
    process_webhook_payload,
    sync_kobo_submissions,
)
from kobo.models import KoboSubmission
from sentinel.models import Signal


def _make_raw_payload(**overrides) -> dict:
    """Build a minimal valid Kobo API submission payload."""
    defaults = {
        '_id': 999001,
        '_uuid': 'test-ingestion-uuid-001',
        '_xform_id_string': 'aLHVQjZHtA2G8uNW4HxHPh',
        '__version__': 'v1',
        'chw_name': 'Test Worker',
        'chw_clinic': 'Ingestion Test Clinic',
        'description': 'Test description for ingestion',
        'event_type': 'fever_unknown',
        'case_count': '8',  # Note: string from Kobo API
        'severity': '2_moderate',
        'age_group': 'all_ages',
        '_submission_time': '2026-05-25T10:00:00',
        '_submitted_by': 'test_user',
        '_status': 'submitted_via_web',
        'text_location_adm0_pcode': 'CD',
        'text_location_adm0_name': 'DRC',
    }
    defaults.update(overrides)
    return defaults


class ParseSubmissionFieldsTest(TestCase):
    """Test raw payload parsing."""

    def test_case_count_cast_from_string(self):
        """case_count is cast from string to int."""
        raw = _make_raw_payload(case_count='42')
        fields = _parse_submission_fields(raw)
        self.assertEqual(fields['case_count'], 42)
        self.assertIsInstance(fields['case_count'], int)

    def test_case_count_empty_defaults_to_zero(self):
        """Empty case_count defaults to 0."""
        raw = _make_raw_payload(case_count='')
        fields = _parse_submission_fields(raw)
        self.assertEqual(fields['case_count'], 0)

    def test_case_count_none_defaults_to_zero(self):
        """None case_count defaults to 0."""
        raw = _make_raw_payload(case_count=None)
        fields = _parse_submission_fields(raw)
        self.assertEqual(fields['case_count'], 0)

    def test_chw_name_truncated(self):
        """chw_name is truncated to 200 chars."""
        raw = _make_raw_payload(chw_name='A' * 300)
        fields = _parse_submission_fields(raw)
        self.assertEqual(len(fields['chw_name']), 200)

    def test_geocoded_fields_parsed(self):
        """Geocoded fields are extracted correctly."""
        raw = _make_raw_payload(
            text_location_adm0_pcode='CD',
            text_location_adm0_name='DRC',
            text_location_adm1_name='Ituri',
            text_location_latitude='1.574278',
            text_location_longitude='30.239734',
        )
        fields = _parse_submission_fields(raw)
        self.assertEqual(fields['adm0_pcode'], 'CD')
        self.assertAlmostEqual(fields['geocoded_latitude'], 1.574278, places=5)

    def test_whatsapp_fields_parsed(self):
        """WhatsApp PII fields are stored."""
        raw = _make_raw_payload(
            _whatsapp_number='whatsapp:+16475757051',
            _whatsapp_transcript='Bot: Hello\nCHW: Cases here',
        )
        fields = _parse_submission_fields(raw)
        self.assertEqual(fields['whatsapp_number'], 'whatsapp:+16475757051')
        self.assertIn('Bot: Hello', fields['whatsapp_transcript'])

    def test_raw_payload_stored(self):
        """Full raw payload is stored as-is."""
        raw = _make_raw_payload()
        fields = _parse_submission_fields(raw)
        self.assertEqual(fields['raw_payload'], raw)


class WebhookPayloadProcessingTest(TestCase):
    """Test the webhook payload processing path."""

    def setUp(self):
        from account.models import Tenant
        Tenant.objects.get_or_create(
            iso_code='AFR',
            defaults={
                'name': 'African Region',
                'is_continental': True,
            }
        )

    def test_creates_submission_and_signal(self):
        """Valid payload creates both KoboSubmission and Signal."""
        raw = _make_raw_payload(_id=998001, _uuid='uuid-webhook-001')
        submission = process_webhook_payload(raw)

        self.assertIsNotNone(submission)
        self.assertEqual(submission.kobo_id, 998001)
        # Signal should be created
        self.assertIsNotNone(submission.signal)
        self.assertEqual(submission.signal.source_name, 'KoboToolbox CHW')
        self.assertEqual(submission.signal.source_tier, 0)

    def test_idempotent_redelivery(self):
        """Re-delivery of same payload returns existing submission."""
        raw = _make_raw_payload(_id=998002, _uuid='uuid-webhook-002')

        sub1 = process_webhook_payload(raw)
        sub2 = process_webhook_payload(raw)

        self.assertEqual(sub1.pk, sub2.pk)
        # Only one submission should exist
        self.assertEqual(
            KoboSubmission.objects.filter(kobo_id=998002).count(), 1
        )

    def test_webhook_poll_race_condition(self):
        """
        Webhook creates submission, poll encounters same _id.
        Only one KoboSubmission + one Signal should exist.
        """
        raw = _make_raw_payload(_id=998003, _uuid='uuid-race-001')

        # Simulate webhook
        sub_webhook = process_webhook_payload(raw)

        # Simulate poll encountering the same submission
        sub_poll = process_webhook_payload(raw)

        self.assertEqual(sub_webhook.pk, sub_poll.pk)
        self.assertEqual(
            KoboSubmission.objects.filter(kobo_id=998003).count(), 1
        )
        # Only one signal should exist
        signal_count = Signal.objects.filter(
            source_url='kobo://998003',
        ).count()
        self.assertEqual(signal_count, 1)


class SyncKoboSubmissionsTest(TestCase):
    """Test the poll-based sync function."""

    def setUp(self):
        from account.models import Tenant
        Tenant.objects.get_or_create(
            iso_code='AFR',
            defaults={
                'name': 'African Region',
                'is_continental': True,
            }
        )

    @patch('kobo.ingestion.KoboClient')
    def test_dry_run_no_saves(self, MockClient):
        """--dry-run mode does not create any database rows."""
        mock_instance = MockClient.return_value
        mock_instance.fetch_submissions.return_value = [
            _make_raw_payload(_id=997001, _uuid='uuid-dry-001'),
        ]

        stats = sync_kobo_submissions(dry_run=True)

        self.assertEqual(stats['created'], 1)  # counted but not saved
        self.assertEqual(KoboSubmission.objects.filter(kobo_id=997001).count(), 0)

    @patch('kobo.ingestion.KoboClient')
    def test_empty_response(self, MockClient):
        """Empty API response returns zero stats."""
        mock_instance = MockClient.return_value
        mock_instance.fetch_submissions.return_value = []

        stats = sync_kobo_submissions()

        self.assertEqual(stats['created'], 0)
        self.assertEqual(stats['skipped'], 0)
        self.assertEqual(stats['errors'], 0)

    @patch('kobo.ingestion.KoboClient')
    def test_creates_submissions(self, MockClient):
        """Valid submissions are created with signals."""
        mock_instance = MockClient.return_value
        mock_instance.fetch_submissions.return_value = [
            _make_raw_payload(_id=997010, _uuid='uuid-sync-010'),
            _make_raw_payload(_id=997011, _uuid='uuid-sync-011'),
        ]

        stats = sync_kobo_submissions()

        self.assertEqual(stats['created'], 2)
        self.assertEqual(stats['skipped'], 0)
        self.assertEqual(KoboSubmission.objects.count(), 2)

    @patch('kobo.ingestion.KoboClient')
    def test_dedup_skips_existing(self, MockClient):
        """Existing submissions are skipped on re-sync."""
        # Pre-create one
        raw = _make_raw_payload(_id=997020, _uuid='uuid-sync-020')
        process_webhook_payload(raw)

        mock_instance = MockClient.return_value
        mock_instance.fetch_submissions.return_value = [raw]

        stats = sync_kobo_submissions()

        self.assertEqual(stats['created'], 0)
        self.assertEqual(stats['skipped'], 1)

    @patch('kobo.ingestion.KoboClient')
    def test_bad_payload_counted_as_error(self, MockClient):
        """Malformed payload is counted as an error, not a crash."""
        mock_instance = MockClient.return_value
        mock_instance.fetch_submissions.return_value = [
            {'bad': 'payload'},  # Missing _id
        ]

        stats = sync_kobo_submissions()

        self.assertEqual(stats['errors'], 1)
        self.assertEqual(stats['created'], 0)
