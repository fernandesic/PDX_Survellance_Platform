"""
Canned-query library (T-031 / T-126).

Deterministic aggregations the router uses instead of the LLM for the
~15 most common questions. Each function takes (outbreak, **kwargs)
and returns a dict with `answer`, `citations`, optional `chart_spec`.
"""

from collections import Counter
from datetime import timedelta
from typing import Callable, Dict

from django.db.models import Count
from django.utils import timezone


def _empty(label: str) -> dict:
    return {
        'answer': 'no data',
        'reason': label,
        'citations': [],
    }


def _events(outbreak):
    from outbreak.models import OutbreakEvent
    return OutbreakEvent.objects.filter(outbreak=outbreak)


def signals_last_24h(outbreak, **_):
    qs = _events(outbreak).filter(
        kind='signal',
        ts__gte=timezone.now() - timedelta(hours=24),
    )
    cite = list(qs.order_by('-ts').values_list('id', flat=True)[:8])
    return {
        'answer': f"{qs.count()} signals in the last 24 hours.",
        'citations': [f'evt:{i}' for i in cite],
        'value': qs.count(),
    }


def signals_last_7d(outbreak, **_):
    qs = _events(outbreak).filter(
        kind='signal',
        ts__gte=timezone.now() - timedelta(days=7),
    )
    cite = list(qs.order_by('-ts').values_list('id', flat=True)[:8])
    return {
        'answer': f"{qs.count()} signals in the last 7 days.",
        'citations': [f'evt:{i}' for i in cite],
        'value': qs.count(),
    }


def hcw_infections_to_date(outbreak, **_):
    qs = _events(outbreak).filter(kind='hcw_infection')
    cite = list(qs.order_by('-ts').values_list('id', flat=True)[:5])
    return {
        'answer': f"{qs.count()} HCW infection events recorded to date.",
        'citations': [f'evt:{i}' for i in cite],
        'value': qs.count(),
    }


def unsafe_burials_last_21d(outbreak, **_):
    qs = _events(outbreak).filter(
        kind='burial',
        ts__gte=timezone.now() - timedelta(days=21),
    )
    cite = list(qs.order_by('-ts').values_list('id', flat=True)[:5])
    return {
        'answer': f"{qs.count()} unsafe-burial events in the last 21 days.",
        'citations': [f'evt:{i}' for i in cite],
        'value': qs.count(),
    }


def days_since_last_signal(outbreak, **_):
    last = _events(outbreak).filter(kind='signal').order_by('-ts').first()
    if not last:
        return _empty('no_signals')
    delta = (timezone.now() - last.ts).days
    return {
        'answer': f"{delta} day(s) since the last new signal (event id {last.id}).",
        'citations': [f'evt:{last.id}'],
        'value': delta,
    }


def silence_anomalies_active(outbreak, **_):
    cutoff = timezone.now() - timedelta(days=14)
    qs = _events(outbreak).filter(kind='silence_anomaly', ts__gte=cutoff)
    cite = list(qs.order_by('-ts').values_list('id', flat=True)[:8])
    return {
        'answer': f"{qs.count()} active silence anomalies in the last 14 days.",
        'citations': [f'evt:{i}' for i in cite],
        'value': qs.count(),
    }


def signals_by_district_last_7d(outbreak, **_):
    cutoff = timezone.now() - timedelta(days=7)
    qs = _events(outbreak).filter(kind='signal', ts__gte=cutoff)
    by_geo = Counter(qs.values_list('geo', flat=True))
    if not by_geo:
        return _empty('no_signals')
    parts = ', '.join(f"{geo or 'unknown'}={n}" for geo, n in by_geo.most_common(10))
    cite = list(qs.order_by('-ts').values_list('id', flat=True)[:8])
    return {
        'answer': f"Signal counts by district last 7d: {parts}.",
        'citations': [f'evt:{i}' for i in cite],
    }


def top_districts_last_14d(outbreak, **_):
    cutoff = timezone.now() - timedelta(days=14)
    qs = _events(outbreak).filter(ts__gte=cutoff).exclude(geo='')
    top = (
        qs.values('geo').annotate(n=Count('id')).order_by('-n')[:3]
    )
    if not top:
        return _empty('no_events')
    parts = ', '.join(f"{row['geo']}={row['n']}" for row in top)
    cite = list(qs.order_by('-ts').values_list('id', flat=True)[:6])
    return {
        'answer': f"Top 3 districts by event volume in last 14d: {parts}.",
        'citations': [f'evt:{i}' for i in cite],
    }


def spillover_by_neighbor(outbreak, **_):
    cutoff = timezone.now() - timedelta(days=30)
    neighbors = outbreak.neighbor_iso3s or []
    if not neighbors:
        return _empty('no_neighbors')
    qs = _events(outbreak).filter(ts__gte=cutoff)
    counter: Counter = Counter()
    cite: list = []
    for evt in qs.order_by('-ts')[:300]:
        iso = (evt.payload_json or {}).get('country_iso')
        if iso and iso in neighbors:
            counter[iso] += 1
            if len(cite) < 6:
                cite.append(evt.id)
    if not counter:
        return _empty('no_neighbor_signals')
    parts = ', '.join(f"{iso}={n}" for iso, n in counter.most_common())
    return {
        'answer': f"Signal volume per neighbour (last 30d): {parts}.",
        'citations': [f'evt:{i}' for i in cite],
    }


def composite_risk_score(outbreak, **_):
    from outbreak.services.capacity import get_outbreak_capacity
    cap = get_outbreak_capacity(outbreak)
    composite = (cap.get('composite') or {})
    if not composite.get('data_available') or composite.get('score') is None:
        return _empty('composite_unavailable')
    return {
        'answer': (
            f"Composite risk score is {composite['score']:.0f}/100 "
            f"(risk level {composite.get('risk_level') or 'unknown'})."
        ),
        'citations': ['cap:composite'],
        'value': composite['score'],
    }


def chw_coverage_gaps(outbreak, **_):
    from outbreak.services.capacity import get_outbreak_capacity
    cap = get_outbreak_capacity(outbreak)
    chw = cap.get('chw') or {}
    if not chw.get('data_available'):
        return _empty('chw_unavailable')
    gaps = [d for d in chw.get('districts') or [] if d.get('gap_flag')]
    if not gaps:
        return {
            'answer': 'No districts flagged with CHW coverage gap (<20% active).',
            'citations': ['cap:chw'],
        }
    gaps_sorted = sorted(gaps, key=lambda d: d.get('active_pct') or 0)[:5]
    parts = '; '.join(
        f"{d['district']} ({(d.get('active_pct') or 0):.0f}%)" for d in gaps_sorted
    )
    return {
        'answer': f"CHW coverage gaps: {parts}.",
        'citations': ['cap:chw'],
    }


def ihr_bottleneck(outbreak, **_):
    from outbreak.services.capacity import get_outbreak_capacity
    cap = get_outbreak_capacity(outbreak)
    ihr = cap.get('ihr') or {}
    if not ihr.get('data_available'):
        return _empty('ihr_unavailable')
    weak = [c for c in (ihr.get('components') or []) if c.get('below_50')]
    if not weak:
        return {
            'answer': f"All IHR e-SPAR components ≥50 (overall {ihr.get('overall')}).",
            'citations': ['cap:ihr'],
        }
    weak_sorted = sorted(weak, key=lambda c: c.get('value') or 0)[:5]
    parts = '; '.join(f"{c['code']} {c['label']} {c['value']}" for c in weak_sorted)
    return {
        'answer': f"IHR e-SPAR bottlenecks (<50): {parts}.",
        'citations': ['cap:ihr'],
    }


def readiness_score(outbreak, **_):
    from outbreak.services.capacity import get_outbreak_capacity
    cap = get_outbreak_capacity(outbreak)
    readiness = cap.get('readiness') or {}
    if not readiness.get('data_available') or readiness.get('score') is None:
        return _empty('readiness_unavailable')
    gaps = '; '.join(
        f"{w['category']} {w['score']:.0f}" for w in (readiness.get('weakest') or [])[:3]
    )
    extra = f" Key gaps: {gaps}." if gaps else ''
    return {
        'answer': f"Disease readiness {readiness['score']:.0f}/100.{extra}",
        'citations': ['cap:readiness'],
    }


def signal_doubling_time(outbreak, **_):
    cutoff14 = timezone.now() - timedelta(days=14)
    cutoff7 = timezone.now() - timedelta(days=7)
    qs = _events(outbreak).filter(kind='signal', ts__gte=cutoff14)
    week_a = qs.filter(ts__lt=cutoff7).count()
    week_b = qs.filter(ts__gte=cutoff7).count()
    if not week_a or not week_b:
        return _empty('not_enough_data')
    ratio = week_b / week_a
    if ratio <= 1.0:
        verdict = 'declining or flat'
    else:
        import math
        days = 7 * math.log(2) / math.log(ratio)
        verdict = f"doubling roughly every {days:.1f} day(s)"
    cite = list(qs.order_by('-ts').values_list('id', flat=True)[:6])
    return {
        'answer': (
            f"Week-on-week signal ratio is {ratio:.2f}× ({week_a}→{week_b}); {verdict}."
        ),
        'citations': [f'evt:{i}' for i in cite],
    }


# ── Router ──────────────────────────────────────────────────────────────

CANNED: Dict[str, Callable] = {
    'signals_last_24h': signals_last_24h,
    'signals_last_7d': signals_last_7d,
    'hcw_infections_to_date': hcw_infections_to_date,
    'unsafe_burials_last_21d': unsafe_burials_last_21d,
    'days_since_last_signal': days_since_last_signal,
    'silence_anomalies_active': silence_anomalies_active,
    'signals_by_district_last_7d': signals_by_district_last_7d,
    'top_districts_last_14d': top_districts_last_14d,
    'spillover_by_neighbor': spillover_by_neighbor,
    'composite_risk_score': composite_risk_score,
    'chw_coverage_gaps': chw_coverage_gaps,
    'ihr_bottleneck': ihr_bottleneck,
    'readiness_score': readiness_score,
    'signal_doubling_time': signal_doubling_time,
}


# Cheap keyword routing. Order matters — first match wins.
_ROUTES = [
    ('signals_last_24h', ['signals last 24', 'signals in 24', 'past 24 hours signals', 'signals today']),
    ('signals_last_7d', ['signals last 7', 'signals this week', 'signals in 7 days', 'past 7 days signals']),
    ('hcw_infections_to_date', ['hcw infection', 'health worker infection', 'agent de santé', 'nurse infected']),
    ('unsafe_burials_last_21d', ['unsafe burial', 'burials', 'enterrement']),
    ('days_since_last_signal', ['days since', 'last new signal', 'how long since']),
    ('silence_anomalies_active', ['silence anomal', 'silent district', 'quiet district']),
    ('signals_by_district_last_7d', ['signals by district', 'district signals', 'where are signals']),
    ('top_districts_last_14d', ['top districts', 'most affected district', 'busiest district']),
    ('spillover_by_neighbor', ['spillover by neighbour', 'spillover by neighbor', 'neighbor risk', 'neighbour risk']),
    ('composite_risk_score', ['composite risk', 'overall risk', 'how risky', 'can we respond']),
    ('chw_coverage_gaps', ['chw coverage', 'community health worker', 'chw gap']),
    ('ihr_bottleneck', ['ihr bottleneck', 'espar bottleneck', 'ihr gap', 'espar weak']),
    ('readiness_score', ['readiness', 'how prepared', 'preparation']),
    ('signal_doubling_time', ['doubling time', 'growth rate', 'are cases doubling']),
]


def route(question: str) -> str:
    """Map a free-text question to a canned-query name, or empty string."""
    q = (question or '').lower()
    for name, needles in _ROUTES:
        for needle in needles:
            if needle in q:
                return name
    return ''
