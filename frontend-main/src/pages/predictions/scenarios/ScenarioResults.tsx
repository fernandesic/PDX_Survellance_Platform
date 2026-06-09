/**
 * ScenarioResults — quantile band chart (median + 5/25/75/95th percentile).
 *
 * Renders one chart per compartment (S, E, I, R, D, V) using Recharts.
 * The I (Infectious) compartment is shown by default; others toggle.
 */

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer,
} from 'recharts';
import { Clock, AlertTriangle, CheckCircle2, TrendingUp } from 'lucide-react';
import type { ScenarioRunDetail, SummaryStats } from './scenariosApi';

interface ScenarioResultsProps {
    run: ScenarioRunDetail;
}

/* ── Compartment color palette ────────────────────────────────── */
const COMPARTMENT_COLORS: Record<string, { main: string; fill: string; label: string }> = {
    S: { main: '#60a5fa', fill: '#60a5fa20', label: 'Susceptible' },
    E: { main: '#fbbf24', fill: '#fbbf2420', label: 'Exposed' },
    I: { main: '#ef4444', fill: '#ef444420', label: 'Infectious' },
    R: { main: '#34d399', fill: '#34d39920', label: 'Recovered' },
    D: { main: '#a78bfa', fill: '#a78bfa20', label: 'Deceased' },
    V: { main: '#2dd4bf', fill: '#2dd4bf20', label: 'Vaccinated' },
};

/* ── Build chart data from summary stats ──────────────────────── */
function buildChartData(stats: SummaryStats, compartment: string, pop: number) {
    const col = `${compartment}[${pop}]`;
    const q = stats.quantiles[col];
    if (!q) return [];

    return stats.steps.map((step, i) => ({
        step,
        median: q.median[i],
        q05: q.q05[i],
        q25: q.q25[i],
        q75: q.q75[i],
        q95: q.q95[i],
    }));
}

/* ── KPI helpers ──────────────────────────────────────────────── */
function computeKPIs(stats: SummaryStats, pop: number) {
    const iCol = `I[${pop}]`;
    const dCol = `D[${pop}]`;
    const iq = stats.quantiles[iCol];
    const dq = stats.quantiles[dCol];

    if (!iq) return null;

    const peakInfected = Math.max(...iq.median);
    const peakDay = iq.median.indexOf(peakInfected) + 1;
    const totalDeaths = dq ? dq.median[dq.median.length - 1] : 0;
    const finalR = stats.quantiles[`R[${pop}]`];
    const attackRate = finalR
        ? ((finalR.median[finalR.median.length - 1]) /
           (stats.quantiles[`S[${pop}]`]?.median[0] || 1) * 100).toFixed(1)
        : '—';

    return { peakInfected, peakDay, totalDeaths, attackRate };
}

/* ── Status badge ─────────────────────────────────────────────── */
function StatusBadge({ status }: { status: string }) {
    const config = {
        PENDING: { icon: Clock, text: 'Queued', cls: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20' },
        RUNNING: { icon: TrendingUp, text: 'Running…', cls: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
        SUCCESS: { icon: CheckCircle2, text: 'Complete', cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
        FAILED: { icon: AlertTriangle, text: 'Failed', cls: 'text-red-400 bg-red-500/10 border-red-500/20' },
    }[status] ?? { icon: Clock, text: status, cls: 'text-gray-400 bg-white/5 border-white/10' };

    const Icon = config.icon;
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border ${config.cls}`}>
            <Icon size={12} />
            {config.text}
        </span>
    );
}

/* ── Quantile Band Chart ──────────────────────────────────────── */
function QuantileChart({ stats, compartment, pop }: {
    stats: SummaryStats;
    compartment: string;
    pop: number;
}) {
    const data = useMemo(() => buildChartData(stats, compartment, pop), [stats, compartment, pop]);
    const color = COMPARTMENT_COLORS[compartment] ?? COMPARTMENT_COLORS.I;

    if (data.length === 0) return null;

    return (
        <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                    <defs>
                        <linearGradient id={`grad-${compartment}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={color.main} stopOpacity={0.3} />
                            <stop offset="100%" stopColor={color.main} stopOpacity={0.02} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
                    <XAxis
                        dataKey="step"
                        tick={{ fill: '#9ca3af', fontSize: 11 }}
                        axisLine={{ stroke: '#374151' }}
                        label={{ value: 'Day', position: 'insideBottom', offset: -2, fill: '#6b7280', fontSize: 11 }}
                    />
                    <YAxis
                        tick={{ fill: '#9ca3af', fontSize: 11 }}
                        axisLine={{ stroke: '#374151' }}
                        tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
                    />
                    <Tooltip
                        contentStyle={{
                            backgroundColor: '#1f2937',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '8px',
                            fontSize: '12px',
                            color: '#e5e7eb',
                        }}
                        labelFormatter={(v) => `Day ${v}`}
                    />
                    {/* 5–95% band */}
                    <Area type="monotone" dataKey="q95" stroke="none" fill={color.fill} stackId="band" name="95th" />
                    <Area type="monotone" dataKey="q05" stroke="none" fill="#111827" stackId="band" name="5th" />
                    {/* 25–75% band */}
                    <Area type="monotone" dataKey="q75" stroke="none" fill={`${color.main}30`} stackId="iqr" name="75th" />
                    <Area type="monotone" dataKey="q25" stroke="none" fill="#111827" stackId="iqr" name="25th" />
                    {/* Median line */}
                    <Area
                        type="monotone"
                        dataKey="median"
                        stroke={color.main}
                        strokeWidth={2}
                        fill={`url(#grad-${compartment})`}
                        name="Median"
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}

/* ── Main Results Component ───────────────────────────────────── */
export default function ScenarioResults({ run }: ScenarioResultsProps) {
    const [activeComp, setActiveComp] = useState('I');
    const stats = run.summary_stats;
    const pop = 1; // Show population 1 by default

    if (run.status === 'FAILED') {
        return (
            <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="bg-red-500/5 border border-red-500/20 rounded-xl p-4"
            >
                <div className="flex items-start gap-3">
                    <AlertTriangle size={18} className="text-red-400 mt-0.5 flex-shrink-0" />
                    <div>
                        <p className="text-sm font-medium text-red-300">Simulation Failed</p>
                        <p className="text-xs text-gray-400 mt-1 font-mono">{run.error_message}</p>
                    </div>
                </div>
            </motion.div>
        );
    }

    if (!stats || run.status !== 'SUCCESS') {
        return (
            <div className="flex items-center justify-center py-12 text-gray-400">
                <div className="text-center space-y-2">
                    <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto" />
                    <p className="text-sm">
                        {run.status === 'PENDING' ? 'Queued — waiting for worker…' : 'Running simulation…'}
                    </p>
                    <p className="text-xs text-gray-600">
                        {run.n_sims} simulations × {run.time_steps} days
                    </p>
                </div>
            </div>
        );
    }

    const kpis = computeKPIs(stats, pop);

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
        >
            {/* Status + Duration */}
            <div className="flex items-center justify-between">
                <StatusBadge status={run.status} />
                {run.duration_seconds != null && (
                    <span className="text-xs text-gray-500">
                        Completed in {run.duration_seconds.toFixed(1)}s
                    </span>
                )}
            </div>

            {/* KPI Cards */}
            {kpis && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {[
                        { label: 'Peak Infected', value: kpis.peakInfected.toLocaleString(), sub: `Day ${kpis.peakDay}`, color: '#ef4444' },
                        { label: 'Total Deaths', value: kpis.totalDeaths.toLocaleString(), color: '#a78bfa' },
                        { label: 'Attack Rate', value: `${kpis.attackRate}%`, color: '#fbbf24' },
                        { label: 'Simulations', value: run.n_sims, sub: `seed: ${run.seed ?? 'auto'}`, color: '#60a5fa' },
                    ].map((k, i) => (
                        <div key={i} className="bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2">
                            <p className="text-[10px] text-gray-500 uppercase tracking-wide">{k.label}</p>
                            <p className="text-lg font-bold mt-0.5" style={{ color: k.color }}>{k.value}</p>
                            {k.sub && <p className="text-[10px] text-gray-600">{k.sub}</p>}
                        </div>
                    ))}
                </div>
            )}

            {/* Compartment Tabs */}
            <div className="flex gap-1 overflow-x-auto pb-1">
                {Object.entries(COMPARTMENT_COLORS).map(([key, c]) => (
                    <button
                        key={key}
                        onClick={() => setActiveComp(key)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                            activeComp === key
                                ? 'text-white shadow-lg'
                                : 'text-gray-500 hover:text-gray-300 bg-white/[0.02]'
                        }`}
                        style={activeComp === key ? {
                            backgroundColor: `${c.main}20`,
                            border: `1px solid ${c.main}40`,
                            color: c.main,
                        } : { border: '1px solid transparent' }}
                    >
                        {c.label}
                    </button>
                ))}
            </div>

            {/* Chart */}
            <div className="bg-white/[0.02] border border-white/10 rounded-xl p-3">
                <h3 className="text-xs text-gray-400 mb-2 px-1">
                    {COMPARTMENT_COLORS[activeComp]?.label} — Quantile Band (5th / 25th / Median / 75th / 95th)
                </h3>
                <QuantileChart stats={stats} compartment={activeComp} pop={pop} />
            </div>
        </motion.div>
    );
}
