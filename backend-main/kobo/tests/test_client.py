"""
Tests for KoboClient — instantiation, URL construction.

NOTE: We do NOT make real API calls in unit tests. These tests verify
that the client can be instantiated and constructs URLs correctly.
"""

from django.test import TestCase, override_settings

from kobo.client import KoboClient


class KoboClientTest(TestCase):
    """Test KoboClient configuration and URL construction."""

    @override_settings(
        KOBO_BASE_URL='https://kf.kobotoolbox.org',
        KOBO_ASSET_ID='aLHVQjZHtA2G8uNW4HxHPh',
        KOBO_API_TOKEN='kpi_test_token',
    )
    def test_instantiation(self):
        """Client can be created and reads settings."""
        client = KoboClient()
        self.assertEqual(client.base_url, 'https://kf.kobotoolbox.org')
        self.assertEqual(client.asset_id, 'aLHVQjZHtA2G8uNW4HxHPh')

    @override_settings(
        KOBO_BASE_URL='https://kf.kobotoolbox.org',
        KOBO_ASSET_ID='aLHVQjZHtA2G8uNW4HxHPh',
        KOBO_API_TOKEN='kpi_test_token',
    )
    def test_data_url(self):
        """Data URL is constructed correctly."""
        client = KoboClient()
        expected = (
            'https://kf.kobotoolbox.org/api/v2/assets/'
            'aLHVQjZHtA2G8uNW4HxHPh/data/'
        )
        self.assertEqual(client._data_url, expected)

    @override_settings(
        KOBO_BASE_URL='https://kf.kobotoolbox.org',
        KOBO_ASSET_ID='aLHVQjZHtA2G8uNW4HxHPh',
        KOBO_API_TOKEN='kpi_test_token',
    )
    def test_headers_contain_token(self):
        """Auth headers include the token from settings."""
        client = KoboClient()
        headers = client._headers
        self.assertEqual(headers['Authorization'], 'Token kpi_test_token')
        self.assertEqual(headers['Accept'], 'application/json')

    @override_settings(
        KOBO_BASE_URL='https://staging.kobotoolbox.org',
        KOBO_ASSET_ID='custom_asset_id',
        KOBO_API_TOKEN='staging_token',
    )
    def test_custom_settings(self):
        """Client respects overridden settings (staging environment)."""
        client = KoboClient()
        self.assertEqual(client.base_url, 'https://staging.kobotoolbox.org')
        self.assertEqual(client.asset_id, 'custom_asset_id')
        self.assertIn('staging_token', client._headers['Authorization'])
