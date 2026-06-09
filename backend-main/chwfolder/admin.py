from django.contrib import admin
from .models import Country, Region, District, WorkerType, Facility, DataUpload


@admin.register(Country)
class CountryAdmin(admin.ModelAdmin):
    list_display = ['country', 'iso_code', 'total_chws', 'total_regions',
                    'total_districts', 'total_facilities', 'data_year', 'last_updated']
    search_fields = ['country', 'iso_code']
    list_filter = ['data_year']


@admin.register(Region)
class RegionAdmin(admin.ModelAdmin):
    list_display = ['region_name', 'country', 'admin_level', 'total_chws',
                    'district_count', 'total_facilities']
    search_fields = ['region_name']
    list_filter = ['country', 'admin_level']


@admin.register(District)
class DistrictAdmin(admin.ModelAdmin):
    list_display = ['district_name', 'region', 'country', 'total_chws',
                    'population', 'chws_per_10k']
    search_fields = ['district_name']
    list_filter = ['country', 'region']


@admin.register(WorkerType)
class WorkerTypeAdmin(admin.ModelAdmin):
    list_display = ['worker_type', 'count', 'country', 'region', 'district']
    search_fields = ['worker_type']
    list_filter = ['country', 'worker_type']


@admin.register(Facility)
class FacilityAdmin(admin.ModelAdmin):
    list_display = ['facility_type', 'count', 'country', 'region',
                    'district', 'facility_name']
    search_fields = ['facility_name', 'facility_type']
    list_filter = ['country', 'facility_type']


@admin.register(DataUpload)
class DataUploadAdmin(admin.ModelAdmin):
    list_display = ['file_name', 'country', 'status', 'rows_imported', 'uploaded_at']
    list_filter = ['status', 'country']