import { useState, useMemo } from "react";
import { Icon } from "@iconify/react";
import {
    AreaChart, Area, XAxis, YAxis, Tooltip,
    ResponsiveContainer, CartesianGrid,
} from "recharts";
import type { SpilloverRisk, SpilloverOutbreak, SpilloverNeighbor } from "../services/poe";

/* ── Helpers ─────────────────────────────────────────────────── */

const TIER_COLORS: Record<string, string> = {
    "HIGH": "var(--poe-red)",
    "HIGH-MODERATE": "#ff6d00",
    "MODERATE": "hsl(45, 90%, 50%)",
    "LOW": "var(--poe-green)",
    "VERY LOW": "var(--poe-teal)",
};

const TIER_BG: Record<string, string> = {
    "HIGH": "rgba(255, 23, 68, 0.10)",
    "HIGH-MODERATE": "rgba(255, 109, 0, 0.10)",
    "MODERATE": "rgba(234, 179, 8, 0.08)",
    "LOW": "rgba(0, 230, 118, 0.08)",
    "VERY LOW": "rgba(0, 229, 255, 0.06)",
};

function tierColor(tier: string): string {
    return TIER_COLORS[tier] || "var(--poe-text-muted)";
}

function tierBg(tier: string): string {
    return TIER_BG[tier] || "rgba(255,255,255,0.03)";
}

/* ── SVG Gauge Ring ──────────────────────────────────────────── */

function GaugeRing({ value, tier, size = 80 }: { value: number; tier: string; size?: number }) {
    const radius = (size - 10) / 2;
    const circumference = 2 * Math.PI * radius;
    const clampedValue = Math.min(Math.max(value, 0), 1);
    const strokeDashoffset = circumference * (1 - clampedValue);
    const color = tierColor(tier);

    return (
        <svg
            width={size}
            height={size}
            viewBox={`0 0 ${size} ${size}`}
            className="poe-gauge-ring"
        >
            {/* Background track */}
            <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke="rgba(255,255,255,0.06)"
                strokeWidth={5}
            />
            {/* Animated fill */}
            <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={color}
                strokeWidth={5}
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
                style={{
                    transition: "stroke-dashoffset 1.2s cubic-bezier(0.4, 0, 0.2, 1)",
                    filter: `drop-shadow(0 0 6px ${color})`,
                }}
            />
            {/* Center text */}
            <text
                x={size / 2}
                y={size / 2 - 4}
                textAnchor="middle"
                dominantBaseline="central"
                fill="#fff"
                fontSize={size * 0.22}
                fontWeight={800}
            >
                {(clampedValue * 100).toFixed(0)}%
            </text>
            <text
                x={size / 2}
                y={size / 2 + 12}
                textAnchor="middle"
                dominantBaseline="central"
                fill={color}
                fontSize={size * 0.11}
                fontWeight={700}
                letterSpacing="0.5"
            >
                P(≥1)
            </text>
        </svg>
    );
}

/* ── Neighbor Risk Card ──────────────────────────────────────── */

function NeighborCard({ neighbor }: { neighbor: SpilloverNeighbor }) {
    const color = tierColor(neighbor.tier);

    return (
        <div
            className="poe-spillover-card"
            style={{ borderColor: `${color}22` }}
        >
            {/* Country header */}
            <div className="poe-spillover-card__header">
                <span className="poe-spillover-card__country">{neighbor.name}</span>
                <span
                    className="poe-badge"
                    style={{
                        background: tierBg(neighbor.tier),
                        color: color,
                        border: `1px solid ${color}33`,
                    }}
                >
                    {neighbor.tier}
                </span>
            </div>

            {/* Gauge ring */}
            <div className="poe-spillover-card__gauge">
                <GaugeRing value={neighbor.p_any_w12} tier={neighbor.tier} size={90} />
            </div>

            {/* 4/8/12 week countdown */}
            <div className="poe-threat-countdown">
                <div className="poe-threat-countdown__step">
                    <span className="poe-threat-countdown__label">4w</span>
                    <span
                        className="poe-threat-countdown__value"
                        style={{ color: tierColor(neighbor.p_any_w4 >= 0.35 ? "HIGH-MODERATE" : "LOW") }}
                    >
                        {(neighbor.p_any_w4 * 100).toFixed(1)}%
                    </span>
                </div>
                <div className="poe-threat-countdown__divider" />
                <div className="poe-threat-countdown__step">
                    <span className="poe-threat-countdown__label">8w</span>
                    <span
                        className="poe-threat-countdown__value"
                        style={{ color: tierColor(neighbor.p_any_w8 >= 0.70 ? "HIGH" : neighbor.p_any_w8 >= 0.35 ? "HIGH-MODERATE" : "LOW") }}
                    >
                        {(neighbor.p_any_w8 * 100).toFixed(1)}%
                    </span>
                </div>
                <div className="poe-threat-countdown__divider" />
                <div className="poe-threat-countdown__step">
                    <span className="poe-threat-countdown__label">12w</span>
                    <span
                        className="poe-threat-countdown__value"
                        style={{ color }}
                    >
                        {(neighbor.p_any_w12 * 100).toFixed(1)}%
                    </span>
                </div>
            </div>

            {/* Expected imports */}
            <div className="poe-spillover-card__metric">
                <Icon icon="mdi:account-arrow-right" style={{ color: "var(--poe-text-muted)", fontSize: "0.9rem" }} />
                <span style={{ color: "var(--poe-text-muted)", fontSize: "0.72rem" }}>
                    Expected imports:
                </span>
                <span style={{ color: "#fff", fontWeight: 700, fontSize: "0.85rem" }}>
                    {neighbor.expected_imports_w12.toFixed(2)}
                </span>
            </div>
        </div>
    );
}

/* ── Timeline Chart ──────────────────────────────────────────── */

function RiskTimeline({ neighbors }: { neighbors: SpilloverNeighbor[] }) {
    const chartData = useMemo(() => {
        if (!neighbors.length || !neighbors[0].cumulative_lambda?.length) return [];

        const maxLen = Math.max(...neighbors.map(n => n.cumulative_lambda?.length || 0));
        const data = [];
        for (let day = 0; day < maxLen; day++) {
            const point: Record<string, number | string> = {
                day,
                week: `W${Math.floor(day / 7) + 1}`,
            };
            neighbors.forEach(n => {
                const cumL = n.cumulative_lambda?.[day] || 0;
                point[n.name] = Math.round((1 - Math.exp(-cumL)) * 10000) / 100; // P(>=1) as %
            });
            data.push(point);
        }
        // Sample every 7 days for readability
        return data.filter((_, i) => i % 7 === 0 || i === data.length - 1);
    }, [neighbors]);

    const chartColors = ["#ff1744", "#ff6d00", "#ffc400", "#00e676", "#00e5ff"];

    if (!chartData.length) return null;

    return (
        <div className="poe-spillover-timeline">
            <h4 className="poe-spillover-timeline__title">
                <Icon icon="mdi:chart-timeline-variant-shimmer" style={{ color: "var(--poe-red)" }} />
                Cumulative Import Probability — 12 Week Horizon
            </h4>
            <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis
                        dataKey="week"
                        tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }}
                        axisLine={{ stroke: "rgba(255,255,255,0.06)" }}
                    />
                    <YAxis
                        tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }}
                        axisLine={{ stroke: "rgba(255,255,255,0.06)" }}
                        unit="%"
                        domain={[0, 100]}
                    />
                    <Tooltip
                        contentStyle={{
                            background: "rgba(15,23,42,0.95)",
                            border: "1px solid rgba(255,255,255,0.1)",
                            borderRadius: "8px",
                            color: "#fff",
                            fontSize: "0.8rem",
                        }}
                        formatter={(value: number) => [`${value.toFixed(1)}%`, undefined]}
                    />
                    {neighbors.map((n, i) => (
                        <Area
                            key={n.iso3}
                            type="monotone"
                            dataKey={n.name}
                            stroke={chartColors[i % chartColors.length]}
                            fill={chartColors[i % chartColors.length]}
                            fillOpacity={0.08}
                            strokeWidth={2}
                            dot={false}
                            animationDuration={1200}
                        />
                    ))}
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}

/* ── Outbreak Header ─────────────────────────────────────────── */

function OutbreakHeader({
    outbreak,
    onWhatIf,
}: {
    outbreak: SpilloverOutbreak;
    onWhatIf?: () => void;
}) {
    const timeSince = outbreak.declared_at
        ? `Declared ${new Date(outbreak.declared_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
        : "";

    return (
        <div className="poe-spillover-header">
            <div className="poe-spillover-header__left">
                <div className="poe-spillover-header__badge">
                    <Icon icon="mdi:biohazard" style={{ fontSize: "1.2rem", color: "var(--poe-red)" }} />
                    <span className="poe-spillover-header__pathogen">
                        {outbreak.pathogen}
                    </span>
                    <span className="poe-badge poe-badge--red">
                        {outbreak.severity?.toUpperCase() || "ACTIVE"}
                    </span>
                </div>
                <div className="poe-spillover-header__meta">
                    <span>
                        Source: <strong>{outbreak.source_iso3}</strong>
                        {outbreak.regions?.length > 0 && ` (${outbreak.regions.join(", ")})`}
                    </span>
                    <span className="poe-spillover-header__sep">•</span>
                    <span>{outbreak.confirmed_cases} cases · {outbreak.confirmed_deaths} deaths</span>
                    {timeSince && (
                        <>
                            <span className="poe-spillover-header__sep">•</span>
                            <span>{timeSince}</span>
                        </>
                    )}
                </div>
            </div>
            {onWhatIf && (
                <button className="poe-spillover-whatif-btn" onClick={onWhatIf}>
                    <Icon icon="mdi:flask-outline" />
                    What If?
                </button>
            )}
        </div>
    );
}

/* ── Main Panel ──────────────────────────────────────────────── */

interface SpilloverRiskPanelProps {
    data: SpilloverRisk | null;
    isLoading: boolean;
    hasError?: boolean;
    onWhatIf?: (outbreak: SpilloverOutbreak) => void;
    onCountryClick?: (iso3: string) => void;
}

export function SpilloverRiskPanel({
    data,
    isLoading,
    hasError,
    onWhatIf,
}: SpilloverRiskPanelProps) {
    const [expandedOutbreak, setExpandedOutbreak] = useState<number | null>(null);

    // Auto-hide when no active outbreaks and no error
    if (!isLoading && !hasError && (!data || data.active_outbreaks.length === 0)) {
        return null;
    }

    return (
        <div className="poe-card-panel poe-spillover-panel">
            {/* Section header */}
            <div className="poe-panel-header">
                <h3 className="poe-panel-header__title">
                    <Icon icon="mdi:shield-alert" style={{ color: "var(--poe-red)", fontSize: "1.2rem" }} />
                    Cross-Border Importation Risk
                    <span className="poe-spillover-panel__live">
                        <span className="poe-spillover-panel__pulse" />
                        LIVE
                    </span>
                </h3>
                <span style={{ fontSize: "0.68rem", color: "var(--poe-text-muted)" }}>
                    Auto-detected from active outbreak intelligence
                </span>
            </div>

            {/* Loading shimmer */}
            {isLoading ? (
                <div className="poe-shimmer-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "14px" }}>
                    {Array.from({ length: 4 }).map((_, i) => (
                        <span key={i} className="poe-shimmer" style={{ width: "100%", height: "220px", borderRadius: "12px" }} />
                    ))}
                </div>
            ) : hasError ? (
                /* Error state */
                <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "24px 0", color: "var(--poe-text-muted)" }}>
                    <Icon icon="mdi:alert-circle-outline" style={{ fontSize: "1.5rem", color: "var(--poe-amber)" }} />
                    <div>
                        <div style={{ fontWeight: 600, color: "var(--poe-text)", fontSize: "0.85rem" }}>Importation risk data unavailable</div>
                        <div style={{ fontSize: "0.72rem", marginTop: "2px" }}>The backend may be restarting or the outbreak data is not yet configured.</div>
                    </div>
                </div>
            ) : (
                /* Render each active outbreak */
                data?.active_outbreaks.map((outbreak) => {
                    const isExpanded = expandedOutbreak === outbreak.outbreak_id || data.active_outbreaks.length === 1;

                    return (
                        <div key={outbreak.outbreak_id} className="poe-spillover-outbreak">
                            <OutbreakHeader
                                outbreak={outbreak}
                                onWhatIf={onWhatIf ? () => onWhatIf(outbreak) : undefined}
                            />

                            {/* Neighbor risk cards */}
                            <div className="poe-spillover-grid">
                                {outbreak.neighbors.map((neighbor) => (
                                    <NeighborCard key={neighbor.iso3} neighbor={neighbor} />
                                ))}
                            </div>

                            {/* Timeline chart — expandable for multi-outbreak */}
                            {(isExpanded || data.active_outbreaks.length <= 2) && (
                                <RiskTimeline neighbors={outbreak.neighbors} />
                            )}

                            {/* Expand/collapse for multi-outbreak */}
                            {data.active_outbreaks.length > 2 && !isExpanded && (
                                <button
                                    className="poe-spillover-expand"
                                    onClick={() => setExpandedOutbreak(outbreak.outbreak_id)}
                                >
                                    <Icon icon="mdi:chevron-down" />
                                    Show risk timeline
                                </button>
                            )}
                        </div>
                    );
                })
            )}
        </div>
    );
}
