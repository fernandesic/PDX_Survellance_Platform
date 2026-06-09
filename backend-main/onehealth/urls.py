from django.urls import path
from .views import (
    CountriesView,
    PathogensView,
    SpilloverRiskView,
    VectorEcologyView,
    HostEcologyView,
    KPIsView,
    CountryDetailView,
    AlertsView,
    EpiLinksView,
    DiseaseStatsView,
    SpilloverEarlyWarningView,
    SpilloverCacheStatusView,
    SpilloverTimelineView,
    ForecastHorizonView,
    LiveKPIsView,
    # TRIAD Dashboard Additions
    UnifiedSearchView,
    SearchReindexView,
    AlertExplainView,
    SeirExplainView,
    SeirStreamView,
    LiveStreamView,
    AgentsView,
    HITLPendingView,
    HITLApproveView,
    HITLDismissView,
    HITLAcknowledgeView,
    IngestionStatusView,
)
from .cross_border_views import (
    CorridorPresetsListView,
    CorridorPresetDetailView,
    CrossBorderImportationView,
    CrossBorderSensitivityView,
    PoERiskSummaryView,
)

urlpatterns = [
    path("countries", CountriesView.as_view(), name="oh-countries"),
    path("pathogens", PathogensView.as_view(), name="oh-pathogens"),
    path("spillover", SpilloverRiskView.as_view(), name="oh-spillover"),
    path("vectors", VectorEcologyView.as_view(), name="oh-vectors"),
    path("hosts", HostEcologyView.as_view(), name="oh-hosts"),
    path("kpis", KPIsView.as_view(), name="oh-kpis"),
    path("country/<str:iso3>", CountryDetailView.as_view(), name="oh-country-detail"),
    path("alerts", AlertsView.as_view(), name="oh-alerts"),
    path("epilinks", EpiLinksView.as_view(), name="oh-epilinks"),
    path("disease-stats", DiseaseStatsView.as_view(), name="oh-disease-stats"),
    # Priority 1 + 2 + 3: Spillover Engine + Forecast Horizon
    path("spillover/early-warning", SpilloverEarlyWarningView.as_view(), name="oh-early-warning"),
    path("spillover/cache-status", SpilloverCacheStatusView.as_view(), name="oh-cache-status"),
    path("spillover/timeline/<str:iso3>", SpilloverTimelineView.as_view(), name="oh-timeline"),
    path("forecast/horizon", ForecastHorizonView.as_view(), name="oh-forecast"),
    path("kpis/live", LiveKPIsView.as_view(), name="oh-kpis-live"),
    # TRIAD Dashboard Additions
    path("search", UnifiedSearchView.as_view(), name="oh-search"),
    path("search/reindex", SearchReindexView.as_view(), name="oh-search-reindex"),
    path("alerts/<str:alert_id>/explain", AlertExplainView.as_view(), name="oh-alert-explain"),
    path("simulation/seir/explain", SeirExplainView.as_view(), name="oh-seir-explain"),
    path("simulation/seir/stream", SeirStreamView.as_view(), name="oh-seir-stream"),
    path("stream/live", LiveStreamView.as_view(), name="oh-live-stream"),
    path("agents", AgentsView.as_view(), name="oh-agents"),
    # Human-in-the-Loop
    path("hitl/pending", HITLPendingView.as_view(), name="oh-hitl-pending"),
    path("hitl/<str:action_id>/approve", HITLApproveView.as_view(), name="oh-hitl-approve"),
    path("hitl/<str:action_id>/dismiss", HITLDismissView.as_view(), name="oh-hitl-dismiss"),
    path("hitl/<str:action_id>/acknowledge", HITLAcknowledgeView.as_view(), name="oh-hitl-acknowledge"),
    # Status Bar — real ingestion source freshness
    path("ingestion-status", IngestionStatusView.as_view(), name="oh-ingestion-status"),
    # Cross-border Importation sub-module (Isaias Fernandes Co)
    path("cross-border/corridor-presets", CorridorPresetsListView.as_view(), name="oh-corridor-presets"),
    path("cross-border/corridor-presets/<str:name>", CorridorPresetDetailView.as_view(), name="oh-corridor-preset-detail"),
    path("cross-border/importation", CrossBorderImportationView.as_view(), name="oh-xborder-importation"),
    path("cross-border/importation/sensitivity", CrossBorderSensitivityView.as_view(), name="oh-xborder-sensitivity"),
    # PoE Predictive Intelligence — auto-detecting importation risk summary
    path("poe-risk-summary", PoERiskSummaryView.as_view(), name="oh-poe-risk-summary"),
]

