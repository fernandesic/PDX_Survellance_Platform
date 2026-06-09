"""
Outbreak Workspace — API Views

Endpoints per arc.md:
  GET  /api/outbreak/                        — list outbreaks
  POST /api/outbreak/                        — declare manually
  GET  /api/outbreak/<id>/                   — detail
  GET  /api/outbreak/<id>/events/            — paginated event stream
  GET  /api/outbreak/<id>/history/           — historical episodes for this pathogen
  POST /api/outbreak/<id>/ingest/            — trigger adaptor run
"""

import hashlib
import json
import logging
import threading
from datetime import timedelta

from django.http import StreamingHttpResponse
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from django.db.models import Count, Q
from django.db.models.functions import TruncDate

from .models import (
    Outbreak,
    OutbreakEvent,
    OutbreakHistoricalEpisode,
    OutbreakNotification,
    OutbreakDecision,
    NotificationRule,
    LlmInteraction,
    Pathogen,
    EventKind,
)
from .serializers import (
    OutbreakListSerializer,
    OutbreakDetailSerializer,
    OutbreakCreateSerializer,
    OutbreakEventSerializer,
    OutbreakHistoricalEpisodeSerializer,
    OutbreakNotificationSerializer,
    OutbreakDecisionSerializer,
    NotificationRuleSerializer,
    LlmInteractionSerializer,
    PathogenSerializer,
)

logger = logging.getLogger(__name__)


class OutbreakViewSet(viewsets.ModelViewSet):
    """
    Outbreak CRUD + nested event stream.
    """
    queryset = Outbreak.objects.select_related('pathogen').all()
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.action == 'list':
            return OutbreakListSerializer
        if self.action == 'create':
            return OutbreakCreateSerializer
        return OutbreakDetailSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        # Filter by status
        status_filter = self.request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter)
        # Filter by pathogen
        pathogen = self.request.query_params.get('pathogen')
        if pathogen:
            qs = qs.filter(pathogen__name__icontains=pathogen)
        return qs

    # ── Events sub-resource ────────────────────────────────────────

    @action(detail=True, methods=['get'], url_path='events')
    def events(self, request, pk=None):
        """
        Paginated event stream for an outbreak.

        Query params:
          kind    — filter by event kind (repeatable)
          since   — ISO datetime, only events after this time
          until   — ISO datetime, only events before this time
          as_of   — ISO datetime, time-machine: only events with ts <= as_of
          geo     — filter by geo field
          source  — filter by source adaptor name
          limit   — max results (default 100, max 200)
        """
        outbreak = self.get_object()
        events = OutbreakEvent.objects.filter(outbreak=outbreak)

        # Filters
        kind = request.query_params.getlist('kind')
        if kind:
            events = events.filter(kind__in=kind)

        since = request.query_params.get('since')
        if since:
            events = events.filter(ts__gte=since)

        until = request.query_params.get('until')
        if until:
            events = events.filter(ts__lte=until)

        as_of = request.query_params.get('as_of')
        if as_of:
            events = events.filter(ts__lte=as_of)

        geo = request.query_params.get('geo')
        if geo:
            events = events.filter(geo__icontains=geo)

        source = request.query_params.get('source')
        if source:
            events = events.filter(source=source)

        # Pagination
        try:
            limit = min(int(request.query_params.get('limit', 100)), 200)
        except (TypeError, ValueError):
            limit = 100

        events = events.order_by('-ts')[:limit]
        serializer = OutbreakEventSerializer(events, many=True)
        return Response(serializer.data)

    # ── Event stats ────────────────────────────────────────────────

    @action(detail=True, methods=['get'], url_path='stats')
    def stats(self, request, pk=None):
        """
        Aggregated stats for the outbreak dashboard header.
        """
        outbreak = self.get_object()
        events = OutbreakEvent.objects.filter(outbreak=outbreak)

        now = timezone.now()

        total = events.count()
        last_24h = events.filter(ts__gte=now - timedelta(hours=24)).count()
        last_7d = events.filter(ts__gte=now - timedelta(days=7)).count()

        # By kind
        by_kind = dict(
            events.values_list('kind')
            .annotate(cnt=Count('id'))
            .values_list('kind', 'cnt')
        )

        # By source
        by_source = dict(
            events.values_list('source')
            .annotate(cnt=Count('id'))
            .values_list('source', 'cnt')
        )

        # ── Countries detected ──
        # Pulled from every signal payload so the country chip list reflects
        # the full geographic footprint of mentions, not just the epicenter.
        signal_events = events.filter(kind=EventKind.SIGNAL).only('payload_json')
        countries = set()
        for payload in signal_events.values_list('payload_json', flat=True).iterator():
            if not isinstance(payload, dict):
                continue
            iso = payload.get('country_iso', '')
            if iso:
                countries.add(iso)

        # ── Latest reported cases / deaths from signals (epicenter only) ──
        # Each news signal restates cumulative totals, so SUMMING across
        # signals double-counts (and previously produced CFR > 100%). We take
        # the MAX over signals that:
        #   (a) reference the epicenter country (outbreak.iso3), to drop
        #       neighbor-country and historical-context references, and
        #   (b) post-date the declared_at timestamp, to drop pre-outbreak
        #       background reporting.
        # The resulting number is "highest cumulative figure any single
        # in-window source reported" — a reasonable signal-derived proxy,
        # but NOT authoritative. The authoritative numbers live on the
        # Outbreak row (confirmed_cases / confirmed_deaths), entered from
        # Ministry/WHO sitreps.
        epicenter_signals = signal_events.filter(
            ts__gte=outbreak.declared_at,
        )
        latest_reported_cases = 0
        latest_reported_deaths = 0
        latest_reported_ts = None
        for evt_ts, payload in (
            epicenter_signals
            .values_list('ts', 'payload_json')
            .iterator()
        ):
            if not isinstance(payload, dict):
                continue
            if (payload.get('country_iso') or '').upper() != (outbreak.iso3 or '').upper():
                continue
            try:
                c = int(payload.get('reported_cases') or 0)
            except (ValueError, TypeError):
                c = 0
            try:
                d = int(payload.get('reported_deaths') or 0)
            except (ValueError, TypeError):
                d = 0
            if c > latest_reported_cases:
                latest_reported_cases = c
                latest_reported_ts = evt_ts
            if d > latest_reported_deaths:
                latest_reported_deaths = d

        # Defensive: if signal extraction produced deaths>cases (a single
        # report nonsensically reported more deaths than cases), clamp deaths
        # to cases so we don't repeat the >100% CFR bug.
        if latest_reported_cases > 0:
            latest_reported_deaths = min(latest_reported_deaths, latest_reported_cases)

        return Response({
            'total_events': total,
            'events_24h': last_24h,
            'events_7d': last_7d,
            'by_kind': by_kind,
            'by_source': by_source,
            'countries_detected': sorted(countries),
            'outbreak_status': outbreak.status,
            'outbreak_severity': outbreak.severity,
            # Authoritative numbers (from Ministry/WHO sitrep, entered in admin).
            # The banner uses these as the headline figures.
            'confirmed_cases': outbreak.confirmed_cases,
            'confirmed_deaths': outbreak.confirmed_deaths,
            'confirmed_as_of': (
                outbreak.confirmed_as_of.isoformat()
                if outbreak.confirmed_as_of else None
            ),
            'confirmed_source': outbreak.confirmed_source or '',
            # Signal-derived (informational only — surfaced as a secondary
            # cross-check below the headline confirmed numbers).
            'latest_reported_cases': latest_reported_cases,
            'latest_reported_deaths': latest_reported_deaths,
            'latest_reported_ts': (
                latest_reported_ts.isoformat() if latest_reported_ts else None
            ),
        })

    # ── Epi curve ──────────────────────────────────────────────────

    @action(detail=True, methods=['get'], url_path='epi-curve')
    def epi_curve(self, request, pk=None):
        """
        Daily signal counts for epi curve chart.
        Returns [{date, signals, cumulative}].
        """
        outbreak = self.get_object()
        events = OutbreakEvent.objects.filter(
            outbreak=outbreak,
            kind=EventKind.SIGNAL,
        )

        as_of = request.query_params.get('as_of')
        if as_of:
            events = events.filter(ts__lte=as_of)

        daily = (
            events
            .annotate(date=TruncDate('ts'))
            .values('date')
            .annotate(signals=Count('id'))
            .order_by('date')
        )

        result = []
        cumulative = 0
        for row in daily:
            cumulative += row['signals']
            result.append({
                'date': row['date'].isoformat(),
                'signals': row['signals'],
                'cumulative': cumulative,
            })

        return Response(result)

    # ── Historical episodes ────────────────────────────────────────

    @action(detail=True, methods=['get'], url_path='history')
    def history(self, request, pk=None):
        """
        Historical episodes for this outbreak's pathogen.

        OutbreakHistoricalEpisode is reference data with no tenant_id —
        we match by pathogen name string rather than FK to avoid RLS
        filtering issues in multi-tenant mode.
        """
        outbreak = self.get_object()

        # Resolve pathogen name from the outbreak (may be a nested object or id)
        pathogen_name = None
        if hasattr(outbreak.pathogen, 'name'):
            pathogen_name = outbreak.pathogen.name
        else:
            # Fallback: load the pathogen (Pathogen imported at module level)
            try:
                pathogen_name = Pathogen.objects.get(pk=outbreak.pathogen_id).name
            except Pathogen.DoesNotExist:
                pass

        if not pathogen_name:
            return Response([])

        # Query by name to bypass RLS on the FK join
        episodes = OutbreakHistoricalEpisode.objects.filter(
            pathogen__name=pathogen_name,
        ).select_related('pathogen').order_by('-year_start')

        serializer = OutbreakHistoricalEpisodeSerializer(episodes, many=True)
        return Response(serializer.data)

    # ── Manual adaptor trigger ─────────────────────────────────────
    #
    # NOTE: this lock is per-process. With multiple WSGI workers the flag
    # only prevents concurrent runs within the same worker. Move to Celery
    # with task deduplication (e.g. `acks_late=True` + a redis lock key
    # per outbreak) before relying on this in production.
    _ingest_lock = threading.Lock()
    _ingest_running = False

    @action(detail=True, methods=['post'], url_path='ingest')
    def ingest(self, request, pk=None):
        """
        Trigger all healthy adaptors for this outbreak.
        Runs in background thread, returns immediately.
        """
        outbreak = self.get_object()

        with OutbreakViewSet._ingest_lock:
            if OutbreakViewSet._ingest_running:
                return Response(
                    {'status': 'already_running',
                     'message': 'Adaptor run already in progress.'},
                    status=status.HTTP_202_ACCEPTED,
                )
            OutbreakViewSet._ingest_running = True

        def _run():
            from utils.tenant_tasks import tenant_context

            try:
                adaptors = _adaptor_registry()
                with tenant_context('0'):
                    for adaptor in adaptors:
                        result = adaptor.run(outbreak)
                        logger.info(
                            "Adaptor %s: emitted=%d skipped=%d status=%s",
                            result['adaptor'], result['emitted'],
                            result['skipped'], result['status'],
                        )
            except Exception:  # noqa: BLE001 — adaptor batch wrapper: one bad adaptor must not abort the rest
                logger.exception("Adaptor run failed for outbreak %s", outbreak.id)
            finally:
                with OutbreakViewSet._ingest_lock:
                    OutbreakViewSet._ingest_running = False

        thread = threading.Thread(target=_run, daemon=True)
        thread.start()

        return Response(
            {'status': 'started',
             'message': 'Adaptor run started. Refresh in ~15s to see new events.'},
            status=status.HTTP_202_ACCEPTED,
        )

    # ── Capacity aggregation (T-090) ───────────────────────────────

    @action(detail=True, methods=['get'], url_path='capacity')
    def capacity(self, request, pk=None):
        """
        Aggregated capacity data for this outbreak's country.

        Returns one combined response with six keys:
          readiness  — disease-specific readiness score
          ihr        — 13 e-SPAR IHR component scores
          chw        — country CHW density + affected districts
          star       — seasonal hazard for the pathogen
          spillover  — current spillover risk
          composite  — weighted composite from predictions engine

        Each key is populated independently — if one source is
        unavailable, the others still return data.

        Optional ?iso3=<CODE> overrides the country scope while
        keeping the outbreak's pathogen. Used by the Now-pane to let
        an officer click a neighbor country in the Geographic Spread
        grid and re-render the capacity cards for that country
        (preserves epicenter context elsewhere on the page).
        """
        from .services.capacity import get_outbreak_capacity
        from utils.tenant_tasks import tenant_context

        outbreak = self.get_object()
        override = (request.query_params.get('iso3') or '').strip().upper()

        # Capacity reads from chwfolder, espar, readiness, stardata, onehealth.
        # Those tables are per-tenant but the outbreak workspace is a
        # cross-country/cross-tenant operations view, so we need to read all
        # rows regardless of the request user's tenant. Wrap each fetch in
        # tenant '0' (cross-tenant) — same pattern as the ingest endpoint.
        with tenant_context('0'):
            if override and len(override) == 3 and override.isalpha() and override != outbreak.iso3.upper():
                # Build a shallow view over the outbreak with a swapped iso3.
                # The capacity service only reads .iso3, .pathogen, .regions —
                # so a simple wrapper avoids touching the DB-bound instance.
                class _OutbreakView:
                    pass
                view = _OutbreakView()
                view.iso3 = override
                view.pathogen = outbreak.pathogen
                view.regions = []  # we don't know neighbor's affected regions
                data = get_outbreak_capacity(view)
                data['scope_iso3'] = override
                data['scope_is_override'] = True
                data['epicenter_iso3'] = outbreak.iso3.upper()
                return Response(data)

            data = get_outbreak_capacity(outbreak)
            data['scope_iso3'] = outbreak.iso3.upper()
            data['scope_is_override'] = False
            data['epicenter_iso3'] = outbreak.iso3.upper()
            return Response(data)

    # ── Q&A — grounded LLM with canned-query router (T-032) ────────

    @action(detail=True, methods=['post'], url_path='ask')
    def ask(self, request, pk=None):
        """
        Ask a question grounded in the outbreak's events + capacity +
        pathogen profile. Returns `{answer, reason, source, citations}`.
        Canned queries are tried first; otherwise the LLM is called with
        the citation validator.
        """
        from outbreak.llm.ask import ask as ask_llm

        outbreak = self.get_object()
        question = (request.data.get('question') or '').strip()
        if not question:
            return Response(
                {'answer': None, 'reason': 'empty_question'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        result = ask_llm(outbreak, question)
        return Response(result)

    # ── Canned-query direct invocation (T-031) ─────────────────────

    @action(detail=True, methods=['get'], url_path=r'canned/(?P<name>[a-zA-Z0-9_]+)')
    def canned(self, request, pk=None, name=None):
        from outbreak.llm.canned_queries import CANNED
        outbreak = self.get_object()
        fn = CANNED.get(name)
        if fn is None:
            return Response(
                {'answer': None, 'reason': 'unknown_query', 'available': sorted(CANNED.keys())},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(fn(outbreak))

    # ── Sitrep (T-033 / T-124) ─────────────────────────────────────

    @action(detail=True, methods=['get'], url_path='sitrep/latest')
    def sitrep_latest(self, request, pk=None):
        outbreak = self.get_object()
        latest = (
            OutbreakDecision.objects
            .filter(outbreak=outbreak, kind=OutbreakDecision.Kind.SITREP)
            .order_by('-created_at')
            .first()
        )
        if latest is None:
            return Response({'answer': None, 'reason': 'no_sitrep'})
        return Response(OutbreakDecisionSerializer(latest).data)

    @action(detail=True, methods=['post'], url_path='sitrep/generate')
    def sitrep_generate(self, request, pk=None):
        from outbreak.llm.sitrep import generate_sitrep
        outbreak = self.get_object()
        return Response(generate_sitrep(outbreak))

    # ── Decision log (T-060) ───────────────────────────────────────

    @action(detail=True, methods=['get', 'post'], url_path='decisions')
    def decisions(self, request, pk=None):
        outbreak = self.get_object()
        if request.method == 'POST':
            payload = request.data
            decision = OutbreakDecision.objects.create(
                outbreak=outbreak,
                kind=payload.get('kind') or OutbreakDecision.Kind.DECISION,
                title=(payload.get('title') or '')[:200],
                body=payload.get('body') or '',
                author=(payload.get('author') or getattr(request.user, 'username', ''))[:120],
                evidence_event_ids=payload.get('evidence_event_ids') or [],
                citations=payload.get('citations') or [],
            )
            return Response(
                OutbreakDecisionSerializer(decision).data,
                status=status.HTTP_201_CREATED,
            )
        qs = OutbreakDecision.objects.filter(outbreak=outbreak)
        kind = request.query_params.get('kind')
        if kind:
            qs = qs.filter(kind=kind)
        return Response(OutbreakDecisionSerializer(qs.order_by('-created_at'), many=True).data)

    # ── Notifications (T-040..T-044, no telegram dispatch) ─────────

    @action(detail=True, methods=['get'], url_path='notifications')
    def notifications(self, request, pk=None):
        outbreak = self.get_object()
        qs = OutbreakNotification.objects.filter(outbreak=outbreak).select_related('rule', 'event')
        state = request.query_params.get('state')
        if state:
            qs = qs.filter(state=state)
        return Response(
            OutbreakNotificationSerializer(qs[:200], many=True).data,
        )

    @action(detail=True, methods=['post'], url_path=r'notifications/(?P<notif_id>\d+)/confirm')
    def notification_confirm(self, request, pk=None, notif_id=None):
        from outbreak.notifications.rule_engine import confirm
        send = bool(request.data.get('send'))
        actor = getattr(request.user, 'username', '') or ''
        notif = confirm(int(notif_id), send=send, actor=actor)
        if notif is None:
            return Response({'error': 'not_found'}, status=status.HTTP_404_NOT_FOUND)
        return Response(OutbreakNotificationSerializer(notif).data)

    # ── LLM audit (T-128) ──────────────────────────────────────────

    @action(detail=True, methods=['get'], url_path='llm-log')
    def llm_log(self, request, pk=None):
        outbreak = self.get_object()
        qs = LlmInteraction.objects.filter(outbreak=outbreak).order_by('-created_at')[:100]
        return Response(LlmInteractionSerializer(qs, many=True).data)

    # ── Adaptor health (T-081) ─────────────────────────────────────

    @action(detail=True, methods=['get'], url_path='adaptor-health')
    def adaptor_health(self, request, pk=None):
        """
        Per-adaptor latest health for this outbreak: last run, events
        emitted in the last hour, healthy/degraded/dead.
        """
        outbreak = self.get_object()
        registry = _adaptor_registry()
        now = timezone.now()
        cutoff = now - timedelta(hours=1)
        result = []
        for adaptor in registry:
            try:
                healthy = adaptor.is_healthy()
            except Exception:  # noqa: BLE001 — health probe: an unreachable adaptor is reported as unhealthy, not crashed
                healthy = False
            last = (
                OutbreakEvent.objects
                .filter(outbreak=outbreak, source=adaptor.name)
                .order_by('-ts')
                .first()
            )
            recent = OutbreakEvent.objects.filter(
                outbreak=outbreak, source=adaptor.name, ts__gte=cutoff,
            ).count()
            result.append({
                'name': adaptor.name,
                'kinds_emitted': list(adaptor.kinds_emitted),
                'healthy': bool(healthy),
                'last_event_ts': last.ts.isoformat() if last else None,
                'events_last_hour': recent,
                'status': (
                    'ok' if healthy and recent > 0 else
                    'degraded' if healthy else
                    'dead'
                ),
            })
        return Response(result)

    # ── SSE event stream (T-025) ───────────────────────────────────

    @action(detail=True, methods=['get'], url_path='stream')
    def stream(self, request, pk=None):
        """
        Long-lived Server-Sent Events stream of new OutbreakEvents for
        this outbreak. Heartbeat every 15s. `Content-Type: text/event-stream`.
        Note: nginx must set `proxy_buffering off` for this path.

        Auth: standard IsAuthenticated. Browsers send cookies via
        `EventSource(..., {withCredentials: true})`; CLI/server clients can
        use `?token=<access_token>` (CustomTokenAuthentication allows query
        token only on this and other registered SSE paths).
        """
        outbreak = self.get_object()
        from outbreak.sse import event_stream
        response = StreamingHttpResponse(
            event_stream(outbreak.id),
            content_type='text/event-stream',
        )
        response['Cache-Control'] = 'no-cache'
        response['X-Accel-Buffering'] = 'no'
        return response

    # ── Scenario trigger (T-052) ───────────────────────────────────

    @action(detail=True, methods=['post'], url_path='scenario')
    def scenario(self, request, pk=None):
        from outbreak.adaptors.wbepi_forecast import WbepiForecastAdaptor
        outbreak = self.get_object()
        result = WbepiForecastAdaptor().run(outbreak)
        return Response(result)

    # ── Auditable export bundle (T-062) ────────────────────────────

    @action(detail=True, methods=['get'], url_path='export')
    def export(self, request, pk=None):
        """
        Returns a signed manifest + JSON bundle of events, decisions, sitreps
        and LLM interactions for this outbreak. Tarball generation requires a
        client; here we return the JSON bundle + SHA256 manifest of its
        canonical serialization (HMAC-signed with SECRET_KEY).
        """
        import hashlib as _hashlib
        import hmac as _hmac
        import json as _json
        from django.conf import settings as dj_settings

        outbreak = self.get_object()
        events = list(
            OutbreakEvent.objects.filter(outbreak=outbreak).order_by('ts').values(
                'id', 'ts', 'source', 'kind', 'geo', 'payload_json',
                'confidence', 'source_ref',
            )
        )
        decisions = list(
            OutbreakDecision.objects.filter(outbreak=outbreak).order_by('created_at').values(
                'id', 'kind', 'title', 'body', 'author',
                'evidence_event_ids', 'citations', 'created_at',
            )
        )
        llm_log = list(
            LlmInteraction.objects.filter(outbreak=outbreak).order_by('created_at').values(
                'id', 'source', 'question', 'final_answer', 'refusal_reason',
                'canned_query', 'model', 'provider', 'created_at',
            )
        )
        bundle = {
            'outbreak_id': outbreak.id,
            'pathogen': outbreak.pathogen.name,
            'iso3': outbreak.iso3,
            'exported_at': timezone.now().isoformat(),
            'events': events,
            'decisions': decisions,
            'llm_log': llm_log,
        }
        canonical = _json.dumps(bundle, sort_keys=True, default=str).encode('utf-8')
        digest = _hashlib.sha256(canonical).hexdigest()
        secret = (getattr(dj_settings, 'SECRET_KEY', '') or '').encode('utf-8')
        if not secret:
            # A missing SECRET_KEY means the deploy is misconfigured — refuse to
            # return a bundle that looks signed but isn't, rather than mislead
            # downstream verifiers with an empty signature string.
            return Response(
                {'error': 'Export signing unavailable: SECRET_KEY is not configured.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
        signature = _hmac.new(secret, canonical, _hashlib.sha256).hexdigest()
        return Response({
            'manifest': {
                'sha256': digest,
                'signature': signature,
                'algorithm': 'HMAC-SHA256',
                'size_bytes': len(canonical),
            },
            'bundle': bundle,
        })


def _adaptor_registry():
    """Return the list of registered adaptors used by the workspace."""
    from outbreak.adaptors.sentinel_signal import SentinelSignalAdaptor
    from outbreak.adaptors.spillover_risk import SpilloverRiskAdaptor
    from outbreak.adaptors.keyword_signals import (
        UnsafeBurialAdaptor, HcwInfectionAdaptor,
    )
    from outbreak.adaptors.silence import SilenceAdaptor
    from outbreak.adaptors.wbepi_forecast import WbepiForecastAdaptor
    from outbreak.adaptors.transmission_drivers import (
        MobilityAdaptor, DeforestationAdaptor,
        AnimalSurveillanceAdaptor, ClimateAdaptor,
    )
    from outbreak.adaptors.kobo_chw import KoboCHWAdaptor
    return [
        SentinelSignalAdaptor(),
        SpilloverRiskAdaptor(),
        UnsafeBurialAdaptor(),
        HcwInfectionAdaptor(),
        SilenceAdaptor(),
        WbepiForecastAdaptor(),
        MobilityAdaptor(),
        DeforestationAdaptor(),
        AnimalSurveillanceAdaptor(),
        ClimateAdaptor(),
        KoboCHWAdaptor(),
    ]


class PathogenViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only pathogen reference cards."""
    queryset = Pathogen.objects.all()
    serializer_class = PathogenSerializer
    permission_classes = [IsAuthenticated]


class UploadTrackerView(APIView):
    """
    Superadmin upload endpoint for the manual Ebola/DRC tracker spreadsheet.

    POST  /api/outbreak/upload-tracker/
          multipart form-data with `file` (.xlsx) and `outbreak_id` (int)

    The uploaded workbook drives every case-count widget on the outbreak
    page. Re-upload of the same workbook is idempotent (dedup on
    `source_ref`). New rows for new dates land as new events.
    """
    from rest_framework.permissions import IsAdminUser
    from rest_framework.parsers import MultiPartParser

    permission_classes = [IsAdminUser]
    parser_classes = [MultiPartParser]

    def post(self, request):
        upload = request.FILES.get('file')
        if not upload:
            return Response(
                {'error': "missing 'file' in form-data"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not upload.name.lower().endswith(('.xlsx', '.xlsm')):
            return Response(
                {'error': 'file must be an .xlsx workbook'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        outbreak_id = request.data.get('outbreak_id')
        try:
            outbreak_id = int(outbreak_id)
        except (TypeError, ValueError):
            return Response(
                {'error': "missing or invalid 'outbreak_id'"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            outbreak = Outbreak.objects.select_related('pathogen').get(pk=outbreak_id)
        except Outbreak.DoesNotExist:
            return Response(
                {'error': f'no outbreak with id={outbreak_id}'},
                status=status.HTTP_404_NOT_FOUND,
            )

        from outbreak.services.tracker_xlsx import (
            ingest_tracker, TrackerParseError,
        )
        try:
            summary = ingest_tracker(upload.file, outbreak)
        except TrackerParseError as e:
            logger.warning('UploadTrackerView parse failed: %s', e)
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:  # noqa: BLE001 — top-level upload view: any failure must return a structured response
            logger.exception('UploadTrackerView crashed during ingest')
            return Response(
                {'error': f'ingest failed: {e}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        logger.info(
            'tracker upload by user=%s outbreak=%d filename=%s summary=%s',
            request.user.username, outbreak.id, upload.name, summary,
        )
        return Response({
            'ok': True,
            'outbreak_id': outbreak.id,
            'filename': upload.name,
            'summary': summary,
        })



