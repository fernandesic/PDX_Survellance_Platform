import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
} from "recharts";
import { Icon } from "@iconify/react";
import type { FlowVolumeData, RiskDistributionCategory } from "../services/poe";

interface AnalyticsChartsProps {
    flowVolumes: FlowVolumeData[];
    riskDistribution: RiskDistributionCategory[];
    isLoading: boolean;
}

const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        const name = data.corridor || data.category || "Item";
        const value = payload[0].value;
        const label = data.corridor ? "Annual Volume" : "Crossings";

        return (
            <div
                style={{
                    background: "rgba(10, 15, 31, 0.95)",
                    border: "1px solid var(--poe-border)",
                    borderRadius: "8px",
                    padding: "10px 12px",
                    boxShadow: "0 4px 15px rgba(0, 0, 0, 0.4)",
                }}
            >
                <p style={{ margin: "0 0 4px 0", fontWeight: 700, fontSize: "0.75rem", color: "#fff" }}>
                    {name}
                </p>
                <p style={{ margin: 0, fontSize: "0.72rem", color: "var(--poe-text-muted)" }}>
                    {label}: <strong style={{ color: "#fff", fontVariantNumeric: "tabular-nums" }}>{value.toLocaleString()}</strong>
                </p>
            </div>
        );
    }
    return null;
};

export function AnalyticsCharts({ flowVolumes, riskDistribution, isLoading }: AnalyticsChartsProps) {
    // Keep only the top 5 corridors for the horizontal bar chart
    const topCorridors = flowVolumes.slice(0, 5);

    return (
        <div className="poe-charts-grid">
            {/* Left Chart: Top Corridors by Flow Volume */}
            <div className="poe-chart-card">
                <h4 className="poe-chart-card__title" style={{ marginBottom: "4px" }}>
                    <Icon icon="mdi:swap-horizontal" style={{ marginRight: "6px", verticalAlign: "middle", color: "var(--poe-teal)" }} />
                    Top Corridors by Annual Flow Volume
                </h4>
                <p style={{ fontSize: "0.72rem", color: "var(--poe-text-muted)", margin: "0 0 12px 0" }}>
                    Estimated annual border-crossing volume for the busiest migration and trade routes
                </p>
                <div style={{ flex: 1, minHeight: 0 }}>
                    {isLoading ? (
                        <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <span className="poe-shimmer" style={{ width: "90%", height: "80%", borderRadius: "8px" }} />
                        </div>
                    ) : topCorridors.length === 0 ? (
                        <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "var(--poe-text-muted)", fontSize: "0.8rem" }}>
                            <Icon icon="mdi:chart-bar-off" style={{ fontSize: "1.8rem", marginBottom: "6px" }} />
                            No corridor flow volume data loaded
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                data={topCorridors}
                                layout="vertical"
                                margin={{ top: 5, right: 15, left: 15, bottom: 5 }}
                            >
                                <XAxis
                                    type="number"
                                    stroke="var(--poe-text-muted)"
                                    fontSize={10}
                                    tickLine={false}
                                    axisLine={false}
                                    tickFormatter={(v) => (v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)}
                                />
                                <YAxis
                                    dataKey="corridor"
                                    type="category"
                                    stroke="var(--poe-text-muted)"
                                    fontSize={10}
                                    tickLine={false}
                                    axisLine={false}
                                    width={70}
                                />
                                <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255, 255, 255, 0.02)" }} />
                                <Bar
                                    dataKey="flow_count"
                                    fill="#2dd4bf"
                                    radius={[0, 4, 4, 0]}
                                    barSize={12}
                                    isAnimationActive={true}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </div>

            {/* Right Chart: Informal Crossing Risk Shares */}
            <div className="poe-chart-card">
                <h4 className="poe-chart-card__title" style={{ marginBottom: "4px" }}>
                    <Icon icon="mdi:chart-donut" style={{ marginRight: "6px", verticalAlign: "middle", color: "var(--poe-amber)" }} />
                    Informal Crossing Risk Distribution
                </h4>
                <p style={{ fontSize: "0.72rem", color: "var(--poe-text-muted)", margin: "0 0 12px 0" }}>
                    Categorization of informal points of entry based on composite environmental and security risk indicators
                </p>
                <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                    <div style={{ height: "180px", position: "relative" }}>
                        {isLoading ? (
                            <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                <span className="poe-shimmer" style={{ width: "150px", height: "150px", borderRadius: "50%" }} />
                            </div>
                        ) : riskDistribution.every(c => c.count === 0) ? (
                            <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "var(--poe-text-muted)", fontSize: "0.8rem" }}>
                                <Icon icon="mdi:chart-arc" style={{ fontSize: "1.8rem", marginBottom: "6px" }} />
                                No crossings risk metrics loaded
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={riskDistribution as any[]}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={48}
                                        outerRadius={70}
                                        paddingAngle={4}
                                        dataKey="count"
                                        isAnimationActive={true}
                                    >
                                        {riskDistribution.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip content={<CustomTooltip />} />
                                </PieChart>
                            </ResponsiveContainer>
                        )}
                    </div>

                    {!isLoading && !riskDistribution.every(c => c.count === 0) && (
                        <div className="poe-chart-legend">
                            {riskDistribution.map((entry) => (
                                <div key={entry.category} className="poe-chart-legend__item">
                                    <div className="poe-chart-legend__dot" style={{ backgroundColor: entry.color }} />
                                    <span>
                                        {entry.category}: <strong>{entry.count.toLocaleString()}</strong>
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
