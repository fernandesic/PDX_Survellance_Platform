"""
SpilloverRiskAdaptor (T-021).

For each of the outbreak's neighbour iso3s, calls the spillover engine
to produce a forecast event with the current spillover score + stage.
Idempotent per day: source_ref encodes (iso3, YYYY-MM-DD).
"""

import logging
from typing import Iterable

from django.utils import timezone

from outbreak.adaptors.base import SourceAdaptor
from outbreak.models import EventKind, Outbreak

logger = logging.getLogger(__name__)


PATHOGEN_TO_SPILLOVER_KEY = {
    'Ebola Virus Disease': 'Ebola VD',
    'Ebola virus disease': 'Ebola VD',
    'Mpox': 'Mpox Clade I',
    'Mpox (Clade I)': 'Mpox Clade I',
    'Rift Valley Fever': 'Rift Valley Fever',
    'Marburg': 'Marburg',
    'Marburg Virus Disease': 'Marburg',
}

ISO3_TO_COUNTRY_NAME = {
    'AGO': 'Angola', 'BEN': 'Benin', 'BWA': 'Botswana',
    'BFA': 'Burkina Faso', 'BDI': 'Burundi', 'CMR': 'Cameroon',
    'CAF': 'Central African Republic', 'TCD': 'Chad',
    'COG': 'Congo', 'CIV': "Côte d'Ivoire",
    'COD': 'Democratic Republic of the Congo',
    'ETH': 'Ethiopia', 'GAB': 'Gabon', 'GHA': 'Ghana',
    'GIN': 'Guinea', 'KEN': 'Kenya', 'LBR': 'Liberia',
    'MWI': 'Malawi', 'MLI': 'Mali', 'MOZ': 'Mozambique',
    'NAM': 'Namibia', 'NER': 'Niger', 'NGA': 'Nigeria',
    'RWA': 'Rwanda', 'SEN': 'Senegal', 'SLE': 'Sierra Leone',
    'ZAF': 'South Africa', 'SSD': 'South Sudan',
    'TZA': 'United Republic of Tanzania', 'TGO': 'Togo',
    'UGA': 'Uganda', 'ZMB': 'Zambia', 'ZWE': 'Zimbabwe',
}


class SpilloverRiskAdaptor(SourceAdaptor):
    name = 'spillover_risk'
    kinds_emitted = [EventKind.FORECAST]

    def is_healthy(self) -> bool:
        try:
            from onehealth.spillover_engine import SpilloverEngine  # noqa: F401
            return True
        except ImportError:
            return False

    def fetch(self, outbreak: Outbreak) -> Iterable[dict]:
        from onehealth.spillover_engine import SpilloverEngine

        spillover_key = PATHOGEN_TO_SPILLOVER_KEY.get(outbreak.pathogen.name)
        if not spillover_key:
            logger.info(
                "spillover_risk: no spillover_engine mapping for pathogen %s",
                outbreak.pathogen.name,
            )
            return

        engine = SpilloverEngine()
        today = timezone.now().date().isoformat()

        # Evaluate the primary country + neighbours.
        target_isos = [outbreak.iso3] + list(outbreak.neighbor_iso3s or [])

        for iso3 in target_isos:
            country_name = ISO3_TO_COUNTRY_NAME.get(iso3, iso3)
            try:
                assessment = engine.assess_country(iso3, country_name, spillover_key)
            except Exception:  # noqa: BLE001 — per-country sweep: one bad assessment must not abort the rest
                logger.exception("spillover_risk: assess_country crashed for %s", iso3)
                continue
            if not assessment:
                continue

            yield {
                'ts': timezone.now(),
                'kind': EventKind.FORECAST,
                'geo': iso3,
                'payload_json': {
                    'country_iso': iso3,
                    'country': country_name,
                    'pathogen': outbreak.pathogen.name,
                    'spillover_score': assessment.get('composite_score'),
                    'stage': assessment.get('stage'),
                    'stage_label': assessment.get('stage_label'),
                    'p_spillover_30d': assessment.get('p_spillover_30d'),
                    'environmental_flags': assessment.get('environmental_flags', []),
                    'headline': (
                        f"Spillover risk {iso3}: "
                        f"{assessment.get('composite_score', '?')} "
                        f"({assessment.get('stage_label') or assessment.get('stage') or '?'})"
                    ),
                },
                'confidence': 0.70,
                'source_ref': f"{iso3}:{today}",
            }
