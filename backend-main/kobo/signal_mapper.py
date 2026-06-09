"""
KoboToolbox Signal Mapper — CHW Submission → Sentinel Signal

Converts a KoboSubmission into kwargs suitable for Signal.objects.create().
Does NOT diagnose diseases — maps symptoms to descriptive strings and
lets the AI classifier (agent_classifier.py) do the real work.

Per Anti-Pattern #1: We NEVER hardcode symptom → disease mapping.
Per Anti-Pattern #4: case_count is always cast from string to int.
"""

import logging
from datetime import datetime
from typing import Any, Optional

from django.utils.dateparse import parse_datetime

logger = logging.getLogger(__name__)

# ── Constants ───────────────────────────────────────────────────────

KOBO_SOURCE_NAME: str = 'KoboToolbox CHW'
KOBO_SOURCE_TIER: int = 0  # SourceTier.TIER_0

# Maps Kobo event_type values → human-readable symptom descriptions.
# These are SYMPTOM descriptions, not disease diagnoses.
EVENT_TYPE_TO_SYMPTOMS: dict[str, str] = {
    'respiratory': 'Respiratory illness (cough / difficulty breathing)',
    'fever_unknown': 'Fever of unknown origin',
    'diarrhea_vomiting': 'Acute watery diarrhea / vomiting',
    'rash_skin': 'Rash or unusual skin condition',
    'eye_conjunctivitis': 'Eye infections / conjunctivitis',
    'animal_deaths': 'Unusual animal deaths or sick animals',
    'malnutrition': 'Dangerous weight loss / malnutrition',
    'other': 'Other health event',
}

# 2-char ISO alpha-2 → 3-char ISO alpha-3 mapping for African countries
# Used to convert Kobo's geocoded adm0_pcode (alpha-2) to Signal's
# location_country_iso (alpha-3)
ISO2_TO_ISO3: dict[str, str] = {
    'AO': 'AGO', 'BJ': 'BEN', 'BW': 'BWA', 'BF': 'BFA', 'BI': 'BDI',
    'CV': 'CPV', 'CM': 'CMR', 'CF': 'CAF', 'TD': 'TCD', 'KM': 'COM',
    'CG': 'COG', 'CI': 'CIV', 'CD': 'COD', 'GQ': 'GNQ', 'ER': 'ERI',
    'ET': 'ETH', 'GA': 'GAB', 'GM': 'GMB', 'GH': 'GHA', 'GN': 'GIN',
    'GW': 'GNB', 'KE': 'KEN', 'LS': 'LSO', 'LR': 'LBR', 'MG': 'MDG',
    'MW': 'MWI', 'ML': 'MLI', 'MR': 'MRT', 'MU': 'MUS', 'MZ': 'MOZ',
    'NA': 'NAM', 'NE': 'NER', 'NG': 'NGA', 'RW': 'RWA', 'ST': 'STP',
    'SN': 'SEN', 'SC': 'SYC', 'SL': 'SLE', 'ZA': 'ZAF', 'SS': 'SSD',
    'TZ': 'TZA', 'TG': 'TGO', 'UG': 'UGA', 'ZM': 'ZMB', 'ZW': 'ZWE',
    'DZ': 'DZA', 'TN': 'TUN', 'LY': 'LBY', 'MA': 'MAR', 'SZ': 'SWZ',
}

# Severity level → Signal priority mapping
SEVERITY_TO_PRIORITY: dict[str, str] = {
    '1_mild': 'P4',
    '2_moderate': 'P3',
    '3_severe': 'P2',
    '4_critical': 'P1',
}


def map_submission_to_signal(
    submission: 'KoboSubmission',
    *,
    source_name: str = KOBO_SOURCE_NAME,
) -> dict[str, Any]:
    """
    Map a KoboSubmission to Signal.objects.create() kwargs.

    Args:
        submission: A saved KoboSubmission instance.
        source_name: Override for source_name (testing).

    Returns:
        Dict of kwargs for Signal.objects.create().
    """
    # Build title from symptom descriptions
    title = _build_title(submission)

    # Extract GPS coordinates (device GPS or geocoded fallback)
    lat, lng = _extract_coordinates(submission)

    # Resolve country ISO3
    country_iso = _resolve_country_iso(submission)

    # Map severity to priority
    priority = SEVERITY_TO_PRIORITY.get(submission.severity, 'P2')

    # Build the original text (description + event types)
    original_text = _build_original_text(submission)

    return {
        'signal_type': 'disease',
        'disease_name': _build_disease_name(submission),
        'disease_category': None,  # Let AI classifier determine
        'pillar': 'outbreak',
        'location_country': submission.adm0_name or _country_name_from_iso(country_iso) or 'Unknown',
        'location_country_iso': country_iso,
        'location_admin1': submission.adm1_name or '',
        'location_admin2': submission.adm2_name or '',
        'location_lat': lat,
        'location_lng': lng,
        'original_text': original_text[:2000],
        'original_language': None,  # CHW reports may be in EN/FR/PT
        'source_name': source_name,
        'source_url': f'kobo://{submission.kobo_id}',
        'source_tier': KOBO_SOURCE_TIER,
        'priority': priority,
        'confidence_score': 85,  # CHW field-validated, high base confidence
        'status': 'new',
        'ingestion_source': 'KOBO-CHW',
        'source_timestamp': submission.submitted_at,
        'reported_cases': submission.case_count,
        'reported_deaths': None,  # CHW reports don't typically include deaths
        'raw_payload': submission.raw_payload,
    }


def _build_title(submission: 'KoboSubmission') -> str:
    """Build a descriptive signal title from event types."""
    event_types = (submission.event_type or '').split()
    symptoms = [
        EVENT_TYPE_TO_SYMPTOMS.get(et, et)
        for et in event_types
        if et
    ]
    if not symptoms:
        symptoms = ['Unknown health event']

    clinic = submission.chw_clinic or 'unknown clinic'
    return f"CHW Report: {', '.join(symptoms)} — {clinic}"


def _build_disease_name(submission: 'KoboSubmission') -> str:
    """
    Build a descriptive symptom string — NOT a diagnosis.
    Per Anti-Pattern #1: never pretend to be a diagnostician.
    """
    event_types = (submission.event_type or '').split()
    symptoms = [
        EVENT_TYPE_TO_SYMPTOMS.get(et, et)
        for et in event_types
        if et
    ]
    if submission.event_other:
        symptoms.append(f'Other: {submission.event_other}')

    return ', '.join(symptoms) if symptoms else 'Unspecified symptoms'


def _build_original_text(submission: 'KoboSubmission') -> str:
    """Build the full original text for the signal."""
    parts: list[str] = []

    if submission.description:
        parts.append(submission.description)

    event_types = (submission.event_type or '').split()
    if event_types:
        symptoms = [EVENT_TYPE_TO_SYMPTOMS.get(et, et) for et in event_types]
        parts.append(f"Event types: {', '.join(symptoms)}")

    if submission.case_count:
        parts.append(f"Estimated affected: {submission.case_count}")

    if submission.severity:
        parts.append(f"Severity: {submission.severity}")

    if submission.age_group:
        parts.append(f"Age group: {submission.age_group}")

    if submission.comments_text:
        parts.append(f"CHW comments: {submission.comments_text}")

    return ' | '.join(parts)


def _extract_coordinates(
    submission: 'KoboSubmission',
) -> tuple[Optional[float], Optional[float]]:
    """
    Extract GPS coordinates from device GPS or geocoded fallback.

    Priority:
    1. Device GPS (gps_location string: "lat lon altitude accuracy")
    2. Geocoded coordinates (from text_location)
    """
    # Try device GPS first
    if submission.gps_location:
        parts = submission.gps_location.strip().split()
        if len(parts) >= 2:
            try:
                lat = float(parts[0])
                lng = float(parts[1])
                if -90 <= lat <= 90 and -180 <= lng <= 180:
                    return lat, lng
            except (ValueError, IndexError):
                logger.debug(
                    "Could not parse GPS from submission %d: %s",
                    submission.kobo_id, submission.gps_location,
                )

    # Fallback to geocoded coordinates
    if submission.geocoded_latitude is not None and submission.geocoded_longitude is not None:
        try:
            return float(submission.geocoded_latitude), float(submission.geocoded_longitude)
        except (ValueError, TypeError):
            pass

    return None, None


def _resolve_country_iso(submission: 'KoboSubmission') -> Optional[str]:
    """
    Resolve ISO 3166-1 alpha-3 country code.

    Priority:
    1. Geocoded adm0_pcode (alpha-2 → alpha-3 via mapping)
    2. Fall back to parsing text_location
    """
    if submission.adm0_pcode:
        iso2 = submission.adm0_pcode.strip().upper()
        iso3 = ISO2_TO_ISO3.get(iso2)
        if iso3:
            return iso3

    # Fallback: try to extract from adm0_name using existing ingestion helper
    if submission.adm0_name:
        try:
            from sentinel.ingestion import extract_country_iso3
            return extract_country_iso3(submission.adm0_name)
        except ImportError:
            pass

    return None


def _country_name_from_iso(iso3: Optional[str]) -> Optional[str]:
    """Get a human-readable country name from an ISO3 code."""
    if not iso3:
        return None
    try:
        from sentinel.ingestion import get_country_name
        return get_country_name(iso3)
    except ImportError:
        return iso3


def insert_oh_alert_for_animal_deaths(submission: 'KoboSubmission') -> bool:
    """
    When event_type contains 'animal_deaths', insert a row into oh_alerts
    with alert_id='SIG-kobo-{kobo_id}' so the SpilloverEngine picks it up
    in intelligence_signal scoring.

    Uses raw SQL because oh_alerts is not a Django model — it's a raw
    PostgreSQL table managed by the onehealth pipeline.

    Returns True if a row was inserted, False if skipped or errored.
    """
    if not submission.event_type or 'animal_deaths' not in submission.event_type:
        return False

    from django.db import DatabaseError, connection
    from datetime import date

    alert_id = f'SIG-kobo-{submission.kobo_id}'
    country_iso = _resolve_country_iso(submission)

    if not country_iso:
        logger.warning(
            "Cannot insert oh_alert for kobo submission %d: no country ISO",
            submission.kobo_id,
        )
        return False

    try:
        with connection.cursor() as cur:
            # Check if already exists (idempotent)
            cur.execute(
                "SELECT 1 FROM oh_alerts WHERE alert_id = %s",
                [alert_id],
            )
            if cur.fetchone():
                logger.debug(
                    "oh_alert %s already exists, skipping", alert_id,
                )
                return False

            # Determine alert_tier from severity
            severity_tier_map = {
                '1_mild': 1,
                '2_moderate': 2,
                '3_severe': 3,
                '4_critical': 4,
            }
            alert_tier = severity_tier_map.get(submission.severity, 2)

            # Build disease_name from symptoms
            symptoms = EVENT_TYPE_TO_SYMPTOMS.get('animal_deaths', 'Unusual animal deaths')

            cur.execute(
                """
                INSERT INTO oh_alerts (
                    alert_id, country_iso3, disease_name,
                    alert_tier, alert_date, status,
                    ihr_notifiable, auto_escalated
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                """,
                [
                    alert_id,
                    country_iso,
                    symptoms,
                    alert_tier,
                    (submission.submitted_at or date.today()).date()
                    if hasattr(submission.submitted_at or date.today(), 'date')
                    else submission.submitted_at or date.today(),
                    'open',
                    False,
                    True,
                ],
            )
            logger.info(
                "Inserted oh_alert %s for kobo submission %d (country=%s, tier=%d)",
                alert_id, submission.kobo_id, country_iso, alert_tier,
            )
            return True

    except (DatabaseError, AttributeError, KeyError, ValueError, TypeError) as e:
        # Non-fatal: oh_alerts table may not exist in test environments
        logger.warning(
            "Failed to insert oh_alert for kobo submission %d: %s",
            submission.kobo_id, e,
        )
        return False

