"""
URL configuration for drivequick project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/4.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.urls import path
from .views import (
    StardataUploadView, StardataListView, SummaryAPIView,
    ChartsAPIView, MapDataAPIView, UpcomingHazardsAPIView, ActiveHazardsAPIView,
)
from .rvf_candlestick_view import RVFCandlestickAPIView, CandlestickMetadataAPIView

urlpatterns = [
    path('load', StardataUploadView.as_view()),
    path('', StardataListView.as_view()),
    path('summary', SummaryAPIView.as_view()),
    path('charts', ChartsAPIView.as_view()),
    path('map', MapDataAPIView.as_view()),
    path('upcoming-hazards', UpcomingHazardsAPIView.as_view()),
    path('active-hazards', ActiveHazardsAPIView.as_view()),
    path('rvf-candlestick', RVFCandlestickAPIView.as_view()),
    path('candlestick-metadata', CandlestickMetadataAPIView.as_view()),
]
