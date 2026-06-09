"""
KoboToolbox API Client

Handles authentication, pagination, retries, and rate limiting
for the KoboToolbox REST API v2.

Token is read from settings.KOBO_API_TOKEN — never hardcoded.
"""

import logging
import time
from datetime import datetime
from typing import Any, Optional

import requests
from django.conf import settings

logger = logging.getLogger(__name__)

# ── Constants ───────────────────────────────────────────────────────
MAX_RETRIES = 3
BACKOFF_BASE = 2  # seconds
REQUEST_TIMEOUT = 30  # seconds


class KoboClient:
    """
    Client for the KoboToolbox API v2.

    Usage:
        client = KoboClient()
        submissions = client.fetch_submissions(limit=50)
    """

    def __init__(self) -> None:
        self.base_url: str = getattr(
            settings, 'KOBO_BASE_URL', 'https://kf.kobotoolbox.org'
        )
        self.asset_id: str = getattr(
            settings, 'KOBO_ASSET_ID', 'aLHVQjZHtA2G8uNW4HxHPh'
        )
        self._token: str = getattr(settings, 'KOBO_API_TOKEN', '')

    @property
    def _headers(self) -> dict[str, str]:
        return {
            'Authorization': f'Token {self._token}',
            'Accept': 'application/json',
        }

    @property
    def _data_url(self) -> str:
        return (
            f'{self.base_url}/api/v2/assets/'
            f'{self.asset_id}/data/'
        )

    def fetch_submissions(
        self,
        *,
        since: Optional[datetime] = None,
        limit: int = 100,
    ) -> list[dict[str, Any]]:
        """
        Fetch submissions from KoboToolbox, optionally filtered by time.

        Args:
            since: Only return submissions after this datetime.
            limit: Max number of submissions to return.

        Returns:
            List of raw submission dicts from the Kobo API.
        """
        params: dict[str, str] = {
            'format': 'json',
            'limit': str(limit),
            'sort': '{"_submission_time": -1}',
        }

        if since:
            # MongoDB-style query filter for submissions after `since`
            since_str = since.strftime('%Y-%m-%dT%H:%M:%S')
            params['query'] = (
                f'{{"_submission_time": {{"$gte": "{since_str}"}}}}'
            )

        data = self._fetch_with_retry(self._data_url, params)
        if data is None:
            return []

        results = data.get('results', [])
        logger.info(
            "Kobo API: fetched %d submissions (limit=%d, since=%s)",
            len(results), limit, since,
        )
        return results

    def _fetch_with_retry(
        self,
        url: str,
        params: Optional[dict[str, str]] = None,
    ) -> Optional[dict[str, Any]]:
        """
        Fetch a URL with retry logic and exponential backoff.

        Handles:
          - 429 Too Many Requests (rate limit) — wait and retry
          - 5xx Server Error — wait and retry
          - 401/403 — log and stop (don't retry auth failures)
        """
        for attempt in range(MAX_RETRIES):
            try:
                resp = requests.get(
                    url,
                    headers=self._headers,
                    params=params,
                    timeout=REQUEST_TIMEOUT,
                )

                if resp.status_code == 429:
                    wait = BACKOFF_BASE * (2 ** attempt)
                    logger.warning(
                        "Kobo rate limit (429), waiting %ds (attempt %d/%d)",
                        wait, attempt + 1, MAX_RETRIES,
                    )
                    time.sleep(wait)
                    continue

                if resp.status_code in (401, 403):
                    logger.error(
                        "Kobo auth failure (%d) — check KOBO_API_TOKEN. "
                        "Not retrying.",
                        resp.status_code,
                    )
                    return None

                resp.raise_for_status()
                return resp.json()

            except requests.RequestException as exc:
                if attempt == MAX_RETRIES - 1:
                    logger.error(
                        "Kobo API failed after %d attempts: %s",
                        MAX_RETRIES, exc,
                    )
                    return None
                wait = BACKOFF_BASE * (2 ** attempt)
                logger.warning(
                    "Kobo API attempt %d/%d failed: %s. Retrying in %ds.",
                    attempt + 1, MAX_RETRIES, exc, wait,
                )
                time.sleep(wait)

        return None
