"""
AFRO Sentinel Watchtower - API Views
"""
import logging
import threading

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from utils.permissions import IsNotSupplierRole
from django.db.models import Count, Q
from django.db.models.functions import Coalesce
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter

from .filters import SignalFilter
from .models import Signal, DiseaseKeyword, SourceCredibility, SignalPriority, SignalStatus
from .serializers import (
    SignalListSerializer,
    SignalDetailSerializer,
    SignalCreateSerializer,
    SignalTriageSerializer,
    SignalStatsSerializer,
    DiseaseKeywordSerializer,
    SourceCredibilitySerializer
)


class SignalViewSet(viewsets.ModelViewSet):
    """
    API endpoint for disease/hazard signals.
    
    list: Get all signals (paginated, filterable)
    retrieve: Get signal details
    create: Create new signal (from ingestion)
    stats: Get aggregated statistics
    triage: Update signal priority/status

    Query parameters:
        date_from  – ISO date/datetime; only return signals created on or after
        date_to    – ISO date/datetime; only return signals created on or before
        all        – set to 'true' to skip the default 14-day window
    """
    queryset = Signal.objects.annotate(
        published_at=Coalesce('source_timestamp', 'created_at')
    )
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_class = SignalFilter
    search_fields = ['disease_name', 'original_text', 'translated_text', 'location_country']
    ordering_fields = ['published_at', 'created_at', 'source_timestamp', 'priority', 'confidence_score']
    ordering = ['-published_at']

    # Default time window (days) so the list endpoint never returns
    # month-old signals unless the caller explicitly opts out.
    DEFAULT_WINDOW_DAYS = 14

    # Hard ceiling — even if the frontend forgets to send `limit`, we never
    # return more than this many rows in a single list response.
    MAX_LIST_LIMIT = 300

    def get_queryset(self):
        qs = super().get_queryset()

        # Only apply the date window on list requests — retrieve / detail
        # endpoints should always find the signal by pk.
        if self.action != 'list':
            return qs

        date_from = self.request.query_params.get('date_from')
        date_to = self.request.query_params.get('date_to')
        show_all = self.request.query_params.get('all', '').lower() == 'true'

        if date_from:
            qs = qs.filter(created_at__gte=date_from)
        elif not show_all:
            # Default: last N days so stale signals don't pollute the feed
            from datetime import timedelta
            qs = qs.filter(
                created_at__gte=timezone.now() - timedelta(days=self.DEFAULT_WINDOW_DAYS)
            )

        if date_to:
            qs = qs.filter(created_at__lte=date_to)

        return qs

    def list(self, request, *args, **kwargs):
        """Override list to honour `?limit=N` param and cap response size."""
        queryset = self.filter_queryset(self.get_queryset())

        # Respect frontend `limit` param, capped to MAX_LIST_LIMIT
        try:
            limit = int(request.query_params.get('limit', self.MAX_LIST_LIMIT))
        except (TypeError, ValueError):
            limit = self.MAX_LIST_LIMIT
        limit = min(max(limit, 1), self.MAX_LIST_LIMIT)

        queryset = queryset[:limit]
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)
    
    def get_serializer_class(self):
        if self.action == 'list':
            return SignalListSerializer
        elif self.action == 'create':
            return SignalCreateSerializer
        elif self.action == 'triage':
            return SignalTriageSerializer
        return SignalDetailSerializer
    
    @action(detail=False, methods=['get'])
    def stats(self, request):
        """Get aggregated signal statistics"""
        queryset = self.get_queryset()
        
        # Total count
        total = queryset.count()
        
        # Count by priority
        by_priority = {
            'P1': queryset.filter(priority=SignalPriority.P1).count(),
            'P2': queryset.filter(priority=SignalPriority.P2).count(),
            'P3': queryset.filter(priority=SignalPriority.P3).count(),
            'P4': queryset.filter(priority=SignalPriority.P4).count(),
        }
        
        # Count by status
        by_status = {
            'new': queryset.filter(status=SignalStatus.NEW).count(),
            'triaged': queryset.filter(status=SignalStatus.TRIAGED).count(),
            'validated': queryset.filter(status=SignalStatus.VALIDATED).count(),
            'dismissed': queryset.filter(status=SignalStatus.DISMISSED).count(),
        }
        
        # Top countries
        by_country = list(
            queryset.values('location_country_iso')
            .annotate(count=Count('id'))
            .order_by('-count')[:10]
        )
        
        return Response({
            'total': total,
            'by_priority': by_priority,
            'by_status': by_status,
            'by_country': by_country,
        })
    
    @action(detail=True, methods=['post'])
    def triage(self, request, pk=None):
        """Update signal triage status"""
        signal = self.get_object()
        serializer = SignalTriageSerializer(data=request.data)
        
        if serializer.is_valid():
            signal.priority = serializer.validated_data['priority']
            signal.confidence_score = serializer.validated_data['confidence_score']
            signal.analyst_notes = serializer.validated_data.get('analyst_notes', '')
            signal.status = SignalStatus.TRIAGED
            signal.triaged_at = timezone.now()
            if request.user.is_authenticated:
                signal.triaged_by = request.user
            signal.save()
            
            return Response(SignalDetailSerializer(signal).data)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['post'])
    def validate(self, request, pk=None):
        """Mark signal as validated"""
        signal = self.get_object()
        signal.status = SignalStatus.VALIDATED
        signal.validated_at = timezone.now()
        if request.user.is_authenticated:
            signal.validated_by = request.user
        signal.save()
        
        return Response(SignalDetailSerializer(signal).data)
    
    @action(detail=True, methods=['post'])
    def dismiss(self, request, pk=None):
        """Dismiss signal"""
        signal = self.get_object()
        signal.status = SignalStatus.DISMISSED
        signal.analyst_notes = request.data.get('reason', signal.analyst_notes)
        signal.save()
        
        return Response(SignalDetailSerializer(signal).data)

    @action(detail=True, methods=['post'])
    def classify(self, request, pk=None):
        """Trigger AI classification for a specific signal."""
        signal = self.get_object()
        
        try:
            from sentinel.agent_classifier import classify_single_signal
            # Manual analyst-triggered run — allowed to send Telegram/email
            # if the severity + confidence + classification gates pass.
            # The scheduler does NOT pass this flag, so auto runs stay silent.
            result = classify_single_signal(signal, allow_notifications=True)
            
            # Refresh from DB
            signal.refresh_from_db()
            return Response({
                'status': 'classified',
                'ai_classification': signal.ai_classification,
                'ai_severity': signal.ai_severity,
                'ai_notification_scope': signal.ai_notification_scope,
                'ai_reasoning': signal.ai_reasoning,
                'ai_classified_at': signal.ai_classified_at,
                'signal': SignalDetailSerializer(signal).data,
            })
        except Exception as e:  # noqa: BLE001 — top-level view: any failure must return a structured error
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['get'])
    def ai_stats(self, request):
        """Get AI classification statistics."""
        queryset = self.get_queryset()
        classified = queryset.filter(ai_classification__isnull=False)
        
        return Response({
            'total_classified': classified.count(),
            'total_unclassified': queryset.filter(ai_classification__isnull=True).count(),
            'by_classification': {
                'area_alert': classified.filter(ai_classification='area_alert').count(),
                'continent_alert': classified.filter(ai_classification='continent_alert').count(),
                'no_alert': classified.filter(ai_classification='no_alert').count(),
                'uncertain': classified.filter(ai_classification='uncertain').count(),
            },
            'by_severity': {
                'critical': classified.filter(ai_severity='critical').count(),
                'high': classified.filter(ai_severity='high').count(),
                'moderate': classified.filter(ai_severity='moderate').count(),
                'low': classified.filter(ai_severity='low').count(),
            },
        })

    # ── Live ingestion trigger ──────────────────────────────────────
    _ingest_lock = threading.Lock()
    _ingest_running = False

    @action(detail=False, methods=['post'])
    def ingest(self, request):
        """Trigger live ingestion from all external sources (GDELT, WHO News,
        AllAfrica, ReliefWeb).  Runs in a background thread so the response
        returns immediately.  A lock prevents concurrent ingestion runs."""
        _logger = logging.getLogger('sentinel.views')

        if SignalViewSet._ingest_running:
            return Response(
                {'status': 'already_running',
                 'message': 'Ingestion is already in progress. New signals will appear shortly.'},
                status=status.HTTP_202_ACCEPTED,
            )

        def _run_ingest():
            from sentinel.ingestion import sync_live_data
            SignalViewSet._ingest_running = True
            try:
                results = sync_live_data()
                _logger.info('Background ingestion complete: %s', results)
            except Exception:  # noqa: BLE001 — background ingestion wrapper: must always clear the running flag
                _logger.exception('Background ingestion failed')
            finally:
                SignalViewSet._ingest_running = False

        thread = threading.Thread(target=_run_ingest, daemon=True)
        thread.start()

        return Response(
            {'status': 'started',
             'message': 'Ingestion started in background. Refresh in ~15s to see new signals.'},
            status=status.HTTP_202_ACCEPTED,
        )


class DiseaseKeywordViewSet(viewsets.ReadOnlyModelViewSet):
    """API endpoint for disease keywords (read-only)"""
    queryset = DiseaseKeyword.objects.all()
    serializer_class = DiseaseKeywordSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter]
    filterset_fields = ['category', 'default_priority']
    search_fields = ['disease_name', 'keywords_en', 'keywords_fr', 'keywords_sw', 'keywords_ha']


class SourceCredibilityViewSet(viewsets.ReadOnlyModelViewSet):
    """API endpoint for source credibility (read-only)"""
    queryset = SourceCredibility.objects.all()
    serializer_class = SourceCredibilitySerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['tier', 'source_type']


# ---------------------------------------------------------------------------
# Border Signals — Cross-border signal aggregation for PoE Intelligence
# ---------------------------------------------------------------------------

from rest_framework.views import APIView
from datetime import timedelta
from collections import defaultdict


class BorderSignalsView(APIView):
    """GET /api/v1/sentinel/border-signals/?days=30&priority=P1,P2,P3

    Aggregates cross-border signals for the PoE Command Center.
    Returns per-country signal counts, trends, and individual signal details
    for signals flagged as cross_border_risk=True or high-priority near borders.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        import logging
        _logger = logging.getLogger('sentinel.views')

        # Parse params
        try:
            days = int(request.query_params.get('days', 30))
        except (ValueError, TypeError):
            days = 30
        days = min(max(days, 1), 90)

        priority_str = request.query_params.get('priority', '')
        priority_filter = [p.strip() for p in priority_str.split(',') if p.strip()] if priority_str else []

        now = timezone.now()
        date_cutoff = now - timedelta(days=days)
        date_7d = now - timedelta(days=7)
        date_prev_7d = now - timedelta(days=14)

        # Query cross-border signals within the date window
        qs = Signal.objects.filter(
            created_at__gte=date_cutoff,
            status__in=['new', 'triaged', 'validated'],
        ).filter(
            Q(cross_border_risk=True) | Q(priority__in=['P1', 'P2']) | Q(source_tier=0)
        )

        if priority_filter:
            qs = qs.filter(priority__in=priority_filter)

        # Limit to avoid huge payloads (per mistakes.md)
        signals = list(qs.order_by('-created_at')[:500])

        # Count cross-border only
        cross_border_signals = [s for s in signals if s.cross_border_risk]
        total_cross_border = len(cross_border_signals)

        # Group by country
        by_country_map = defaultdict(list)
        for s in signals:
            country_key = s.location_country_iso or s.location_country or 'Unknown'
            by_country_map[country_key].append(s)

        # Build per-country aggregation
        by_country = []
        for country_key, country_signals in by_country_map.items():
            # Get counts by period
            count_7d = sum(1 for s in country_signals if s.created_at >= date_7d)
            count_30d = len(country_signals)

            # Trend: compare last 7d vs previous 7d
            count_prev_7d = sum(
                1 for s in country_signals
                if date_prev_7d <= s.created_at < date_7d
            )
            if count_7d > count_prev_7d * 1.3:
                trend = "increasing"
            elif count_7d < count_prev_7d * 0.7:
                trend = "decreasing"
            else:
                trend = "stable"

            # Top disease and highest priority
            disease_counts = defaultdict(int)
            highest_priority = 'P4'
            priority_rank = {'P1': 1, 'P2': 2, 'P3': 3, 'P4': 4}
            for s in country_signals:
                if s.disease_name:
                    disease_counts[s.disease_name] += 1
                if priority_rank.get(s.priority, 4) < priority_rank.get(highest_priority, 4):
                    highest_priority = s.priority

            top_disease = max(disease_counts, key=disease_counts.get) if disease_counts else None

            # Get country name and ISO from first signal
            first = country_signals[0]
            country_name = first.location_country or country_key
            iso3 = first.location_country_iso or ''

            # Individual signal details (top 10 most recent with lat/lng)
            nearest_poe_signals = []
            for s in sorted(country_signals, key=lambda x: x.created_at, reverse=True)[:10]:
                days_ago = (now - s.created_at).days
                nearest_poe_signals.append({
                    "id": s.id,
                    "disease": s.disease_name or "Unknown",
                    "lat": float(s.location_lat) if s.location_lat is not None else None,
                    "lng": float(s.location_lng) if s.location_lng is not None else None,
                    "priority": s.priority,
                    "ai_severity": s.ai_severity or "unknown",
                    "source_name": s.source_name or "",
                    "headline": (s.translated_text or s.original_text or "")[:200],
                    "days_ago": days_ago,
                    "cross_border_risk": s.cross_border_risk,
                    "source_tier": s.source_tier,
                })

            by_country.append({
                "country": country_name,
                "iso3": iso3,
                "signal_count_7d": count_7d,
                "signal_count_30d": count_30d,
                "trend": trend,
                "top_disease": top_disease,
                "highest_priority": highest_priority,
                "nearest_poe_signals": nearest_poe_signals,
            })

        # Sort by signal count descending
        by_country.sort(key=lambda c: c["signal_count_7d"], reverse=True)

        # Signals near PoE — for now count those with lat/lng (geo-located)
        signals_near_poe = sum(
            1 for s in cross_border_signals
            if s.location_lat is not None and s.location_lng is not None
        )

        return Response({
            "total_cross_border_signals": total_cross_border,
            "signals_near_poe": signals_near_poe,
            "by_country": by_country,
            "days_queried": days,
            "updated_at": now.isoformat(),
        })
