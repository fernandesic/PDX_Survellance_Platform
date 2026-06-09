import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Loader2, AlertCircle } from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, Cell, LabelList,
} from 'recharts';
import { predictionsApi } from '@/pages/predictions/services/predictionsApi';
import type { InterventionRegion } from '@/pages/predictions/types/predictions';
import { RISK_LEVEL_CONFIG } from '@/pages/predictions/types/predictions';

interface Props {
    countryIso: string;
    countryName: string;
}

const ACTION_LABELS: Record<string, string> = {
    'Deploy CTCs':       'CRITICAL — Deploy CTCs',
    'Mass Chlorination': 'HIGH — Mass Chlorination',
    'Stock ORS':         'MEDIUM — Stock ORS',
    'Monitor':           'LOW — Monitor',
};

const RISK_COLORS: Record<string, string> = {
    CRITICAL: '#ef4444',
    HIGH:     '#f97316',
    MEDIUM:   '#eab308',
    LOW:      '#22c55e',
};

function CustomTooltip({ active, payload }: any) {
    if (!active || !payload?.length) return null;
    const d: InterventionRegion = payload[0].payload;
    const color = RISK_COLORS[d.risk_level] || '#94a3b8';
    return (
        <div className="bg-slate-900/95 border border-white/10 rounded-lg p-3 text-xs shadow-xl">
            <p className="font-semibold text-white mb-1">{d.district}</p>
            <p className="text-gray-400">{d.province}</p>
            <div className="mt-2 space-y-0.5">
                <p style={{ color }}>{d.total_cases.toLocaleString()} cases projected</p>
                <p className="text-red-400">{d.total_deaths} deaths expected</p>
                <p className="text-gray-400 mt-1">{ACTION_LABELS[d.action_required] || d.action_required}</p>
            </div>
        </div>
    );
}

export default function InterventionPlanChart({ countryIso, countryName }: Props) {
    const [data, setData] = useState<InterventionRegion[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showAll, setShowAll] = useState(false);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(null);

        predictionsApi.interventionPlan(countryIso)
            .then(res => {
                if (!cancelled) setData(res.data);
            })
            .catch(err => {
                if (!cancelled) setError(err.message || 'Failed to load data');
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => { cancelled = true; };
    }, [countryIso]);

    const sorted = [...data].sort((a, b) => b.total_cases - a.total_cases);
    const displayed = showAll ? sorted : sorted.slice(0, 15);

    // Chart height: 28px per row
    const chartHeight = Math.max(300, displayed.length * 30);

    const totalCases = data.reduce((s, d) => s + d.total_cases, 0);
    const totalDeaths = data.reduce((s, d) => s + d.total_deaths, 0);
    const criticalCount = data.filter(d => d.risk_level === 'CRITICAL').length;

    const regionLabel = countryIso === 'COD' ? 'province' : 'district';

    return (
        <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 border-b border-white/10">
                <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle size={16} className="text-red-400" />
                    <div>
                        <h3 className="text-sm font-semibold text-white leading-none">
                            {countryName} — Executive Intervention Plan
                        </h3>
                        <p className="text-[10px] text-gray-400 mt-0.5">
                            Cholera · Top {regionLabel}s by projected cases (next 12 months)
                        </p>
                    </div>
                    <span className="ml-auto px-1.5 py-0.5 rounded text-[10px] font-medium bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
                        ML Model
                    </span>
                </div>

                {/* Stats + toggle */}
                {data.length > 0 && (
                    <div className="flex items-center gap-3 flex-wrap">
                        <div className="flex gap-3 text-[11px] text-gray-400">
                            <span>Total: <strong className="text-white">{totalCases.toLocaleString()}</strong> cases</span>
                            <span>Deaths: <strong className="text-red-400">{totalDeaths}</strong></span>
                            <span>Critical: <strong className="text-red-400">{criticalCount}</strong> {regionLabel}s</span>
                        </div>
                        {data.length > 15 && (
                            <button
                                onClick={() => setShowAll(v => !v)}
                                className="ml-auto px-2 py-0.5 rounded text-[10px] font-medium border transition-all text-gray-400 border-white/10 hover:text-white hover:bg-white/5"
                            >
                                {showAll ? `Top 15 only` : `Show all ${data.length}`}
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Chart */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="px-2 py-3"
                style={{ height: loading || error ? 200 : chartHeight + 20 }}
            >
                {loading ? (
                    <div className="h-full flex items-center justify-center text-gray-500 text-sm">
                        <Loader2 className="animate-spin mr-2" size={16} />
                        Loading intervention plan…
                    </div>
                ) : error ? (
                    <div className="h-full flex items-center justify-center text-gray-500 text-sm">
                        <AlertCircle size={16} className="text-red-400 mr-2" />
                        {error}
                    </div>
                ) : displayed.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-gray-500 text-sm">
                        No data available
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height={chartHeight}>
                        <BarChart
                            data={displayed}
                            layout="vertical"
                            margin={{ top: 0, right: 80, left: 100, bottom: 0 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                            <XAxis
                                type="number"
                                tick={{ fill: '#64748b', fontSize: 9 }}
                                tickLine={false}
                                axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                                tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v.toString()}
                            />
                            <YAxis
                                type="category"
                                dataKey="district"
                                tick={{ fill: '#94a3b8', fontSize: 10 }}
                                tickLine={false}
                                axisLine={false}
                                width={96}
                            />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                            <Bar dataKey="total_cases" radius={[0, 3, 3, 0]} maxBarSize={22}>
                                {displayed.map((entry, i) => (
                                    <Cell
                                        key={`cell-${i}`}
                                        fill={RISK_COLORS[entry.risk_level] || '#94a3b8'}
                                        fillOpacity={0.75}
                                    />
                                ))}
                                <LabelList
                                    dataKey="total_cases"
                                    position="right"
                                    formatter={(v: any) => typeof v === 'number' ? v.toLocaleString() : v}
                                    style={{ fill: '#94a3b8', fontSize: 9 }}
                                />
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                )}
            </motion.div>

            {/* Legend */}
            {data.length > 0 && (
                <div className="px-4 pb-3 flex items-center gap-4 flex-wrap text-[10px] text-gray-500">
                    {Object.entries(RISK_COLORS).map(([level, color]) => (
                        <span key={level} className="flex items-center gap-1">
                            <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: color, opacity: 0.75 }} />
                            {RISK_LEVEL_CONFIG[level as keyof typeof RISK_LEVEL_CONFIG]?.label} — {
                                level === 'CRITICAL' ? 'Deploy CTCs' :
                                level === 'HIGH'     ? 'Mass Chlorination' :
                                level === 'MEDIUM'   ? 'Stock ORS' : 'Monitor'
                            }
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
}
