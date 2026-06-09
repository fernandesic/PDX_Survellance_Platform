"""
HDIS Unified Ingestion Pipeline
One pipeline, many adapters — pluggable source adapters for all intelligence sources.

Architecture:
    SourceAdapter (base) → fetch() → normalize() → filter() → deduplicate() → classify() → save()
    ├── RSSSourceAdapter      — WHO AFRO, Africa CDC, Global Fund, GAVI, ICRC, Health Policy Watch
    ├── RESTSourceAdapter     — ACLED, OCHA HDX, OCHA FTS
    └── (existing sentinel)   — GDELT, ReliefWeb, WHO DON, AllAfrica
"""

import hashlib
import json
import logging
import re
import requests
import xml.etree.ElementTree as ET
from abc import ABC, abstractmethod
from datetime import datetime, timedelta
from email.utils import parsedate_to_datetime
from typing import Any, Dict, List, Optional

from celery import shared_task
from django.db import DatabaseError
from django.utils import timezone

from utils.tenant_resolver import resolve_tenant
from utils.tenant_tasks import with_tenant
from sentinel.models import (
    Signal, DiseaseCategory, SignalPriority, SignalStatus, SourceTier,
)
from sentinel.disease_detector import disease_detector
from sentinel.ingestion import (
    extract_country_iso3, get_country_name, generate_hash,
    AFRO_COUNTRIES, COUNTRY_COORDS,
)
from hdis.pillar_classifier import classify_pillar, classify_pillars, SignalPillar
from hdis.source_config import SourceConfig

logger = logging.getLogger(__name__)

HTTP_HEADERS = {
    'User-Agent': 'HDIS-PRO/1.0 (WHO-AFRO-Intelligence; health-diplomacy-system)',
}


# ============================================================================
# BASE ADAPTER
# ============================================================================

class NormalizedItem:
    """A source-agnostic data item ready for processing."""

    def __init__(
        self,
        title: str,
        body: str = '',
        url: str = '',
        source_name: str = '',
        published_at: Optional[datetime] = None,
        country_hint: Optional[str] = None,
        extra: Optional[Dict[str, Any]] = None,
    ):
        self.title = title
        self.body = body
        self.url = url
        self.source_name = source_name
        self.published_at = published_at
        self.country_hint = country_hint
        self.extra = extra or {}

    @property
    def full_text(self) -> str:
        """Combined title + body for classification."""
        return f"{self.title} {self.body}".strip()

    def __repr__(self):
        return f"<NormalizedItem: {self.title[:60]}>"


class SourceAdapter(ABC):
    """
    Base adapter for all intelligence sources.
    Subclasses implement fetch() and normalize(). The pipeline handles the rest.
    """

    def __init__(self, config: SourceConfig):
        self.config = config
        self.stats = {
            'fetched': 0,
            'ingested': 0,
            'rejected': 0,
            'duplicates': 0,
            'errors': 0,
        }

    @abstractmethod
    def fetch_raw(self) -> List[Any]:
        """Fetch raw data from the source. Returns source-specific objects."""
        pass

    @abstractmethod
    def normalize(self, raw_item: Any) -> Optional[NormalizedItem]:
        """Convert a raw item into a NormalizedItem. Return None to skip."""
        pass

    def should_include(self, item: NormalizedItem) -> bool:
        """Apply keyword include/exclude filters from SourceConfig."""
        text = item.full_text.lower()

        # Keyword exclude — reject if any match
        for kw in self.config.keyword_exclude:
            if kw.lower() in text:
                return False

        # Keyword include — if configured, at least one must match
        if self.config.keyword_include:
            return any(kw.lower() in text for kw in self.config.keyword_include)

        return True

    def extract_country(self, item: NormalizedItem) -> Optional[str]:
        """Extract African country ISO3 from item text."""
        if item.country_hint and item.country_hint in AFRO_COUNTRIES:
            return item.country_hint

        iso3 = extract_country_iso3(item.full_text)
        if iso3 and iso3 in AFRO_COUNTRIES:
            return iso3
        return None

    def is_duplicate(self, item: NormalizedItem) -> bool:
        """Check if this item already exists in the database."""
        dup_hash = generate_hash(item.url or item.title)
        return Signal.objects.filter(duplicate_hash=dup_hash).exists()

    def create_signal(self, item: NormalizedItem, country_iso: str, pillar: str) -> Signal:
        """Create a Signal from a processed NormalizedItem."""
        dup_hash = generate_hash(item.url or item.title)

        # Disease detection (still useful even for non-outbreak pillars)
        disease_info = disease_detector.get_primary_disease(item.full_text)
        priority = disease_detector.classify_priority(item.full_text)

        # If not an outbreak signal, lower the priority
        if pillar != SignalPillar.OUTBREAK and priority == 'P1':
            priority = 'P2'

        # Coordinates
        lat, lng = COUNTRY_COORDS.get(country_iso, (0, 0))

        # Secondary pillars for cross-pillar signals
        all_pillars = classify_pillars(item.full_text)
        secondary = [p for p in all_pillars if p != pillar]

        return Signal.objects.create(
            signal_type='disease' if disease_info else 'hazard',
            disease_name=disease_info['name'] if disease_info else None,
            disease_category=disease_info['category'] if disease_info else DiseaseCategory.UNKNOWN,
            pillar=pillar,
            secondary_pillars=secondary,
            location_country=get_country_name(country_iso),
            location_country_iso=country_iso,
            location_lat=lat,
            location_lng=lng,
            original_text=item.full_text[:2000],
            original_language='en',
            source_name=item.source_name or self.config.name,
            source_url=item.url,
            source_tier=self.config.source_tier,
            source_type='official' if self.config.source_tier == 1 else 'media',
            source_timestamp=item.published_at,
            priority=priority,
            confidence_score=disease_info['confidence'] if disease_info else 65,
            status=SignalStatus.NEW,
            ingestion_source=self.config.slug,
            duplicate_hash=dup_hash,
            raw_payload=item.extra if item.extra else None,
            tenant=resolve_tenant(iso=country_iso),
        )

    def run(self) -> Dict[str, int]:
        """
        Execute the full pipeline:
        fetch → normalize → filter → deduplicate → classify → save
        """
        logger.info(f"[{self.config.slug}] Starting ingestion from {self.config.name}")

        try:
            raw_items = self.fetch_raw()
            self.stats['fetched'] = len(raw_items)
        except (requests.RequestException, json.JSONDecodeError, ET.ParseError,
                AttributeError, KeyError, ValueError, TypeError) as e:
            logger.exception(f"[{self.config.slug}] Fetch failed: {e}")
            self.config.last_error = str(e)[:500]
            self.config.save(update_fields=['last_error'])
            return self.stats

        for raw in raw_items:
            try:
                # Normalize
                item = self.normalize(raw)
                if item is None:
                    self.stats['rejected'] += 1
                    continue

                # Filter
                if not self.should_include(item):
                    self.stats['rejected'] += 1
                    continue

                # Extract country
                country_iso = self.extract_country(item)
                if self.config.require_africa and not country_iso:
                    self.stats['rejected'] += 1
                    continue

                # Use a generic country code if Africa not required but no country found
                if not country_iso:
                    country_iso = 'AFR'

                # Deduplicate
                if self.is_duplicate(item):
                    self.stats['duplicates'] += 1
                    continue

                # Classify pillar
                pillar = classify_pillar(item.full_text)
                if pillar == SignalPillar.OUTBREAK and self.config.default_pillar != SignalPillar.OUTBREAK:
                    # If classifier defaults to outbreak but source has a specific pillar, use source default
                    all_pillars = classify_pillars(item.full_text)
                    if len(all_pillars) == 1 and all_pillars[0] == SignalPillar.OUTBREAK:
                        pillar = self.config.default_pillar

                # Save
                signal = self.create_signal(item, country_iso, pillar)
                self.stats['ingested'] += 1

            except (DatabaseError, AttributeError, KeyError, ValueError, TypeError) as e:
                logger.exception(f"[{self.config.slug}] Error processing item: {e}")
                self.stats['errors'] += 1

        # Update config stats
        self.config.last_polled_at = timezone.now()
        self.config.last_error = ''
        self.config.total_ingested += self.stats['ingested']
        self.config.total_rejected += self.stats['rejected']
        self.config.total_duplicates += self.stats['duplicates']
        self.config.save(update_fields=[
            'last_polled_at', 'last_error',
            'total_ingested', 'total_rejected', 'total_duplicates',
        ])

        logger.info(
            f"[{self.config.slug}] Done: "
            f"fetched={self.stats['fetched']}, ingested={self.stats['ingested']}, "
            f"rejected={self.stats['rejected']}, duplicates={self.stats['duplicates']}"
        )
        return self.stats


# ============================================================================
# RSS ADAPTER — handles ALL RSS/Atom feeds
# ============================================================================

class RSSSourceAdapter(SourceAdapter):
    """
    Generic RSS/Atom feed adapter.
    Handles: WHO AFRO, Africa CDC, Global Fund, GAVI, ICRC, Health Policy Watch, UN News
    Configure via SourceConfig — no code changes needed for new RSS sources.
    """

    def fetch_raw(self) -> List[Any]:
        """Fetch and parse RSS/Atom XML."""
        response = requests.get(
            self.config.url,
            headers=HTTP_HEADERS,
            timeout=30,
        )
        response.raise_for_status()

        root = ET.fromstring(response.content)

        # Detect RSS vs Atom
        items = []
        # RSS 2.0: <rss><channel><item>
        for item in root.findall('.//item'):
            items.append(('rss', item))

        # Atom: <feed><entry>
        if not items:
            ns = {'atom': 'http://www.w3.org/2005/Atom'}
            for entry in root.findall('.//atom:entry', ns):
                items.append(('atom', entry))

        # RDF/RSS 1.0: <rdf:RDF><item>
        if not items:
            ns_rdf = {
                'rdf': 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
                'rss1': 'http://purl.org/rss/1.0/',
            }
            for item in root.findall('.//rss1:item', ns_rdf):
                items.append(('rdf', item))

        # Fallback: try without namespace
        if not items:
            for item in root.iter():
                if item.tag.endswith('item') or item.tag.endswith('entry'):
                    items.append(('generic', item))

        return items

    def normalize(self, raw_item: Any) -> Optional[NormalizedItem]:
        """Extract title, body, url, date from RSS/Atom item."""
        fmt, elem = raw_item

        title = self._get_text(elem, ['title'])
        if not title:
            return None

        body = self._get_text(elem, ['description', 'summary', 'content', 'content:encoded'])
        # Strip HTML tags from body
        if body:
            body = re.sub(r'<[^>]+>', ' ', body).strip()
            body = re.sub(r'\s+', ' ', body)

        url = ''
        if fmt == 'atom':
            link_elem = elem.find('{http://www.w3.org/2005/Atom}link')
            if link_elem is not None:
                url = link_elem.get('href', '')
        else:
            url = self._get_text(elem, ['link', 'guid']) or ''

        # Parse pub date
        pub_date = None
        date_str = self._get_text(elem, ['pubDate', 'published', 'updated', 'dc:date', 'date'])
        if date_str:
            pub_date = self._parse_date(date_str)

        return NormalizedItem(
            title=title.strip(),
            body=body[:3000] if body else '',
            url=url.strip(),
            source_name=self.config.name,
            published_at=pub_date,
        )

    def _get_text(self, elem: ET.Element, tag_names: List[str]) -> Optional[str]:
        """Try multiple tag names, return first found text."""
        for tag in tag_names:
            # Try direct child
            child = elem.find(tag)
            if child is not None and child.text:
                return child.text

            # Try with common namespaces
            for ns_prefix in [
                '{http://purl.org/dc/elements/1.1/}',
                '{http://www.w3.org/2005/Atom}',
                '{http://purl.org/rss/1.0/modules/content/}',
            ]:
                child = elem.find(f'{ns_prefix}{tag}')
                if child is not None and child.text:
                    return child.text
        return None

    def _parse_date(self, date_str: str) -> Optional[datetime]:
        """Parse various date formats from RSS/Atom feeds."""
        try:
            return parsedate_to_datetime(date_str)
        except (TypeError, ValueError):
            # Malformed RFC-2822 date — fall through to ISO 8601 parse below
            pass

        # ISO 8601
        for fmt in [
            '%Y-%m-%dT%H:%M:%S%z',
            '%Y-%m-%dT%H:%M:%SZ',
            '%Y-%m-%d %H:%M:%S',
            '%Y-%m-%d',
        ]:
            try:
                dt = datetime.strptime(date_str.strip(), fmt)
                if dt.tzinfo is None:
                    return timezone.make_aware(dt)
                return dt
            except ValueError:
                continue
        return None


# ============================================================================
# REST API ADAPTER — handles ACLED, OCHA, etc.
# ============================================================================

class RESTSourceAdapter(SourceAdapter):
    """
    Generic REST API adapter for structured data sources.
    Subclass for specific APIs (ACLED, OCHA) that need custom normalization.
    """

    def fetch_raw(self) -> List[Any]:
        """Fetch JSON from a REST API endpoint."""
        headers = {**HTTP_HEADERS}
        if self.config.auth_header:
            headers['Authorization'] = self.config.auth_header

        params = dict(self.config.extra_params) if self.config.extra_params else {}

        response = requests.get(
            self.config.url,
            headers=headers,
            params=params,
            timeout=60,
        )
        response.raise_for_status()

        data = response.json()

        # Handle paginated responses — look for common patterns
        if isinstance(data, list):
            return data
        if 'data' in data:
            return data['data']
        if 'results' in data:
            return data['results']
        return [data]

    def normalize(self, raw_item: Any) -> Optional[NormalizedItem]:
        """Normalize JSON items — handles WordPress and flat JSON APIs."""
        if not isinstance(raw_item, dict):
            return None

        # Handle WordPress JSON format: {title: {rendered: '...'}}
        title_raw = raw_item.get('title', raw_item.get('name', ''))
        if isinstance(title_raw, dict):
            title = title_raw.get('rendered', '')
        else:
            title = str(title_raw)
        if not title:
            return None

        # Strip HTML entities and tags from title
        title = re.sub(r'<[^>]+>', '', title).strip()
        title = title.replace('&#8211;', '–').replace('&#8217;', "'").replace('&amp;', '&')

        # Handle WordPress content/excerpt
        body_raw = raw_item.get('excerpt', raw_item.get('content',
                   raw_item.get('description', raw_item.get('notes', ''))))
        if isinstance(body_raw, dict):
            body = body_raw.get('rendered', '')
        else:
            body = str(body_raw) if body_raw else ''
        # Strip HTML tags from body
        if body:
            body = re.sub(r'<[^>]+>', ' ', body).strip()
            body = re.sub(r'\s+', ' ', body)

        # WordPress uses 'link', other APIs use 'url'
        url = raw_item.get('link', raw_item.get('url', ''))

        # Parse date
        pub_date = None
        date_str = raw_item.get('date', raw_item.get('modified', ''))
        if date_str:
            try:
                from django.utils import timezone as tz
                dt = datetime.strptime(date_str[:19], '%Y-%m-%dT%H:%M:%S')
                pub_date = tz.make_aware(dt)
            except (ValueError, TypeError):
                pass

        return NormalizedItem(
            title=title[:500],
            body=body[:3000] if body else '',
            url=str(url) if url else '',
            source_name=self.config.name,
            published_at=pub_date,
            extra=raw_item,
        )


# ============================================================================
# ACLED ADAPTER — Conflict & Healthcare Attacks in Africa
# ============================================================================

class ACLEDSourceAdapter(SourceAdapter):
    """
    Dedicated adapter for ACLED (Armed Conflict Location & Event Data).
    Fetches events where healthcare facilities or workers are targeted.
    """

    ACLED_API_URL = 'https://api.acleddata.com/acdata/read'

    def fetch_raw(self) -> List[Any]:
        """Fetch conflict events from ACLED API filtered for health-related targets."""
        params = {
            'limit': self.config.extra_params.get('limit', 100),
            'region': 1,  # Africa
            'event_date': f"{(datetime.utcnow() - timedelta(days=7)).strftime('%Y-%m-%d')}|{datetime.utcnow().strftime('%Y-%m-%d')}",
            'event_date_where': 'BETWEEN',
        }

        # Add API key/email from auth_header (format: "key:email")
        if self.config.auth_header:
            parts = self.config.auth_header.split(':')
            if len(parts) == 2:
                params['key'] = parts[0].strip()
                params['email'] = parts[1].strip()

        # Merge extra params from config
        params.update({
            k: v for k, v in (self.config.extra_params or {}).items()
            if k != 'limit'
        })

        response = requests.get(
            self.ACLED_API_URL,
            params=params,
            headers=HTTP_HEADERS,
            timeout=60,
        )
        response.raise_for_status()

        data = response.json()
        return data.get('data', [])

    def normalize(self, raw_item: Any) -> Optional[NormalizedItem]:
        """Normalize ACLED event into a NormalizedItem."""
        if not isinstance(raw_item, dict):
            return None

        event_type = raw_item.get('event_type', '')
        sub_event = raw_item.get('sub_event_type', '')
        notes = raw_item.get('notes', '')
        actor1 = raw_item.get('actor1', '')
        actor2 = raw_item.get('actor2', '')
        location = raw_item.get('location', '')
        country = raw_item.get('country', '')
        fatalities = raw_item.get('fatalities', 0)

        # Build descriptive title
        title = f"{event_type}: {sub_event}" if sub_event else event_type
        if location and country:
            title += f" in {location}, {country}"
        if fatalities and int(fatalities) > 0:
            title += f" ({fatalities} fatalities)"

        # Parse date
        pub_date = None
        date_str = raw_item.get('event_date', '')
        if date_str:
            try:
                pub_date = timezone.make_aware(datetime.strptime(date_str, '%Y-%m-%d'))
            except (ValueError, TypeError):
                pass

        # Extract country ISO
        country_iso = raw_item.get('iso', None)
        if country_iso and isinstance(country_iso, (int, str)):
            country_iso = str(country_iso)
            # ACLED uses ISO numeric — we need ISO3
            country_iso = extract_country_iso3(country) if country else None

        return NormalizedItem(
            title=title,
            body=notes[:3000] if notes else '',
            url=f"https://acleddata.com/data-export-tool/?event_id={raw_item.get('data_id', '')}",
            source_name='ACLED',
            published_at=pub_date,
            country_hint=country_iso,
            extra={
                'event_type': event_type,
                'sub_event_type': sub_event,
                'actor1': actor1,
                'actor2': actor2,
                'fatalities': fatalities,
                'latitude': raw_item.get('latitude'),
                'longitude': raw_item.get('longitude'),
                'data_id': raw_item.get('data_id'),
            },
        )


# ============================================================================
# ADAPTER REGISTRY
# ============================================================================

ADAPTER_MAP = {
    'rss': RSSSourceAdapter,
    'rest_api': RESTSourceAdapter,
    'acled': ACLEDSourceAdapter,
}


def get_adapter(config: SourceConfig) -> SourceAdapter:
    """Get the appropriate adapter for a SourceConfig."""
    adapter_class = ADAPTER_MAP.get(config.source_type)
    if not adapter_class:
        raise ValueError(f"No adapter registered for source type: {config.source_type}")
    return adapter_class(config)


# ============================================================================
# CELERY TASKS
# ============================================================================

@shared_task
@with_tenant('0')
def ingest_source(source_slug: str) -> Dict[str, int]:
    """Ingest from a single configured source."""
    try:
        config = SourceConfig.objects.get(slug=source_slug, is_active=True)
    except SourceConfig.DoesNotExist:
        logger.warning(f"Source config not found or inactive: {source_slug}")
        return {}

    adapter = get_adapter(config)
    return adapter.run()


@shared_task
@with_tenant('0')
def ingest_all_sources() -> Dict[str, Dict[str, int]]:
    """Run ingestion across all active sources that are due for polling."""
    results = {}
    now = timezone.now()

    active_sources = SourceConfig.objects.filter(is_active=True)
    for config in active_sources:
        # Check if due for polling
        if config.last_polled_at:
            next_poll = config.last_polled_at + timedelta(minutes=config.poll_interval_minutes)
            if now < next_poll:
                continue

        try:
            adapter = get_adapter(config)
            results[config.slug] = adapter.run()
        except (DatabaseError, ImportError, AttributeError,
                requests.RequestException, ValueError, TypeError) as e:
            logger.exception(f"Failed to ingest from {config.slug}: {e}")
            results[config.slug] = {'error': str(e)}

    logger.info(f"Ingestion complete for {len(results)} sources")
    return results
