"""
AFRO Sentinel - Live Data Ingestion Service
Fetches real-time disease signals from:
1. GDELT Project API (news articles)
2. ReliefWeb API (UN humanitarian reports)
3. WHO DON (Disease Outbreak News)

Based on AFRO-SENTINEL's ingest-signals Supabase function.
"""

import hashlib
import json
import logging
import re
import requests
import time
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta
from email.utils import parsedate_to_datetime
from typing import Dict, List, Optional, Any
from urllib.parse import urlencode

from celery import shared_task
from django.db import DatabaseError
from django.utils import timezone

# Errors we expect from an external feed fetch: HTTP transport, JSON/XML
# parsing, response shape, and any DB insert downstream. Caught at the
# fetch-and-ingest boundary so one bad feed doesn't kill the periodic job.
_INGEST_ERRORS = (
    requests.RequestException,
    json.JSONDecodeError,
    ET.ParseError,
    DatabaseError,
    AttributeError,
    KeyError,
    TypeError,
    ValueError,
)

from sentinel.models import Signal, DiseaseKeyword, SignalPriority, SignalStatus, DiseaseCategory
from sentinel.noise_filter import noise_filter
from sentinel.disease_detector import disease_detector
from sentinel.epi_extractor import extract_epi_numbers
from utils.tenant_resolver import resolve_tenant
from utils.tenant_tasks import with_tenant

# Classify signals into HDIS pillars (policy, funding, vaccine, etc.)
try:
    from hdis.pillar_classifier import classify_pillar
    HAS_PILLAR_CLASSIFIER = True
except ImportError:
    HAS_PILLAR_CLASSIFIER = False


def _classify_signal_pillar(text: str) -> str:
    """Classify signal text into an HDIS pillar. Falls back to 'outbreak' if unavailable."""
    if HAS_PILLAR_CLASSIFIER:
        try:
            return classify_pillar(text)
        except (ImportError, AttributeError, ValueError, RuntimeError) as e:
            logger.debug("pillar classify fell back to default: %s", e)
            return 'outbreak'
    return 'outbreak'

logger = logging.getLogger(__name__)

# ============================================================================
# CONFIGURATION
# ============================================================================

GDELT_API_URL = "https://api.gdeltproject.org/api/v2/doc/doc"
RELIEFWEB_API_URL = "https://api.reliefweb.int/v2/reports"
WHO_NEWS_RSS_URL = "https://www.who.int/rss-feeds/news-english.xml"
ALLAFRICA_HEALTH_RSS_URL = "https://allafrica.com/tools/headlines/rdf/health/headlines.rdf"

RSS_HEADERS = {'User-Agent': 'Mozilla/5.0 AFRO-Sentinel-WHO/1.0 (health-surveillance)'}

# African countries (ISO3)
AFRO_COUNTRIES = {
    "AGO", "BEN", "BWA", "BFA", "BDI", "CPV", "CMR", "CAF", "TCD", "COM", "COG", "CIV", "COD",
    "GNQ", "ERI", "ETH", "GAB", "GMB", "GHA", "GIN", "GNB", "KEN", "LSO", "LBR", "MDG", "MWI",
    "MLI", "MRT", "MUS", "MOZ", "NAM", "NER", "NGA", "RWA", "STP", "SEN", "SYC", "SLE", "ZAF",
    "SSD", "TZA", "TGO", "UGA", "ZMB", "ZWE", "DZA", "TUN", "LBY", "MAR", "SWZ"
}

# Country name to ISO3 mapping
COUNTRY_NAME_TO_ISO3 = {
    "angola": "AGO", "benin": "BEN", "botswana": "BWA", "burkina faso": "BFA",
    "burundi": "BDI", "cabo verde": "CPV", "cape verde": "CPV", "cameroon": "CMR",
    "central african republic": "CAF", "chad": "TCD", "comoros": "COM", "congo": "COG",
    "cote d'ivoire": "CIV", "ivory coast": "CIV", "democratic republic of the congo": "COD",
    "dr congo": "COD", "drc": "COD", "equatorial guinea": "GNQ", "eritrea": "ERI",
    "ethiopia": "ETH", "gabon": "GAB", "gambia": "GMB", "ghana": "GHA", "guinea": "GIN",
    "guinea-bissau": "GNB", "kenya": "KEN", "lesotho": "LSO", "liberia": "LBR",
    "madagascar": "MDG", "malawi": "MWI", "mali": "MLI", "mauritania": "MRT",
    "mauritius": "MUS", "mozambique": "MOZ", "namibia": "NAM", "niger": "NER",
    "nigeria": "NGA", "rwanda": "RWA", "sao tome and principe": "STP", "senegal": "SEN",
    "seychelles": "SYC", "sierra leone": "SLE", "south africa": "ZAF", "south sudan": "SSD",
    "tanzania": "TZA", "togo": "TGO", "uganda": "UGA", "zambia": "ZMB", "zimbabwe": "ZWE",
    "algeria": "DZA", "tunisia": "TUN", "libya": "LBY", "morocco": "MAR", "eswatini": "SWZ",
    "swaziland": "SWZ"
}

# Pre-sorted by name length (descending) to prevent substring collisions.
# 'nigeria' is checked before 'niger', 'guinea-bissau' before 'guinea', etc.
_COUNTRY_NAMES_BY_LENGTH = sorted(
    COUNTRY_NAME_TO_ISO3.items(), key=lambda x: len(x[0]), reverse=True
)

# Country coordinates for mapping
COUNTRY_COORDS = {
    "NGA": (9.082, 8.6753), "KEN": (-0.0236, 37.9062), "ZAF": (-30.5595, 22.9375),
    "ETH": (9.145, 40.4897), "COD": (-4.0383, 21.7587), "GHA": (7.9465, -1.0232),
    "TZA": (-6.369, 34.8888), "UGA": (1.3733, 32.2903), "RWA": (-1.9403, 29.8739),
    "SEN": (14.4974, -14.4524), "MOZ": (-18.6657, 35.5296), "ZMB": (-13.1339, 27.8493),
    "ZWE": (-19.0154, 29.1549), "MWI": (-13.2543, 34.3015), "AGO": (-11.2027, 17.8739),
    "CMR": (7.3697, 12.3547), "CIV": (7.54, -5.5471), "MLI": (17.5707, -3.9962),
    "NER": (17.6078, 8.0817), "BFA": (12.2383, -1.5616), "DZA": (28.0339, 1.6596),
    "MAR": (31.7917, -7.0926), "TUN": (33.8869, 9.5375), "LBY": (26.3351, 17.2283),
    "SSD": (6.877, 31.307),
    # Previously missing countries — now all 50 AFRO countries have coordinates
    "BEN": (9.3077, 2.3158), "BWA": (-22.3285, 24.6849), "BDI": (-3.3731, 29.9189),
    "CPV": (16.0021, -24.0132), "CAF": (6.6111, 20.9394), "TCD": (15.4542, 18.7322),
    "COM": (-11.6455, 43.3333), "COG": (-0.228, 15.8277), "GNQ": (1.6508, 10.2679),
    "ERI": (15.1794, 39.7823), "GAB": (-0.8037, 11.6094), "GMB": (13.4432, -15.3101),
    "GIN": (9.9456, -9.6966), "GNB": (11.8037, -15.1804), "LSO": (-29.6100, 28.2336),
    "LBR": (6.4281, -9.4295), "MDG": (-18.7669, 46.8691), "MRT": (21.0079, -10.9408),
    "MUS": (-20.3484, 57.5522), "NAM": (-22.9576, 18.4904), "STP": (0.1864, 6.6131),
    "SYC": (-4.6796, 55.492), "SLE": (8.4606, -11.7799), "SWZ": (-26.5225, 31.4659),
    "TGO": (8.6195, 0.8248),
}



_TENANT_CACHE: Dict[str, int] = {}

def _get_tenant_id(country_iso: Optional[str]) -> Optional[int]:
    """Look up the tenant_id for a country ISO3 code from account_tenant.
    Falls back to the WHO AFRO Continental tenant (id=1) for region-level signals.
    Results are cached in-memory for the duration of the ingestion run."""
    if not country_iso:
        return 1  # WHO AFRO Continental
    if country_iso in _TENANT_CACHE:
        return _TENANT_CACHE[country_iso]
    from django.db import connection
    cursor = connection.cursor()
    cursor.execute("SELECT id FROM account_tenant WHERE iso_code = %s LIMIT 1", [country_iso])
    row = cursor.fetchone()
    tid = row[0] if row else 1  # fallback to continental
    _TENANT_CACHE[country_iso] = tid
    return tid


def generate_hash(text: str) -> str:
    """Generate a hash for deduplication."""
    return hashlib.md5(text.encode()).hexdigest()[:16]


def extract_country_iso3(text: str) -> Optional[str]:
    """Extract African country ISO3 code from text.

    Matches longer country names first to prevent substring collisions
    (e.g. 'niger' matching inside 'nigeria', 'guinea' inside 'guinea-bissau').

    Uses _COUNTRY_NAMES_BY_LENGTH (pre-sorted at module level) to avoid
    re-sorting on every call.
    """
    lower_text = text.lower()
    for name, iso3 in _COUNTRY_NAMES_BY_LENGTH:
        if name in lower_text:
            return iso3
    return None


def get_country_name(iso3: str) -> str:
    """Get country name from ISO3 code."""
    for name, code in COUNTRY_NAME_TO_ISO3.items():
        if code == iso3:
            return name.title()
    return iso3


# ============================================================================
# GDELT INGESTION
# ============================================================================

@shared_task
@with_tenant('0')
def ingest_from_gdelt(max_records: int = 50) -> Dict[str, Any]:
    """
    Fetch and ingest signals from GDELT Project API.
    This is the same API that AFRO-SENTINEL uses.
    """
    # Combined queries to avoid GDELT rate limits (HTTP 429)
    queries = [
        '(cholera OR ebola OR measles OR meningitis OR malaria) (africa OR african OR nigeria OR kenya OR ethiopia OR congo OR tanzania OR uganda OR ghana OR senegal OR morocco)',
        '("yellow fever" OR mpox OR polio OR outbreak OR epidemic) (africa OR african OR nigeria OR kenya OR ethiopia OR congo OR tanzania OR uganda OR ghana OR senegal OR morocco)'
    ]
    
    stats = {"fetched": 0, "ingested": 0, "rejected": 0, "duplicates": 0}
    
    for query in queries:
        try:
            params = {
                "query": query,
                "mode": "artlist",
                "format": "json",
                "maxrecords": 15,
                "timespan": "48h",
                "sort": "datedesc"
            }
            
            response = requests.get(GDELT_API_URL, params=params, timeout=30)
            
            if response.status_code != 200:
                logger.warning(f"GDELT failed for query: {response.status_code}")
                continue
            
            data = response.json()
            articles = data.get("articles", [])
            stats["fetched"] += len(articles)
            
            for article in articles:
                title = article.get("title", "")
                url = article.get("url", "")
                
                if not title:
                    continue
                
                # Extract country from title, domain, or source country metadata
                country_iso = extract_country_iso3(title)
                if not country_iso:
                    # Try article's source country field
                    src_country = article.get("sourcecountry", "")
                    if src_country:
                        country_iso = extract_country_iso3(src_country)
                if not country_iso:
                    # Try the domain name for African news sites
                    domain = article.get("domain", "")
                    country_iso = extract_country_iso3(domain)
                if not country_iso or country_iso not in AFRO_COUNTRIES:
                    stats["rejected"] += 1
                    continue
                
                # Apply noise filter
                filter_result = noise_filter.filter_signal(title, country_iso)
                if not filter_result["pass"]:
                    stats["rejected"] += 1
                    logger.debug(f"Noise filter rejected: {filter_result['reason']}")
                    continue
                
                # Check for duplicates
                dup_hash = generate_hash(url or title)
                if Signal.objects.filter(duplicate_hash=dup_hash).exists():
                    stats["duplicates"] += 1
                    continue
                
                # Detect disease
                disease_info = disease_detector.get_primary_disease(title)
                priority = disease_detector.classify_priority(title)
                
                # Classify pillar (policy, funding, vaccine, etc.)
                pillar = _classify_signal_pillar(title)
                
                # Get coordinates
                lat, lng = COUNTRY_COORDS.get(country_iso, (0, 0))
                
                # Extract epi numbers (cases/deaths) from text
                epi = extract_epi_numbers(title)

                # Create signal
                Signal.objects.create(
                    tenant_id=_get_tenant_id(country_iso),
                    signal_type='disease' if disease_info else 'hazard',
                    disease_name=disease_info['name'] if disease_info else None,
                    disease_category=disease_info['category'] if disease_info else DiseaseCategory.UNKNOWN,
                    pillar=pillar,
                    location_country=get_country_name(country_iso),
                    location_country_iso=country_iso,
                    location_lat=lat,
                    location_lng=lng,
                    original_text=title[:2000],
                    original_language=article.get("language", "en"),
                    source_name=article.get("domain", "GDELT"),
                    source_url=url,
                    source_tier=2,  # GDELT is tier 2 (news media)
                    priority=priority,
                    confidence_score=disease_info['confidence'] if disease_info else 65,
                    status=SignalStatus.NEW,
                    ingestion_source='GDELT-V2',
                    duplicate_hash=dup_hash,
                    reported_cases=epi['cases'],
                    reported_deaths=epi['deaths'],
                    tenant=resolve_tenant(iso=country_iso),
                )
                stats["ingested"] += 1
            
        except _INGEST_ERRORS as e:
            logger.exception("GDELT error: %s", e)
        
        # Rate limit: wait 5 seconds between queries to avoid 429
        time.sleep(5)
    
    logger.info(f"GDELT ingestion complete: {stats}")
    return stats


# ============================================================================
# RELIEFWEB INGESTION
# ============================================================================

@shared_task
@with_tenant('0')
def ingest_from_reliefweb(limit: int = 30) -> Dict[str, Any]:
    """
    Fetch and ingest signals from ReliefWeb API.
    ReliefWeb is TIER 1 (official UN humanitarian data).
    """
    stats = {"fetched": 0, "ingested": 0, "rejected": 0, "duplicates": 0}
    
    try:
        params = {
            "appname": "who-afro-sentinel",
            "preset": "latest",
            "limit": limit
        }
        
        response = requests.get(RELIEFWEB_API_URL, params=params, timeout=30, headers={
            'User-Agent': 'AFRO-Sentinel-WHO/1.0 (health-surveillance)',
            'Accept': 'application/json'
        })
        
        if response.status_code in (403, 410):
            logger.warning("ReliefWeb failed: %s (requires approved appname — request one at https://apidoc.reliefweb.int). Skipping.", response.status_code)
            return stats
            
        if response.status_code != 200:
            logger.warning(f"ReliefWeb failed: {response.status_code}")
            return stats
        
        data = response.json()
        reports = data.get("data", [])
        stats["fetched"] = len(reports)
        
        for report in reports:
            fields = report.get("fields", {})
            title = fields.get("title", "")
            country = fields.get("primary_country", {})
            country_iso = country.get("iso3", "")
            
            if not title or not country_iso:
                continue
            
            # Only African countries
            if country_iso not in AFRO_COUNTRIES:
                stats["rejected"] += 1
                continue
            
            # Check for health-related content
            body = fields.get("body", "") or ""
            full_text = f"{title} {body[:500]}"
            
            health_keywords = ["health", "disease", "outbreak", "epidemic", "cholera", 
                              "malaria", "fever", "hospital", "death", "cases", "humanitarian"]
            has_health = any(kw in full_text.lower() for kw in health_keywords)
            
            if not has_health:
                stats["rejected"] += 1
                continue
            
            # Check duplicates
            report_url = fields.get("url", "") or f"reliefweb-{report.get('id', '')}"
            dup_hash = generate_hash(report_url)
            if Signal.objects.filter(duplicate_hash=dup_hash).exists():
                stats["duplicates"] += 1
                continue
            
            # Detect disease
            disease_info = disease_detector.get_primary_disease(full_text)
            priority = disease_detector.classify_priority(full_text)
            
            # Get coordinates
            lat, lng = COUNTRY_COORDS.get(country_iso, (0, 0))
            
            # Classify pillar
            pillar = _classify_signal_pillar(full_text)
            
            # Extract epi numbers
            epi = extract_epi_numbers(full_text)

            # Create signal - ReliefWeb is TIER 1 (official UN)
            Signal.objects.create(
                tenant_id=_get_tenant_id(country_iso),
                signal_type='disease' if disease_info else 'hazard',
                disease_name=disease_info['name'] if disease_info else None,
                disease_category=disease_info['category'] if disease_info else DiseaseCategory.UNKNOWN,
                pillar=pillar,
                location_country=country.get("name", get_country_name(country_iso)),
                location_country_iso=country_iso,
                location_lat=lat,
                location_lng=lng,
                original_text=title[:2000],
                original_language="en",
                source_name="ReliefWeb",
                source_url=report_url,
                source_tier=1,  # ReliefWeb is TIER 1 (official UN)
                priority=priority,
                confidence_score=disease_info['confidence'] if disease_info else 80,
                status=SignalStatus.NEW,
                ingestion_source='RELIEFWEB',
                duplicate_hash=dup_hash,
                reported_cases=epi['cases'],
                reported_deaths=epi['deaths'],
                tenant=resolve_tenant(iso=country_iso),
            )
            stats["ingested"] += 1
            
    except _INGEST_ERRORS as e:
        logger.exception("ReliefWeb error: %s", e)
    
    logger.info(f"ReliefWeb ingestion complete: {stats}")
    return stats


# ============================================================================
# WHO NEWS RSS INGESTION (Tier 1)
# ============================================================================

@shared_task
@with_tenant('0')
def ingest_from_who_news(max_records: int = 25) -> Dict[str, Any]:
    """
    Fetch and ingest signals from WHO News RSS feed.
    WHO News is TIER 1 — official WHO headquarters announcements.
    URL: https://www.who.int/rss-feeds/news-english.xml
    """
    stats = {"fetched": 0, "ingested": 0, "rejected": 0, "duplicates": 0}

    try:
        response = requests.get(WHO_NEWS_RSS_URL, headers=RSS_HEADERS, timeout=20)
        if response.status_code != 200:
            logger.warning(f"WHO News RSS failed: {response.status_code}")
            return stats

        root = ET.fromstring(response.content)
        items = root.findall('.//item')
        stats["fetched"] = len(items)

        for item in items[:max_records]:
            title_el = item.find('title')
            link_el = item.find('link')
            desc_el = item.find('description')
            pubdate_el = item.find('pubDate')

            title = title_el.text.strip() if title_el is not None and title_el.text else ''
            url = link_el.text.strip() if link_el is not None and link_el.text else ''
            description = desc_el.text.strip() if desc_el is not None and desc_el.text else ''

            if not title:
                continue

            full_text = f"{title} {description[:300]}"

            # Check for AFRO relevance — WHO news is global, filter for Africa
            country_iso = extract_country_iso3(full_text)
            has_africa_term = any(t in full_text.lower() for t in [
                'africa', 'african', 'afro', 'sub-saharan',
                'sahel', 'west africa', 'east africa', 'southern africa',
                'central africa', 'horn of africa',
            ])

            # Apply noise filter against the full text (title + description),
            # not just the title — African country names and outbreak keywords
            # often appear only in the description blurb.
            filter_result = noise_filter.filter_signal(full_text)
            if not filter_result["pass"] and filter_result["reason"] not in ('non_african_focus', 'missing_outbreak_indicators'):
                stats["rejected"] += 1
                continue

            # For WHO Tier 1, if there's no country ISO, use the Africa focus check
            if not country_iso and not has_africa_term:
                stats["rejected"] += 1
                continue

            # Dedup
            dup_hash = generate_hash(url or title)
            if Signal.objects.filter(duplicate_hash=dup_hash).exists():
                stats["duplicates"] += 1
                continue

            # Detect disease
            disease_info = disease_detector.get_primary_disease(full_text)
            priority = disease_detector.classify_priority(full_text)

            # Parse published date
            pub_date = None
            if pubdate_el is not None and pubdate_el.text:
                try:
                    pub_date = parsedate_to_datetime(pubdate_el.text)
                except (TypeError, ValueError):
                    # Malformed pubDate — leave as None and continue
                    pass

            # Coordinates
            lat, lng = COUNTRY_COORDS.get(country_iso, (0, 0)) if country_iso else (0, 0)

            # Classify pillar
            pillar = _classify_signal_pillar(title)

            # Extract epi numbers
            epi = extract_epi_numbers(full_text)

            Signal.objects.create(
                tenant_id=_get_tenant_id(country_iso),
                signal_type='disease' if disease_info else 'health_system',
                disease_name=disease_info['name'] if disease_info else None,
                disease_category=disease_info['category'] if disease_info else DiseaseCategory.UNKNOWN,
                pillar=pillar,
                location_country=get_country_name(country_iso) if country_iso else 'Africa Region',
                location_country_iso=country_iso or 'AFR',
                location_lat=lat,
                location_lng=lng,
                original_text=title[:2000],
                original_language='en',
                source_name='WHO News',
                source_url=url,
                source_tier=1,  # WHO is TIER 1
                priority=priority,
                confidence_score=disease_info['confidence'] if disease_info else 90,
                status=SignalStatus.NEW,
                ingestion_source='WHO-NEWS',
                duplicate_hash=dup_hash,
                reported_cases=epi['cases'],
                reported_deaths=epi['deaths'],
                tenant=resolve_tenant(iso=country_iso or 'AFR'),
            )
            stats["ingested"] += 1

    except _INGEST_ERRORS as e:
        logger.exception("WHO News RSS error: %s", e)

    logger.info(f"WHO News ingestion complete: {stats}")
    return stats


# ============================================================================
# ALLAFRICA RSS INGESTION (Tier 2)
# ============================================================================

@shared_task
@with_tenant('0')
def ingest_from_allafrica(max_records: int = 30) -> Dict[str, Any]:
    """
    Fetch and ingest signals from AllAfrica Health RSS.
    AllAfrica is the largest African news aggregator — TIER 2.
    URL: https://allafrica.com/tools/headlines/rdf/health/headlines.rdf
    """
    stats = {"fetched": 0, "ingested": 0, "rejected": 0, "duplicates": 0}

    try:
        response = requests.get(ALLAFRICA_HEALTH_RSS_URL, headers=RSS_HEADERS, timeout=20)
        if response.status_code != 200:
            logger.warning(f"AllAfrica RSS failed: {response.status_code}")
            return stats

        root = ET.fromstring(response.content)

        # AllAfrica uses RDF format — items have namespace
        RDF_NS = 'http://purl.org/rss/1.0/'
        DC_NS = 'http://purl.org/dc/elements/1.1/'
        items = root.findall(f'{{{RDF_NS}}}item') or root.findall('.//item')
        stats["fetched"] = len(items)

        for item in items[:max_records]:
            # Try namespaced then plain
            title_el = item.find(f'{{{RDF_NS}}}title') or item.find('title')
            link_el = item.find(f'{{{RDF_NS}}}link') or item.find('link')
            desc_el = item.find(f'{{{RDF_NS}}}description') or item.find('description')

            title = title_el.text.strip() if title_el is not None and title_el.text else ''
            url = link_el.text.strip() if link_el is not None and link_el.text else ''
            description = desc_el.text.strip() if desc_el is not None and desc_el.text else ''

            if not title:
                continue

            # AllAfrica titles are like "Nigeria: Lassa Fever Kills 30"
            # Extract country from the "Country: " prefix
            country_iso = None
            if ':' in title:
                prefix = title.split(':')[0].strip().lower()
                country_iso = extract_country_iso3(prefix) or extract_country_iso3(title)
            else:
                country_iso = extract_country_iso3(title)

            # AllAfrica is Africa-focused by definition — don't reject for non-African
            if country_iso and country_iso not in AFRO_COUNTRIES:
                stats["rejected"] += 1
                continue

            full_text = f"{title} {description[:300]}"

            # Apply noise filter
            filter_result = noise_filter.filter_signal(title)
            if not filter_result["pass"] and filter_result["reason"] == 'non_latin_text':
                stats["rejected"] += 1
                continue

            # Must have health/outbreak keywords
            health_kws = [
                'outbreak', 'disease', 'fever', 'cases', 'death', 'died', 'infected',
                'virus', 'health', 'hospital', 'vaccination', 'vaccine', 'epidemic',
                'cholera', 'malaria', 'ebola', 'measles', 'lassa', 'polio', 'mpox',
                'dengue', 'tuberculosis', 'hiv', 'aids', 'meningitis', 'typhoid',
                'respiratory', 'influenza', 'pandemic', 'quarantine', 'surveillance',
                'hepatitis', 'diphtheria', 'anthrax', 'rift valley', 'monkeypox'
            ]
            if not any(kw in full_text.lower() for kw in health_kws):
                stats["rejected"] += 1
                continue

            # Dedup
            dup_hash = generate_hash(url or title)
            if Signal.objects.filter(duplicate_hash=dup_hash).exists():
                stats["duplicates"] += 1
                continue

            # Detect disease
            disease_info = disease_detector.get_primary_disease(full_text)
            priority = disease_detector.classify_priority(full_text)

            # Coordinates
            lat, lng = COUNTRY_COORDS.get(country_iso, (0, 0)) if country_iso else (0, 0)

            # Classify pillar
            pillar = _classify_signal_pillar(full_text)

            # Extract epi numbers
            epi = extract_epi_numbers(full_text)

            Signal.objects.create(
                tenant_id=_get_tenant_id(country_iso),
                signal_type='disease' if disease_info else 'hazard',
                disease_name=disease_info['name'] if disease_info else None,
                disease_category=disease_info['category'] if disease_info else DiseaseCategory.UNKNOWN,
                pillar=pillar,
                location_country=get_country_name(country_iso) if country_iso else 'Africa Region',
                location_country_iso=country_iso or 'AFR',
                location_lat=lat,
                location_lng=lng,
                original_text=title[:2000],
                original_language='en',
                source_name='AllAfrica',
                source_url=url,
                source_tier=2,  # AllAfrica is TIER 2
                priority=priority,
                confidence_score=disease_info['confidence'] if disease_info else 70,
                status=SignalStatus.NEW,
                ingestion_source='ALLAFRICA',
                duplicate_hash=dup_hash,
                reported_cases=epi['cases'],
                reported_deaths=epi['deaths'],
                tenant=resolve_tenant(iso=country_iso or 'AFR'),
            )
            stats["ingested"] += 1

    except _INGEST_ERRORS as e:
        logger.exception("AllAfrica RSS error: %s", e)

    logger.info(f"AllAfrica ingestion complete: {stats}")
    return stats



@shared_task
@with_tenant('0')
def ingest_all_sources() -> Dict[str, Any]:
    """
    Master task that ingests from all configured sources.
    Run this periodically (e.g., every 15 minutes) via Celery Beat.
    """
    results = {
        "gdelt": ingest_from_gdelt.delay().id,
        "reliefweb": ingest_from_reliefweb.delay().id,
        "who_news": ingest_from_who_news.delay().id,
        "allafrica": ingest_from_allafrica.delay().id,
        "timestamp": timezone.now().isoformat()
    }
    logger.info(f"Triggered ingestion from all sources: {results}")
    return results


# ============================================================================
# MANUAL SYNC COMMAND (for immediate use)
# ============================================================================

def sync_live_data():
    """
    Synchronous function to immediately fetch and ingest from all sources.
    Use this for testing or when Celery is not running.
    """
    logger.info("Starting live data sync from all sources")

    logger.info("Fetching from GDELT")
    gdelt_stats = ingest_from_gdelt()
    logger.info("GDELT: %s", gdelt_stats)
    time.sleep(2)

    logger.info("Fetching from ReliefWeb")
    rw_stats = ingest_from_reliefweb()
    logger.info("ReliefWeb: %s", rw_stats)
    time.sleep(1)

    logger.info("Fetching from WHO News RSS")
    who_stats = ingest_from_who_news()
    logger.info("WHO News: %s", who_stats)
    time.sleep(1)

    logger.info("Fetching from AllAfrica Health RSS")
    aa_stats = ingest_from_allafrica()
    logger.info("AllAfrica: %s", aa_stats)

    total_signals = Signal.objects.count()
    logger.info("Sync complete; total signals in database: %d", total_signals)

    return {
        "gdelt": gdelt_stats,
        "reliefweb": rw_stats,
        "who_news": who_stats,
        "allafrica": aa_stats,
        "total_signals": total_signals
    }
