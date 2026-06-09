"""
STAGE 3 — SCORE
===============

Aggregates verdicts into accuracy metrics at every granularity
(global / module / country / disease / module×country / module×disease) and
rolls them up into per-module and platform-wide Veracity Index values.

Metric suite (Proposal §3 SCORE):
    Hit Rate, Precision, Recall, F1, False-Alarm Rate, Brier, WIS,
    weighted Cohen κ (intervention tier), mean Lead Time, reliability diagram.

Counterfactual / excluded verdicts never enter the denominator.
Pure-Python implementations (no sklearn dependency) keep the install light;
math mirrors the standard definitions.
"""

import logging
import math
from collections import defaultdict

from django.utils import timezone

from verification.models import (
    MatchVerdict, ScoreCard, VeracityIndex, SOURCE_MODULES,
)
from verification.services.tenancy import tenant_for_iso

logger = logging.getLogger(__name__)

V = MatchVerdict
SCORABLE = {V.VERDICT_HIT, V.VERDICT_PARTIAL, V.VERDICT_MISS, V.VERDICT_FALSE_ALARM}


def _safe_div(n, d):
    return (n / d) if d else None


# ─────────────────────────────────────────────────────────────────────
# Metric computation over a verdict population
# ─────────────────────────────────────────────────────────────────────

def compute_metrics(verdicts):
    """
    Compute the full metric suite for an iterable of MatchVerdict rows.
    Returns a dict ready to populate a ScoreCard.
    """
    verdicts = list(verdicts)
    counts = defaultdict(int)
    for v in verdicts:
        counts[v.verdict] += 1

    n_hit = counts[V.VERDICT_HIT]
    n_partial = counts[V.VERDICT_PARTIAL]
    n_miss = counts[V.VERDICT_MISS]
    n_fa = counts[V.VERDICT_FALSE_ALARM]
    n_pending = counts[V.VERDICT_PENDING]
    n_excluded = counts[V.VERDICT_EXCLUDED]
    n_total = len(verdicts)

    scored = [v for v in verdicts if v.verdict in SCORABLE]
    n_scored = len(scored)

    # Partial counts as half a hit in rate-style metrics.
    effective_hits = n_hit + 0.5 * n_partial

    hit_rate = _safe_div(effective_hits, n_scored)

    # Precision / Recall / F1 in a detection framing:
    #   TP = HIT (+ half PARTIAL), FP = FALSE_ALARM, FN = MISS.
    tp = effective_hits
    fp = n_fa
    fn = n_miss + 0.5 * n_partial
    precision = _safe_div(tp, tp + fp)
    recall = _safe_div(tp, tp + fn)
    f1 = (_safe_div(2 * precision * recall, precision + recall)
          if (precision and recall) else None)
    false_alarm_rate = _safe_div(n_fa, n_scored)

    # Brier — mean of stored components (probability classes only).
    briers = [v.brier_component for v in scored if v.brier_component is not None]
    brier = _safe_div(sum(briers), len(briers)) if briers else None

    # WIS — mean of finite components (interval classes only).
    wiss = [v.wis_component for v in scored
            if v.wis_component is not None and math.isfinite(v.wis_component)]
    wis_mean = _safe_div(sum(wiss), len(wiss)) if wiss else None

    # Mean lead time across verdicts that recorded one (negative = early).
    leads = [v.lead_time_days for v in verdicts if v.lead_time_days is not None]
    mean_lead = _safe_div(sum(leads), len(leads)) if leads else None

    # Weighted Cohen κ for intervention-tier verdicts.
    kappa = _weighted_cohen_kappa(scored)

    # Reliability diagram from probability-class verdicts.
    reliability = _reliability_bins(scored)

    veracity = _veracity_contribution(hit_rate, precision, brier, wis_mean, mean_lead)

    return {
        'n_total': n_total, 'n_hit': n_hit, 'n_partial': n_partial,
        'n_miss': n_miss, 'n_false_alarm': n_fa,
        'n_pending': n_pending, 'n_excluded': n_excluded,
        'hit_rate': hit_rate, 'precision': precision, 'recall': recall,
        'f1_score': f1, 'false_alarm_rate': false_alarm_rate,
        'brier_score': brier, 'wis_mean': wis_mean, 'cohen_kappa': kappa,
        'mean_lead_time_days': mean_lead, 'reliability': reliability,
        'veracity_contribution': veracity,
    }


def _weighted_cohen_kappa(verdicts):
    """
    Weighted (quadratic) Cohen κ for intervention-tier predictions, using the
    predicted/observed tiers stored in match_detail. Returns None if <2 usable.
    """
    from verification.services.matching import TIER_ORDER
    pairs = []
    for v in verdicts:
        if v.snapshot.prediction_class != 'intervention_tier':
            continue
        d = v.match_detail or {}
        p = TIER_ORDER.get((d.get('predicted_tier') or '').upper())
        o = TIER_ORDER.get((d.get('observed_tier') or '').upper())
        if p is not None and o is not None:
            pairs.append((p, o))
    n = len(pairs)
    if n < 2:
        return None
    k = max(TIER_ORDER.values()) + 1
    obs = [[0] * k for _ in range(k)]
    for p, o in pairs:
        obs[p][o] += 1
    row = [sum(obs[i]) for i in range(k)]
    col = [sum(obs[i][j] for i in range(k)) for j in range(k)]
    num = den = 0.0
    for i in range(k):
        for j in range(k):
            w = ((i - j) ** 2) / ((k - 1) ** 2)
            exp = row[i] * col[j] / n
            num += w * obs[i][j]
            den += w * exp
    return 1 - (num / den) if den else None


def _reliability_bins(verdicts, n_bins=10):
    """
    Reliability diagram for probability-class verdicts: bin by predicted-prob
    decile, compare mean predicted vs observed frequency (Change Brief §3,
    One Health calibration curve).
    """
    bins = [{'lo': i / n_bins, 'hi': (i + 1) / n_bins, 'preds': [], 'outcomes': []}
            for i in range(n_bins)]
    for v in verdicts:
        d = v.match_detail or {}
        p = d.get('p')
        outcome = d.get('outcome')
        if p is None or outcome is None:
            continue
        idx = min(int(p * n_bins), n_bins - 1)
        bins[idx]['preds'].append(p)
        bins[idx]['outcomes'].append(outcome)
    out = []
    for b in bins:
        if not b['preds']:
            continue
        out.append({
            'prob_bin': f"{b['lo']:.1f}-{b['hi']:.1f}",
            'predicted': round(sum(b['preds']) / len(b['preds']), 4),
            'observed': round(sum(b['outcomes']) / len(b['outcomes']), 4),
            'n': len(b['preds']),
        })
    return out


def _veracity_contribution(hit_rate, precision, brier, wis_mean, mean_lead):
    """
    Fold the metrics into a 0-100 slice score. Hit rate and precision pull up;
    Brier pulls down (skill = 1-Brier/0.25 floored at 0); early lead time
    gives a small bonus. Weighting is transparent and tunable.
    """
    parts, weights = [], []
    if hit_rate is not None:
        parts.append(hit_rate * 100); weights.append(0.40)
    if precision is not None:
        parts.append(precision * 100); weights.append(0.30)
    if brier is not None:
        brier_skill = max(0.0, 1 - brier / 0.25)  # 0.25 = no-skill Brier
        parts.append(brier_skill * 100); weights.append(0.20)
    if wis_mean is not None and math.isfinite(wis_mean):
        wis_skill = 1 / (1 + wis_mean)  # squashes to (0,1], lower WIS → higher
        parts.append(wis_skill * 100); weights.append(0.10)
    if not parts:
        return None
    base = sum(p * w for p, w in zip(parts, weights)) / sum(weights)
    if mean_lead is not None and mean_lead < 0:  # earned early-warning bonus
        base = min(100.0, base + min(5.0, abs(mean_lead) / 2))
    return round(base, 2)


# ─────────────────────────────────────────────────────────────────────
# ScoreCard generation across granularities
# ─────────────────────────────────────────────────────────────────────

def generate_scorecards(period_start=None, period_end=None):
    """
    Recompute ScoreCards for all granularities over the period and persist
    them. Returns the number of cards written.
    """
    now = timezone.now()
    period_end = period_end or now
    qs = MatchVerdict.objects.select_related('snapshot').filter(
        snapshot__captured_at__lte=period_end,
    )
    if period_start:
        qs = qs.filter(snapshot__captured_at__gte=period_start)
    verdicts = list(qs)

    written = 0
    written += _write_card(verdicts, 'global', period_start, period_end)

    by_module = defaultdict(list)
    by_country = defaultdict(list)
    by_disease = defaultdict(list)
    by_mod_country = defaultdict(list)
    by_mod_disease = defaultdict(list)
    for v in verdicts:
        s = v.snapshot
        by_module[s.source_module].append(v)
        by_country[s.country_iso].append(v)
        if s.disease_name:
            by_disease[s.disease_name].append(v)
        by_mod_country[(s.source_module, s.country_iso)].append(v)
        if s.disease_name:
            by_mod_disease[(s.source_module, s.disease_name)].append(v)

    for module, vs in by_module.items():
        written += _write_card(vs, 'module', period_start, period_end, source_module=module)
    for iso, vs in by_country.items():
        written += _write_card(vs, 'country', period_start, period_end,
                               country_iso=iso, tenant=tenant_for_iso(iso))
    for disease, vs in by_disease.items():
        written += _write_card(vs, 'disease', period_start, period_end, disease_name=disease)
    for (module, iso), vs in by_mod_country.items():
        written += _write_card(vs, 'module_country', period_start, period_end,
                               source_module=module, country_iso=iso, tenant=tenant_for_iso(iso))
    for (module, disease), vs in by_mod_disease.items():
        written += _write_card(vs, 'module_disease', period_start, period_end,
                               source_module=module, disease_name=disease)
    return written


def _write_card(verdicts, granularity, period_start, period_end,
                source_module='', country_iso='', disease_name='', tenant=None):
    if not verdicts:
        return 0
    metrics = compute_metrics(verdicts)
    ScoreCard.objects.create(
        granularity=granularity,
        source_module=source_module,
        country_iso=country_iso,
        disease_name=disease_name,
        period_start=period_start or min(v.snapshot.captured_at for v in verdicts),
        period_end=period_end,
        tenant=tenant,
        **metrics,
    )
    return 1


# ─────────────────────────────────────────────────────────────────────
# Veracity Index roll-up
# ─────────────────────────────────────────────────────────────────────

def compute_veracity_indices(period_start=None, period_end=None):
    """
    Roll module ScoreCards into per-module and platform-wide VeracityIndex
    rows, with trend_delta vs the previous computation.
    """
    period_end = period_end or timezone.now()
    qs = MatchVerdict.objects.select_related('snapshot').filter(
        snapshot__captured_at__lte=period_end,
    )
    if period_start:
        qs = qs.filter(snapshot__captured_at__gte=period_start)
    verdicts = list(qs)

    written = []
    module_values = []

    by_module = defaultdict(list)
    for v in verdicts:
        by_module[v.snapshot.source_module].append(v)

    for module, vs in by_module.items():
        m = compute_metrics(vs)
        val = m['veracity_contribution']
        if val is None:
            continue
        prev = (VeracityIndex.objects
                .filter(level=VeracityIndex.LEVEL_MODULE, source_module=module)
                .order_by('-computed_at').first())
        idx = VeracityIndex.objects.create(
            level=VeracityIndex.LEVEL_MODULE,
            source_module=module,
            index_value=val,
            n_predictions_scored=m['n_hit'] + m['n_partial'] + m['n_miss'] + m['n_false_alarm'],
            components={
                'hit_rate': m['hit_rate'], 'precision': m['precision'],
                'brier_score': m['brier_score'], 'wis_mean': m['wis_mean'],
                'mean_lead_time_days': m['mean_lead_time_days'],
            },
            trend_delta=(val - prev.index_value) if prev else None,
        )
        written.append(idx)
        module_values.append(val)

    # Platform-wide = mean of module indices (equal weight; tunable).
    if module_values:
        platform_val = round(sum(module_values) / len(module_values), 2)
        prev = (VeracityIndex.objects
                .filter(level=VeracityIndex.LEVEL_PLATFORM)
                .order_by('-computed_at').first())
        written.append(VeracityIndex.objects.create(
            level=VeracityIndex.LEVEL_PLATFORM,
            index_value=platform_val,
            n_predictions_scored=len([v for v in verdicts if v.verdict in SCORABLE]),
            components={'module_count': len(module_values),
                        'module_mean': platform_val},
            trend_delta=(platform_val - prev.index_value) if prev else None,
        ))
    return written
