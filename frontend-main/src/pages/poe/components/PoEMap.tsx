import { useEffect, useRef, useState } from "react";
import Map from "@arcgis/core/Map";
import MapView from "@arcgis/core/views/MapView";
import FeatureLayer from "@arcgis/core/layers/FeatureLayer";
import GraphicsLayer from "@arcgis/core/layers/GraphicsLayer";
import Graphic from "@arcgis/core/Graphic";
import Point from "@arcgis/core/geometry/Point";
import esriConfig from "@arcgis/core/config";
import SimpleRenderer from "@arcgis/core/renderers/SimpleRenderer";
import SimpleMarkerSymbol from "@arcgis/core/symbols/SimpleMarkerSymbol";
import SimpleLineSymbol from "@arcgis/core/symbols/SimpleLineSymbol";
import SimpleFillSymbol from "@arcgis/core/symbols/SimpleFillSymbol";
import CIMSymbol from "@arcgis/core/symbols/CIMSymbol";
import HeatmapRenderer from "@arcgis/core/renderers/HeatmapRenderer";
import { Loader2, AlertCircle } from "lucide-react";
import "@arcgis/core/assets/esri/themes/light/main.css";
import { logger } from "@/utils/logger";
import { IHR_POE_LAYERS, AFRO_FILTERS } from "../services/poe";
import type { IHRLayerConfig } from "../services/poe";

/**
 * Per-layer renderers — each layer gets a distinct color + shape so they
 * are visually distinguishable on the map.
 *
 * Point layers use SimpleMarkerSymbol with distinct shapes.
 * Line layers use SimpleLineSymbol with distinct colors + dash patterns.
 * Polygon layers use SimpleFillSymbol with semi-transparent fills.
 * corridor_risk uses a HeatmapRenderer so high-risk informal crossings
 * read as a heat surface rather than a noisy field of dots.
 */
/**
 * Build a CIM line symbol for movement flows with a marching-dash effect.
 * `offset` is in points along the line — incrementing it makes dashes
 * appear to crawl along each corridor, conveying directional flow.
 * Dash period below is 10 + 12 = 22 pts, so offset wraps at 22.
 */
const FLOW_DASH_PERIOD = 22;
function buildFlowSymbol(offset: number): CIMSymbol {
    return new CIMSymbol({
        data: {
            type: "CIMSymbolReference",
            symbol: {
                type: "CIMLineSymbol",
                symbolLayers: [
                    // Bright marching dashes on top
                    {
                        type: "CIMSolidStroke",
                        enable: true,
                        capStyle: "Round",
                        joinStyle: "Round",
                        width: 4,
                        color: [0, 240, 240, 240],
                        effects: [
                            {
                                type: "CIMGeometricEffectDashes",
                                dashTemplate: [10, 12],
                                lineDashEnding: "NoConstraint",
                                offsetAlongLine: offset,
                            },
                        ],
                    } as any,
                    // Translucent base so corridor stays visible between dashes
                    {
                        type: "CIMSolidStroke",
                        enable: true,
                        capStyle: "Round",
                        joinStyle: "Round",
                        width: 1.5,
                        color: [0, 220, 220, 80],
                    } as any,
                ],
            },
        },
    });
}

function buildRenderer(cfg: IHRLayerConfig): SimpleRenderer | HeatmapRenderer {
    // --- Animated movement-flow line ---
    if (cfg.key === "anim_movement_flows") {
        return new SimpleRenderer({ symbol: buildFlowSymbol(0) });
    }

    // --- Heatmap layer (corridor risk) ---
    if (cfg.key === "corridor_risk") {
        return new HeatmapRenderer({
            field: "risk_score",
            radius: 18,
            maxDensity: 0.04,
            minDensity: 0,
            colorStops: [
                { ratio: 0,    color: "rgba(0, 0, 0, 0)" },
                { ratio: 0.2,  color: "rgba(255, 235, 59, 0.45)" },
                { ratio: 0.5,  color: "rgba(255, 152, 0, 0.7)" },
                { ratio: 0.8,  color: "rgba(244, 67, 54, 0.85)" },
                { ratio: 1,    color: "rgba(183, 28, 28, 0.95)" },
            ],
        });
    }

    // --- Polygon layers ---
    if (cfg.geometryType === "polygon") {
        const fills: Record<string, SimpleFillSymbol> = {
            buffer_zones: new SimpleFillSymbol({
                color: [70, 130, 180, 0.15],      // Steel blue, very transparent
                outline: {
                    color: [70, 130, 180, 0.6],
                    width: 1,
                },
            }),
        };
        return new SimpleRenderer({
            symbol: fills[cfg.key] || new SimpleFillSymbol({
                color: [128, 128, 128, 0.15],
                outline: { color: [128, 128, 128, 0.5], width: 1 },
            }),
        });
    }

    // --- Line layers ---
    if (cfg.geometryType === "line") {
        const lines: Record<string, SimpleLineSymbol> = {
            border_lines: new SimpleLineSymbol({
                color: [253, 127, 111, 0.6],       // Salmon/coral for borders
                width: 1.5,
                style: "solid",
            }),
            // anim_movement_flows handled above via CIM symbol (marching dashes)
        };
        return new SimpleRenderer({
            symbol: lines[cfg.key] || new SimpleLineSymbol({
                color: [100, 100, 200, 0.7],
                width: 1.5,
                style: "solid",
            }),
        });
    }

    // --- Point layers ---
    const markers: Record<string, SimpleMarkerSymbol> = {
        outbreak_news: new SimpleMarkerSymbol({
            style: "diamond",
            color: [239, 68, 68, 0.85],   // red-500
            size: 14,
            outline: { color: [255, 255, 255, 0.8], width: 1 },
        }),
        airports: new SimpleMarkerSymbol({
            style: "triangle",
            color: [236, 72, 153, 0.85],  // pink-500
            size: 11,
            outline: { color: [255, 255, 255, 0.8], width: 1 },
        }),
        seaports: new SimpleMarkerSymbol({
            style: "square",
            color: [6, 182, 212, 0.85],   // cyan-500
            size: 10,
            outline: { color: [255, 255, 255, 0.8], width: 1 },
        }),
        inland_ports: new SimpleMarkerSymbol({
            style: "diamond",
            color: [168, 85, 247, 0.85],  // purple-500
            size: 9,
            outline: { color: [255, 255, 255, 0.8], width: 1 },
        }),
        unhcr: new SimpleMarkerSymbol({
            style: "circle",
            color: [245, 158, 11, 0.85],  // amber-500
            size: 9,
            outline: { color: [255, 255, 255, 0.8], width: 1 },
        }),
        unhcr_presence: new SimpleMarkerSymbol({
            style: "circle",
            color: [20, 184, 166, 0.75],  // teal-500
            size: 7,
            outline: { color: [255, 255, 255, 0.7], width: 1 },
        }),
        border_crossings: new SimpleMarkerSymbol({
            style: "x",
            color: [59, 130, 246, 0.9],   // blue-500
            size: 9,
            outline: { color: [59, 130, 246, 1], width: 2 },
        }),
        informal_crossings: new SimpleMarkerSymbol({
            style: "circle",
            color: [249, 115, 22, 0.8],   // orange-500
            size: 6,
            outline: { color: [255, 255, 255, 0.7], width: 0.8 },
        }),
        corridor_hotspots: new SimpleMarkerSymbol({
            style: "diamond",
            color: [225, 29, 72, 0.85],   // rose-600
            size: 8,
            outline: { color: [255, 255, 255, 0.8], width: 1 },
        }),
        corridor_risk: new SimpleMarkerSymbol({
            style: "square",
            color: [220, 38, 38, 0.8],    // red-600
            size: 7,
            outline: { color: [255, 255, 255, 0.7], width: 0.8 },
        }),
    };

    return new SimpleRenderer({
        symbol: markers[cfg.key] || new SimpleMarkerSymbol({
            style: "circle",
            color: [128, 128, 128, 0.7],
            size: 7,
            outline: { color: [255, 255, 255, 0.6], width: 1 },
        }),
    });
}

interface PoEMapProps {
    onPointClick?: (attributes: any, layerKey?: string) => void;
    visibleLayerTitles?: string[];
    borderSignals?: import("../services/poe").BorderSignalSummary | null;
}

export function PoEMap({ onPointClick, visibleLayerTitles, borderSignals }: PoEMapProps) {
    const mapDiv = useRef<HTMLDivElement>(null);
    const viewRef = useRef<MapView | null>(null);
    const layersRef = useRef<any[]>([]);
    const clickHandlerRef = useRef(onPointClick);
    const pulseRafRef = useRef<number | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!mapDiv.current) return;

        let active = true;

        const initializeMap = async () => {
            try {
                if (import.meta.env.VITE_ARCGIS_API_KEY) {
                    esriConfig.apiKey = import.meta.env.VITE_ARCGIS_API_KEY;
                }

                /**
                 * Build layers in draw order: polygons first, then lines, then points.
                 * This ensures points are always on top and clickable.
                 */
                const sortedLayers = [...IHR_POE_LAYERS].sort((a, b) => {
                    const order: Record<string, number> = { polygon: 0, line: 1, point: 2 };
                    return (order[a.geometryType] ?? 1) - (order[b.geometryType] ?? 1);
                });

                const ihrFeatureLayers = sortedLayers
                    .filter((cfg) => cfg.url)
                    .map((cfg) => {
                        const layerOptions: any = {
                            url: cfg.url,
                            title: cfg.title,
                            visible: cfg.visible,
                            outFields: ["*"],
                            popupEnabled: false,
                            opacity: cfg.geometryType === "polygon" ? 0.4
                                   : cfg.geometryType === "line" ? 0.7
                                   : 0.85,
                            definitionExpression: AFRO_FILTERS[cfg.key] || "1=1",
                            renderer: buildRenderer(cfg),
                        };

                        // Add label rendering for outbreak_news (country names)
                        if (cfg.key === "outbreak_news") {
                            layerOptions.labelingInfo = [{
                                symbol: {
                                    type: "text",
                                    color: [255, 255, 255, 0.95],
                                    font: {
                                        size: 9,
                                        weight: "bold",
                                        family: "sans-serif"
                                    },
                                    haloColor: [0, 0, 0, 0.85],
                                    haloSize: 1.5
                                },
                                labelPlacement: "above-center",
                                labelExpressionInfo: {
                                    expression: "DefaultValue($feature.country_iso3, '')"
                                }
                            }];
                        }

                        return new FeatureLayer(layerOptions);
                    });

                const chwSignalsLayer = new GraphicsLayer({
                    title: "🏥 Field Intelligence (CHW)",
                    visible: visibleLayerTitles?.includes("🏥 Field Intelligence (CHW)") ?? true,
                });

                const allLayers = [...ihrFeatureLayers, chwSignalsLayer];

                const basemapId = esriConfig.apiKey ? "topo-vector" : "topo";
                const map = new Map({
                    basemap: basemapId,
                    layers: allLayers,
                });

                // Center on Africa (AFRO region)
                const view = new MapView({
                    container: mapDiv.current!,
                    map,
                    center: [20, 2],    // Centered on Africa
                    zoom: 4,            // Zoom level showing the full continent
                    popup: { autoOpenEnabled: false } as any,
                    constraints: {
                        minZoom: 2,
                        maxZoom: 15,
                        rotationEnabled: false,
                    },
                    ui: {
                        components: ["zoom"],
                    },
                });

                view.ui.move("zoom", "top-right");

                await view.when();

                if (!active) {
                    view.destroy();
                    return;
                }

                viewRef.current = view;
                layersRef.current = allLayers;

                // Log discovered layers for debugging
                allLayers.forEach((layer) => {
                    logger.log(
                        `[PoEMap] Layer: "${layer.title}" (visible=${layer.visible}, filter=${(layer as any).definitionExpression || 'none'})`
                    );
                });

                /**
                 * Marching-dash animation on the cross-border movement flow layer.
                 * AJIRI-style maps render corridors as static lines; here we step
                 * the CIM dash offset every frame so each corridor reads as
                 * actively flowing in its direction of travel.
                 */
                const flowLayer = allLayers.find(
                    (l) => l.title === "IHR_Anim_Movement_Flows"
                );
                if (flowLayer) {
                    const start = performance.now();
                    let lastFrame = 0;
                    const FRAME_MS = 33;          // ~30 fps cap
                    const SPEED_PTS_PER_SEC = 30; // dash crawl speed
                    const tick = (now: number) => {
                        if (now - lastFrame >= FRAME_MS) {
                            const t = (now - start) / 1000;
                            // Negative offset → dashes appear to move forward along line
                            const offset = -((t * SPEED_PTS_PER_SEC) % FLOW_DASH_PERIOD);
                            (flowLayer as FeatureLayer).renderer = new SimpleRenderer({
                                symbol: buildFlowSymbol(offset),
                            });
                            lastFrame = now;
                        }
                        pulseRafRef.current = requestAnimationFrame(tick);
                    };
                    pulseRafRef.current = requestAnimationFrame(tick);
                }

                // Click handler
                if (clickHandlerRef.current) {
                    view.on("click", (event) => {
                        view.hitTest(event).then((response) => {
                            if (response.results.length > 0) {
                                const result = response.results.find(
                                    (r) => (r as any).graphic
                                );
                                if (result && (result as any).graphic) {
                                    const graphic = (result as any).graphic;
                                    const layerTitle = graphic.layer?.title;
                                    const layerConfig = IHR_POE_LAYERS.find(l => l.title === layerTitle);
                                    const layerKey = layerConfig ? layerConfig.key : undefined;
                                    clickHandlerRef.current?.(graphic.attributes, layerKey);
                                }
                            }
                        });
                    });
                }

                setLoading(false);
            } catch (err: any) {
                logger.error("ArcGIS Initialization Error:", err);
                if (active) {
                    setError(err.message || "Failed to initialize map");
                    setLoading(false);
                }
            }
        };

        initializeMap();

        return () => {
            active = false;
            if (pulseRafRef.current !== null) {
                cancelAnimationFrame(pulseRafRef.current);
                pulseRafRef.current = null;
            }
            if (viewRef.current) {
                viewRef.current.destroy();
                viewRef.current = null;
            }
        };
    }, []);

    useEffect(() => {
        clickHandlerRef.current = onPointClick;
    }, [onPointClick]);

    // Sync layer visibility with parent state
    useEffect(() => {
        if (!layersRef.current.length || !visibleLayerTitles) return;

        layersRef.current.forEach((layer) => {
            const isVisible = visibleLayerTitles.some(
                (title) => layer.title === title
            );
            layer.visible = isVisible;
        });
    }, [visibleLayerTitles]);

    // Sync CHW signals graphics layer when borderSignals change
    useEffect(() => {
        const view = viewRef.current;
        const gl = layersRef.current.find(l => l.title === "🏥 Field Intelligence (CHW)") as GraphicsLayer | undefined;
        if (!view || !gl) return;

        gl.removeAll();

        if (borderSignals?.by_country) {
            borderSignals.by_country.forEach((c) => {
                const signals = c.nearest_poe_signals || [];
                signals.forEach((s) => {
                    if (s.source_tier === 0 && s.lat != null && s.lng != null && !isNaN(s.lat) && !isNaN(s.lng)) {
                        const point = new Point({ latitude: s.lat, longitude: s.lng });
                        
                        const symbol = new SimpleMarkerSymbol({
                            style: "diamond",
                            color: [16, 185, 129, 0.95], // Glowing emerald green
                            size: 13,
                            outline: { color: [255, 255, 255, 0.95], width: 1.5 },
                        });

                        const graphic = new Graphic({
                            geometry: point,
                            symbol,
                            attributes: {
                                ...s,
                                Name: `CHW Ground Truth: ${s.disease}`,
                                name: `CHW Ground Truth: ${s.disease}`,
                                ADM0_NAME: c.country,
                            },
                            popupTemplate: {
                                title: `🏥 CHW Field Intelligence (Tier 0)`,
                                content: `
                                  <div style="font-family: sans-serif; font-size: 12px; line-height: 1.4; color: #fff; background: #0f172a; padding: 10px; border-radius: 6px;">
                                    <p style="margin: 0 0 6px 0; font-size: 14px; font-weight: bold; color: #10b981;">🏥 Field Intelligence (CHW)</p>
                                    <p style="margin: 0 0 4px 0;"><strong>Disease:</strong> \${s.disease}</p>
                                    <p style="margin: 0 0 4px 0;"><strong>Headline:</strong> \${s.headline}</p>
                                    <p style="margin: 0 0 4px 0;"><strong>Country:</strong> \${c.country}</p>
                                    <p style="margin: 0; font-size: 10px; color: #94a3b8;">Reported: \${s.days_ago} days ago | ID: evt:\${s.id}</p>
                                  </div>
                                `
                            }
                        });

                        gl.add(graphic);
                    }
                });
            });
        }
    }, [borderSignals, loading]);

    return (
        <div className="relative w-full h-full min-h-[500px] rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-900/50 border border-gray-200 dark:border-white/10 shadow-lg">
            {loading && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-white/80 dark:bg-black/60 backdrop-blur-sm">
                    <Loader2 className="w-10 h-10 text-blue-500 animate-spin mb-4" />
                    <p className="text-sm font-medium animate-pulse">
                        Initializing AFRO Points of Entry Map...
                    </p>
                </div>
            )}

            {error && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-white dark:bg-slate-950 p-6 text-center">
                    <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
                    <h3 className="text-lg font-bold mb-2">
                        Map Initialization Failed
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 max-w-md mb-6">
                        {error}
                    </p>
                    <button
                        onClick={() => window.location.reload()}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-semibold"
                    >
                        Retry Loading
                    </button>
                </div>
            )}

            <div
                ref={mapDiv}
                className="w-full h-full"
                style={{ background: "transparent" }}
            />
        </div>
    );
}
