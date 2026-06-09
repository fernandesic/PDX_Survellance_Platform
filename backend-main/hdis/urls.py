"""
HDIS Intelligence - URL Configuration
All endpoints served at /api/v1/hdis/
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from hdis.views import (
    IntelRecordViewSet, AlertViewSet, BriefingViewSet, SourceViewSet,
    manual_refresh, refresh_status,
)

router = DefaultRouter()
router.register(r'records', IntelRecordViewSet, basename='hdis-record')
router.register(r'alerts', AlertViewSet, basename='hdis-alert')
router.register(r'briefings', BriefingViewSet, basename='hdis-briefing')
router.register(r'sources', SourceViewSet, basename='hdis-source')

urlpatterns = [
    path('', include(router.urls)),
    path('refresh/', manual_refresh, name='hdis-refresh'),
    path('refresh/status/', refresh_status, name='hdis-refresh-status'),
]
