from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    OutbreakPredictionViewSet,
    PredictionModelViewSet,
    ScenarioViewSet,
    ScenarioRunViewSet,
)

router = DefaultRouter()
router.register(r'predictions', OutbreakPredictionViewSet, basename='prediction')
router.register(r'models', PredictionModelViewSet, basename='prediction-model')
router.register(r'scenarios', ScenarioViewSet, basename='scenario')
router.register(r'scenario-runs', ScenarioRunViewSet, basename='scenario-run')

urlpatterns = [
    path('', include(router.urls)),
]
