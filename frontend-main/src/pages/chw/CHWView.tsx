import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    ScatterChart, Scatter, ZAxis, Cell, LabelList,
} from "recharts";
import {
    Activity, BarChart3, Send, Loader2, Map as MapIcon,
} from "lucide-react";
import ReactMarkdown from 'react-markdown';
import type { CHWSummary, CHWCountry, CHWCountryDetail } from "@/pages/chw/types/chw";
import { UnifiedArcGISMap } from "@/components/maps/UnifiedArcGISMap";
import CHWFieldReports from "./components/CHWFieldReports";
import { CHWFieldIntelligence } from "./components/CHWFieldIntelligence";
import { CoverageTier } from "./components/CoverageTier";
import { CountryDrawer } from "./components/CountryDrawer";
import { ChartCard, DensityTooltip, BubbleTooltip } from "./components/ChartComponents";
import { CHWHeader } from "./components/CHWHeader";
import { CHWKpiCards } from "./components/CHWKpiCards";
// NOTE: Commented out — worker type data not available in 2026 data. Uncomment when data is provided.
// import { CHWWorkerTypes } from "./components/CHWWorkerTypes";
import { CHWDataTable } from "./components/CHWDataTable";

interface LegendItem {
    label: string;
    bg: string;
    min: number;
    max: number;
}

interface CHWViewProps {
    isDark: boolean;
    summary: CHWSummary;
    selectedCountry: CHWCountryDetail | null;
    countryLoading: boolean;
    dynamicLegend: LegendItem[];
    legendLoading: boolean;
    sorted: CHWCountry[];
    tableSorted: CHWCountry[];
    filtered: CHWCountry[];
    totalChws: number;
    avgPer10k: number;
    wellCovered: number;
    criticalCount: number;
    workerTypeAgg: { name: string; value: number }[];
    totalWorkers: number;
    bubbleData: any[];
    countries: CHWCountry[];
    totalPop: number;
    searchTerm: string;
    setSearchTerm: (v: string) => void;
    coverageFilter: string;
    setCoverageFilter: (v: string) => void;
    sortCol: string;
    sortAsc: boolean;
    handleSort: (col: string) => void;
    compareList: string[];
    toggleCompare: (name: string) => void;
    compareCountries: CHWCountry[];
    gapCalcData: any[];
    benchmark: number;
    setBenchmark: (v: number) => void;
    countriesBelowBenchmark: number;
    totalGap: number;
    globalTopRegions: any[];
    handleCountryClick: (countryName: string) => void;
    getMapColor: (totalChws: number) => { bg: string; label?: string };
    aiQuery: string;
    setAiQuery: (v: string) => void;
    aiResponse: string;
    setAiResponse: (v: string) => void;
    aiLoading: boolean;
    askAiInline: (question: string) => void;
    askWhoAbout: (question: string) => void;
}

export default function CHWView({
    isDark,
    summary,
    selectedCountry,
    countryLoading,
    dynamicLegend,
    legendLoading,
    sorted,
    tableSorted,
    filtered,
    totalChws,
    avgPer10k,
    wellCovered,
    criticalCount,
    workerTypeAgg,
    totalWorkers,
    bubbleData,
    countries,
    totalPop,
    searchTerm,
    setSearchTerm,
    coverageFilter,
    setCoverageFilter,
    sortCol,
    sortAsc,
    handleSort,
    compareList,
    toggleCompare,
    compareCountries,
    gapCalcData,
    benchmark,
    setBenchmark,
    countriesBelowBenchmark,
    totalGap,
    globalTopRegions,
    handleCountryClick,
    getMapColor,
    aiQuery,
    setAiQuery,
    aiResponse,
    setAiResponse,
    aiLoading,
    askAiInline,
    askWhoAbout,
}: CHWViewProps) {
    return (
        <div className="min-h-screen">
            <div className="max-w-[1600px] mx-auto px-4 py-6 space-y-5">

                <CHWHeader
                    isDark={isDark}
                    selectedCountry={selectedCountry}
                    sorted={sorted}
                    handleCountryClick={handleCountryClick}
                    getMapColor={getMapColor}
                />

                <CHWKpiCards
                    isDark={isDark}
                    summary={summary}
                    totalChws={totalChws}
                    avgPer10k={avgPer10k}
                    wellCovered={wellCovered}
                    criticalCount={criticalCount}
                />

                <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                    <div className={`xl:col-span-2 rounded-xl border overflow-hidden transition-all
                                ${isDark
                            ? 'bg-white/[0.02] backdrop-blur-md border-white/10 shadow-xl'
                            : 'bg-white border-gray-100 shadow-sm'
                        }`}>
                        <div className="px-5 py-3 flex items-center justify-between border-b"
                            style={{ borderColor: isDark ? 'rgba(255,255,255,0.06)' : '#e5e7eb' }}>
                            <div className="flex items-center gap-2">
                                <MapIcon size={18} className={isDark ? 'text-[#22C55E]' : 'text-blue-600'} />
                                <h3 className={`text-base font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                    CHW Density by Country
                                </h3>
                                <span className={`text-sm ${isDark ? 'text-[#A8C4BB]' : 'text-gray-400'}`}>
                                    (per 10,000 population)
                                </span>
                            </div>
                            {selectedCountry && (
                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${isDark ? 'bg-[#22C55E]/15 text-[#22C55E]' : 'bg-blue-50 text-blue-600'}`}>
                                    {selectedCountry.country}
                                </span>
                            )}
                        </div>
                        <div className="relative h-[500px]" style={{ backgroundColor: isDark ? '#0B1F1A' : '#f8fafc' }}>
                            <UnifiedArcGISMap
                                mode="webmap"
                                webMapId="chw"
                                onCountryClick={(attrs: any) => handleCountryClick(attrs?.name || '')}
                                selectedCountryName={selectedCountry?.country || null}
                                isLight={!isDark}
                            />
                            <div className={`absolute bottom-4 left-4 rounded-lg p-4 text-sm z-10 ${isDark
                                ? 'bg-black/40 backdrop-blur-md border border-white/20 text-[#D1E5DE]'
                                : 'bg-white/95 border border-gray-200 text-gray-700 shadow-md'
                                }`}>
                                <div className={`font-bold mb-2.5 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                    CHW per 10k (Official)
                                </div>
                                {legendLoading ? (
                                    <div className="flex items-center gap-2 text-[#6FA39A] animate-pulse">
                                        <Loader2 className="animate-spin" size={12} />
                                        <span>Loading legend...</span>
                                    </div>
                                ) : dynamicLegend.length > 0 ? (
                                    dynamicLegend.map(d => (
                                        <div key={d.label} className="flex items-center gap-2.5 mb-1.5">
                                            <span className="w-5 h-4 rounded-sm inline-block" style={{ backgroundColor: d.bg }} />
                                            <span className="font-medium">{d.label}</span>
                                        </div>
                                    ))
                                ) : (
                                    <>
                                        {[
                                            { label: '0 - 50', bg: '#fee5d9' },
                                            { label: '> 50 - 150', bg: '#fcae91' },
                                            { label: '> 150 - 250', bg: '#fb6a4a' },
                                            { label: '> 250 - 500', bg: '#de2d26' },
                                            { label: '> 500', bg: '#a50f15' },
                                        ].map(d => (
                                            <div key={d.label} className="flex items-center gap-2.5 mb-1.5">
                                                <span className="w-5 h-4 rounded-sm inline-block" style={{ backgroundColor: d.bg }} />
                                                <span className="font-medium">{d.label}</span>
                                            </div>
                                        ))}
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* AI Panel */}
                    <div className={`rounded-xl border overflow-hidden max-h-[550px] flex flex-col ${isDark
                        ? 'bg-white/[0.02] backdrop-blur-md border-white/10 shadow-xl'
                        : 'bg-white/80 backdrop-blur-md border-gray-100 shadow-sm'
                        }`}>
                        <div className="px-5 py-3 border-b flex items-center gap-2"
                            style={{ borderColor: isDark ? 'rgba(255,255,255,0.06)' : '#e5e7eb' }}>
                            <img src="/assets/logo-chat.png" alt="" className="w-6 h-6 object-contain" />
                            <h3 className={`text-base font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                WHO AI Assistant
                            </h3>
                            {selectedCountry && (
                                <span className={`ml-auto text-[10px] px-2 py-0.5 rounded-full font-medium ${isDark ? 'bg-[#22C55E]/15 text-[#22C55E]' : 'bg-blue-50 text-blue-600'}`}>
                                    {selectedCountry.country}
                                </span>
                            )}
                        </div>
                        <div className={`flex-1 overflow-y-auto p-5 ${'bg-transparent'}`}>
                            {aiResponse ? (
                                <div className={`text-sm leading-relaxed max-w-none ${isDark ? 'text-white' : 'text-gray-700'}`}
                                    style={{ color: isDark ? '#FFFFFF' : undefined }}>
                                    <ReactMarkdown
                                        components={{
                                            p: ({ children }) => <p className={`mb-3 ${isDark ? 'text-white' : 'text-gray-700'}`}>{children}</p>,
                                            strong: ({ children }) => <strong className={`font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{children}</strong>,
                                            li: ({ children }) => <li className={`ml-5 list-disc mb-1.5 ${isDark ? 'text-[#D1E5DE]' : 'text-gray-600'}`}>{children}</li>,
                                            h1: ({ children }) => <h1 className={`text-base font-bold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>{children}</h1>,
                                            h2: ({ children }) => <h2 className={`text-base font-bold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>{children}</h2>,
                                            h3: ({ children }) => <h3 className={`text-sm font-bold mb-1.5 ${isDark ? 'text-white' : 'text-gray-900'}`}>{children}</h3>,
                                            ul: ({ children }) => <ul className="mb-3 space-y-1">{children}</ul>,
                                            ol: ({ children }) => <ol className="mb-3 space-y-1 list-decimal ml-5">{children}</ol>,
                                            code: ({ children }) => <code className={`px-1.5 py-1 rounded text-xs ${isDark ? 'bg-white/10 text-[#22C55E]' : 'bg-gray-100 text-gray-800'}`}>{children}</code>,
                                        }}
                                    >{aiResponse}</ReactMarkdown>
                                </div>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-center px-4">
                                    <div className={`p-3 rounded-xl mb-3 ${isDark ? 'bg-[rgba(34,197,94,0.12)]' : 'bg-blue-50'}`}>
                                        <img src="/assets/logo-chat.png" alt="Ask WHO" className="w-8 h-8 object-contain" />
                                    </div>
                                    <p className={`text-base font-bold mb-1.5 ${isDark ? 'text-white' : 'text-gray-900'}`}>Ask WHO AI</p>
                                    <p className={`text-sm mb-5 ${isDark ? 'text-[#A8C4BB]' : 'text-gray-400'}`}>
                                        {selectedCountry
                                            ? `Explore ${selectedCountry.country}'s workforce data`
                                            : 'Select a country or ask a general question'}
                                    </p>
                                    <div className="space-y-2 w-full">
                                        {[
                                            selectedCountry ? `What are the key CHW challenges in ${selectedCountry.country}?` : 'Which countries have the most critical gaps?',
                                            'Compare CHW density across the region',
                                            selectedCountry ? `How many more CHWs does ${selectedCountry.country} need?` : 'What is the regional average CHW density?',
                                        ].map((prompt, i) => (
                                            <button
                                                key={i}
                                                onClick={() => { setAiQuery(prompt); askAiInline(prompt); }}
                                                className={`w-full text-left text-xs p-3 rounded-lg border transition-all ${isDark
                                                    ? 'bg-white/5 border-white/20 text-[#D1E5DE] hover:border-[#22C55E]/30 hover:text-[#22C55E]'
                                                    : 'bg-white border-gray-100 text-gray-500 hover:border-blue-200 hover:text-blue-600'
                                                    }`}
                                            >
                                                {prompt}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {aiLoading && (
                                <div className="flex items-center gap-2 mt-3">
                                    <Loader2 size={12} className={`animate-spin ${isDark ? 'text-[#22C55E]' : 'text-blue-500'}`} />
                                    <span className={`text-[10px] ${isDark ? 'text-[#6FA39A]' : 'text-gray-400'}`}>Thinking…</span>
                                </div>
                            )}
                        </div>
                        <div className={`border-t px-4 py-3 ${isDark ? 'border-white/[0.6]' : 'border-gray-100'}`}>
                            {aiResponse && (
                                <button
                                    onClick={() => { setAiResponse(''); setAiQuery(''); }}
                                    className={`w-full text-[10px] mb-2 py-1 rounded-md transition-colors ${isDark
                                        ? 'text-[#6FA39A] hover:text-[#22C55E] hover:bg-white/5'
                                        : 'text-gray-400 hover:text-blue-600 hover:bg-blue-50'
                                        }`}
                                >
                                    ↻ New question
                                </button>
                            )}
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={aiQuery}
                                    onChange={e => setAiQuery(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && askAiInline(aiQuery)}
                                    placeholder={selectedCountry ? `Ask about ${selectedCountry.country}...` : 'Ask about CHW data...'}
                                    className={`flex-1 text-sm px-4 py-2.5 rounded-lg border outline-none transition-colors ${isDark
                                        ? 'bg-white/10 border-white/20 text-white placeholder-[#A8C4BB] focus:border-[#22C55E]/50'
                                        : 'bg-white/80 backdrop-blur-md border-gray-100 text-gray-900 placeholder-gray-400 focus:border-blue-300'
                                        }`}
                                />
                                <button
                                    onClick={() => askAiInline(aiQuery)}
                                    disabled={aiLoading || !aiQuery.trim()}
                                    className={`p-2 rounded-lg transition-all ${aiLoading || !aiQuery.trim()
                                        ? (isDark ? 'bg-white/5 text-[#6FA39A]' : 'bg-gray-100 text-gray-300')
                                        : (isDark ? 'bg-[#22C55E]/20 text-[#22C55E] hover:bg-[#22C55E]/30' : 'bg-blue-100 text-blue-600 hover:bg-blue-200')
                                        }`}
                                >
                                    {aiLoading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mt-4">
                    <CHWFieldIntelligence isDark={isDark} />
                </div>

                <div className="mt-4">
                    <CHWFieldReports />
                </div>

                {/* ── Country Navigator + Profile ── */}
                <div className="grid grid-cols-1 xl:grid-cols-5 gap-4 xl:h-[calc(100vh-180px)] xl:max-h-[900px] xl:min-h-[650px] h-auto">

                    {/* Left: compact navigator — 2/5 width */}
                    <div className={`xl:col-span-2 rounded-2xl border overflow-hidden flex flex-col xl:h-full h-[480px] ${isDark
                        ? 'bg-white/[0.025] backdrop-blur-md border-white/[0.08] shadow-xl'
                        : 'bg-white/80 backdrop-blur-md border-gray-100 shadow-sm'
                        }`}>
                        <div className="px-4 py-3 flex items-center justify-between border-b flex-shrink-0"
                            style={{ borderColor: isDark ? 'rgba(255,255,255,0.06)' : '#e5e7eb' }}>
                            <h3 className={`text-sm font-bold tracking-wide ${isDark ? 'text-white' : 'text-gray-900'}`}>All Countries</h3>
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${isDark ? 'bg-white/[0.06] text-[#6FA39A]' : 'bg-gray-100 text-gray-400'}`}>
                                {sorted.length}
                            </span>
                        </div>
                        <div className="p-3 space-y-2 overflow-y-auto flex-1">
                            {[
                                { label: 'High Coverage', desc: '≥ 20 per 10k', min: 20, max: Infinity, color: '#10b981' },
                                { label: 'Moderate Coverage', desc: '10 – 20 per 10k', min: 10, max: 20, color: '#f59e0b' },
                                { label: 'Low Coverage', desc: '1 – 10 per 10k', min: 1, max: 10, color: '#f97316' },
                                { label: 'Critical Gap', desc: '< 1 per 10k', min: 0, max: 1, color: '#ef4444' },
                            ].map((tier, idx) => (
                                <CoverageTier
                                    key={tier.label}
                                    label={tier.label}
                                    desc={tier.desc}
                                    countries={sorted.filter(c => {
                                        const d = c.chws_per_10000;
                                        if (tier.max === Infinity) return d >= tier.min;
                                        return d >= tier.min && d < tier.max;
                                    })}
                                    color={tier.color}
                                    isDark={isDark}
                                    onSelectCountry={handleCountryClick}
                                    selectedCountry={selectedCountry?.country}
                                    defaultOpen={idx === 2}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Right: immersive country profile — 3/5 width */}
                    <div className="xl:col-span-3 relative xl:h-full min-h-[600px]">
                        {countryLoading && (
                            <div className="absolute inset-0 z-50 flex items-center justify-center rounded-2xl backdrop-blur-sm"
                                style={{ backgroundColor: isDark ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.4)' }}>
                                <div className={`text-center px-8 py-6 rounded-xl shadow-2xl ${isDark ? 'bg-[#0c1f1a] border border-white/10' : 'bg-white border border-gray-100'}`}>
                                    <Loader2 size={32} className={`mx-auto mb-3 animate-spin ${isDark ? 'text-[#22C55E]' : 'text-blue-500'}`} />
                                    <p className={`text-sm font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Loading profile…</p>
                                </div>
                            </div>
                        )}
                        {selectedCountry ? (
                            <CountryDrawer country={selectedCountry} isDark={isDark} getMapColor={getMapColor} />
                        ) : (
                            <CountryDrawer isDark={isDark} getMapColor={getMapColor} globalTopRegions={globalTopRegions} isGlobal={true} />
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mt-4">
                    <ChartCard title="CHW Density Ranking" subtitle="CHW per 10,000 population" icon={BarChart3} isDark={isDark}>
                        <ResponsiveContainer width="100%" height={350}>
                            <BarChart
                                data={sorted.filter(c => c.chws_per_10000 > 0).map(c => ({ ...c, chws_per_10000: Math.round(c.chws_per_10000) }))}
                                layout="vertical"
                                margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? 'rgba(255,255,255,0.04)' : '#f0f0f0'} />
                                <XAxis type="number" tick={{ fill: isDark ? '#A8C4BB' : '#6b7280', fontSize: 13 }} />
                                <YAxis type="category" dataKey="country" width={150} tick={{ fill: isDark ? '#D1E5DE' : '#374151', fontSize: 13 }} />
                                <Tooltip content={<DensityTooltip isDark={isDark} getMapColor={getMapColor} />} />
                                <Bar dataKey="chws_per_10000" radius={[0, 4, 4, 0]} maxBarSize={22}>
                                    {sorted.filter(c => c.chws_per_10000 > 0).map((c, i) => (
                                        <Cell key={i} fill={getMapColor(c.total_chws).bg} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </ChartCard>

                    <ChartCard title="Population vs CHW Density" subtitle="Bubble size = total CHW workforce" icon={Activity} isDark={isDark}>
                        <ResponsiveContainer width="100%" height={350}>
                            <ScatterChart margin={{ top: 10, right: 20, bottom: 30, left: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? 'rgba(255,255,255,0.04)' : '#f0f0f0'} />
                                <XAxis
                                    type="number" dataKey="population" name="Population"
                                    tick={{ fill: isDark ? '#A8C4BB' : '#6b7280', fontSize: 12 }}
                                    tickFormatter={(v: number) => v >= 1_000_000 ? `${(v / 1_000_000).toFixed(0)}M` : `${(v / 1_000).toFixed(0)}K`}
                                    label={{ value: 'Population', position: 'bottom', offset: 10, fill: isDark ? '#D1E5DE' : '#9ca3af', fontSize: 13, fontWeight: 600 }}
                                />
                                <YAxis
                                    type="number" dataKey="density" name="CHW/10k"
                                    tick={{ fill: isDark ? '#A8C4BB' : '#6b7280', fontSize: 12 }}
                                    label={{ value: 'CHW per 10k', angle: -90, position: 'insideLeft', fill: isDark ? '#D1E5DE' : '#9ca3af', fontSize: 13, fontWeight: 600 }}
                                />
                                <ZAxis type="number" dataKey="z" range={[60, 600]} />
                                <Tooltip content={<BubbleTooltip isDark={isDark} getMapColor={getMapColor} />} />
                                <Scatter data={bubbleData} fill="#06b6d4">
                                    {bubbleData.map((item, i) => (
                                        <Cell key={i} fill={getMapColor(item.totalChws).bg} fillOpacity={0.7} stroke={getMapColor(item.totalChws).bg} strokeWidth={1} />
                                    ))}
                                    <LabelList dataKey="country" position="top" style={{ fill: isDark ? '#D1E5DE' : '#374151', fontSize: 12, fontWeight: 700 }} />
                                </Scatter>
                            </ScatterChart>
                        </ResponsiveContainer>
                    </ChartCard>
                </div>

                {/* 
                  NOTE: Worker type breakdown data is not available as per new 2026 CHW data.
                  When client provides worker type data, uncomment this component.
                  
                <CHWWorkerTypes
                    isDark={isDark}
                    workerTypeAgg={workerTypeAgg}
                    totalWorkers={totalWorkers}
                    sorted={sorted}
                    countries={countries}
                    totalChws={totalChws}
                    totalPop={totalPop}
                    avgPer10k={avgPer10k}
                    askWhoAbout={askWhoAbout}
                />
                */}

                <CHWDataTable
                    isDark={isDark}
                    sorted={sorted}
                    tableSorted={tableSorted}
                    searchTerm={searchTerm}
                    setSearchTerm={setSearchTerm}
                    coverageFilter={coverageFilter}
                    setCoverageFilter={setCoverageFilter}
                    sortCol={sortCol}
                    sortAsc={sortAsc}
                    handleSort={handleSort}
                    compareList={compareList}
                    toggleCompare={toggleCompare}
                    handleCountryClick={handleCountryClick}
                    getMapColor={getMapColor}
                    compareCountries={compareCountries}
                    gapCalcData={gapCalcData as any}
                    benchmark={benchmark}
                    setBenchmark={setBenchmark}
                    countriesBelowBenchmark={countriesBelowBenchmark}
                    totalGap={totalGap}
                />


            </div>
        </div>
    );
}
