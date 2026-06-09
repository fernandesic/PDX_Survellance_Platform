import { useMemo } from "react";
import { formatDistanceToNow } from "date-fns";
import { ExternalLink } from "lucide-react";
import { useDashboardContext } from "@/pages/hdis/context/DashboardContext";
import { RISK_ORDER, RISK_COLORS, PILLAR_CFG } from "@/pages/hdis/constants";
import { SectionHeader } from "@/pages/hdis/components/shared/SectionHeader";

export function IntelligenceSummary() {
    const { records } = useDashboardContext();

    // Combined feed — critical first, then latest (deduplicated)
    const feed = useMemo(() => {
        if (!records?.length) return [];
        const critical = [...records]
            .filter((r: any) => r.risk_level === "critical" || r.risk_level === "high")
            .sort((a: any, b: any) =>
                (RISK_ORDER[b.risk_level] ?? 0) - (RISK_ORDER[a.risk_level] ?? 0) ||
                new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            ).slice(0, 3);

        const critIds = new Set(critical.map(r => r.id));
        const latest = [...records]
            .filter(r => !critIds.has(r.id))
            .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .slice(0, 4);

        return [...critical, ...latest];
    }, [records]);

    // Key stats
    const stats = useMemo(() => {
        if (!records?.length) return { total: 0, critical: 0, countries: 0, topPillar: "" };
        const crits = records.filter((r: any) => r.risk_level === "critical" || r.risk_level === "high").length;
        const countries = new Set(records.map((r: any) => r.location_country_iso).filter(Boolean)).size;
        const pillarCounts: Record<string, number> = {};
        records.forEach((r: any) => {
            const p = (r.pillar || "").toLowerCase();
            if (p && PILLAR_CFG[p]) pillarCounts[p] = (pillarCounts[p] || 0) + 1;
        });
        const topPillar = Object.entries(pillarCounts).sort(([, a], [, b]) => b - a)[0]?.[0] || "";
        return { total: records.length, critical: crits, countries, topPillar };
    }, [records]);

    // Pillar distribution
    const pillars = useMemo(() => {
        const counts: Record<string, number> = {};
        (records ?? []).forEach((r: any) => {
            const p = (r.pillar || "").toLowerCase();
            if (p && PILLAR_CFG[p]) counts[p] = (counts[p] || 0) + 1;
        });
        const max = Math.max(...Object.values(counts), 1);
        return Object.entries(counts)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 6)
            .map(([key, count]) => ({
                key, label: PILLAR_CFG[key]?.label || key,
                color: PILLAR_CFG[key]?.color || "#666",
                icon: PILLAR_CFG[key]?.icon,
                count, pct: Math.round((count / max) * 100),
            }));
    }, [records]);

    const statItems = [
        { label: "Total Signals", value: stats.total, color: "#3b82f6" },
        { label: "Critical/High", value: stats.critical, color: "#ef4444" },
        { label: "Countries", value: stats.countries, color: "#22c55e" },
        { label: "Top Category", value: PILLAR_CFG[stats.topPillar]?.label || "—", color: PILLAR_CFG[stats.topPillar]?.color || "#888" },
    ];

    return (
        <div>
            <SectionHeader title="INTELLIGENCE SUMMARY" />

            {/* Key stats row */}
            <div className="grid grid-cols-4 gap-2 mb-2">
                {statItems.map(s => (
                    <div key={s.label} className="rounded-lg border border-border/30 bg-card px-3 py-2">
                        <p className="font-mono text-[11px] text-muted-foreground uppercase tracking-widest mb-0.5">{s.label}</p>
                        <p className="font-mono text-lg font-bold leading-none" style={{ color: s.color }}>{s.value}</p>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-[1fr_240px] gap-2">
                {/* Intelligence Feed — unified, deduplicated */}
                <div className="rounded-xl border border-border/30 bg-card overflow-hidden">
                    <div className="px-3 py-1.5 border-b border-border/10 flex items-center justify-between">
                        <span className="text-[11px] font-mono text-muted-foreground uppercase tracking-widest font-bold">
                            Intelligence Feed
                        </span>
                        <span className="text-[11px] font-mono text-muted-foreground/60">{feed.length} items</span>
                    </div>
                    <div className="max-h-[200px] overflow-y-auto custom-scrollbar divide-y divide-border/10">
                        {feed.map((r: any) => {
                            const isCrit = r.risk_level === "critical" || r.risk_level === "high";
                            const cfg = PILLAR_CFG[(r.pillar || "").toLowerCase()];
                            const timeAgo = formatDistanceToNow(new Date(r.source_timestamp || r.created_at), { addSuffix: false });
                            return (
                                <div key={r.id} className={`flex items-start gap-2 px-3 py-2 hover:bg-muted/50 transition-colors ${isCrit ? "bg-red-500/[0.02]" : ""}`}>
                                    <span className="block h-1.5 w-1.5 rounded-full mt-1.5 shrink-0"
                                        style={{ backgroundColor: RISK_COLORS[r.risk_level] || "#888" }} />
                                    <div className="flex-1 min-w-0">
                                        <p className={`text-[13px] leading-snug line-clamp-1 ${isCrit ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                                            {r.headline}
                                        </p>
                                        <div className="flex items-center gap-1.5 mt-0.5">
                                            {isCrit && (
                                                <span className="font-mono text-[10px] font-bold uppercase px-1 py-0.5 rounded border"
                                                    style={{ color: RISK_COLORS[r.risk_level], borderColor: `${RISK_COLORS[r.risk_level]}30`, backgroundColor: `${RISK_COLORS[r.risk_level]}10` }}>
                                                    {r.risk_level}
                                                </span>
                                            )}
                                            {cfg && (
                                                <span className="font-mono text-[10px] rounded px-1 py-0.5 border uppercase"
                                                    style={{ color: cfg.color, borderColor: `${cfg.color}20`, backgroundColor: `${cfg.color}08` }}>
                                                    {cfg.label}
                                                </span>
                                            )}
                                            <span className="text-muted-foreground/60 text-[11px] font-mono">{r.location_country_iso}</span>
                                            <span className="text-muted-foreground/40 text-[11px] font-mono ml-auto">{timeAgo}</span>
                                            {r.source_url && (
                                                <a href={r.source_url} target="_blank" rel="noopener noreferrer"
                                                    onClick={e => e.stopPropagation()} className="text-muted-foreground/40 hover:text-cyan-400">
                                                    <ExternalLink size={12} />
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        {feed.length === 0 && (
                            <div className="py-8 text-center text-xs text-muted-foreground/60 font-mono italic">No intelligence data</div>
                        )}
                    </div>
                </div>

                {/* Pillar Distribution — card grid with icons */}
                <div className="rounded-xl border border-border/30 bg-card overflow-hidden">
                    <div className="px-3 py-1.5 border-b border-border/10">
                        <span className="text-[11px] font-mono text-muted-foreground uppercase tracking-widest font-bold">
                            Signal Distribution
                        </span>
                    </div>
                    <div className="p-2 grid grid-cols-2 gap-1.5">
                        {pillars.map(p => {
                            const Icon = p.icon;
                            return (
                                <div key={p.key} className="rounded-lg bg-muted border border-border/10 px-2.5 py-2 hover:border-border/30 transition-colors">
                                    <div className="flex items-center gap-1.5 mb-1">
                                        {Icon && <Icon size={10} style={{ color: p.color, opacity: 0.5 }} />}
                                        <span className="text-xs text-muted-foreground font-medium truncate">{p.label}</span>
                                    </div>
                                    <div className="flex items-end justify-between">
                                        <span className="font-mono text-sm font-bold" style={{ color: p.color }}>{p.count}</span>
                                        <div className="w-10 h-[3px] bg-muted/60 rounded-full overflow-hidden">
                                            <div className="h-full rounded-full transition-all duration-500"
                                                style={{ width: `${p.pct}%`, backgroundColor: p.color, opacity: 0.5 }} />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
