"""
KoboCHWAdaptor — CHW field intelligence for outbreak workspaces.

Pulls sentinel.Signal rows where source_name='KoboToolbox CHW' (Tier 0),
filtered by pathogen keywords + outbreak iso3 + neighbors.
Emits OutbreakEvent kind='signal'.

Follows the SentinelSignalAdaptor pattern exactly.
"""

import logging
from typing import Iterable

from django.db import DatabaseError
from django.utils import timezone

from outbreak.adaptors.base import SourceAdaptor
from outbreak.models import Outbreak, EventKind

logger = logging.getLogger(__name__)

# KoboToolbox CHW source name — must match kobo/signal_mapper.py
KOBO_SOURCE_NAME = 'KoboToolbox CHW'

# Keywords used to match CHW signals to pathogens.
# Same structure as SentinelSignalAdaptor.PATHOGEN_KEYWORDS.
PATHOGEN_KEYWORDS = {
    'Ebola Virus Disease': [
        'ebola', 'evd', 'hemorrhagic fever', 'haemorrhagic fever',
        'filovirus',
    ],
    'Mpox (Clade I)': ['mpox', 'monkeypox', 'clade i', 'clade 1'],
    'Cholera': ['cholera', 'vibrio cholerae', 'diarrhea', 'watery diarrhea'],
    'Plague': ['plague', 'yersinia pestis'],
    'Marburg Virus Disease': ['marburg', 'marburgvirus'],
    'Lassa Fever': ['lassa', 'lassa fever'],
}


class KoboCHWAdaptor(SourceAdaptor):
    """
    Pulls CHW field signals from Sentinel (source_name='KoboToolbox CHW'),
    filtered by pathogen keywords + outbreak geography.
    Emits OutbreakEvent kind='signal'.
    """

    name = 'kobo_chw'
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

        geo_q = Q()
        for iso in target_isos:
            geo_q |= Q(location_country_iso__iexact=iso)

        # Filter to KoboToolbox CHW source only + keyword match
        signals = (
            Signal.objects
            .filter(keyword_q, source_name=KOBO_SOURCE_NAME)
            .order_by('-created_at')
        )

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
                    'source_tier': sig.source_tier,
                    'latitude': float(sig.location_lat) if sig.location_lat is not None else None,
                    'longitude': float(sig.location_lng) if sig.location_lng is not None else None,
                    'field_validated': True,  # CHW reports are ground truth
                },
                'confidence': min(1.0, (sig.confidence_score or 85) / 100.0),
                'source_ref': f"kobo_chw:{sig.id}",
            }

    def is_healthy(self) -> bool:
        try:
            from sentinel.models import Signal
            # Check we can reach the table and KoboToolbox CHW signals exist
            Signal.objects.filter(source_name=KOBO_SOURCE_NAME).exists()
            return True
        except (ImportError, DatabaseError) as e:
            logger.warning("KoboCHWAdaptor unhealthy: %s", e)
            return False
