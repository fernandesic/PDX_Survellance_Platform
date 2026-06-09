import { useMemo } from "react";
import { Icon } from "@iconify/react";
import type { BorderSignalSummary } from "../services/poe";

/* ── Trend helpers ───────────────────────────────────────────── */

const TREND_CONFIG = {
    increasing: { icon: "mdi:trending-up", color: "var(--poe-red)", label: "Increasing" },
    stable:     { icon: "mdi:trending-neutral", color: "var(--poe-amber)", label: "Stable" },
    decreasing: { icon: "mdi:trending-down", color: "var(--poe-green)", label: "Decreasing" },
} as const;

const PRIORITY_ICON: Record<string, string> = {
    P1: "mdi:alert-octagon",
    P2: "mdi:alert",
    P3: "mdi:alert-circle-outline",
    P4: "mdi:information-outline",
};

/* ── Mini sparkline (pure CSS, no Recharts overhead) ─────────── */

function Sparkline({ data, color }: { data: number[]; color: string }) {
    if (!data.length) return null;
    const max = Math.max(...data, 1);
    const barWidth = 100 / data.length;

    return (
        <div className="poe-signal-sparkline">
            {data.map((v, i) => (
                <div
                    key={i}
                    className="poe-signal-sparkline__bar"
                    style={{
                        height: `${(v / max) * 100}%`,
                        width: `${barWidth}%`,
                        background: color,
                        opacity: 0.3 + (i / data.length) * 0.7,
                    }}
                />
            ))}
        </div>
    );
}

/* ── Country signal row ──────────────────────────────────────── */

function CountryRow({ country }: { country: BorderSignalSummary["by_country"][0] }) {
    const trend = TREND_CONFIG[country.trend] || TREND_CONFIG.stable;
    const priorityColor =
        country.highest_priority === "P1" ? "var(--poe-red)" :
        country.highest_priority === "P2" ? "var(--poe-amber)" :
        "var(--poe-text-muted)";

    return (
        <div className="poe-signal-country-row">
            <div className="poe-signal-country-row__left">
                <span className="poe-signal-country-row__iso">{country.iso3}</span>
                <span className="poe-signal-country-row__name">{country.country}</span>
            </div>
            <div className="poe-signal-country-row__metrics">
                {country.top_disease && (
                    <span className="poe-signal-country-row__disease">
                        {country.top_disease}
                    </span>
                )}
                <span className="poe-signal-country-row__count" style={{ color: priorityColor }}>
                    {country.signal_count_7d}
                    <span className="poe-signal-country-row__period">/ 7d</span>
                </span>
                <Icon
                    icon={trend.icon}
                    style={{ color: trend.color, fontSize: "1rem" }}
                    aria-label={trend.label}
                />
            </div>
        </div>
    );
}

/* ── Main SignalRadar ────────────────────────────────────────── */

interface SignalRadarProps {
    data: BorderSignalSummary | null;
    isLoading: boolean;
}

export function SignalRadar({ data, isLoading }: SignalRadarProps) {
    // Build mini-sparkline from by_country 7d counts
    const sparkData = useMemo(() => {
        if (!data?.by_country) return [];
        return data.by_country.slice(0, 14).map(c => c.signal_count_7d);
    }, [data]);

    // Count Tier 0 (CHW field intelligence) signals across all country buckets
    const chwSignalCount = useMemo(() => {
        if (!data?.by_country) return 0;
        return data.by_country.reduce(
            (acc, c) => acc + (c.nearest_poe_signals || []).filter(s => s.source_tier === 0).length,
            0,
        );
    }, [data]);

    // Determine overall trend
    const overallTrend = useMemo(() => {
        if (!data?.by_country.length) return "stable";
        const trends = data.by_country.map(c => c.trend);
        const increasing = trends.filter(t => t === "increasing").length;
        if (increasing > trends.length * 0.4) return "increasing";
        const decreasing = trends.filter(t => t === "decreasing").length;
        if (decreasing > trends.length * 0.4) return "decreasing";
        return "stable";
    }, [data]) as keyof typeof TREND_CONFIG;

    // Auto-hide when no data
    if (!isLoading && (!data || data.total_cross_border_signals === 0)) {
        return null;
    }

    const trendCfg = TREND_CONFIG[overallTrend];

    return (
        <div className="poe-card-panel poe-signal-radar">
            {/* Header strip */}
            <div className="poe-signal-radar__header">
                <div className="poe-signal-radar__title-group">
                    <h3 className="poe-panel-header__title" style={{ margin: 0 }}>
                        <Icon icon="mdi:radar" style={{ color: "var(--poe-amber)", fontSize: "1.2rem" }} />
                        Border Signal Intelligence
                    </h3>
                    <span style={{ fontSize: "0.68rem", color: "var(--poe-text-muted)" }}>
                        Sentinel signals with cross-border risk flagged
                    </span>
                </div>

                {/* KPI pills */}
                {!isLoading && data && (
                    <div className="poe-signal-radar__pills">
                        <div className="poe-signal-radar__pill">
                            <Icon icon="mdi:broadcast" style={{ color: "var(--poe-red)" }} />
                            <span className="poe-signal-radar__pill-value">{data.total_cross_border_signals}</span>
                            <span className="poe-signal-radar__pill-label">Cross-Border</span>
                        </div>
                        <div className="poe-signal-radar__pill">
                            <Icon icon="mdi:map-marker-radius" style={{ color: "var(--poe-amber)" }} />
                            <span className="poe-signal-radar__pill-value">{data.signals_near_poe}</span>
                            <span className="poe-signal-radar__pill-label">Near PoE</span>
                        </div>
                        <div
                            className="poe-signal-radar__pill"
                            title="Community Health Worker reports — Tier 0 ground truth from the field"
                        >
                            <Icon icon="mdi:hospital-box-outline" style={{ color: "var(--poe-green)" }} />
                            <span className="poe-signal-radar__pill-value" style={{ color: "var(--poe-green)" }}>
                                {chwSignalCount}
                            </span>
                            <span className="poe-signal-radar__pill-label">CHW Field</span>
                        </div>
                        <div className="poe-signal-radar__pill">
                            <Icon icon={trendCfg.icon} style={{ color: trendCfg.color }} />
                            <span className="poe-signal-radar__pill-value" style={{ color: trendCfg.color }}>
                                {trendCfg.label}
                            </span>
                            <span className="poe-signal-radar__pill-label">Trend</span>
                        </div>
                        <div className="poe-signal-radar__pill">
                            <Sparkline data={sparkData} color={trendCfg.color} />
                        </div>
                    </div>
                )}
            </div>

            {/* Loading shimmer */}
            {isLoading ? (
                <div style={{ display: "flex", gap: "12px", marginTop: "12px" }}>
                    {Array.from({ length: 3 }).map((_, i) => (
                        <span key={i} className="poe-shimmer" style={{ width: "100%", height: "48px" }} />
                    ))}
                </div>
            ) : (
                /* Country signal rows */
                data && data.by_country.length > 0 && (
                    <div className="poe-signal-radar__countries">
                        {data.by_country.slice(0, 8).map((c) => (
                            <CountryRow key={c.iso3 || c.country} country={c} />
                        ))}
                    </div>
                )
            )}
        </div>
    );
}
