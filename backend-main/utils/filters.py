from django.db.models import Min, Avg
import django_filters
from django.db.models.functions import Lower
from django.db.models import Q, F

from chwfolder.models import District
from espar.models import Espar
from stardata.models import StarData
from account.models import Alert
from readiness.models import (
    ArboVirus, Cholera, CholeraSubNational, Cyclone, FVD, FVDPoE,
    LassaFever, LassaFeverDistrict, Marburg, Meningitis,
    MeningitiseElimination, Mpox, MpoxDistrict, NaturalDisaster,
    RiftValleyFever,
)
class DistrictFilter(django_filters.FilterSet):
    country = django_filters.CharFilter(field_name="country__country", lookup_expr="icontains")
    region = django_filters.CharFilter(field_name="region__region_name", lookup_expr="icontains")
    district = django_filters.CharFilter(field_name="district_name", lookup_expr="icontains")
    
    class Meta:
        model = District
        fields = ["country", "region", "district"]
        

class EsparFilter(django_filters.FilterSet):
    region = django_filters.CharFilter(field_name="region", lookup_expr="icontains")
    state = django_filters.CharFilter(field_name="states", lookup_expr="icontains")
    iso_code = django_filters.CharFilter(field_name="iso_code", lookup_expr="icontains")
    
    class Meta:
        model = Espar
        fields = ["region", "iso_code", "state"]
        

class StardataFilter(django_filters.FilterSet):
    country = django_filters.CharFilter(field_name="country", lookup_expr="icontains")
    level = django_filters.CharFilter(field_name="level", lookup_expr="icontains")
    year = django_filters.CharFilter(field_name="year", lookup_expr="iexact")
    
    month = django_filters.CharFilter(method='filter_month')
    
    class Meta:
        model = StarData
        fields = ["country", "level", "year", "month"]

    def filter_month(self, queryset, name, value):
        if not value:
            return queryset
        month_field = value.lower().strip()
        valid_months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
        if month_field in valid_months:
            return queryset.exclude(**{f'{month_field}__exact': ''}).exclude(**{f'{month_field}__isnull': True})
        return queryset
        

class AlertFilter(django_filters.FilterSet):
    severity = django_filters.CharFilter(field_name="severity", lookup_expr="iexact")
    status = django_filters.CharFilter(field_name="status", lookup_expr="iexact")
    category = django_filters.CharFilter(field_name="category", lookup_expr="iexact")
    search = django_filters.CharFilter(method='filter_by_search')
    
    class Meta:
        model = Alert
        fields = ["severity", "status", "category", "search"]
        
    def filter_by_search(self, queryset, name, value):
        return queryset.filter(
            Q(title__icontains=value) | Q(country__icontains=value) | Q(region__icontains=value)
        )
        
class ArbovirusFilter(django_filters.FilterSet):
    country = django_filters.CharFilter(method='filter_country')
    def filter_country(self, queryset, name, value):
        if not value:
            return queryset
        return (
            queryset
            .filter(country_lower=value.lower())
        )
    class Meta:
        model = ArboVirus
        fields = ["country"]
        
        
class CholeraFilter(django_filters.FilterSet):
    country = django_filters.CharFilter(method='filter_country')
    def filter_country(self, queryset, name, value):
        if not value:
            return queryset
        return (
            queryset
            .filter(country_lower=value.lower())
        )
    class Meta:
        model = Cholera
        fields = ["country"]
        
class CholeraSubNationalFilter(django_filters.FilterSet):
    country = django_filters.CharFilter(method='filter_country')
    def filter_country(self, queryset, name, value):
        if not value:
            return queryset
        return (
            queryset
            .filter(country_lower=value.lower())
        )
    class Meta:
        model = CholeraSubNational
        fields = ["country"]
        
class CycloneFilter(django_filters.FilterSet):
    country = django_filters.CharFilter(method='filter_country')
    def filter_country(self, queryset, name, value):
        if not value:
            return queryset
        return (
            queryset
            .filter(country_lower=value.lower())
        )
    class Meta:
        model = Cyclone
        fields = ["country"]
        

class FvDFilter(django_filters.FilterSet):
    country = django_filters.CharFilter(method='filter_country')
    def filter_country(self, queryset, name, value):
        if not value:
            return queryset
        return (
            queryset
            .filter(country_lower=value.lower())
        )
    class Meta:
        model = FVD
        fields = ["country"]
        
    
class FvDPoEFilter(django_filters.FilterSet):
    country = django_filters.CharFilter(method='filter_country')
    def filter_country(self, queryset, name, value):
        if not value:
            return queryset
        return (
            queryset
            .filter(country_lower=value.lower())
        )
    class Meta:
        model = FVDPoE
        fields = ["country"]
        

class LassaFeverFilter(django_filters.FilterSet):
    country = django_filters.CharFilter(method='filter_country')
    def filter_country(self, queryset, name, value):
        if not value:
            return queryset
        return (
            queryset
            .filter(country_lower=value.lower())
        )
    class Meta:
        model = LassaFever
        fields = ["country"]
        

class LassaFeverDistrictFilter(django_filters.FilterSet):
    country = django_filters.CharFilter(method='filter_country')
    def filter_country(self, queryset, name, value):
        if not value:
            return queryset
        return (
            queryset
            .filter(country_lower=value.lower())
        )
    class Meta:
        model = LassaFeverDistrict
        fields = ["country"]
        

class MarburgFilter(django_filters.FilterSet):
    country = django_filters.CharFilter(method='filter_country')
    def filter_country(self, queryset, name, value):
        if not value:
            return queryset
        return (
            queryset
            .filter(country_lower=value.lower())
        )
    class Meta:
        model = Marburg
        fields = ["country"]
        

class MeningitisFilter(django_filters.FilterSet):
    country = django_filters.CharFilter(method='filter_country')
    def filter_country(self, queryset, name, value):
        if not value:
            return queryset
        return (
            queryset
            .filter(country_lower=value.lower())
        )
    class Meta:
        model = Meningitis
        fields = ["country"]
        

class MeningitiseEliminationFilter(django_filters.FilterSet):
    country = django_filters.CharFilter(method='filter_country')
    def filter_country(self, queryset, name, value):
        if not value:
            return queryset
        return (
            queryset
            .filter(country_lower=value.lower())
        )
    class Meta:
        model = MeningitiseElimination
        fields = ["country"]
        

class MpoxFilter(django_filters.FilterSet):
    country = django_filters.CharFilter(method='filter_country')
    def filter_country(self, queryset, name, value):
        if not value:
            return queryset
        return (
            queryset
            .filter(country_lower=value.lower())
        )
    class Meta:
        model = Mpox
        fields = ["country"]
        
class MpoxDistrictFilter(django_filters.FilterSet):
    country = django_filters.CharFilter(method='filter_country')
    def filter_country(self, queryset, name, value):
        if not value:
            return queryset
        return (
            queryset
            .filter(country_lower=value.lower())
        )
    class Meta:
        model = MpoxDistrict
        fields = ["country"]
        
class NaturalDisasterFilter(django_filters.FilterSet):
    country = django_filters.CharFilter(method='filter_country')
    def filter_country(self, queryset, name, value):
        if not value:
            return queryset
        return (
            queryset
            .filter(country_lower=value.lower())
        )
    class Meta:
        model = NaturalDisaster
        fields = ["country"]
        
class RiftValleyFilter(django_filters.FilterSet):
    country = django_filters.CharFilter(method='filter_country')
    def filter_country(self, queryset, name, value):
        if not value:
            return queryset
        return (
            queryset
            .filter(country_lower=value.lower())
        )
    class Meta:
        model = RiftValleyFever
        fields = ["country"]