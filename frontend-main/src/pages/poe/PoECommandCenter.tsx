import { useEffect, useState, useCallback } from "react";
import { poe, IHR_POE_LAYERS } from "./services/poe";
import type { CorridorIntelligence, RiskDistributionCategory, FlowVolumeData, SpilloverRisk, SpilloverOutbreak, BorderSignalSummary } from "./services/poe";
import { readiness } from "@/pages/readiness/services/readiness";
import type { RegionScore } from "@/pages/readiness/types/readiness";
import { logger } from "@/utils/logger";

// Custom UI Components
import { SurveillanceBanner } from "./components/SurveillanceBanner";
import { IntelligenceCards } from "./components/IntelligenceCards";
import { MapModeSelector } from "./components/MapModeSelector";
import type { MapMode } from "./components/MapModeSelector";
import { MapLegend } from "./components/MapLegend";
import { PoEMap } from "./components/PoEMap";
import { FeatureDetailPanel } from "./components/FeatureDetailPanel";
import { CorridorIntelTable } from "./components/CorridorIntelTable";
import { AnalyticsCharts } from "./components/AnalyticsCharts";
import { ReadinessMatrix } from "./components/ReadinessMatrix";

// Predictive Intelligence Components
import { SpilloverRiskPanel } from "./components/SpilloverRiskPanel";
import { SignalRadar } from "./components/SignalRadar";
import { ScenarioPanel } from "./components/ScenarioPanel";

// Existing global widgets
import LiveFeedWatchlist from "@/components/usables/LiveFeedWatchlist";
import NewsTicker from "@/components/usables/NewsTicker";
import "./PoECommandCenter.css";

export function PoECommandCenter() {
    const [loading, setLoading] = useState(true);
    
    // Stats for cards
    const [ihrStats, setIhrStats] = useState<Record<string, number> | null>(null);

    // Active layers for map
    const [activeLayers, setActiveLayers] = useState<string[]>(
        IHR_POE_LAYERS.filter(l => l.visible).map(l => l.title)
    );

    // Operational mode
    const [activeMode, setActiveMode] = useState<MapMode>("all");

    // Clicked feature details
    const [selectedFeature, setSelectedFeature] = useState<any | null>(null);
    const [selectedLayerKey, setSelectedLayerKey] = useState<string | null>(null);

    // Computed datasets
    const [corridors, setCorridors] = useState<CorridorIntelligence[]>([]);
    const [riskDistribution, setRiskDistribution] = useState<RiskDistributionCategory[]>([]);
    const [flowVolumes, setFlowVolumes] = useState<FlowVolumeData[]>([]);
    const [readinessScores, setReadinessScores] = useState<RegionScore[]>([]);

    // Banner counts
    const [donAlertsCount, setDonAlertsCount] = useState(0);
    const [criticalCorridors, setCriticalCorridors] = useState({ critical: 0, high: 0, medium: 0, low: 0 });

    // ── Predictive Intelligence State ──────────────────────────
    const [spilloverData, setSpilloverData] = useState<SpilloverRisk | null>(null);
    const [spilloverLoading, setSpilloverLoading] = useState(true);
    const [spilloverError, setSpilloverError] = useState(false);
    const [borderSignals, setBorderSignals] = useState<BorderSignalSummary | null>(null);
    const [borderSignalsLoading, setBorderSignalsLoading] = useState(true);
    const [scenarioPanelOpen, setScenarioPanelOpen] = useState(false);
    const [selectedOutbreakForScenario, setSelectedOutbreakForScenario] = useState<SpilloverOutbreak | null>(null);

    // Load datasets progressively to prevent long initial blank screens
    useEffect(() => {
        const loadInitialData = async () => {
            try {
                setLoading(true);

                 // ── Phase 1: Load Layer Statistics (Airports, Seaports, Official BCPs) ──
                const countPromises = IHR_POE_LAYERS
                    .filter(layer => layer.url)
                    .map(layer =>
                        poe.queryIHRLayer(
                            layer.url,
                            {
                                where: "1=1",
                                outFields: "OBJECTID",
                                returnGeometry: false,
                                resultRecordCount: 5000,
                            },
                            layer.key
                        ).then(features => features ? features.length : 0)
                         .catch((err: any) => {
                             logger.warn(`[POE] Stats query FAILED for ${layer.key} — URL may be expired:`, err?.message || err);
                             return 0;
                         })
                    );

                const counts = await Promise.all(countPromises);
                const stats: Record<string, number> = {};
                IHR_POE_LAYERS.filter(layer => layer.url).forEach((layer, idx) => {
                    stats[layer.key] = counts[idx];
                });
                setIhrStats(stats);

                // ── Phase 2: Load Basic Computed Metric Highlights for Banner ──
                const [alertsCount, criticalCounts] = await Promise.all([
                    poe.queryDONAlertsCount().catch(() => 0),
                    poe.queryCriticalCorridors().catch(() => ({ critical: 0, high: 0, medium: 0, low: 0 })),
                ]);
                setDonAlertsCount(alertsCount);
                setCriticalCorridors(criticalCounts);

                // ── Phase 3: Load Secondary Deeper Datasets (Corridors, Risks, Charts) ──
                const [corridorData, riskData, flowData, readinessData] = await Promise.all([
                    poe.queryCorridorIntelligence().catch(() => []),
                    poe.queryRiskDistribution().catch(() => []),
                    poe.queryFlowVolumes().catch(() => []),
                    readiness.heatmap("FVD PoE").catch(() => {
                        logger.warn("[POE] Trying alternate readiness key...");
                        return readiness.heatmap("fvdpoe");
                    }).catch(() => []),
                ]);

                setCorridors(corridorData);
                setRiskDistribution(riskData);
                setFlowVolumes(flowData);
                setReadinessScores(readinessData);

                // ── Phase 4: Load Predictive Intelligence data (non-blocking) ──
                setSpilloverLoading(true);
                setBorderSignalsLoading(true);
                setSpilloverError(false);

                Promise.allSettled([
                    poe.getSpilloverRisk()
                        .then(d => { setSpilloverData(d); setSpilloverLoading(false); })
                        .catch(e => { logger.error("[POE] Spillover risk fetch failed:", e); setSpilloverError(true); setSpilloverLoading(false); }),
                    poe.getBorderSignals(30)
                        .then(d => {
                            setBorderSignals(d);
                            setBorderSignalsLoading(false);
                            const chwCount = d.by_country.reduce((acc, c) => 
                                acc + (c.nearest_poe_signals || []).filter(s => s.source_tier === 0).length, 0
                            );
                            setIhrStats(prev => prev ? { ...prev, chw_signals: chwCount } : { chw_signals: chwCount });
                        })
                        .catch(e => { logger.error("[POE] Border signals fetch failed:", e); setBorderSignalsLoading(false); }),
                ]);

            } catch (err) {
                logger.error("[POE] Error loading Command Center metrics:", err);
            } finally {
                setLoading(false);
            }
        };

        loadInitialData();
    }, []);

    // Handle map mode switches by toggling standard groups
    const handleModeChange = useCallback((mode: MapMode) => {
        setActiveMode(mode);
        if (mode === "all") {
            setActiveLayers(IHR_POE_LAYERS.map(l => l.title));
        } else {
            const modeKeys: Record<Exclude<MapMode, "all">, string[]> = {
                threat: ["outbreak_news", "corridor_hotspots", "informal_crossings"],
                flow: ["anim_movement_flows", "border_lines", "buffer_zones", "unhcr"],
                capacity: ["airports", "seaports", "inland_ports", "border_crossings", "unhcr_presence"],
                corridors: ["informal_crossings", "corridor_hotspots", "border_lines", "buffer_zones", "anim_movement_flows"],
            };

            const visibleTitles = IHR_POE_LAYERS
                .filter(l => modeKeys[mode].includes(l.key))
                .map(l => l.title);

            setActiveLayers(visibleTitles);
        }
        logger.info(`[POE] Switched map display to "${mode}" mode`);
    }, []);

    // Toggle individual layers via checklist controls
    const handleLayerToggle = useCallback((layerTitle: string) => {
        setActiveLayers((prev) =>
            prev.includes(layerTitle)
                ? prev.filter((l) => l !== layerTitle)
                : [...prev, layerTitle]
        );
        setActiveMode("all"); // Custom layers select drops mode filters
    }, []);

    // Map feature select click
    const handleFeatureSelect = useCallback((attributes: any, layerKey?: string) => {
        if (!attributes) return;
        setSelectedFeature(attributes);
        setSelectedLayerKey(layerKey || null);
        logger.info(`[POE] Selected map feature: ${attributes.name || attributes.Name || "Crossing"}`);
    }, []);

    // Table click → zooms/filters map to corridor destination country
    const handleCorridorClick = useCallback((c: CorridorIntelligence) => {
        const parts = c.corridor.split("->");
        const dest = parts[1] || parts[0];
        setSelectedFeature({
            corridor: c.corridor,
            flow_count: c.flow_count,
            flow_weight: c.flow_weight,
            flow_type: c.flow_type,
            ihr_screening_priority: c.ihr_screening_priority,
        });
        setSelectedLayerKey("anim_movement_flows");
        logger.info(`[POE] Focused on corridor pathway: ${c.corridor}`);
    }, []);

    // Country matrix click → filters or details country
    const handleCountryClick = useCallback((countryName: string) => {
        logger.info(`[POE] Filtering map and detail records to country: ${countryName}`);
    }, []);

    // Layer indicators
    const getLayerIcon = (key: string) => {
        const icons: Record<string, string> = {
            outbreak_news: "mdi:alert-circle-outline",
            airports: "mdi:airplane",
            seaports: "mdi:anchor",
            inland_ports: "mdi:ferry",
            unhcr: "mdi:account-group",
            unhcr_presence: "mdi:hospital-building",
            border_crossings: "mdi:shield-check-outline",
            border_lines: "mdi:border-outside",
            informal_crossings: "mdi:walk",
            corridor_hotspots: "mdi:fire",
            buffer_zones: "mdi:circle-slice-8",
            corridor_risk: "mdi:map-marker-path",
            anim_movement_flows: "mdi:swap-horizontal",
        };
        return icons[key] || "mdi:layers-outline";
    };

    const getLayerColor = (key: string) => {
        const colors: Record<string, string> = {
            outbreak_news: "var(--poe-red)",
            airports: "hsl(340, 80%, 65%)",
            seaports: "var(--poe-blue)",
            inland_ports: "hsl(270, 70%, 65%)",
            unhcr: "var(--poe-amber)",
            unhcr_presence: "var(--poe-teal)",
            border_crossings: "hsl(210, 80%, 55%)",
            border_lines: "var(--poe-text-muted)",
            informal_crossings: "var(--poe-amber)",
            corridor_hotspots: "var(--poe-red)",
            buffer_zones: "var(--poe-blue)",
            corridor_risk: "var(--poe-red)",
            anim_movement_flows: "var(--poe-teal)",
        };
        return colors[key] || "var(--poe-text-muted)";
    };

    return (
        <div className="poe-command-center">
            {/* TOP SECTION: shares space with LiveFeed sidebar */}
            <section className="flex flex-row gap-3 justify-stretch mt-4">
                <section className="grow min-w-0">
                    <div className="poe-layout-grid">
                        
                        {/* Section 1: Surveillance Banner */}
                        <SurveillanceBanner
                            totalAirports={Math.max(0, ihrStats?.airports ?? 0)}
                            totalSeaports={Math.max(0, ihrStats?.seaports ?? 0)}
                            totalInlandPorts={Math.max(0, ihrStats?.inland_ports ?? 0)}
                            totalOfficialCrossings={Math.max(0, ihrStats?.border_crossings ?? 0)}
                            totalInformalCrossings={Math.max(0, ihrStats?.informal_crossings ?? 0)}
                            donAlerts={donAlertsCount}
                            criticalCorridors={criticalCorridors.critical}
                            highCorridors={criticalCorridors.high}
                            mediumCorridors={criticalCorridors.medium}
                            isLoading={loading}
                        />

                        {/* Section 2: KPI Grid */}
                        <IntelligenceCards
                            ihrStats={ihrStats}
                            isLoading={loading}
                            onCardClick={(key) => {
                                const layer = IHR_POE_LAYERS.find(l => l.key === key);
                                if (layer) handleLayerToggle(layer.title);
                            }}
                        />

                        {/* Section 3: Interactive Map */}
                        <div className="poe-map-container">
                            <PoEMap
                                visibleLayerTitles={activeLayers}
                                onPointClick={handleFeatureSelect}
                                borderSignals={borderSignals}
                            />

                            {/* Floating Map Mode Selector */}
                            <MapModeSelector
                                currentMode={activeMode}
                                onModeChange={handleModeChange}
                            />

                            {/* Floating Legend (also acts as per-layer toggle) */}
                            <MapLegend
                                visibleLayerTitles={activeLayers}
                                onLayerToggle={handleLayerToggle}
                            />
                        </div>
                    </div>
                </section>

                {/* Right side live feeds */}
                <aside className="w-[300px] flex-shrink-0 hidden xl:block">
                    <LiveFeedWatchlist />
                </aside>
            </section>

            {/* FULL-WIDTH SECTIONS: no sidebar constraint */}
            <div className="poe-layout-grid" style={{ marginTop: "24px" }}>

                {/* ═══ PREDICTIVE INTELLIGENCE LAYER ═══ */}

                {/* Section 4A: Cross-Border Importation Risk */}
                <SpilloverRiskPanel
                    data={spilloverData}
                    isLoading={spilloverLoading}
                    hasError={spilloverError}
                    onWhatIf={(outbreak) => {
                        setSelectedOutbreakForScenario(outbreak);
                        setScenarioPanelOpen(true);
                    }}
                />

                {/* Section 4B: Border Signal Intelligence */}
                <SignalRadar
                    data={borderSignals}
                    isLoading={borderSignalsLoading}
                />

                {/* Section 5: Corridor Intelligence Table */}
                <CorridorIntelTable
                    corridors={corridors}
                    isLoading={loading}
                    onRowClick={handleCorridorClick}
                />

                {/* Section 6: Analytics Recharts */}
                <AnalyticsCharts
                    flowVolumes={flowVolumes}
                    riskDistribution={riskDistribution}
                    isLoading={loading}
                />

                {/* Section 7: Country Readiness Matrix */}
                <ReadinessMatrix
                    scores={readinessScores}
                    isLoading={loading}
                    onCountryClick={handleCountryClick}
                />
            </div>

            {/* Bottom News ticker (spans edge-to-edge) */}
            <section className="poe-news-ticker-wrapper">
                <NewsTicker />
            </section>

            {/* Right Slide-out Detail drawer */}
            <FeatureDetailPanel
                feature={selectedFeature}
                layerKey={selectedLayerKey}
                onClose={() => {
                    setSelectedFeature(null);
                    setSelectedLayerKey(null);
                }}
            />

            {/* What-If Scenario Panel */}
            <ScenarioPanel
                outbreak={selectedOutbreakForScenario}
                isOpen={scenarioPanelOpen}
                onClose={() => {
                    setScenarioPanelOpen(false);
                    setSelectedOutbreakForScenario(null);
                }}
            />
        </div>
    );
}
