import { useNavigate } from "react-router-dom";
import { useMemo } from "react";
import { Radio, AlertTriangle, Globe, Activity, FileText } from "lucide-react";
import { useDashboardContext } from "@/pages/hdis/context/DashboardContext";

export function SituationOverview() {
    const { stats, records, briefings, isLoading } = useDashboardContext();
    const navigate = useNavigate();


    const recentCount = useMemo(() => {
        const weekAgo = Date.now() - 7 * 86400000;
        return (records ?? []).filter(r => new Date(r.created_at).getTime() > weekAgo).length;
    }, [records]);

    const recentCritical = useMemo(() => {
        const weekAgo = Date.now() - 7 * 86400000;
        return (records ?? []).filter(r => r.risk_level === "critical" && new Date(r.created_at).getTime() > weekAgo).length;
    }, [records]);

    const kpis = [
        {
            label: "ACTIVE RECORDS", value: stats?.total_records ?? 0,
            sub: `+${recentCount} this week`, color: "#3b82f6",
            icon: Radio, onClick: () => navigate("/hdis/feed"),
        },
        {
            label: "CRITICAL ALERTS", value: stats?.critical_alerts ?? 0,
            sub: recentCritical > 0 ? `+${recentCritical} this week` : "No new this week",
            color: "#ef4444", icon: AlertTriangle,
            onClick: () => navigate("/hdis/alerts"),
        },
        {
            label: "Countries Monitored", value: stats?.countries_monitored ?? 0,
            sub: `${stats?.countries_monitored ?? 0} monitored`, color: "#22c55e",
            icon: Globe, onClick: () => navigate("/hdis/countries"),
        },
        {
            label: "SOURCES", value: stats?.active_sources ?? 0,
            sub: `${stats?.active_sources ?? 0} active feeds`, color: "#f59e0b", icon: Activity,
        },
        {
            label: "LEADERSHIP BRIEFINGS", value: briefings?.length ?? 0,
            sub: `${briefings?.length ?? 0} published`, color: "#8b5cf6",
            icon: FileText, onClick: () => navigate("/hdis/briefings"),
        },
    ];

    return (
        <div>
            {isLoading ? (
                <div className="grid grid-cols-5 gap-2">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="h-[73px] flex items-center justify-center rounded-lg border border-border/30 bg-card">
                            <div className="w-full h-full animate-pulse px-2.5 py-2 flex flex-col justify-between">
                                <div className="h-2.5 w-16 bg-muted rounded" />
                                <div className="h-5 w-8 bg-muted rounded" />
                                <div className="h-1.5 w-24 bg-muted rounded" />
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="grid grid-cols-5 gap-2">
                    {kpis.map((k) => {
                        const Icon = k.icon;
                        return (
                            <button
                                key={k.label}
                                onClick={k.onClick}
                                className="group text-left rounded-lg border border-border/30 bg-card px-2.5 py-2 transition-all hover:border-primary/30"
                            >
                                <div className="flex items-center justify-between mb-0.5">
                                    <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                                        {k.label}
                                    </p>
                                    <div className="rounded p-1" style={{ backgroundColor: `${k.color}10`, border: `1px solid ${k.color}15` }}>
                                        <Icon className="h-3.5 w-3.5" style={{ color: k.color, opacity: 0.7 }} />
                                    </div>
                                </div>
                                <p className="font-mono text-xl font-bold tracking-tight leading-none text-foreground">
                                    {k.value}
                                </p>
                                <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                                    <span style={{ color: k.color, opacity: 0.8 }}>{k.sub.split(' ')[0]}</span>
                                    {k.sub.substring(k.sub.indexOf(' '))}
                                </p>
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
