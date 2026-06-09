import type { CHWSummary } from "@/pages/chw/types/chw";
import {
    Users, Globe, MapPin, TrendingUp, AlertTriangle, Shield, CheckCircle, HeartHandshake, Briefcase, FileText
} from "lucide-react";

interface CHWKpiCardsProps {
    isDark: boolean;
    summary: CHWSummary;
    totalChws: number;
    avgPer10k: number;
    wellCovered: number;
    criticalCount: number;
}

export function CHWKpiCards({ isDark, summary, totalChws, avgPer10k, wellCovered, criticalCount }: CHWKpiCardsProps) {
    const cards = [
        { icon: Users, iconColor: 'text-[#22C55E]', iconBg: 'bg-[rgba(34,197,94,0.12)]', title: 'Total CHWs', value: totalChws.toLocaleString(), subtitle: <>across <span className="text-[#22C55E] font-semibold">{summary.total_countries}</span> countries</>, status: { dot: 'bg-[#22C55E]', label: 'Live', color: 'text-[#22C55E]' } },
        { icon: CheckCircle, iconColor: 'text-blue-500', iconBg: 'bg-blue-500/10', title: 'Active CHWs', value: summary.total_active_chws?.toLocaleString() || '0', subtitle: <><span className="text-blue-500 font-semibold">{((summary.total_active_chws / (summary.total_chws || 1)) * 100).toFixed(1)}%</span> of total</>, status: { dot: 'bg-blue-500', label: 'Active', color: 'text-blue-500' } },
        { icon: HeartHandshake, iconColor: 'text-amber-500', iconBg: 'bg-amber-500/10', title: 'Volunteer CHWs', value: summary.total_volunteer_chws?.toLocaleString() || '0', subtitle: <><span className="text-amber-500 font-semibold">{((summary.total_volunteer_chws / (summary.total_chws || 1)) * 100).toFixed(1)}%</span> of total</>, status: { dot: 'bg-amber-500', label: 'Volunteer', color: 'text-amber-500' } },
        { icon: Briefcase, iconColor: 'text-purple-500', iconBg: 'bg-purple-500/10', title: 'Paid CHWs', value: summary.total_paid_chws?.toLocaleString() || '0', subtitle: <><span className="text-purple-500 font-semibold">{((summary.total_paid_chws / (summary.total_chws || 1)) * 100).toFixed(1)}%</span> of total</>, status: { dot: 'bg-purple-500', label: 'Paid', color: 'text-purple-500' } },
        { icon: FileText, iconColor: 'text-emerald-500', iconBg: 'bg-emerald-500/10', title: 'Kobo Submissions', value: summary.kobo_submissions_count?.toLocaleString() || '0', subtitle: <>total <span className="text-emerald-500 font-semibold">submissions</span></>, status: { dot: 'bg-emerald-500', label: 'Live', color: 'text-emerald-500' } },
        { icon: AlertTriangle, iconColor: 'text-emerald-500', iconBg: 'bg-emerald-500/10', title: 'Active CHW Reports', value: summary.active_chw_reports_count?.toLocaleString() || '0', subtitle: <>verified <span className="text-emerald-500 font-semibold">Tier 0 alerts</span></>, status: { dot: 'bg-emerald-500', label: 'Tier 0', color: 'text-emerald-500' } },
        { icon: Globe, iconColor: 'text-[#22C55E]', iconBg: 'bg-[rgba(34,197,94,0.12)]', title: 'Countries', value: summary.total_countries, subtitle: <>WHO <span className="text-[#22C55E] font-semibold">AFRO</span> region</>, status: { dot: 'bg-[#22C55E]', label: 'Active', color: 'text-[#22C55E]' } },
        { icon: TrendingUp, iconColor: 'text-[#22C55E]', iconBg: 'bg-[rgba(34,197,94,0.12)]', title: 'Avg CHW/10k', value: avgPer10k, subtitle: <>weighted <span className="text-[#22C55E] font-semibold">density</span></>, status: { dot: 'bg-[#22C55E]', label: `${Number(avgPer10k) >= 23 ? '✓' : '↓'}`, color: 'text-[#22C55E]' } },
        { icon: MapPin, iconColor: 'text-[#22C55E]', iconBg: 'bg-[rgba(34,197,94,0.12)]', title: 'Regions', value: summary.total_regions, subtitle: <>sub-national <span className="text-[#22C55E] font-semibold">areas</span></>, status: { dot: 'bg-[#22C55E]', label: 'Mapped', color: 'text-[#22C55E]' } },
        { icon: Shield, iconColor: 'text-[#22C55E]', iconBg: 'bg-[rgba(34,197,94,0.12)]', title: 'Well Covered', value: wellCovered, subtitle: <>≥20 per <span className="text-[#22C55E] font-semibold">10k</span></>, status: { dot: 'bg-[#22C55E]', label: 'Good', color: 'text-[#22C55E]' } },
    ];

    return (
        <div className="grid grid-cols-2 md:grid-cols-5 xl:grid-cols-10 gap-3">
            {cards.map((card, idx) => {
                const Icon = card.icon;
                return (
                    <div
                        key={idx}
                        className={`relative rounded-xl p-4 border transition-all duration-300 hover:shadow-lg hover:scale-[1.02] 
                            ${isDark
                                ? 'bg-white/[0.02] backdrop-blur-md border-white/10 hover:bg-white/[0.05]'
                                : 'bg-white shadow-sm border-gray-100 hover:bg-gray-50'}`}
                    >
                        <div className="flex items-center justify-between mb-3">
                            <div className={`p-2 ${card.iconBg} rounded-lg`}>
                                <Icon className={`w-4 h-4 ${card.iconColor}`} />
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className={`w-2 h-2 rounded-full ${card.status.dot} animate-pulse`} />
                                <span className={`text-xs font-semibold ${card.status.color}`}>{card.status.label}</span>
                            </div>
                        </div>
                        <p className={`text-xs font-medium ${isDark ? 'text-[#D1E5DE]' : 'text-gray-600'} mb-1`}>{card.title}</p>
                        <div className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-[#1a1a1a]'} mb-1`}>{card.value}</div>
                        <div className={`text-xs ${isDark ? 'text-[#A8C4BB]' : 'text-gray-600'}`}>{card.subtitle}</div>
                    </div>
                );
            })}
        </div>
    );
}
