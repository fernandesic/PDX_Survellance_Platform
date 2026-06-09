import { useMemo } from "react";
import { useDashboardContext } from "@/pages/hdis/context/DashboardContext";
import { RISK_COLORS, RISK_ORDER, PILLAR_CFG } from "@/pages/hdis/constants";
import { RiskBadge } from "@/pages/hdis/components/shared/RiskBadge";
import { SparklineChart } from "@/pages/hdis/components/shared/SparklineChart";
import { SectionHeader } from "@/pages/hdis/components/shared/SectionHeader";

export function TopCountryRisks() {
    const { countries, records, isLoading } = useDashboardContext();

    const cards = useMemo(() => {
        const top = [...(countries ?? [])]
            .filter((c) => c.signal_count > 0)
            .sort(
                (a, b) =>
                    (RISK_ORDER[b.risk_level] ?? 0) - (RISK_ORDER[a.risk_level] ?? 0) ||
                    b.signal_count - a.signal_count,
            )
            .slice(0, 4);

        return top.map((c) => {
            const rec = records?.find(
                (r: any) => r.location_country_iso === c.country_iso || r.country_tags?.includes(c.country_iso),
            );
            const topPillars = Object.entries(c.pillars).sort(([, a], [, b]) => b - a).slice(0, 2);

            const now = Date.now();
            const spark = Array.from({ length: 7 }, (_, i) => {
                const dayStart = now - (6 - i) * 86400000;
                const dayEnd = dayStart + 86400000;
                return (records ?? []).filter((r: any) => {
                    if (r.location_country_iso !== c.country_iso) return false;
                    const t = new Date(r.created_at).getTime();
                    return t >= dayStart && t < dayEnd;
                }).length;
            });

            return {
                ...c,
                headline: rec?.headline ?? "No recent intelligence available",
                topPillars,
                sparkData: spark,
            };
        });
    }, [countries, records]);

    return (
        <div>
            <SectionHeader title="TOP COUNTRY RISKS" />
            {isLoading ? (
                <div className="grid grid-cols-4 gap-2">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="rounded-lg border border-border/30 bg-card px-3 py-2.5 h-[116px]">
                            <div className="w-full h-full animate-pulse flex flex-col justify-between">
                                <div className="flex justify-between items-center">
                                    <div className="h-3 w-20 bg-muted rounded" />
                                    <div className="h-5 w-8 bg-muted rounded" />
                                </div>
                                <div className="h-2 w-full bg-muted rounded mt-1" />
                                <div className="flex gap-1 mt-2">
                                    <div className="h-4 w-12 bg-muted rounded" />
                                    <div className="h-4 w-12 bg-muted rounded" />
                                </div>
                                <div className="h-3 w-16 bg-muted rounded mt-auto" />
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="grid grid-cols-4 gap-2">
                    {cards.map((c) => {
                        const riskColor = RISK_COLORS[c.risk_level] ?? RISK_COLORS.low;
                        return (
                            <div
                                key={c.country_iso}
                                className="rounded-lg border border-border/30 bg-card px-3 py-2.5 hover:border-primary/20 transition-all"
                            >
                                {/* Header */}
                                <div className="flex items-center justify-between mb-1">
                                    <div className="flex items-center gap-1.5">
                                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: riskColor }} />
                                        <span className="text-[15px] font-bold text-foreground">{c.country_name}</span>
                                        <span className="font-mono text-xs text-muted-foreground">{c.country_iso}</span>
                                    </div>
                                    <div className="text-right">
                                        <span className="font-mono text-lg font-bold text-cyan-400">
                                            {c.signal_count}
                                        </span>
                                        <span className="font-mono text-[11px] text-muted-foreground ml-1">signals</span>
                                    </div>
                                </div>

                                <p className="text-sm text-muted-foreground leading-snug line-clamp-1 mb-2">
                                    {c.headline}
                                </p>

                                <div className="flex items-center gap-1.5 flex-wrap mb-2.5">
                                    <RiskBadge level={c.risk_level} />
                                    {c.topPillars.map(([p, cnt]) => {
                                        const cfg = PILLAR_CFG[p];
                                        if (!cfg) return null;
                                        return (
                                            <span key={p} className="font-mono text-[11px] font-bold rounded px-2 py-0.5 border uppercase tracking-wider"
                                                style={{ color: cfg.color, backgroundColor: `${cfg.color}10`, borderColor: `${cfg.color}30` }}>
                                                {cfg.label.toUpperCase()} {cnt}
                                            </span>
                                        );
                                    })}
                                </div>

                                <div className="flex items-center gap-2">
                                    <SparklineChart data={c.sparkData} color={riskColor} width={70} height={20} className="opacity-70" />
                                    <span className="font-mono text-[11px] text-muted-foreground/80 uppercase tracking-wider">Summary 7 day trend</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
