"""
HDIS Intelligence - Automated Trust Framework

Three-layer trust scoring (all deterministic, no AI):
  Layer 1: Source-Tier Auto-Trust
  Layer 2: Multi-Source Corroboration
  Layer 3: Composite Confidence Score

Each signal gets a trust level:
  ≥ 80  →  VERIFIED       (official source or heavily corroborated)
  60-79 →  CORROBORATED   (multiple independent sources agree)
  40-59 →  UNVERIFIED     (single source, plausible but unconfirmed)
  < 40  →  UNCONFIRMED    (weak signal, possibly noise)
"""

import logging
from datetime import timedelta
from django.utils import timezone
from sentinel.models import Signal

logger = logging.getLogger(__name__)


# ─── Layer 1: Source Tier Weights ─────────────────────────────────────

SOURCE_TIER_WEIGHTS = {
    1: 1.0,   # WHO, ReliefWeb, UN — auto-trust
    2: 0.65,  # Reuters, AllAfrica, major media
    3: 0.35,  # GDELT, unverified feeds
}


def get_source_tier_weight(signal: Signal) -> float:
    """Return trust weight based on source tier (0.0 – 1.0)."""
    return SOURCE_TIER_WEIGHTS.get(signal.source_tier, 0.3)


# ─── Layer 2: Multi-Source Corroboration ──────────────────────────────

CORROBORATION_WINDOW_HOURS = 48


def count_corroborating_sources(signal: Signal) -> int:
    """
    Count independent sources reporting a similar event.
    Similar = same disease + same country within 48h.
    """
    if not signal.disease_name or not signal.location_country_iso:
        return 0

    window_start = signal.created_at - timedelta(hours=CORROBORATION_WINDOW_HOURS)
    window_end = signal.created_at + timedelta(hours=CORROBORATION_WINDOW_HOURS)

    similar = Signal.objects.filter(
        disease_name=signal.disease_name,
        location_country_iso=signal.location_country_iso,
        created_at__gte=window_start,
        created_at__lte=window_end,
    ).exclude(id=signal.id)

    # Count unique source names (not duplicate articles from the same outlet)
    unique_sources = similar.values('source_name').distinct().count()
    return unique_sources


def corroboration_bonus(count: int) -> float:
    """Convert corroboration count to a 0.0 – 1.0 bonus."""
    if count >= 3:
        return 1.0
    elif count == 2:
        return 0.6
    elif count == 1:
        return 0.3
    return 0.0


# ─── Layer 3: Composite Score ─────────────────────────────────────────

RECENCY_DECAY_HOURS = 168  # 7-day linear decay


def recency_factor(signal: Signal) -> float:
    """Calculate recency factor (1.0 = just now, 0.0 = 7+ days old)."""
    age_hours = (timezone.now() - signal.created_at).total_seconds() / 3600
    return max(0.0, 1.0 - age_hours / RECENCY_DECAY_HOURS)


def compute_trust_score(signal: Signal) -> dict:
    """
    Compute composite trust score for a signal.

    Returns dict with score, trust_level, and component values.
    """
    tier_weight = get_source_tier_weight(signal)
    corr_count = count_corroborating_sources(signal)
    corr_bonus = corroboration_bonus(corr_count)
    disease_conf = (signal.confidence_score or 50) / 100.0
    recency = recency_factor(signal)

    # Weighted composite
    raw_score = (
        tier_weight * 0.40 +
        corr_bonus * 0.30 +
        disease_conf * 0.20 +
        recency * 0.10
    )
    score = int(round(raw_score * 100))
    score = max(0, min(100, score))

    # Determine trust level
    if score >= 80:
        trust_level = 'verified'
    elif score >= 60:
        trust_level = 'corroborated'
    elif score >= 40:
        trust_level = 'unverified'
    else:
        trust_level = 'unconfirmed'

    return {
        'score': score,
        'trust_level': trust_level,
        'source_tier_weight': tier_weight,
        'corroboration_count': corr_count,
        'disease_match_confidence': signal.confidence_score or 50,
        'recency_factor': round(recency, 3),
    }


# ─── Batch Processing ────────────────────────────────────────────────

def update_trust_scores(signal_ids=None):
    """
    (Re)compute and cache trust scores.
    If signal_ids is None, process all signals created in the last 7 days.
    """
    from hdis.models import TrustScore

    if signal_ids:
        signals = Signal.objects.filter(id__in=signal_ids)
    else:
        # Optimize: Only process signals from the last 24 hours to prevent N+1 query loop timeout
        # For full recalculation, pass explicit signal_ids
        cutoff = timezone.now() - timedelta(days=1)
        signals = Signal.objects.filter(created_at__gte=cutoff)

    updated = 0
    for signal in signals.iterator():
        result = compute_trust_score(signal)
        # Denorm tenant from parent signal so RLS will work in Phase 3.
        result['tenant_id'] = signal.tenant_id
        TrustScore.objects.update_or_create(
            signal=signal,
            defaults=result,
        )
        updated += 1

    logger.info(f"Trust scores updated for {updated} signals")
    return updated
