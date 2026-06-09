"""
HDIS Pillar Classification System
Deterministic keyword-based classifier for the 9 pillars of Health Diplomacy.
V2 — Fixed: no longer defaults everything to 'outbreak'. Uses weighted scoring.
"""

import logging
import re
from typing import List, Optional

logger = logging.getLogger(__name__)


class SignalPillar:
    """The 9 pillars of Health Diplomacy Intelligence."""
    OUTBREAK = 'outbreak'
    POLICY = 'policy'
    FUNDING = 'funding'
    VACCINE = 'vaccine'
    CONFLICT = 'conflict'
    CLIMATE = 'climate'
    AGREEMENT = 'agreement'
    WORKFORCE = 'workforce'
    UHC = 'uhc'

    CHOICES = [
        (OUTBREAK, 'Disease Outbreak & Surveillance'),
        (POLICY, 'Health Policy & Governance'),
        (FUNDING, 'Health Funding & Aid'),
        (VACCINE, 'Vaccine Diplomacy & Access'),
        (CONFLICT, 'Conflict & Health Systems'),
        (CLIMATE, 'Climate & Health'),
        (AGREEMENT, 'Health Agreements & Treaties'),
        (WORKFORCE, 'Health Workforce & Capacity'),
        (UHC, 'Universal Health Coverage'),
    ]


# ── Keyword sets per pillar ──
# IMPORTANT: Order is irrelevant — scoring determines the winner.
# Each pillar has strong keywords (weight 2) and normal keywords (weight 1).

PILLAR_KEYWORDS = {
    SignalPillar.OUTBREAK: {
        'strong': [
            'outbreak', 'epidemic', 'pandemic', 'endemic',
            'cholera', 'ebola', 'marburg', 'mpox', 'monkeypox', 'measles',
            'meningitis', 'yellow fever', 'polio', 'plague',
            'lassa fever', 'rift valley fever', 'dengue', 'chikungunya',
            'diphtheria', 'hepatitis', 'tuberculosis',
            'confirmed cases', 'suspected cases', 'death toll',
            'contact tracing', 'quarantine', 'isolation center',
            'disease outbreak notification', 'DON',
        ],
        'normal': [
            'malaria', 'typhoid', 'disease surveillance', 'epidemiological',
            'case fatality', 'cases reported', 'morbidity', 'mortality',
            'infection', 'pathogen', 'specimen', 'laboratory confirmed',
            'maladie', 'épidémie', 'cas confirmés',
        ],
    },
    SignalPillar.POLICY: {
        'strong': [
            'health policy', 'health legislation', 'health reform',
            'international health regulations', 'ihr compliance',
            'world health assembly', 'wha resolution',
            'health governance', 'health sector reform',
            'national health plan', 'health act',
            'health strategy', 'health agenda',
        ],
        'normal': [
            'minister of health', 'ministry of health',
            'who resolution', 'regional committee',
            'health system strengthening', 'hss',
            'regulation', 'regulatory', 'legislation',
            'framework', 'guideline', 'standard',
            'politique de santé', 'ministre de la santé',
            'summit', 'declaration', 'communiqué', 'resolution',
            'endorsed', 'adopted', 'approved', 'ratified',
            'african union', 'AU summit', 'ECDC',
        ],
    },
    SignalPillar.FUNDING: {
        'strong': [
            'global fund', 'gavi', 'pepfar', 'usaid health',
            'health funding', 'funding gap', 'defunding',
            'health financing', 'disbursement',
            'grant approved', 'replenishment',
            'funding cut', 'budget cut health',
            'donor pledge', 'health aid',
        ],
        'normal': [
            'domestic financing', 'bilateral aid',
            'oda health', 'development assistance',
            'world bank health', 'african development bank',
            'budget allocation', 'investment health',
            'funding', 'grant', 'donation', 'pledge',
            'million dollar', 'billion dollar',
            'financement', 'aide sanitaire',
        ],
    },
    SignalPillar.VACCINE: {
        'strong': [
            'vaccine', 'vaccination', 'immunization', 'immunisation',
            'covax', 'vaccine manufacturing', 'vaccine access',
            'vaccine diplomacy', 'vaccine rollout',
            'mrna', 'vaccine plant', 'vaccine factory',
            'routine immunization', 'mass vaccination',
        ],
        'normal': [
            'cold chain', 'dtp3', 'dtp coverage',
            'vaccine hesitancy', 'anti-vax',
            'cepi', 'vaccine alliance', 'pavm',
            'inoculation', 'booster', 'dose',
            'vaccin', 'campagne de vaccination',
        ],
    },
    SignalPillar.CONFLICT: {
        'strong': [
            'attack on health', 'hospital attack', 'clinic attack',
            'health facility attack', 'health worker killed',
            'medical neutrality', 'humanitarian crisis',
            'armed conflict health', 'violence against health',
        ],
        'normal': [
            'humanitarian access', 'humanitarian aid',
            'displacement', 'displaced', 'refugee',
            'internally displaced', 'idp',
            'supply chain disruption', 'medicine shortage',
            'blockade', 'siege', 'shelling',
            'conflict zone', 'insecurity', 'armed group',
            'crisis', 'emergency', 'war', 'military',
            'coup', 'instability', 'violence',
            'civilian', 'casualties',
        ],
    },
    SignalPillar.CLIMATE: {
        'strong': [
            'climate health', 'climate change health',
            'flood health', 'drought health', 'heatwave health',
            'climate adaptation health', 'climate-health',
            'food insecurity', 'malnutrition', 'famine',
            'climate resilience', 'climate action health',
            'heat stress', 'climate change and environment',
        ],
        'normal': [
            'heat-related', 'air quality', 'air pollution',
            'water-borne', 'water contamination',
            'extreme weather', 'el niño', 'la niña',
            'environmental health', 'cyclone', 'flood',
            'drought', 'food security', 'nutrition',
            'flooding', 'rainfall', 'deforestation',
            'desertification', 'climate displacement',
            'climate adaptation', 'climate-sensitive',
            'waterborne disease', 'vector-borne',
            'food crisis', 'harvest failure', 'crop failure',
            'climate vulnerability', 'weather event',
            'super pollutant', 'methane', 'black carbon',
        ],
    },
    SignalPillar.AGREEMENT: {
        'strong': [
            'pandemic treaty', 'pandemic accord', 'pandemic agreement',
            'health treaty', 'health agreement',
            'memorandum of understanding', 'mou',
            'cooperation agreement', 'health partnership',
            'health diplomacy', 'benefit-sharing', 'PABS',
            'IHR amendment', 'international health regulations amendment',
        ],
        'normal': [
            'bilateral health', 'cross-border health',
            'regional health cooperation',
            'international cooperation',
            'pathogen sharing', 'benefit sharing',
            'partnership', 'collaboration', 'cooperation',
            'signed agreement', 'accord',
            'negotiations', 'intergovernmental',
            'world health assembly', 'WHA resolution',
            'ratification', 'signatory',
            'INB', 'negotiating body', 'working group',
        ],
    },
    SignalPillar.WORKFORCE: {
        'strong': [
            'health worker', 'health workforce', 'healthcare worker',
            'nurse shortage', 'doctor shortage', 'brain drain',
            'community health worker', 'chw deployment',
            'human resources for health', 'medical migration',
            'health worker shortage', 'health worker agenda',
        ],
        'normal': [
            'medical training', 'health education',
            'health professional', 'clinician',
            'staffing', 'recruitment health',
            'fellowship', 'capacity building',
            'agent de santé', 'personnel de santé',
            'specialist', 'surgeon', 'midwife', 'midwives',
            'nursing', 'physician', 'pharmacist',
            'task shifting', 'health training',
            'medical school', 'health sciences',
            'retention', 'attrition', 'workforce planning',
        ],
    },
    SignalPillar.UHC: {
        'strong': [
            'universal health coverage', 'uhc',
            'primary health care', 'phc',
            'essential medicines', 'health insurance',
            'health equity', 'national health insurance',
            'social health insurance', 'SHIF',
            'essential health services',
        ],
        'normal': [
            'out-of-pocket', 'health expenditure',
            'service coverage', 'access to care',
            'health services', 'health system',
            'couverture sanitaire universelle',
            'financial protection', 'catastrophic spending',
            'health coverage', 'insurance scheme',
            'community-based health insurance', 'CBHI',
            'user fees', 'free healthcare',
            'essential package', 'benefit package',
            'health infrastructure', 'health facility',
        ],
    },
}

# Pre-compile regex patterns for performance
_PILLAR_PATTERNS = {}
for pillar, kw_groups in PILLAR_KEYWORDS.items():
    all_kws = kw_groups['strong'] + kw_groups['normal']
    escaped = [re.escape(kw) for kw in all_kws]
    _PILLAR_PATTERNS[pillar] = re.compile(
        r'\b(' + '|'.join(escaped) + r')',
        re.IGNORECASE
    )

# Separate strong patterns for weighting
_STRONG_PATTERNS = {}
for pillar, kw_groups in PILLAR_KEYWORDS.items():
    if kw_groups['strong']:
        escaped = [re.escape(kw) for kw in kw_groups['strong']]
        _STRONG_PATTERNS[pillar] = re.compile(
            r'\b(' + '|'.join(escaped) + r')',
            re.IGNORECASE
        )


def classify_pillar(text: str) -> str:
    """
    Classify a signal text into its primary pillar.
    Uses weighted scoring: strong keywords = 2 points, normal = 1 point.
    Returns 'outbreak' ONLY if outbreak keywords actually match.
    Returns 'policy' as neutral fallback for unclassifiable signals.
    """
    if not text:
        return SignalPillar.POLICY  # Neutral fallback, not outbreak

    scores = {}
    for pillar, pattern in _PILLAR_PATTERNS.items():
        matches = pattern.findall(text)
        if matches:
            # Count strong vs normal matches
            strong_count = 0
            if pillar in _STRONG_PATTERNS:
                strong_count = len(_STRONG_PATTERNS[pillar].findall(text))
            normal_count = len(matches) - strong_count
            scores[pillar] = (strong_count * 2) + normal_count

    if not scores:
        return SignalPillar.POLICY  # Neutral fallback for unclassifiable text

    return max(scores, key=scores.get)


def classify_pillars(text: str) -> List[str]:
    """
    Classify a signal text into ALL matching pillars (for cross-pillar signals).
    Returns list of pillars sorted by weighted score (descending).
    """
    if not text:
        return [SignalPillar.POLICY]

    scores = {}
    for pillar, pattern in _PILLAR_PATTERNS.items():
        matches = pattern.findall(text)
        if matches:
            strong_count = 0
            if pillar in _STRONG_PATTERNS:
                strong_count = len(_STRONG_PATTERNS[pillar].findall(text))
            normal_count = len(matches) - strong_count
            scores[pillar] = (strong_count * 2) + normal_count

    if not scores:
        return [SignalPillar.POLICY]

    return sorted(scores.keys(), key=lambda p: scores[p], reverse=True)
