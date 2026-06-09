"""
Headline-field accessors for active outbreaks, sourced from the manually
uploaded tracker spreadsheet (see services/tracker_xlsx.py).

The OutbreakEvent stream is the audit trail; the snapshot functions below
project the most recent tracker rows into a shape the UI consumes
directly. No external surveillance feed is involved — case counts on the
outbreak page reflect whatever the superadmin most recently uploaded via
`POST /api/outbreak/upload-tracker/`.
"""

import logging
from typing import Optional

from outbreak.models import Outbreak, OutbreakEvent

logger = logging.getLogger(__name__)

TRACKER_SOURCE = 'manual_tracker'
TRACKER_DAILY_KIND = 'case'                # daily cumulative headline
TRACKER_BREAKDOWN_KIND = 'case'            # per health-zone breakdown
TRACKER_LAB_KIND = 'lab'                   # daily lab testing
TRACKER_REF_PREFIX_DAILY = 'manual_tracker:daily:'
TRACKER_REF_PREFIX_ZONE = 'manual_tracker:zone:'
TRACKER_REF_PREFIX_LAB = 'manual_tracker:lab:'


def _latest_tracker_event(outbreak: Outbreak, ref_prefix: str) -> Optional[OutbreakEvent]:
    return (
        OutbreakEvent.objects
        .filter(
            outbreak=outbreak,
            source=TRACKER_SOURCE,
            source_ref__startswith=ref_prefix,
        )
        .order_by('-ts')
        .first()
    )


def latest_tracker_snapshot(outbreak: Outbreak) -> Optional[dict]:
    """
    The most recent daily cumulative row uploaded for this outbreak.
    Drives the headline tile strip.
    """
    event = _latest_tracker_event(outbreak, TRACKER_REF_PREFIX_DAILY)
    if not event:
        return None
    p = event.payload_json or {}
    confirmed = _maybe_int(p.get('confirmed_cases'))
    deaths = _maybe_int(p.get('confirmed_deaths'))
    cfr_pct = None
    if confirmed and confirmed > 0 and deaths is not None:
        cfr_pct = round(deaths / confirmed * 100, 1)
    return {
        'as_of': p.get('as_of'),
        'confirmed_cases': confirmed,
        'confirmed_deaths': deaths,
        'suspected_cases': _maybe_int(p.get('suspected_cases')),
        'suspected_deaths': _maybe_int(p.get('suspected_deaths')),
        'new_confirmed_cases': _maybe_int(p.get('new_confirmed_cases')),
        'new_confirmed_deaths': _maybe_int(p.get('new_confirmed_deaths')),
        'new_suspected_cases': _maybe_int(p.get('new_suspected_cases')),
        'new_suspected_deaths': _maybe_int(p.get('new_suspected_deaths')),
        'total_contacts': _maybe_int(p.get('total_contacts')),
        'new_contacts': _maybe_int(p.get('new_contacts')),
        'cfr_pct': cfr_pct,
        'verification': p.get('verification') or '',
        'event_id': event.id,
        'retrieved_at': event.ts.isoformat(),
    }


def tracker_breakdown(outbreak: Outbreak) -> list[dict]:
    """
    Latest per-(province, health-zone) cumulative rows. Returns a list, one
    entry per zone, keyed on the most recent reporting date that zone has.

    Data-hygiene rules applied while building the breakdown:
      - Rows where both province and zone are blank → dropped (junk).
      - Rows where province is blank but zone is given → adopted into
        the country's most-active province ("most-active" = the province
        with the largest sum of confirmed_cases across its own rows).
        This handles the common case where a data-entry forgot the
        province cell but did fill the zone.
      - Zone "Unknown" is preserved as a real bucket — it means "case
        detected, zone not yet attributed" and is medically meaningful.
    """
    rows = list(
        OutbreakEvent.objects
        .filter(
            outbreak=outbreak,
            source=TRACKER_SOURCE,
            source_ref__startswith=TRACKER_REF_PREFIX_ZONE,
        )
        .order_by('-ts')
        .values_list('payload_json', flat=True)
    )

    # Pass 1: discover the most-active province in this outbreak so we can
    # adopt blank-province rows into it.
    prov_load: dict[str, int] = {}
    for p in rows:
        if not p:
            continue
        prov = (p.get('province') or '').strip()
        if not prov:
            continue
        prov_load[prov] = prov_load.get(prov, 0) + (_maybe_int(p.get('confirmed_cases')) or 0)
    primary_province = max(prov_load, key=prov_load.get) if prov_load else ''

    # Pass 2: project to one row per (province, zone), latest event wins.
    seen: dict[tuple[str, str], dict] = {}
    for p in rows:
        if not p:
            continue
        prov = (p.get('province') or '').strip()
        zone = (p.get('health_zone') or '').strip()
        if not prov and not zone:
            continue  # fully blank junk row

        # Reattribute orphan-province rows to the primary province.
        if not prov and zone and primary_province:
            prov = primary_province

        key = (prov, zone)
        if key in seen:
            continue
        seen[key] = {
            'province': prov,
            'health_zone': zone,
            'as_of': p.get('as_of'),
            'confirmed_cases': _maybe_int(p.get('confirmed_cases')),
            'confirmed_deaths': _maybe_int(p.get('confirmed_deaths')),
            'suspected_cases': _maybe_int(p.get('suspected_cases')),
            'suspected_deaths': _maybe_int(p.get('suspected_deaths')),
            'new_confirmed_cases': _maybe_int(p.get('new_confirmed_cases')),
            'new_suspected_cases': _maybe_int(p.get('new_suspected_cases')),
            'contacts': _maybe_int(p.get('contacts')),
        }

    # Drop any residual rows that still lack a province after adoption.
    return sorted(
        (r for r in seen.values() if r['province']),
        key=lambda r: (
            -(r['confirmed_cases'] or 0),
            -(r['suspected_cases'] or 0),
            r['province'],
            r['health_zone'],
        ),
    )


def latest_lab_snapshot(outbreak: Outbreak) -> Optional[dict]:
    """Most recent daily lab-testing row, or None."""
    event = _latest_tracker_event(outbreak, TRACKER_REF_PREFIX_LAB)
    if not event:
        return None
    p = event.payload_json or {}
    return {
        'as_of': p.get('as_of'),
        'samples_received': _maybe_int(p.get('samples_received')),
        'samples_analyzed': _maybe_int(p.get('samples_analyzed')),
        'positive_samples': _maybe_int(p.get('positive_samples')),
        'positivity_pct': _maybe_float_pct(p.get('test_positivity')),
        'daily_throughput': _maybe_int(p.get('daily_throughput')),
        'backlog': _maybe_int(p.get('backlog')),
        'event_id': event.id,
        'retrieved_at': event.ts.isoformat(),
    }


# ── small helpers ────────────────────────────────────────────────────────


def _maybe_int(v) -> Optional[int]:
    if v is None or v == '':
        return None
    try:
        return int(float(v))
    except (TypeError, ValueError):
        return None


def _maybe_float_pct(v) -> Optional[float]:
    """Tracker stores 0.61 (fraction); UI wants 61.0 (percent)."""
    if v is None or v == '' or v == '#DIV/0!':
        return None
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    if f <= 1.5:
        f = f * 100
    return round(f, 1)
