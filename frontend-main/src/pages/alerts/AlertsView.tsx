import React, { useMemo, useState } from 'react';
import { SignalDetailPanel } from './components/SignalDetailPanel';
import { SituationReport } from './components/SituationReport';
import { AutoDetectionPopup } from './components/AutoDetectionPopup';
import { AdvancedFilters } from './components/AdvancedFilters';
import { AlertLevel } from './types';
import type { Signal, RegionalSummary, AutoDetection, Incident, Disease } from './types';
import type { OutbreakCluster } from '@/hooks/useOutbreakDetection';

interface StatCard {
    label: string;
    val: string;
    /** Either a lucide-react component class or its name as a string —
     *  current callers pass strings; rendering uses `<s.icon .../>` JSX. */
    icon: React.ComponentType<{ className?: string }> | string;
    /** Free-form status keyword used by the view to pick colours. */
    status: string;
    pulse?: boolean;
    subtext?: string;
}

interface AlertsStats {
    cards: StatCard[];
    priorityStats: { P1: number; P2: number; P3: number; P4: number };
}

/** Mirror of fetchSignalStats() return shape (alerts/services/sentinelService.ts). */
interface StatsAggregate {
    total: number;
    by_priority: Record<string, number>;
    by_status: Record<string, number>;
    by_country: Array<{ location_country_iso: string; count: number }>;
}

type IhrSummaryRow = Record<string, unknown>;
type SourceRow = Record<string, unknown>;
import type { ActiveFilters } from './AlertsPage';
import { ArcGISMap } from './components/ArcGISMap';
import LiveFeedWatchlist from '@/components/usables/LiveFeedWatchlist';
import { DataRegistry } from './components/DataRegistry';
import { SignalAnalytics } from './components/SignalAnalytics';
import { DiseaseProfileCard } from './components/DiseaseProfileCard';
// Removed: SourceLeaderboard and IHRCategorySummary — moved to dedicated pages
// import { SourceLeaderboard } from './components/SourceLeaderboard';
// import { IHRCategorySummary } from './components/IHRCategorySummary';
import { IncidentModal } from './components/IncidentModal';
// Removed: NewsTicker — duplicates Live Feed sidebar
// import NewsTicker from '@/components/usables/NewsTicker';
import { ShieldCheck, Settings2, Activity, Zap, FileText, Download, ChevronDown, ChevronUp, BarChart3 } from 'lucide-react';
import { exportToExcel } from './services/exportUtility';

const TrafficLightHeatmap = ({ items }: { items: RegionalSummary[] }) => {
    if (items.length === 0) return (
        <div className="py-12 text-center text-slate-500 text-[10px] font-black uppercase tracking-widest animate-pulse">Scanning Pathogen Load...</div>
    );

    return (
        <div className="space-y-5 flex-1 overflow-y-auto custom-scrollbar pr-2">
            {items.map((item) => {
                let bgColor = "bg-emerald-500";
                let dotColor = "bg-emerald-400";
                let statusText = "Stable";

                if (item.trend === 'increasing' || item.countriesAffected > 5) {
                    bgColor = "bg-red-500";
                    dotColor = "bg-red-400";
                    statusText = "Critical";
                } else if (item.countriesAffected > 2) {
                    bgColor = "bg-amber-500";
                    dotColor = "bg-amber-400";
                    statusText = "Alert";
                }

                return (
                    <div key={item.disease} className="group cursor-default">
                        <div className="flex justify-between items-end text-[10px] font-black uppercase mb-1.5">
                            <div className="flex items-center gap-2">
                                <span className={`w-1.5 h-1.5 rounded-full ${dotColor} animate-pulse`}></span>
                                <span className="text-slate-400 tracking-tight group-hover:text-white transition-colors">{item.disease}</span>
                            </div>
                            <span className={bgColor.replace('bg-', 'text-')}>{statusText}</span>
                        </div>
                        <div className="h-2 bg-slate-800 rounded-full overflow-hidden border border-slate-700 relative shadow-inner">
                            <div
                                className={`h-full ${bgColor} rounded-full transition-all duration-1000 ease-out shadow-sm`}
                                style={{ width: `${Math.min(100, (item.countriesAffected / 47) * 500)}%` }}
                            ></div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

const LiveTicker = ({ signals, isLight }: { signals: Signal[], isLight: boolean }) => {
    const tickerItems = useMemo(() => {
        const list: string[] = [];
        if (signals && signals.length > 0) {
            const critical = signals.filter(s => (s.level === 'P1' || s.level === 'P2')).slice(0, 5);
            const news = signals.filter(s => s.ingestion_source === 'GDELT').slice(0, 10);
            const others = signals.filter(s => s.ingestion_source !== 'GDELT' && s.level !== 'P1' && s.level !== 'P2').slice(0, 5);

            [...critical, ...news, ...others].forEach(s => {
                const country = s.location?.country || s.location?.name || 'REGIONAL';
                const headline = s.headline || s.summary || 'UNTITLED SIGNAL';
                const prefix = s.level === 'P1' ? '🚨 CRITICAL' : s.ingestion_source === 'GDELT' ? '📰 NEWS' : '📡 SIGNAL';
                list.push(`${prefix} [${country.toUpperCase()}]: ${headline.toUpperCase()}...`);
            });
        }
        return list;
    }, [signals]);

    if (tickerItems.length === 0) return (
        <div className={`h-10 border-y flex items-center px-6 ${isLight ? 'bg-gray-50 border-gray-200' : 'bg-[#090F1F] border-white/5'}`}>
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest animate-pulse">Syncing Intelligence Streams...</span>
        </div>
    );

    return (
        <div className={`overflow-hidden relative border-y h-10 z-10 shrink-0 flex items-center ${isLight ? 'bg-white border-gray-200 shadow-sm' : 'bg-[#090F1F] border-white/5 shadow-2xl'}`}>
            <div className={`absolute left-0 top-0 bottom-0 px-5 flex items-center border-r z-20 ${isLight ? 'bg-white border-gray-200' : 'bg-[#090F1F] border-white/5'}`}>
                <span className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-2 ${isLight ? 'text-blue-600' : 'text-blue-400'}`}>
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
                    Intelligence Feed
                </span>
            </div>
            <div className="whitespace-nowrap flex items-center gap-24 pl-52 animate-[marquee_80s_linear_infinite] hover:[animation-play-state:paused] cursor-default">
                {[...tickerItems, ...tickerItems].map((text, idx) => (
                    <div key={idx} className="flex items-center gap-8 shrink-0">
                        <span className={`text-[10px] font-black tracking-tight ${text.includes('CRITICAL')
                            ? (isLight ? 'text-red-600' : 'text-red-400')
                            : (isLight ? 'text-slate-700' : 'text-slate-300')
                            }`}>{text}</span>
                        <span className={`w-1 h-1 rounded-full ${isLight ? 'bg-slate-300' : 'bg-slate-700'}`}></span>
                    </div>
                ))}
            </div>
        </div>
    );
};

interface AlertsViewProps {
    isLight: boolean;
    selectedCountry: string;
    setSelectedCountry: (v: string) => void;
    showSitRep: boolean;
    setShowSitRep: (v: boolean) => void;
    signals: Signal[];
    incidents: Incident[];
    detections: AutoDetection[];
    setDetections: React.Dispatch<React.SetStateAction<AutoDetection[]>>;
    loading: boolean;
    activeSignal: Signal | null;
    setActiveSignal: (v: Signal | null) => void;
    activeIncident: Incident | null;
    setActiveIncident: (v: Incident | null) => void;
    errorMsg: string | null;
    isRateLimited: boolean;
    isControlCenterOpen: boolean;
    setIsControlCenterOpen: (v: boolean) => void;
    isIncidentModalOpen: boolean;
    setIsIncidentModalOpen: (v: boolean) => void;
    diseaseDb: Disease[];
    sourcesDb: SourceRow[];
    ihrSummary: IhrSummaryRow[];
    statsData: StatsAggregate | null;
    stats: AlertsStats;
    clusters: OutbreakCluster[];
    loadAllIntelligence: (location: string, isSilent?: boolean) => Promise<void>;
    activeFilters: ActiveFilters;
    onFilterChange: (filters: ActiveFilters) => void;
    lastRefreshed: Date;
}

/** Collapsible wrapper for Signal Analytics — saves vertical space */
const AnalyticsCollapsible: React.FC<{ signals: Signal[] }> = ({ signals }) => {
    const [expanded, setExpanded] = useState(false);
    return (
        <div className="rounded-2xl border border-white/[0.05] bg-white/[0.01] overflow-hidden">
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-white/[0.03] transition-colors group"
            >
                <div className="flex items-center gap-2.5">
                    <BarChart3 className="w-4 h-4 text-cyan-400" />
                    <span className="text-[10px] font-black text-white uppercase tracking-[0.15em]">Signal Analytics</span>
                    <span className="text-[9px] font-bold text-slate-500 ml-1">{signals.length} signals</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-[8px] font-bold text-slate-600 uppercase tracking-widest group-hover:text-slate-400 transition-colors">
                        {expanded ? 'Collapse' : 'Expand'}
                    </span>
                    {expanded
                        ? <ChevronUp className="w-3.5 h-3.5 text-slate-500" />
                        : <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                    }
                </div>
            </button>
            {expanded && (
                <div className="px-1 pb-1 animate-in slide-in-from-top-2 duration-200">
                    <SignalAnalytics signals={signals} />
                </div>
            )}
        </div>
    );
};

export const AlertsView: React.FC<AlertsViewProps> = ({
    isLight,
    selectedCountry,
    setSelectedCountry,
    showSitRep,
    setShowSitRep,
    signals,
    incidents,
    detections,
    setDetections,
    loading,
    activeSignal,
    setActiveSignal,
    activeIncident,
    setActiveIncident,
    errorMsg,
    isRateLimited,
    isControlCenterOpen,
    setIsControlCenterOpen,
    isIncidentModalOpen,
    setIsIncidentModalOpen,
    diseaseDb,
    sourcesDb,
    ihrSummary,
    statsData,
    stats,
    clusters,
    loadAllIntelligence,
    activeFilters,
    onFilterChange,
    lastRefreshed
}) => {
    return (
        <div className="w-full h-full">
            <section className="flex flex-row gap-3 justify-stretch mt-4">
                <section className="grow min-w-0">
                    <div className="flex flex-row items-center justify-between mb-6">
                        <div>
                            <div className="flex flex-row gap-2 items-center">
                                <h1 className={`text-xl font-bold ${isLight ? 'text-[#1a1a1a]' : 'text-white'}`}>AFRO Sentinel Watchtower</h1>
                                <div className={`w-1.5 h-1.5 rounded-full ${isLight ? 'bg-cyan-600' : 'bg-cyan-400'} animate-pulse`}></div>
                            </div>
                            <p className={`text-sm ${isLight ? 'text-gray-600' : 'text-gray-400'}`}>
                                Disease Intelligence & Early Warning System
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setShowSitRep(true)}
                                className={`flex items-center gap-2 h-9 px-4 rounded-xl text-[10px] font-black uppercase tracking-[0.1em] transition-all border active:scale-95 ${isLight ? 'bg-cyan-600 text-white border-cyan-500 hover:bg-cyan-700' : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20 hover:bg-cyan-500/20 shadow-lg shadow-cyan-900/10'}`}
                            >
                                <FileText className="w-3.5 h-3.5" />
                                Situation Report
                            </button>
                            <button
                                onClick={() => setIsControlCenterOpen(!isControlCenterOpen)}
                                className={`flex items-center gap-2 h-9 px-4 rounded-xl text-[10px] font-black uppercase tracking-[0.1em] transition-all border active:scale-95 ${isControlCenterOpen
                                    ? (isLight ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-900 border-white')
                                    : isLight
                                        ? 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                                        : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'
                                    }`}
                            >
                                <Settings2 className="w-3.5 h-3.5" />
                                Control Center
                                {signals.length > 0 && (
                                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
                                )}
                            </button>
                            <button
                                onClick={() => exportToExcel(signals, selectedCountry)}
                                className={`flex items-center gap-2 h-9 px-4 rounded-xl text-[10px] font-black uppercase tracking-[0.1em] transition-all border active:scale-95 ${isLight ? 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50' : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'}`}
                            >
                                <Download className="w-3.5 h-3.5" />
                                Export
                            </button>
                            <div className={`hidden sm:flex items-center gap-2 h-9 px-4 rounded-xl border border-dashed ${isLight ? 'bg-slate-50 border-slate-200 text-slate-500' : 'bg-white/5 border-white/10 text-slate-500'}`}>
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                <span className="text-[10px] font-black uppercase tracking-widest">Active Link</span>
                            </div>
                        </div>
                    </div>

                    <div className="mb-6 grid grid-cols-12 gap-4">
                        <div className="col-span-12 lg:col-span-8 grid grid-cols-2 md:grid-cols-4 gap-3">
                            {stats.cards.map((s: StatCard, i: number) => (
                                <button
                                    key={i}
                                    onClick={() => {
                                        const registry = document.getElementById('data-registry-section');
                                        registry?.scrollIntoView({ behavior: 'smooth' });
                                    }}
                                    className={`relative px-4 py-4 rounded-2xl border group transition-all duration-300 overflow-hidden text-left active:scale-[0.98] h-[88px] flex flex-col justify-center ${isLight
                                        ? 'bg-white border-slate-200 hover:border-blue-300 hover:shadow-lg'
                                        : 'bg-white/[0.02] border-white/[0.05] hover:border-white/10 shadow-lg shadow-black/20'
                                        }`}>
                                    <div className={`absolute left-0 top-0 bottom-0 w-[3px] opacity-0 group-hover:opacity-100 transition-all ${s.status === 'warning' ? 'bg-red-500' : s.status === 'success' ? 'bg-emerald-500' : s.status === 'info' ? 'bg-blue-500' : 'bg-cyan-500'}`} />
                                    <div className="flex items-center justify-between mb-2 relative z-10">
                                        <p className={`text-[8px] font-black uppercase tracking-[0.2em] leading-none ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>{s.label}</p>
                                        {/* StatCard.icon is rendered dynamically; the page passes a component-or-string union. */}
                                        {(() => { const Icon = s.icon as React.ComponentType<{ className?: string }>; return (
                                        <Icon className={`w-3.5 h-3.5 ${s.status === 'warning'
                                            ? (isLight ? 'text-red-500' : 'text-red-400')
                                            : s.status === 'success'
                                                ? (isLight ? 'text-emerald-500' : 'text-emerald-400')
                                                : s.status === 'info'
                                                    ? (isLight ? 'text-blue-500' : 'text-blue-400')
                                                    : (isLight ? 'text-cyan-600' : 'text-cyan-400')
                                            } ${s.pulse ? 'animate-pulse' : ''}`} />
                                        ); })()}
                                    </div>
                                    <div className="relative z-10 flex items-baseline gap-1.5">
                                        <span className={`text-2xl font-black tracking-tight leading-none ${s.status === 'warning'
                                            ? (isLight ? 'text-red-600' : 'text-red-400')
                                            : 'text-white'
                                            }`}>{s.val}</span>
                                        {s.subtext && (
                                            <span className={`text-[9px] font-bold ${s.status === 'success' ? 'text-emerald-500' : 'text-slate-500'}`}>{s.subtext}</span>
                                        )}
                                        {s.pulse && (
                                            <div className="flex items-center gap-1">
                                                <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
                                                <span className="text-[7px] font-black text-emerald-500 uppercase tracking-widest">Live</span>
                                            </div>
                                        )}
                                    </div>
                                </button>
                            ))}
                        </div>
                        <div className="col-span-12 lg:col-span-4 flex flex-col gap-2">
                            {clusters.length > 0 ? (
                                clusters.slice(0, 1).map((cluster, i) => (
                                    <div key={i} className={`relative group flex items-center justify-between p-3 rounded-2xl border transition-all h-[88px] ${cluster.urgency === 'high' ? 'bg-red-600/5 border-red-500/20 text-red-400' : 'bg-orange-500/5 border-orange-500/20 text-orange-400'} overflow-hidden shadow-sm`}>
                                        <div className="flex items-center gap-3 relative z-10 overflow-hidden text-left">
                                            <div className={`w-9 h-9 shrink-0 rounded-xl flex items-center justify-center border ${cluster.urgency === 'high' ? 'bg-red-500/10 border-red-500/20 text-red-500 animate-pulse' : 'bg-orange-500/10 border-orange-500/20 text-orange-500'}`}>
                                                <Zap className="w-4.5 h-4.5" />
                                            </div>
                                            <div className="min-w-0">
                                                <div className="text-[10px] font-black uppercase tracking-tight text-white truncate">{cluster.disease} TREND // {cluster.iso3}</div>
                                                <div className="text-[9px] font-bold opacity-50 uppercase tracking-widest leading-none mt-0.5">{cluster.count} SIGNALS DETECTED</div>
                                            </div>
                                            <button
                                                onClick={() => {
                                                    setSelectedCountry(cluster.iso3);
                                                    setShowSitRep(true);
                                                }}
                                                className={`relative z-10 px-4 py-2 shrink-0 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all shadow-lg active:scale-95 ${cluster.urgency === 'high' ? 'bg-red-600 hover:bg-red-500 text-white' : 'bg-orange-600 hover:bg-orange-500 text-white'}`}
                                            >
                                                Investigate
                                            </button>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="h-[88px] flex flex-col justify-center px-6 rounded-2xl bg-white/[0.01] border border-white/[0.05] border-dashed">
                                    <div className="text-[8px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                        <ShieldCheck className="w-3 h-3 text-emerald-500/50" />
                                        Monitoring Active Pathogen Load
                                    </div>
                                    <div className="text-[10px] text-slate-400 font-bold mt-1">Zero high-urgency clusters detected in 47 regions.</div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className={`shrink-0 rounded-xl shadow-lg border overflow-hidden ${isLight ? 'bg-white border-gray-200' : 'bg-[#090F1F] border-white/5'}`}>
                        <div className="w-full h-[610px] min-h-[610px] relative">
                            <ArcGISMap
                                signals={signals}
                                onSignalClick={setActiveSignal}
                                selectedCountry={selectedCountry}
                            />

                            <div className="absolute top-6 left-6 bg-white/95 backdrop-blur-md p-4 rounded-3xl border border-slate-200 shadow-2xl z-20">
                                <h4 className="text-xs font-bold text-slate-800 mb-3 tracking-tight">Active Signals</h4>
                                <div className="flex items-center gap-2">
                                    <div className={`px-3 py-1 rounded-full border flex items-center justify-center transition-all ${stats.priorityStats.P1 > 0 ? 'border-red-500/30 bg-red-50/50 hover:bg-red-50' : 'border-slate-200 bg-slate-50 opacity-40'}`}>
                                        <span className={`text-[10px] font-black ${stats.priorityStats.P1 > 0 ? 'text-red-600' : 'text-slate-400'}`}>P1: {stats.priorityStats.P1}</span>
                                    </div>
                                    <div className={`px-3 py-1 rounded-full border flex items-center justify-center transition-all ${stats.priorityStats.P2 > 0 ? 'border-orange-500/30 bg-orange-50/50 hover:bg-orange-50' : 'border-slate-200 bg-slate-50 opacity-40'}`}>
                                        <span className={`text-[10px] font-black ${stats.priorityStats.P2 > 0 ? 'text-orange-600' : 'text-slate-400'}`}>P2: {stats.priorityStats.P2}</span>
                                    </div>
                                    <div className={`px-3 py-1 rounded-full border flex items-center justify-center transition-all ${stats.priorityStats.P3 > 0 ? 'border-amber-500/30 bg-amber-50/50 hover:bg-amber-50' : 'border-slate-200 bg-slate-50 opacity-40'}`}>
                                        <span className={`text-[10px] font-black ${stats.priorityStats.P3 > 0 ? 'text-amber-600' : 'text-slate-400'}`}>P3: {stats.priorityStats.P3}</span>
                                    </div>
                                    <div className={`px-3 py-1 rounded-full border flex items-center justify-center transition-all ${stats.priorityStats.P4 > 0 ? 'border-emerald-500/30 bg-emerald-50/50 hover:bg-emerald-50' : 'border-slate-200 bg-slate-50 opacity-40'}`}>
                                        <span className={`text-[10px] font-black ${stats.priorityStats.P4 > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>P4: {stats.priorityStats.P4}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="absolute top-6 left-1/2 -translate-x-1/2 z-20">
                                <div className="bg-slate-900/80 backdrop-blur-md px-5 py-2 rounded-full border border-white/10 shadow-2xl flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.5)]"></div>
                                    <span className="text-[9px] font-black text-white uppercase tracking-[0.2em] leading-none">Scanning AFRO Stream: {signals.length} Nodes</span>
                                </div>
                            </div>

                            <div className="absolute bottom-6 left-6 bg-white/95 backdrop-blur-sm p-4 rounded-2xl border border-slate-200 shadow-xl z-20">
                                <div className="flex items-center gap-2 mb-3">
                                    <h4 className="text-[9px] font-black text-slate-900 uppercase tracking-widest">Priority</h4>
                                </div>
                                <div className="space-y-1.5">
                                    <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-red-500"></div><span className="text-[8px] font-bold text-slate-600">P1 · Critical</span></div>
                                    <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-orange-400"></div><span className="text-[8px] font-bold text-slate-600">P2 · High</span></div>
                                    <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-yellow-400"></div><span className="text-[8px] font-bold text-slate-600">P3 · Medium</span></div>
                                    <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-500"></div><span className="text-[8px] font-bold text-slate-600">P4 · Low</span></div>
                                </div>
                            </div>

                            <div className="absolute bottom-0 left-0 right-0 z-30">
                                <LiveTicker signals={signals} isLight={isLight} />
                            </div>
                        </div>
                    </div>
                </section>
                <aside className="w-[300px] flex-shrink-0 hidden xl:block">
                    <LiveFeedWatchlist onSignalSelect={setActiveSignal} />
                </aside>
            </section>

            {/* News Ticker removed — duplicates Live Feed sidebar */}

            <div id="data-registry-section" className="mt-6 mr-4 h-[500px]">
                <DataRegistry
                    signals={signals}
                    incidents={incidents}
                    onSignalClick={(s: Signal) => setActiveSignal(s)}
                    onIncidentClick={(i: Incident) => setActiveIncident(i)}
                    activeSignalId={activeSignal?.id}
                />
            </div>

            {/* Signal Analytics — collapsible to save vertical space */}
            <div id="signal-analytics-section" className="mt-4 mr-4">
                <AnalyticsCollapsible signals={signals} />
            </div>

            {/* Disease Profile — only shown when a signal is actively selected */}
            {activeSignal && (
                <div id="disease-profile-section" className="mt-4 mr-4">
                    <DiseaseProfileCard signal={activeSignal} diseases={diseaseDb} />
                </div>
            )}

            {/* Source Leaderboard & IHR Summary removed — belong on dedicated pages */}

            {isControlCenterOpen && (
                <>
                    <div
                        className="fixed inset-0 bg-slate-900/10 backdrop-blur-sm z-50 transition-all"
                        onClick={() => setIsControlCenterOpen(false)}
                    />
                    <div className="fixed inset-y-0 right-0 w-[450px] bg-white shadow-2xl z-[100] border-l border-slate-200 flex">
                        <div className="flex flex-col flex-1">
                            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center text-white">
                                        <Zap className="w-4 h-4" />
                                    </div>
                                    <h3 className="font-black text-slate-900 uppercase tracking-widest">Signal Control Center</h3>
                                </div>
                                <button onClick={() => setIsControlCenterOpen(false)} className="text-slate-400 hover:text-slate-950 font-black p-2 hover:bg-slate-100 rounded-lg transition-colors">CLOSE</button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-slate-50/30">
                                <div>
                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Spatial & Type Filters</h4>
                                    <AdvancedFilters
                                        signalCounts={{
                                            [AlertLevel.CRITICAL]: statsData?.by_priority?.P1 || 0,
                                            [AlertLevel.HIGH]: statsData?.by_priority?.P2 || 0,
                                            [AlertLevel.MEDIUM]: statsData?.by_priority?.P3 || 0,
                                            [AlertLevel.LOW]: statsData?.by_priority?.P4 || 0,
                                        }}
                                        onFilterChange={onFilterChange}
                                        activeFilters={activeFilters}
                                    />
                                </div>
                                <div className="p-6 bg-white rounded-2xl border border-slate-200">
                                    <h5 className="text-[9px] font-black text-slate-900 uppercase tracking-widest mb-2 flex items-center gap-2">
                                        <Activity className="w-3.5 h-3.5 text-blue-500" />
                                        Regional Synergy
                                    </h5>
                                    <p className="text-[11px] text-slate-500 font-bold leading-relaxed mb-4">
                                        The AFRO Sentinel Watchtower integrates signals from all 47 member states. Filtering helps analysts isolate critical disease clusters during multi-country outbreaks.
                                    </p>
                                    <div className="flex items-center gap-2 text-[9px] font-black text-emerald-600 bg-emerald-50 px-3 py-2 rounded-xl border border-emerald-100 uppercase tracking-widest">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                        Syncing with Regional Data Centers
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {detections && detections.length > 0 && (
                <AutoDetectionPopup
                    detections={detections}
                    onClose={(id: string | number) => setDetections((prev: AutoDetection[]) => prev.filter((d: AutoDetection) => d.id !== id))}
                />
            )}

            {isIncidentModalOpen && (
                <IncidentModal
                    incident={activeIncident}
                    onClose={() => {
                        setIsIncidentModalOpen(false);
                        setActiveIncident(null);
                    }}
                />
            )}

            {showSitRep && (
                <SituationReport
                    country={selectedCountry}
                    iso3={selectedCountry}
                    signals={signals}
                    onClose={() => setShowSitRep(false)}
                />
            )}

            {activeSignal && (
                <div className="mt-4 mr-4">
                    <SignalDetailPanel
                        signal={activeSignal}
                        onClose={() => setActiveSignal(null)}
                        onUpdate={() => loadAllIntelligence('all', true)}
                        onPromote={() => setIsIncidentModalOpen(true)}
                    />
                </div>
            )}
        </div>
    );
};
