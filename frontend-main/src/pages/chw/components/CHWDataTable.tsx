import type { CHWCountry } from "@/pages/chw/types/chw";
import {
    BarChart3, Target, X, ChevronUp, ChevronDown, Search,
} from "lucide-react";

interface GapCalcEntry {
    id: string;
    country: string;
    total_chws: number;
    population_2024: number;
    chws_per_10000: number;
    total_regions: number;
    targetChws: number;
    gap: number;
    surplus: number;
    meetsTarget: boolean;
    pctOfTarget: number;
    currentDensity: number;
    severity: 'met' | 'critical' | 'moderate' | 'mild';
}

interface CHWDataTableProps {
    isDark: boolean;
    sorted: CHWCountry[];
    tableSorted: CHWCountry[];
    searchTerm: string;
    setSearchTerm: (v: string) => void;
    coverageFilter: string;
    setCoverageFilter: (v: string) => void;
    sortCol: string;
    sortAsc: boolean;
    handleSort: (col: string) => void;
    compareList: string[];
    toggleCompare: (name: string) => void;
    handleCountryClick: (name: string) => void;
    getMapColor: (total: number) => { bg: string; label?: string };
    compareCountries: CHWCountry[];
    gapCalcData: GapCalcEntry[];
    benchmark: number;
    setBenchmark: (v: number) => void;
    countriesBelowBenchmark: number;
    totalGap: number;
}

export function CHWDataTable({
    isDark, sorted, tableSorted, searchTerm, setSearchTerm,
    coverageFilter, setCoverageFilter, sortCol, sortAsc, handleSort,
    compareList, toggleCompare, handleCountryClick, getMapColor,
    compareCountries, gapCalcData, benchmark, setBenchmark,
    countriesBelowBenchmark, totalGap,
}: CHWDataTableProps) {
    return (
        <>
            {/* ═══════ Gap Calculator + Country Comparison ═══════ */}
            <div className={`grid gap-4 ${compareCountries.length > 0 ? 'grid-cols-1 xl:grid-cols-2' : 'grid-cols-1'}`}>
                {/* Gap Calculator */}
                <div className={`rounded-xl border overflow-hidden ${isDark
                    ? 'bg-white/[0.02] backdrop-blur-md border-white/10 shadow-xl'
                    : 'bg-white/80 backdrop-blur-md border-gray-100 shadow-sm'
                    }`}>
                    <div className="px-4 py-3 border-b" style={{ borderColor: isDark ? 'rgba(255,255,255,0.06)' : '#e5e7eb' }}>
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2.5">
                                <Target size={16} className={isDark ? 'text-[#22C55E]' : 'text-blue-600'} />
                                <h3 className={`text-base font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                    Workforce Gap Calculator
                                </h3>
                            </div>
                            <div className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${countriesBelowBenchmark > 0
                                ? (isDark ? 'bg-red-500/15 text-red-400' : 'bg-red-50 text-red-600')
                                : (isDark ? 'bg-emerald-500/15 text-emerald-400' : 'bg-emerald-50 text-emerald-600')
                                }`}>
                                {countriesBelowBenchmark > 0
                                    ? `${countriesBelowBenchmark} below · ${totalGap.toLocaleString()} needed`
                                    : 'All meet target'}
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className={`text-[10px] whitespace-nowrap ${isDark ? 'text-[#A7C8BE]' : 'text-gray-500'}`}>Target:</span>
                            <input type="range" min={5} max={100} value={benchmark} onChange={e => setBenchmark(Number(e.target.value))} className="flex-1 h-1 rounded-full accent-[#22C55E]" />
                            <div className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold min-w-[65px] justify-center ${isDark ? 'bg-[#22C55E]/15 text-[#22C55E]' : 'bg-blue-50 text-blue-700'}`}>
                                {benchmark} <span className="text-[9px] font-normal opacity-60">/ 10k</span>
                            </div>
                        </div>
                    </div>
                    <div className="max-h-[280px] overflow-y-auto">
                        {gapCalcData.map(c => (
                            <div key={c.id} className={`px-4 py-2 flex items-center gap-3 border-b last:border-b-0 transition-colors cursor-pointer ${isDark
                                ? 'border-white/[0.03] hover:bg-white/[0.02]'
                                : 'border-gray-50 hover:bg-gray-50/50'
                                }`}
                                onClick={() => handleCountryClick(c.country)}
                            >
                                <div className="w-28 flex-shrink-0">
                                    <p className={`text-xs font-medium truncate ${isDark ? 'text-[#E8F5F1]' : 'text-gray-900'}`}>{c.country}</p>
                                    <p className={`text-[9px] ${isDark ? 'text-[#6FA39A]' : 'text-gray-400'}`}>
                                        {c.currentDensity}/10k · {c.total_chws.toLocaleString()}
                                    </p>
                                </div>
                                <div className="flex-1">
                                    <div className={`h-4 rounded-md overflow-hidden relative ${isDark ? 'bg-white/5' : 'bg-gray-100'}`}>
                                        <div className="h-full rounded-md transition-all duration-500" style={{
                                            width: `${Math.min(c.pctOfTarget, 100)}%`,
                                            backgroundColor: c.meetsTarget ? '#059669' : c.severity === 'critical' ? '#ef4444' : c.severity === 'moderate' ? '#f59e0b' : '#3b82f6',
                                        }} />
                                        <span className={`absolute inset-0 flex items-center px-1.5 text-[9px] font-bold ${c.pctOfTarget > 50 ? 'text-white' : (isDark ? 'text-gray-300' : 'text-gray-600')}`}>
                                            {c.pctOfTarget}%
                                        </span>
                                    </div>
                                </div>
                                <div className="w-28 text-right flex-shrink-0">
                                    {c.meetsTarget ? (
                                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${isDark ? 'bg-emerald-500/15 text-emerald-400' : 'bg-emerald-50 text-emerald-600'}`}>
                                            ✓ Met {c.surplus > 0 && `(+${c.surplus.toLocaleString()})`}
                                        </span>
                                    ) : (
                                        <span className={`text-[10px] font-bold ${c.severity === 'critical' ? 'text-[#EF4444]' : c.severity === 'moderate' ? 'text-[#F59E0B]' : 'text-[#22C55E]'}`}>
                                            +{c.gap.toLocaleString()} needed
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Country Comparison */}
                {compareCountries.length > 0 && (
                    <div className={`rounded-xl border overflow-hidden ${isDark
                        ? 'bg-white/[0.02] backdrop-blur-md border-white/10 shadow-xl'
                        : 'bg-white/80 backdrop-blur-md border-gray-100 shadow-sm'
                        }`}>
                        <div className="px-4 py-3 flex items-center justify-between border-b"
                            style={{ borderColor: isDark ? 'rgba(255,255,255,0.06)' : '#e5e7eb' }}>
                            <div className="flex items-center gap-2.5">
                                <BarChart3 size={16} className={isDark ? 'text-[#22C55E]' : 'text-blue-600'} />
                                <h3 className={`text-base font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                    Comparing {compareCountries.length} Countries
                                </h3>
                            </div>
                            <button onClick={() => compareList.forEach(n => toggleCompare(n))} className={`text-xs px-2 py-1 rounded-md transition-colors ${isDark ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}>
                                Clear all
                            </button>
                        </div>
                        <div className={`grid gap-3 p-4`} style={{ gridTemplateColumns: `repeat(${compareCountries.length}, 1fr)` }}>
                            {compareCountries.map(c => {
                                const mc = getMapColor(c.total_chws);
                                const gapInfo = gapCalcData.find((g: any) => String(g.id) === String(c.id));
                                return (
                                    <div key={c.id} className={`rounded-lg border p-3 ${isDark ? 'border-white/[0.6] bg-white/[0.02]' : 'border-gray-100 bg-gray-50/50'}`}>
                                        <div className="flex items-center justify-between mb-2">
                                            <h4 className={`text-xs font-bold ${isDark ? 'text-[#E8F5F1]' : 'text-gray-900'}`}>{c.country}</h4>
                                            <button onClick={() => toggleCompare(c.country)} className="text-gray-400 hover:text-red-400">
                                                <X size={12} />
                                            </button>
                                        </div>
                                        {[
                                            { l: 'Total CHWs', v: c.total_chws.toLocaleString(), color: '#22C55E' },
                                            { l: 'CHW/10k', v: Math.round(c.chws_per_10000), color: mc.bg },
                                            { l: 'Population', v: c.population_2024 > 0 ? (c.population_2024 / 1e6).toFixed(1) + 'M' : '—', color: '#22C55E' },
                                            { l: 'Gap', v: gapInfo?.meetsTarget ? 'Met ✓' : `+${gapInfo?.gap.toLocaleString() || '—'}`, color: gapInfo?.meetsTarget ? '#059669' : '#ef4444' },
                                        ].map(s => (
                                            <div key={s.l} className={`flex items-center justify-between py-1 border-b last:border-b-0 ${isDark ? 'border-white/[0.6]' : 'border-gray-100'}`}>
                                                <span className={`text-[10px] ${isDark ? 'text-[#A7C8BE]' : 'text-gray-500'}`}>{s.l}</span>
                                                <span className="text-xs font-bold" style={{ color: s.color }}>{s.v}</span>
                                            </div>
                                        ))}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* ═══════ Data Table ═══════ */}
            <div className={`rounded-xl border overflow-hidden ${isDark
                ? 'bg-transparent border-white/[0.6]'
                : 'bg-white/80 backdrop-blur-md border-gray-100 shadow-sm'
                }`}>
                <div className="px-5 py-3 flex items-center gap-3 border-b flex-wrap"
                    style={{ borderColor: isDark ? 'rgba(255,255,255,0.06)' : '#e5e7eb' }}>
                    <h3 className={`text-sm font-semibold ${isDark ? 'text-[#E8F5F1]' : 'text-gray-900'}`}>
                        All Countries
                    </h3>
                    <select
                        value={coverageFilter}
                        onChange={e => setCoverageFilter(e.target.value)}
                        className={`text-xs px-2 py-1.5 rounded-lg border outline-none ${isDark
                            ? 'bg-white/5 border-white/[0.6] text-[#E8F5F1]'
                            : 'bg-gray-50 border-gray-200 text-gray-700'
                            }`}
                    >
                        <option value="all">All Coverage Tiers</option>
                        <option value="high">High Coverage (≥ 20 per 10k)</option>
                        <option value="moderate">Moderate Coverage (10 – 20 per 10k)</option>
                        <option value="low">Low Coverage (1 – 10 per 10k)</option>
                        <option value="critical">Critical Gap (&lt; 1 per 10k)</option>
                    </select>
                    {compareList.length > 0 && (
                        <span className={`text-[10px] px-2 py-1 rounded-full ${isDark ? 'bg-[#22C55E]/15 text-[#22C55E]' : 'bg-blue-50 text-blue-600'}`}>
                            {compareList.length}/3 comparing
                        </span>
                    )}
                    <div className="flex-1" />
                    <div className="relative">
                        <Search size={16} className={`absolute left-3 top-1/2 -translate-y-1/2 ${isDark ? 'text-[#A8C4BB]' : 'text-gray-400'}`} />
                        <input
                            type="text"
                            placeholder="Search country…"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className={`pl-10 pr-4 py-2 rounded-lg text-sm border outline-none transition-colors ${isDark
                                ? 'bg-white/10 border-white/20 text-white placeholder:text-[#A8C4BB] focus:border-[#22C55E]/50'
                                : 'bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-blue-400'
                                }`}
                        />
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className={isDark ? 'bg-white/3' : 'bg-gray-50'}>
                                {[
                                    { key: 'compare', label: '⚖️', sortable: false },
                                    { key: 'country', label: 'Country', sortable: true },
                                    { key: 'total_chws', label: 'Total CHWs', sortable: true },
                                    { key: 'active_percentage', label: 'Active %', sortable: true },
                                    { key: 'population_2024', label: 'Population', sortable: true },
                                    { key: 'chws_per_10000', label: 'CHW/10k', sortable: true },
                                    { key: 'total_regions', label: 'Regions', sortable: true },
                                    { key: 'coverage', label: 'Coverage', sortable: false },
                                ].map(h => (
                                    <th
                                        key={h.key}
                                        className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider ${h.sortable ? 'cursor-pointer select-none hover:text-[#22C55E]' : ''
                                            } ${isDark ? 'text-[#A7C8BE]' : 'text-gray-500'}`}
                                        onClick={() => h.sortable && handleSort(h.key)}
                                    >
                                        <span className="inline-flex items-center gap-1">
                                            {h.label}
                                            {h.sortable && sortCol === h.key && (
                                                sortAsc ? <ChevronUp size={12} /> : <ChevronDown size={12} />
                                            )}
                                        </span>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className={`divide-y ${isDark ? 'divide-white/5' : 'divide-gray-100'}`}>
                            {tableSorted.map(c => {
                                const isCompared = compareList.includes(c.country);
                                const maxDensity = sorted[0]?.chws_per_10000 || 1;
                                const barPct = Math.round((c.chws_per_10000 / maxDensity) * 100);
                                return (
                                    <tr
                                        key={c.id}
                                        className={`transition-colors ${isCompared
                                            ? (isDark ? 'bg-[#22C55E]/5' : 'bg-blue-50/50')
                                            : ''
                                            } ${isDark ? 'hover:bg-white/3' : 'hover:bg-gray-50'}`}
                                    >
                                        <td className="px-4 py-3">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); toggleCompare(c.country); }}
                                                className={`w-5 h-5 rounded border-2 flex items-center justify-center text-xs transition-all ${isCompared
                                                    ? (isDark ? 'bg-[#22C55E] border-[#22C55E] text-white' : 'bg-blue-500 border-blue-500 text-white')
                                                    : (isDark ? 'border-white/20 hover:border-[#22C55E]/50' : 'border-gray-300 hover:border-blue-400')
                                                    }`}
                                            >
                                                {isCompared && '✓'}
                                            </button>
                                        </td>
                                        <td
                                            className={`px-4 py-3 font-medium cursor-pointer ${isDark ? 'text-[#E8F5F1] hover:text-[#22C55E]' : 'text-gray-900 hover:text-blue-600'}`}
                                            onClick={() => handleCountryClick(c.country)}
                                        >
                                            {c.country}
                                        </td>
                                        <td className={`px-4 py-3 font-semibold ${isDark ? 'text-[#22C55E]' : 'text-blue-600'}`}>{c.total_chws.toLocaleString()}</td>
                                        <td className={`px-4 py-3 ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>{c.active_percentage ? `${c.active_percentage.toFixed(1)}%` : '—'}</td>
                                        <td className={`px-4 py-3 ${isDark ? 'text-[#A7C8BE]' : 'text-gray-700'}`}>{c.population_2024 > 0 ? (c.population_2024 / 1_000_000).toFixed(1) + 'M' : '—'}</td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <span className={`font-bold min-w-[28px] ${isDark ? 'text-[#E8F5F1]' : 'text-gray-900'}`}>{Math.round(c.chws_per_10000)}</span>
                                                <div className={`flex-1 h-2 rounded-full overflow-hidden max-w-[60px] ${isDark ? 'bg-white/5' : 'bg-gray-100'}`}>
                                                    <div className="h-full rounded-full" style={{ width: `${barPct}%`, backgroundColor: getMapColor(c.total_chws).bg }} />
                                                </div>
                                            </div>
                                        </td>
                                        <td className={`px-4 py-3 ${isDark ? 'text-[#6FA39A]' : 'text-gray-500'}`}>{c.total_regions}</td>
                                        <td className="px-4 py-3">
                                            <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                                                style={{ backgroundColor: getMapColor(c.total_chws).bg + '20', color: getMapColor(c.total_chws).bg }}>
                                                {getMapColor(c.total_chws).label || '—'}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </>
    );
}
