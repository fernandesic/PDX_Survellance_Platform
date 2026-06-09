from rest_framework import generics, status
import requests
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.conf import settings
from django.db.models import Sum, Count, Avg, F

from .models import Country, Region, District, WorkerType, Facility, DataUpload
from .serializers import (
    CountryListSerializer, CountryDetailSerializer,
    RegionSerializer, RegionDetailSerializer,
    DistrictSerializer, WorkerTypeSerializer,
    FacilitySerializer, CountryMapSerializer,
    FacilityGeoSerializer, CHWSummarySerializer,
    ChartCountrySerializer,
)


class CHWSummaryView(APIView):
    """GET /chw/summary/ — Global KPI summary."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from kobo.models import KoboSubmission
        from sentinel.models import Signal
        from utils.tenant_tasks import tenant_context

        with tenant_context('0'):
            kobo_submissions_count = KoboSubmission.objects.count()
            active_chw_reports_count = Signal.objects.filter(source_name='KoboToolbox CHW').count()
            countries = Country.objects.all()

            data = {
                # Count unique countries (Tanzania Mainland+Zanzibar = 1 country by ISO)
                'total_countries': countries.values('iso_code').distinct().count(),
                'total_chws': countries.aggregate(t=Sum('total_chws'))['t'] or 0,
                'total_active_chws': countries.aggregate(t=Sum('active_chws'))['t'] or 0,
                'total_inactive_chws': countries.aggregate(t=Sum('inactive_chws'))['t'] or 0,
                'total_volunteer_chws': countries.aggregate(t=Sum('volunteer_chws'))['t'] or 0,
                'total_paid_chws': countries.aggregate(t=Sum('paid_chws'))['t'] or 0,
                'total_regions': Region.objects.count(),
                'total_districts': District.objects.count(),
                'total_facilities': countries.aggregate(t=Sum('total_facilities'))['t'] or 0,
                'total_worker_types': (
                    WorkerType.objects.values('worker_type').distinct().count()
                ),
                'kobo_submissions_count': kobo_submissions_count,
                'active_chw_reports_count': active_chw_reports_count,
                'countries': CountryListSerializer(
                    countries.order_by('-total_chws'), many=True
                ).data,
            }
        return Response(data)

class WhonghubProxyView(APIView):
    """
    Proxy to bypass CORS for api.whonghub.org.
    """
    permission_classes = [IsAuthenticated]

    def _get_headers(self):
        token = getattr(settings, 'WHONGHUB_API_TOKEN', '')
        headers = {"Accept": "application/json"}
        if token:
            headers["Authorization"] = f"Token {token}"
        return headers

    def get(self, request, dataset_id=None):
        base_url = "https://api.whonghub.org/api/v1/data"
        url = f"{base_url}/{dataset_id}" if dataset_id else base_url
        
        try:
            response = requests.get(url, headers=self._get_headers(), timeout=25)
            response.raise_for_status()
            return Response(response.json())
        except requests.exceptions.RequestException as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class FieldReportsView(APIView):
    """
    GET /chwfolder/field-reports/ — CHW field reports from Whonghub.
    Dataset ID is configured via WHONGHUB_FIELD_REPORTS_DATASET_ID env var.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        dataset_id = getattr(settings, 'WHONGHUB_FIELD_REPORTS_DATASET_ID', '')
        if not dataset_id:
            return Response(
                {"error": "WHONGHUB_FIELD_REPORTS_DATASET_ID not configured"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        token = getattr(settings, 'WHONGHUB_API_TOKEN', '')
        headers = {"Accept": "application/json"}
        if token:
            headers["Authorization"] = f"Token {token}"

        url = f"https://api.whonghub.org/api/v1/data/{dataset_id}"
        try:
            response = requests.get(url, headers=headers, timeout=25)
            response.raise_for_status()
            data = response.json()
            # Sort newest first by submission time
            if isinstance(data, list):
                data.sort(key=lambda r: r.get('_submission_time', ''), reverse=True)
            return Response(data)
        except requests.exceptions.RequestException as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class CountryListView(generics.ListAPIView):
    """GET /chw/countries/ — All countries with CHW totals."""
    permission_classes = [IsAuthenticated]
    serializer_class = CountryListSerializer
    queryset = Country.objects.all().order_by('-total_chws')

    def get_queryset(self):
        qs = super().get_queryset()
        search = self.request.query_params.get('search')
        if search:
            qs = qs.filter(country__icontains=search)
        sort_by = self.request.query_params.get('sort', '-total_chws')
        if sort_by:
            qs = qs.order_by(sort_by)
        return qs


class CountryDetailView(generics.RetrieveAPIView):
    """GET /chw/countries/<id>/ — Country detail with regions."""
    permission_classes = [IsAuthenticated]
    serializer_class = CountryDetailSerializer
    queryset = Country.objects.all()


class CountryRegionsView(generics.ListAPIView):
    """GET /chw/countries/<id>/regions/ — Regions for a country."""
    permission_classes = [IsAuthenticated]
    serializer_class = RegionSerializer

    def get_queryset(self):
        country_id = self.kwargs['pk']
        return Region.objects.filter(country_id=country_id).order_by('-total_chws')


class CountryDistrictsView(generics.ListAPIView):
    """GET /chw/countries/<id>/districts/ — Districts for a country."""
    permission_classes = [IsAuthenticated]
    serializer_class = DistrictSerializer

    def get_queryset(self):
        country_id = self.kwargs['pk']
        qs = District.objects.filter(country_id=country_id)
        search = self.request.query_params.get('search')
        if search:
            qs = qs.filter(district_name__icontains=search)
        return qs.order_by('-total_chws')


class RegionDetailView(generics.RetrieveAPIView):
    """GET /chw/regions/<id>/ — Region detail with districts."""
    permission_classes = [IsAuthenticated]
    serializer_class = RegionDetailSerializer
    queryset = Region.objects.all()


class MapDataView(APIView):
    """GET /chw/map/ — Country-level choropleth data."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        countries = Country.objects.all().order_by('-total_chws')
        data = CountryMapSerializer(countries, many=True).data
        return Response(data)


class MapCountryDetailView(APIView):
    """GET /chw/map/<id>/ — Region-level data for a country."""
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        regions = Region.objects.filter(country_id=pk).order_by('-total_chws')
        data = RegionSerializer(regions, many=True).data
        return Response(data)


class WorkerTypeListView(APIView):
    """GET /chw/worker-types/ — CHW type breakdown per country."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        country_id = request.query_params.get('country_id')
        qs = WorkerType.objects.all()
        if country_id:
            qs = qs.filter(country_id=country_id)

        # Aggregate by country + worker_type
        result = (
            qs.values('country__country', 'country__iso_code', 'worker_type')
            .annotate(total=Sum('count'))
            .order_by('country__country', '-total')
        )
        return Response(list(result))


class WorkerTypeCountryView(APIView):
    """GET /chw/worker-types/<country_id>/ — Per-country type detail."""
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        # By region
        by_region = (
            WorkerType.objects
            .filter(country_id=pk)
            .values('region__region_name', 'worker_type')
            .annotate(total=Sum('count'))
            .order_by('region__region_name', '-total')
        )
        return Response(list(by_region))


class FacilityGeoView(generics.ListAPIView):
    """GET /chw/facilities/geo/ — Geo-located facilities for map markers."""
    permission_classes = [IsAuthenticated]
    serializer_class = FacilityGeoSerializer

    def get_queryset(self):
        qs = Facility.objects.filter(
            latitude__isnull=False, longitude__isnull=False
        )
        country_id = self.request.query_params.get('country_id')
        if country_id:
            qs = qs.filter(country_id=country_id)
        return qs[:5000]  # Limit for performance


# ──────────────────────────────────────────────────
# Backward-compatible views (keep old frontend working)
# ──────────────────────────────────────────────────

class DistrictListView(generics.ListAPIView):
    """
    GET /chwfolder/ — Paginated list of districts.
    Backward compat with old frontend.
    """
    permission_classes = [IsAuthenticated]
    serializer_class = DistrictSerializer

    def get_queryset(self):
        return District.objects.select_related('region', 'country').all()

    def list(self, request, *args, **kwargs):
        qs = self.get_queryset()
        page_size = int(request.query_params.get('page_size', 100))
        page = int(request.query_params.get('page', 1))
        start = (page - 1) * page_size
        end = start + page_size

        results = qs[start:end]
        total = qs.count()
        has_next = end < total

        return Response({
            'count': total,
            'next': f'?page={page + 1}&page_size={page_size}' if has_next else None,
            'previous': f'?page={page - 1}&page_size={page_size}' if page > 1 else None,
            'results': DistrictSerializer(results, many=True).data,
            'total_countries': Country.objects.count(),
        })


class PipelineView(APIView):
    """
    GET /chwfolder/pipeline — Country pipeline data.
    Backward compat with old frontend.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        country_name = request.query_params.get('country')
        if not country_name:
            countries = Country.objects.all()
            return Response([self._summary(c) for c in countries])

        try:
            country = Country.objects.get(country__icontains=country_name)
            return Response(self._summary(country))
        except Country.DoesNotExist:
            return Response({'error': 'Country not found'}, status=404)

    def _summary(self, country):
        top_region = (
            Region.objects
            .filter(country=country)
            .order_by('-total_chws')
            .first()
        )
        return {
            'country': country.country,
            'total_chws': country.total_chws,
            'chw_density': country.chws_per_10000,
            'top_region': {
                'name': top_region.region_name if top_region else None,
                'chws': top_region.total_chws if top_region else 0,
            } if top_region else None,
            'total_districts': country.total_districts,
        }