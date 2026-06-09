// @ts-nocheck
import React from 'react';
import { Globe } from 'lucide-react';

interface IHRSummaryItem {
    id: number;
    category: { id: number; category: string };
    afro: number;
    global_t: number;
    contribution: string;
}

interface IHRCategorySummaryProps {
    summary: IHRSummaryItem[];
}

const CATEGORY_LABELS: Record<string, string> = {
    simulation_exercise: 'Simulation Exercises',
    after_action_review: 'After Action Reviews',
    intra_action_review: 'Intra Action Reviews',
    early_action_review: 'Early Action Reviews',
    naphs: 'NAPHS',
    nbws: 'NBWS',
    jee: 'JEE',
    risk_profiling: 'Risk Profiling',
};

const CATEGORY_COLORS: string[] = [
    '#6366f1', '#ec4899', '#14b8a6', '#f97316', '#8b5cf6', '#06b6d4', '#ef4444', '#22c55e',
];

export const IHRCategorySummary: React.FC<IHRCategorySummaryProps> = ({ summary }) => {
    if (!summary.length) return null;

    const totalAfro = summary.reduce((s, d) => s + d.afro, 0);
    const totalGlobal = summary.reduce((s, d) => s + d.global_t, 0);

    return (
        <div className="bg-[#0B1120] rounded-[2rem] border border-white/5 shadow-sm p-5">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h3 className="text-base font-black text-white uppercase tracking-tight flex items-center gap-2">
                        <Globe className="w-4 h-4 text-blue-400" /> IHR Category Overview
                    </h3>
                    <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">
                        AFRO vs Global comparison across {summary.length} categories
                    </span>
                </div>
                <div className="flex items-center gap-3">
                    <div className="text-center">
                        <span className="text-[7px] font-black text-slate-600 uppercase block">AFRO Total</span>
                        <span className="text-sm font-black text-blue-400">{totalAfro}</span>
                    </div>
                    <div className="text-center">
                        <span className="text-[7px] font-black text-slate-600 uppercase block">Global Total</span>
                        <span className="text-sm font-black text-white">{totalGlobal}</span>
                    </div>
                </div>
            </div>

            {/* Category Cards */}
            <div className="grid grid-cols-4 gap-3">
                {summary.map((item, i) => {
                    const catName = typeof item.category === 'object' ? item.category.category : item.category;
                    const label = CATEGORY_LABELS[catName] || catName.replace(/_/g, ' ');
                    const contribution = parseFloat(item.contribution as string) || 0;
                    const color = CATEGORY_COLORS[i % CATEGORY_COLORS.length];
                    const maxVal = Math.max(...summary.map(s => s.global_t), 1);
                    const afroPct = item.global_t > 0 ? (item.afro / item.global_t) * 100 : 0;

                    return (
                        <div key={item.id} className="bg-white/[0.02] rounded-xl p-3 border border-white/5 hover:bg-white/[0.04] transition-colors">
                            <div className="flex items-center gap-2 mb-2">
                                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider truncate">{label}</span>
                            </div>

                            {/* AFRO vs Global bars */}
                            <div className="space-y-1.5 mb-2">
                                <div>
                                    <div className="flex justify-between mb-0.5">
                                        <span className="text-[7px] font-black text-blue-400 uppercase">AFRO</span>
                                        <span className="text-[10px] font-black text-white">{item.afro}</span>
                                    </div>
                                    <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                                        <div className="h-full bg-blue-500 rounded-full transition-all duration-500" style={{ width: `${(item.afro / maxVal) * 100}%` }} />
                                    </div>
                                </div>
                                <div>
                                    <div className="flex justify-between mb-0.5">
                                        <span className="text-[7px] font-black text-slate-500 uppercase">Global</span>
                                        <span className="text-[10px] font-black text-slate-400">{item.global_t}</span>
                                    </div>
                                    <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${(item.global_t / maxVal) * 100}%`, backgroundColor: color, opacity: 0.5 }} />
                                    </div>
                                </div>
                            </div>

                            {/* Contribution */}
                            <div className="flex items-center justify-between pt-2 border-t border-white/5">
                                <span className="text-[7px] font-black text-slate-600 uppercase">Contribution</span>
                                <span className={`text-[10px] font-black ${contribution >= 30 ? 'text-emerald-400' : contribution >= 15 ? 'text-amber-400' : 'text-slate-500'}`}>
                                    {contribution.toFixed(1)}%
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
