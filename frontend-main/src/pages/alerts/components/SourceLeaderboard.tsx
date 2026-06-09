// @ts-nocheck
import React from 'react';
import { Shield, ExternalLink, TrendingUp, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface Source {
    id: number;
    source_name: string;
    source_url: string | null;
    source_type: string;
    tier: number;
    credibility_score: number;
    total_signals: number;
    validated_signals: number;
    false_positive_count: number;
    last_signal_at: string | null;
}

interface SourceLeaderboardProps {
    sources: Source[];
}

const tierLabel = (t: number) => t === 1 ? 'Official' : t === 2 ? 'Verified' : 'Unverified';
const tierStyle = (t: number) => t === 1 ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' : t === 2 ? 'text-blue-400 bg-blue-500/10 border-blue-500/20' : 'text-slate-500 bg-white/5 border-white/5';

export const SourceLeaderboard: React.FC<SourceLeaderboardProps> = ({ sources }) => {
    if (!sources.length) return null;

    const sorted = [...sources].sort((a, b) => b.credibility_score - a.credibility_score);

    return (
        <div className="bg-[#0B1120] rounded-[2rem] border border-white/5 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h3 className="text-base font-black text-white uppercase tracking-tight flex items-center gap-2">
                        <Shield className="w-4 h-4 text-emerald-400" /> Source Credibility
                    </h3>
                    <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">
                        {sources.length} intelligence sources ranked
                    </span>
                </div>
            </div>

            <div className="space-y-2">
                {sorted.map((src, i) => {
                    const validationRate = src.total_signals > 0 ? Math.round((src.validated_signals / src.total_signals) * 100) : 0;
                    const credColor = src.credibility_score >= 70 ? 'text-emerald-400' : src.credibility_score >= 40 ? 'text-amber-400' : 'text-red-400';
                    const credBg = src.credibility_score >= 70 ? 'bg-emerald-500' : src.credibility_score >= 40 ? 'bg-amber-500' : 'bg-red-500';

                    return (
                        <div key={src.id} className="flex items-center gap-3 bg-white/[0.02] rounded-xl p-3 border border-white/5 hover:bg-white/[0.04] transition-colors">
                            {/* Rank */}
                            <span className={`text-lg font-black w-6 text-center shrink-0 ${i === 0 ? 'text-amber-400' : i === 1 ? 'text-slate-300' : i === 2 ? 'text-orange-400' : 'text-slate-600'}`}>
                                {i + 1}
                            </span>

                            {/* Source Info */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                    <span className="text-xs font-black text-white truncate">{src.source_name}</span>
                                    <span className={`text-[7px] font-black px-1.5 py-0.5 rounded border uppercase ${tierStyle(src.tier)}`}>
                                        {tierLabel(src.tier)}
                                    </span>
                                    <span className="text-[8px] font-bold text-slate-600 uppercase">{src.source_type}</span>
                                </div>
                                <div className="flex items-center gap-3 text-[9px]">
                                    <span className="font-bold text-slate-500 flex items-center gap-1">
                                        <TrendingUp className="w-2.5 h-2.5" /> {src.total_signals} signals
                                    </span>
                                    <span className="font-bold text-emerald-500 flex items-center gap-1">
                                        <CheckCircle2 className="w-2.5 h-2.5" /> {src.validated_signals} validated
                                    </span>
                                    {src.false_positive_count > 0 && (
                                        <span className="font-bold text-red-400 flex items-center gap-1">
                                            <AlertTriangle className="w-2.5 h-2.5" /> {src.false_positive_count} FP
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Credibility Score Bar */}
                            <div className="w-28 shrink-0">
                                <div className="flex items-center justify-between mb-0.5">
                                    <span className="text-[7px] font-black text-slate-600 uppercase">Credibility</span>
                                    <span className={`text-[10px] font-black ${credColor}`}>{src.credibility_score}%</span>
                                </div>
                                <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                                    <div className={`h-full rounded-full ${credBg}`} style={{ width: `${src.credibility_score}%` }} />
                                </div>
                            </div>

                            {/* Validation Rate */}
                            <div className="w-16 text-center shrink-0">
                                <span className="text-[7px] font-black text-slate-600 uppercase block">Valid %</span>
                                <span className="text-xs font-black text-white">{validationRate}%</span>
                            </div>

                            {/* Link */}
                            {src.source_url && (
                                <a href={src.source_url} target="_blank" rel="noreferrer" className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-500 hover:text-blue-400 transition-all shrink-0">
                                    <ExternalLink className="w-3 h-3" />
                                </a>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
