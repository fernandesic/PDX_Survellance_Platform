import { useState, useMemo } from "react";
import { Icon } from "@iconify/react";
import type { CorridorIntelligence } from "../services/poe";

interface CorridorIntelTableProps {
    corridors: CorridorIntelligence[];
    onRowClick?: (corridor: CorridorIntelligence) => void;
    isLoading: boolean;
}

type SortField = "corridor" | "flow_count" | "flow_type" | "priority" | "risk_score";
type SortOrder = "asc" | "desc";

export function CorridorIntelTable({ corridors, onRowClick, isLoading }: CorridorIntelTableProps) {
    const [sortField, setSortField] = useState<SortField>("risk_score");
    const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
    const [showAll, setShowAll] = useState(false);

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortOrder(prev => (prev === "asc" ? "desc" : "asc"));
        } else {
            setSortField(field);
            setSortOrder("desc");
        }
    };

    const getPriorityBadgeClass = (priority: string) => {
        const p = priority.toUpperCase();
        if (p.includes("CRIT")) return "poe-badge poe-badge--red";
        if (p.includes("HIGH")) return "poe-badge poe-badge--orange";
        if (p.includes("MED")) return "poe-badge poe-badge--yellow";
        return "poe-badge poe-badge--green";
    };

    const shortPriority = (p: string) => {
        const up = p.toUpperCase();
        if (up.includes("CRIT")) return "Critical";
        if (up.includes("HIGH")) return "High";
        if (up.includes("MED")) return "Medium";
        return "Low";
    };

    const getRowClass = (priority: string) => {
        const p = priority.toUpperCase();
        if (p.includes("CRIT")) return "poe-table__row poe-table__row--critical";
        if (p.includes("HIGH")) return "poe-table__row poe-table__row--high";
        if (p.includes("MED")) return "poe-table__row poe-table__row--medium";
        return "poe-table__row poe-table__row--low";
    };

    const sortedCorridors = useMemo(() => {
        const items = [...corridors];
        items.sort((a, b) => {
            let valA: any = "";
            let valB: any = "";

            if (sortField === "corridor") {
                valA = a.corridor;
                valB = b.corridor;
            } else if (sortField === "flow_count") {
                valA = a.flow_count ?? 0;
                valB = b.flow_count ?? 0;
            } else if (sortField === "flow_type") {
                valA = a.flow_type ?? "";
                valB = b.flow_type ?? "";
            } else if (sortField === "priority") {
                const priorityWeight = (p: string) => {
                    const up = p.toUpperCase();
                    if (up.includes("CRIT")) return 4;
                    if (up.includes("HIGH")) return 3;
                    if (up.includes("MED")) return 2;
                    return 1;
                };
                valA = priorityWeight(a.ihr_screening_priority || "Low");
                valB = priorityWeight(b.ihr_screening_priority || "Low");
            } else if (sortField === "risk_score") {
                valA = a.risk_score ?? 0;
                valB = b.risk_score ?? 0;
            }

            if (valA < valB) return sortOrder === "asc" ? -1 : 1;
            if (valA > valB) return sortOrder === "asc" ? 1 : -1;
            return 0;
        });
        return items;
    }, [corridors, sortField, sortOrder]);

    const displayedCorridors = useMemo(() => {
        return showAll ? sortedCorridors : sortedCorridors.slice(0, 8);
    }, [sortedCorridors, showAll]);

    const renderSortIcon = (field: SortField) => {
        if (sortField !== field) return null;
        return (
            <Icon
                icon={sortOrder === "asc" ? "mdi:arrow-up" : "mdi:arrow-down"}
                style={{ marginLeft: "4px", fontSize: "0.9rem", verticalAlign: "middle" }}
            />
        );
    };

    return (
        <div className="poe-card-panel">
            <div className="poe-panel-header">
                <h3 className="poe-panel-header__title">
                    <Icon icon="mdi:routes" style={{ color: "var(--poe-teal)", fontSize: "1.2rem" }} />
                    Cross-Border Corridor Intelligence
                </h3>
                <span className="poe-card__sub" style={{ fontSize: "0.75rem" }}>
                    Showing {displayedCorridors.length} of {corridors.length} active trade and migration flow pathways
                </span>
            </div>

            <div className="poe-table-container">
                <table className="poe-table">
                    <thead>
                        <tr>
                            <th onClick={() => handleSort("corridor")}>
                                Corridor {renderSortIcon("corridor")}
                            </th>
                            <th onClick={() => handleSort("flow_count")} style={{ textAlign: "right" }}>
                                Flow Volume / yr {renderSortIcon("flow_count")}
                            </th>
                            <th onClick={() => handleSort("flow_type")}>
                                Flow Type {renderSortIcon("flow_type")}
                            </th>
                            <th onClick={() => handleSort("priority")}>
                                Priority {renderSortIcon("priority")}
                            </th>
                            <th onClick={() => handleSort("risk_score")}>
                                Risk Score {renderSortIcon("risk_score")}
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading ? (
                            Array.from({ length: 5 }).map((_, i) => (
                                <tr key={i}>
                                    <td><span className="poe-shimmer" style={{ width: "80px", height: "14px", display: "inline-block" }} /></td>
                                    <td><span className="poe-shimmer" style={{ width: "60px", height: "14px", display: "inline-block", float: "right" }} /></td>
                                    <td><span className="poe-shimmer" style={{ width: "100px", height: "14px", display: "inline-block" }} /></td>
                                    <td><span className="poe-shimmer" style={{ width: "50px", height: "14px", display: "inline-block" }} /></td>
                                    <td><span className="poe-shimmer" style={{ width: "70px", height: "14px", display: "inline-block" }} /></td>
                                </tr>
                            ))
                        ) : displayedCorridors.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="poe-card__sub" style={{ textAlign: "center", padding: "30px", fontSize: "0.85rem" }}>
                                    <Icon icon="mdi:server-off" style={{ fontSize: "1.8rem", marginBottom: "8px", display: "block", margin: "0 auto" }} />
                                    No corridor data available in current surveillance scope
                                </td>
                            </tr>
                        ) : (
                            displayedCorridors.map((c, idx) => {
                                const score = c.risk_score ?? 0;
                                const barColor = score >= 80 ? "var(--poe-red)"
                                               : score >= 60 ? "var(--poe-amber)"
                                               : score >= 30 ? "hsl(45, 90%, 50%)"
                                               : "var(--poe-green)";

                                return (
                                    <tr
                                        key={idx}
                                        className={getRowClass(c.ihr_screening_priority || "Low")}
                                        onClick={() => onRowClick?.(c)}
                                    >
                                        <td style={{ fontWeight: 700, color: "#fff" }}>{c.corridor}</td>
                                        <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                                            {c.flow_count ? c.flow_count.toLocaleString() : "—"}
                                        </td>
                                        <td style={{ color: "var(--poe-text-muted)" }}>{c.flow_type || "—"}</td>
                                        <td>
                                            <span className={getPriorityBadgeClass(c.ihr_screening_priority || "Low")}>
                                                {shortPriority(c.ihr_screening_priority || "Low")}
                                            </span>
                                        </td>
                                        <td style={{ width: "160px" }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: "10px", margin: 0 }}>
                                                <div className="poe-progress-bar" style={{ height: "10px", flex: 1, margin: 0 }}>
                                                    <div
                                                        className="poe-progress-bar__fill"
                                                        style={{
                                                            width: `${score}%`,
                                                            backgroundColor: barColor,
                                                        }}
                                                    />
                                                </div>
                                                <span style={{ fontSize: "0.75rem", color: barColor, fontWeight: "bold", minWidth: "24px", textAlign: "right" }}>
                                                    {score}
                                                </span>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {corridors.length > 8 && (
                <div style={{ display: "flex", justifyContent: "center", marginTop: "16px" }}>
                    <button
                        onClick={() => setShowAll(!showAll)}
                        className="poe-map-modes__btn"
                        style={{
                            backgroundColor: "rgba(255, 255, 255, 0.05)",
                            border: "1px solid var(--poe-border)",
                            color: "#fff",
                            fontSize: "0.75rem",
                            padding: "6px 16px",
                            borderRadius: "6px",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: "6px"
                        }}
                    >
                        <Icon icon={showAll ? "mdi:chevron-up" : "mdi:chevron-down"} />
                        <span>{showAll ? "Show Less" : `Show All ${corridors.length} Corridors`}</span>
                    </button>
                </div>
            )}
        </div>
    );
}
