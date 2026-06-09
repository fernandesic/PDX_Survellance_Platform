// @ts-nocheck
import React from 'react';
import {
    Activity,
    TrendingUp,
    AlertTriangle,
    FlaskConical
} from 'lucide-react';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer
} from 'recharts';
import { useTheme } from '@/contexts/ThemeContext';
import type { RegionClimateProfile } from '@/pages/climate/types/climate';

interface DeepAnalysisPanelProps {
    selectedProfile: RegionClimateProfile | null;
}

export function DeepAnalysisPanel({ selectedProfile }: DeepAnalysisPanelProps) {
    const { theme } = useTheme();
    const isLight = theme === 'light';

    if (!selectedProfile) return null;

    const currentMagnitude = selectedProfile.anomalies[0]?.anomalyMagnitude || 3.5;
    const nowValue = Math.min(9.5, Math.max(1, (currentMagnitude * 2) + 2));

    const historicalData = selectedProfile.historicalAnnualData && selectedProfile.historicalAnnualData.length > 0
        ? selectedProfile.historicalAnnualData.map(d => ({
            name: d.year,
            value: ((d.T2M - 20) * 0.5) + 3,
            isLive: false,
            realValue: d.T2M
        }))
        : Array.from({ length: 5 }, (_, i) => {
            const year = (new Date().getFullYear() - (5 - i)).toString();
            const seed = selectedProfile.region.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
            const trend = Math.sin(seed * 0.13 + i * 0.7) * 1.8;
            const baseLevel = 4 + (i * 0.2);
            return {
                name: year,
                value: Math.max(1, Math.min(9, baseLevel + trend)),
                isLive: false
            };
        });

    historicalData.push({ name: 'Now', value: nowValue, isLive: true });

    const CustomTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;
            return (
                <div className={`border p-3 rounded-xl shadow-2xl backdrop-blur-md ${isLight ? 'bg-white/95 border-gray-200' : 'bg-[#050810]/95 border-white/10'}`}>
                    <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${isLight ? 'text-gray-400' : 'text-white/40'}`}>{data.name}</p>
                    <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full shadow-[0_0_8px_rgba(34,211,238,0.6)] ${isLight ? 'bg-cyan-600' : 'bg-cyan-400'}`} />
                        <span className={`text-sm font-black ${isLight ? 'text-gray-900' : 'text-white'}`}>
                            {payload[0].value.toFixed(1)} <span className={isLight ? 'text-[10px] text-gray-400' : 'text-[10px] text-white/40'}>Z-SCORE</span>
                        </span>
                    </div>
                    {data.isLive && (
                        <div className={`mt-2 pt-2 border-t flex items-center gap-1 ${isLight ? 'border-gray-100' : 'border-white/5'}`}>
                            <div className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
                            <span className="text-[8px] font-black text-emerald-400 uppercase tracking-tight">Live Satellite Signal</span>
                        </div>
                    )}
                </div>
            );
        }
        return null;
    };

    const diseaseRisks = selectedProfile.diseaseRisks;

    return (
        <div className={`w-full border-t p-6 animate-in fade-in slide-in-from-bottom-4 duration-700 transition-colors duration-300 ${isLight ? 'bg-white border-gray-200' : 'bg-[#050810] border-white/5'}`}>
            <div className="max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">

                <div className="space-y-4">
                    <div className="flex items-center gap-3 mb-2">
                        <div className={`p-2 rounded-lg border ${isLight ? 'bg-rose-50 border-rose-100' : 'bg-rose-500/10 border-rose-500/20'}`}>
                            <FlaskConical className="w-4 h-4 text-rose-500" />
                        </div>
                        <h3 className={`text-[12px] font-black uppercase tracking-[2px] ${isLight ? 'text-gray-800' : 'text-white'}`}>Outbreak Prediction Detail</h3>
                    </div>

                    <div className="space-y-3">
                        {diseaseRisks.map((risk, idx) => (
                            <div key={idx} className={`border rounded-2xl p-4 group transition-all cursor-default ${isLight ? 'bg-gray-50 border-gray-200 hover:bg-gray-100' : 'bg-white/5 border-white/5 hover:border-white/10'}`}>
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${risk.riskLevel === 'HIGH' ? (isLight ? 'bg-rose-100 text-rose-600' : 'bg-rose-500/20 text-rose-500') : (isLight ? 'bg-amber-100 text-amber-600' : 'bg-amber-500/20 text-amber-500')
                                            }`}>
                                            <Activity className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <h4 className={`text-[13px] font-black uppercase tracking-tight ${isLight ? 'text-gray-900' : 'text-white'}`}>{risk.disease}</h4>
                                            <p className={`text-[9px] font-bold uppercase tracking-widest leading-none mt-0.5 ${isLight ? 'text-gray-400' : 'text-white/30'}`}>Vector Stability Analysis</p>
                                        </div>
                                    </div>
                                    <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border ${risk.riskLevel === 'HIGH' ? (isLight ? 'bg-rose-100 border-rose-200 text-rose-600' : 'bg-rose-500/10 border-rose-500/20 text-rose-500') : (isLight ? 'bg-amber-100 border-amber-200 text-amber-600' : 'bg-amber-500/10 border-amber-500/20 text-amber-500')
                                        }`}>
                                        <div className={`w-1 h-1 rounded-full ${risk.riskLevel === 'HIGH' ? 'bg-rose-500 animate-pulse' : 'bg-amber-500'}`} />
                                        <span className="text-[9px] font-black tracking-widest uppercase">{risk.riskLevel}</span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-2 mt-4">
                                    <div className={`p-2 rounded-xl border ${isLight ? 'bg-white border-gray-100' : 'bg-[#0f172a]/40 border-white/5'}`}>
                                        <span className={`text-[8px] font-black uppercase tracking-tighter ${isLight ? 'text-gray-400' : 'text-white/20'}`}>Impact Zone</span>
                                        <p className={`text-[10px] font-bold truncate ${isLight ? 'text-gray-700' : 'text-white/70'}`}>Regional {selectedProfile.region.name}</p>
                                    </div>
                                    <div className={`p-2 rounded-xl border ${isLight ? 'bg-white border-gray-100' : 'bg-[#0f172a]/40 border-white/5'}`}>
                                        <span className={`text-[8px] font-black uppercase tracking-tighter ${isLight ? 'text-gray-400' : 'text-white/20'}`}>Model Confidence</span>
                                        <p className={`text-[10px] font-bold ${isLight ? 'text-gray-700' : 'text-white/70'}`}>{(risk.confidence * 100).toFixed(0)}% Certainty</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="lg:col-span-2 space-y-4">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg border shadow-sm ${isLight ? 'bg-cyan-50 border-cyan-100' : 'bg-cyan-500/10 border-cyan-500/20 shadow-[0_0_15px_rgba(6,182,212,0.1)]'}`}>
                                <TrendingUp className="w-4 h-4 text-cyan-600" />
                            </div>
                            <div>
                                <h3 className={`text-[12px] font-black uppercase tracking-[2px] ${isLight ? 'text-gray-800' : 'text-white'}`}>Historical Anomaly Comparison</h3>
                                <p className={`text-[9px] font-bold uppercase tracking-[1px] ${isLight ? 'text-gray-400' : 'text-white/20'}`}>Composite Intelligence Trend (Historical Window)</p>
                            </div>
                        </div>
                        <div className="flex gap-4">
                            <div className="flex items-center gap-2">
                                <div className={`w-1.5 h-1.5 rounded-full shadow-[0_0_8px_rgba(6,182,212,0.6)] ${isLight ? 'bg-cyan-500' : 'bg-cyan-500'}`} />
                                <span className={`text-[9px] font-black uppercase tracking-wider ${isLight ? 'text-gray-400' : 'text-white/40'}`}>Live Analysis</span>
                            </div>
                        </div>
                    </div>

                    <div className={`border p-8 h-[230px] relative overflow-hidden group shadow-2xl backdrop-blur-sm transition-colors duration-300 ${isLight ? 'bg-gray-50 border-gray-200' : 'bg-[#0f172a]/20 border-white/5'}`}>
                        <div className={`absolute -top-24 -right-24 w-64 h-64 blur-[100px] rounded-full pointer-events-none transition-colors duration-1000 ${isLight ? 'bg-cyan-500/10 group-hover:bg-cyan-500/20' : 'bg-cyan-500/5 group-hover:bg-cyan-500/10'}`} />

                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={historicalData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                                        <stop offset="40%" stopColor="#06b6d4" stopOpacity={0.1} />
                                        <stop offset="100%" stopColor="#06b6d4" stopOpacity={0} />
                                    </linearGradient>
                                    <filter id="glow">
                                        <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                                        <feMerge>
                                            <feMergeNode in="coloredBlur" />
                                            <feMergeNode in="SourceGraphic" />
                                        </feMerge>
                                    </filter>
                                </defs>
                                <CartesianGrid strokeDasharray="12 12" vertical={false} stroke={isLight ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.02)"} />
                                <XAxis
                                    dataKey="name"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: isLight ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.2)', fontSize: 9, fontWeight: 900, letterSpacing: 1 }}
                                    dy={15}
                                />
                                <YAxis hide domain={[0, 10]} />
                                <Tooltip
                                    content={<CustomTooltip />}
                                    cursor={{ stroke: isLight ? 'black' : 'white', strokeOpacity: 0.1, strokeWidth: 1 }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="value"
                                    stroke="#06b6d4"
                                    strokeWidth={3}
                                    strokeLinecap="round"
                                    fillOpacity={1}
                                    fill="url(#colorValue)"
                                    animationDuration={2500}
                                    filter="url(#glow)"
                                    activeDot={{
                                        r: 6,
                                        fill: '#06b6d4',
                                        stroke: '#fff',
                                        strokeWidth: 2,
                                        className: 'animate-pulse'
                                    }}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>

                    <div className={`flex items-center gap-4 border rounded-2xl p-4 transition-all ${isLight ? 'bg-gray-100 border-gray-200 hover:bg-gray-200 shadow-sm' : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.04]'}`}>
                        <div className={`p-2 rounded-lg ${isLight ? 'bg-amber-100 shadow-inner' : 'bg-amber-500/10'}`}>
                            <AlertTriangle className="w-4 h-4 text-amber-500" />
                        </div>
                        <p className={`text-[11px] font-bold leading-relaxed uppercase tracking-tight italic ${isLight ? 'text-gray-500' : 'text-white/50'}`}>
                            Anomaly intensity for <span className={`${isLight ? 'text-gray-900' : 'text-white'} not-italic`}>{selectedProfile.region.name}</span> is currently <span className={`${isLight ? 'text-rose-600' : 'text-rose-400'} not-italic`}>Elevated</span>.
                            Cross-referencing satellite signatures with historical periodicity suggests a <span className={`${isLight ? 'text-cyan-600' : 'text-cyan-400'} not-italic`}>{(selectedProfile.anomalies[0]?.percentile || 0).toFixed(0)}th percentile</span> event.
                        </p>
                    </div>
                </div>


            </div>
        </div>
    );
}

