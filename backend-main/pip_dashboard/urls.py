from django.urls import path
from . import views

urlpatterns = [
    path('summary', views.get_summary, name='pip_summary'),
    path('categories', views.get_categories, name='pip_categories'),
    path('countries', views.get_countries, name='pip_countries'),
    path('country/<str:country_name>', views.get_country_detail, name='pip_country_detail'),
    path('indicators', views.get_indicators, name='pip_indicators'),
    path('heatmap', views.get_heatmap_data, name='pip_heatmap'),
    path('regional-comparison', views.get_regional_comparison, name='pip_regional_comparison'),
    path('pip-indicators', views.get_pip_indicators, name='pip_pip_indicators'),
    path('bulletin', views.get_bulletin, name='pip_bulletin'),
]
