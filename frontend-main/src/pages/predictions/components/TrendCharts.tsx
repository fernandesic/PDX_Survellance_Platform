import { useState } from 'react';
import { motion } from 'framer-motion';
import { Activity } from 'lucide-react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer,
} from 'recharts';
import type { TrendDataItem, PredictionDisease } from '@/pages/predictions/types/predictions';
import { DISEASE_DISPLAY_NAMES } from '@/pages/predictions/types/predictions';

interface Props {
    data: TrendDataItem[];
    selectedDisease: PredictionDisease;
    onDiseaseChange: (disease: PredictionDisease) => void;
}

const DISEASE_TABS: PredictionDisease[] = [
    'cholera', 'mpox', 'malaria', 'meningitis', 'ebola',
];

const CHART_COLORS = [
    '#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6',
];

export default function TrendCharts({ data, selectedDisease, onDiseaseChange }: Props) {
    const [activeCountry, setActiveCountry] = useState<string | null>(null);

    // Get chart data for the selected/active country or first available
    const displayData = activeCountry
        ? data.find(d => d.country_iso === activeCountry)
        : data[0];

    const isRealData = selectedDisease === 'cholera' &&
        displayData?.country_iso === 'COD';

    const chartData = displayData?.forecast?.map((f, i) => ({
        date: f.date,
        day: `Day ${i + 1}`,
        shortDate: new Date(f.date).toLocaleDateString('en', { month: 'short', day: 'numeric' }),
        predicted: f.predicted,
        lower: f.lower,
        upper: f.upper,
    })) || [];

    // Sample every 3rd point for readability
    const sampledData = chartData.filter((_, i) => i % 3 === 0 || i === chartData.length - 1);

    return (
        <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 overflow-hidden">
            {/* Header + Disease Tabs */}
            <div className="px-4 py-3 border-b border-white/10">
                <div className="flex items-center gap-2 mb-3">
                    <Activity size={16} className="text-blue-400" />
                    <h3 className="text-sm font-semibold text-white">Forecast Trends</h3>
                    <span className="ml-auto flex items-center gap-2">
                        {data.length > 0 && isRealData && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
                                ML Model
                            </span>
                        )}
                        {/* COMMENTED OUT: Dummy data badge since we no longer generate fake forecasts */}
                        {/*
                        {data.length > 0 && !isRealData && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-yellow-500/15 text-yellow-400 border border-yellow-500/40 tracking-wide">
                                DUMMY DATA
                            </span>
                        )}
                        */}
                        <span className="text-xs text-gray-400">90-day forecast</span>
                    </span>
                </div>

                <div className="flex gap-1 flex-wrap">
                    {DISEASE_TABS.map(disease => (
                        <button
                            key={disease}
                            onClick={() => onDiseaseChange(disease)}
                            className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${selectedDisease === disease
                                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40'
                                : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
                                }`}
                        >
                            {DISEASE_DISPLAY_NAMES[disease]}
                        </button>
                    ))}
                </div>
            </div>

            {/* Country Selectors */}
            {data.length > 1 && (
                <div className="px-4 py-2 border-b border-white/5 flex gap-1 overflow-x-auto">
                    {data.map((item, i) => (
                        <button
                            key={item.country_iso}
                            onClick={() => setActiveCountry(item.country_iso)}
                            className={`px-2 py-0.5 rounded text-xs whitespace-nowrap transition-all ${(activeCountry === item.country_iso || (!activeCountry && i === 0))
                                ? 'bg-white/10 text-white'
                                : 'text-gray-500 hover:text-gray-300'
                                }`}
                        >
                            {item.country_name} ({item.risk_score.toFixed(0)})
                        </button>
                    ))}
                </div>
            )}

            {/* Chart */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="p-4"
                style={{ height: 300 }}
            >
                {sampledData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={sampledData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                            <defs>
                                <linearGradient id="predGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="confGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#64748b" stopOpacity={0.2} />
                                    <stop offset="95%" stopColor="#64748b" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                            <XAxis
                                dataKey="shortDate"
                                tick={{ fill: '#64748b', fontSize: 10 }}
                                tickLine={false}
                                axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                                interval={4}
                            />
                            <YAxis
                                tick={{ fill: '#64748b', fontSize: 10 }}
                                tickLine={false}
                                axisLine={false}
                            />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '8px',
                                    fontSize: '12px',
                                    color: '#e2e8f0',
                                }}
                            />
                            <Area
                                type="monotone"
                                dataKey="upper"
                                stroke="none"
                                fill="url(#confGrad)"
                                name="Upper Bound"
                            />
                            <Area
                                type="monotone"
                                dataKey="lower"
                                stroke="none"
                                fill="transparent"
                                name="Lower Bound"
                            />
                            <Area
                                type="monotone"
                                dataKey="predicted"
                                stroke="#3b82f6"
                                strokeWidth={2}
                                fill="url(#predGrad)"
                                name="Predicted Cases"
                                dot={false}
                                activeDot={{ r: 4, fill: '#3b82f6' }}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="h-full flex items-center justify-center text-gray-500 text-sm">
                        No forecast data available for {DISEASE_DISPLAY_NAMES[selectedDisease]}
                    </div>
                )}
            </motion.div>

            {/* Legend */}
            {displayData && (
                <div className="px-4 pb-3 flex items-center gap-4 text-xs text-gray-400">
                    <span className="flex items-center gap-1">
                        <span className="w-3 h-0.5 bg-blue-500 rounded" />
                        Predicted
                    </span>
                    <span className="flex items-center gap-1">
                        <span className="w-3 h-3 bg-gray-500/20 rounded" />
                        Confidence Band
                    </span>
                    <span className="ml-auto">
                        Confidence: {displayData.confidence.toFixed(0)}%
                    </span>
                </div>
            )}
        </div>
    );
}
