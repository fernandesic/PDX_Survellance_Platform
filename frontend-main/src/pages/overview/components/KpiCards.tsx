import { Users, Shield, AlertTriangle, Activity, Globe, BarChart3 } from "lucide-react";

interface KpiCardsProps {
    overviewData: any;
    isLight: boolean;
}

export function KpiCards({ overviewData, isLight }: KpiCardsProps) {
    const kpiCardsConfig = [
        {
            icon: Globe,
            iconColor: 'text-blue-400',
            iconBg: 'bg-blue-500/10',
            borderColor: 'border-blue-500/20',
            title: 'PDX Active',
            value: overviewData?.pdx?.countries ?? null,
            subtitle: overviewData ? <>active <span className="text-blue-400">member states</span></> : null,
            status: { dot: 'bg-blue-400', label: 'Live', color: 'text-blue-400' },
            source: overviewData?.pdx?.source
        },
        {
            icon: Users,
            iconColor: 'text-cyan-400',
            iconBg: 'bg-cyan-500/10',
            borderColor: 'border-cyan-500/20',
            title: 'Total CHWs',
            value: overviewData?.chw?.total_chw != null ? overviewData.chw.total_chw.toLocaleString() : null,
            subtitle: overviewData ? <>across <span className="text-cyan-400">{overviewData.chw?.countries?.length ?? 0}</span> countries</> : null,
            status: { dot: 'bg-green-400', label: 'Live', color: 'text-green-400' },
            source: overviewData?.chw?.source
        },
        {
            icon: BarChart3,
            iconColor: 'text-amber-400',
            iconBg: 'bg-amber-500/10',
            borderColor: 'border-amber-500/20',
            title: 'IHR Avg Score',
            value: overviewData?.espar?.avg_score != null ? (overviewData.espar.avg_score > 0 ? `${overviewData.espar.avg_score.toFixed(1)}/5` : '—') : null,
            subtitle: overviewData ? <><span className="text-amber-400">{overviewData.espar?.countries?.length ?? 0}</span> countries assessed</> : null,
            status: overviewData?.espar?.avg_score != null ? {
                dot: overviewData.espar.avg_score >= 3 ? 'bg-green-400' : overviewData.espar.avg_score >= 2 ? 'bg-amber-400' : 'bg-red-400',
                label: overviewData.espar.avg_score >= 3 ? 'On Track' : overviewData.espar.avg_score >= 2 ? 'Watch' : 'Alert',
                color: overviewData.espar.avg_score >= 3 ? 'text-green-400' : overviewData.espar.avg_score >= 2 ? 'text-amber-400' : 'text-red-400'
            } : { dot: 'bg-amber-400', label: '...', color: 'text-amber-400' },
            source: overviewData?.espar?.source
        },
        {
            icon: AlertTriangle,
            iconColor: 'text-red-400',
            iconBg: 'bg-red-500/10',
            borderColor: 'border-red-500/20',
            title: 'PAMI Active',
            value: overviewData?.pami?.countries ?? null,
            subtitle: overviewData ? <><span className="text-red-400">{overviewData.pami?.active_countries?.length ?? 0}</span> countries with PAMIs</> : null,
            status: { dot: 'bg-red-400', label: 'Alert', color: 'text-red-400' },
            source: overviewData?.pami?.source
        },
        {
            icon: Activity,
            iconColor: 'text-green-400',
            iconBg: 'bg-green-500/10',
            borderColor: 'border-green-500/20',
            title: 'Readiness Index',
            value: (() => {
                const summary = overviewData?.readiness?.summary;
                if (!summary || typeof summary !== 'object') return null;
                const items = Object.values(summary) as any[];
                if (items.length === 0) return null;
                const total = items.reduce((acc, item) => acc + (item?.completion_pct ?? 0), 0);
                return `${Math.round(total / items.length)}%`;
            })(),
            subtitle: overviewData ? <>average <span className="text-green-400">completion</span></> : null,
            status: { dot: 'bg-green-400', label: 'Live', color: 'text-green-400' },
            source: overviewData?.readiness?.source
        },
        {
            icon: Shield,
            iconColor: 'text-purple-400',
            iconBg: 'bg-purple-500/10',
            borderColor: 'border-purple-500/20',
            title: 'STAR Tracker',
            value: overviewData?.stardata?.countries ?? null,
            subtitle: overviewData ? <>verified <span className="text-purple-400">country counts</span></> : null,
            status: { dot: 'bg-purple-400', label: 'Live', color: 'text-purple-400' },
            source: overviewData?.stardata?.source
        }
    ];

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
            {kpiCardsConfig.map((card, idx) => {
                const Icon = card.icon;
                return (
                    <div
                        key={idx}
                        className={`relative flex flex-col justify-between ${isLight ? 'bg-white/80 backdrop-blur-md border-gray-100' : `bg-[#0a1128] ${card.borderColor}`} rounded-xl p-4 border hover:border-opacity-100 hover:shadow-lg hover:scale-[1.02] ${isLight ? 'hover:bg-gray-50' : 'hover:bg-[#0d1530]'} transition-all duration-300`}
                    >
                        <div>
                            <div className="flex items-center justify-between mb-3">
                                <div className={`p-2 ${card.iconBg} rounded-lg`}>
                                    <Icon className={`w-4 h-4 ${card.iconColor}`} />
                                </div>
                                <div className="flex items-center gap-1">
                                    <div className={`w-1.5 h-1.5 rounded-full ${card.status.dot} animate-pulse`}></div>
                                    <span className={`text-[10px] font-medium ${card.status.color}`}>{card.status.label}</span>
                                </div>
                            </div>
                            <p className={`text-[10px] ${isLight ? 'text-gray-600' : 'text-gray-400'} mb-1 font-medium tracking-tight uppercase`}>{card.title}</p>
                            {card.value !== null && card.value !== undefined ? (
                                <>
                                    <div className={`text-xl font-bold ${isLight ? 'text-[#1a1a1a]' : 'text-white'} mb-1`}>{card.value}</div>
                                    <div className={`text-[11px] ${isLight ? 'text-gray-600' : 'text-gray-500'} mb-3`}>
                                        {card.subtitle}
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className={`h-6 w-16 rounded ${isLight ? 'bg-gray-200' : 'bg-white/[0.06]'} mb-1`} style={{ animation: 'skeleton-breathe 2.4s ease-in-out infinite' }} />
                                    <div className={`h-3 w-24 rounded ${isLight ? 'bg-gray-200' : 'bg-white/[0.06]'} mb-3`} style={{ animation: 'skeleton-breathe 2.4s ease-in-out infinite', animationDelay: '0.3s' }} />
                                </>
                            )}
                        </div>
                        {card.source && (
                            <div className="mt-auto pt-2 border-t border-white/5 flex items-center gap-1.5 text-[9px] text-gray-500">
                                <span className="shrink-0 font-medium">Source:</span>
                                <span className="truncate italic">{card.source}</span>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
