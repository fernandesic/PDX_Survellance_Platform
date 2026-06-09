import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { useMemo } from "react";
import { format, subDays, isAfter } from "date-fns";
import { useDashboardContext } from "@/pages/hdis/context/DashboardContext";
import { REGIONS, PILLAR_CFG, RISK_ORDER } from "@/pages/hdis/constants";
import { RiskDot } from "@/pages/hdis/components/shared/RiskBadge";

export function RightPanel() {
    const { records, countries } = useDashboardContext();

    const chartData = useMemo(() => {
        const days = 14;
        const cutoff = subDays(new Date(), days);
        const buckets: Record<string, any> = {};
        for (let i = days - 1; i >= 0; i--) {
            const d = format(subDays(new Date(), i), "MMM dd");
            buckets[d] = { date: d, low: 0, med: 0, high: 0, crit: 0 };
        }
        records?.forEach((r: any) => {
            const dateStr = r.source_timestamp || r.created_at;
            if (!dateStr) return;
            const date = new Date(dateStr);
            if (!isAfter(date, cutoff)) return;
            const day = format(date, "MMM dd");
            if (buckets[day]) {
                const rsk = (r.risk_level || "low").toLowerCase();
                if (rsk === "critical") buckets[day].crit++;
                else if (rsk === "high") buckets[day].high++;
                else if (rsk === "medium") buckets[day].med++;
                else buckets[day].low++;
            }
        });
        return Object.values(buckets);
    }, [records]);

    const regions = useMemo(() => {
        return Object.entries(REGIONS).map(([name, codes]) => {
            const rc = countries?.filter((c) => codes.includes(c.country_iso)) ?? [];
            let topRisk = "monitoring";
            let maxP = 0;
            rc.forEach((c) => {
                const p = RISK_ORDER[c.risk_level] ?? 0;
                if (p > maxP) { maxP = p; topRisk = c.risk_level; }
            });
            const pillarTotals: Record<string, number> = {};
            rc.forEach((c) => {
                Object.entries(c.pillars).forEach(([p, cnt]) => {
                    pillarTotals[p] = (pillarTotals[p] ?? 0) + cnt;
                });
            });
            const topPillar = Object.entries(pillarTotals).sort(([, a], [, b]) => b - a)[0];
            const hasCritical = rc.some((c) => c.critical_count > 0);
            return { name, topRisk, topPillar, hasCritical };
        });
    }, [countries]);

    return (
        <div className="rounded-xl border border-border/20 bg-card h-full flex flex-col overflow-hidden">

            <div className="px-3 pt-3 pb-1">
                <ResponsiveContainer width="100%" height={130}>
                    <BarChart data={chartData} margin={{ top: 0, right: 0, left: -25, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                        <XAxis
                            dataKey="date"
                            tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))", fontFamily: "monospace" }}
                            axisLine={false} tickLine={false} interval={1}
                        />
                        <YAxis
                            tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))", fontFamily: "monospace" }}
                            axisLine={false} tickLine={false} allowDecimals={false}
                        />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))",
                                borderRadius: 8, fontSize: 10, color: "hsl(var(--card-foreground))",
                            }}
                        />
                        <Bar dataKey="crit" stackId="a" fill="#ef4444" barSize={12} radius={[0, 0, 0, 0]} />
                        <Bar dataKey="high" stackId="a" fill="#f97316" barSize={12} radius={[0, 0, 0, 0]} />
                        <Bar dataKey="med" stackId="a" fill="#f59e0b" barSize={12} radius={[0, 0, 0, 0]} />
                        <Bar dataKey="low" stackId="a" fill="#fbbf24" barSize={12} radius={[2, 2, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </div>

            <div className="border-t border-border/10 mx-3" />

            <div className="px-3 pt-3 pb-3 flex-1">
                <h3 className="text-base font-bold text-foreground mb-3 tracking-tight">
                    Regional Pillar Radar
                </h3>
                <div className="space-y-3">
                    {regions.map((r) => (
                        <div key={r.name} className="flex items-center justify-between group">
                            <div className="flex items-center gap-2.5">
                                <RiskDot level={r.topRisk} size={8} />
                                <span className="text-sm font-medium text-foreground/90 transition-colors">
                                    {r.name}
                                </span>
                            </div>

                            {r.topPillar ? (
                                <div
                                    className="flex items-center gap-1 px-2.5 py-1 rounded-md border border-border/10 bg-muted/30"
                                    style={{ color: PILLAR_CFG[r.topPillar[0]]?.color ?? "#888" }}
                                >
                                    <span className="font-mono text-xs font-bold tracking-wider uppercase">
                                        {(PILLAR_CFG[r.topPillar[0]]?.label ?? r.topPillar[0])}
                                    </span>
                                    {r.hasCritical && (
                                        <>
                                            <span className="font-mono text-xs font-bold text-muted-foreground/50 ml-0.5">(</span>
                                            <span className="h-1 w-1 rounded-full bg-red-600 shadow-[0_0_4px_rgba(239,68,68,0.6)] mx-0.5" />
                                            <span className="font-mono text-xs font-bold text-muted-foreground/50 uppercase">Critical)</span>
                                        </>
                                    )}
                                </div>
                            ) : (
                                <div className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-muted border border-border/10">
                                    <span className="font-mono text-xs font-bold text-muted-foreground/40 uppercase tracking-wider">(</span>
                                    <span className="h-1 w-1 rounded-full bg-slate-500/30 mx-0.5" />
                                    <span className="font-mono text-xs font-bold text-muted-foreground/40 uppercase tracking-wider">Critical)</span>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
