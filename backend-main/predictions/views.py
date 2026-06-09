
from collections import defaultdict

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.conf import settings
from django.db.models import Avg, Max, Count, Sum
from .models import (
    OutbreakPrediction, PredictionModel, ForecastData,
    Scenario, ScenarioRun,
)
from .serializers import (
    OutbreakPredictionListSerializer,
    OutbreakPredictionDetailSerializer,
    PredictionModelSerializer,
    ScenarioSerializer,
    ScenarioRunListSerializer,
    ScenarioRunDetailSerializer,
    ScenarioRunRequestSerializer,
    ScenarioFitRequestSerializer,
)

# Country config (name mapping only, no file paths needed)
COUNTRY_FORECAST_CONFIG = {
    'COD': {'name': 'DR Congo'},
    'MOZ': {'name': 'Mozambique'},
}


def _read_national_csv(iso):
    """Read national forecast data from ForecastData DB table."""
    config = COUNTRY_FORECAST_CONFIG.get(iso)
    if not config:
        return None

    if iso == 'COD':
        # DRC: aggregate regional (district-level) data by date for national view
        qs = ForecastData.objects.filter(
            country_iso='COD', data_type='regional'
        ).values('date').annotate(
            total_cases=Sum('cases'),
            total_deaths=Sum('deaths'),
        ).order_by('date')

        if not qs.exists():
            return None

        rows = []
        cum_c = cum_d = 0
        for entry in qs:
            cum_c += entry['total_cases']
            cum_d += entry['total_deaths']
            rows.append({
                'date': entry['date'].isoformat(),
                'cases': entry['total_cases'],
                'deaths': entry['total_deaths'],
                'cumulative_cases': cum_c,
                'cumulative_deaths': cum_d,
            })
        return rows
    else:
        # MOZ: direct national data
        qs = ForecastData.objects.filter(
            country_iso=iso, data_type='national'
        ).order_by('date')

        if not qs.exists():
            return None

        return [
            {
                'date': row.date.isoformat(),
                'cases': row.cases,
                'deaths': row.deaths,
                'cumulative_cases': row.cumulative_cases,
                'cumulative_deaths': row.cumulative_deaths,
            }
            for row in qs
        ]


def _read_regional_csv(iso):
    """Read regional/provincial forecast data from ForecastData DB table."""
    config = COUNTRY_FORECAST_CONFIG.get(iso)
    if not config:
        return None

    if iso == 'COD':
        # DRC: aggregate by province + date
        qs = ForecastData.objects.filter(
            country_iso='COD', data_type='regional'
        ).values('province', 'date').annotate(
            total_cases=Sum('cases'),
            total_deaths=Sum('deaths'),
        ).order_by('province', 'date')

        if not qs.exists():
            return None

        provinces = defaultdict(list)
        province_cum = defaultdict(lambda: {'cases': 0, 'deaths': 0})
        for entry in qs:
            p = entry['province']
            province_cum[p]['cases'] += entry['total_cases']
            province_cum[p]['deaths'] += entry['total_deaths']
            provinces[p].append({
                'date': entry['date'].isoformat(),
                'cases': entry['total_cases'],
                'deaths': entry['total_deaths'],
                'cumulative_cases': province_cum[p]['cases'],
                'cumulative_deaths': province_cum[p]['deaths'],
            })
        return dict(provinces)
    else:
        # No regional data for MOZ
        return None


def _read_moz_district_summary():
    """Read MOZ district-level intervention plan summary from DB."""
    qs = ForecastData.objects.filter(
        country_iso='MOZ', data_type='district_summary'
    ).order_by('-cases')

    if not qs.exists():
        return None

    return [
        {
            'district': row.district,
            'province': row.province,
            'total_cases': row.cases,
            'total_deaths': row.deaths,
            'risk_level': row.risk_level,
            'action_required': row.action_required,
        }
        for row in qs
    ]


def _compute_drc_province_summary():
    """Derive DRC province-level summary from aggregated granular data."""
    data = _read_regional_csv('COD')
    if not data:
        return None
    rows = []
    for province, history in data.items():
        if not history:
            continue
        last = history[-1]
        cases = last['cumulative_cases']
        deaths = last['cumulative_deaths']
        if deaths > 0:
            risk, action = 'CRITICAL', 'Deploy CTCs'
        elif cases >= 5000:
            risk, action = 'HIGH', 'Mass Chlorination'
        elif cases >= 1000:
            risk, action = 'MEDIUM', 'Stock ORS'
        else:
            risk, action = 'LOW', 'Monitor'
        rows.append({
            'district': province,
            'province': province,
            'total_cases': cases,
            'total_deaths': deaths,
            'risk_level': risk,
            'action_required': action,
        })
    return sorted(rows, key=lambda x: -x['total_cases'])


class PredictionModelViewSet(viewsets.ReadOnlyModelViewSet):
    """API for prediction model metadata."""
    queryset = PredictionModel.objects.filter(is_active=True)
    serializer_class = PredictionModelSerializer
    permission_classes = [IsAuthenticated]


class OutbreakPredictionViewSet(viewsets.ReadOnlyModelViewSet):
    """
    API for outbreak predictions.
    Supports filtering by country, disease, risk_level.
    """
    queryset = OutbreakPrediction.objects.all()
    permission_classes = [IsAuthenticated]
    
    def get_serializer_class(self):
        if self.action == 'retrieve' or self.action == 'country_detail':
            return OutbreakPredictionDetailSerializer
        return OutbreakPredictionListSerializer
    
    def get_queryset(self):
        qs = super().get_queryset()
        
        # Filter by country
        country = self.request.query_params.get('country')
        if country:
            qs = qs.filter(country_iso__iexact=country)
        
        # Filter by disease
        disease = self.request.query_params.get('disease')
        if disease:
            qs = qs.filter(disease_name__iexact=disease)
        
        # Filter by risk level
        risk_level = self.request.query_params.get('risk_level')
        if risk_level:
            qs = qs.filter(risk_level__iexact=risk_level)
        
        # Filter by minimum score
        min_score = self.request.query_params.get('min_score')
        if min_score:
            qs = qs.filter(composite_risk_score__gte=float(min_score))
        
        return qs
    
    @action(detail=False, methods=['get'])
    def top_risks(self, request):
        """Top 10 highest-risk country-disease combinations."""
        limit = int(request.query_params.get('limit', 10))
        qs = self.get_queryset().order_by('-composite_risk_score')[:limit]
        serializer = OutbreakPredictionListSerializer(qs, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'], url_path='country/(?P<iso>[A-Z]{3})')
    def country_detail(self, request, iso=None):
        """All predictions for a specific country."""
        qs = self.get_queryset().filter(country_iso__iexact=iso)
        serializer = OutbreakPredictionDetailSerializer(qs, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def summary(self, request):
        """Dashboard summary KPIs."""
        qs = self.get_queryset()
        
        total = qs.count()
        critical = qs.filter(risk_level='CRITICAL').count()
        high = qs.filter(risk_level='HIGH').count()
        
        # Highest risk
        top = qs.order_by('-composite_risk_score').first()
        
        # Average confidence
        avg_confidence = qs.aggregate(avg=Avg('confidence'))['avg'] or 0
        
        # Countries at risk (HIGH or CRITICAL)
        countries_at_risk = qs.filter(
            risk_level__in=['HIGH', 'CRITICAL']
        ).values('country_iso').distinct().count()
        
        # Data freshness
        latest = qs.order_by('-prediction_date').first()
        
        return Response({
            'total_predictions': total,
            'critical_count': critical,
            'high_count': high,
            'countries_at_risk': countries_at_risk,
            'avg_confidence': round(avg_confidence, 1),
            'highest_risk': {
                'country': top.country_name if top else None,
                'disease': top.disease_name if top else None,
                'score': top.composite_risk_score if top else 0,
            } if top else None,
            'last_computed': latest.prediction_date.isoformat() if latest else None,
        })
    
    @action(detail=False, methods=['get'])
    def risk_map(self, request):
        """
        Country-level risk data for map visualization.
        Returns highest risk per country (across all diseases).
        """
        horizon = request.query_params.get('horizon', '30')  # 30, 60, 90
        disease = request.query_params.get('disease')
        
        qs = self.get_queryset()
        if disease:
            qs = qs.filter(disease_name__iexact=disease)
        
        # Group by country, take highest composite score
        country_risks = {}
        for pred in qs:
            iso = pred.country_iso
            if iso not in country_risks or pred.composite_risk_score > country_risks[iso]['score']:
                cases_key = f'predicted_cases_{horizon}d'
                cases = getattr(pred, cases_key, pred.predicted_cases_30d)
                country_risks[iso] = {
                    'country_iso': iso,
                    'country_name': pred.country_name,
                    'score': pred.composite_risk_score,
                    'risk_level': pred.risk_level,
                    'top_disease': pred.disease_name,
                    'predicted_cases': cases,
                    'confidence': pred.confidence,
                    'data_sources': pred.data_sources_used,
                }
        
        return Response(list(country_risks.values()))
    
    @action(detail=False, methods=['get'])
    def trend_data(self, request):
        """Forecast time-series for a specific disease (optionally filtered by country)."""
        disease = request.query_params.get('disease', 'cholera')
        country = request.query_params.get('country')
        
        qs = self.get_queryset().filter(disease_name__iexact=disease)
        if country:
            qs = qs.filter(country_iso__iexact=country)
        
        # Return top 5 by risk for the disease  
        qs = qs.order_by('-composite_risk_score')[:5]
        
        result = []
        for pred in qs:
            result.append({
                'country_iso': pred.country_iso,
                'country_name': pred.country_name,
                'disease': pred.disease_name,
                'risk_score': pred.composite_risk_score,
                'forecast': pred.forecast_data,
                'confidence': pred.confidence,
            })
        
        return Response(result)
    
    @action(detail=False, methods=['get'], url_path='country_forecast/(?P<iso>[A-Z]{3})')
    def country_forecast(self, request, iso=None):
        """National-level weekly forecast from real ML model CSV data."""
        config = COUNTRY_FORECAST_CONFIG.get(iso)
        if not config:
            return Response(
                {'error': f'No forecast data available for {iso}'},
                status=status.HTTP_404_NOT_FOUND,
            )
        data = _read_national_csv(iso)
        if data is None:
            return Response(
                {'error': f'Forecast data not found for {iso}'},
                status=status.HTTP_404_NOT_FOUND,
            )
        # For COD, only return recent forecast data (Feb 2026 onwards)
        if iso == 'COD':
            data = [d for d in data if d['date'] >= '2026-02-01']
        return Response({
            'country_iso': iso,
            'country_name': config['name'],
            'disease': 'cholera',
            'data': data,
        })

    @action(detail=False, methods=['get'], url_path='regional_forecast/(?P<iso>[A-Z]{3})')
    def regional_forecast(self, request, iso=None):
        """Regional/provincial weekly forecast from real ML model CSV data."""
        config = COUNTRY_FORECAST_CONFIG.get(iso)
        if not config:
            return Response(
                {'error': f'No forecast data available for {iso}'},
                status=status.HTTP_404_NOT_FOUND,
            )
        provinces_data = _read_regional_csv(iso)
        if provinces_data is None:
            return Response({
                'country_iso': iso,
                'country_name': config['name'],
                'provinces': [],
            })
        provinces = [
            {'name': name, 'data': rows}
            for name, rows in sorted(provinces_data.items())
        ]
        return Response({
            'country_iso': iso,
            'country_name': config['name'],
            'provinces': provinces,
        })

    @action(detail=False, methods=['get'], url_path='intervention_plan/(?P<iso>[A-Z]{3})')
    def intervention_plan(self, request, iso=None):
        """District/province intervention plan — cases + deaths + risk level."""
        if iso == 'MOZ':
            data = _read_moz_district_summary()
            region_label = 'district'
        elif iso == 'COD':
            data = _compute_drc_province_summary()
            region_label = 'province'
        else:
            return Response(
                {'error': f'No intervention plan data available for {iso}'},
                status=status.HTTP_404_NOT_FOUND,
            )

        if data is None:
            return Response(
                {'error': f'Intervention plan data not found for {iso}'},
                status=status.HTTP_404_NOT_FOUND,
            )

        config = COUNTRY_FORECAST_CONFIG.get(iso, {})
        return Response({
            'country_iso': iso,
            'country_name': config.get('name', iso),
            'region_label': region_label,
            'disease': 'cholera',
            'total_regions': len(data),
            'data': data,
        })

    @action(detail=False, methods=['post'])
    def compute(self, request):
        """
        Recompute all predictions from live data sources.
        Admin/supervisor only.
        """
        from .composite_engine import compute_all_predictions

        result = compute_all_predictions()
        return Response({
            'status': 'success',
            'message': f"Computed {result['created']} new, updated {result['updated']}, {result['errors']} errors",
            **result,
        })


# ─── wbepi Scenario / ScenarioRun ViewSets ─────────────────────────


def _resolve_user_tenant(user):
    """Resolve the tenant to attach to a Scenario/ScenarioRun on create.

    Returns the user's ``tenant`` instance unless the user is super-admin
    (continental), in which case None is used so RLS policies treat the row
    as cross-tenant. None is also returned for unauthenticated requests
    (caught earlier by ``IsAuthenticated``, but defensive).
    """
    if not getattr(user, 'is_authenticated', False):
        return None
    if getattr(user, 'is_super_admin', False):
        return None
    return getattr(user, 'tenant', None)


def _enqueue_scenario_run(run, user):
    """Push a PENDING ScenarioRun onto the Celery queue.

    Imported lazily so the views module stays importable without a broker.
    Falls back to ``apply`` (synchronous in-process) when
    ``CELERY_TASK_ALWAYS_EAGER`` is enabled — useful for tests.
    """
    from .scenarios.tasks import run_scenario_task
    import logging
    logger = logging.getLogger(__name__)

    # Use the row's own tenant for the worker's RLS context. The row is
    # the source of truth — `tenant_id_for_rls` from the user can mismatch
    # when a super-admin creates a cross-tenant row (run.tenant_id=NULL),
    # which would cause the worker's `ScenarioRun.objects.get(pk=...)` to
    # be filtered out by the tenant_isolation policy. NULL → '0' (the
    # policy's cross-tenant escape hatch).
    tenant_id = str(run.tenant_id) if run.tenant_id else '0'

    try:
        run_scenario_task.delay(run_id=run.id, tenant_id=tenant_id)
    except Exception as e:  # noqa: BLE001 — Celery broker unreachable fallback: must drop to sync execution
        logger.warning(f"Celery broker unreachable ({type(e).__name__}: {e}). Falling back to synchronous execution.")
        run_scenario_task.apply(kwargs={'run_id': run.id, 'tenant_id': tenant_id})


class ScenarioViewSet(viewsets.ModelViewSet):
    """CRUD for saved SEIRDV scenario configurations.

    Tenant scoping is enforced by Postgres RLS — the view does not need to
    filter explicitly. The middleware sets ``app.current_tenant`` per
    request based on the authenticated user. ``tenant`` and ``created_by``
    are auto-populated from ``request.user`` on create.
    """

    queryset = Scenario.objects.all()
    serializer_class = ScenarioSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()
        pathogen = self.request.query_params.get('pathogen')
        if pathogen:
            qs = qs.filter(pathogen__iexact=pathogen)
        country = self.request.query_params.get('country')
        if country:
            qs = qs.filter(country_iso__iexact=country)
        return qs

    def perform_create(self, serializer):
        serializer.save(
            created_by=self.request.user,
            tenant=_resolve_user_tenant(self.request.user),
        )

    @action(detail=True, methods=['post'], url_path='run')
    def run(self, request, pk=None):
        """Enqueue an asynchronous run of the saved scenario.

        Body (optional):
            {
              "seed": 42,
              "parameters": { ... overrides on top of scenario.parameters ... }
            }

        Returns ``202 Accepted`` immediately with the ``ScenarioRun`` row in
        PENDING state. Poll ``GET /scenario-runs/{id}/`` for status and
        results.
        """
        scenario = self.get_object()
        req = ScenarioRunRequestSerializer(data=request.data)
        req.is_valid(raise_exception=True)

        snapshot = dict(scenario.parameters or {})
        if 'parameters' in req.validated_data:
            snapshot.update(req.validated_data['parameters'])

        run = ScenarioRun.objects.create(
            scenario=scenario,
            status=ScenarioRun.STATUS_PENDING,
            seed=req.validated_data.get('seed'),
            parameters_snapshot=snapshot,
            n_sims=int(snapshot.get('n_sims', 1)),
            time_steps=int(snapshot.get('time', 1)),
            created_by=request.user,
            tenant=scenario.tenant or _resolve_user_tenant(request.user),
        )
        _enqueue_scenario_run(run, request.user)
        return Response(
            ScenarioRunListSerializer(run).data,
            status=status.HTTP_202_ACCEPTED,
        )

    @action(detail=False, methods=['post'], url_path='fit')
    def fit(self, request):
        """Fit SEIRDV parameters (beta, sigma, gamma, mu) from observed cases.
        
        Body:
            {
              "pathogen_id": "cholera",
              "observed_cumulative_cases": [0, 5, 20, 50, ...],
              "time_grid": [0, 7, 14, 21, ...],
              "initial_S": 1000000,
              "initial_I": 1,
              "n_bootstrap": 200
            }
        """
        req = ScenarioFitRequestSerializer(data=request.data)
        req.is_valid(raise_exception=True)

        from .scenarios.wbepi_engine.fitting import fit_with_bootstrap

        try:
            fit_res = fit_with_bootstrap(
                pathogen_id=req.validated_data['pathogen_id'],
                observed_cumulative_cases=req.validated_data['observed_cumulative_cases'],
                time_grid=req.validated_data['time_grid'],
                initial_S=req.validated_data['initial_S'],
                initial_I=req.validated_data.get('initial_I', 1.0),
                n_bootstrap=req.validated_data.get('n_bootstrap', 200),
            )
        except (ValueError, TypeError, KeyError, AttributeError) as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        return Response({
            'pathogen_id': fit_res.pathogen_id,
            'point_estimate': fit_res.point_estimate,
            'ci_lower': fit_res.ci_lower,
            'ci_upper': fit_res.ci_upper,
            'rmse': fit_res.rmse,
            'n_bootstrap': fit_res.n_bootstrap,
            'converged': fit_res.converged,
            'notes': fit_res.notes,
        })


    @action(detail=False, methods=['get'], url_path='cross-module-summary')
    def cross_module_summary(self, request):
        """
        Exposes scenario configurations and their latest run summaries to other PDX modules
        (OneHealth, Decision WHO, Risk Sentinel).
        Query params: country_iso, pathogen
        """
        qs = self.get_queryset()
        
        country = request.query_params.get('country_iso')
        if country:
            qs = qs.filter(country_iso__iexact=country)
            
        pathogen = request.query_params.get('pathogen')
        if pathogen:
            qs = qs.filter(pathogen__iexact=pathogen)
            
        # For each scenario, get the latest successful run
        results = []
        for scenario in qs:
            latest_run = scenario.runs.filter(status='SUCCESS').order_by('-completed_at').first()
            run_data = None
            if latest_run:
                run_data = {
                    'run_id': latest_run.id,
                    'completed_at': latest_run.completed_at,
                    'summary_stats': latest_run.summary_stats,
                }
                
            results.append({
                'scenario_id': scenario.id,
                'name': scenario.name,
                'pathogen': scenario.pathogen,
                'country_iso': scenario.country_iso,
                'parameters': scenario.parameters,
                'latest_run': run_data
            })
            
        return Response(results)

class ScenarioRunViewSet(viewsets.ReadOnlyModelViewSet):
    """List and inspect ScenarioRun rows. Read-only — runs are created via
    POST /scenarios/{id}/run/ or POST /scenario-runs/adhoc/.
    """

    queryset = ScenarioRun.objects.all()
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.action == 'list':
            return ScenarioRunListSerializer
        return ScenarioRunDetailSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        scenario_id = self.request.query_params.get('scenario')
        if scenario_id:
            qs = qs.filter(scenario_id=scenario_id)
        run_status = self.request.query_params.get('status')
        if run_status:
            qs = qs.filter(status=run_status.upper())
        return qs

    @action(detail=False, methods=['post'], url_path='adhoc')
    def adhoc(self, request):
        """Enqueue an asynchronous ad-hoc run without persisting a Scenario.

        Body:
            {
              "seed": 42,
              "parameters": { full run_seirdv kwargs }
            }
        """
        req = ScenarioRunRequestSerializer(data=request.data)
        req.is_valid(raise_exception=True)
        params = req.validated_data.get('parameters') or {}

        run = ScenarioRun.objects.create(
            scenario=None,
            status=ScenarioRun.STATUS_PENDING,
            seed=req.validated_data.get('seed'),
            parameters_snapshot=params,
            n_sims=int(params.get('n_sims', 1)),
            time_steps=int(params.get('time', 1)),
            created_by=request.user,
            tenant=_resolve_user_tenant(request.user),
        )
        _enqueue_scenario_run(run, request.user)
        return Response(
            ScenarioRunListSerializer(run).data,
            status=status.HTTP_202_ACCEPTED,
        )

    @action(detail=True, methods=['get'], url_path='output')
    def output(self, request, pk=None):
        """Return the raw output blob JSON for a completed run."""
        from django.http import JsonResponse

        run = self.get_object()
        if run.status != ScenarioRun.STATUS_SUCCESS:
            return Response(
                {'detail': f'Run is not complete (status={run.status})'},
                status=status.HTTP_409_CONFLICT,
            )
        if run.output_blob is None:
            return Response(
                {'detail': 'No output data available'},
                status=status.HTTP_404_NOT_FOUND,
            )
        return JsonResponse(run.output_blob, safe=False)

    @action(detail=False, methods=['get'], url_path='engine-health')
    def engine_health(self, request):
        """Lightweight health probe for the wbepi simulation engine.

        Returns 200 with R/wbepi version info and RSS, or 503 if
        the R engine fails to load.

        ``GET /api/v1/predictions/scenario-runs/engine-health/``
        """
        payload = {'engine': 'r', 'status': 'ok'}

        try:
            from predictions.scenarios.wbepi_engine.r_engine import (
                health_check, get_worker_rss_mb,
            )
            info = health_check()
            payload.update(info)
            rss = get_worker_rss_mb()
            if rss > 0:
                payload['worker_rss_mb'] = round(rss, 1)
        except Exception as exc:  # noqa: BLE001 — health probe: any failure must be reported as a status payload, never raise
            payload['status'] = 'error'
            payload['detail'] = str(exc)[:500]
            return Response(payload, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        return Response(payload)

