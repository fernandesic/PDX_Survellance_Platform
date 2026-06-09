import { useState, useMemo } from "react";
import { Icon } from "@iconify/react";
import type { RegionScore } from "@/pages/readiness/types/readiness";

interface ReadinessMatrixProps {
    scores: RegionScore[];
    onCountryClick?: (country: string) => void;
    isLoading: boolean;
}

type SortOption = "worst" | "best" | "alpha";

export function ReadinessMatrix({ scores, onCountryClick, isLoading }: ReadinessMatrixProps) {
    const [sortBy, setSortBy] = useState<SortOption>("worst");

    const getColor = (score: number) => {
        if (score >= 70) return "var(--poe-green)";
        if (score >= 50) return "var(--poe-amber)";
        if (score >= 30) return "hsl(28, 95%, 55%)"; // orange
        return "var(--poe-red)";
    };

    const getVerdict = (score: number) => {
        if (score >= 70) return "Prepared";
        if (score >= 50) return "Adequate";
        if (score >= 30) return "Gaps";
        return "Critical Gaps";
    };

    const processedScores = useMemo(() => {
        const items = [...scores];
        items.sort((a, b) => {
            if (sortBy === "worst") {
                return a.score - b.score; // Ascending (worst first)
            }
            if (sortBy === "best") {
                return b.score - a.score; // Descending (best first)
            }
            // Alphabetical
            return a.region.localeCompare(b.region);
        });
        return items;
    }, [scores, sortBy]);

    // SVG Circular progress ring config
    const radius = 20;
    const strokeWidth = 3.5;
    const circumference = 2 * Math.PI * radius;

    return (
        <div className="poe-card-panel poe-matrix-container">
            <div className="poe-panel-header">
                <h3 className="poe-panel-header__title">
                    <Icon icon="mdi:hospital-building" style={{ color: "var(--poe-green)", fontSize: "1.2rem" }} />
                    AFRO PoE Surveillance Capacity Matrix
                </h3>
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <span className="poe-card__sub" style={{ fontSize: "0.72rem", marginRight: "8px" }}>
                        Sort order:
                    </span>
                    <button
                        onClick={() => setSortBy("worst")}
                        className={`poe-map-modes__btn ${sortBy === "worst" ? "poe-map-modes__btn--active" : ""}`}
                        data-mode={sortBy === "worst" ? "capacity" : ""}
                        style={{ padding: "4px 8px", fontSize: "0.68rem" }}
                    >
                        Worst First
                    </button>
                    <button
                        onClick={() => setSortBy("best")}
                        className={`poe-map-modes__btn ${sortBy === "best" ? "poe-map-modes__btn--active" : ""}`}
                        data-mode={sortBy === "best" ? "capacity" : ""}
                        style={{ padding: "4px 8px", fontSize: "0.68rem" }}
                    >
                        Best First
                    </button>
                    <button
                        onClick={() => setSortBy("alpha")}
                        className={`poe-map-modes__btn ${sortBy === "alpha" ? "poe-map-modes__btn--active" : ""}`}
                        data-mode={sortBy === "alpha" ? "all" : ""}
                        style={{ padding: "4px 8px", fontSize: "0.68rem" }}
                    >
                        A-Z
                    </button>
                </div>
            </div>

            {isLoading ? (
                <div className="poe-matrix-grid">
                    {Array.from({ length: 12 }).map((_, i) => (
                        <div key={i} className="poe-matrix-card" style={{ height: "115px" }}>
                            <span className="poe-shimmer" style={{ width: "80%", height: "12px", marginBottom: "12px" }} />
                            <span className="poe-shimmer" style={{ width: "48px", height: "48px", borderRadius: "50%", marginBottom: "10px" }} />
                            <span className="poe-shimmer" style={{ width: "50%", height: "10px" }} />
                        </div>
                    ))}
                </div>
            ) : processedScores.length === 0 ? (
                <div className="poe-card__sub" style={{ textAlign: "center", padding: "40px", fontSize: "0.85rem" }}>
                    <Icon icon="mdi:alert-circle-outline" style={{ fontSize: "1.8rem", marginBottom: "8px", display: "block", margin: "0 auto", color: "var(--poe-red)" }} />
                    No capacity scores aggregated from IHR FVD PoE readiness summaries
                </div>
            ) : (
                <div className="poe-matrix-grid">
                    {processedScores.map((entry) => {
                        const score = Math.min(100, Math.max(0, entry.score || 0));
                        const color = getColor(score);
                        const verdictLabel = getVerdict(score);
                        const strokeDashoffset = circumference - (score / 100) * circumference;

                        return (
                            <div
                                key={entry.region}
                                className="poe-matrix-card"
                                onClick={() => onCountryClick?.(entry.region)}
                                title={`Click to zoom map to ${entry.region} (FVD PoE: ${score}%)`}
                                role="button"
                                tabIndex={0}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" || e.key === " ") {
                                        onCountryClick?.(entry.region);
                                    }
                                }}
                            >
                                <div className="poe-matrix-card__name">{entry.region}</div>
                                <div className="poe-matrix-card__ring-wrapper">
                                    <svg width="50" height="50" viewBox="0 0 50 50">
                                        <circle
                                            cx="25"
                                            cy="25"
                                            r={radius}
                                            fill="transparent"
                                            stroke="rgba(255, 255, 255, 0.05)"
                                            strokeWidth={strokeWidth}
                                        />
                                        <circle
                                            cx="25"
                                            cy="25"
                                            r={radius}
                                            fill="transparent"
                                            stroke={color}
                                            strokeWidth={strokeWidth}
                                            strokeDasharray={circumference}
                                            strokeDashoffset={strokeDashoffset}
                                            strokeLinecap="round"
                                            transform="rotate(-90 25 25)"
                                            style={{ transition: "stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1)" }}
                                        />
                                    </svg>
                                    <div className="poe-matrix-card__ring-value" style={{ color }}>
                                        {Math.round(score)}
                                    </div>
                                </div>
                                <div className="poe-matrix-card__verdict" style={{ color }}>
                                    {verdictLabel}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
