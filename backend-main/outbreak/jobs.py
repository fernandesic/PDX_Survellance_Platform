"""
Outbreak Celery jobs that don't fit the per-outbreak ingest loop:

- auto_declare_outbreaks (T-023): create Outbreak rows from signal volume
- run_silence_anomaly_scan (T-029): scan active outbreaks for quiet districts
- generate_daily_sitreps (T-033/T-124): one sitrep per active outbreak per day
- run_all_adaptors_for_active (re-export of tasks.ingest with extra adaptors)
"""

import logging
from collections import Counter
from datetime import timedelta

from celery import shared_task
from django.utils import timezone

logger = logging.getLogger(__name__)


def _pathogen_iso_threshold():
    """Tunable via env in future — defaults match Task.md."""
    import os
    return (
        int(os.getenv('OUTBREAK_AUTO_DECLARE_N', '5')),
        int(os.getenv('OUTBREAK_AUTO_DECLARE_WINDOW_HOURS', '72')),
    )


@shared_task(name='outbreak.jobs.auto_declare_outbreaks')
def auto_declare_outbreaks():
    """
    Walk recent sentinel signals; for each (pathogen, iso3) bucket that
    crosses the declared threshold, create one Outbreak row (idempotent —
    only one active outbreak per (pathogen, iso3) is allowed by the unique
    constraint).
    """
    from sentinel.models import Signal
    from outbreak.adaptors.sentinel_signal import PATHOGEN_KEYWORDS
    from outbreak.models import Outbreak, OutbreakStatus, Pathogen
    from utils.tenant_tasks import tenant_context

    n_min, window_hours = _pathogen_iso_threshold()
    cutoff = timezone.now() - timedelta(hours=window_hours)

    created = []
    with tenant_context('0'):
        pathogens = list(Pathogen.objects.all())
        for pathogen in pathogens:
            keywords = PATHOGEN_KEYWORDS.get(pathogen.name, [pathogen.name.lower()])
            from django.db.models import Q
            kw_q = Q()
            for kw in keywords:
                kw_q |= Q(disease_name__icontains=kw)
                kw_q |= Q(original_text__icontains=kw)
            recent = Signal.objects.filter(kw_q, created_at__gte=cutoff).exclude(
                location_country_iso=''
            )
            by_iso = Counter(recent.values_list('location_country_iso', flat=True))
            for iso3, count in by_iso.items():
                if count < n_min:
                    continue
                iso3_norm = (iso3 or '').upper()[:3]
                if not iso3_norm:
                    continue
                exists = Outbreak.objects.filter(
                    pathogen=pathogen,
                    iso3=iso3_norm,
                    status__in=[OutbreakStatus.SUSPECTED, OutbreakStatus.CONFIRMED],
                ).exists()
                if exists:
                    continue
                ob = Outbreak.objects.create(
                    pathogen=pathogen,
                    iso3=iso3_norm,
                    status=OutbreakStatus.SUSPECTED,
                    summary=(
                        f"Auto-declared from {count} sentinel signals in "
                        f"last {window_hours}h."
                    ),
                )
                created.append({'id': ob.id, 'pathogen': pathogen.name, 'iso3': iso3_norm, 'signal_count': count})
                logger.info(
                    "[outbreak.auto_declare] Created outbreak %s for %s/%s (%d signals)",
                    ob.id, pathogen.name, iso3_norm, count,
                )

    return {'created': created}


@shared_task(name='outbreak.jobs.run_silence_scan')
def run_silence_scan():
    """Run the silence anomaly detector for every active outbreak."""
    from outbreak.adaptors.silence import SilenceAdaptor
    from outbreak.models import Outbreak
    from utils.tenant_tasks import tenant_context

    summary = {}
    with tenant_context('0'):
        for outbreak in Outbreak.objects.filter(status__in=['suspected', 'confirmed']):
            summary[outbreak.id] = SilenceAdaptor().run(outbreak)
    return summary


@shared_task(name='outbreak.jobs.generate_daily_sitreps')
def generate_daily_sitreps():
    """Generate one sitrep per active outbreak."""
    from outbreak.llm.sitrep import generate_sitrep
    from outbreak.models import Outbreak
    from utils.tenant_tasks import tenant_context

    summary = {}
    with tenant_context('0'):
        for outbreak in Outbreak.objects.filter(status__in=['suspected', 'confirmed']):
            try:
                summary[outbreak.id] = generate_sitrep(outbreak)
            except Exception as e:  # noqa: BLE001 — per-outbreak sitrep batch: one bad outbreak must not abort the rest
                logger.exception(
                    "Sitrep generation failed for outbreak %s", outbreak.id,
                )
                summary[outbreak.id] = {'ok': False, 'reason': f'crash:{e}'}
    return summary
