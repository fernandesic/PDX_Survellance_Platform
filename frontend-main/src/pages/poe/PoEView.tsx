import { PoEMap } from "./components/PoEMap";
import LiveFeedWatchlist from "@/components/usables/LiveFeedWatchlist";
import NewsTicker from "@/components/usables/NewsTicker";
import { Globe, Map as MapIcon, Plane, Ship, AlertTriangle, Navigation, Shield, Anchor, MapPin, Route, Activity } from "lucide-react";
import { Updating } from "@/components/Updating";
import { PIPELINE_LABELS, getLayersByGroup } from "./services/poe";
import type { PipelineGroup, IHRLayerConfig } from "./services/poe";

interface PoeViewProps {
    isLight: boolean;
    loading: boolean;
    poeData: any;
    ihrStats: Record<string, number> | null;
    activeLayers: string[];
    toggleLayer: (layerTitle: string) => void;
    handlePointClick: (attributes: any) => void;
}

const formatNumber = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return n.toLocaleString();
};

/**
 * Small SVG shape indicators that match the ArcGIS map renderer symbols.
 * Colors use the exact same RGBA values as the SimpleMarkerSymbol renderers.
 */
const MapShape = ({ shape, fill }: { shape: string; fill: string }) => (
    <svg width="18" height="18" viewBox="0 0 18 18" style={{ flexShrink: 0 }}>
        {shape === "diamond" && (
            <polygon points="9,1 17,9 9,17 1,9" fill={fill} stroke="#fff" strokeWidth="1.2" />
        )}
        {shape === "triangle" && (
            <polygon points="9,1 17,16 1,16" fill={fill} stroke="#fff" strokeWidth="1.2" />
        )}
        {shape === "square" && (
            <rect x="2" y="2" width="14" height="14" rx="1.5" fill={fill} stroke="#fff" strokeWidth="1.2" />
        )}
        {shape === "circle" && (
            <circle cx="9" cy="9" r="7" fill={fill} stroke="#fff" strokeWidth="1.2" />
        )}
        {shape === "x" && (
            <>
                <line x1="3" y1="3" x2="15" y2="15" stroke={fill} strokeWidth="3" strokeLinecap="round" />
                <line x1="15" y1="3" x2="3" y2="15" stroke={fill} strokeWidth="3" strokeLinecap="round" />
            </>
        )}
        {shape === "line" && (
            <line x1="2" y1="9" x2="16" y2="9" stroke={fill} strokeWidth="3" strokeLinecap="round" />
        )}
        {shape === "polygon" && (
            <rect x="2" y="4" width="14" height="10" rx="2" fill={fill} fillOpacity="0.3" stroke={fill} strokeWidth="1.5" />
        )}
    </svg>
);

/** Layer visual config — maps layer keys to shapes and fill colors */
const LAYER_VISUALS: Record<string, { shape: string; fill: string }> = {
    // Pipeline 1
    outbreak_news:    { shape: "diamond",  fill: "rgba(239,68,68,0.85)" },
    airports:         { shape: "triangle", fill: "rgba(236,72,153,0.85)" },
    seaports:         { shape: "square",   fill: "rgba(6,182,212,0.85)" },
    inland_ports:     { shape: "diamond",  fill: "rgba(168,85,247,0.85)" },
    unhcr:            { shape: "circle",   fill: "rgba(245,158,11,0.85)" },
    unhcr_presence:   { shape: "circle",   fill: "rgba(20,184,166,0.75)" },
    border_crossings: { shape: "x",        fill: "rgba(59,130,246,0.9)" },
    // Pipeline 2
    border_lines:       { shape: "line",    fill: "rgba(253,127,111,0.7)" },
    informal_crossings: { shape: "circle",  fill: "rgba(249,115,22,0.8)" },
    corridor_hotspots:  { shape: "diamond", fill: "rgba(225,29,72,0.85)" },
    buffer_zones:       { shape: "polygon", fill: "rgba(70,130,180,0.6)" },
    corridor_risk:      { shape: "square",  fill: "rgba(220,38,38,0.8)" },
    // Pipeline 3
    anim_movement_flows: { shape: "line",  fill: "rgba(0,200,200,0.8)" },
};

function getLayerDef(l: IHRLayerConfig) {
    const s = LAYER_VISUALS[l.key] || { shape: "circle", fill: "#888" };
    return {
        key: l.key,
        title: l.title,
        label: l.label,
        icon: <MapShape shape={s.shape} fill={s.fill} />,
        color: l.color,
        dotColor: s.fill,
        description: l.description,
        group: l.group,
        geometryType: l.geometryType,
    };
}

const PIPELINE_ORDER: PipelineGroup[] = [
    "official_poe",
    "informal_corridors",
    "movement_flows",
    "animation",
];

export const PoeView = ({
    isLight,
    loading,
    poeData,
    ihrStats,
    activeLayers,
    toggleLayer,
    handlePointClick,
}: PoeViewProps) => {
    const getStat = (key: string) => ihrStats?.[key] ?? 0;

    const statsCards = [
        {
            label: "Outbreak Alerts",
            value: ihrStats ? formatNumber(getStat("outbreak_news")) : "—",
            icon: <AlertTriangle size={20} />,
            color: "text-red-500",
        },
        {
            label: "Airports Monitored",
            value: ihrStats ? formatNumber(getStat("airports")) : "—",
            icon: <Plane size={20} />,
            color: "text-pink-500",
        },
        {
            label: "Seaports Monitored",
            value: ihrStats ? formatNumber(getStat("seaports")) : "—",
            icon: <Ship size={20} />,
            color: "text-cyan-500",
        },
        {
            label: "Border Crossings",
            value: ihrStats ? formatNumber(getStat("border_crossings")) : "—",
            icon: <Navigation size={20} />,
            color: "text-blue-500",
        },
        {
            label: "Inland Ports",
            value: ihrStats ? formatNumber(getStat("inland_ports")) : "—",
            icon: <Anchor size={20} />,
            color: "text-purple-500",
        },
        {
            label: "Informal Crossings",
            value: ihrStats ? formatNumber(getStat("informal_crossings")) : "—",
            icon: <MapPin size={20} />,
            color: "text-orange-500",
        },
        {
            label: "Corridor Hotspots",
            value: ihrStats ? formatNumber(getStat("corridor_hotspots")) : "—",
            icon: <Activity size={20} />,
            color: "text-rose-600",
        },
        {
            label: "Movement Flows",
            value: ihrStats ? formatNumber(getStat("anim_movement_flows")) : "—",
            icon: <Route size={20} />,
            color: "text-teal-400",
        },
    ];

    return (
        <div className={isLight ? 'text-[#1a1a1a]' : 'text-white'}>
            <section className="flex flex-row gap-3 justify-stretch mt-4">
                <section className="grow min-w-0">
                    {/* Header Section */}
                    <div className="flex flex-row items-center justify-between mb-6">
                        <div>
                            <div className="flex flex-row gap-2 items-center">
                                <h1 className="text-xl font-bold">IHR Points of Entry — AFRO Public Health Surveillance</h1>
                                {loading && <Updating />}
                            </div>
                            <p className={`text-sm ${isLight ? 'text-gray-600' : 'text-gray-400'}`}>
                                18-Layer Surveillance System · WHO DON · WFP BCPs · UNHCR Displacement · Airports · Seaports · Informal Corridors · Movement Flows
                            </p>
                        </div>

                        <div className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full border ${isLight ? 'bg-white border-gray-200' : 'bg-white/5 border-white/10'
                            }`}>
                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                            <span className="text-[10px] font-bold uppercase tracking-wider opacity-70">AFRO IHR Surveillance Active</span>
                        </div>
                    </div>

                    {/* Quick Stats Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 mb-6">
                        {statsCards.map((stat, idx) => (
                            <div
                                key={idx}
                                className={`p-3 rounded-xl border transition-all ${isLight ? 'bg-white border-gray-200 shadow-sm' : 'bg-white/5 border-white/10'
                                    }`}
                            >
                                <div className="flex flex-col items-center gap-1.5 text-center">
                                    <div className={`p-1.5 rounded-lg ${isLight ? 'bg-gray-50' : 'bg-white/5'} ${stat.color}`}>
                                        {stat.icon}
                                    </div>
                                    <p className={`text-[9px] font-bold uppercase tracking-tight leading-tight ${isLight ? 'text-gray-500' : 'text-gray-400'}`}>
                                        {stat.label}
                                    </p>
                                    <p className="text-lg font-bold">{stat.value}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Layer Toggle Controls — Grouped by Pipeline */}
                    <div className="mb-6 space-y-4">
                        {PIPELINE_ORDER.map(groupKey => {
                            const groupLayers = getLayersByGroup(groupKey);
                            if (groupLayers.length === 0) return null;
                            const meta = PIPELINE_LABELS[groupKey];
                            const layerDefs = groupLayers.map(getLayerDef);
                            const activeCount = layerDefs.filter(l => activeLayers.includes(l.title)).length;

                            return (
                                <div key={groupKey}>
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="text-sm">{meta.icon}</span>
                                        <span className={`text-[11px] font-bold uppercase tracking-wide ${isLight ? 'text-gray-500' : 'text-gray-400'}`}>
                                            {meta.label}
                                        </span>
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${isLight ? 'bg-gray-100 text-gray-600' : 'bg-white/10 text-gray-300'}`}>
                                            {activeCount}/{layerDefs.length}
                                        </span>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {layerDefs.map((layer) => {
                                            const isActive = activeLayers.includes(layer.title);
                                            return (
                                                <button
                                                    key={layer.title}
                                                    onClick={() => toggleLayer(layer.title)}
                                                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98] ${isActive
                                                        ? (isLight
                                                            ? 'bg-white border-blue-500/50 shadow-md'
                                                            : 'bg-blue-500/5 border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.1)]')
                                                        : (isLight
                                                            ? 'bg-gray-50/50 border-gray-100 opacity-60 grayscale'
                                                            : 'bg-white/5 border-white/5 opacity-40 grayscale')
                                                        }`}
                                                >
                                                    <div style={{ opacity: isActive ? 1 : 0.4 }}>
                                                        {layer.icon}
                                                    </div>
                                                    <span>{layer.label}</span>
                                                    <div
                                                        className="w-2 h-2 rounded-full"
                                                        style={{ backgroundColor: isActive ? layer.dotColor : '#6b7280' }}
                                                    />
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Main Map Display */}
                    <div className={`mb-6 p-4 rounded-xl shadow-lg border ${isLight ? 'bg-white border-gray-200' : 'bg-[#090F1F] border-white/5'
                        }`}>
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <MapIcon size={18} className={isLight ? 'text-blue-600' : 'text-cyan-400'} />
                                <h2 className="text-lg font-semibold tracking-tight">IHR PoE Surveillance Map — AFRO Region</h2>
                            </div>
                            <div className="text-[10px] font-bold uppercase tracking-widest opacity-50">
                                Toggle layers above to explore
                            </div>
                        </div>
                        <div className="w-full h-[550px] relative">
                            <PoEMap
                                onPointClick={handlePointClick}
                                visibleLayerTitles={activeLayers}
                            />
                        </div>
                    </div>

                    {/* Detailed Analysis Section */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                        {/* IHR PoE Insights */}
                        <div className={`p-6 rounded-xl border ${isLight ? 'bg-red-50/50 border-red-100' : 'bg-red-500/5 border-red-500/10'
                            }`}>
                            <div className="flex gap-4">
                                <div className="p-2 h-fit rounded-lg bg-red-500/10 text-red-500">
                                    <Shield size={20} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-lg mb-2">IHR PoE Surveillance</h3>
                                    <p className={`text-sm leading-relaxed ${isLight ? 'text-gray-600' : 'text-gray-300'}`}>
                                        International Health Regulations (2005) Point of Entry surveillance — monitoring airports, seaports, ground crossings, and informal corridors for public health events.
                                        Integrates WHO Disease Outbreak News, UNHCR displacement data, WFP border crossing intelligence, ACLED conflict data, and OSM informal crossing detection per Articles 6, 12, 23, 44 and Annex 1B.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Data Sources */}
                        <div className={`p-6 rounded-xl border ${isLight ? 'bg-white border-gray-100 shadow-sm' : 'bg-[#090F1F] border-white/5'
                            }`}>
                            <div className="flex gap-4">
                                <div className="p-2 h-fit rounded-lg bg-amber-500/10 text-amber-500">
                                    <Globe size={20} />
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-bold text-lg mb-3">Data Sources</h3>
                                    <div className="space-y-2">
                                        {[
                                            { name: "WHO Disease Outbreak News", org: "WHO", color: "text-red-500" },
                                            { name: "Global Airport PoE Registry", org: "OurAirports", color: "text-pink-500" },
                                            { name: "World Seaport Index Pub. 150", org: "NGA", color: "text-cyan-500" },
                                            { name: "Inland River/Lake Ports", org: "NGA", color: "text-purple-500" },
                                            { name: "People of Concern & Presence", org: "UNHCR", color: "text-amber-500" },
                                            { name: "Border Crossing Points", org: "WFP SDI-T", color: "text-blue-500" },
                                            { name: "Informal Crossings (OSM)", org: "OpenStreetMap", color: "text-orange-500" },
                                            { name: "Conflict Corridor Data", org: "ACLED", color: "text-rose-600" },
                                            { name: "Boundary Lines", org: "Natural Earth", color: "text-gray-500" },
                                            { name: "Movement Flow Corridors", org: "UNHCR/IOM", color: "text-teal-500" },
                                        ].map((source, i) => (
                                            <div key={i} className="flex items-center justify-between text-sm">
                                                <span className={`${isLight ? 'text-gray-700' : 'text-gray-300'}`}>
                                                    {source.name}
                                                </span>
                                                <span className={`text-xs font-semibold ${source.color}`}>
                                                    {source.org}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Layer Legend — grouped by pipeline */}
                    <div className={`mb-8 p-5 rounded-xl border ${isLight ? 'bg-white border-gray-100 shadow-sm' : 'bg-[#090F1F] border-white/5'
                        }`}>
                        <h3 className="font-bold text-sm uppercase tracking-wide mb-4 opacity-60">Data Dictionary</h3>
                        <div className="space-y-5">
                            {PIPELINE_ORDER.map(groupKey => {
                                const groupLayers = getLayersByGroup(groupKey);
                                if (groupLayers.length === 0) return null;
                                const meta = PIPELINE_LABELS[groupKey];
                                const layerDefs = groupLayers.map(getLayerDef);

                                return (
                                    <div key={groupKey}>
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="text-sm">{meta.icon}</span>
                                            <span className={`text-[10px] font-bold uppercase tracking-wide ${isLight ? 'text-gray-400' : 'text-gray-500'}`}>
                                                {meta.label}
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                            {layerDefs.map((layer) => {
                                                const isActive = activeLayers.includes(layer.title);
                                                return (
                                                    <div
                                                        key={layer.title}
                                                        onClick={() => toggleLayer(layer.title)}
                                                        className={`flex items-center gap-3 cursor-pointer p-3 rounded-lg transition-all hover:bg-gray-50 dark:hover:bg-white/5 ${!isActive ? 'opacity-40' : ''
                                                            }`}
                                                    >
                                                        <span style={{ display: 'inline-block', flexShrink: 0 }}>
                                                            {layer.icon}
                                                        </span>
                                                        <div>
                                                            <p className="text-sm font-semibold">{layer.label}</p>
                                                            <p className={`text-xs ${isLight ? 'text-gray-500' : 'text-gray-400'}`}>{layer.description}</p>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </section>

                <aside className="w-[300px] flex-shrink-0 hidden xl:block">
                    <LiveFeedWatchlist />
                </aside>
            </section>


            <section className="my-8">
                <NewsTicker />
            </section>
        </div>
    );
};
