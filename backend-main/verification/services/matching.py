"""
STAGE 2 — MATCH
===============

Three-axis matching: for each PredictionSnapshot whose window has closed, ask
    1. Did an event of the predicted type occur?
    2. In the predicted country/region?
    3. Within the predicted time window?

…and assign a verdict (HIT / PARTIAL / MISS / FALSE_ALARM / PENDING /
EXCLUDED), storing structured evidence for human audit.

Counterfactual snapshots and provenance-incomplete snapshots are EXCLUDED
(Proposal §9; Change Brief §2 & §6). Lead time is computed for the Ebola
imminent/spillover classes as: signal_date − reference_event_date
(Change Brief §3: min(Imminent date) − 17 May 2026 PHEIC declaration).

The engine is deliberately framework-light (no DRF imports) so it can be
driven from a management command, a cron job, or a Celery task.
"""

import logging
from datetime import datetime, timedelta, timezone as dt_timezone

from django.db import transaction
from django.utils import timezone

from verification.models import (
    PredictionSnapshot, OutcomeEvent, MatchVerdict,
)
from verification.services.tenancy import resolve_record_tenant

logger = logging.getLogger(__name__)

# Ebola BDBV PHEIC declaration — the lead-time reference (Change Brief §1, §3).
PHEIC_DECLARATION = datetime(2026, 5, 17, tzinfo=dt_timezone.utc)

# Which OutcomeEvent.outcome_type values can satisfy each prediction_class.
CLASS_TO_OUTCOME_TYPES = {
    'risk_level': {'outbreak_confirmed', 'who_don', 'pheic_declared', 'case_observation'},
    'case_count': {'case_observation'},
    'spillover_rank': {'cross_border_import', 'first_human_case', 'outbreak_confirmed'},
    'alert_cluster': {'who_don', 'pheic_declared', 'outbreak_confirmed'},
    'imminent_class': {'pheic_declared', 'who_don', 'outbreak_confirmed', 'first_human_case'},
    'province_distribution': {'case_observation'},
    'intervention_tier': {'intervention_action'},
    'epi_curve_wis': {'case_observation'},
    'silence_detection': {'dhis2_gap'},
    'hcw_infection': {'hcw_infection'},
    'unsafe_burial': {'unsafe_burial'},
    'climate_confidence': {'case_observation', 'outbreak_confirmed'},
    'spillover_probability': {'first_human_case', 'cross_border_import'},
}

# Risk-level ordering for "partial" (off-by-one tier) judgement.
RISK_ORDER = {'LOW': 0, 'MEDIUM': 1, 'HIGH': 2, 'CRITICAL': 3}
TIER_ORDER = {'MONITOR': 0, 'STOCK_ORS': 1, 'MASS_CHLORINATION': 2, 'DEPLOY_CTC': 3}


def match_due_snapshots(now=None, lookback_days=400):
    """
    Match every snapshot whose window has closed and that has no verdict yet
    (or whose verdict is still PENDING). Returns a summary dict.
    """
    now = now or timezone.now()
    qs = (
        PredictionSnapshot.objects
        .filter(window_end__lte=now)
        .exclude(verdict__verdict__in=[
            MatchVerdict.VERDICT_HIT, MatchVerdict.VERDICT_PARTIAL,
            MatchVerdict.VERDICT_MISS, MatchVerdict.VERDICT_FALSE_ALARM,
            MatchVerdict.VERDICT_EXCLUDED,
        ])
    )
    summary = {'processed': 0, 'hit': 0, 'partial': 0, 'miss': 0,
               'false_alarm': 0, 'excluded': 0, 'pending': 0}
    for snap in qs.iterator():
        verdict = match_snapshot(snap, now=now)
        summary['processed'] += 1
        key = {
            MatchVerdict.VERDICT_HIT: 'hit',
            MatchVerdict.VERDICT_PARTIAL: 'partial',
            MatchVerdict.VERDICT_MISS: 'miss',
            MatchVerdict.VERDICT_FALSE_ALARM: 'false_alarm',
            MatchVerdict.VERDICT_EXCLUDED: 'excluded',
            MatchVerdict.VERDICT_PENDING: 'pending',
        }[verdict.verdict]
        summary[key] += 1
    return summary


def resolve_stale_pending(grace_days=0, now=None):
    """
    Force a verdict on snapshots that are still PENDING even though their window
    has closed (e.g. an alert no analyst ever validated, and no corroborating
    outcome arrived). Without this, such items would keep showing as
    "unverified" on the dashboard indefinitely and never count for or against
    accuracy.

    Rule: re-run the normal matcher (which, with the window now closed, decides
    HIT/PARTIAL/MISS/FALSE_ALARM from whatever outcomes exist). `grace_days`
    lets you wait N days past window_end before forcing, so late-arriving
    ground truth still has a chance to land first.

    Returns a summary dict of the verdicts assigned.
    """
    now = now or timezone.now()
    cutoff = now - timedelta(days=grace_days)
    qs = (PredictionSnapshot.objects
          .filter(window_end__lte=cutoff, verdict__verdict=MatchVerdict.VERDICT_PENDING))
    summary = {'resolved': 0, 'hit': 0, 'partial': 0, 'miss': 0,
               'false_alarm': 0, 'excluded': 0, 'still_pending': 0}
    for snap in qs.iterator():
        verdict = match_snapshot(snap, now=now)
        summary['resolved'] += 1
        key = {
            MatchVerdict.VERDICT_HIT: 'hit',
            MatchVerdict.VERDICT_PARTIAL: 'partial',
            MatchVerdict.VERDICT_MISS: 'miss',
            MatchVerdict.VERDICT_FALSE_ALARM: 'false_alarm',
            MatchVerdict.VERDICT_EXCLUDED: 'excluded',
            MatchVerdict.VERDICT_PENDING: 'still_pending',
        }[verdict.verdict]
        summary[key] += 1
    return summary


@transaction.atomic
def match_snapshot(snap: PredictionSnapshot, now=None):
    """Compute and persist the verdict for a single snapshot."""
    now = now or timezone.now()
    verdict, _ = MatchVerdict.objects.get_or_create(
        snapshot=snap,
        defaults={'tenant': resolve_record_tenant(snap.country_iso)},
    )

    # Exclusions first (counterfactual / incomplete provenance).
    if snap.is_counterfactual or not snap.payload_complete:
        verdict.verdict = MatchVerdict.VERDICT_EXCLUDED
        verdict.evidence_note = (
            'Counterfactual SEIRDV run — scenario sensitivity only.'
            if snap.is_counterfactual else
            'Excluded: payload missing model_version/computed_at.'
        )
        verdict.match_detail = {'excluded': True,
                                'is_counterfactual': snap.is_counterfactual,
                                'payload_complete': snap.payload_complete}
        verdict.save()
        return verdict

    # Window still open → pending.
    if snap.window_end > now:
        verdict.verdict = MatchVerdict.VERDICT_PENDING
        verdict.save()
        return verdict

    # Find candidate outcomes by type + geography + time.
    candidate_types = CLASS_TO_OUTCOME_TYPES.get(snap.prediction_class, set())
    candidates = OutcomeEvent.objects.filter(
        outcome_type__in=candidate_types,
        country_iso__iexact=snap.country_iso,
    )
    # Time axis: outcome occurs at/after window opens; allow events slightly
    # before window_end through to window_end for lead-time analysis.
    candidates = candidates.filter(
        occurred_at__gte=snap.window_start,
        occurred_at__lte=snap.window_end,
    )
    if snap.disease_name:
        candidates = candidates.filter(disease_name__iexact=snap.disease_name)
    if snap.province:
        candidates = candidates.filter(province__iexact=snap.province)

    candidates = list(candidates)

    disease_match = bool(candidates) or not snap.disease_name
    geography_match = all(c.country_iso.upper() == snap.country_iso.upper() for c in candidates) if candidates else False
    time_match = bool(candidates)

    verdict.disease_match = disease_match if candidates else False
    verdict.geography_match = geography_match
    verdict.time_match = time_match

    # Delegate to a per-class scorer for the nuanced verdict + error terms.
    decision = _decide(snap, candidates)
    verdict.verdict = decision['verdict']
    verdict.evidence_note = decision.get('note', '')
    verdict.abs_error = decision.get('abs_error')
    verdict.brier_component = decision.get('brier_component')
    verdict.wis_component = decision.get('wis_component')
    verdict.lead_time_days = decision.get('lead_time_days')
    verdict.match_detail = decision.get('detail', {})
    verdict.save()
    if candidates:
        verdict.matched_outcomes.set(candidates)
    return verdict


# ─────────────────────────────────────────────────────────────────────
# Per-class decision logic
# ─────────────────────────────────────────────────────────────────────

def _decide(snap, candidates):
    klass = snap.prediction_class
    handler = _HANDLERS.get(klass, _decide_event_capture)
    return handler(snap, candidates)


def _earliest(candidates):
    return min(candidates, key=lambda c: c.occurred_at) if candidates else None


def _lead_time_vs_pheic(snap):
    """min(Imminent classification date) − PHEIC date, in days (negative=early)."""
    ref = snap.computed_at or snap.window_start
    if ref is None:
        return None
    return (ref - PHEIC_DECLARATION).total_seconds() / 86400.0


def _decide_risk_level(snap, candidates):
    """Categorical risk level. Off-by-one tier = PARTIAL."""
    occurred = bool(candidates)
    pred = (snap.predicted_label or '').upper()
    asserted_positive = RISK_ORDER.get(pred, 0) >= RISK_ORDER['HIGH']
    if occurred and asserted_positive:
        return {'verdict': MatchVerdict.VERDICT_HIT,
                'note': f'Predicted {pred}; outbreak/DON confirmed in window.',
                'detail': {'predicted': pred, 'occurred': True}}
    if occurred and not asserted_positive:
        # Said LOW/MED but something happened → partial (right place, under-called).
        return {'verdict': MatchVerdict.VERDICT_PARTIAL,
                'note': f'Predicted {pred} but an event occurred — under-called.',
                'detail': {'predicted': pred, 'occurred': True}}
    if not occurred and asserted_positive:
        return {'verdict': MatchVerdict.VERDICT_FALSE_ALARM,
                'note': f'Predicted {pred}; no confirming event in window.',
                'detail': {'predicted': pred, 'occurred': False}}
    return {'verdict': MatchVerdict.VERDICT_MISS,
            'note': f'Predicted {pred}; nothing to confirm.',
            'detail': {'predicted': pred, 'occurred': False}}


def _decide_case_count(snap, candidates):
    """Point forecast on cases. HIT within ±25%% band, PARTIAL within ±50%%."""
    if not candidates:
        return {'verdict': MatchVerdict.VERDICT_MISS, 'note': 'No observed case data in window.'}
    observed = sum((c.observed_cases or 0) for c in candidates)
    predicted = snap.predicted_value or 0
    abs_error = abs(predicted - observed)
    rel = abs_error / observed if observed else (1.0 if predicted else 0.0)
    detail = {'predicted': predicted, 'observed': observed, 'rel_error': round(rel, 3)}
    if rel <= 0.25:
        v = MatchVerdict.VERDICT_HIT
    elif rel <= 0.50:
        v = MatchVerdict.VERDICT_PARTIAL
    else:
        v = MatchVerdict.VERDICT_MISS
    return {'verdict': v, 'abs_error': abs_error,
            'note': f'Predicted {predicted:.0f} vs observed {observed} ({rel:.0%} error).',
            'detail': detail}


def _decide_imminent(snap, candidates):
    """
    Imminent / High-spillover classification (Ebola track priority).
    HIT if the realised event occurred; lead time stored either way.
    """
    occurred = bool(candidates)
    lead = _lead_time_vs_pheic(snap)
    detail = {'lead_time_days': lead, 'asserted': snap.predicted_label or 'IMMINENT'}
    if occurred:
        first = _earliest(candidates)
        # Lead time vs the actual realised event, if that's the cleaner anchor.
        realised_lead = None
        if snap.computed_at and first:
            realised_lead = (snap.computed_at - first.occurred_at).total_seconds() / 86400.0
        detail['realised_event'] = first.outcome_type
        detail['lead_time_vs_event_days'] = realised_lead
        return {'verdict': MatchVerdict.VERDICT_HIT,
                'lead_time_days': lead,
                'note': f'Imminent call confirmed; lead vs PHEIC {lead:.1f}d.' if lead is not None
                        else 'Imminent call confirmed.',
                'detail': detail}
    return {'verdict': MatchVerdict.VERDICT_FALSE_ALARM,
            'lead_time_days': lead,
            'note': 'Imminent call not confirmed within window.',
            'detail': detail}


def _decide_alert_cluster(snap, candidates):
    """Cluster fires before WHO DON → HIT with negative (early) lead time."""
    if not candidates:
        return {'verdict': MatchVerdict.VERDICT_FALSE_ALARM,
                'note': 'Cluster fired; no WHO DON/declaration followed in window.'}
    don = _earliest(candidates)
    lead = None
    if snap.computed_at:
        lead = (snap.computed_at - don.occurred_at).total_seconds() / 86400.0
    win = lead is not None and lead < 0  # PDX cluster before DON = win
    return {'verdict': MatchVerdict.VERDICT_HIT if win else MatchVerdict.VERDICT_PARTIAL,
            'lead_time_days': lead,
            'note': (f'Cluster led WHO DON by {abs(lead):.1f}d.' if win
                     else 'Cluster confirmed but not ahead of DON.'),
            'detail': {'don_at': don.occurred_at.isoformat(), 'lead_time_days': lead}}


def _decide_probability(snap, candidates):
    """
    Calibrated probability classes (#12 climate, #13 spillover P).
    Verdict is coarse (HIT/MISS by p>=0.5); the Brier component carries the
    real signal and is aggregated into reliability diagrams at SCORE.
    """
    p = snap.predicted_probability
    if p is None:
        return {'verdict': MatchVerdict.VERDICT_EXCLUDED, 'note': 'No probability on payload.'}
    outcome = 1.0 if candidates else 0.0
    brier = (p - outcome) ** 2
    if outcome == 1.0:
        v = MatchVerdict.VERDICT_HIT if p >= 0.5 else MatchVerdict.VERDICT_MISS
    else:
        v = MatchVerdict.VERDICT_FALSE_ALARM if p >= 0.5 else MatchVerdict.VERDICT_HIT
    return {'verdict': v, 'brier_component': brier,
            'note': f'P={p:.2f}, outcome={outcome:.0f}, Brier={brier:.3f}.',
            'detail': {'p': p, 'outcome': outcome, 'brier': brier}}


def _decide_intervention_tier(snap, candidates):
    """Weighted-κ class (#7). Off-by-one tier = PARTIAL."""
    if not candidates:
        return {'verdict': MatchVerdict.VERDICT_MISS, 'note': 'No intervention recorded in window.'}
    predicted = (snap.predicted_label or '').upper()
    observed = (candidates[0].observed_label or '').upper()
    dp, do = TIER_ORDER.get(predicted), TIER_ORDER.get(observed)
    detail = {'predicted_tier': predicted, 'observed_tier': observed}
    if dp is not None and do is not None:
        gap = abs(dp - do)
        if gap == 0:
            return {'verdict': MatchVerdict.VERDICT_HIT, 'note': 'Tier matched.', 'detail': detail}
        if gap == 1:
            return {'verdict': MatchVerdict.VERDICT_PARTIAL, 'note': 'Tier off by one.', 'detail': detail}
    return {'verdict': MatchVerdict.VERDICT_MISS, 'note': 'Tier mismatch.', 'detail': detail}


def _decide_wis(snap, candidates):
    """
    Interval forecast (#8 epi-curve). Computes a single-window Weighted
    Interval Score component from quantiles in predicted_interval vs the
    observed value. Aggregated as wis_mean at SCORE.
    """
    if not candidates:
        return {'verdict': MatchVerdict.VERDICT_MISS, 'note': 'No epi-curve observation in window.'}
    observed = sum((c.observed_cases or 0) for c in candidates)
    quantiles = (snap.predicted_interval or {}).get('q', {})
    wis = _weighted_interval_score(quantiles, observed)
    detail = {'observed': observed, 'wis': wis, 'n_quantiles': len(quantiles)}
    # Coarse verdict: HIT if observed within central 50% interval, else PARTIAL/MISS.
    lo = quantiles.get('0.25'); hi = quantiles.get('0.75')
    if lo is not None and hi is not None and lo <= observed <= hi:
        v = MatchVerdict.VERDICT_HIT
    else:
        lo90 = quantiles.get('0.05'); hi90 = quantiles.get('0.95')
        v = (MatchVerdict.VERDICT_PARTIAL
             if (lo90 is not None and hi90 is not None and lo90 <= observed <= hi90)
             else MatchVerdict.VERDICT_MISS)
    return {'verdict': v, 'wis_component': wis,
            'note': f'WIS={wis:.2f} at observed {observed}.', 'detail': detail}


def _decide_event_capture(snap, candidates):
    """
    Generic recall-style classes: HCW infection (#10), unsafe burial (#11),
    silence detection (#9), spillover rank (#3), province distribution (#6).
    Captured the real event in window → HIT; asserted & nothing → FALSE_ALARM.
    """
    if candidates:
        return {'verdict': MatchVerdict.VERDICT_HIT,
                'note': f'Captured {len(candidates)} matching outcome(s).',
                'detail': {'n_matched': len(candidates)}}
    return {'verdict': MatchVerdict.VERDICT_FALSE_ALARM,
            'note': 'Flagged but no corroborating outcome in window.',
            'detail': {'n_matched': 0}}


_HANDLERS = {
    'risk_level': _decide_risk_level,
    'case_count': _decide_case_count,
    'imminent_class': _decide_imminent,
    'alert_cluster': _decide_alert_cluster,
    'climate_confidence': _decide_probability,
    'spillover_probability': _decide_probability,
    'intervention_tier': _decide_intervention_tier,
    'epi_curve_wis': _decide_wis,
}


def _weighted_interval_score(quantiles: dict, observed: float) -> float:
    """
    Weighted Interval Score (Bracher et al. 2021). `quantiles` maps quantile
    level (string, e.g. "0.025") to predicted value. Lower is better.

    WIS = (1/(K+0.5)) * [ 0.5*|median - y| + Σ_k (α_k/2)*IS_α_k ]
    where each central interval (α_k) contributes an interval score IS.
    """
    if not quantiles:
        return float('inf')
    q = {float(k): float(v) for k, v in quantiles.items()}
    median = q.get(0.5)
    if median is None:
        # Use the closest-to-0.5 quantile as the point proxy.
        median = q[min(q, key=lambda x: abs(x - 0.5))]

    # Pair lower/upper quantiles into central intervals.
    levels = sorted(q)
    pairs = []
    for lo in [l for l in levels if l < 0.5]:
        hi = round(1 - lo, 6)
        if hi in q:
            alpha = round(2 * lo, 6)
            pairs.append((alpha, q[lo], q[hi]))

    total = 0.5 * abs(median - observed)
    for alpha, lo_v, hi_v in pairs:
        width = hi_v - lo_v
        penalty_low = (2 / alpha) * (lo_v - observed) if observed < lo_v else 0.0
        penalty_high = (2 / alpha) * (observed - hi_v) if observed > hi_v else 0.0
        interval_score = width + penalty_low + penalty_high
        total += (alpha / 2) * interval_score

    k = len(pairs)
    return total / (k + 0.5)
