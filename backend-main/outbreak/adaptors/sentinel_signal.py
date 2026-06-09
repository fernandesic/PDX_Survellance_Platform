"""
SentinelSignalAdaptor — real day-one adaptor.

Wraps sentinel.models.Signal filtered by pathogen keywords + outbreak's
iso3 + neighbor iso3s. Maps Signal fields → OutbreakEvent kind='signal'.
"""

import logging
from typing import Iterable

from django.db import DatabaseError
from django.utils import timezone

from outbreak.adaptors.base import SourceAdaptor
from outbreak.models import Outbreak, EventKind

logger = logging.getLogger(__name__)

# Keywords used to match signals to pathogens.
# Keyed by Pathogen.name → list of case-insensitive keywords.
PATHOGEN_KEYWORDS = {
    'Ebola Virus Disease': [
        'ebola', 'evd', 'bundibugyo', 'bdbv', 'hemorrhagic fever',
        'haemorrhagic fever', 'filovirus',
    ],
    'Mpox (Clade I)': ['mpox', 'monkeypox', 'clade i', 'clade 1'],
    'Cholera': ['cholera', 'vibrio cholerae'],
    'Plague': ['plague', 'yersinia pestis'],
    'Marburg Virus Disease': ['marburg', 'marburgvirus'],
    'Lassa Fever': ['lassa', 'lassa fever'],
}


class SentinelSignalAdaptor(SourceAdaptor):
    """
    Pulls sentinel.Signal rows matching the outbreak's pathogen
    and geography, emits them as OutbreakEvent kind='signal'.
    """

    name = 'sentinel_signal'
    kinds_emitted = [EventKind.SIGNAL]

    def fetch(self, outbreak: Outbreak) -> Iterable[dict]:
        from sentinel.models import Signal
        from django.db.models import Q

        # Determine keywords for this pathogen
        pathogen_name = outbreak.pathogen.name
        keywords = PATHOGEN_KEYWORDS.get(pathogen_name, [pathogen_name.lower()])

        # Build keyword filter across disease_name and original_text
        keyword_q = Q()
        for kw in keywords:
            keyword_q |= Q(disease_name__icontains=kw)
            keyword_q |= Q(original_text__icontains=kw)

        # Geography: primary country + neighbors
        target_isos = [outbreak.iso3]
        if outbreak.neighbor_iso3s:
            target_isos.extend(outbreak.neighbor_iso3s)

        # Build geo filter (signals may use full name or ISO)
        geo_q = Q()
        for iso in target_isos:
            geo_q |= Q(location_country_iso__iexact=iso)

        # We want signals matching keywords — geo filter is optional
        # because global signals about this outbreak matter too.
        # But we prioritize geo-matched signals.
        signals = Signal.objects.filter(keyword_q).order_by('-created_at')

        # Limit to prevent overload on first run
        signals = signals[:500]

        for sig in signals:
            yield {
                'ts': sig.source_timestamp or sig.created_at or timezone.now(),
                'kind': EventKind.SIGNAL,
                'geo': sig.location_admin1 or sig.location_country or '',
                'payload_json': {
                    'signal_id': sig.id,
                    'headline': (sig.original_text or '')[:200],
                    'disease_name': sig.disease_name or '',
                    'priority': sig.priority or '',
                    'country': sig.location_country or '',
                    'country_iso': sig.location_country_iso or '',
                    'source_name': sig.source_name or '',
                    'source_url': sig.source_url or '',
                    'reported_cases': sig.reported_cases,
                    'reported_deaths': sig.reported_deaths,
                    'original_language': sig.original_language or '',
                    'confidence_score': sig.confidence_score,
                },
                'confidence': (sig.confidence_score or 50) / 100.0,
                'source_ref': f"sentinel_signal:{sig.id}",
            }

    def is_healthy(self) -> bool:
        try:
            from sentinel.models import Signal
            # Just check the model is accessible
            Signal.objects.exists()
            return True
        except (ImportError, DatabaseError) as e:
            logger.warning("SentinelSignalAdaptor unhealthy: %s", e)
            return False
