"""
Keyword-derived adaptors that re-mine existing sentinel signals (T-027, T-028, T-100, T-101).

Both `UnsafeBurialAdaptor` and `HcwInfectionAdaptor` scan the same
sentinel signals that `SentinelSignalAdaptor` already ingests — they
just project them onto richer event kinds when the text contains
keyword matches in EN/FR/Lingala/Swahili. No external API calls.
"""

import logging
from typing import Iterable

from django.utils import timezone

from outbreak.adaptors.base import SourceAdaptor
from outbreak.models import EventKind, Outbreak

logger = logging.getLogger(__name__)


UNSAFE_BURIAL_KEYWORDS = [
    # English
    'unsafe burial', 'traditional funeral', 'traditional burial',
    'home burial', 'family washed the body', 'touched the body',
    # French
    'enterrement traditionnel', 'enterrement non sécurisé',
    'rite funéraire', 'funérailles traditionnelles',
    # Portuguese
    'enterro tradicional', 'enterro inseguro',
    # Lingala / Swahili / Nande approximations
    'matanga', 'mazishi', 'kuzika',
]

HCW_KEYWORDS = [
    # English
    'health worker infected', 'health worker died', 'nurse infected',
    'nurse died', 'doctor infected', 'doctor died', 'hcw infection',
    'nosocomial', 'healthcare worker contaminated',
    # French
    'agent de santé contaminé', 'agent de santé infecté',
    'soignant contaminé', 'infirmière contaminée', 'médecin contaminé',
    # Portuguese
    'profissional de saúde infectado', 'enfermeira contaminada',
]


def _match(text: str, needles: list) -> str:
    if not text:
        return ''
    t = text.lower()
    for n in needles:
        if n in t:
            return n
    return ''


def _iter_sentinel_signals(outbreak):
    """
    Iterate sentinel signals already linked to this outbreak's pathogen +
    country footprint. Reuse the keyword list from sentinel_signal.
    """
    from sentinel.models import Signal
    from django.db.models import Q
    from outbreak.adaptors.sentinel_signal import PATHOGEN_KEYWORDS

    keywords = PATHOGEN_KEYWORDS.get(outbreak.pathogen.name, [outbreak.pathogen.name.lower()])
    keyword_q = Q()
    for kw in keywords:
        keyword_q |= Q(disease_name__icontains=kw)
        keyword_q |= Q(original_text__icontains=kw)
    target_isos = [outbreak.iso3] + list(outbreak.neighbor_iso3s or [])
    geo_q = Q()
    for iso in target_isos:
        geo_q |= Q(location_country_iso__iexact=iso)
    return Signal.objects.filter(keyword_q).filter(geo_q | Q(location_country_iso='')).order_by('-created_at')[:500]


class UnsafeBurialAdaptor(SourceAdaptor):
    name = 'unsafe_burial'
    kinds_emitted = [EventKind.BURIAL]

    def fetch(self, outbreak: Outbreak) -> Iterable[dict]:
        for sig in _iter_sentinel_signals(outbreak):
            text = ' '.join(filter(None, [sig.disease_name, sig.original_text or '']))
            hit = _match(text, UNSAFE_BURIAL_KEYWORDS)
            if not hit:
                continue
            yield {
                'ts': sig.source_timestamp or sig.created_at or timezone.now(),
                'kind': EventKind.BURIAL,
                'geo': sig.location_admin1 or sig.location_country or '',
                'payload_json': {
                    'signal_id': sig.id,
                    'matched_keyword': hit,
                    'country': sig.location_country,
                    'country_iso': sig.location_country_iso,
                    'district': sig.location_admin1,
                    'source_name': getattr(sig, 'source_name', '') or '',
                    'source_url': getattr(sig, 'source_url', '') or '',
                    'headline': (
                        (sig.original_text or sig.disease_name or '')[:160]
                    ),
                },
                'confidence': 0.55,
                'source_ref': f"signal:{sig.id}",
            }


class HcwInfectionAdaptor(SourceAdaptor):
    name = 'hcw_infection'
    kinds_emitted = [EventKind.HCW_INFECTION]

    def fetch(self, outbreak: Outbreak) -> Iterable[dict]:
        for sig in _iter_sentinel_signals(outbreak):
            text = ' '.join(filter(None, [sig.disease_name, sig.original_text or '']))
            hit = _match(text, HCW_KEYWORDS)
            if not hit:
                continue
            yield {
                'ts': sig.source_timestamp or sig.created_at or timezone.now(),
                'kind': EventKind.HCW_INFECTION,
                'geo': sig.location_admin1 or sig.location_country or '',
                'payload_json': {
                    'signal_id': sig.id,
                    'matched_keyword': hit,
                    'country': sig.location_country,
                    'country_iso': sig.location_country_iso,
                    'district': sig.location_admin1,
                    'source_name': getattr(sig, 'source_name', '') or '',
                    'source_url': getattr(sig, 'source_url', '') or '',
                    'headline': (sig.original_text or sig.disease_name or '')[:160],
                },
                'confidence': 0.60,
                'source_ref': f"signal:{sig.id}",
            }
