"""
AFRO Sentinel Watchtower - URL Configuration
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import SignalViewSet, DiseaseKeywordViewSet, SourceCredibilityViewSet, BorderSignalsView
from .views_agent import (
    AgentRunListView,
    AgentRunDetailView,
    AgentActivityView,
    AgentStatsView,
)
from .views_telegram import telegram_webhook
from .sse_views import Tier0SignalStreamView

router = DefaultRouter()
router.register(r'signals', SignalViewSet, basename='signal')
router.register(r'diseases', DiseaseKeywordViewSet, basename='disease')
router.register(r'sources', SourceCredibilityViewSet, basename='source')

urlpatterns = [
    path('', include(router.urls)),
    path('agent/runs/', AgentRunListView.as_view(), name='agent-run-list'),
    path('agent/runs/<uuid:run_id>/', AgentRunDetailView.as_view(), name='agent-run-detail'),
    path('agent/activity/', AgentActivityView.as_view(), name='agent-activity'),
    path('agent/stats/', AgentStatsView.as_view(), name='agent-stats'),
    path('telegram-webhook/<str:secret>/', telegram_webhook, name='telegram-webhook'),
    # PoE Predictive Intelligence — cross-border signal aggregation
    path('border-signals/', BorderSignalsView.as_view(), name='border-signals'),
    # Real-time SSE stream for Tier 0 (CHW Ground Truth) signals
    path('signals/stream/tier0/', Tier0SignalStreamView.as_view(), name='signals-stream-tier0'),
]

