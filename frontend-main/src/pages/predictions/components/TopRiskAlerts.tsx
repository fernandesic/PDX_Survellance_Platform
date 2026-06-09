import { motion } from 'framer-motion';
import { TrendingUp, ChevronUp, ChevronDown, Minus } from 'lucide-react';
import type { OutbreakPrediction } from '@/pages/predictions/types/predictions';
import { RISK_LEVEL_CONFIG, DISEASE_DISPLAY_NAMES } from '@/pages/predictions/types/predictions';
import type { PredictionDisease } from '@/pages/predictions/types/predictions';

interface Props {
    predictions: OutbreakPrediction[];
    onRowClick?: (iso: string) => void;
}

function RiskBadge({ level }: { level: string }) {
    const config = RISK_LEVEL_CONFIG[level as keyof typeof RISK_LEVEL_CONFIG] || RISK_LEVEL_CONFIG.LOW;
    return (
        <span
            className="px-2 py-0.5 rounded-full text-xs font-semibold"
            style={{ backgroundColor: config.bgColor, color: config.color }}
        >
            {config.label}
        </span>
    );
}

function ScoreBar({ score }: { score: number }) {
    const color =
        score >= 75 ? '#ef4444' :
            score >= 50 ? '#f97316' :
                score >= 25 ? '#eab308' : '#22c55e';

    return (
        <div className="flex items-center gap-2 min-w-[120px]">
            <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                <motion.div
                    className="h-full rounded-full"
                    style={{ backgroundColor: color }}
                    initial={{ width: 0 }}
                    animate={{ width: `${score}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                />
            </div>
            <span className="text-xs font-mono w-8 text-right" style={{ color }}>
                {score.toFixed(0)}
            </span>
        </div>
    );
}

function TrendIndicator({ score }: { score: number }) {
    if (score >= 60) return <ChevronUp size={14} className="text-red-400" />;
    if (score >= 40) return <Minus size={14} className="text-yellow-400" />;
    return <ChevronDown size={14} className="text-green-400" />;
}

export default function TopRiskAlerts({ predictions, onRowClick }: Props) {
    return (
        <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 overflow-hidden">
            <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2">
                <TrendingUp size={16} className="text-red-400" />
                <h3 className="text-sm font-semibold text-white">Top Risk Alerts</h3>
                <span className="ml-auto text-xs text-gray-400">{predictions.length} alerts</span>
            </div>

            <div className="overflow-x-auto max-h-[400px] overflow-y-auto custom-sidebar-scrollbar">
                <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-gray-900/95 backdrop-blur-sm">
                        <tr className="text-gray-400 text-xs uppercase tracking-wider">
                            <th className="text-left px-3 py-2">#</th>
                            <th className="text-left px-3 py-2">Country</th>
                            <th className="text-left px-3 py-2">Disease</th>
                            <th className="text-left px-3 py-2">Risk</th>
                            <th className="text-left px-3 py-2">Score</th>
                            <th className="text-left px-3 py-2">Conf.</th>
                            <th className="text-left px-3 py-2">Sources</th>
                        </tr>
                    </thead>
                    <tbody>
                        {predictions.map((pred, i) => (
                            <motion.tr
                                key={`${pred.country_iso}-${pred.disease_name}`}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.05 }}
                                onClick={() => onRowClick?.(pred.country_iso)}
                                className="border-b border-white/5 hover:bg-white/5 cursor-pointer transition-colors"
                            >
                                <td className="px-3 py-2.5 text-gray-500 font-mono text-xs">{i + 1}</td>
                                <td className="px-3 py-2.5">
                                    <div className="flex items-center gap-1.5">
                                        <TrendIndicator score={pred.composite_risk_score} />
                                        <span className="text-white font-medium text-xs">{pred.country_name}</span>
                                    </div>
                                </td>
                                <td className="px-3 py-2.5 text-gray-300 text-xs">
                                    {DISEASE_DISPLAY_NAMES[pred.disease_name as PredictionDisease] || pred.disease_name}
                                </td>
                                <td className="px-3 py-2.5">
                                    <RiskBadge level={pred.risk_level} />
                                </td>
                                <td className="px-3 py-2.5">
                                    <ScoreBar score={pred.composite_risk_score} />
                                </td>
                                <td className="px-3 py-2.5 text-gray-400 text-xs font-mono">
                                    {pred.confidence.toFixed(0)}%
                                </td>
                                <td className="px-3 py-2.5 text-gray-500 text-xs">
                                    {pred.data_sources_used?.length || 0}
                                </td>
                            </motion.tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
