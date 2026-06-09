from django.urls import path
from .views import ArcGISQueryProxyView, ArcGISWebMapView

urlpatterns = [
    path("query/", ArcGISQueryProxyView.as_view(), name="arcgis_query"),
    path("webmap/", ArcGISWebMapView.as_view(), name="arcgis_webmap"),
]
