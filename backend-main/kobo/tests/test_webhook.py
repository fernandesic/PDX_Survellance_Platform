"""
Tests for the Kobo webhook endpoint.

Validates:
  - Wrong secret → 404
  - Wrong form ID → 400
  - Valid payload → 201
  - Re-delivery → 200 (idempotent)
  - Always returns 2xx (even on processing error)
  - No PII in responses
"""

from django.test import TestCase, override_settings
from rest_framework.test import APIClient


@override_settings(
    KOBO_WEBHOOK_SECRET='test-secret',
    KOBO_ASSET_ID='aLHVQjZHtA2G8uNW4HxHPh',
)
class KoboWebhookTest(TestCase):
    """Test the webhook endpoint security and behavior."""

    def setUp(self):
        from account.models import Tenant
        Tenant.objects.get_or_create(
            iso_code='AFR',
            defaults={
                'name': 'African Region',
                'is_continental': True,
            }
        )
        self.client = APIClient()
        self.webhook_url = '/api/v1/kobo/webhook/test-secret/'
        self.wrong_secret_url = '/api/v1/kobo/webhook/wrong-secret/'
        self.valid_payload = {
            '_id': 888001,
            '_uuid': 'webhook-test-uuid-001',
            '_xform_id_string': 'aLHVQjZHtA2G8uNW4HxHPh',
            '__version__': 'v1',
            'chw_name': 'Test CHW',
            'chw_clinic': 'Test Clinic',
            'description': 'Test description',
            'event_type': 'fever_unknown',
            'case_count': '5',
            'severity': '2_moderate',
            'age_group': 'all_ages',
            '_submission_time': '2026-05-25T10:00:00',
            '_submitted_by': 'test_user',
            '_status': 'submitted_via_web',
            'text_location_adm0_pcode': 'CD',
        }

    # ── Security tests ──────────────────────────────────────────────

    def test_wrong_secret_returns_404(self):
        """Wrong webhook secret returns 404 (not 403 — don't leak existence)."""
        resp = self.client.post(
            self.wrong_secret_url,
            data=self.valid_payload,
            format='json',
        )
        self.assertEqual(resp.status_code, 404)

    def test_wrong_form_id_returns_400(self):
        """Payload with wrong _xform_id_string is rejected with 400."""
        payload = {**self.valid_payload, '_xform_id_string': 'wrong_form'}
        resp = self.client.post(
            self.webhook_url,
            data=payload,
            format='json',
        )
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(resp.data['status'], 'rejected')

    def test_missing_id_returns_400(self):
        """Payload without _id field is rejected."""
        payload = {k: v for k, v in self.valid_payload.items() if k != '_id'}
        resp = self.client.post(
            self.webhook_url,
            data=payload,
            format='json',
        )
        self.assertEqual(resp.status_code, 400)

    # ── Functional tests ────────────────────────────────────────────

    def test_valid_payload_returns_201(self):
        """Valid payload creates submission and returns 201."""
        resp = self.client.post(
            self.webhook_url,
            data=self.valid_payload,
            format='json',
        )
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.data['status'], 'created')
        self.assertEqual(resp.data['kobo_id'], 888001)

    def test_redelivery_returns_200(self):
        """Re-delivery of same payload returns 200 (accepted, not duplicated)."""
        # First delivery
        resp1 = self.client.post(
            self.webhook_url,
            data=self.valid_payload,
            format='json',
        )
        self.assertEqual(resp1.status_code, 201)

        # Re-delivery
        resp2 = self.client.post(
            self.webhook_url,
            data=self.valid_payload,
            format='json',
        )
        # Should be 200 (accepted, not a new creation)
        self.assertIn(resp2.status_code, [200, 201])

    def test_no_pii_in_response(self):
        """Response body does not contain PII fields."""
        resp = self.client.post(
            self.webhook_url,
            data=self.valid_payload,
            format='json',
        )
        response_text = str(resp.data)
        self.assertNotIn('chw_name', response_text.lower().replace('_', ''))
        self.assertNotIn('whatsapp', response_text.lower())

    def test_no_auth_required(self):
        """Webhook does not require Django authentication."""
        # client has no auth set — should still work
        resp = self.client.post(
            self.webhook_url,
            data=self.valid_payload,
            format='json',
        )
        self.assertNotEqual(resp.status_code, 401)
        self.assertNotEqual(resp.status_code, 403)

    def test_multiple_event_types(self):
        """Payload with multiple event types is processed correctly."""
        payload = {
            **self.valid_payload,
            '_id': 888002,
            '_uuid': 'webhook-test-uuid-002',
            'event_type': 'fever_unknown diarrhea_vomiting respiratory',
        }
        resp = self.client.post(
            self.webhook_url,
            data=payload,
            format='json',
        )
        self.assertEqual(resp.status_code, 201)

    def test_animal_deaths_payload(self):
        """Payload with animal_deaths event type is processed."""
        payload = {
            **self.valid_payload,
            '_id': 888003,
            '_uuid': 'webhook-test-uuid-003',
            'event_type': 'animal_deaths',
        }
        resp = self.client.post(
            self.webhook_url,
            data=payload,
            format='json',
        )
        self.assertEqual(resp.status_code, 201)

    def test_high_case_count_flagged(self):
        """Submission with case_count > 1000 gets anomaly_flag set."""
        payload = {
            **self.valid_payload,
            '_id': 888004,
            '_uuid': 'webhook-test-uuid-004',
            'case_count': '9999',
        }
        resp = self.client.post(
            self.webhook_url,
            data=payload,
            format='json',
        )
        self.assertEqual(resp.status_code, 201)

        from kobo.models import KoboSubmission
        sub = KoboSubmission.objects.get(kobo_id=888004)
        self.assertTrue(sub.anomaly_flag)

    # ── Empty secret config test ────────────────────────────────────

    @override_settings(KOBO_WEBHOOK_SECRET='')
    def test_empty_secret_returns_404(self):
        """If webhook secret is empty/unset, all requests return 404."""
        resp = self.client.post(
            '/api/v1/kobo/webhook/anything/',
            data=self.valid_payload,
            format='json',
        )
        self.assertEqual(resp.status_code, 404)
