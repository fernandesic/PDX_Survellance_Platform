import { motion } from 'framer-motion';
import { Shield, BarChart3 } from 'lucide-react';
import type { OutbreakPrediction, PredictionsSummary } from '@/pages/predictions/types/predictions';
import { RISK_LEVEL_CONFIG } from '@/pages/predictions/types/predictions';

interface Props {
    summary: PredictionsSummary | null;
    topRisks: OutbreakPrediction[];
}

function ConfidenceGauge({ value }: { value: number }) {
    const angle = (value / 100) * 180 - 90; // -90 to 90 degrees
    const color =
        value >= 70 ? '#22c55e' :
            value >= 50 ? '#eab308' :
                value >= 30 ? '#f97316' : '#ef4444';

    return (
        <div className="relative w-32 h-16 mx-auto">
            {/* Background arc */}
            <svg viewBox="0 0 120 60" className="w-full h-full">
                <path
                    d="M 10 55 A 50 50 0 0 1 110 55"
                    fill="none"
                    stroke="rgba(255,255,255,0.1)"
                    strokeWidth="8"
                    strokeLinecap="round"
                />
                <path
                    d="M 10 55 A 50 50 0 0 1 110 55"
                    fill="none"
                    stroke={color}
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={`${(value / 100) * 157} 157`}
                    className="transition-all duration-1000"
                />
                {/* Needle */}
                <line
                    x1="60" y1="55"
                    x2={60 + 35 * Math.cos((angle * Math.PI) / 180)}
                    y2={55 - 35 * Math.sin((-angle * Math.PI) / 180)}
                    stroke="white"
                    strokeWidth="2"
                    strokeLinecap="round"
                />
                <circle cx="60" cy="55" r="3" fill="white" />
            </svg>
            <div className="absolute bottom-0 left-0 right-0 text-center">
                <span className="text-lg font-bold" style={{ color }}>
                    {value.toFixed(0)}%
                </span>
            </div>
        </div>
    );
}

function SourceBreakdown({ predictions }: { predictions: OutbreakPrediction[] }) {
    // Average component scores across top predictions
    const avg = (key: keyof OutbreakPrediction) => {
        if (predictions.length === 0) return 0;
        const values = predictions.map(p => Number(p[key]) || 0);
        return values.reduce((a, b) => a + b, 0) / values.length;
    };

    const sources = [
        { name: 'STAR', score: avg('star_score'), color: '#f59e0b', dummy: false },
        // COMMENTED OUT: Fake climate score
        // { name: 'Climate', score: avg('climate_score'), color: '#3b82f6', dummy: true },
        { name: 'Sentinel', score: avg('sentinel_score'), color: '#ef4444', dummy: false },
        { name: 'IHR', score: avg('espar_score'), color: '#8b5cf6', dummy: false },
        { name: 'Readiness', score: avg('readiness_score'), color: '#22c55e', dummy: false },
    ];

    return (
        <div className="space-y-2">
            {sources.map(src => (
                <div key={src.name} className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 w-16 flex items-center gap-1">
                        {src.name}
                        {src.dummy && (
                            <span className="px-1 py-px rounded text-[8px] font-bold bg-yellow-500/15 text-yellow-400 border border-yellow-500/30 leading-none">
                                DUMMY
                            </span>
                        )}
                    </span>
                    <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
                        <motion.div
                            className="h-full rounded-full"
                            style={{ backgroundColor: src.color }}
                            initial={{ width: 0 }}
                            animate={{ width: `${src.score}%` }}
                            transition={{ duration: 1, ease: 'easeOut' }}
                        />
                    </div>
                    <span className="text-xs font-mono w-8 text-right text-gray-400">
                        {src.score.toFixed(0)}
                    </span>
                </div>
            ))}
        </div>
    );
}

export default function ModelConfidence({ summary, topRisks }: Props) {
    const avgConfidence = summary?.avg_confidence || 0;

    // Risk level distribution
    const distribution = [
        { level: 'CRITICAL', count: summary?.critical_count || 0 },
        { level: 'HIGH', count: summary?.high_count || 0 },
        {
            level: 'MEDIUM',
            count: (summary?.total_predictions || 0) - (summary?.critical_count || 0) - (summary?.high_count || 0),
        },
    ];

    return (
        <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 overflow-hidden">
            <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2">
                <Shield size={16} className="text-purple-400" />
                <h3 className="text-sm font-semibold text-white">Model Confidence</h3>
            </div>

            <div className="p-4 space-y-4">
                {/* Gauge */}
                <div>
                    <p className="text-xs text-gray-400 text-center mb-1">Overall Confidence</p>
                    <ConfidenceGauge value={avgConfidence} />
                </div>

                {/* Risk Distribution */}
                <div>
                    <p className="text-xs text-gray-400 mb-2 flex items-center gap-1">
                        <BarChart3 size={12} />
                        Risk Distribution
                    </p>
                    <div className="flex gap-1 h-3 rounded-full overflow-hidden bg-white/5">
                        {distribution.map(d => {
                            const config = RISK_LEVEL_CONFIG[d.level as keyof typeof RISK_LEVEL_CONFIG];
                            const pct = summary?.total_predictions
                                ? (d.count / summary.total_predictions) * 100
                                : 0;
                            return (
                                <motion.div
                                    key={d.level}
                                    className="h-full"
                                    style={{ backgroundColor: config?.color, width: `${pct}%` }}
                                    initial={{ width: 0 }}
                                    animate={{ width: `${pct}%` }}
                                    transition={{ duration: 0.8 }}
                                    title={`${config?.label}: ${d.count}`}
                                />
                            );
                        })}
                    </div>
                    <div className="flex justify-between mt-1">
                        {distribution.map(d => {
                            const config = RISK_LEVEL_CONFIG[d.level as keyof typeof RISK_LEVEL_CONFIG];
                            return (
                                <span key={d.level} className="text-[10px]" style={{ color: config?.color }}>
                                    {config?.label}: {d.count}
                                </span>
                            );
                        })}
                    </div>
                </div>

                {/* Source Score Breakdown */}
                <div>
                    <p className="text-xs text-gray-400 mb-2">Avg. Source Scores (Top Risks)</p>
                    <SourceBreakdown predictions={topRisks.slice(0, 10)} />
                </div>
            </div>
        </div>
    );
}
