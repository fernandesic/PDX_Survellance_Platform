"""
Composite Risk Engine (Optimized)
Pre-loads all data in batch queries, then computes weighted outbreak risk
scores per country-disease combination in memory.
"""

import logging
import math
import random
from datetime import datetime, timedelta
from collections import defaultdict
from django.utils import timezone
from django.db.models import Q

from utils.tenant_resolver import resolve_tenant

logger = logging.getLogger(__name__)

# AFRO countries with ISO3 codes
AFRO_COUNTRIES = {
    'AGO': 'Angola', 'BEN': 'Benin', 'BWA': 'Botswana', 'BFA': 'Burkina Faso',
    'BDI': 'Burundi', 'CPV': 'Cabo Verde', 'CMR': 'Cameroon', 'CAF': 'Central African Republic',
    'TCD': 'Chad', 'COM': 'Comoros', 'COG': 'Congo', 'CIV': "Côte d'Ivoire",
    'COD': 'DR Congo', 'GNQ': 'Equatorial Guinea', 'ERI': 'Eritrea', 'ETH': 'Ethiopia',
    'GAB': 'Gabon', 'GMB': 'Gambia', 'GHA': 'Ghana', 'GIN': 'Guinea',
    'GNB': 'Guinea-Bissau', 'KEN': 'Kenya', 'LSO': 'Lesotho', 'LBR': 'Liberia',
    'MDG': 'Madagascar', 'MWI': 'Malawi', 'MLI': 'Mali', 'MRT': 'Mauritania',
    'MUS': 'Mauritius', 'MOZ': 'Mozambique', 'NAM': 'Namibia', 'NER': 'Niger',
    'NGA': 'Nigeria', 'RWA': 'Rwanda', 'STP': 'São Tomé and Príncipe',
    'SEN': 'Senegal', 'SYC': 'Seychelles', 'SLE': 'Sierra Leone', 'ZAF': 'South Africa',
    'SSD': 'South Sudan', 'TZA': 'Tanzania', 'TGO': 'Togo', 'UGA': 'Uganda',
    'ZMB': 'Zambia', 'ZWE': 'Zimbabwe', 'SWZ': 'Eswatini',
}

# Reverse lookup: country name → ISO
COUNTRY_NAME_TO_ISO = {}
for iso, name in AFRO_COUNTRIES.items():
    COUNTRY_NAME_TO_ISO[name.lower()] = iso
    # Add common alternate names
    if "'" in name:
        COUNTRY_NAME_TO_ISO[name.split("'")[0].lower()] = iso

# Target diseases
TARGET_DISEASES = [
    'cholera', 'mpox', 'malaria', 'meningitis', 'ebola',
    'marburg', 'lassa_fever', 'rift_valley_fever', 'measles', 'yellow_fever',
]

# Disease ↔ Hazard type mapping for STAR Tracker
DISEASE_HAZARD_MAP = {
    'cholera': ['cholera', 'flooding', 'flood'],
    'mpox': ['mpox', 'monkeypox'],
    'malaria': ['malaria'],
    'meningitis': ['meningitis', 'meningococcal'],
    'ebola': ['ebola', 'evd', 'viral haemorrhagic fever', 'viral hemorrhagic fever'],
    'marburg': ['marburg', 'viral haemorrhagic fever', 'viral hemorrhagic fever'],
    'lassa_fever': ['lassa', 'lassa fever', 'viral haemorrhagic fever'],
    'rift_valley_fever': ['rift valley fever', 'rvf'],
    'measles': ['measles'],
    'yellow_fever': ['yellow fever'],
}

# Disease ↔ Readiness model
DISEASE_READINESS_MAP = {
    'cholera': 'Cholera',
    'mpox': 'Mpox',
    'meningitis': 'Meningitis',
    'marburg': 'Marburg',
    'lassa_fever': 'LassaFever',
    'rift_valley_fever': 'RiftValleyFever',
    'ebola': 'FVD',
}

# Month fields
MONTH_FIELDS = {
    1: 'jan', 2: 'feb', 3: 'mar', 4: 'apr',
    5: 'may', 6: 'jun', 7: 'jul', 8: 'aug',
    9: 'sep', 10: 'oct', 11: 'nov', 12: 'dec',
}

# Severity to score (multilingual)
SEVERITY_SCORES = {
    'very high': 100, 'très élevée': 100, 'très elevée': 100, 'tres elevee': 100,
    'muito elevada': 100, 'muy alta': 100, '4': 100,
    'high': 75, 'élevée': 75, 'elevée': 75, 'elevee': 75,
    'elevada': 75, 'alta': 75, '3': 75,
    'moderate': 50, 'modérée': 50, 'moderee': 50,
    'moderada': 50, 'moderado': 50, '2': 50,
    'low': 25, 'basse': 25, 'baixa': 25, 'baja': 25, '1': 25,
}


def _batch_load_star_data(current_month):
    """Load ALL STAR data in one query, index by country→hazard→severity."""
    from stardata.models import StarData
    
    month_field = MONTH_FIELDS[current_month]
    next_month = MONTH_FIELDS[(current_month % 12) + 1]
    third_month = MONTH_FIELDS[((current_month + 1) % 12) + 1]
    
    star_index = defaultdict(list)  # country_lower → list of (hazard_lower, severity_score)
    
    all_star = StarData.objects.all().values(
        'country', 'hazard', 'health_consequences',
        'severity', 'risk_level', 'risk_level_number',
        month_field, next_month, third_month
    )
    
    for entry in all_star:
        country_raw = (entry.get('country') or '').strip()
        if not country_raw:
            continue
        country_lower = country_raw.lower()
        
        hazard_lower = (entry.get('hazard') or '').lower()
        health_lower = (entry.get('health_consequences') or '').lower()
        
        # Get max severity across current and next 2 months + severity/risk fields
        max_score = 0
        for field_name in [month_field, next_month, third_month]:
            val = entry.get(field_name)
            if val:
                score = SEVERITY_SCORES.get(str(val).strip().lower(), 0)
                max_score = max(max_score, score)
        
        # Also check severity and risk_level fields
        if entry.get('severity'):
            s = SEVERITY_SCORES.get(str(entry['severity']).strip().lower(), 0)
            max_score = max(max_score, s)
        if entry.get('risk_level'):
            r = SEVERITY_SCORES.get(str(entry['risk_level']).strip().lower(), 0)
            max_score = max(max_score, r)
        if entry.get('risk_level_number'):
            rn = SEVERITY_SCORES.get(str(entry['risk_level_number']).strip(), 0)
            max_score = max(max_score, rn)
        
        star_index[country_lower].append({
            'hazard': hazard_lower,
            'health': health_lower,
            'score': max_score,
        })
    
    logger.info(f"Loaded {len(all_star)} STAR entries for {len(star_index)} countries")
    return star_index


def _batch_load_sentinel_data():
    """Load recent signals, index by country_iso→disease."""
    from sentinel.models import Signal
    
    cutoff = timezone.now() - timedelta(days=90)
    sentinel_index = defaultdict(list)  # iso → list of signal dicts
    
    signals = Signal.objects.filter(created_at__gte=cutoff).values(
        'location_country_iso', 'location_country',
        'disease_name', 'original_text', 'priority',
        'reported_cases', 'reported_deaths', 'confidence_score'
    )
    
    for sig in signals:
        iso = (sig.get('location_country_iso') or '').upper()
        country = (sig.get('location_country') or '').lower()
        
        # Try to resolve ISO from country name if missing
        if not iso or len(iso) != 3:
            for name, code in COUNTRY_NAME_TO_ISO.items():
                if name in country:
                    iso = code
                    break
        
        if iso:
            sentinel_index[iso].append(sig)
    
    logger.info(f"Loaded {len(signals)} recent signals")
    return sentinel_index


def _batch_load_espar_data():
    """Load all e-SPAR data, index by ISO."""
    from espar.models import Espar
    
    espar_index = {}
    for entry in Espar.objects.all().values('iso_code', 'total_average'):
        iso = (entry.get('iso_code') or '').strip().upper()
        if iso and entry.get('total_average') is not None:
            try:
                avg = int(entry['total_average'])
                # Keep the best (highest capacity) score per ISO
                if iso not in espar_index or avg > espar_index[iso]:
                    espar_index[iso] = avg
            except (ValueError, TypeError):
                pass
    
    logger.info(f"Loaded e-SPAR data for {len(espar_index)} countries")
    return espar_index


def _batch_load_readiness_data():
    """Load readiness data for supported diseases, index by ISO→disease."""
    from readiness import models as readiness_models
    
    readiness_index = defaultdict(dict)  # iso → disease → score
    
    for disease, model_name in DISEASE_READINESS_MAP.items():
        try:
            ReadinessModel = getattr(readiness_models, model_name)
            entries = ReadinessModel.objects.all()
            for entry in entries:
                key = (entry.key_on_table or '').upper()
                # Try to extract ISO from key_on_table
                for iso in AFRO_COUNTRIES:
                    if iso in key:
                        try:
                            ws = entry.weighted_score()
                            if ws is not None:
                                readiness_index[iso][disease] = min(max(float(ws), 0), 100)
                        except (AttributeError, ValueError, TypeError):
                            # weighted_score may be undefined or non-numeric — skip this entry
                            pass
                        break
        except Exception as e:  # noqa: BLE001 — readiness loader fan-out: one bad model must not break the composite for the rest
            logger.warning(f"Could not load readiness for {model_name}: {e}")
    
    logger.info(f"Loaded readiness data for {len(readiness_index)} countries")
    return readiness_index


def _match_star_to_disease(star_entries, disease):
    """Check if any STAR entry for a country matches the disease hazard keywords."""
    keywords = DISEASE_HAZARD_MAP.get(disease, [])
    max_score = 0
    
    for entry in star_entries:
        for kw in keywords:
            if kw in entry['hazard'] or kw in entry['health']:
                max_score = max(max_score, entry['score'])
                break
    
    return max_score


def _get_sentinel_score(sentinel_signals, disease):
    """Compute sentinel score from pre-loaded signals for a disease."""
    keywords = DISEASE_HAZARD_MAP.get(disease, [disease])
    matching = []
    
    for sig in sentinel_signals:
        disease_name = (sig.get('disease_name') or '').lower()
        text = (sig.get('original_text') or '').lower()
        
        for kw in keywords:
            if kw in disease_name or kw in text:
                matching.append(sig)
                break
    
    if not matching:
        return 0
    
    count = len(matching)
    priority_weights = {'P1': 25, 'P2': 15, 'P3': 8, 'P4': 3}
    priority_score = sum(priority_weights.get(s.get('priority', 'P4'), 3) for s in matching[:20])
    total_cases = sum(s.get('reported_cases') or 0 for s in matching[:20])
    case_boost = min(total_cases / 10, 30)
    
    return min((min(count, 10) * 4) + min(priority_score, 40) + case_boost, 100)


def _load_real_forecast_from_csv(iso):
    """Load real ML forecast data from ForecastData DB table for COD/MOZ cholera."""
    from predictions.models import ForecastData

    if iso not in ('COD', 'MOZ'):
        return None

    if iso == 'COD':
        # DRC: aggregate regional (district-level) data by date
        from django.db.models import Sum
        qs = ForecastData.objects.filter(
            country_iso='COD', data_type='regional'
        ).values('date').annotate(
            total_cases=Sum('cases'),
        ).order_by('date')

        if not qs.exists():
            logger.warning(f"No ForecastData found for {iso}")
            return None

        forecast = []
        for entry in qs:
            cases = entry['total_cases']
            forecast.append({
                'date': entry['date'].isoformat(),
                'predicted': cases,
                'lower': max(0, int(cases * 0.85)),
                'upper': int(cases * 1.15),
            })
    else:
        # MOZ: national data
        qs = ForecastData.objects.filter(
            country_iso='MOZ', data_type='national'
        ).order_by('date')

        if not qs.exists():
            logger.warning(f"No ForecastData found for {iso}")
            return None

        forecast = []
        for row in qs:
            cases = row.cases
            forecast.append({
                'date': row.date.isoformat(),
                'predicted': cases,
                'lower': max(0, int(cases * 0.85)),
                'upper': int(cases * 1.15),
            })

    logger.info(f"Loaded {len(forecast)} weeks of real forecast for {iso} from DB")
    return forecast


# COMMENTED OUT: Fake synthetic forecast generation — not real ML data
# def generate_forecast_timeseries(base_score, disease, country_iso):
#     """Generate mocked 90-day forecast time-series from base composite score."""
#     today = datetime.now().date()
#     forecast = []
#     base_cases = max(1, int(base_score * 2.5))
#
#     for day_offset in range(90):
#         date = today + timedelta(days=day_offset)
#         day_in_year = date.timetuple().tm_yday
#         seasonal_factor = 1.0 + 0.3 * math.sin(2 * math.pi * (day_in_year - 60) / 365)
#         noise = random.gauss(0, base_cases * 0.15)
#         trend = 1.0 + (day_offset / 90) * (0.3 if base_score > 50 else -0.1)
#
#         predicted = max(0, int(base_cases * seasonal_factor * trend + noise))
#         uncertainty = 0.1 + (day_offset / 90) * 0.4
#         lower = max(0, int(predicted * (1 - uncertainty)))
#         upper = int(predicted * (1 + uncertainty))
#
#         forecast.append({
#             'date': date.isoformat(),
#             'predicted': predicted,
#             'lower': lower,
#             'upper': upper,
#         })
#
#     return forecast


def compute_composite_score(star, climate, sentinel, espar, readiness):
    """Weighted composite: STAR=0.35, Climate=0.25, Sentinel=0.20, e-SPAR=0.10, Readiness=0.10"""
    return round(min(max(
        star * 0.35 + climate * 0.25 + sentinel * 0.20 + espar * 0.10 + readiness * 0.10
    , 0), 100), 1)


def compute_all_predictions():
    """
    Main function: batch-load all data, then compute predictions in memory.
    Dramatically faster than per-combo queries.
    """
    from predictions.models import OutbreakPrediction, PredictionModel
    
    logger.info("Starting batch data loading...")
    current_month = datetime.now().month
    
    # 1. Batch load all data sources (4 queries total instead of ~1800)
    star_data = _batch_load_star_data(current_month)
    sentinel_data = _batch_load_sentinel_data()
    espar_data = _batch_load_espar_data()
    readiness_data = _batch_load_readiness_data()
    
    # 2. Ensure PredictionModel entries exist
    models_config = [
        ('STAR Seasonal Risk', 'STAR', 'Seasonal hazard risk from STAR Tracker data', 0.35),
        ('Climate-AI Disease Risk', 'CLIMATE', 'Climate-driven disease risk engine', 0.25),
        ('Sentinel Signal Intel', 'SENTINEL', 'Real-time signal intelligence', 0.20),
        ('e-SPAR Vulnerability', 'ESPAR', 'IHR capacity gaps (inverted)', 0.10),
        ('Readiness Gap Score', 'READINESS', 'Disease-specific preparedness gaps', 0.10),
        ('Composite Ensemble', 'COMPOSITE', 'Weighted combination of all sources', 1.0),
    ]
    
    composite_model = None
    for name, mtype, desc, weight in models_config:
        obj, _ = PredictionModel.objects.update_or_create(
            name=name,
            defaults={
                'model_type': mtype, 'description': desc,
                'weight': weight, 'last_run': timezone.now(), 'is_active': True,
            }
        )
        if mtype == 'COMPOSITE':
            composite_model = obj
    
    # 3. Compute predictions for all combos in memory
    logger.info("Computing predictions for all country-disease combinations...")
    created = updated = errors = 0
    bulk_predictions = []
    
    for iso, country_name in AFRO_COUNTRIES.items():
        country_lower = country_name.lower()
        
        # Get STAR entries for this country (fuzzy match on country name)
        star_entries = []
        for star_country, entries in star_data.items():
            # Match if country name appears in STAR country field or vice versa
            if (country_lower[:6] in star_country or star_country[:6] in country_lower
                or country_name.split(' ')[0].lower() in star_country):
                star_entries.extend(entries)
        
        # Get sentinel signals for this country
        sentinel_signals = sentinel_data.get(iso, [])
        
        # Get e-SPAR vulnerability (inverted capacity)
        espar_capacity = espar_data.get(iso, 50)
        espar_vulnerability = 100 - min(max(espar_capacity, 0), 100)
        espar_has_data = iso in espar_data
        
        for disease in TARGET_DISEASES:
            try:
                # STAR score
                star_score = _match_star_to_disease(star_entries, disease)
                star_has_data = star_score > 0 or len(star_entries) > 0
                
                # Sentinel score
                sentinel_score = _get_sentinel_score(sentinel_signals, disease)
                sentinel_has_data = sentinel_score > 0
                
                # Readiness gap (inverted)
                readiness_val = readiness_data.get(iso, {}).get(disease)
                if readiness_val is not None:
                    readiness_gap = 100 - readiness_val
                    readiness_has_data = True
                else:
                    readiness_gap = 50
                    readiness_has_data = False
                
                # COMMENTED OUT: Fake hardcoded climate score
                # climate_score = 30
                # climate_has_data = False
                climate_score = 0
                climate_has_data = False
                
                # Track sources
                sources_used = []
                if star_has_data:
                    sources_used.append('STAR Tracker')
                if sentinel_has_data:
                    sources_used.append('Sentinel Intel')
                if espar_has_data:
                    sources_used.append('e-SPAR')
                if readiness_has_data:
                    sources_used.append('Readiness')
                
                # Composite score
                composite = compute_composite_score(
                    star_score, climate_score, sentinel_score,
                    espar_vulnerability, readiness_gap
                )
                risk_level = OutbreakPrediction.score_to_risk_level(composite)
                
                # Forecast: use real ML data for COD/MOZ cholera, mock for others
                real_forecast = None
                if iso in ('COD', 'MOZ') and disease == 'cholera':
                    real_forecast = _load_real_forecast_from_csv(iso)

                if real_forecast:
                    # Filter to future weeks only — CSV starts in the past
                    today_str = datetime.now().date().isoformat()
                    future_weeks = [f for f in real_forecast if f['date'] >= today_str]
                    forecast = future_weeks  # DB stores only upcoming weeks
                    # Weekly data — approximate 30/60/90 day windows as ~4/8/13 weeks
                    cases_30 = sum(f['predicted'] for f in future_weeks[:4])
                    cases_60 = sum(f['predicted'] for f in future_weeks[:8])
                    cases_90 = sum(f['predicted'] for f in future_weeks[:13])
                    confidence = 78  # Higher confidence for real ML model
                    sources_used.append('ML Cholera Model')
                # COMMENTED OUT: Fake synthetic forecast for non-ML combos
                # else:
                #     forecast = generate_forecast_timeseries(composite, disease, iso)
                #     # Daily data — standard 30/60/90
                #     cases_30 = sum(f['predicted'] for f in forecast[:30])
                #     cases_60 = sum(f['predicted'] for f in forecast[:60])
                #     cases_90 = sum(f['predicted'] for f in forecast[:90])
                #     confidence = min(30 + (len(sources_used) * 12), 90)
                if not real_forecast:
                    forecast = []
                    cases_30 = 0
                    cases_60 = 0
                    cases_90 = 0
                    confidence = min(30 + (len(sources_used) * 12), 90)
                
                # Drivers
                drivers = []
                if star_score > 50:
                    drivers.append('Seasonal hazard pattern (STAR)')
                if sentinel_score > 30:
                    drivers.append('Active signal intelligence')
                if espar_vulnerability > 60:
                    drivers.append('Low IHR capacity')
                if readiness_gap > 60:
                    drivers.append('Readiness gaps detected')
                
                obj, was_created = OutbreakPrediction.objects.update_or_create(
                    country_iso=iso,
                    disease_name=disease,
                    defaults={
                        'country_name': country_name,
                        'composite_risk_score': composite,
                        'risk_level': risk_level,
                        'star_score': star_score,
                        'climate_score': climate_score,
                        'sentinel_score': sentinel_score,
                        'espar_score': espar_vulnerability,
                        'readiness_score': readiness_gap,
                        'predicted_cases_30d': cases_30,
                        'predicted_cases_60d': cases_60,
                        'predicted_cases_90d': cases_90,
                        'confidence': confidence,
                        'confidence_lower': max(0, composite - (100 - confidence) * 0.3),
                        'confidence_upper': min(100, composite + (100 - confidence) * 0.3),
                        'forecast_data': forecast,
                        'climate_drivers': drivers,
                        'source_model': composite_model,
                        'valid_until': timezone.now() + timedelta(days=7),
                        'data_sources_used': sources_used,
                        'tenant': resolve_tenant(iso=iso, name=country_name),
                    }
                )
                
                if was_created:
                    created += 1
                else:
                    updated += 1
                    
            except Exception as e:  # noqa: BLE001 — per-(iso, disease) loop wrapper: one bad combination must not abort the rest
                logger.error(f"Error for {iso}-{disease}: {e}")
                errors += 1
    
    logger.info(f"Done: {created} created, {updated} updated, {errors} errors")
    return {'created': created, 'updated': updated, 'errors': errors}
