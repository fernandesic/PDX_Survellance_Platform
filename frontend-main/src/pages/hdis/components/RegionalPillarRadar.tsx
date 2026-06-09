import { useMemo } from "react";
import { useDashboardContext } from "@/pages/hdis/context/DashboardContext";
import { REGIONS, PILLAR_CFG, RISK_ORDER } from "@/pages/hdis/constants";
import { RiskDot } from "@/pages/hdis/components/shared/RiskBadge";

export function RegionalPillarRadar() {
    const { countries } = useDashboardContext();

    const regions = useMemo(() => {
        return Object.entries(REGIONS).map(([name, codes]) => {
            const rc = countries?.filter((c) => codes.includes(c.country_iso)) ?? [];

            // Find top risk level
            let topRisk = "monitoring";
            let maxP = 0;
            rc.forEach((c) => {
                const p = RISK_ORDER[c.risk_level] ?? 0;
                if (p > maxP) { maxP = p; topRisk = c.risk_level; }
            });

            // Aggregate pillars
            const pillarTotals: Record<string, number> = {};
            rc.forEach((c) => {
                Object.entries(c.pillars).forEach(([p, cnt]) => {
                    pillarTotals[p] = (pillarTotals[p] ?? 0) + cnt;
                });
            });

            // Get top 2 pillars + highest risk badge
            const topPillars = Object.entries(pillarTotals)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 2);

            const hasCritical = rc.some((c) => c.critical_count > 0);

            return { name, topRisk, topPillars, hasCritical };
        });
    }, [countries]);

    return (
        <div className="rounded-xl border border-border/40 bg-card p-4 h-full flex flex-col">
            <h3 className="font-mono text-sm font-bold text-foreground tracking-wide mb-3" style={{ fontStyle: "italic" }}>
                Regional Pillar Radar
            </h3>

            <div className="space-y-3 flex-1">
                {regions.map((r) => (
                    <div key={r.name} className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0 shrink-0">
                            <RiskDot level={r.topRisk} size={8} />
                            <span className="text-sm text-foreground">{r.name}</span>
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap justify-end">
                            {r.topPillars.map(([p]) => {
                                const cfg = PILLAR_CFG[p];
                                if (!cfg) return null;
                                return (
                                    <span
                                        key={p}
                                        className="font-mono text-[11px] rounded-full px-2 py-0.5 whitespace-nowrap border"
                                        style={{
                                            color: cfg.color,
                                            backgroundColor: `${cfg.color}10`,
                                            borderColor: `${cfg.color}30`,
                                        }}
                                    >
                                        {cfg.label.toUpperCase()}
                                        {r.hasCritical && (
                                            <span style={{ color: "#ef4444" }}> (● CRITICAL)</span>
                                        )}
                                    </span>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
