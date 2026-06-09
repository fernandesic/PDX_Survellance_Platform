import math
from rest_framework import serializers
from .models import Country, Region, District, WorkerType, Facility, DataUpload


class SafeFloatField(serializers.FloatField):
    """FloatField that converts NaN / Infinity → None (null in JSON).
    Python floats can hold NaN but JSON cannot."""
    def to_representation(self, value):
        if value is None or (isinstance(value, float) and (math.isnan(value) or math.isinf(value))):
            return None
        return super().to_representation(value)


# ─── Country serializers ───

class CountryListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for country lists."""
    active_percentage = SafeFloatField(required=False, allow_null=True)
    chws_per_10000 = SafeFloatField(required=False, allow_null=True)
    worker_type_count = serializers.SerializerMethodField()
    
    class Meta:
        model = Country
        fields = [
            'id', 'country', 'iso_code', 'total_chws', 'active_chws',
            'inactive_chws', 'volunteer_chws', 'paid_chws', 'active_percentage',
            'data_flag', 'total_regions', 'total_districts', 'total_facilities',
            'population_2024', 'chws_per_10000', 'data_year', 'data_date',
            'worker_type_count'
        ]

    def get_worker_type_count(self, obj):
        return WorkerType.objects.filter(country=obj).values('worker_type').distinct().count()


class CountryDetailSerializer(serializers.ModelSerializer):
    """Full country detail with nested regions."""
    active_percentage = SafeFloatField(required=False, allow_null=True)
    chws_per_10000 = SafeFloatField(required=False, allow_null=True)
    latitude = SafeFloatField(required=False, allow_null=True)
    longitude = SafeFloatField(required=False, allow_null=True)
    regions = serializers.SerializerMethodField()
    worker_types = serializers.SerializerMethodField()
    
    class Meta:
        model = Country
        fields = [
            'id', 'country', 'iso_code', 'total_chws', 'active_chws',
            'inactive_chws', 'volunteer_chws', 'paid_chws', 'active_percentage',
            'data_flag', 'latitude', 'longitude', 'total_regions',
            'total_districts', 'total_facilities', 'population_2024',
            'chws_per_10000', 'data_year', 'data_date', 'data_source',
            'last_updated', 'regions', 'worker_types'
        ]

    def get_regions(self, obj):
        regions = Region.objects.filter(country=obj).order_by('-total_chws')
        return RegionSerializer(regions, many=True).data

    def get_worker_types(self, obj):
        from django.db.models import Sum
        types = (
            WorkerType.objects
            .filter(country=obj)
            .values('worker_type')
            .annotate(total=Sum('count'))
            .order_by('-total')
        )
        return list(types)


# ─── Region serializers ───

class RegionSerializer(serializers.ModelSerializer):
    active_percentage = SafeFloatField(required=False, allow_null=True)

    class Meta:
        model = Region
        fields = [
            'id', 'region_name', 'admin_level', 'total_chws',
            'active_chws', 'inactive_chws', 'volunteer_chws', 'paid_chws',
            'active_percentage', 'data_flag', 'total_population',
            'total_facilities', 'district_count'
        ]


class RegionDetailSerializer(serializers.ModelSerializer):
    """Region with nested districts."""
    active_percentage = SafeFloatField(required=False, allow_null=True)
    districts = serializers.SerializerMethodField()
    worker_types = serializers.SerializerMethodField()
    country_name = serializers.CharField(source='country.country', read_only=True)
    
    class Meta:
        model = Region
        fields = [
            'id', 'region_name', 'admin_level', 'total_chws',
            'active_chws', 'inactive_chws', 'volunteer_chws', 'paid_chws',
            'active_percentage', 'data_flag', 'total_population',
            'total_facilities', 'district_count', 'country_name',
            'districts', 'worker_types'
        ]

    def get_districts(self, obj):
        districts = District.objects.filter(region=obj).order_by('-total_chws')
        return DistrictSerializer(districts, many=True).data

    def get_worker_types(self, obj):
        from django.db.models import Sum
        return list(
            WorkerType.objects
            .filter(region=obj)
            .values('worker_type')
            .annotate(total=Sum('count'))
            .order_by('-total')
        )


# ─── District serializers ───

class DistrictSerializer(serializers.ModelSerializer):
    active_percentage = SafeFloatField(required=False, allow_null=True)
    chws_per_10k = SafeFloatField(required=False, allow_null=True)
    region_name = serializers.CharField(source='region.region_name', read_only=True)
    country_name = serializers.CharField(source='country.country', read_only=True)
    
    class Meta:
        model = District
        fields = [
            'id', 'district_name', 'admin_level', 'total_chws',
            'active_chws', 'inactive_chws', 'volunteer_chws', 'paid_chws',
            'active_percentage', 'data_flag', 'population', 'households',
            'chws_per_10k', 'region_name', 'country_name'
        ]


# ─── Worker Type serializers ───

class WorkerTypeSerializer(serializers.ModelSerializer):
    country_name = serializers.CharField(source='country.country', read_only=True)
    region_name = serializers.CharField(source='region.region_name', read_only=True, default=None)
    district_name = serializers.CharField(source='district.district_name', read_only=True, default=None)
    
    class Meta:
        model = WorkerType
        fields = [
            'id', 'worker_type', 'count',
            'country_name', 'region_name', 'district_name'
        ]


# ─── Facility serializers ───

class FacilitySerializer(serializers.ModelSerializer):
    country_name = serializers.CharField(source='country.country', read_only=True)
    
    class Meta:
        model = Facility
        fields = [
            'id', 'facility_type', 'count', 'facility_name',
            'latitude', 'longitude', 'ownership', 'country_name'
        ]


# ─── Map serializers ───

class CountryMapSerializer(serializers.ModelSerializer):
    """Optimized for map rendering."""
    chws_per_10000 = SafeFloatField(required=False, allow_null=True)

    class Meta:
        model = Country
        fields = ['id', 'country', 'iso_code', 'total_chws', 'chws_per_10000']


class FacilityGeoSerializer(serializers.ModelSerializer):
    """Only geo-located facilities for map markers."""
    class Meta:
        model = Facility
        fields = [
            'id', 'facility_name', 'facility_type', 'latitude',
            'longitude', 'ownership', 'country_id'
        ]


# ─── Summary serializer ───

class CHWSummarySerializer(serializers.Serializer):
    """Global KPIs."""
    total_countries = serializers.IntegerField()
    total_chws = serializers.IntegerField()
    total_active_chws = serializers.IntegerField()
    total_inactive_chws = serializers.IntegerField()
    total_volunteer_chws = serializers.IntegerField()
    total_paid_chws = serializers.IntegerField()
    total_regions = serializers.IntegerField()
    total_districts = serializers.IntegerField()
    total_facilities = serializers.IntegerField()
    total_worker_types = serializers.IntegerField()
    countries = CountryListSerializer(many=True)


# ─── Backward compatibility (for overview page) ───

class ChwListResponse(serializers.Serializer):
    """Backward-compat paged response for old API."""
    count = serializers.IntegerField()
    next = serializers.CharField(allow_null=True)
    previous = serializers.CharField(allow_null=True)
    results = DistrictSerializer(many=True)
    total_countries = serializers.IntegerField()


class ChwPipelineResponse(serializers.Serializer):
    """Backward-compat pipeline response for old API."""
    country = serializers.CharField()
    total_chws = serializers.IntegerField()
    chw_density = serializers.FloatField()
    top_region = serializers.DictField()
    total_districts = serializers.IntegerField()


# ─── For overview page's ChartCountrySerializer ───

class ChartCountrySerializer(serializers.ModelSerializer):
    """Used by account/serializers.py for overview KPI cards."""
    year = serializers.IntegerField(source='data_year')
    population = serializers.IntegerField(source='population_2024')
    chw = serializers.IntegerField(source='total_chws')
    
    class Meta:
        model = Country
        fields = ['year', 'country', 'chw', 'population']
