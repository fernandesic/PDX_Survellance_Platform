"""
Shared choice vocabularies for verification models.

Kept in a private module so every model file imports the same canonical
constants. Renames here are a single-point edit; the assertion at the
bottom fails loudly at import time if a subset references a key that
no longer exists.
"""

# PDX modules that emit verifiable predictions. Mirrors the module list in
# the Developer Change Brief and Proposal §5 (Phase 5 expansion targets).
SOURCE_MODULES = [
    ('predictions', 'Predictions / Composite Risk'),
    ('outbreak', 'Ebola Outbreak Workspace'),
    ('onehealth', 'One Health / Cross-Species Timeline'),
    ('alerts', 'Alerts & Incidents (alerts-v2)'),
    ('climate', 'Climate Module'),
    ('star', 'STAR Tracker'),
    ('sentinel', 'Sentinel Signals'),
    ('readiness', 'Readiness Assessment'),
    ('espar', 'IHR / e-SPAR'),
    ('ocv', 'OCV Dashboard'),
    ('pip', 'PIP Dashboard'),
    ('chw', 'CHW'),
    ('hdis', 'HDIS'),
]

# Verifiable prediction classes. #1-5 are the original proposal set; #6, #7,
# and #13 are the additions called out in the Developer Change Brief
# (province EIP distribution, intervention tier, One Health calibrated P).
# Named constants for the prediction_class keys — use these everywhere
# instead of bare string literals so that a rename in PREDICTION_CLASSES is
# a single-point edit and the consistency check below fails loudly at import
# time if a key disappears.
PREDICTION_CLASS_RISK_LEVEL = 'risk_level'
PREDICTION_CLASS_CASE_COUNT = 'case_count'
PREDICTION_CLASS_SPILLOVER_RANK = 'spillover_rank'
PREDICTION_CLASS_ALERT_CLUSTER = 'alert_cluster'
PREDICTION_CLASS_IMMINENT = 'imminent_class'
PREDICTION_CLASS_PROVINCE_DISTRIBUTION = 'province_distribution'
PREDICTION_CLASS_INTERVENTION_TIER = 'intervention_tier'
PREDICTION_CLASS_EPI_CURVE_WIS = 'epi_curve_wis'
PREDICTION_CLASS_SILENCE_DETECTION = 'silence_detection'
PREDICTION_CLASS_HCW_INFECTION = 'hcw_infection'
PREDICTION_CLASS_UNSAFE_BURIAL = 'unsafe_burial'
PREDICTION_CLASS_CLIMATE_CONFIDENCE = 'climate_confidence'
PREDICTION_CLASS_SPILLOVER_PROBABILITY = 'spillover_probability'

PREDICTION_CLASSES = [
    (PREDICTION_CLASS_RISK_LEVEL, '1 · Composite risk level (country×disease)'),
    (PREDICTION_CLASS_CASE_COUNT, '2 · Predicted case count at horizon'),
    (PREDICTION_CLASS_SPILLOVER_RANK, '3 · Neighbour spillover risk ranking'),
    (PREDICTION_CLASS_ALERT_CLUSTER, '4 · Alert cluster fires before WHO DON'),
    (PREDICTION_CLASS_IMMINENT, '5 · Imminent / High-spillover classification'),
    (PREDICTION_CLASS_PROVINCE_DISTRIBUTION, '6 · Province × disease case distribution (EIP)'),
    (PREDICTION_CLASS_INTERVENTION_TIER, '7 · Recommended intervention tier (EIP)'),
    (PREDICTION_CLASS_EPI_CURVE_WIS, '8 · Epi-curve trajectory (WIS)'),
    (PREDICTION_CLASS_SILENCE_DETECTION, '9 · District unusually-quiet detection'),
    (PREDICTION_CLASS_HCW_INFECTION, '10 · HCW infection event capture'),
    (PREDICTION_CLASS_UNSAFE_BURIAL, '11 · Unsafe burial event capture'),
    (PREDICTION_CLASS_CLIMATE_CONFIDENCE, '12 · Climate composite confidence (Brier)'),
    (PREDICTION_CLASS_SPILLOVER_PROBABILITY, '13 · Calibrated P(first human case) by date'),
]

# Subsets used by specific endpoints / services — keep them next to the
# vocabulary so they update in lock-step.
#
# Ebola PHEIC lead-time KPI (views.ebola_lead_time, Proposal §7.3 #5):
# the only two classes whose verdicts count toward lead-time vs the 17 May
# 2026 declaration.
EBOLA_LEAD_TIME_PREDICTION_CLASSES = (
    PREDICTION_CLASS_IMMINENT,
    PREDICTION_CLASS_SPILLOVER_PROBABILITY,
)

# Fail loudly at import time if any subset references a key that no longer
# exists in PREDICTION_CLASSES (e.g. someone renamed an entry above and
# forgot to update the subset).
_PREDICTION_CLASS_KEYS = {k for k, _ in PREDICTION_CLASSES}
assert set(EBOLA_LEAD_TIME_PREDICTION_CLASSES) <= _PREDICTION_CLASS_KEYS, (
    "EBOLA_LEAD_TIME_PREDICTION_CLASSES references prediction_class keys "
    "not present in PREDICTION_CLASSES — update both together."
)
