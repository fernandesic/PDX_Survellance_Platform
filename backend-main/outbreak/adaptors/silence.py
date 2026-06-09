"""
SilenceAdaptor (T-029).

Identifies districts that have a non-trivial reporting baseline and have
gone unexpectedly quiet — i.e. no events in the last 3× their median
inter-arrival gap. Emits one `silence_anomaly` event per district per
quiet streak (idempotent via source_ref).
"""

import logging
import statistics
from datetime import timedelta
from typing import Iterable

from django.db.models import Count
from django.utils import timezone

from outbreak.adaptors.base import SourceAdaptor
from outbreak.models import EventKind, Outbreak, OutbreakEvent

logger = logging.getLogger(__name__)


class SilenceAdaptor(SourceAdaptor):
    name = 'silence'
    kinds_emitted = [EventKind.SILENCE_ANOMALY]

    MIN_BASELINE_EVENTS = 4
    BASELINE_WINDOW_DAYS = 30
    SILENCE_MULTIPLIER = 3.0

    def fetch(self, outbreak: Outbreak) -> Iterable[dict]:
        now = timezone.now()
        baseline_start = now - timedelta(days=self.BASELINE_WINDOW_DAYS)

        # Find districts with enough recent activity to compute a baseline.
        active_geos = (
            OutbreakEvent.objects
            .filter(outbreak=outbreak, ts__gte=baseline_start)
            .exclude(geo='')
            .values('geo')
            .annotate(n=Count('id'))
            .filter(n__gte=self.MIN_BASELINE_EVENTS)
        )

        today_key = now.date().isoformat()

        for row in active_geos:
            geo = row['geo']
            timestamps = list(
                OutbreakEvent.objects
                .filter(outbreak=outbreak, geo=geo, ts__gte=baseline_start)
                .order_by('ts')
                .values_list('ts', flat=True)
            )
            if len(timestamps) < self.MIN_BASELINE_EVENTS:
                continue

            gaps_hours = [
                (timestamps[i] - timestamps[i - 1]).total_seconds() / 3600.0
                for i in range(1, len(timestamps))
            ]
            try:
                median_gap = statistics.median(gaps_hours)
            except statistics.StatisticsError:
                continue
            if median_gap <= 0:
                continue

            quiet_hours = (now - timestamps[-1]).total_seconds() / 3600.0
            if quiet_hours < median_gap * self.SILENCE_MULTIPLIER:
                continue

            yield {
                'ts': now,
                'kind': EventKind.SILENCE_ANOMALY,
                'geo': geo,
                'payload_json': {
                    'district': geo,
                    'median_gap_hours': round(median_gap, 2),
                    'quiet_for_hours': round(quiet_hours, 2),
                    'baseline_events': len(timestamps),
                    'last_seen': timestamps[-1].isoformat(),
                    'headline': (
                        f"District {geo} silent for {quiet_hours/24:.1f}d "
                        f"(baseline cadence {median_gap:.1f}h)"
                    ),
                },
                'confidence': 0.45,
                'source_ref': f"{geo}:{today_key}",
            }
