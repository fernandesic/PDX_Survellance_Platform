// @ts-nocheck
import React, { useMemo } from 'react';
import type { Signal } from '../types';
import { BarChart3, Globe, Layers, Shield, TrendingUp, Activity } from 'lucide-react';

interface SignalAnalyticsProps {
    signals: Signal[];
}

// Color palettes
const PRIORITY_COLORS: Record<string, string> = {
    P1: '#ef4444', P2: '#f97316', P3: '#eab308', P4: '#22c55e',
};
const PRIORITY_LABELS: Record<string, string> = {
    P1: 'Critical', P2: 'High', P3: 'Medium', P4: 'Low',
};
const CATEGORY_COLORS: string[] = [
    '#6366f1', '#ec4899', '#14b8a6', '#f97316', '#8b5cf6', '#06b6d4', '#ef4444', '#22c55e',
];
const STATUS_COLORS: Record<string, string> = {
    new: '#f59e0b', triaged: '#3b82f6', validated: '#10b981', dismissed: '#64748b',
};
const TIER_COLORS = ['#10b981', '#3b82f6', '#64748b'];
const TIER_LABELS = ['Tier 1 — Official', 'Tier 2 — Verified', 'Tier 3 — Unverified'];

// SVG Donut Chart
const DonutChart = ({ data, colors, size = 120 }: { data: { label: string; value: number; color: string }[]; colors?: string[]; size?: number }) => {
    const total = data.reduce((s, d) => s + d.value, 0);
    if (total === 0) return <div className="flex items-center justify-center h-full text-slate-600 text-xs">No data</div>;

    const radius = (size - 16) / 2;
    const cx = size / 2;
    const cy = size / 2;
    const strokeWidth = 14;
    const circumference = 2 * Math.PI * radius;
    let offset = 0;

    return (
        <div className="flex items-center gap-4">
            <svg width={size} height={size} className="shrink-0">
                {data.map((d, i) => {
                    const pct = d.value / total;
                    const dash = pct * circumference;
                    const currentOffset = offset;
                    offset += dash;
                    return (
                        <circle
                            key={i}
                            cx={cx} cy={cy} r={radius}
                            fill="none"
                            stroke={d.color}
                            strokeWidth={strokeWidth}
                            strokeDasharray={`${dash} ${circumference - dash}`}
                            strokeDashoffset={-currentOffset}
                            transform={`rotate(-90 ${cx} ${cy})`}
                            className="transition-all duration-500"
                        />
                    );
                })}
                <text x={cx} y={cy - 4} textAnchor="middle" className="fill-white text-lg font-black">{total}</text>
                <text x={cx} y={cy + 12} textAnchor="middle" className="fill-slate-500 text-[8px] font-bold uppercase">Total</text>
            </svg>
            <div className="space-y-1 flex-1 min-w-0">
                {data.map((d, i) => (
                    <div key={i} className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                        <span className="text-[10px] font-bold text-slate-400 truncate flex-1">{d.label}</span>
                        <span className="text-[10px] font-black text-white">{d.value}</span>
                        <span className="text-[9px] text-slate-600 font-bold w-8 text-right">{Math.round((d.value / total) * 100)}%</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

// Horizontal Bar Chart
const HBarChart = ({ data, maxBars = 8 }: { data: { label: string; value: number; color?: string }[]; maxBars?: number }) => {
    const sorted = [...data].sort((a, b) => b.value - a.value).slice(0, maxBars);
    const max = Math.max(...sorted.map(d => d.value), 1);

    return (
        <div className="space-y-1.5">
            {sorted.map((d, i) => (
                <div key={d.label} className="flex items-center gap-2">
                    <span className="text-[9px] font-bold text-slate-500 w-20 truncate text-right shrink-0">{d.label}</span>
                    <div className="flex-1 h-4 bg-white/[0.03] rounded-full overflow-hidden">
                        <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{
                                width: `${(d.value / max) * 100}%`,
                                backgroundColor: d.color || CATEGORY_COLORS[i % CATEGORY_COLORS.length],
                            }}
                        />
                    </div>
                    <span className="text-[10px] font-black text-white w-6 text-right shrink-0">{d.value}</span>
                </div>
            ))}
        </div>
    );
};

// Section wrapper
const ChartCard = ({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) => (
    <div className="bg-white/[0.02] rounded-2xl border border-white/5 p-4">
        <h4 className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3 flex items-center gap-1.5">
            <Icon className="w-3.5 h-3.5 text-slate-600" /> {title}
        </h4>
        {children}
    </div>
);

export const SignalAnalytics: React.FC<SignalAnalyticsProps> = ({ signals }) => {
    // Compute all analytics from signals array
    const analytics = useMemo(() => {
        const byPriority: Record<string, number> = { P1: 0, P2: 0, P3: 0, P4: 0 };
        const byStatus: Record<string, number> = {};
        const byCountry: Record<string, number> = {};
        const byCategory: Record<string, number> = {};
        const byTier: number[] = [0, 0, 0]; // Tier 1, 2, 3
        const bySource: Record<string, number> = {};

        signals.forEach(s => {
            // Priority
            const p = s.priority || 'P4';
            byPriority[p] = (byPriority[p] || 0) + 1;

            // Status
            const st = s.status || 'new';
            byStatus[st] = (byStatus[st] || 0) + 1;

            // Country
            const country = s.location?.country || 'Unknown';
            byCountry[country] = (byCountry[country] || 0) + 1;

            // Disease category
            const cat = s.disease_category || 'unknown';
            byCategory[cat] = (byCategory[cat] || 0) + 1;

            // Source tier
            const tier = s.source_tier || (s.sources?.[0]?.tier) || (s.source as any)?.tier || 3;
            if (tier >= 1 && tier <= 3) byTier[tier - 1]++;

            // Ingestion source
            const src = s.ingestion_source || 'unknown';
            bySource[src] = (bySource[src] || 0) + 1;
        });

        return { byPriority, byStatus, byCountry, byCategory, byTier, bySource };
    }, [signals]);

    const priorityData = Object.entries(analytics.byPriority).map(([k, v]) => ({
        label: `${k} — ${PRIORITY_LABELS[k]}`, value: v, color: PRIORITY_COLORS[k],
    }));

    const statusData = Object.entries(analytics.byStatus).map(([k, v]) => ({
        label: k.charAt(0).toUpperCase() + k.slice(1), value: v, color: STATUS_COLORS[k] || '#64748b',
    }));

    const countryData = Object.entries(analytics.byCountry).map(([k, v]) => ({
        label: k, value: v,
    }));

    const categoryData = Object.entries(analytics.byCategory)
        .filter(([k]) => k !== 'unknown')
        .map(([k, v], i) => ({
            label: k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
            value: v,
            color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
        }));

    const tierData = analytics.byTier.map((v, i) => ({
        label: TIER_LABELS[i], value: v, color: TIER_COLORS[i],
    }));

    const sourceData = Object.entries(analytics.bySource).map(([k, v], i) => ({
        label: k.toUpperCase(), value: v, color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
    }));

    if (signals.length === 0) {
        return (
            <div className="bg-[#0B1120] rounded-[2rem] border border-white/5 shadow-sm p-8 flex flex-col items-center justify-center text-center space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10">
                    <BarChart3 className="w-8 h-8 text-slate-700 animate-pulse" />
                </div>
                <div>
                    <h3 className="text-base font-black text-slate-400 uppercase tracking-tight">Waiting for Intelligence</h3>
                    <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest mt-1">
                        Connect to a data source to begin real-time analysis
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-[#0B1120] rounded-[2rem] border border-white/5 shadow-sm p-5">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h3 className="text-base font-black text-white uppercase tracking-tight">Signal Analytics</h3>
                    <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">
                        Real-time intelligence from {signals.length} signals
                    </span>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 rounded-xl border border-white/5">
                    <BarChart3 className="w-3.5 h-3.5 text-blue-400" />
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Live Analytics</span>
                </div>
            </div>

            {/* Charts Grid — 2x2 */}
            <div className="grid grid-cols-2 gap-4 mb-4">
                {/* Priority Distribution */}
                <ChartCard icon={Shield} title="Priority Distribution">
                    <DonutChart data={priorityData} />
                </ChartCard>

                {/* Status Pipeline */}
                <ChartCard icon={Activity} title="Status Pipeline">
                    <DonutChart data={statusData} />
                </ChartCard>

                {/* Top Countries */}
                <ChartCard icon={Globe} title="Top Affected Countries">
                    <HBarChart data={countryData} maxBars={7} />
                </ChartCard>

                {/* Disease Categories */}
                <ChartCard icon={Layers} title="Disease Category Breakdown">
                    <HBarChart data={categoryData} maxBars={7} />
                </ChartCard>
            </div>

            {/* Bottom Row — Source Tier + Ingestion Source */}
            <div className="grid grid-cols-3 gap-4">
                <ChartCard icon={TrendingUp} title="Source Credibility">
                    <DonutChart data={tierData} size={100} />
                </ChartCard>

                <div className="col-span-2">
                    <ChartCard icon={BarChart3} title="Ingestion Sources">
                        <HBarChart data={sourceData} maxBars={5} />
                    </ChartCard>
                </div>
            </div>
        </div>
    );
};
