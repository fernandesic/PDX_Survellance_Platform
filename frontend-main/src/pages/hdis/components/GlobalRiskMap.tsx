import { useEffect, useRef, useMemo, useState, useCallback } from "react";
import Map from "@arcgis/core/Map";
import MapView from "@arcgis/core/views/MapView";
import GraphicsLayer from "@arcgis/core/layers/GraphicsLayer";
import Graphic from "@arcgis/core/Graphic";
import Point from "@arcgis/core/geometry/Point";
import SimpleMarkerSymbol from "@arcgis/core/symbols/SimpleMarkerSymbol";
import esriConfig from "@arcgis/core/config";
import { useDashboardContext } from "@/pages/hdis/context/DashboardContext";
import { RISK_COLORS } from "@/pages/hdis/constants";
import { format } from "date-fns";
import "@arcgis/core/assets/esri/themes/light/main.css";

esriConfig.portalUrl = "https://www.arcgis.com";

interface PopupData {
    headline: string;
    risk: string;
    country: string;
    event_type: string;
    disease: string | null;
    pillar: string;
    source: string;
    confidence: number;
    cases: number | null;
    deaths: number | null;
    cross_border: boolean;
    date: string;
}

export function GlobalRiskMap() {
    const mapDiv = useRef<HTMLDivElement>(null);
    const viewRef = useRef<MapView | null>(null);
    const graphicsLayerRef = useRef<GraphicsLayer | null>(null);
    const { records } = useDashboardContext();
    const [popup, setPopup] = useState<PopupData | null>(null);

    useEffect(() => {
        if (!mapDiv.current) return;
        if (import.meta.env.VITE_ARCGIS_API_KEY) {
            esriConfig.apiKey = import.meta.env.VITE_ARCGIS_API_KEY;
        }

        const basemapId = esriConfig.apiKey ? "topographic" : "topo";
        const map = new Map({ basemap: basemapId });

        const view = new MapView({
            container: mapDiv.current,
            map,
            center: [20, 5],
            zoom: 2.5,
            background: { color: [217, 237, 255, 1] as any },
            constraints: { minZoom: 2, maxZoom: 8, rotationEnabled: false },
            ui: { components: [] },
            popup: { autoCloseEnabled: false },
        });

        const graphicsLayer = new GraphicsLayer();
        map.add(graphicsLayer);
        viewRef.current = view;
        graphicsLayerRef.current = graphicsLayer;

        // Click handler — show custom popup
        view.on("click", (event) => {
            view.hitTest(event).then((response) => {
                const hit = response.results.find(
                    (r) => r.type === "graphic" && r.graphic.attributes?.headline
                );
                if (hit && hit.type === "graphic") {
                    const a = hit.graphic.attributes;
                    setPopup({
                        headline: a.headline,
                        risk: a.risk,
                        country: a.country,
                        event_type: a.event_type,
                        disease: a.disease,
                        pillar: a.pillar,
                        source: a.source,
                        confidence: a.confidence,
                        cases: a.cases,
                        deaths: a.deaths,
                        cross_border: a.cross_border,
                        date: a.date,
                    });
                } else {
                    setPopup(null);
                }
            });
        });

        // Pointer cursor on hover
        view.on("pointer-move", (event) => {
            view.hitTest(event).then((response) => {
                const hasHit = response.results.some(
                    (r) => r.type === "graphic" && r.graphic.attributes?.headline
                );
                (mapDiv.current as any).style.cursor = hasHit ? "pointer" : "default";
            });
        });

        return () => {
            view.destroy();
            map.destroy();
            viewRef.current = null;
            graphicsLayerRef.current = null;
        };
    }, []);

    const dots = useMemo(() => {
        if (!records?.length) return [];
        return records
            .filter((r: any) => r.location_lat && r.location_lng)
            .map((r: any) => ({
                id: r.id,
                lat: r.location_lat,
                lng: r.location_lng,
                risk: r.risk_level,
                country: r.location_country,
                headline: r.headline,
                event_type: r.event_type || "Unknown",
                disease: r.disease_name || null,
                pillar: r.pillar_label || r.pillar || "",
                source: r.source_display?.name || r.ingestion_source || "Unknown",
                confidence: r.confidence_score || 0,
                cases: r.reported_cases,
                deaths: r.reported_deaths,
                cross_border: r.cross_border_risk || false,
                date: r.created_at || "",
            }));
    }, [records]);

    useEffect(() => {
        if (!graphicsLayerRef.current) return;
        graphicsLayerRef.current.removeAll();

        const hexToRgba = (hex: string, alpha: number): [number, number, number, number] => {
            const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
            return result
                ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16), alpha]
                : [200, 200, 200, alpha];
        };

        dots.forEach((d) => {
            const color = RISK_COLORS[d.risk] ?? RISK_COLORS.low;

            // Single uniform dot per signal (no glow layer)

            // Core dot (with full attributes for popup)
            graphicsLayerRef.current!.add(new Graphic({
                geometry: new Point({ longitude: d.lng, latitude: d.lat }),
                symbol: new SimpleMarkerSymbol({
                    color: hexToRgba(color, 0.85), size: "7px",
                    outline: { color: hexToRgba(color, 0.4), width: 1 },
                }),
                attributes: {
                    headline: d.headline,
                    risk: d.risk,
                    country: d.country,
                    event_type: d.event_type,
                    disease: d.disease,
                    pillar: d.pillar,
                    source: d.source,
                    confidence: d.confidence,
                    cases: d.cases,
                    deaths: d.deaths,
                    cross_border: d.cross_border,
                    date: d.date,
                },
            }));
        });
    }, [dots]);

    const closePopup = useCallback(() => setPopup(null), []);

    const formatDate = (dateStr: string) => {
        try { return format(new Date(dateStr), "dd MMM yyyy, HH:mm"); }
        catch { return dateStr; }
    };

    const riskColor = (risk: string) => RISK_COLORS[risk] ?? "#888";

    return (
        <div className="rounded-lg border border-border/30 bg-white overflow-hidden flex-1 relative min-h-0">
            <div className="absolute top-0 left-0 right-0 z-10 px-3 py-2 bg-white/40 backdrop-blur-sm">
                <h3 className="font-mono text-sm font-bold text-slate-800 tracking-widest uppercase">
                    Global Risk Map
                </h3>
            </div>

            <div ref={mapDiv} className="w-full h-full" style={{ minHeight: 260 }} />

            {/* Severity Legend */}
            <div className="absolute bottom-3 left-3 z-10 rounded-md bg-white/80 backdrop-blur-md border border-slate-200 px-2.5 py-1.5 shadow-sm">
                <p className="font-mono text-[11px] text-slate-400 mb-1 tracking-wider uppercase">Severity</p>
                {(["Critical", "High", "Medium", "Low"] as const).map((label) => {
                    const key = label.toLowerCase();
                    return (
                        <div key={key} className="flex items-center gap-1.5 py-px">
                            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: RISK_COLORS[key], opacity: 0.8 }} />
                            <span className="font-mono text-[11px] text-slate-600 font-medium">{label}</span>
                        </div>
                    );
                })}
            </div>

            {/* ── Custom Popup Panel ── */}
            {popup && (
                <div className="absolute top-10 right-3 z-20 w-72 max-h-[320px] rounded-xl bg-card/95 backdrop-blur-lg border border-border/50 shadow-2xl text-foreground animate-fade-in-up flex flex-col">
                    {/* Header */}
                    <div className="px-4 pt-3 pb-2 border-b border-border/10 shrink-0">
                        <div className="flex items-start justify-between gap-2">
                            <h4 className="text-sm font-semibold leading-tight flex-1 pr-2 line-clamp-3">{popup.headline}</h4>
                            <button onClick={closePopup} className="shrink-0 text-muted-foreground hover:text-foreground text-lg leading-none mt-[-2px]">&times;</button>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                            <span
                                className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border"
                                style={{
                                    color: riskColor(popup.risk),
                                    borderColor: `${riskColor(popup.risk)}40`,
                                    backgroundColor: `${riskColor(popup.risk)}15`,
                                }}
                            >
                                {popup.risk}
                            </span>
                            <span className="text-[13px] text-muted-foreground/80">{popup.country}</span>
                            {popup.cross_border && (
                                <span className="text-xs text-amber-500/90 font-mono font-medium">⚠ Cross-Border</span>
                            )}
                        </div>
                    </div>

                    {/* Body — Scrollable */}
                    <div className="px-4 py-3 space-y-2 text-sm overflow-y-auto flex-1">
                        {/* Row items */}
                        <Row label="Event Type" value={popup.event_type} />
                        {popup.disease && <Row label="Disease" value={popup.disease} />}
                        <Row label="Pillar" value={popup.pillar} />
                        <Row label="Source" value={popup.source} />
                        <Row label="Date" value={formatDate(popup.date)} />
                        <Row label="Confidence" value={`${popup.confidence}%`} />

                        {/* Cases/Deaths */}
                        {(popup.cases !== null || popup.deaths !== null) && (
                            <div className="flex gap-3 pt-1 border-t border-border/10">
                                {popup.cases !== null && (
                                    <div className="flex-1 bg-muted/30 rounded-md px-2 py-1.5 text-center">
                                        <p className="text-muted-foreground/80 text-xs uppercase tracking-wider">Cases</p>
                                        <p className="text-sm font-bold text-foreground/90 mt-0.5">{popup.cases?.toLocaleString() ?? "—"}</p>
                                    </div>
                                )}
                                {popup.deaths !== null && (
                                    <div className="flex-1 bg-muted/30 rounded-md px-2 py-1.5 text-center">
                                        <p className="text-muted-foreground/80 text-xs uppercase tracking-wider">Deaths</p>
                                        <p className="text-sm font-bold text-red-500/90 mt-0.5">{popup.deaths?.toLocaleString() ?? "—"}</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

/** Small reusable row for the popup */
function Row({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground/80 uppercase tracking-wider text-xs shrink-0">{label}</span>
            <span className="text-foreground/90 text-right truncate">{value || "—"}</span>
        </div>
    );
}
