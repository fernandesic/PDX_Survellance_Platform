import { motion } from 'framer-motion';
import { Database, Radio, Clock, CheckCircle } from 'lucide-react';
import type { PredictionModel } from '@/pages/predictions/types/predictions';

interface Props {
    models: PredictionModel[];
}

const MODEL_ICONS: Record<string, { icon: typeof Database; color: string }> = {
    'STAR': { icon: Radio, color: '#f59e0b' },
    'CLIMATE': { icon: Database, color: '#3b82f6' },
    'SENTINEL': { icon: Radio, color: '#ef4444' },
    'ESPAR': { icon: CheckCircle, color: '#8b5cf6' },
    'READINESS': { icon: CheckCircle, color: '#22c55e' },
    'COMPOSITE': { icon: Database, color: '#06b6d4' },
};

function formatTimeSince(dateStr: string | null): string {
    if (!dateStr) return 'Never';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
}

export default function SourceAttribution({ models }: Props) {
    const displayModels = models.filter(m => m.model_type !== 'COMPOSITE');

    return (
        <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 overflow-hidden">
            <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2">
                <Database size={16} className="text-cyan-400" />
                <h3 className="text-sm font-semibold text-white">Data Sources</h3>
                <span className="ml-auto text-xs text-gray-400">{displayModels.length} active</span>
            </div>

            <div className="p-3 grid grid-cols-1 gap-2">
                {displayModels.map((model, i) => {
                    const config = MODEL_ICONS[model.model_type] || MODEL_ICONS['COMPOSITE'];
                    const Icon = config.icon;

                    return (
                        <motion.div
                            key={model.id}
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.1 }}
                            className="flex items-center gap-3 p-2.5 rounded-lg bg-white/[0.03] border border-white/5 hover:border-white/10 transition-colors"
                        >
                            {/* Status dot + Icon */}
                            <div className="relative">
                                <div
                                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                                    style={{ backgroundColor: `${config.color}15` }}
                                >
                                    <Icon size={14} style={{ color: config.color }} />
                                </div>
                                {model.is_active && (
                                    <span
                                        className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full"
                                        style={{ backgroundColor: config.color }}
                                    />
                                )}
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-white truncate">{model.name}</p>
                                <p className="text-[10px] text-gray-500 truncate">{model.description}</p>
                            </div>

                            {/* Weight + Last Run */}
                            <div className="text-right flex-shrink-0">
                                <p className="text-xs font-mono" style={{ color: config.color }}>
                                    {(model.weight * 100).toFixed(0)}%
                                </p>
                                <div className="flex items-center gap-0.5 text-[10px] text-gray-500">
                                    <Clock size={8} />
                                    {formatTimeSince(model.last_run)}
                                </div>
                            </div>
                        </motion.div>
                    );
                })}
            </div>
        </div>
    );
}
