from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    PredictionSnapshotViewSet,
    OutcomeEventViewSet,
    MatchVerdictViewSet,
    ScoreCardViewSet,
    VeracityIndexViewSet,
    ReviewTicketViewSet,
    CalibrationRecordViewSet,
    EbolaEventViewSet,
    SourceAuditViewSet,
)

router = DefaultRouter()
router.register(r'snapshots', PredictionSnapshotViewSet, basename='snapshot')
router.register(r'outcomes', OutcomeEventViewSet, basename='outcome')
router.register(r'verdicts', MatchVerdictViewSet, basename='verdict')
router.register(r'scorecards', ScoreCardViewSet, basename='scorecard')
router.register(r'veracity', VeracityIndexViewSet, basename='veracity')
router.register(r'tickets', ReviewTicketViewSet, basename='ticket')
router.register(r'calibration', CalibrationRecordViewSet, basename='calibration')
router.register(r'ebola-events', EbolaEventViewSet, basename='ebola-event')
router.register(r'adaptor-health', SourceAuditViewSet, basename='adaptor-health')

urlpatterns = [
    path('', include(router.urls)),
]
