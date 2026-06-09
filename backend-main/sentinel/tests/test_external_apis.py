"""
Tests for sentinel external ingestion sources — reachability + payload shape.

These hit live third-party endpoints, so they are opt-in via:

    SENTINEL_RUN_EXTERNAL_IT=1 python manage.py test \
        sentinel.tests.test_external_apis -v 2

They are intended to *document* which sources are alive: known-bad responses
(ReliefWeb 403, AllAfrica 404) are asserted-and-logged rather than failing
the suite, so the matrix stays green until an upstream change needs action.
"""

import os
import unittest
import xml.etree.ElementTree as ET

import requests
from django.test import SimpleTestCase

from sentinel.ingestion import (
    ALLAFRICA_HEALTH_RSS_URL,
    GDELT_API_URL,
    RELIEFWEB_API_URL,
    RSS_HEADERS,
    WHO_NEWS_RSS_URL,
)

NASA_EONET_URL = "https://eonet.gsfc.nasa.gov/api/v3/events"

RUN_EXTERNAL = os.environ.get("SENTINEL_RUN_EXTERNAL_IT") == "1"
SKIP_REASON = "Set SENTINEL_RUN_EXTERNAL_IT=1 to hit live external APIs."


@unittest.skipUnless(RUN_EXTERNAL, SKIP_REASON)
class GdeltApiTests(SimpleTestCase):
    """GDELT Project API — tier 2 news aggregator."""

    def test_gdelt_api_reachable(self):
        """GET GDELT with a benign query returns 200 and an `articles` key."""
        params = {
            "query": "cholera africa",
            "mode": "artlist",
            "format": "json",
            "maxrecords": 5,
            "timespan": "48h",
            "sort": "datedesc",
        }
        response = requests.get(GDELT_API_URL, params=params, timeout=30)
        self.assertEqual(response.status_code, 200, response.text[:500])
        data = response.json()
        self.assertIn("articles", data)
        self.assertIsInstance(data["articles"], list)

    def test_gdelt_article_shape(self):
        """Each GDELT article carries title / url / domain / language."""
        params = {
            "query": "ebola africa",
            "mode": "artlist",
            "format": "json",
            "maxrecords": 5,
            "timespan": "7d",
            "sort": "datedesc",
        }
        response = requests.get(GDELT_API_URL, params=params, timeout=30)
        self.assertEqual(response.status_code, 200)
        articles = response.json().get("articles", [])
        if not articles:
            self.skipTest("GDELT returned zero articles for the query window.")
        required_fields = {"title", "url", "domain", "language"}
        missing = required_fields - set(articles[0].keys())
        self.assertFalse(missing, f"GDELT article missing fields: {missing}")


@unittest.skipUnless(RUN_EXTERNAL, SKIP_REASON)
class WhoNewsRssTests(SimpleTestCase):
    """WHO News RSS — tier 1 (official WHO headquarters)."""

    def test_who_news_rss_reachable(self):
        """GET WHO RSS returns 200 and the body parses as XML with items."""
        response = requests.get(WHO_NEWS_RSS_URL, headers=RSS_HEADERS, timeout=20)
        self.assertEqual(response.status_code, 200, response.text[:500])
        root = ET.fromstring(response.content)
        items = root.findall(".//item")
        self.assertGreater(len(items), 0, "WHO RSS returned an empty item list.")

    def test_who_news_item_shape(self):
        """Each WHO item has title / link / description elements."""
        response = requests.get(WHO_NEWS_RSS_URL, headers=RSS_HEADERS, timeout=20)
        self.assertEqual(response.status_code, 200)
        root = ET.fromstring(response.content)
        items = root.findall(".//item")
        if not items:
            self.skipTest("WHO RSS returned no items.")
        item = items[0]
        self.assertIsNotNone(item.find("title"), "WHO item missing <title>.")
        self.assertIsNotNone(item.find("link"), "WHO item missing <link>.")
        self.assertIsNotNone(
            item.find("description"), "WHO item missing <description>."
        )


@unittest.skipUnless(RUN_EXTERNAL, SKIP_REASON)
class AllAfricaRssTests(SimpleTestCase):
    """AllAfrica Health RSS — tier 2 African news aggregator.

    AllAfrica has intermittently returned 404 / redirect, so a non-200 is
    documented (not failed) to keep the suite green.
    """

    def test_allafrica_rss_reachable(self):
        """Document AllAfrica RSS status. 200 → parse; 4xx/5xx → skip with note."""
        response = requests.get(
            ALLAFRICA_HEALTH_RSS_URL, headers=RSS_HEADERS, timeout=20
        )
        if response.status_code != 200:
            self.skipTest(
                f"AllAfrica RSS returned HTTP {response.status_code}; "
                "source may be unavailable — see known-issues in progress.md."
            )
        root = ET.fromstring(response.content)
        rdf_ns = "http://purl.org/rss/1.0/"
        items = root.findall(f"{{{rdf_ns}}}item") or root.findall(".//item")
        self.assertGreater(len(items), 0, "AllAfrica returned an empty item list.")


@unittest.skipUnless(RUN_EXTERNAL, SKIP_REASON)
class ReliefWebApiTests(SimpleTestCase):
    """ReliefWeb API — tier 1 UN humanitarian data.

    ReliefWeb requires an approved appname; unapproved clients get HTTP 403.
    The test documents rather than fails that state.
    """

    def test_reliefweb_api_reachable(self):
        """Document ReliefWeb status. 200 → shape check; 403 → skip with note."""
        params = {
            "appname": "rw.who.int",
            "preset": "latest",
            "limit": 5,
        }
        response = requests.get(
            RELIEFWEB_API_URL,
            params=params,
            timeout=30,
            headers={
                "User-Agent": "AFRO-Sentinel-WHO/1.0 (health-surveillance)",
                "Accept": "application/json",
            },
        )
        if response.status_code == 403:
            self.skipTest(
                "ReliefWeb returned 403 Forbidden — appname not approved. "
                "See known-issues in progress.md."
            )
        self.assertEqual(response.status_code, 200, response.text[:500])
        data = response.json()
        self.assertIn("data", data)
        self.assertIsInstance(data["data"], list)


@unittest.skipUnless(RUN_EXTERNAL, SKIP_REASON)
class NasaEonetTests(SimpleTestCase):
    """NASA EONET — environmental events feed (not yet wired into ingestion)."""

    def test_nasa_eonet_reachable(self):
        """GET EONET returns 200 and an `events` key."""
        params = {"limit": 5, "days": 30}
        response = requests.get(NASA_EONET_URL, params=params, timeout=30)
        self.assertEqual(response.status_code, 200, response.text[:500])
        data = response.json()
        self.assertIn("events", data)
        self.assertIsInstance(data["events"], list)

    def test_nasa_event_shape(self):
        """Each EONET event has id / title / geometry / categories."""
        params = {"limit": 5, "days": 30}
        response = requests.get(NASA_EONET_URL, params=params, timeout=30)
        self.assertEqual(response.status_code, 200)
        events = response.json().get("events", [])
        if not events:
            self.skipTest("EONET returned zero events for the window.")
        event = events[0]
        for field in ("id", "title", "geometry", "categories"):
            self.assertIn(field, event, f"EONET event missing `{field}`.")
        self.assertIsInstance(event["geometry"], list)
        self.assertIsInstance(event["categories"], list)
