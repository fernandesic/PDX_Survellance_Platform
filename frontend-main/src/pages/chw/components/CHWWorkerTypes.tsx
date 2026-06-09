import type { CHWCountry } from "@/pages/chw/types/chw";
import {
    Stethoscope, HeartPulse, TrendingUp, Activity, Users, ArrowRight,
} from "lucide-react";

const PIE_COLORS = [
    '#06b6d4', '#a855f7', '#10b981', '#f59e0b', '#f43f5e',
    '#3b82f6', '#8b5cf6', '#14b8a6', '#f97316', '#ec4899',
];

interface CHWWorkerTypesProps {
    isDark: boolean;
    workerTypeAgg: { name: string; value: number }[];
    totalWorkers: number;
    sorted: CHWCountry[];
    countries: CHWCountry[];
    totalChws: number;
    totalPop: number;
    avgPer10k: number;
    askWhoAbout: (question: string) => void;
}

export function CHWWorkerTypes({
    isDark, workerTypeAgg, totalWorkers, sorted, countries,
    totalChws, totalPop, avgPer10k, askWhoAbout,
}: CHWWorkerTypesProps) {
    return (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            {/* Worker Types — Horizontal Bar */}
            <div className={`xl:col-span-2 rounded-xl border p-6 ${isDark
                ? 'bg-white/[0.02] backdrop-blur-md border-white/10 shadow-xl'
                : 'bg-white/80 backdrop-blur-md border-gray-100 shadow-sm'
                }`}>
                <div className="flex items-center gap-2.5 mb-5">
                    <Stethoscope size={18} className={isDark ? 'text-[#22C55E]' : 'text-blue-600'} />
                    <div>
                        <h3 className={`text-base font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            Workforce Composition
                        </h3>
                        <p className={`text-sm ${isDark ? 'text-[#A8C4BB]' : 'text-gray-400'}`}>
                            {totalWorkers.toLocaleString()} workers across {workerTypeAgg.length} categories
                        </p>
                    </div>
                </div>
                <div className="space-y-2.5">
                    {workerTypeAgg.map((wt, i) => {
                        const pct = totalWorkers > 0 ? (wt.value / totalWorkers) * 100 : 0;
                        return (
                            <div key={wt.name} className="flex items-center gap-3">
                                <span className={`text-xs w-40 truncate text-right ${isDark ? 'text-[#A7C8BE]' : 'text-gray-600'}`}>
                                    {wt.name}
                                </span>
                                <div className={`flex-1 h-6 rounded-md overflow-hidden relative ${isDark ? 'bg-white/5' : 'bg-gray-100'}`}>
                                    <div
                                        className="h-full rounded-md transition-all duration-500 flex items-center px-2"
                                        style={{
                                            width: `${Math.max(pct, 2)}%`,
                                            backgroundColor: PIE_COLORS[i % PIE_COLORS.length],
                                        }}
                                    >
                                        {pct > 10 && (
                                            <span className="text-[10px] font-bold text-white">{Math.round(pct)}%</span>
                                        )}
                                    </div>
                                </div>
                                <span className={`text-xs font-semibold w-16 text-right ${isDark ? 'text-[#E8F5F1]' : 'text-gray-800'}`}>
                                    {wt.value.toLocaleString()}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Quick Data Points */}
            <div className={`rounded-xl border p-6 flex flex-col gap-5 ${isDark
                ? 'bg-white/[0.02] backdrop-blur-md border-white/10 shadow-xl'
                : 'bg-white/80 backdrop-blur-md border-gray-100 shadow-sm'
                }`}>
                <div className="flex items-center gap-2.5 mb-1">
                    <HeartPulse size={18} className={isDark ? 'text-[#22C55E]' : 'text-blue-600'} />
                    <h3 className={`text-base font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        Quick Snapshot
                    </h3>
                </div>

                {sorted[0] && (
                    <div className={`rounded-lg p-4 ${isDark ? 'bg-[#22C55E]/10 border border-[#22C55E]/20' : 'bg-emerald-50 border border-emerald-100'}`}>
                        <div className="flex items-center gap-2 mb-1.5">
                            <TrendingUp size={14} className="text-[#22C55E]" />
                            <span className={`text-xs font-bold uppercase tracking-wide ${isDark ? 'text-[#22C55E]' : 'text-emerald-700'}`}>Highest Density</span>
                        </div>
                        <p className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{sorted[0].country}</p>
                        <p className={`text-sm ${isDark ? 'text-[#22C55E]/80' : 'text-emerald-600'}`}>
                            {Math.round(sorted[0].chws_per_10000)} CHWs per 10,000 people
                        </p>
                    </div>
                )}

                <div className={`rounded-lg p-4 ${isDark ? 'bg-[#2EC4B6]/10 border border-[#2EC4B6]/20' : 'bg-blue-50 border border-blue-100'}`}>
                    <div className="flex items-center gap-2 mb-1.5">
                        <Activity size={14} className="text-[#2EC4B6]" />
                        <span className={`text-xs font-bold uppercase tracking-wide ${isDark ? 'text-[#2EC4B6]' : 'text-blue-700'}`}>Coverage</span>
                    </div>
                    <p className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{avgPer10k} avg per 10k</p>
                    <p className={`text-sm ${isDark ? 'text-[#2EC4B6]/80' : 'text-blue-600'}`}>
                        Across {countries.filter(c => c.chws_per_10000 > 0).length} countries with data
                    </p>
                </div>

                <div className={`rounded-lg p-4 ${isDark ? 'bg-[#22C55E]/10 border border-[#22C55E]/20' : 'bg-purple-50 border border-purple-100'}`}>
                    <div className="flex items-center gap-2 mb-1.5">
                        <Users size={14} className="text-[#22C55E]" />
                        <span className={`text-xs font-bold uppercase tracking-wide ${isDark ? 'text-[#22C55E]' : 'text-purple-700'}`}>Total Workforce</span>
                    </div>
                    <p className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{totalChws.toLocaleString()}</p>
                    <p className={`text-sm ${isDark ? 'text-[#22C55E]/80' : 'text-purple-600'}`}>
                        Serving {totalPop > 0 ? (totalPop / 1_000_000).toFixed(0) + 'M' : '—'} people
                    </p>
                </div>

                <button
                    onClick={() => askWhoAbout('provide a comprehensive analysis: compare each country\'s CHW density, identify which large-population countries are most underserved, calculate how many additional CHWs each country would need to reach 23 per 10,000 (WHO benchmark), and rank investment priorities by population impact.')}
                    className={`flex items-center gap-2.5 p-3 rounded-lg transition-all group ${isDark
                        ? 'bg-gradient-to-r from-[#22C55E]/10 to-[#2EC4B6]/10 hover:from-[#22C55E]/15 hover:to-[#2EC4B6]/15 border border-[#22C55E]/15'
                        : 'bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 border border-blue-100'
                        }`}
                >
                    <img src="/assets/logo-chat.png" alt="" className="w-6 h-6 object-contain" />
                    <div className="flex-1 text-left">
                        <p className={`text-sm font-bold ${isDark ? 'text-[#22C55E]' : 'text-blue-700'}`}>Ask WHO AI</p>
                        <p className={`text-xs ${isDark ? 'text-[#A8C4BB]' : 'text-gray-400'}`}>For detailed analysis & recommendations</p>
                    </div>
                    <ArrowRight size={12} className={`transition-transform group-hover:translate-x-1 ${isDark ? 'text-[#22C55E]/50' : 'text-blue-400'}`} />
                </button>
            </div>
        </div>
    );
}
