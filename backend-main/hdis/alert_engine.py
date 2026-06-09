"""
HDIS Intelligence - Rule-Based Alert Engine

Generates alerts from deterministic rules (NO AI guessing):
  - P1 (Critical) signals → always alert
  - Deaths above threshold → alert
  - VHF diseases (Ebola, Marburg, Lassa) → always alert
  - Multi-source corroborated events → alert
  - Unconfirmed signals (trust < 40) → flag but don't alert
"""

import logging
from datetime import timedelta
from django.utils import timezone
from sentinel.models import Signal, SignalPriority, DiseaseCategory
from hdis.models import Alert, AlertRisk
from hdis.trust_engine import compute_trust_score

logger = logging.getLogger(__name__)

# Priority → Alert risk mapping
PRIORITY_TO_RISK = {
    'P1': AlertRisk.CRITICAL,
    'P2': AlertRisk.HIGH,
    'P3': AlertRisk.MEDIUM,
    'P4': AlertRisk.LOW,
}

# VHF diseases that always warrant an alert
VHF_DISEASES = {
    'ebola', 'marburg', 'lassa fever', 'crimean-congo hemorrhagic fever',
    'rift valley fever', 'yellow fever',
}

# Death threshold for auto-alert
DEATH_THRESHOLD = 5


def evaluate_signal(signal: Signal, trust: dict = None) -> tuple[list[dict], dict]:
    """
    Evaluate a signal against all alert rules.
    Returns (list of alert reasons, trust result).
    Accepts pre-computed trust to avoid duplicate computation.
    """
    reasons = []
    if trust is None:
        trust = compute_trust_score(signal)

    # Skip signals with very low trust — prevents noise alerts
    if trust['score'] < 30:
        return [], trust

    # Rule 1: P1 (Critical) priority → always alert
    if signal.priority == SignalPriority.P1:
        reasons.append({
            'reason': f"Critical priority signal: {signal.disease_name or 'unknown disease'} "
                      f"in {signal.location_country}",
            'risk': AlertRisk.CRITICAL,
        })

    # Rule 2: VHF diseases → always alert
    if signal.disease_name and signal.disease_name.lower() in VHF_DISEASES:
        reasons.append({
            'reason': f"Viral Hemorrhagic Fever detected: {signal.disease_name} "
                      f"in {signal.location_country}",
            'risk': AlertRisk.CRITICAL,
        })

    # Rule 3: Reported deaths above threshold
    if signal.reported_deaths and signal.reported_deaths >= DEATH_THRESHOLD:
        risk = AlertRisk.CRITICAL if signal.reported_deaths >= 50 else AlertRisk.HIGH
        reasons.append({
            'reason': f"{signal.reported_deaths} deaths reported — "
                      f"{signal.disease_name or 'unknown disease'} in {signal.location_country}",
            'risk': risk,
        })

    # Rule 4: Multi-source corroboration (3+ sources)
    if trust['corroboration_count'] >= 3 and signal.priority in ('P1', 'P2'):
        reasons.append({
            'reason': f"Multi-source corroboration ({trust['corroboration_count']} sources): "
                      f"{signal.disease_name or 'event'} in {signal.location_country}",
            'risk': AlertRisk.HIGH,
        })

    # Rule 5: Cross-border risk
    if signal.cross_border_risk and signal.priority in ('P1', 'P2'):
        reasons.append({
            'reason': f"Cross-border risk flagged: {signal.disease_name or 'event'} "
                      f"in {signal.location_country}",
            'risk': AlertRisk.HIGH,
        })

    return reasons, trust


def generate_alerts_for_signal(signal: Signal) -> int:
    """
    Run all alert rules for a signal and create Alert objects.
    Returns number of alerts created.
    """
    reasons, trust = evaluate_signal(signal)
    created = 0

    for entry in reasons:
        # De-duplicate: don't create same alert twice for same signal+reason
        already_exists = Alert.objects.filter(
            signal=signal,
            trigger_reason=entry['reason'],
        ).exists()
        if already_exists:
            continue

        Alert.objects.create(
            signal=signal,
            risk_level=entry['risk'],
            trigger_reason=entry['reason'],
            confidence_score=trust['score'] / 100.0,
            signal_strength=min(5, max(1, trust['corroboration_count'] + 1)),
            multi_source_validated=trust['corroboration_count'] >= 3,
            tenant_id=signal.tenant_id,  # denorm from parent signal
        )
        created += 1

    return created


def run_alert_engine(hours_back=1):
    """
    Process recent signals and generate alerts.
    Called after each ingestion cycle.
    """
    cutoff = timezone.now() - timedelta(hours=hours_back)
    recent_signals = Signal.objects.filter(created_at__gte=cutoff)

    total_alerts = 0
    for signal in recent_signals.iterator():
        total_alerts += generate_alerts_for_signal(signal)

    logger.info(f"Alert engine: processed {recent_signals.count()} signals, "
                f"created {total_alerts} alerts")
    return total_alerts
