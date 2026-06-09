"""
Outbreak Workspace — URL Configuration
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import OutbreakViewSet, PathogenViewSet, UploadTrackerView

router = DefaultRouter()
router.register(r'outbreaks', OutbreakViewSet, basename='outbreak')
router.register(r'pathogens', PathogenViewSet, basename='pathogen')

urlpatterns = [
    path('', include(router.urls)),
    path('upload-tracker/', UploadTrackerView.as_view(), name='outbreak-upload-tracker'),
]
