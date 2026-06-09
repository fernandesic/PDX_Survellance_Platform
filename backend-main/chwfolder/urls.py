from django.urls import path
from . import views

urlpatterns = [
    # ─── New CHW Dashboard API ───
    path('summary/', views.CHWSummaryView.as_view(), name='chw-summary'),
    path('countries/', views.CountryListView.as_view(), name='chw-countries'),
    path('countries/<int:pk>/', views.CountryDetailView.as_view(), name='chw-country-detail'),
    path('countries/<int:pk>/regions/', views.CountryRegionsView.as_view(), name='chw-country-regions'),
    path('countries/<int:pk>/districts/', views.CountryDistrictsView.as_view(), name='chw-country-districts'),
    path('regions/<int:pk>/', views.RegionDetailView.as_view(), name='chw-region-detail'),
    path('map/', views.MapDataView.as_view(), name='chw-map'),
    path('map/<int:pk>/', views.MapCountryDetailView.as_view(), name='chw-map-country'),
    path('worker-types/', views.WorkerTypeListView.as_view(), name='chw-worker-types'),
    path('worker-types/<int:pk>/', views.WorkerTypeCountryView.as_view(), name='chw-worker-types-country'),
    path('facilities/geo/', views.FacilityGeoView.as_view(), name='chw-facilities-geo'),

    # ─── Backward-compatible endpoints ───
    path('', views.DistrictListView.as_view(), name='chw-district-list'),
    path('pipeline/', views.PipelineView.as_view(), name='chw-pipeline'),

    # ─── Whonghub Proxy ───
    path('whonghub/proxy/', views.WhonghubProxyView.as_view(), name='whonghub-proxy'),
    path('whonghub/proxy/<int:dataset_id>/', views.WhonghubProxyView.as_view(), name='whonghub-proxy-detail'),

    # ─── CHW Field Reports (dedicated endpoint) ───
    path('field-reports/', views.FieldReportsView.as_view(), name='chw-field-reports'),
]
