"""
HDIS Intelligence - API Views
Reads from sentinel's Signal model, enriches with trust scores.
Provides the REST API that HDIS-PRO frontend consumes.
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.filters import SearchFilter, OrderingFilter
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Count, Q
from django.db import DatabaseError, transaction, IntegrityError
from django.utils import timezone
from django.core.cache import cache
from datetime import timedelta
import threading
import requests as _requests

from sentinel.models import Signal, SourceCredibility
from sentinel.serializers import SourceCredibilitySerializer
from hdis.models import Alert, Briefing, TrustScore, BriefingGenerationJob, JobStatus
from hdis.serializers import (
    IntelRecordSerializer,
    IntelRecordDetailSerializer,
    AlertSerializer,
    BriefingSerializer,
    DashboardStatsSerializer,
)

import logging
logger = logging.getLogger(__name__)


class IntelRecordViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Intelligence records — sentinel Signals enriched with trust data.

    list:   GET /api/v1/hdis/records/
    detail: GET /api/v1/hdis/records/{id}/
    stats:  GET /api/v1/hdis/records/stats/
    """
    queryset = Signal.objects.select_related('trust').all()
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['priority', 'status', 'location_country_iso', 'disease_category', 'source_tier', 'pillar']
    search_fields = ['original_text', 'disease_name', 'location_country']
    ordering_fields = ['created_at', 'priority', 'confidence_score']
    ordering = ['-created_at']

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return IntelRecordDetailSerializer
        return IntelRecordSerializer

    def get_queryset(self):
        qs = super().get_queryset()

        # HDIS-specific filters that map to sentinel fields
        risk_level = self.request.query_params.get('risk_level')
        if risk_level:
            mapping = {'critical': 'P1', 'high': 'P2', 'medium': 'P3', 'low': 'P4'}
            priority = mapping.get(risk_level)
            if priority:
                qs = qs.filter(priority=priority)

        event_type = self.request.query_params.get('event_type')
        if event_type == 'outbreak':
            qs = qs.filter(signal_type='disease')

        country_tag = self.request.query_params.get('country_tag')
        if country_tag:
            qs = qs.filter(location_country_iso=country_tag)

        trust_level = self.request.query_params.get('trust_level')
        if trust_level:
            qs = qs.filter(trust__trust_level=trust_level)

        search_query = self.request.query_params.get('q')
        if search_query:
            qs = qs.filter(original_text__icontains=search_query)

        return qs

    @action(detail=False, methods=['get'])
    def stats(self, request):
        """Dashboard KPI statistics — cached for 60s, single query."""
        cache_key = 'hdis_dashboard_stats'
        cached = cache.get(cache_key)
        if cached:
            return Response(cached)

        qs = Signal.objects.all()

        # Single aggregation for counts
        agg = qs.aggregate(
            total=Count('id'),
            p1=Count('id', filter=Q(priority='P1')),
            p2=Count('id', filter=Q(priority='P2')),
            p3=Count('id', filter=Q(priority='P3')),
            p4=Count('id', filter=Q(priority='P4')),
        )

        by_priority = {
            'critical': agg['p1'],
            'high': agg['p2'],
            'medium': agg['p3'],
            'low': agg['p4'],
        }

        # Trust level — count from TrustScore directly (no join)
        by_trust = dict(
            TrustScore.objects.values_list('trust_level')
            .annotate(c=Count('id'))
            .values_list('trust_level', 'c')
        )

        # Top countries
        by_country = list(
            qs.values('location_country_iso')
            .annotate(count=Count('id'))
            .order_by('-count')[:10]
        )

        # Unique countries + sources
        active_countries = qs.values('location_country_iso').distinct().count()
        countries_monitored = 47  # All WHO AFRO member states
        active_sources = SourceCredibility.objects.count()

        # Unacknowledged critical alerts
        critical_alerts = Alert.objects.filter(
            risk_level='critical',
            acknowledged_by__isnull=True,
        ).count()

        # Pillar distribution
        by_pillar = dict(
            qs.values_list('pillar')
            .annotate(c=Count('id'))
            .values_list('pillar', 'c')
        )

        data = {
            'total_records': agg['total'],
            'critical_alerts': critical_alerts,
            'countries_monitored': countries_monitored,
            'active_sources': active_sources,
            'by_priority': by_priority,
            'by_trust_level': by_trust,
            'by_country': by_country,
            'by_pillar': by_pillar,
        }
        cache.set(cache_key, data, 60)
        return Response(data)

    @action(detail=False, methods=['get'], url_path='countries')
    def country_intelligence(self, request):
        """
        Country intelligence overview — ALL 47 AFRO member states.
        Countries without signals are shown with zero counts.
        Cached for 60s.
        """
        cache_key = 'hdis_countries'
        cached = cache.get(cache_key)
        if cached:
            return Response(cached)

        # All 47 WHO AFRO member states
        AFRO_COUNTRIES = {
            'DZA': 'Algeria', 'AGO': 'Angola', 'BEN': 'Benin', 'BWA': 'Botswana',
            'BFA': 'Burkina Faso', 'BDI': 'Burundi', 'CPV': 'Cabo Verde', 'CMR': 'Cameroon',
            'CAF': 'Central African Republic', 'TCD': 'Chad', 'COM': 'Comoros',
            'COG': 'Congo', 'COD': 'Democratic Republic of the Congo',
            'CIV': "Côte d'Ivoire", 'GNQ': 'Equatorial Guinea', 'ERI': 'Eritrea',
            'SWZ': 'Eswatini', 'ETH': 'Ethiopia', 'GAB': 'Gabon', 'GMB': 'Gambia',
            'GHA': 'Ghana', 'GIN': 'Guinea', 'GNB': 'Guinea-Bissau', 'KEN': 'Kenya',
            'LSO': 'Lesotho', 'LBR': 'Liberia', 'MDG': 'Madagascar', 'MWI': 'Malawi',
            'MLI': 'Mali', 'MRT': 'Mauritania', 'MUS': 'Mauritius', 'MOZ': 'Mozambique',
            'NAM': 'Namibia', 'NER': 'Niger', 'NGA': 'Nigeria', 'RWA': 'Rwanda',
            'STP': 'São Tomé and Príncipe', 'SEN': 'Senegal', 'SYC': 'Seychelles',
            'SLE': 'Sierra Leone', 'ZAF': 'South Africa', 'SSD': 'South Sudan',
            'TGO': 'Togo', 'UGA': 'Uganda', 'TZA': 'Tanzania',
            'ZMB': 'Zambia', 'ZWE': 'Zimbabwe',
        }

        PILLAR_KEYS = [
            'outbreak', 'policy', 'funding', 'vaccine', 'conflict',
            'climate', 'agreement', 'workforce', 'uhc',
        ]

        annotations = {
            'signal_count': Count('id'),
            'critical': Count('id', filter=Q(priority='P1')),
            'high': Count('id', filter=Q(priority='P2')),
        }
        for pk in PILLAR_KEYS:
            annotations[f'p_{pk}'] = Count('id', filter=Q(pillar=pk))

        # Get countries that DO have signals (filtered for recent 30 days to keep the dashboard dynamic)
        last_30_days = timezone.now() - timedelta(days=30)
        db_countries = {
            c['location_country_iso']: c
            for c in (
                Signal.objects
                .filter(created_at__gte=last_30_days)
                .values('location_country_iso', 'location_country')
                .annotate(**annotations)
                .filter(signal_count__gt=0, location_country_iso__isnull=False)
            )
        }

        results = []
        for iso, name in AFRO_COUNTRIES.items():
            c = db_countries.get(iso)
            if c:
                pillars = {}
                active = 0
                for pk in PILLAR_KEYS:
                    val = c.get(f'p_{pk}', 0)
                    if val > 0:
                        pillars[pk] = val
                        active += 1

                if c['critical'] > 0:
                    risk = 'critical'
                elif c['high'] > 0:
                    risk = 'high'
                elif c['signal_count'] > 5:
                    risk = 'medium'
                else:
                    risk = 'low'

                results.append({
                    'country_iso': iso,
                    'country_name': c['location_country'] or name,
                    'signal_count': c['signal_count'],
                    'risk_level': risk,
                    'critical_count': c['critical'],
                    'high_count': c['high'],
                    'pillars': pillars,
                    'active_pillars': active,
                })
            else:
                # Country with no signals — show as monitoring
                results.append({
                    'country_iso': iso,
                    'country_name': name,
                    'signal_count': 0,
                    'risk_level': 'monitoring',
                    'critical_count': 0,
                    'high_count': 0,
                    'pillars': {},
                    'active_pillars': 0,
                })

        # Sort: critical first, then by signal count, monitoring last
        risk_sort = {'critical': 0, 'high': 1, 'medium': 2, 'low': 3, 'monitoring': 4}
        results.sort(key=lambda x: (risk_sort.get(x['risk_level'], 5), -x['signal_count']))

        cache.set(cache_key, results, 60)
        return Response(results)

    @action(detail=False, methods=['get'], url_path='countries/(?P<country_iso>[A-Z]{3})')
    def country_detail(self, request, country_iso=None):
        """
        Country deep-dive — cached for 120s.
        """
        cache_key = f'hdis_country_{country_iso}'
        cached = cache.get(cache_key)
        if cached:
            return Response(cached)
        qs = Signal.objects.filter(location_country_iso=country_iso)
        total = qs.count()
        if total == 0:
            return Response({'detail': 'No signals for this country'}, status=status.HTTP_404_NOT_FOUND)

        # Pillar breakdown with recent signals per pillar
        pillar_data = {}
        pillar_labels = {
            'outbreak': 'Disease Outbreak', 'policy': 'Health Policy',
            'funding': 'Health Funding', 'vaccine': 'Vaccine Access',
            'conflict': 'Conflict & Health', 'climate': 'Climate & Health',
            'agreement': 'Health Agreements', 'workforce': 'Health Workforce',
            'uhc': 'Universal Health Coverage',
        }
        for pillar_key, pillar_name in pillar_labels.items():
            pillar_signals = qs.filter(pillar=pillar_key)
            count = pillar_signals.count()
            if count > 0:
                latest = pillar_signals.order_by('-created_at').first()
                pillar_data[pillar_key] = {
                    'label': pillar_name,
                    'count': count,
                    'latest_headline': latest.original_text[:200] if latest else '',
                    'latest_date': latest.created_at.isoformat() if latest else None,
                    'critical': pillar_signals.filter(priority='P1').count(),
                }

        # Risk distribution
        by_priority = {
            'critical': qs.filter(priority='P1').count(),
            'high': qs.filter(priority='P2').count(),
            'medium': qs.filter(priority='P3').count(),
            'low': qs.filter(priority='P4').count(),
        }

        # Recent timeline
        recent = qs.order_by('-created_at')[:20]
        timeline = IntelRecordSerializer(recent, many=True).data

        # Country risk level
        if by_priority['critical'] > 0:
            risk = 'critical'
        elif by_priority['high'] > 0:
            risk = 'high'
        elif total > 5:
            risk = 'medium'
        else:
            risk = 'low'

        first_signal = qs.first()
        country_name = first_signal.location_country if first_signal else country_iso

        data = {
            'country_iso': country_iso,
            'country_name': country_name,
            'signal_count': total,
            'risk_level': risk,
            'by_priority': by_priority,
            'pillars': pillar_data,
            'active_pillars': len(pillar_data),
            'timeline': timeline,
        }
        cache.set(cache_key, data, 120)
        return Response(data)

class AlertViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Intelligence alerts — auto-generated from rule-based engine.

    list:       GET /api/v1/hdis/alerts/
    detail:     GET /api/v1/hdis/alerts/{id}/
    acknowledge: POST /api/v1/hdis/alerts/{id}/acknowledge/
    """
    queryset = Alert.objects.select_related('signal').all()
    serializer_class = AlertSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ['risk_level']
    ordering = ['-created_at']

    def get_queryset(self):
        qs = super().get_queryset()
        acknowledged = self.request.query_params.get('acknowledged')
        if acknowledged == 'false':
            qs = qs.filter(acknowledged_by__isnull=True)
        elif acknowledged == 'true':
            qs = qs.filter(acknowledged_by__isnull=False)
        return qs

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def acknowledge(self, request, pk=None):
        """Acknowledge an alert."""
        alert = self.get_object()
        if alert.acknowledged_by:
            return Response(
                {'detail': 'Alert already acknowledged'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        alert.acknowledged_at = timezone.now()
        if request.user.is_authenticated:
            alert.acknowledged_by = request.user
        alert.save()
        return Response(AlertSerializer(alert).data)


class BriefingViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Executive briefings.

    list:    GET /api/v1/hdis/briefings/
    detail:  GET /api/v1/hdis/briefings/{id}/
    publish: POST /api/v1/hdis/briefings/{id}/publish/
    """
    queryset = Briefing.objects.all()
    serializer_class = BriefingSerializer
    permission_classes = [IsAuthenticated]
    ordering = ['-generated_at']

    def get_queryset(self):
        qs = super().get_queryset()
        # Filter by status
        status_filter = self.request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter)
        # Filter by scope
        scope_filter = self.request.query_params.get('scope')
        if scope_filter:
            qs = qs.filter(scope=scope_filter)
        return qs

    @action(detail=True, methods=['post'], permission_classes=[IsAuthenticated])
    def publish(self, request, pk=None):
        """Publish a draft briefing."""
        briefing = self.get_object()
        if briefing.status == 'published':
            return Response(
                {'detail': 'Briefing already published'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        briefing.status = 'published'
        if request.user.is_authenticated:
            briefing.published_by = request.user
        briefing.save()
        return Response(BriefingSerializer(briefing).data)

    @action(detail=False, methods=['post'], permission_classes=[IsAuthenticated])
    def generate(self, request):
        """
        POST /api/v1/hdis/briefings/generate/
        Trigger briefing generation.
        Params: scope (default 'daily_global'), country_iso (optional)
        """
        try:
            scope = request.data.get('scope', 'daily_global')
            country_iso = request.data.get('country_iso', None)
            hours_back = int(request.data.get('hours_back', 48))
            exclude_pillars = request.data.get('exclude_pillars', None)  # e.g. ['outbreak']

            valid_scopes = ['daily_global', 'country_focus', 'crisis_alert']
            if scope not in valid_scopes:
                return Response(
                    {'detail': f"Invalid scope. Must be one of: {valid_scopes}"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if scope in ('country_focus', 'crisis_alert') and not country_iso:
                return Response(
                    {'detail': 'country_iso is required for this scope'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # 1. Clean up stale jobs that died without calling mark_failed.
            # Source of truth is lock_key='running' (the singleton lock), not
            # status — because if the worker thread is killed mid-pipeline, the
            # status may never transition to a terminal value but the lock is
            # still held. Anything still locked > STALE_AFTER is force-cleared
            # so the next generation can proceed.
            STALE_AFTER = timedelta(minutes=5)
            stale_time = timezone.now() - STALE_AFTER
            stuck_jobs = BriefingGenerationJob.objects.filter(
                lock_key='running',
                started_at__lt=stale_time,
            )
            for stuck in stuck_jobs:
                logger.warning(
                    "[Briefing] Clearing stale job #%d (status=%s, started=%s)",
                    stuck.id, stuck.status, stuck.started_at,
                )
                stuck.mark_failed("Job cleared due to inactivity (>5 mins)")

            # 2. Fast pre-check (UX): if a job currently holds the singleton
            # lock, return its info so the client can show a friendly popup.
            # This is *not* the race guard — the unique partial index on
            # lock_key (enforced on INSERT) is.
            running_job = BriefingGenerationJob.objects.filter(lock_key='running').first()
            if running_job:
                age_seconds = int((timezone.now() - running_job.started_at).total_seconds())
                stale_in_seconds = max(0, int(STALE_AFTER.total_seconds()) - age_seconds)
                return Response(
                    {'detail': 'A briefing is already being generated',
                     'message': 'A briefing is already being generated. Please wait for it to finish.',
                     'job_id': running_job.id,
                     'status': running_job.status,
                     'started_at': running_job.started_at.isoformat(),
                     'age_seconds': age_seconds,
                     'auto_clear_in_seconds': stale_in_seconds},
                    status=status.HTTP_409_CONFLICT,
                )

            # 2b. Quick LLM health check — fail fast if Ollama/LLM is down
            llm_base_url = None
            try:
                from hdis.llm_client import LLMConfig
                llm_cfg = LLMConfig.from_env()
                llm_base_url = llm_cfg.base_url
                if llm_cfg.provider == 'ollama':
                    _health = _requests.get(f"{llm_cfg.base_url}/api/tags", timeout=5)
                    if _health.status_code != 200:
                        return Response(
                            {'detail': 'LLM service (Ollama) is not responding.',
                             'message': 'LLM service (Ollama) is not responding. Please ensure Ollama is running.'},
                            status=status.HTTP_503_SERVICE_UNAVAILABLE,
                        )
            except _requests.exceptions.ConnectionError:
                return Response(
                    {'detail': 'Cannot connect to LLM service (Ollama).',
                     'message': f'Cannot connect to Ollama at {llm_base_url or "unknown"}. Is it running?'},
                    status=status.HTTP_503_SERVICE_UNAVAILABLE,
                )
            except (_requests.RequestException, AttributeError, ValueError) as health_err:
                logger.warning("[Briefing] LLM health check skipped: %s", health_err)

            requester = 'api'
            if request.user.is_authenticated:
                requester = getattr(request.user, 'username', None) or getattr(request.user, 'email', None) or str(request.user)

            # Resolve the tenant the job belongs to. Required so the row passes
            # the RLS policy on INSERT and so the per-tenant unique lock works.
            from utils.tenant_resolver import resolve_tenant
            job_tenant = resolve_tenant(iso=country_iso) if country_iso else resolve_tenant()

            # Race guard: the lock_key='running' default + partial unique index
            # means a concurrent INSERT raises IntegrityError. That's the real
            # single-flight guarantee.
            try:
                with transaction.atomic():
                    job = BriefingGenerationJob.objects.create(
                        scope=scope,
                        country_iso=country_iso or '',
                        hours_back=hours_back,
                        status=JobStatus.PENDING,
                        requested_by=requester[:100],
                        tenant=job_tenant,
                    )
            except IntegrityError:
                existing = BriefingGenerationJob.objects.filter(lock_key='running').first()
                payload = {
                    'detail': 'A briefing is already being generated',
                    'message': 'A briefing is already being generated. Please wait for it to finish.',
                    'job_id': existing.id if existing else None,
                    'status': existing.status if existing else None,
                }
                if existing:
                    age_seconds = int((timezone.now() - existing.started_at).total_seconds())
                    payload['started_at'] = existing.started_at.isoformat()
                    payload['age_seconds'] = age_seconds
                    payload['auto_clear_in_seconds'] = max(0, int(STALE_AFTER.total_seconds()) - age_seconds)
                return Response(payload, status=status.HTTP_409_CONFLICT)
            # Capture tenant_id before entering the thread — the thread has no
            # request context, so we need to pass it in explicitly.
            job_tenant_id = str(job.tenant_id) if job.tenant_id else '0'

            def _run():
                import time as _time
                from utils.tenant_tasks import tenant_context
                _start = _time.monotonic()
                # Background threads do NOT pass through TenantMiddleware, so
                # the PG session defaults to 'app.current_tenant = -1' (deny
                # all). Without setting it here, every UPDATE/SELECT against
                # tenant-scoped tables silently affects 0 rows and the job
                # stays stuck in 'pending' forever.
                with tenant_context(job_tenant_id):
                    try:
                        from hdis.briefing_engine import generate_briefing as _gen

                        def _report_stage(stage):
                            """Callback: update job status as pipeline progresses."""
                            try:
                                elapsed = int((_time.monotonic() - _start) * 1000)
                                logger.info(
                                    "[Briefing] Job #%d → stage=%s (%dms elapsed)",
                                    job.id, stage, elapsed,
                                )
                                job.mark_stage(stage)
                            except (DatabaseError, AttributeError) as stage_err:
                                logger.debug("job.mark_stage failed (non-fatal): %s", stage_err)

                        logger.info(
                            "[Briefing] Job #%d STARTED — scope=%s country=%s hours=%d exclude=%s user=%s tenant=%s",
                            job.id, scope, country_iso or 'ALL', hours_back,
                            exclude_pillars or 'none', job.requested_by, job_tenant_id,
                        )

                        briefing = _gen(
                            scope=scope, country_iso=country_iso,
                            hours_back=hours_back, exclude_pillars=exclude_pillars,
                            progress_callback=_report_stage,
                        )
                        job.mark_complete(briefing)

                        elapsed_s = round((_time.monotonic() - _start), 1)
                        logger.info(
                            "[Briefing] Job #%d COMPLETE — briefing_id=%d confidence=%s "
                            "signals=%d sources=%d time=%.1fs",
                            job.id, briefing.id,
                            briefing.confidence_level,
                            briefing.signal_count,
                            briefing.source_count,
                            elapsed_s,
                        )
                    except Exception as e:  # noqa: BLE001 — background job wrapper: must mark the job FAILED regardless of root cause
                        elapsed_s = round((_time.monotonic() - _start), 1)
                        logger.exception(
                            "[Briefing] Job #%d FAILED after %.1fs — %s",
                            job.id, elapsed_s, e,
                        )
                        job.mark_failed(str(e))

            thread = threading.Thread(target=_run, daemon=True)
            thread.start()

            return Response({
                'status': 'started',
                'job_id': job.id,
                'message': 'Briefing generation started. Poll /briefings/generation_status/ for progress.',
            }, status=status.HTTP_202_ACCEPTED)

        except Exception as e:  # noqa: BLE001 — top-level view wrapper: must always return a structured 500 to the client
            logger.exception("Global failure in hdis.generate view")
            return Response({
                'status': 'error',
                'message': f"Internal Server Error: {str(e)}"
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['get'])
    def generation_status(self, request):
        """
        GET /api/v1/hdis/briefings/generation_status/
        Poll the current briefing generation status.
        """
        job = BriefingGenerationJob.objects.filter(
            status__in=[JobStatus.PENDING, JobStatus.GATHERING, JobStatus.ANALYZING, JobStatus.VERIFYING, JobStatus.COMPOSING]
        ).first()
        if not job:
            recent_threshold = timezone.now() - timedelta(minutes=5)
            job = BriefingGenerationJob.objects.filter(
                started_at__gt=recent_threshold
            ).first()

        if not job:
            return Response({
                'is_running': False,
                'stage': 'idle',
                'briefing_id': None,
                'error': None,
            })

        result = {
            'job_id': job.id,
            'is_running': job.is_running,
            'stage': job.status,
            'briefing_id': job.briefing_id,
            'error': job.error or None,
            'started_at': job.started_at.isoformat() if job.started_at else None,
            'completed_at': job.completed_at.isoformat() if job.completed_at else None,
        }

        # If complete, include the briefing data
        if job.briefing_id and not job.is_running:
            try:
                briefing = Briefing.objects.get(id=job.briefing_id)
                result['briefing'] = BriefingSerializer(briefing).data
            except Briefing.DoesNotExist:
                pass

        return Response(result)


class SourceViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Intelligence sources (reads from sentinel's SourceCredibility).

    list:   GET /api/v1/hdis/sources/
    """
    queryset = SourceCredibility.objects.all()
    permission_classes = [IsAuthenticated]
    serializer_class = SourceCredibilitySerializer
    ordering = ['tier', '-credibility_score']

from rest_framework.decorators import api_view, permission_classes as perm_classes
import threading
import time

_refresh_lock = threading.Lock()
_refresh_status = {
    'is_running': False,
    'last_refresh_at': None,
    'last_result': None,
    'progress': '',
}


@api_view(['POST'])
@perm_classes([IsAuthenticated])
def manual_refresh(request):
    """
    POST /api/v1/hdis/refresh/
    Trigger a full ingestion cycle asynchronously.
    Returns 202 Accepted immediately. Check stats via /refresh/status/
    """
    global _refresh_status

    if _refresh_status['is_running']:
        return Response({
            'status': 'already_running',
            'message': 'A refresh is already in progress',
            'progress': _refresh_status['progress'],
        }, status=status.HTTP_409_CONFLICT)

    _refresh_status['is_running'] = True
    _refresh_status['progress'] = 'Starting ingestion...'

    def _run_refresh():
        try:
            from hdis.ingestion import ingest_all_sources as _ingest_all
            from hdis.trust_engine import update_trust_scores
            from hdis.alert_engine import run_alert_engine

            _refresh_status['progress'] = 'Ingesting from sources...'
            ingest_results = _ingest_all()

            _refresh_status['progress'] = 'Computing trust scores...'
            trust_count = update_trust_scores()

            _refresh_status['progress'] = 'Checking alert rules...'
            alert_count = run_alert_engine(hours_back=1)

            cache.clear()

            total_ingested = sum(
                r.get('ingested', 0) for r in ingest_results.values()
                if isinstance(r, dict)
            )

            _refresh_status['last_refresh_at'] = timezone.now().isoformat()
            _refresh_status['last_result'] = {
                'status': 'completed',
                'sources_processed': len(ingest_results),
                'signals_ingested': total_ingested,
                'trust_scores_updated': trust_count,
                'alerts_created': alert_count,
                'refreshed_at': timezone.now().isoformat(),
            }
            _refresh_status['progress'] = 'Done'

        except Exception as e:  # noqa: BLE001 — background refresh wrapper: must record status string regardless of root cause
            logger.exception("Manual refresh failed: %s", e)
            _refresh_status['progress'] = f'Error: {str(e)}'

        finally:
            _refresh_status['is_running'] = False

    thread = threading.Thread(target=_run_refresh, daemon=True)
    thread.start()

    return Response({
        'status': 'started',
        'message': 'Manual refresh started in background.',
    }, status=status.HTTP_202_ACCEPTED)


@api_view(['GET'])
@perm_classes([IsAuthenticated])
def refresh_status(request):
    """
    GET /api/v1/hdis/refresh/status/
    Check the current refresh status.
    """
    return Response(_refresh_status)
