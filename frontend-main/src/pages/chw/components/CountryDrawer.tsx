import { useState, useMemo } from "react";
import type { CHWCountryDetail } from "@/pages/chw/types/chw";
import { Users, Activity, Heart, Banknote, Globe, Building2, TrendingUp, TrendingDown, CheckCircle2, Zap, Database, Download, Loader2 } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import Papa from "papaparse";
import { saveAs } from "file-saver";

interface CountryDrawerProps {
    country?: CHWCountryDetail;
    isDark: boolean;
    onClose?: () => void;
    getMapColor?: (n: number) => { bg: string; label?: string };
    globalTopRegions?: { region: string; chws: number; country: string; percentage: number }[];
    isGlobal?: boolean;
}

const COVERAGE = (density: number) => {
    if (density >= 20) return { color: '#22C55E', bg: 'rgba(34,197,94,0.15)', label: 'High Coverage', icon: TrendingUp };
    if (density >= 10) return { color: '#f59e0b', bg: 'rgba(245,158,11,0.15)', label: 'Moderate', icon: TrendingUp };
    if (density >= 1)  return { color: '#f97316', bg: 'rgba(249,115,22,0.15)', label: 'Low Coverage', icon: TrendingDown };
    return { color: '#ef4444', bg: 'rgba(239,68,68,0.15)', label: 'Critical Gap', icon: TrendingDown };
};

/* ─── SVG Arc Gauge ─── */
function ArcGauge({ pct, color, isDark }: { pct: number; color: string; isDark: boolean }) {
    const r = 34;
    const cx = 44;
    const cy = 44;
    const startAngle = -210;
    const sweepAngle = 240;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const arcPath = (angle: number) => {
        const end = startAngle + angle;
        const x = cx + r * Math.cos(toRad(end));
        const y = cy + r * Math.sin(toRad(end));
        const large = angle > 180 ? 1 : 0;
        const sx = cx + r * Math.cos(toRad(startAngle));
        const sy = cy + r * Math.sin(toRad(startAngle));
        return `M ${sx} ${sy} A ${r} ${r} 0 ${large} 1 ${x} ${y}`;
    };
    const filled = (pct / 100) * sweepAngle;
    return (
        <svg width="88" height="88" viewBox="0 0 88 88">
            <path d={arcPath(sweepAngle)} fill="none" stroke={isDark ? 'rgba(255,255,255,0.06)' : '#e5e7eb'} strokeWidth="7" strokeLinecap="round" />
            <path d={arcPath(Math.max(filled, 0.01))} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round"
                style={{ transition: 'stroke-dasharray 1s ease, stroke-dashoffset 1s ease' }} />
            <text x={cx} y={cy + 5} textAnchor="middle" fontSize="13" fontWeight="800" fill={color}>{pct}%</text>
            <text x={cx} y={cy + 18} textAnchor="middle" fontSize="7" fill={isDark ? '#6FA39A' : '#9ca3af'} letterSpacing="0.5">ACTIVE</text>
        </svg>
    );
}

/* ─── Big Stat Atom ─── */
function StatAtom({ label, value, sub, color, icon: Icon, isDark, missing }: {
    label: string; value: string; sub?: string; color: string; icon: any; isDark: boolean; missing?: boolean;
}) {
    return (
        <div className={`flex flex-col gap-1 px-4 py-3 rounded-2xl border transition-all
            ${isDark ? 'bg-white/[0.03] border-white/[0.06]' : 'bg-white border-gray-100'}
            ${missing ? 'opacity-35' : ''}`}>
            <div className="flex items-center gap-2 mb-1">
                <div className={`p-1.5 rounded-lg ${isDark ? 'bg-white/5' : 'bg-gray-50'}`}>
                    <Icon size={14} style={{ color: missing ? (isDark ? '#444' : '#bbb') : color }} />
                </div>
                <span className={`text-[10px] font-bold uppercase tracking-wider ${missing ? (isDark ? 'text-gray-600' : 'text-gray-400') : (isDark ? 'text-[#A8C4BB]' : 'text-gray-500')}`}>{label}</span>
            </div>
            <span className={`text-xl font-black tabular-nums leading-none mt-1 ${missing ? (isDark ? 'text-gray-700' : 'text-gray-300') : (isDark ? 'text-white' : 'text-gray-900')}`}>
                {missing ? '—' : value}
            </span>
            {sub && !missing && (
                <span className={`text-[10px] mt-1 font-medium ${isDark ? 'text-[#6FA39A]' : 'text-gray-400'}`}>{sub}</span>
            )}
        </div>
    );
}

/* ─── Ratio Bar (Volunteer vs Paid) ─── */
function RatioBar({ a, b, labelA, labelB, colorA, colorB, isDark }: {
    a: number; b: number; labelA: string; labelB: string; colorA: string; colorB: string; isDark: boolean;
}) {
    const total = a + b;
    if (total === 0) return null;
    const pctA = Math.round((a / total) * 100);
    const pctB = 100 - pctA;
    return (
        <div className={`px-4 py-3 rounded-2xl border ${isDark ? 'bg-white/[0.03] border-white/[0.07]' : 'bg-white border-gray-100'}`}>
            <div className="flex justify-between items-center mb-2">
                <span className={`text-[9px] font-bold uppercase tracking-widest ${isDark ? 'text-[#6FA39A]' : 'text-gray-400'}`}>CHW Employment Mix</span>
            </div>
            <div className="flex h-2.5 rounded-full overflow-hidden gap-px">
                <div className="h-full rounded-l-full transition-all duration-700" style={{ width: `${pctA}%`, background: colorA }} />
                <div className="h-full rounded-r-full transition-all duration-700" style={{ width: `${pctB}%`, background: colorB }} />
            </div>
            <div className="flex justify-between mt-2">
                <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full" style={{ background: colorA }} />
                    <span className={`text-[10px] font-semibold ${isDark ? 'text-[#A8C4BB]' : 'text-gray-500'}`}>{labelA}</span>
                    <span className="text-[10px] font-black tabular-nums" style={{ color: colorA }}>{pctA}%</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <span className={`text-[10px] font-black tabular-nums`} style={{ color: colorB }}>{pctB}%</span>
                    <span className={`text-[10px] font-semibold ${isDark ? 'text-[#A8C4BB]' : 'text-gray-500'}`}>{labelB}</span>
                    <span className="w-2 h-2 rounded-full" style={{ background: colorB }} />
                </div>
            </div>
        </div>
    );
}

/* ─── Region Row ─── */
function RegionRow({ region, maxChws, isDark }: {
    region: { id: number; region_name: string; total_chws: number; active_percentage?: number | null };
    maxChws: number;
    isDark: boolean;
}) {
    const pct = maxChws > 0 ? Math.round((region.total_chws / maxChws) * 100) : 0;
    const color = pct >= 70 ? '#22C55E' : pct >= 40 ? '#f59e0b' : '#f97316';
    return (
        <div className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-colors
            ${isDark ? 'hover:bg-white/[0.04]' : 'hover:bg-gray-50'}`}>
            <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                    <span className={`text-xs font-semibold truncate mr-2 ${isDark ? 'text-[#D1E5DE]' : 'text-gray-700'}`}>{region.region_name}</span>
                    <span className="text-xs font-black tabular-nums flex-shrink-0" style={{ color }}>{region.total_chws > 0 ? region.total_chws.toLocaleString() : '—'}</span>
                </div>
                <div className={`h-1 rounded-full overflow-hidden ${isDark ? 'bg-white/[0.06]' : 'bg-gray-100'}`}>
                    <div className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${Math.max(pct, region.total_chws > 0 ? 2 : 0)}%`, background: color }} />
                </div>
            </div>
        </div>
    );
}

/* ─── Global placeholder ─── */
function GlobalView({ isDark, globalTopRegions }: { isDark: boolean; globalTopRegions?: CountryDrawerProps['globalTopRegions'] }) {
    return (
        <div className="h-full flex flex-col items-center justify-center px-6 py-10 text-center">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 ${isDark ? 'bg-white/[0.04] border border-white/[0.08]' : 'bg-gray-50 border border-gray-100'}`}>
                <Globe size={26} className={isDark ? 'text-[#22C55E]/60' : 'text-blue-300'} />
            </div>
            <p className={`text-sm font-bold mb-1 ${isDark ? 'text-white' : 'text-gray-800'}`}>Select a Country</p>
            <p className={`text-xs leading-relaxed max-w-[200px] ${isDark ? 'text-[#5a8a80]' : 'text-gray-400'}`}>
                Click any country in the list or on the map to view its detailed CHW workforce profile.
            </p>
            {globalTopRegions && globalTopRegions.length > 0 && (
                <div className="mt-6 w-full space-y-1.5">
                    <p className={`text-[9px] font-bold uppercase tracking-widest mb-2 ${isDark ? 'text-[#4a7a70]' : 'text-gray-300'}`}>Top Regions</p>
                    {globalTopRegions.slice(0, 5).map((r, i) => (
                        <div key={i} className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-left
                            ${isDark ? 'bg-white/[0.02] border border-white/[0.05]' : 'bg-gray-50 border border-gray-100'}`}>
                            <span className={`text-[9px] font-black w-4 text-center ${isDark ? 'text-[#22C55E]/50' : 'text-blue-300'}`}>{i + 1}</span>
                            <div className="flex-1 min-w-0">
                                <p className={`text-[11px] font-semibold truncate ${isDark ? 'text-[#A8C4BB]' : 'text-gray-600'}`}>{r.region}</p>
                                <p className={`text-[9px] ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>{r.country}</p>
                            </div>
                            <span className={`text-[11px] font-black tabular-nums ${isDark ? 'text-[#22C55E]/60' : 'text-blue-400'}`}>{r.percentage.toFixed(1)}%</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

/* ─── Country Profile ─── */
/* ─── Custom Tooltip for Charts ─── */
const ChartTooltip = ({ active, payload, isDark }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className={`px-3 py-2 rounded-lg border text-xs shadow-xl ${isDark ? 'bg-[#0c1f1a] border-white/10 text-white' : 'bg-white border-gray-200 text-gray-900'}`}>
                <p className="font-bold mb-1">{payload[0].payload.name}</p>
                <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: payload[0].payload.fill || payload[0].color }} />
                    <span>{payload[0].value.toLocaleString()} {payload[0].dataKey === 'value' ? 'workers' : 'CHWs'}</span>
                </div>
            </div>
        );
    }
    return null;
};

/* ─── Country Profile ─── */
function CountryProfile({ country, isDark, getMapColor }: {
    country: CHWCountryDetail; isDark: boolean; getMapColor?: CountryDrawerProps['getMapColor'];
}) {
    const [activeTab, setActiveTab] = useState<'overview' | 'regions'>('overview');
    const [isExporting, setIsExporting] = useState(false);
    
    const density = Math.round(country.chws_per_10000 || 0);
    const tier = COVERAGE(density);
    const TierIcon = tier.icon;

    const activePercent = country.total_chws > 0 && country.active_chws
        ? Math.round((country.active_chws / country.total_chws) * 100)
        : null;

    const activeColor = activePercent != null
        ? activePercent >= 70 ? '#22C55E' : activePercent >= 50 ? '#f59e0b' : '#ef4444'
        : '#6b7280';

    const hasRegions = country.regions && country.regions.length > 0;
    const sortedRegions = hasRegions
        ? [...country.regions].sort((a, b) => b.total_chws - a.total_chws)
        : [];
    const maxRegionChws = sortedRegions.length > 0 ? Math.max(...sortedRegions.map(r => r.total_chws), 1) : 1;

    const volCount = country.volunteer_chws || 0;
    const paidCount = country.paid_chws || 0;
    const hasVolPaid = volCount + paidCount > 0;
    const volPct = hasVolPaid ? Math.round((volCount / (volCount + paidCount)) * 100) : 0;
    const paidPct = hasVolPaid ? Math.round((paidCount / (volCount + paidCount)) * 100) : 0;

    const cadreData = useMemo(() => [
        { name: 'Volunteer', value: volCount, fill: '#f59e0b' },
        { name: 'Paid', value: paidCount, fill: '#8b5cf6' }
    ].filter(d => d.value > 0), [volCount, paidCount]);

    const regionChartData = useMemo(() => {
        return sortedRegions.slice(0, 5).map(r => ({
            name: r.region_name,
            total: r.total_chws,
        }));
    }, [sortedRegions]);

    const handleExport = async () => {
        if (isExporting) return;
        try {
            setIsExporting(true);
            
            // Generate clean CSV data
            const countryData = [
                {
                    "Country": country.country,
                    "ISO Code": country.iso_code,
                    "Total CHWs": country.total_chws,
                    "Active CHWs": country.active_chws || 0,
                    "Volunteer CHWs": country.volunteer_chws || 0,
                    "Paid CHWs": country.paid_chws || 0,
                    "Population": country.population_2024,
                    "CHW Density (per 10k)": Math.round(country.chws_per_10000),
                    "Total Regions": country.total_regions,
                    "Total Facilities": country.total_facilities || 0
                }
            ];

            const regionData = sortedRegions.map(r => ({
                "Region Name": r.region_name,
                "Total CHWs": r.total_chws,
                "Active CHWs": r.active_chws || 0,
                "Volunteer CHWs": r.volunteer_chws || 0,
                "Paid CHWs": r.paid_chws || 0,
                "Active Percentage": r.active_percentage ? `${Math.round(r.active_percentage)}%` : 'N/A'
            }));

            // Create CSV strings
            const countryCsv = Papa.unparse(countryData);
            const regionCsv = regionData.length > 0 ? '\n\nRegional Breakdown\n' + Papa.unparse(regionData) : '';
            
            const finalCsv = `CHW Profile Data: ${country.country}\n\n${countryCsv}${regionCsv}`;
            
            // Trigger download
            const blob = new Blob([finalCsv], { type: "text/csv;charset=utf-8" });
            saveAs(blob, `${country.country.replace(/\s+/g, '_')}_CHW_Data.csv`);
            
            // Small delay to show success state before resetting
            await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
            console.error("Export failed:", error);
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <div className="h-full flex flex-col overflow-hidden bg-inherit">
            {/* ── Hero Header ── */}
            <div className={`px-6 pt-6 pb-0 border-b flex-shrink-0 ${isDark ? 'border-white/[0.06]' : 'border-gray-100'}`}>
                <div className="flex items-start justify-between gap-4 mb-5">
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-3 mb-1">
                            <h2 className={`text-2xl font-black leading-tight truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>{country.country}</h2>
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold"
                                style={{ backgroundColor: tier.bg, color: tier.color }}>
                                <TierIcon size={12} />
                                {tier.label}
                            </div>
                        </div>
                        <p className={`text-xs font-medium ${isDark ? 'text-[#6FA39A]' : 'text-gray-500'}`}>{country.iso_code} · 2026 CHW Data</p>
                    </div>
                    {/* Big density number */}
                    <div className="flex-shrink-0 text-right flex items-center gap-4">
                        <div className="text-right">
                            <p className="text-3xl font-black tabular-nums leading-none" style={{ color: tier.color }}>{density}</p>
                            <p className={`text-[10px] font-bold uppercase tracking-wider mt-1.5 ${isDark ? 'text-[#6FA39A]' : 'text-gray-400'}`}>per 10,000</p>
                        </div>
                        <button 
                            onClick={handleExport}
                            disabled={isExporting}
                            className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                                isDark ? 'bg-white/5 border-white/10 text-white hover:bg-white/10' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                        }`}>
                            {isExporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} 
                            {isExporting ? 'Exporting...' : 'Report'}
                        </button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex items-center gap-6">
                    <button 
                        onClick={() => setActiveTab('overview')}
                        className={`pb-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'overview' ? (isDark ? 'border-[#22C55E] text-[#22C55E]' : 'border-blue-600 text-blue-600') : (isDark ? 'border-transparent text-[#A8C4BB] hover:text-white' : 'border-transparent text-gray-500 hover:text-gray-900')}`}
                    >
                        Overview
                    </button>
                    <button 
                        onClick={() => setActiveTab('regions')}
                        className={`pb-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'regions' ? (isDark ? 'border-[#22C55E] text-[#22C55E]' : 'border-blue-600 text-blue-600') : (isDark ? 'border-transparent text-[#A8C4BB] hover:text-white' : 'border-transparent text-gray-500 hover:text-gray-900')}`}
                    >
                        Regions
                    </button>
                    <button className={`pb-3 text-sm font-bold border-b-2 border-transparent transition-colors opacity-50 cursor-not-allowed ${isDark ? 'text-[#A8C4BB]' : 'text-gray-500'}`}>Facilities</button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
                {activeTab === 'overview' ? (
                    <div className="space-y-4">
                        {/* ── Core Stats ── */}
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                            <StatAtom label="Total CHWs" value={country.total_chws.toLocaleString()} sub="Total workforce" icon={Users} color="#22C55E" isDark={isDark} />
                            <StatAtom label="Active" value={country.active_chws ? country.active_chws.toLocaleString() : ''} sub="Currently active" icon={Activity} color="#3b82f6" isDark={isDark} missing={!country.active_chws} />
                            <StatAtom label="Volunteer" value={country.volunteer_chws ? country.volunteer_chws.toLocaleString() : ''} sub={hasVolPaid ? `${volPct}% of total` : undefined} icon={Heart} color="#f59e0b" isDark={isDark} missing={!country.volunteer_chws} />
                            <StatAtom label="Paid" value={country.paid_chws ? country.paid_chws.toLocaleString() : ''} sub={hasVolPaid ? `${paidPct}% of total` : undefined} icon={Banknote} color="#8b5cf6" isDark={isDark} missing={!country.paid_chws} />
                            
                            <div className={`flex flex-col gap-1 px-4 py-3 rounded-2xl border ${isDark ? 'bg-white/[0.03] border-white/[0.06]' : 'bg-white border-gray-100'}`}>
                                <div className="flex items-center gap-2 mb-1">
                                    <div className={`p-1.5 rounded-lg ${isDark ? 'bg-white/5' : 'bg-gray-50'}`}>
                                        <CheckCircle2 size={14} style={{ color: activeColor }} />
                                    </div>
                                    <span className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? 'text-[#A8C4BB]' : 'text-gray-500'}`}>Active Rate</span>
                                </div>
                                <span className={`text-xl font-black tabular-nums leading-none mt-1`} style={{ color: activeColor }}>
                                    {activePercent != null ? `${activePercent}%` : 'N/A'}
                                </span>
                                <span className={`text-[10px] mt-1 font-medium ${isDark ? 'text-[#6FA39A]' : 'text-gray-400'}`}>Workforce active</span>
                            </div>
                        </div>

                        {/* ── Middle Row: Population & Composition ── */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Population Coverage */}
                            <div className={`p-5 rounded-2xl border ${isDark ? 'bg-white/[0.03] border-white/[0.06]' : 'bg-white border-gray-100'}`}>
                                <div className="flex justify-between items-start mb-6">
                                    <h4 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Population Coverage</h4>
                                    <div className="text-right">
                                        <p className={`text-xl font-black ${isDark ? 'text-[#2EC4B6]' : 'text-teal-600'}`}>
                                            {country.population_2024 > 0 ? (country.population_2024 / 1_000_000).toFixed(1) + 'M' : 'N/A'}
                                        </p>
                                        <p className={`text-[10px] font-medium mt-0.5 ${isDark ? 'text-[#6FA39A]' : 'text-gray-500'}`}>People covered</p>
                                    </div>
                                </div>
                                
                                <div className="relative pt-2 pb-6">
                                    <div className={`h-3 rounded-full overflow-hidden ${isDark ? 'bg-white/[0.08]' : 'bg-gray-100'}`}>
                                        <div className="h-full rounded-full transition-all duration-700" style={{ width: `100%`, backgroundColor: isDark ? '#2EC4B6' : '#0d9488' }} />
                                    </div>
                                    <div className="flex justify-between mt-2">
                                        <span className={`text-[10px] font-bold ${isDark ? 'text-[#2EC4B6]' : 'text-teal-600'}`}>
                                            {country.population_2024 > 0 ? (country.population_2024 / 1_000_000).toFixed(1) + 'M' : '0'}
                                        </span>
                                        <span className={`text-[10px] font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>100%</span>
                                    </div>
                                    <p className={`text-[10px] mt-1 ${isDark ? 'text-[#6FA39A]' : 'text-gray-500'}`}>Target population coverage</p>
                                </div>
                            </div>

                            {/* Cadre Composition Donut */}
                            <div className={`p-5 rounded-2xl border ${isDark ? 'bg-white/[0.03] border-white/[0.06]' : 'bg-white border-gray-100'}`}>
                                <h4 className={`text-sm font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>Cadre Composition</h4>
                                <div className="flex items-center gap-4 h-[120px]">
                                    <div className="flex-shrink-0 w-[120px] h-[120px] relative">
                                        {hasVolPaid ? (
                                            <ResponsiveContainer width="100%" height="100%">
                                                <PieChart>
                                                    <Pie
                                                        data={cadreData}
                                                        cx="50%" cy="50%"
                                                        innerRadius={40} outerRadius={55}
                                                        paddingAngle={2}
                                                        dataKey="value"
                                                        stroke="none"
                                                    >
                                                        {cadreData.map((entry, index) => (
                                                            <Cell key={`cell-${index}`} fill={entry.fill} />
                                                        ))}
                                                    </Pie>
                                                    <RechartsTooltip content={<ChartTooltip isDark={isDark} />} />
                                                </PieChart>
                                            </ResponsiveContainer>
                                        ) : (
                                            <div className={`w-full h-full rounded-full border-4 flex items-center justify-center ${isDark ? 'border-white/10' : 'border-gray-100'}`}>
                                                <span className={`text-[10px] ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>No Data</span>
                                            </div>
                                        )}
                                        {/* Center Text */}
                                        {hasVolPaid && (
                                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                                <span className={`text-sm font-black leading-none ${isDark ? 'text-white' : 'text-gray-900'}`}>{country.total_chws >= 1000 ? (country.total_chws/1000).toFixed(1)+'k' : country.total_chws}</span>
                                                <span className={`text-[9px] font-medium mt-0.5 ${isDark ? 'text-[#6FA39A]' : 'text-gray-500'}`}>Total</span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1 space-y-3">
                                        {cadreData.map(d => (
                                            <div key={d.name} className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: d.fill }} />
                                                    <span className={`text-xs font-semibold ${isDark ? 'text-[#D1E5DE]' : 'text-gray-700'}`}>{d.name}</span>
                                                </div>
                                                <div className="text-right">
                                                    <span className={`text-xs font-black tabular-nums block ${isDark ? 'text-white' : 'text-gray-900'}`}>{d.value.toLocaleString()}</span>
                                                    <span className={`text-[9px] ${isDark ? 'text-[#6FA39A]' : 'text-gray-500'}`}>
                                                        {Math.round((d.value / (volCount + paidCount)) * 100)}%
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* ── Bottom Row: Insights & Regional Distribution ── */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Key Insights */}
                            <div className={`p-5 rounded-2xl border flex flex-col ${isDark ? 'bg-white/[0.03] border-white/[0.06]' : 'bg-white border-gray-100'}`}>
                                <h4 className={`text-sm font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>Key Insights</h4>
                                <div className="space-y-4 flex-1">
                                    <div className="flex gap-3">
                                        <div className={`mt-0.5 p-1 rounded-full bg-opacity-20 flex-shrink-0 h-fit ${isDark ? 'bg-[#22C55E] text-[#22C55E]' : 'bg-green-100 text-green-600'}`}>
                                            <CheckCircle2 size={12} />
                                        </div>
                                        <div>
                                            <p className={`text-xs font-bold ${isDark ? 'text-[#22C55E]' : 'text-green-700'}`}>{tier.label}</p>
                                            <p className={`text-[11px] mt-0.5 leading-snug ${isDark ? 'text-[#A8C4BB]' : 'text-gray-600'}`}>
                                                {country.country} has {tier.label.toLowerCase()} at {density} per 10,000 population.
                                            </p>
                                        </div>
                                    </div>
                                    {hasVolPaid && volPct > 80 && (
                                        <div className="flex gap-3">
                                            <div className={`mt-0.5 p-1 rounded-full bg-opacity-20 flex-shrink-0 h-fit ${isDark ? 'bg-[#f59e0b] text-[#f59e0b]' : 'bg-amber-100 text-amber-600'}`}>
                                                <Users size={12} />
                                            </div>
                                            <div>
                                                <p className={`text-xs font-bold ${isDark ? 'text-[#f59e0b]' : 'text-amber-700'}`}>Strong Volunteer Base</p>
                                                <p className={`text-[11px] mt-0.5 leading-snug ${isDark ? 'text-[#A8C4BB]' : 'text-gray-600'}`}>
                                                    {volPct}% of the workforce are volunteers.
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                    {activePercent !== null && activePercent > 90 && (
                                        <div className="flex gap-3">
                                            <div className={`mt-0.5 p-1 rounded-full bg-opacity-20 flex-shrink-0 h-fit ${isDark ? 'bg-[#3b82f6] text-[#3b82f6]' : 'bg-blue-100 text-blue-600'}`}>
                                                <Zap size={12} />
                                            </div>
                                            <div>
                                                <p className={`text-xs font-bold ${isDark ? 'text-[#3b82f6]' : 'text-blue-700'}`}>High Activation</p>
                                                <p className={`text-[11px] mt-0.5 leading-snug ${isDark ? 'text-[#A8C4BB]' : 'text-gray-600'}`}>
                                                    {activePercent}% of community workers are currently active.
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                    <div className="flex gap-3">
                                        <div className={`mt-0.5 p-1 rounded-full bg-opacity-20 flex-shrink-0 h-fit ${isDark ? 'bg-[#a855f7] text-[#a855f7]' : 'bg-purple-100 text-purple-600'}`}>
                                            <Database size={12} />
                                        </div>
                                        <div>
                                            <p className={`text-xs font-bold ${isDark ? 'text-[#a855f7]' : 'text-purple-700'}`}>Data Quality</p>
                                            <p className={`text-[11px] mt-0.5 leading-snug ${isDark ? 'text-[#A8C4BB]' : 'text-gray-600'}`}>
                                                {hasRegions ? `Regional data available across ${sortedRegions.length} regions.` : 'National level data only.'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Regional Distribution Chart (Replacing Trend) */}
                            <div className={`p-5 rounded-2xl border ${isDark ? 'bg-white/[0.03] border-white/[0.06]' : 'bg-white border-gray-100'}`}>
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <h4 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Regional Distribution</h4>
                                        <p className={`text-[10px] mt-0.5 ${isDark ? 'text-[#6FA39A]' : 'text-gray-500'}`}>Top regions by CHW count</p>
                                    </div>
                                </div>
                                <div className="h-[160px] w-full">
                                    {regionChartData.length > 0 ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={regionChartData} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={isDark ? 'rgba(255,255,255,0.05)' : '#f0f0f0'} />
                                                <XAxis type="number" hide />
                                                <YAxis type="category" dataKey="name" width={80} tick={{ fill: isDark ? '#A8C4BB' : '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} />
                                                <RechartsTooltip content={<ChartTooltip isDark={isDark} />} cursor={{ fill: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }} />
                                                <Bar dataKey="total" radius={[0, 4, 4, 0]} maxBarSize={16}>
                                                    {regionChartData.map((_, i) => (
                                                        <Cell key={`cell-${i}`} fill={isDark ? '#2EC4B6' : '#0d9488'} />
                                                    ))}
                                                </Bar>
                                            </BarChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>No regional data</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    /* ── Regions Tab ── */
                    <div className="space-y-4">
                        {hasRegions ? (
                            <div className={`rounded-2xl border overflow-hidden ${isDark ? 'border-white/[0.06] bg-white/[0.02]' : 'border-gray-100 bg-gray-50/50'}`}>
                                {sortedRegions.map((r, i) => (
                                    <div key={r.id} className={i < sortedRegions.length - 1 ? (isDark ? 'border-b border-white/[0.04]' : 'border-b border-gray-100') : ''}>
                                        <RegionRow region={r} maxChws={maxRegionChws} isDark={isDark} />
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className={`flex items-center justify-center py-12 rounded-2xl border ${isDark ? 'border-white/[0.05] bg-white/[0.01]' : 'border-gray-100 bg-gray-50'}`}>
                                <div className="text-center">
                                    <Building2 size={24} className={`mx-auto mb-3 ${isDark ? 'text-gray-700' : 'text-gray-300'}`} />
                                    <p className={`text-sm font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>No Regional Data</p>
                                    <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Sub-national data is not available for this country.</p>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

/* ─── Main Export ─── */
export function CountryDrawer({ country, isDark, getMapColor, globalTopRegions, isGlobal }: CountryDrawerProps) {
    return (
        <div className={`rounded-2xl border flex flex-col transition-all h-full
            ${isDark
                ? 'bg-white/[0.025] backdrop-blur-md border-white/[0.08] shadow-xl'
                : 'bg-white/80 backdrop-blur-md border-gray-100 shadow-sm'
            }`}>
            {isGlobal || !country ? (
                <GlobalView isDark={isDark} globalTopRegions={globalTopRegions} />
            ) : (
                <CountryProfile country={country} isDark={isDark} getMapColor={getMapColor} />
            )}
        </div>
    );
}
