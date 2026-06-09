"""
Outbreak Workspace — Capacity Aggregation Service (T-090)

Pulls from 6 existing data sources and returns a single combined
response for a given outbreak's iso3:

  readiness  — disease-specific readiness score from readiness/ models
  ihr        — 13 e-SPAR component scores from espar/
  chw        — country CHW density + top affected districts from chwfolder/
  star       — seasonal hazard score for the pathogen from stardata/
  spillover  — current spillover risk from onehealth/spillover_engine.py
  composite  — weighted composite from predictions/composite_engine.py

Design: each sub-fetcher is isolated — if one source is unavailable
the endpoint still returns partial data with null for that key.
"""

import logging
from datetime import datetime
from typing import Any, Optional

from django.db import DatabaseError
from django.db.models import Avg, Max

logger = logging.getLogger(__name__)

# Failure modes we tolerate from sub-fetchers (DB reads + optional
# imports of sibling modules). The endpoint must return partial data
# with null for any unreachable source — see module docstring.
_SUBFETCH_ERRORS = (DatabaseError, ImportError, AttributeError, ValueError, TypeError)


# ── Pathogen name → disease key mapping ─────────────────────────────
# The readiness models and composite engine use lowercase disease keys.
# The outbreak's pathogen.name is human-readable. This maps between them.

PATHOGEN_TO_DISEASE_KEY: dict[str, str] = {
    'Ebola Virus Disease': 'ebola',
    'Ebola virus disease': 'ebola',
    'Cholera': 'cholera',
    'Mpox': 'mpox',
    'Mpox (Clade I)': 'mpox',
    'Meningitis': 'meningitis',
    'Marburg': 'marburg',
    'Marburg Virus Disease': 'marburg',
    'Lassa Fever': 'lassa_fever',
    'Rift Valley Fever': 'rift_valley_fever',
    'Measles': 'measles',
    'Yellow Fever': 'yellow_fever',
}

# Pathogen name → spillover engine pathogen key
PATHOGEN_TO_SPILLOVER_KEY: dict[str, str] = {
    'Ebola Virus Disease': 'Ebola VD',
    'Ebola virus disease': 'Ebola VD',
    'Mpox': 'Mpox Clade I',
    'Mpox (Clade I)': 'Mpox Clade I',
    'Rift Valley Fever': 'Rift Valley Fever',
    'Marburg': 'Marburg',
    'Marburg Virus Disease': 'Marburg',
}

# Disease key → readiness model class name (from composite_engine.py)
DISEASE_READINESS_MODEL: dict[str, str] = {
    'cholera': 'Cholera',
    'mpox': 'Mpox',
    'meningitis': 'Meningitis',
    'marburg': 'Marburg',
    'lassa_fever': 'LassaFever',
    'rift_valley_fever': 'RiftValleyFever',
    'ebola': 'FVD',
}

# ISO3 → e-SPAR country name (the `states` field uses official names)
# This is needed because e-SPAR matches on country name, not ISO code.
ISO3_TO_ESPAR_NAME: dict[str, str] = {
    'AGO': 'Angola', 'BEN': 'Benin', 'BWA': 'Botswana',
    'BFA': 'Burkina Faso', 'BDI': 'Burundi', 'CPV': 'Cabo Verde',
    'CMR': 'Cameroon', 'CAF': 'Central African Republic', 'TCD': 'Chad',
    'COM': 'Comoros', 'COG': 'Congo', 'CIV': "Côte d'Ivoire",
    'COD': 'Democratic Republic of the Congo', 'GNQ': 'Equatorial Guinea',
    'ERI': 'Eritrea', 'SWZ': 'Eswatini', 'ETH': 'Ethiopia',
    'GAB': 'Gabon', 'GMB': 'Gambia', 'GHA': 'Ghana',
    'GIN': 'Guinea', 'GNB': 'Guinea-Bissau', 'KEN': 'Kenya',
    'LSO': 'Lesotho', 'LBR': 'Liberia', 'MDG': 'Madagascar',
    'MWI': 'Malawi', 'MLI': 'Mali', 'MRT': 'Mauritania',
    'MUS': 'Mauritius', 'MOZ': 'Mozambique', 'NAM': 'Namibia',
    'NER': 'Niger', 'NGA': 'Nigeria', 'RWA': 'Rwanda',
    'STP': 'São Tomé and Príncipe', 'SEN': 'Senegal',
    'SYC': 'Seychelles', 'SLE': 'Sierra Leone',
    'ZAF': 'South Africa', 'SSD': 'South Sudan',
    'TZA': 'United Republic of Tanzania', 'TGO': 'Togo',
    'UGA': 'Uganda', 'ZMB': 'Zambia', 'ZWE': 'Zimbabwe',
    'DZA': 'Algeria',
}

# STAR hazard keywords per disease (from composite_engine.py)
DISEASE_HAZARD_MAP: dict[str, list[str]] = {
    'cholera': ['cholera', 'flooding', 'flood'],
    'mpox': ['mpox', 'monkeypox'],
    'malaria': ['malaria'],
    'meningitis': ['meningitis', 'meningococcal'],
    'ebola': ['ebola', 'evd', 'viral haemorrhagic fever',
              'viral hemorrhagic fever'],
    'marburg': ['marburg', 'viral haemorrhagic fever',
                'viral hemorrhagic fever'],
    'lassa_fever': ['lassa', 'lassa fever', 'viral haemorrhagic fever'],
    'rift_valley_fever': ['rift valley fever', 'rvf'],
    'measles': ['measles'],
    'yellow_fever': ['yellow fever'],
}

# Severity text → numeric score (from composite_engine.py)
SEVERITY_SCORES: dict[str, int] = {
    'very high': 100, 'très élevée': 100, 'très elevée': 100,
    'tres elevee': 100, 'muito elevada': 100, 'muy alta': 100, '4': 100,
    'high': 75, 'élevée': 75, 'elevée': 75, 'elevee': 75,
    'elevada': 75, 'alta': 75, '3': 75,
    'moderate': 50, 'modérée': 50, 'moderee': 50,
    'moderada': 50, 'moderado': 50, '2': 50,
    'low': 25, 'basse': 25, 'baixa': 25, 'baja': 25, '1': 25,
}

MONTH_FIELDS: dict[int, str] = {
    1: 'jan', 2: 'feb', 3: 'mar', 4: 'apr',
    5: 'may', 6: 'jun', 7: 'jul', 8: 'aug',
    9: 'sep', 10: 'oct', 11: 'nov', 12: 'dec',
}


# ═════════════════════════════════════════════════════════════════════
# SUB-FETCHERS — each returns a dict or None on failure
# ═════════════════════════════════════════════════════════════════════


def _fetch_readiness(iso3: str, pathogen_name: str) -> Optional[dict[str, Any]]:
    """
    Disease-specific readiness score from readiness/ models.

    Looks up the readiness model for the outbreak's pathogen and computes
    an aggregated score for the given country. The readiness models store
    country names in the `country` field — we match using case-insensitive
    contains on both the country name and the ISO3 code.
    """
    from readiness import models as readiness_models

    disease_key = PATHOGEN_TO_DISEASE_KEY.get(pathogen_name)
    if not disease_key:
        return None

    model_name = DISEASE_READINESS_MODEL.get(disease_key)
    if not model_name:
        return None

    try:
        ReadinessModel = getattr(readiness_models, model_name)
    except AttributeError:
        logger.warning("Readiness model %s not found", model_name)
        return None

    country_name = ISO3_TO_ESPAR_NAME.get(iso3, '')

    # Readiness models store country names in various formats.
    # Try matching by ISO3 in key_on_table first, then by country name.
    entries = ReadinessModel.objects.filter(
        country__icontains=country_name
    ) if country_name else ReadinessModel.objects.none()

    if not entries.exists():
        # Fallback: match ISO3 in key_on_table
        entries = ReadinessModel.objects.filter(
            key_on_table__icontains=iso3
        )

    if not entries.exists():
        return {'score': None, 'categories': {}, 'data_available': False}

    # Compute category-level scores
    categories: dict[str, float] = {}
    all_scores: list[float] = []

    for entry in entries:
        category = entry.category or 'Unknown'
        try:
            pct = float(entry.category_percent_country_pct or 0)
        except (ValueError, TypeError):
            pct = 0.0

        if pct > 0:
            categories[category] = round(pct, 1)
            all_scores.append(pct)

    overall = round(sum(all_scores) / len(all_scores), 1) if all_scores else None

    # Identify weakest categories (below 50%)
    weak = sorted(
        [(cat, val) for cat, val in categories.items() if val < 50],
        key=lambda x: x[1],
    )[:3]

    return {
        'score': overall,
        'disease': disease_key,
        'categories': categories,
        'weakest': [{'category': cat, 'score': val} for cat, val in weak],
        'data_available': overall is not None,
    }


def _fetch_ihr(iso3: str) -> Optional[dict[str, Any]]:
    """
    13 e-SPAR IHR component scores for a country.

    Uses the latest year sheet available. Returns component codes,
    labels, values, and flags any component below 50.
    """
    from espar.models import Espar, Indicator
    from utils.constants import CAPACITIES

    country_name = ISO3_TO_ESPAR_NAME.get(iso3, '')

    # Try by ISO code first, then by country name
    espars = Espar.objects.filter(iso_code__iexact=iso3).order_by('-sheet__name')
    if not espars.exists() and country_name:
        espars = Espar.objects.filter(states__icontains=country_name).order_by(
            '-sheet__name'
        )

    if not espars.exists():
        return {'overall': None, 'components': [], 'data_available': False}

    # Take the latest year
    latest_espar = espars.first()
    total_average = latest_espar.total_average

    indicators = Indicator.objects.filter(espar=latest_espar)

    components = []
    headline_keys = {
        'C.5': 'surveillance',
        'C.4': 'laboratory',
        'C.7': 'response',
        'C.6': 'workforce',
    }
    headlines: dict[str, Optional[int]] = {
        'surveillance': None,
        'laboratory': None,
        'response': None,
        'workforce': None,
    }

    for code, label in CAPACITIES.items():
        # Only top-level components (C.1, C.2, ... C.15)
        if len(code.split('.')) > 2:
            continue

        filtered = indicators.filter(code=code)
        agg = filtered.aggregate(max_value=Max('value'))
        value = agg['max_value']

        if value is None:
            continue

        component = {
            'code': code,
            'label': label,
            'value': int(value),
            'below_50': int(value) < 50,
        }
        components.append(component)

        # Capture headline rollups
        if code in headline_keys:
            headlines[headline_keys[code]] = int(value)

    return {
        'overall': int(total_average) if total_average is not None else None,
        'year': latest_espar.sheet.name if latest_espar.sheet_id else None,
        'components': components,
        'headlines': headlines,
        'weak_count': sum(1 for c in components if c['below_50']),
        'data_available': len(components) > 0,
    }


def _fetch_chw(iso3: str, affected_regions: list[str]) -> Optional[dict[str, Any]]:
    """
    Country-level CHW density + top affected districts from chwfolder/.

    The `affected_regions` list comes from `outbreak.regions` — we join
    those with CHW district data to show coverage in the outbreak zone.

    The chwfolder Country table can carry multiple rows per iso3 (per-tenant
    snapshots, import stubs, etc.). Ordering by `-total_chws, -population_2024`
    surfaces the populated row first so we don't render a 0-population stub
    when the real numbers exist on a sibling row — matches what the
    `/chwfolder/countries/` listing shows.
    """
    from chwfolder.models import Country, District

    try:
        chw_country = (
            Country.objects
            .filter(iso_code__iexact=iso3)
            .order_by('-total_chws', '-population_2024')
            .first()
        )
    except _SUBFETCH_ERRORS as e:
        logger.debug("CHW country lookup failed: %s", e)
        chw_country = None

    if not chw_country:
        return {'density': None, 'districts': [], 'data_available': False}

    # If the picked row still lacks population, try to recover it from any
    # sibling row for the same iso3 — schemas where stub rows hold the
    # totals but a different row holds the population are surprisingly
    # common in this dataset.
    pop_2024 = chw_country.population_2024 or 0
    if not pop_2024:
        sibling_pop = (
            Country.objects
            .filter(iso_code__iexact=iso3)
            .exclude(pk=chw_country.pk)
            .exclude(population_2024=0)
            .order_by('-population_2024')
            .values_list('population_2024', flat=True)
            .first()
        )
        if sibling_pop:
            pop_2024 = sibling_pop

    # Recompute density if the row's stored value is 0 but we have both
    # totals and population — keeps the card honest when the source row
    # hasn't been re-saved after a data refresh.
    density = chw_country.chws_per_10000 or 0.0
    if not density and chw_country.total_chws and pop_2024:
        density = round((chw_country.total_chws / pop_2024) * 10000, 2)

    country_data = {
        'country': chw_country.country,
        'density': density or None,
        'total_chws': chw_country.total_chws,
        'active_chws': chw_country.active_chws,
        'active_pct': chw_country.active_percentage,
        'population': pop_2024 or None,
    }

    # Find districts matching outbreak's affected regions
    districts_qs = District.objects.filter(country=chw_country)

    affected_districts = []
    if affected_regions:
        # Try matching region names against district or region names
        from django.db.models import Q

        region_q = Q()
        for region_name in affected_regions:
            region_q |= Q(district_name__icontains=region_name)
            region_q |= Q(region__region_name__icontains=region_name)
        matched = districts_qs.filter(region_q).select_related('region')[:10]

        for d in matched:
            affected_districts.append({
                'district': d.district_name,
                'region': d.region.region_name if d.region else '',
                'total_chws': d.total_chws,
                'active_chws': d.active_chws,
                'active_pct': d.active_percentage,
                'chws_per_10k': d.chws_per_10k,
                'population': d.population,
                'gap_flag': d.active_percentage < 20,
            })

    # If no specific matches, show top-5 districts with lowest coverage
    if not affected_districts:
        worst = districts_qs.filter(
            total_chws__gt=0
        ).order_by('chws_per_10k').select_related('region')[:5]

        for d in worst:
            affected_districts.append({
                'district': d.district_name,
                'region': d.region.region_name if d.region else '',
                'total_chws': d.total_chws,
                'active_chws': d.active_chws,
                'active_pct': d.active_percentage,
                'chws_per_10k': d.chws_per_10k,
                'population': d.population,
                'gap_flag': d.active_percentage < 20,
            })

    return {
        **country_data,
        'districts': affected_districts,
        'data_available': True,
    }


def _fetch_star(iso3: str, pathogen_name: str) -> Optional[dict[str, Any]]:
    """
    Seasonal hazard score for the pathogen from stardata/.

    Note from Task.md: this is the *country's* seasonal hazard score,
    NOT the pathogen's transmission seasonality (which is already in
    pathogen.profile_json.trigger_season_months).
    """
    from stardata.models import StarData

    disease_key = PATHOGEN_TO_DISEASE_KEY.get(pathogen_name)
    if not disease_key:
        return {'score': None, 'data_available': False}

    country_name = ISO3_TO_ESPAR_NAME.get(iso3, '')
    keywords = DISEASE_HAZARD_MAP.get(disease_key, [])
    current_month = datetime.now().month
    month_field = MONTH_FIELDS[current_month]

    # Find matching STAR entries for this country + disease
    star_entries = StarData.objects.filter(
        country__icontains=country_name
    ) if country_name else StarData.objects.none()

    if not star_entries.exists():
        return {'score': None, 'hazard': None, 'data_available': False}

    max_score = 0
    matched_hazard = None
    seasonality_text = None
    risk_level = None

    for entry in star_entries:
        hazard_lower = (entry.hazard or '').lower()
        health_lower = (entry.health_consequences or '').lower()

        matched = False
        for kw in keywords:
            if kw in hazard_lower or kw in health_lower:
                matched = True
                break

        if not matched:
            continue

        # Get the current month severity
        month_val = getattr(entry, month_field, None)
        score = 0
        if month_val:
            score = SEVERITY_SCORES.get(str(month_val).strip().lower(), 0)

        # Also check severity and risk_level fields
        if entry.severity:
            s = SEVERITY_SCORES.get(str(entry.severity).strip().lower(), 0)
            score = max(score, s)
        if entry.risk_level:
            r = SEVERITY_SCORES.get(str(entry.risk_level).strip().lower(), 0)
            score = max(score, r)

        if score > max_score:
            max_score = score
            matched_hazard = entry.hazard
            seasonality_text = entry.seasonality
            risk_level = entry.risk_level

    return {
        'score': max_score if max_score > 0 else None,
        'hazard': matched_hazard,
        'risk_level': risk_level,
        'seasonality': seasonality_text,
        'current_month': month_field,
        'data_available': max_score > 0,
    }


def _fetch_spillover(
    iso3: str, country_name: str, pathogen_name: str
) -> Optional[dict[str, Any]]:
    """
    Current spillover risk + One Health early-warning peers.

    Combines two One Health datasets:
      1. `SpilloverEngine.assess_country()` — full per-country assessment
         for the outbreak's pathogen (composite score, stage, P(30d),
         signal breakdown, recommended actions).
      2. `get_early_warning(min_stage=1, pathogen=...)` — top-N at-risk
         countries for the same pathogen so the officer can see which
         neighbours / regional peers the engine is watching.

    Falls back gracefully when the engine returns nothing — the front-end
    treats `data_available=False` as a clean empty state, never fakes.
    """
    from onehealth.spillover_engine import SpilloverEngine, get_early_warning

    spillover_key = PATHOGEN_TO_SPILLOVER_KEY.get(pathogen_name)
    if not spillover_key:
        return {'score': None, 'stage': None, 'data_available': False}

    out: dict[str, Any] = {
        'score': None,
        'stage': None,
        'data_available': False,
    }

    try:
        engine = SpilloverEngine()
        assessment = engine.assess_country(iso3, country_name, spillover_key)
        if assessment:
            out.update({
                'score': assessment.get('composite_score'),
                'stage': assessment.get('stage'),
                'stage_label': assessment.get('stage_label'),
                'stage_color': assessment.get('stage_color'),
                'p_spillover_30d': assessment.get('p_spillover_30d'),
                'seasonality_active': assessment.get('seasonality_active'),
                'active_animal_events': assessment.get('active_animal_events'),
                'human_contacts': assessment.get('human_contacts'),
                'environmental_flags': assessment.get('environmental_flags', []),
                'recommended_actions': assessment.get('recommended_actions', []),
                'signal_breakdown': assessment.get('signal_breakdown', []),
                'alert_tier': assessment.get('alert_tier'),
                'data_available': True,
            })
    except _SUBFETCH_ERRORS as e:
        logger.warning(
            "Spillover engine failed for %s/%s: %s", iso3, spillover_key, e
        )

    # Early-warning peer ranking — pulls top countries the One Health
    # engine is watching for THIS pathogen. Officer sees if their country
    # is in the top-N and which neighbours are also flagged.
    try:
        peers_raw = get_early_warning(min_stage=1, pathogen=spillover_key, limit=10) or []
        out['peers'] = [
            {
                'iso3': p.get('country_iso3') or p.get('iso3'),
                'country': p.get('country_name') or p.get('country'),
                'score': p.get('composite_score'),
                'stage': p.get('stage'),
                'stage_label': p.get('stage_label'),
                'p_spillover_30d': p.get('p_spillover_30d'),
                'alert_tier': p.get('alert_tier'),
                'active_animal_events': p.get('active_animal_events', 0),
                'human_contacts': p.get('human_contacts', 0),
            }
            for p in peers_raw
            if (p.get('country_iso3') or p.get('iso3'))
        ]
    except _SUBFETCH_ERRORS as e:
        logger.warning("Spillover early-warning failed for %s: %s", spillover_key, e)
        out['peers'] = []

    return out


def _fetch_poe(iso3: str) -> Optional[dict[str, Any]]:
    """
    FVD PoE (Points of Entry) readiness for the outbreak country.

    Aggregates readiness.FVDPoE rows for the country (one row per
    question) into a single percentage score. The model stores country
    as a free-text name, so we look up via ISO3_TO_ESPAR_NAME.

    Returns None / data_available=False when nothing is recorded for
    the country — never fabricates a score.
    """
    try:
        from readiness.models import FVDPoE
    except _SUBFETCH_ERRORS as e:
        logger.warning("PoE: could not import readiness.FVDPoE: %s", e)
        return {'score': None, 'data_available': False}

    country_name = ISO3_TO_ESPAR_NAME.get(iso3)
    if not country_name:
        return {'score': None, 'data_available': False}

    try:
        # Case-insensitive match; the upstream data has inconsistent
        # capitalisation ("Democratic republic of the Congo" vs ...).
        # We also accept a partial match for "Tanzania" variants.
        rows = FVDPoE.objects.filter(country__iexact=country_name)
        # Fall back to icontains if exact match returns nothing
        if not rows.exists():
            rows = FVDPoE.objects.filter(country__icontains=country_name)
        if not rows.exists() and iso3 == 'COD':
            # Common storage variant — without the leading "the".
            rows = FVDPoE.objects.filter(country__icontains='Democratic Republic of Congo')

        total = rows.count()
        if total == 0:
            return {'score': None, 'data_available': False, 'country': country_name}

        # category_percent_country is the rolled-up % for the country —
        # same value on every question row, so taking the first non-null
        # is enough. If the column is null we average question_score.
        from django.db.models import Avg
        rolled = rows.exclude(category_percent_country__isnull=True) \
            .values_list('category_percent_country', flat=True).first()
        if rolled is not None:
            score = float(rolled)
        else:
            avg = rows.aggregate(avg_q=Avg('question_score')).get('avg_q')
            score = float(avg) if avg is not None else None

        answered = rows.filter(question_score__gt=0).count()
        return {
            'score': round(score, 1) if score is not None else None,
            'questions_total': total,
            'questions_answered': answered,
            'country': country_name,
            'data_available': score is not None,
        }
    except _SUBFETCH_ERRORS as e:
        logger.warning("PoE fetch failed for %s: %s", iso3, e)
        return {'score': None, 'data_available': False}


def _fetch_composite(
    iso3: str, pathogen_name: str
) -> Optional[dict[str, Any]]:
    """
    Weighted composite score from predictions/composite_engine.py.

    Reads from the pre-computed OutbreakPrediction table. This table is
    populated by the `compute_all_predictions` Celery task.
    """
    from predictions.models import OutbreakPrediction

    disease_key = PATHOGEN_TO_DISEASE_KEY.get(pathogen_name)
    if not disease_key:
        return {'score': None, 'data_available': False}

    try:
        prediction = OutbreakPrediction.objects.filter(
            country_iso=iso3,
            disease_name=disease_key,
        ).first()
    except _SUBFETCH_ERRORS as e:
        logger.warning("Composite fetch failed for %s/%s: %s", iso3, disease_key, e)
        return {'score': None, 'data_available': False}

    if not prediction:
        return {'score': None, 'risk_level': None, 'data_available': False}

    return {
        'score': prediction.composite_risk_score,
        'risk_level': prediction.risk_level,
        'star_score': prediction.star_score,
        'climate_score': prediction.climate_score,
        'sentinel_score': prediction.sentinel_score,
        'espar_score': prediction.espar_score,
        'readiness_score': prediction.readiness_score,
        'confidence': prediction.confidence,
        'drivers': prediction.climate_drivers,
        'sources_used': prediction.data_sources_used,
        'valid_until': (
            prediction.valid_until.isoformat()
            if prediction.valid_until else None
        ),
        'data_available': True,
    }


# ═════════════════════════════════════════════════════════════════════
# PUBLIC API — called by the view
# ═════════════════════════════════════════════════════════════════════


def get_outbreak_capacity(outbreak) -> dict[str, Any]:
    """
    Aggregate capacity data for an outbreak from all 6 sources.

    Returns one combined dict with keys:
      readiness, ihr, chw, star, spillover, composite

    Each key is either a populated dict or a dict with
    data_available=False if the source had no data.
    """
    iso3 = outbreak.iso3.upper()
    pathogen_name = outbreak.pathogen.name
    country_name = ISO3_TO_ESPAR_NAME.get(iso3, '')
    affected_regions = outbreak.regions or []

    result: dict[str, Any] = {}

    # Each sub-fetch is independent; failure in one does not block others
    fetchers = {
        'readiness': lambda: _fetch_readiness(iso3, pathogen_name),
        'ihr': lambda: _fetch_ihr(iso3),
        'chw': lambda: _fetch_chw(iso3, affected_regions),
        'star': lambda: _fetch_star(iso3, pathogen_name),
        'spillover': lambda: _fetch_spillover(iso3, country_name, pathogen_name),
        'poe': lambda: _fetch_poe(iso3),
        'composite': lambda: _fetch_composite(iso3, pathogen_name),
    }

    for key, fetcher in fetchers.items():
        try:
            data = fetcher()
            result[key] = data if data is not None else {
                'data_available': False
            }
        except _SUBFETCH_ERRORS as e:
            logger.exception("Capacity sub-fetch '%s' failed: %s", key, e)
            result[key] = {'data_available': False, 'error': str(e)}

    # Add metadata
    result['iso3'] = iso3
    result['pathogen'] = pathogen_name
    result['country'] = country_name

    return result
