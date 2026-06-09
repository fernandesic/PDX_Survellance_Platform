"""
Phase 10 transmission-driver adaptors (T-102/T-103/T-104/T-105).

Per arc/Task.md these must do one of two things:
  a) ingest live data when a credential or upstream API is configured
  b) report `is_healthy() = False` and emit nothing — never fake data

Live integrations:
  MobilityAdaptor       — ACLED conflict/displacement events via REST API
  DeforestationAdaptor  — GFW integrated deforestation alerts via data API
  AnimalSurveillanceAdaptor — OneHealth animal events (direct DB query)
  ClimateAdaptor        — NASA POWER rainfall/temperature anomalies (free API)
"""

import json
import logging
import os
from datetime import timedelta
from typing import Iterable

import requests as http_requests

from django.db import DatabaseError
from django.utils import timezone

from outbreak.adaptors.base import SourceAdaptor
from outbreak.models import EventKind, Outbreak

logger = logging.getLogger(__name__)

# Failure modes for an external HTTP fetch — transport, parse, shape.
_FETCH_ERRORS = (
    http_requests.RequestException,
    json.JSONDecodeError,
    KeyError,
    AttributeError,
    TypeError,
    ValueError,
)

# ─── Helpers ─────────────────────────────────────────────────────

# ISO3 → ACLED country name mapping (AFRO subset)
ISO3_TO_ACLED = {
    'AGO': 'Angola', 'BEN': 'Benin', 'BWA': 'Botswana', 'BFA': 'Burkina Faso',
    'BDI': 'Burundi', 'CPV': 'Cape Verde', 'CMR': 'Cameroon',
    'CAF': 'Central African Republic', 'TCD': 'Chad', 'COM': 'Comoros',
    'COG': 'Republic of Congo', 'CIV': 'Ivory Coast', 'COD': 'Democratic Republic of Congo',
    'GNQ': 'Equatorial Guinea', 'ERI': 'Eritrea', 'SWZ': 'Eswatini',
    'ETH': 'Ethiopia', 'GAB': 'Gabon', 'GMB': 'Gambia', 'GHA': 'Ghana',
    'GIN': 'Guinea', 'GNB': 'Guinea-Bissau', 'KEN': 'Kenya', 'LSO': 'Lesotho',
    'LBR': 'Liberia', 'MDG': 'Madagascar', 'MWI': 'Malawi', 'MLI': 'Mali',
    'MRT': 'Mauritania', 'MUS': 'Mauritius', 'MOZ': 'Mozambique', 'NAM': 'Namibia',
    'NER': 'Niger', 'NGA': 'Nigeria', 'RWA': 'Rwanda', 'SEN': 'Senegal',
    'SYC': 'Seychelles', 'SLE': 'Sierra Leone', 'ZAF': 'South Africa',
    'SSD': 'South Sudan', 'TZA': 'Tanzania', 'TGO': 'Togo', 'UGA': 'Uganda',
    'ZMB': 'Zambia', 'ZWE': 'Zimbabwe', 'DZA': 'Algeria',
}


def _profile_has(outbreak: Outbreak, key: str) -> bool:
    return bool((outbreak.pathogen.profile_json or {}).get(key))


# ═══════════════════════════════════════════════════════════════
# T-102: ACLED Mobility/Conflict Adaptor
# ═══════════════════════════════════════════════════════════════

class MobilityAdaptor(SourceAdaptor):
    """
    Cross-border movement and conflict events from ACLED.

    Fetches displacement/strategic-developments/battles near the outbreak's
    epicenter + neighbor countries. Useful for understanding population
    movement that may spread the outbreak.

    Gated on OUTBREAK_ACLED_EMAIL + OUTBREAK_ACLED_API_KEY env vars.
    """
    name = 'mobility'
    kinds_emitted = [EventKind.MOBILITY]

    ACLED_URL = 'https://api.acleddata.com/acled/read'
    # Event types relevant to disease spread (displacement + strategic)
    RELEVANT_EVENT_TYPES = [
        'Battles',
        'Violence against civilians',
        'Strategic developments',
    ]

    def is_healthy(self) -> bool:
        return bool(
            os.getenv('OUTBREAK_ACLED_EMAIL')
            and os.getenv('OUTBREAK_ACLED_API_KEY')
        )

    def fetch(self, outbreak: Outbreak) -> Iterable[dict]:
        email = os.getenv('OUTBREAK_ACLED_EMAIL', '')
        api_key = os.getenv('OUTBREAK_ACLED_API_KEY', '')
        if not email or not api_key:
            return

        # Target countries: epicenter + neighbors
        target_isos = [outbreak.iso3] + list(outbreak.neighbor_iso3s or [])
        country_names = [
            ISO3_TO_ACLED.get(iso, '')
            for iso in target_isos
            if ISO3_TO_ACLED.get(iso)
        ]
        if not country_names:
            logger.warning(
                "[ACLED] No ACLED country names for ISOs %s", target_isos,
            )
            return

        # Look back 30 days from now
        since = (timezone.now() - timedelta(days=30)).strftime('%Y-%m-%d')

        for country_name in country_names:
            try:
                resp = http_requests.get(
                    self.ACLED_URL,
                    params={
                        'key': api_key,
                        'email': email,
                        'country': country_name,
                        'event_date': f'{since}|',
                        'event_date_where': '>=',
                        'limit': 100,
                    },
                    timeout=30,
                )
                resp.raise_for_status()
                payload = resp.json()
            except _FETCH_ERRORS as e:
                logger.error("[ACLED] Request failed for %s: %s", country_name, e)
                continue

            if not payload.get('success'):
                logger.warning("[ACLED] API returned non-success for %s", country_name)
                continue

            events = payload.get('data', [])
            for evt in events:
                event_type = evt.get('event_type', '')
                # Filter to displacement-relevant event types
                if event_type not in self.RELEVANT_EVENT_TYPES:
                    continue

                # Parse date
                event_date = evt.get('event_date', '')
                try:
                    from datetime import datetime
                    ts = datetime.strptime(event_date, '%Y-%m-%d')
                    ts = timezone.make_aware(ts)
                except (ValueError, TypeError):
                    ts = timezone.now()

                # Find ISO3 back from country name
                iso3 = outbreak.iso3
                for k, v in ISO3_TO_ACLED.items():
                    if v == country_name:
                        iso3 = k
                        break

                fatalities = int(evt.get('fatalities', 0) or 0)
                location = evt.get('location', '') or evt.get('admin1', '')

                yield {
                    'ts': ts,
                    'kind': EventKind.MOBILITY,
                    'geo': location or iso3,
                    'payload_json': {
                        'source_name': 'ACLED',
                        'country_iso': iso3,
                        'event_type': event_type,
                        'sub_event_type': evt.get('sub_event_type', ''),
                        'location': location,
                        'admin1': evt.get('admin1', ''),
                        'admin2': evt.get('admin2', ''),
                        'fatalities': fatalities,
                        'notes': (evt.get('notes', '') or '')[:300],
                        'headline': (
                            f"[ACLED] {event_type}: {location or iso3} "
                            f"({fatalities} fatalities)"
                        ),
                        'acled_event_id': evt.get('event_id_cnty', ''),
                    },
                    'confidence': 0.90,
                    'source_ref': f"acled:{evt.get('event_id_cnty', evt.get('data_id', ''))}",
                }


# ═══════════════════════════════════════════════════════════════
# T-103: Global Forest Watch Deforestation Adaptor
# ═══════════════════════════════════════════════════════════════

class DeforestationAdaptor(SourceAdaptor):
    """
    Global Forest Watch integrated deforestation alerts (GLAD / RADD).

    Queries the GFW data API for recent tree cover loss alerts within the
    outbreak's country. Relevant for pathogens with environmental
    trigger_conditions including deforestation (Ebola, Marburg, Nipah).

    Gated on OUTBREAK_GFW_API_KEY and pathogen.profile_json.trigger_env_conditions
    containing 'deforestation_alert'.
    """
    name = 'deforestation'
    kinds_emitted = [EventKind.SIGNAL]

    GFW_API_BASE = 'https://data-api.globalforestwatch.org'

    def is_healthy(self) -> bool:
        return bool(os.getenv('OUTBREAK_GFW_API_KEY'))

    def fetch(self, outbreak: Outbreak) -> Iterable[dict]:
        triggers = (outbreak.pathogen.profile_json or {}).get(
            'trigger_env_conditions', [],
        )
        if 'deforestation_alert' not in triggers:
            logger.debug(
                "[GFW] Pathogen %s has no deforestation_alert trigger — skipping.",
                outbreak.pathogen.name,
            )
            return

        api_key = os.getenv('OUTBREAK_GFW_API_KEY', '')
        if not api_key:
            return

        iso = outbreak.iso3.upper()
        since = (timezone.now() - timedelta(days=90)).strftime('%Y-%m-%d')

        # Use the GFW country-level tree cover loss stats endpoint
        # This gives us recent deforestation metrics for the country.
        try:
            url = f'{self.GFW_API_BASE}/dataset/gfw_integrated_alerts/latest/query/iso'
            resp = http_requests.get(
                url,
                params={
                    'iso': iso,
                    'start_date': since,
                    'end_date': timezone.now().strftime('%Y-%m-%d'),
                    'aggregate_by': 'week',
                },
                headers={
                    'x-api-key': api_key,
                    'Accept': 'application/json',
                },
                timeout=30,
            )

            if resp.status_code == 401:
                logger.warning("[GFW] Auth failed — check OUTBREAK_GFW_API_KEY")
                return
            if resp.status_code == 404:
                # Fallback: try the simple country stats endpoint
                yield from self._fetch_country_stats(iso, api_key, since, outbreak)
                return

            resp.raise_for_status()
            data = resp.json()
        except _FETCH_ERRORS as e:
            logger.error("[GFW] Request failed for %s: %s", iso, e)
            # Try fallback
            yield from self._fetch_country_stats(iso, api_key, since, outbreak)
            return

        # Parse the response — structure varies by endpoint version
        results = data.get('data', data.get('results', []))
        if isinstance(results, list):
            for row in results:
                alert_count = row.get('alert_count', row.get('count', 0))
                week = row.get('week', row.get('date', ''))
                area_ha = row.get('area_ha', row.get('area', 0))

                if not alert_count:
                    continue

                yield {
                    'ts': timezone.now(),  # Aggregated data — use current time
                    'kind': EventKind.SIGNAL,
                    'geo': iso,
                    'payload_json': {
                        'source_name': 'Global Forest Watch',
                        'country_iso': iso,
                        'alert_count': alert_count,
                        'area_hectares': area_ha,
                        'period': str(week),
                        'headline': (
                            f"[GFW] {alert_count} deforestation alerts in "
                            f"{iso} ({area_ha:.0f} ha) — week of {week}"
                        ),
                    },
                    'confidence': 0.80,
                    'source_ref': f"gfw_alerts:{iso}:{week}",
                }

    def _fetch_country_stats(
        self, iso: str, api_key: str, since: str, outbreak: Outbreak,
    ) -> Iterable[dict]:
        """Fallback: fetch country-level tree cover loss summary."""
        try:
            url = f'{self.GFW_API_BASE}/dataset/umd_tree_cover_loss/latest/query'
            resp = http_requests.get(
                url,
                params={
                    'sql': (
                        f"SELECT SUM(area__ha) as total_loss_ha, "
                        f"umd_tree_cover_loss__year as year "
                        f"FROM data WHERE iso = '{iso}' "
                        f"GROUP BY umd_tree_cover_loss__year "
                        f"ORDER BY year DESC LIMIT 3"
                    ),
                },
                headers={
                    'x-api-key': api_key,
                    'Accept': 'application/json',
                },
                timeout=30,
            )
            if resp.status_code != 200:
                logger.warning("[GFW] Fallback stats failed (%d)", resp.status_code)
                return

            data = resp.json()
            rows = data.get('data', [])
            for row in rows:
                loss = row.get('total_loss_ha', 0)
                year = row.get('year', '')
                if not loss:
                    continue
                yield {
                    'ts': timezone.now(),
                    'kind': EventKind.SIGNAL,
                    'geo': iso,
                    'payload_json': {
                        'source_name': 'Global Forest Watch',
                        'country_iso': iso,
                        'total_loss_hectares': loss,
                        'year': year,
                        'headline': (
                            f"[GFW] {loss:,.0f} ha tree cover loss in "
                            f"{iso} ({year})"
                        ),
                    },
                    'confidence': 0.70,
                    'source_ref': f"gfw_loss:{iso}:{year}",
                }
        except _FETCH_ERRORS as e:
            logger.error("[GFW] Fallback stats request failed: %s", e)


# ═══════════════════════════════════════════════════════════════
# T-104: Animal Surveillance Adaptor (OneHealth DB)
# ═══════════════════════════════════════════════════════════════

class AnimalSurveillanceAdaptor(SourceAdaptor):
    """OneHealth animal events filtered by pathogen."""
    name = 'animal_surveillance'
    kinds_emitted = [EventKind.SIGNAL]

    def is_healthy(self) -> bool:
        return True

    def fetch(self, outbreak: Outbreak) -> Iterable[dict]:
        from django.db import connection

        target_isos = [outbreak.iso3] + list(outbreak.neighbor_iso3s or [])
        pathogen_kw = outbreak.pathogen.name.lower().split()[0]  # e.g. "ebola"

        query = """
            SELECT r.report_id, r.country_iso3, r.disease_name, r.report_date,
                   a.species, a.animals_sick, a.animals_dead
            FROM oh_disease_reports r
            JOIN oh_animal_events a ON r.report_id = a.report_id
            WHERE r.country_iso3 = ANY(%s)
            ORDER BY r.report_date DESC
            LIMIT 50
        """

        try:
            with connection.cursor() as cursor:
                cursor.execute(query, [target_isos])
                rows = cursor.fetchall()

            for row in rows:
                report_id, iso3, disease_name, report_date, species, sick, dead = row

                # Filter by pathogen name loosely
                if pathogen_kw not in disease_name.lower():
                    continue

                sick_n = int(sick or 0)
                dead_n = int(dead or 0)
                # Skip presence-only surveillance rows (no actual animal
                # mortality / sickness recorded). Emitting them buries the
                # genuine signals — the OneHealth source table contains a
                # lot of admin-empty stubs.
                if sick_n == 0 and dead_n == 0:
                    continue

                # Resolve country name for the headline so the officer reads
                # "in Democratic Republic of the Congo" rather than "in COD".
                country_name = ISO3_TO_ACLED.get(iso3, iso3)

                yield {
                    'ts': report_date or timezone.now(),
                    'kind': EventKind.SIGNAL,
                    'geo': iso3,
                    'payload_json': {
                        'report_id': report_id,
                        'country_iso': iso3,
                        'country_name': country_name,
                        'disease_name': disease_name,
                        'species': species,
                        'animals_sick': sick_n,
                        'animals_dead': dead_n,
                        'source_name': 'OneHealth Animal Surveillance',
                        'headline': (
                            f"Animal Alert: {species} affected by {disease_name} "
                            f"in {country_name} (Sick: {sick_n}, Dead: {dead_n})"
                        ),
                    },
                    'confidence': 0.85,
                    'source_ref': f"oh_animal:{report_id}",
                }
        except (DatabaseError, AttributeError, ValueError, TypeError) as e:
            logger.error("AnimalSurveillanceAdaptor query failed: %s", e)
            return []


# ═══════════════════════════════════════════════════════════════
# T-105: Climate Adaptor (NASA POWER — free, no key needed)
# ═══════════════════════════════════════════════════════════════

class ClimateAdaptor(SourceAdaptor):
    """
    NASA POWER rainfall + temperature anomaly data.

    The NASA POWER API is free and doesn't require authentication.
    We query monthly climatology vs recent data to detect anomalies
    relevant to climate-driven pathogens (Cholera, Malaria, Dengue,
    Rift Valley Fever, Ebola).
    """
    name = 'climate'
    kinds_emitted = [EventKind.SIGNAL]

    # NASA POWER API (free, no key needed)
    NASA_POWER_URL = 'https://power.larc.nasa.gov/api/temporal/monthly/point'

    CLIMATE_DRIVEN_PATHOGENS = {
        'Cholera', 'Malaria', 'Dengue', 'Rift Valley Fever',
        'Ebola Virus Disease',
    }

    # Approximate country centroids for NASA POWER (lat, lon)
    COUNTRY_CENTROIDS = {
        'AGO': (-12.5, 18.5), 'BEN': (9.3, 2.3), 'BWA': (-22.3, 24.7),
        'BFA': (12.4, -1.5), 'BDI': (-3.4, 29.9), 'CMR': (5.9, 12.7),
        'CAF': (6.6, 20.9), 'TCD': (15.4, 18.7), 'COG': (-4.3, 15.3),
        'COD': (-4.0, 21.8), 'CIV': (7.5, -5.5), 'GNQ': (1.7, 10.3),
        'ERI': (15.2, 39.8), 'SWZ': (-26.5, 31.5), 'ETH': (9.1, 40.5),
        'GAB': (-0.8, 11.6), 'GMB': (13.4, -15.4), 'GHA': (7.9, -1.0),
        'GIN': (9.9, -12.0), 'GNB': (12.0, -15.2), 'KEN': (-0.02, 37.9),
        'LSO': (-29.6, 28.2), 'LBR': (6.4, -9.4), 'MDG': (-18.8, 46.9),
        'MWI': (-13.3, 33.8), 'MLI': (17.6, -4.0), 'MRT': (21.0, -10.9),
        'MOZ': (-18.7, 35.5), 'NAM': (-22.6, 17.1), 'NER': (17.6, 8.1),
        'NGA': (9.1, 8.7), 'RWA': (-1.9, 29.9), 'SEN': (14.5, -14.5),
        'SLE': (8.5, -11.8), 'ZAF': (-30.6, 22.9), 'SSD': (6.9, 31.3),
        'TZA': (-6.4, 34.9), 'TGO': (8.6, 1.2), 'UGA': (1.4, 32.3),
        'ZMB': (-13.1, 28.0), 'ZWE': (-20.0, 30.0), 'DZA': (28.0, 1.7),
    }

    def is_healthy(self) -> bool:
        # NASA POWER is free; we gate on env var just for consistency
        return bool(os.getenv('OUTBREAK_NASA_POWER_API_KEY'))

    def fetch(self, outbreak: Outbreak) -> Iterable[dict]:
        if outbreak.pathogen.name not in self.CLIMATE_DRIVEN_PATHOGENS:
            return

        coords = self.COUNTRY_CENTROIDS.get(outbreak.iso3)
        if not coords:
            logger.warning("[Climate] No centroid for %s", outbreak.iso3)
            return

        lat, lon = coords
        now = timezone.now()
        # Get last 2 years of monthly data for anomaly detection
        start_year = now.year - 1
        end_year = now.year

        try:
            resp = http_requests.get(
                self.NASA_POWER_URL,
                params={
                    'parameters': 'PRECTOTCORR,T2M',
                    'community': 'AG',
                    'longitude': lon,
                    'latitude': lat,
                    'start': f'{start_year}01',
                    'end': f'{end_year}12',
                    'format': 'JSON',
                },
                timeout=30,
            )
            resp.raise_for_status()
            data = resp.json()
        except _FETCH_ERRORS as e:
            logger.error("[Climate] NASA POWER request failed: %s", e)
            return

        properties = data.get('properties', {})
        params = properties.get('parameter', {})
        precip = params.get('PRECTOTCORR', {})
        temp = params.get('T2M', {})

        if not precip:
            return

        # Compute simple anomaly: compare each month to 2-year average
        precip_vals = [v for v in precip.values() if isinstance(v, (int, float)) and v >= 0]
        avg_precip = sum(precip_vals) / len(precip_vals) if precip_vals else 0

        # Emit events for months with anomalous rainfall (>1.5x average)
        for month_key, rainfall in precip.items():
            if not isinstance(rainfall, (int, float)) or rainfall < 0:
                continue

            month_temp = temp.get(month_key, None)
            anomaly_ratio = rainfall / avg_precip if avg_precip > 0 else 0

            # Only emit if significantly above average
            if anomaly_ratio < 1.5:
                continue

            # Parse YYYYMM format
            year = month_key[:4]
            month = month_key[4:]

            yield {
                'ts': timezone.now(),
                'kind': EventKind.SIGNAL,
                'geo': outbreak.iso3,
                'payload_json': {
                    'source_name': 'NASA POWER',
                    'country_iso': outbreak.iso3,
                    'month': f'{year}-{month}',
                    'rainfall_mm': round(rainfall, 1),
                    'avg_rainfall_mm': round(avg_precip, 1),
                    'anomaly_ratio': round(anomaly_ratio, 2),
                    'temperature_c': round(month_temp, 1) if month_temp else None,
                    'headline': (
                        f"[Climate] Rainfall anomaly in {outbreak.iso3} "
                        f"({year}-{month}): {rainfall:.0f}mm vs "
                        f"{avg_precip:.0f}mm avg ({anomaly_ratio:.1f}x)"
                    ),
                },
                'confidence': 0.75,
                'source_ref': f"nasa_power:{outbreak.iso3}:{month_key}",
            }
