import { useRealNews } from "@/pages/hdis/hooks/useRealNews";
import { RiskBadge } from "@/pages/hdis/components/shared/RiskBadge";
import { SectionHeader } from "@/pages/hdis/components/shared/SectionHeader";
import { formatDistanceToNowStrict } from "date-fns";
import { ExternalLink, RefreshCw, Globe, Zap } from "lucide-react";
import { RISK_COLORS, PILLAR_CFG } from "@/pages/hdis/constants";

export function PoliticalAlerts() {
    const { data: realNews, isLoading, isError, refetch, isRefetching } = useRealNews();

    // Split alerts by severity
    const critical = (realNews ?? []).filter(n => n.riskLevel === "critical" || n.riskLevel === "high");
    const other = (realNews ?? []).filter(n => n.riskLevel !== "critical" && n.riskLevel !== "high");

    return (
        <div>
            <SectionHeader title="DIPLOMATIC & POLITICAL ALERTS" />

            <div className="rounded-xl border border-border/30 bg-card overflow-hidden">
                {/* Compact header */}
                <div className="flex items-center justify-between px-4 py-2 border-b border-border/10">
                    <div className="flex items-center gap-2">
                        <Globe size={12} className="text-cyan-400" />
                        <span className="text-muted-foreground text-[13px] font-mono uppercase tracking-wider">
                            {realNews?.length ?? 0} articles
                        </span>
                        {critical.length > 0 && (
                            <span className="flex items-center gap-1 text-[11px] font-mono font-bold text-red-400 bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded">
                                <Zap size={11} /> {critical.length} critical
                            </span>
                        )}
                    </div>
                    <button
                        onClick={() => refetch()}
                        disabled={isRefetching}
                        className="p-1 rounded hover:bg-muted/50 transition-colors"
                    >
                        <RefreshCw size={10} className={`text-muted-foreground/60 ${isRefetching ? 'animate-spin' : ''}`} />
                    </button>
                </div>

                {/* Content */}
                {isLoading ? (
                    <div className="px-4 py-10 text-center">
                        <div className="w-5 h-5 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mx-auto mb-2" />
                        <p className="text-[13px] text-muted-foreground/80 font-mono">Syncing feeds...</p>
                    </div>
                ) : isError ? (
                    <div className="px-4 py-6 text-center text-[13px] text-red-400/60 font-mono">
                        Failed to fetch diplomatic feeds.
                    </div>
                ) : realNews && realNews.length > 0 ? (
                    <div className="grid grid-cols-1 xl:grid-cols-2 divide-y xl:divide-y-0 xl:divide-x divide-border/10">
                        {/* Left: Critical/High alerts */}
                        <div className="max-h-[220px] overflow-y-auto custom-scrollbar">
                            <div className="px-3 py-1.5 bg-red-500/5 border-b border-border/10">
                                <span className="text-[11px] font-mono text-red-400/50 uppercase tracking-widest font-bold">
                                    High Priority
                                </span>
                            </div>
                            {critical.length > 0 ? critical.slice(0, 5).map(item => (
                                <a key={item.id} href={item.link} target="_blank" rel="noopener noreferrer"
                                    className="group flex items-start gap-2.5 px-3 py-2 hover:bg-muted/50 transition-colors border-b border-border/10 last:border-0">
                                    <div className="mt-1 shrink-0">
                                        <span className="block h-1.5 w-1.5 rounded-full"
                                            style={{ backgroundColor: RISK_COLORS[item.riskLevel] || "#888" }} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm text-foreground/80 leading-snug font-medium line-clamp-2 group-hover:text-cyan-400 transition-colors">
                                            {item.title}
                                        </p>
                                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                                            <RiskBadge level={item.riskLevel} />
                                            {item.pillar && PILLAR_CFG[item.pillar] && (
                                                <span className="flex items-center gap-1.5 px-1.5 py-0.5 rounded bg-muted/50 border border-border/10"
                                                    style={{ color: PILLAR_CFG[item.pillar].color }}>
                                                    {(() => {
                                                        const Icon = PILLAR_CFG[item.pillar].icon;
                                                        return <Icon size={8} />;
                                                    })()}
                                                    <span className="text-[11px] font-mono font-bold uppercase tracking-wider">{PILLAR_CFG[item.pillar].label}</span>
                                                </span>
                                            )}
                                            <span className="text-[11px] text-muted-foreground/80 font-mono">{item.source}</span>
                                            <span className="text-[11px] text-muted-foreground/60 font-mono">
                                                {formatDistanceToNowStrict(new Date(item.publishDate), { addSuffix: true })}
                                            </span>
                                        </div>
                                    </div>
                                    <ExternalLink size={9} className="text-muted-foreground/40 group-hover:text-cyan-400 shrink-0 mt-1" />
                                </a>
                            )) : (
                                <div className="px-3 py-6 text-center text-xs text-muted-foreground/60 font-mono italic">
                                    No high-priority alerts
                                </div>
                            )}
                        </div>

                        {/* Right: Other alerts */}
                        <div className="max-h-[220px] overflow-y-auto custom-scrollbar">
                            <div className="px-3 py-1.5 bg-muted/20 border-b border-border/10">
                                <span className="text-[11px] font-mono text-muted-foreground/80 uppercase tracking-widest font-bold">
                                    Monitoring
                                </span>
                            </div>
                            {other.length > 0 ? other.slice(0, 6).map(item => (
                                <a key={item.id} href={item.link} target="_blank" rel="noopener noreferrer"
                                    className="group flex items-start gap-2.5 px-3 py-2 hover:bg-muted/50 transition-colors border-b border-border/10 last:border-0">
                                    <div className="mt-1 shrink-0">
                                        <span className="block h-1.5 w-1.5 rounded-full"
                                            style={{ backgroundColor: RISK_COLORS[item.riskLevel] || "#888" }} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[13px] text-muted-foreground leading-snug line-clamp-1 group-hover:text-cyan-400 transition-colors">
                                            {item.title}
                                        </p>
                                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                            {item.pillar && PILLAR_CFG[item.pillar] && (
                                                <span className="text-[11px] font-mono font-bold uppercase tracking-wider px-1 rounded bg-muted/40 border border-border/10"
                                                    style={{ color: PILLAR_CFG[item.pillar].color }}>
                                                    {PILLAR_CFG[item.pillar].label}
                                                </span>
                                            )}
                                            <span className="text-[11px] text-muted-foreground/80 font-mono">{item.source}</span>
                                            <span className="text-[11px] text-muted-foreground/60 font-mono">
                                                {formatDistanceToNowStrict(new Date(item.publishDate), { addSuffix: true })}
                                            </span>
                                        </div>
                                    </div>
                                </a>
                            )) : (
                                <div className="px-3 py-6 text-center text-xs text-muted-foreground/60 font-mono italic">
                                    No monitoring alerts
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="px-4 py-8 text-center text-[13px] text-muted-foreground/80 font-mono italic">
                        No active diplomatic signals detected.
                    </div>
                )}
            </div>
        </div>
    );
}
