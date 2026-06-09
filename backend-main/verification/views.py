"""
Verification API views.

Mirrors the PDX convention (predictions/views.py): DRF ViewSets, the
list/detail serializer split via get_serializer_class, query-param filtering in
get_queryset, and @action sub-routes. Auth and tenant scoping are inherited
from the project defaults — CustomTokenAuthentication + IsAuthenticated set the
RLS `app.current_tenant`, so querysets are already tenant-filtered at the DB
layer (no manual .filter(tenant=...) needed; see utils/tenant_middleware.py).
"""

from datetime import timedelta

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Avg, Count
from django.utils import timezone

from .models import (
    PredictionSnapshot, OutcomeEvent, MatchVerdict, ScoreCard,
    VeracityIndex, ReviewTicket, CalibrationRecord, EbolaEvent, SourceAudit,
    EBOLA_LEAD_TIME_PREDICTION_CLASSES,
)
from .serializers import (
    PredictionSnapshotListSerializer, PredictionSnapshotDetailSerializer,
    OutcomeEventSerializer,
    MatchVerdictListSerializer, MatchVerdictDetailSerializer,
    ScoreCardSerializer, VeracityIndexSerializer,
    ReviewTicketSerializer, CalibrationRecordSerializer,
    EbolaEventSerializer, SourceAuditSerializer,
)


# ─── CAPTURE ────────────────────────────────────────────────────────

class PredictionSnapshotViewSet(viewsets.ReadOnlyModelViewSet):
    """Frozen, immutable prediction records. Read-only over the API."""
    queryset = PredictionSnapshot.objects.all()
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.action in ('retrieve', 'audit'):
            return PredictionSnapshotDetailSerializer
        return PredictionSnapshotListSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        params = self.request.query_params
        if (m := params.get('module')):
            qs = qs.filter(source_module__iexact=m)
        if (c := params.get('country')):
            qs = qs.filter(country_iso__iexact=c)
        if (d := params.get('disease')):
            qs = qs.filter(disease_name__iexact=d)
        if (pc := params.get('prediction_class')):
            qs = qs.filter(prediction_class__iexact=pc)
        cf = params.get('counterfactual')
        if cf is not None:
            qs = qs.filter(is_counterfactual=cf.lower() in ('1', 'true', 'yes'))
        return qs

    @action(detail=False, methods=['get'])
    def incomplete(self, request):
        """Snapshots missing model_version/computed_at (Change Brief §6 gap report)."""
        qs = self.get_queryset().filter(payload_complete=False)
        page = self.paginate_queryset(qs)
        ser = PredictionSnapshotListSerializer(page if page is not None else qs, many=True)
        if page is not None:
            return self.get_paginated_response(ser.data)
        return Response(ser.data)

    @action(detail=True, methods=['get'])
    def audit(self, request, pk=None):
        """Full payload + fingerprint for tamper audit."""
        snap = self.get_object()
        return Response(PredictionSnapshotDetailSerializer(snap).data)


class OutcomeEventViewSet(viewsets.ReadOnlyModelViewSet):
    """Real-world ground-truth events."""
    queryset = OutcomeEvent.objects.all()
    serializer_class = OutcomeEventSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()
        params = self.request.query_params
        if (c := params.get('country')):
            qs = qs.filter(country_iso__iexact=c)
        if (d := params.get('disease')):
            qs = qs.filter(disease_name__iexact=d)
        if (t := params.get('type')):
            qs = qs.filter(outcome_type__iexact=t)
        return qs


# ─── MATCH ──────────────────────────────────────────────────────────

class MatchVerdictViewSet(viewsets.ReadOnlyModelViewSet):
    """Match verdicts with audit evidence."""
    queryset = MatchVerdict.objects.select_related('snapshot').all()
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.action in ('retrieve',):
            return MatchVerdictDetailSerializer
        return MatchVerdictListSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        params = self.request.query_params
        if (v := params.get('verdict')):
            qs = qs.filter(verdict__iexact=v)
        if (m := params.get('module')):
            qs = qs.filter(snapshot__source_module__iexact=m)
        if (c := params.get('country')):
            qs = qs.filter(snapshot__country_iso__iexact=c)
        return qs

    @action(detail=False, methods=['get'])
    def summary(self, request):
        """Verdict distribution KPIs for the dashboard."""
        qs = self.get_queryset()
        dist = dict(qs.values_list('verdict').annotate(n=Count('id')))
        return Response({
            'total': qs.count(),
            'distribution': dist,
            'pending': qs.filter(verdict=MatchVerdict.VERDICT_PENDING).count(),
        })

    @action(detail=False, methods=['get'], url_path='ebola-lead-time')
    def ebola_lead_time(self, request):
        """
        Ebola PHEIC lead-time result (Proposal §7.3, success criterion #5):
        earliest Imminent/High-spillover signal vs the 17 May 2026 declaration.
        """
        qs = (self.get_queryset()
              .filter(snapshot__disease_name__iexact='ebola',
                      snapshot__prediction_class__in=EBOLA_LEAD_TIME_PREDICTION_CLASSES,
                      lead_time_days__isnull=False)
              .order_by('lead_time_days'))
        rows = MatchVerdictDetailSerializer(qs[:50], many=True).data
        earliest = qs.first()
        return Response({
            'pheic_declaration': '2026-05-17',
            'earliest_lead_time_days': earliest.lead_time_days if earliest else None,
            'n_signals': qs.count(),
            'verdicts': rows,
        })

    @action(detail=False, methods=['get'], url_path='alerts-coverage')
    def alerts_coverage(self, request):
        """
        Verifiability of the Alerts & Incidents dashboards.

        Answers: of everything shown on the alerts dashboard, how much has been
        confirmed real (Hit), shown to be a false alarm (False Alarm), or is
        still unverified (Pending — window not closed, or analyst hasn't
        resolved it)? `verifiable_pct` is the share that has reached a
        ground-truth verdict either way.
        """
        qs = self.get_queryset().filter(snapshot__source_module='alerts')
        total = qs.count()
        n_hit = qs.filter(verdict=MatchVerdict.VERDICT_HIT).count()
        n_partial = qs.filter(verdict=MatchVerdict.VERDICT_PARTIAL).count()
        n_fa = qs.filter(verdict=MatchVerdict.VERDICT_FALSE_ALARM).count()
        n_miss = qs.filter(verdict=MatchVerdict.VERDICT_MISS).count()
        n_pending = qs.filter(verdict=MatchVerdict.VERDICT_PENDING).count()
        n_excluded = qs.filter(verdict=MatchVerdict.VERDICT_EXCLUDED).count()
        resolved = n_hit + n_partial + n_fa + n_miss
        scorable = max(total - n_excluded, 0)

        # Per-country breakdown so you can see which countries' alert feeds are
        # well-verified vs noisy.
        by_country = {}
        for v in qs.select_related('snapshot'):
            iso = v.snapshot.country_iso or '??'
            b = by_country.setdefault(iso, {'total': 0, 'confirmed': 0,
                                            'false_alarm': 0, 'pending': 0})
            b['total'] += 1
            if v.verdict in (MatchVerdict.VERDICT_HIT, MatchVerdict.VERDICT_PARTIAL):
                b['confirmed'] += 1
            elif v.verdict == MatchVerdict.VERDICT_FALSE_ALARM:
                b['false_alarm'] += 1
            elif v.verdict == MatchVerdict.VERDICT_PENDING:
                b['pending'] += 1

        return Response({
            'total_alerts_tracked': total,
            'confirmed_real': n_hit + n_partial,
            'false_alarms': n_fa,
            'misses': n_miss,
            'unverified_pending': n_pending,
            'excluded': n_excluded,
            'verifiable_pct': round(100.0 * resolved / scorable, 1) if scorable else None,
            'false_alarm_rate_pct': round(100.0 * n_fa / scorable, 1) if scorable else None,
            'by_country': by_country,
        })


# ─── SCORE ──────────────────────────────────────────────────────────

class ScoreCardViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = ScoreCard.objects.all()
    serializer_class = ScoreCardSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()
        params = self.request.query_params
        if (g := params.get('granularity')):
            qs = qs.filter(granularity__iexact=g)
        if (m := params.get('module')):
            qs = qs.filter(source_module__iexact=m)
        if (c := params.get('country')):
            qs = qs.filter(country_iso__iexact=c)
        return qs

    @action(detail=False, methods=['get'])
    def latest(self, request):
        """Most recent scorecard per slice (one row per granularity+slice)."""
        qs = self.get_queryset().order_by(
            'granularity', 'source_module', 'country_iso', 'disease_name', '-computed_at',
        )
        seen, rows = set(), []
        for card in qs:
            key = (card.granularity, card.source_module, card.country_iso, card.disease_name)
            if key in seen:
                continue
            seen.add(key)
            rows.append(card)
        return Response(ScoreCardSerializer(rows, many=True).data)


class VeracityIndexViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = VeracityIndex.objects.all()
    serializer_class = VeracityIndexSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()
        if (lvl := self.request.query_params.get('level')):
            qs = qs.filter(level__iexact=lvl)
        if (m := self.request.query_params.get('module')):
            qs = qs.filter(source_module__iexact=m)
        return qs

    @action(detail=False, methods=['get'])
    def current(self, request):
        """
        The single platform-wide Veracity Index plus latest per-module values —
        the figure AFRO leadership cites (success criterion #4).
        """
        platform = (VeracityIndex.objects
                    .filter(level=VeracityIndex.LEVEL_PLATFORM)
                    .order_by('-computed_at').first())
        modules, seen = [], set()
        for vi in (VeracityIndex.objects
                   .filter(level=VeracityIndex.LEVEL_MODULE)
                   .order_by('source_module', '-computed_at')):
            if vi.source_module in seen:
                continue
            seen.add(vi.source_module)
            modules.append(vi)
        return Response({
            'platform': VeracityIndexSerializer(platform).data if platform else None,
            'modules': VeracityIndexSerializer(modules, many=True).data,
        })


# ─── FEEDBACK ───────────────────────────────────────────────────────

class ReviewTicketViewSet(viewsets.ModelViewSet):
    """
    Review tickets. Read + limited mutation (acknowledge / resolve / assign) —
    creation is automatic from the feedback engine, not via POST.
    """
    queryset = ReviewTicket.objects.all()
    serializer_class = ReviewTicketSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ['get', 'patch', 'head', 'options']

    def get_queryset(self):
        qs = super().get_queryset()
        params = self.request.query_params
        if (s := params.get('status')):
            qs = qs.filter(status__iexact=s)
        if (m := params.get('module')):
            qs = qs.filter(source_module__iexact=m)
        if (r := params.get('reason')):
            qs = qs.filter(reason__iexact=r)
        return qs

    @action(detail=True, methods=['patch'])
    def resolve(self, request, pk=None):
        ticket = self.get_object()
        note = request.data.get('resolution_note', '')
        if not isinstance(note, str):
            return Response(
                {'detail': 'resolution_note must be a string.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        ticket.close(status=ReviewTicket.STATUS_RESOLVED, note=note)
        return Response(ReviewTicketSerializer(ticket).data)


class CalibrationRecordViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Calibration API: PDX modules query the active record for a (module×disease)
    slice to auto-adjust confidence outputs (success criterion #3).
    """
    queryset = CalibrationRecord.objects.all()
    serializer_class = CalibrationRecordSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()
        params = self.request.query_params
        if params.get('active', 'true').lower() in ('1', 'true', 'yes'):
            qs = qs.filter(is_active=True)
        if (m := params.get('module')):
            qs = qs.filter(source_module__iexact=m)
        if (d := params.get('disease')):
            qs = qs.filter(disease_name__iexact=d)
        return qs

    @action(detail=False, methods=['get'])
    def lookup(self, request):
        """
        Single active multiplier/offset for a module(+disease). The endpoint a
        PDX module calls at prediction time.
        """
        module = request.query_params.get('module')
        disease = request.query_params.get('disease', '')
        if not module:
            return Response({'detail': 'module is required'},
                            status=status.HTTP_400_BAD_REQUEST)
        rec = (self.get_queryset()
               .filter(source_module__iexact=module, disease_name__iexact=disease)
               .order_by('-computed_at').first())
        if not rec:
            return Response({'module': module, 'disease': disease,
                             'suggested_multiplier': 1.0, 'suggested_offset': 0.0,
                             'note': 'no calibration data yet — pass-through'})
        return Response(CalibrationRecordSerializer(rec).data)


# ─── EBOLA TRACK ────────────────────────────────────────────────────

class EbolaEventViewSet(viewsets.ReadOnlyModelViewSet):
    """Append-only Ebola PHEIC event log (SSE/replay)."""
    queryset = EbolaEvent.objects.all()
    serializer_class = EbolaEventSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()
        params = self.request.query_params
        if (k := params.get('kind')):
            qs = qs.filter(event_kind__iexact=k)
        if (c := params.get('country')):
            qs = qs.filter(country_iso__iexact=c)
        return qs

    @action(detail=False, methods=['get'])
    def stats(self, request):
        """Event volume by kind over the last N days (default 1)."""
        try:
            days = int(request.query_params.get('days', 1))
        except (ValueError, TypeError):
            return Response(
                {'detail': 'days must be an integer.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        since = timezone.now() - timedelta(days=days)
        qs = self.get_queryset().filter(occurred_at__gte=since)
        by_kind = dict(qs.values_list('event_kind').annotate(n=Count('id')))
        return Response({'days': days, 'total': qs.count(), 'by_kind': by_kind})


class SourceAuditViewSet(viewsets.ReadOnlyModelViewSet):
    """Per-adaptor freshness / data-gap status."""
    queryset = SourceAudit.objects.all()
    serializer_class = SourceAuditSerializer
    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=['get'])
    def current(self, request):
        """Latest status per adaptor — the coverage-gap panel."""
        latest, seen = [], set()
        for row in self.get_queryset().order_by('adaptor', '-checked_at'):
            if row.adaptor in seen:
                continue
            seen.add(row.adaptor)
            latest.append(row)
        return Response(SourceAuditSerializer(latest, many=True).data)
