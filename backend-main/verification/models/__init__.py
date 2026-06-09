"""
Verification App — Intelligence Verification & Feedback Loop
============================================================

The "referee layer" that sits beside PDX and answers the central question:
    "Did what we predicted actually happen — and how often are we right?"

This app does NOT modify PDX's prediction logic. It observes it. The data
model implements the four-stage pipeline from the Verification Proposal v2.0:

    1. CAPTURE   → PredictionSnapshot, OutcomeEvent   (immutable, fingerprinted)
    2. MATCH     → MatchVerdict                        (Hit / Partial / Miss / FA)
    3. SCORE     → ScoreCard, VeracityIndex            (aggregated metrics)
    4. FEEDBACK  → ReviewTicket, CalibrationRecord     (closes the loop)

Plus an append-only EbolaEvent log for the PHEIC SSE stream, and a
SourceAudit table for adaptor-health / data-gap tracking.

Tenant-scoped via PostgreSQL Row-Level Security, mirroring the pattern in
predictions/models.py and the policy SQL in predictions/migrations/0004 & 0006.
All `tenant` FKs point at account.Tenant and are populated from country_iso.

This module re-exports everything from the per-stage submodules so all
existing `from verification.models import X` call-sites keep working.
"""

# ── Shared vocabularies + named constants + import-time consistency assert ──
from ._vocab import (
    EBOLA_LEAD_TIME_PREDICTION_CLASSES,
    PREDICTION_CLASS_ALERT_CLUSTER,
    PREDICTION_CLASS_CASE_COUNT,
    PREDICTION_CLASS_CLIMATE_CONFIDENCE,
    PREDICTION_CLASS_EPI_CURVE_WIS,
    PREDICTION_CLASS_HCW_INFECTION,
    PREDICTION_CLASS_IMMINENT,
    PREDICTION_CLASS_INTERVENTION_TIER,
    PREDICTION_CLASS_PROVINCE_DISTRIBUTION,
    PREDICTION_CLASS_RISK_LEVEL,
    PREDICTION_CLASS_SILENCE_DETECTION,
    PREDICTION_CLASS_SPILLOVER_PROBABILITY,
    PREDICTION_CLASS_SPILLOVER_RANK,
    PREDICTION_CLASS_UNSAFE_BURIAL,
    PREDICTION_CLASSES,
    SOURCE_MODULES,
)

# ── Models, grouped by pipeline stage + ancillary streams ──
from .capture import OutcomeEvent, PredictionSnapshot
from .feedback import CalibrationRecord, ReviewTicket
from .match import MatchVerdict
from .score import ScoreCard, VeracityIndex
from .streams import EbolaEvent, SourceAudit

__all__ = [
    # vocab
    'SOURCE_MODULES',
    'PREDICTION_CLASSES',
    'PREDICTION_CLASS_RISK_LEVEL',
    'PREDICTION_CLASS_CASE_COUNT',
    'PREDICTION_CLASS_SPILLOVER_RANK',
    'PREDICTION_CLASS_ALERT_CLUSTER',
    'PREDICTION_CLASS_IMMINENT',
    'PREDICTION_CLASS_PROVINCE_DISTRIBUTION',
    'PREDICTION_CLASS_INTERVENTION_TIER',
    'PREDICTION_CLASS_EPI_CURVE_WIS',
    'PREDICTION_CLASS_SILENCE_DETECTION',
    'PREDICTION_CLASS_HCW_INFECTION',
    'PREDICTION_CLASS_UNSAFE_BURIAL',
    'PREDICTION_CLASS_CLIMATE_CONFIDENCE',
    'PREDICTION_CLASS_SPILLOVER_PROBABILITY',
    'EBOLA_LEAD_TIME_PREDICTION_CLASSES',
    # capture
    'PredictionSnapshot',
    'OutcomeEvent',
    # match
    'MatchVerdict',
    # score
    'ScoreCard',
    'VeracityIndex',
    # feedback
    'ReviewTicket',
    'CalibrationRecord',
    # streams
    'EbolaEvent',
    'SourceAudit',
]
