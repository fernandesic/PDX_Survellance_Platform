import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { BarChart3, Loader2, AlertCircle } from 'lucide-react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, Line, ComposedChart, Bar,
} from 'recharts';
import { predictionsApi } from '@/pages/predictions/services/predictionsApi';
import type { WeeklyForecastPoint } from '@/pages/predictions/types/predictions';

interface Props {
    countryIso: string;
    countryName: string;
}

type ViewMode = 'weekly' | 'cumulative';

export default function CountryForecastCharts({ countryIso, countryName }: Props) {
    const [data, setData] = useState<WeeklyForecastPoint[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<ViewMode>('weekly');

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(null);

        predictionsApi.countryForecast(countryIso)
            .then(res => {
                if (!cancelled) setData(res.data);
            })
            .catch(err => {
                if (!cancelled) setError(err.message || 'Failed to load forecast');
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => { cancelled = true; };
    }, [countryIso]);

    const chartData = data.map(d => ({
        ...d,
        shortDate: new Date(d.date).toLocaleDateString('en', { month: 'short', year: '2-digit' }),
    }));

    // Sample for readability if more than 20 points
    const sampled = chartData.length > 20
        ? chartData.filter((_, i) => i % 2 === 0 || i === chartData.length - 1)
        : chartData;

    // Summary stats
    const totalCases = data.length > 0 ? data[data.length - 1].cumulative_cases : 0;
    const totalDeaths = data.length > 0 ? data[data.length - 1].cumulative_deaths : 0;
    const peakWeek = data.reduce((max, d) => d.cases > max.cases ? d : max, data[0] || { cases: 0, date: '' });
    const dateRange = data.length > 0
        ? `${new Date(data[0].date).toLocaleDateString('en', { month: 'short', year: 'numeric' })} – ${new Date(data[data.length - 1].date).toLocaleDateString('en', { month: 'short', year: 'numeric' })}`
        : null;

    return (
        <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 border-b border-white/10">
                <div className="flex items-center gap-2 mb-2">
                    <BarChart3 size={16} className="text-cyan-400" />
                    <div>
                        <h3 className="text-sm font-semibold text-white leading-none">
                            {countryName} — Cholera Forecast
                        </h3>
                        {dateRange && (
                            <p className="text-[10px] text-gray-400 mt-0.5">{dateRange}</p>
                        )}
                    </div>
                    <span className="ml-auto px-1.5 py-0.5 rounded text-[10px] font-medium bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
                        ML Model
                    </span>
                </div>

                {/* View toggle + stats */}
                <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex gap-1">
                        {(['weekly', 'cumulative'] as const).map(mode => (
                            <button
                                key={mode}
                                onClick={() => setViewMode(mode)}
                                className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${viewMode === mode
                                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40'
                                    : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
                                    }`}
                            >
                                {mode === 'weekly' ? 'Weekly' : 'Cumulative'}
                            </button>
                        ))}
                    </div>
                    {data.length > 0 && (
                        <div className="ml-auto flex gap-4 text-[11px] text-gray-400">
                            <span>Total: <strong className="text-white">{totalCases.toLocaleString()}</strong> cases</span>
                            <span>Deaths: <strong className="text-red-400">{totalDeaths.toLocaleString()}</strong></span>
                        </div>
                    )}
                </div>
            </div>

            {/* Chart */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="p-3"
                style={{ height: 280 }}
            >
                {loading ? (
                    <div className="h-full flex items-center justify-center text-gray-500 text-sm">
                        <Loader2 className="animate-spin mr-2" size={16} />
                        Loading forecast…
                    </div>
                ) : error ? (
                    <div className="h-full flex items-center justify-center text-gray-500 text-sm">
                        <AlertCircle size={16} className="text-red-400 mr-2" />
                        {error}
                    </div>
                ) : sampled.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-gray-500 text-sm">
                        No forecast data available
                    </div>
                ) : viewMode === 'weekly' ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={sampled} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                            <defs>
                                <linearGradient id={`casesGrad-${countryIso}`} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                            <XAxis
                                dataKey="shortDate"
                                tick={{ fill: '#64748b', fontSize: 9 }}
                                tickLine={false}
                                axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                                interval={Math.floor(sampled.length / 6)}
                            />
                            <YAxis
                                yAxisId="cases"
                                tick={{ fill: '#64748b', fontSize: 9 }}
                                tickLine={false}
                                axisLine={false}
                            />
                            <YAxis
                                yAxisId="deaths"
                                orientation="right"
                                tick={{ fill: '#64748b', fontSize: 9 }}
                                tickLine={false}
                                axisLine={false}
                            />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '8px',
                                    fontSize: '11px',
                                    color: '#e2e8f0',
                                }}
                                formatter={(value: number, name: string) => [
                                    value.toLocaleString(),
                                    name === 'cases' ? 'Cases' : 'Deaths',
                                ]}
                            />
                            <Bar
                                yAxisId="cases"
                                dataKey="cases"
                                fill="#3b82f6"
                                fillOpacity={0.6}
                                radius={[2, 2, 0, 0]}
                                name="cases"
                            />
                            <Line
                                yAxisId="deaths"
                                type="monotone"
                                dataKey="deaths"
                                stroke="#ef4444"
                                strokeWidth={2}
                                dot={false}
                                name="deaths"
                            />
                        </ComposedChart>
                    </ResponsiveContainer>
                ) : (
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={sampled} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                            <defs>
                                <linearGradient id={`cumGrad-${countryIso}`} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                            <XAxis
                                dataKey="shortDate"
                                tick={{ fill: '#64748b', fontSize: 9 }}
                                tickLine={false}
                                axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                                interval={Math.floor(sampled.length / 6)}
                            />
                            <YAxis
                                tick={{ fill: '#64748b', fontSize: 9 }}
                                tickLine={false}
                                axisLine={false}
                            />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '8px',
                                    fontSize: '11px',
                                    color: '#e2e8f0',
                                }}
                                formatter={(value: number) => [value.toLocaleString(), 'Cumulative Cases']}
                            />
                            <Area
                                type="monotone"
                                dataKey="cumulative_cases"
                                stroke="#06b6d4"
                                strokeWidth={2}
                                fill={`url(#cumGrad-${countryIso})`}
                                name="Cumulative Cases"
                                dot={false}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                )}
            </motion.div>

            {/* Footer */}
            {data.length > 0 && (
                <div className="px-4 pb-3 flex items-center gap-4 text-[10px] text-gray-500">
                    <span className="flex items-center gap-1">
                        <span className="w-2.5 h-2.5 rounded bg-blue-500/60" />
                        Weekly Cases
                    </span>
                    <span className="flex items-center gap-1">
                        <span className="w-3 h-0.5 bg-red-500 rounded" />
                        Weekly Deaths
                    </span>
                    <span className="ml-auto">
                        Peak: {peakWeek?.cases?.toLocaleString()} cases ({new Date(peakWeek?.date).toLocaleDateString('en', { month: 'short', day: 'numeric' })})
                    </span>
                </div>
            )}
        </div>
    );
}
