import { useState, useEffect, useMemo, useCallback } from "react";
import { Icon } from "@iconify/react";
import { logger } from "@/utils/logger";
import { poe } from "../services/poe";
import type {
    SpilloverOutbreak,
    ScenarioComparison,
    ScenarioCountryInput,
    ScenarioResult,
} from "../services/poe";

/* ── Constants ───────────────────────────────────────────────── */

const SCENARIO_LABELS = [
    {
        key: "baseline" as const,
        label: "Current Trajectory",
        icon: "mdi:chart-timeline-variant",
        color: "var(--poe-red)",
        bg: "rgba(255, 23, 68, 0.06)",
        border: "rgba(255, 23, 68, 0.15)",
        desc: "PoE detection at 20%",
    },
    {
        key: "enhanced_screening" as const,
        label: "Enhanced Screening",
        icon: "mdi:shield-search",
        color: "var(--poe-green)",
        bg: "rgba(0, 230, 118, 0.06)",
        border: "rgba(0, 230, 118, 0.15)",
        desc: "PoE detection at 80%",
    },
    {
        key: "border_restriction" as const,
        label: "Border Restriction",
        icon: "mdi:gate-alert",
        color: "var(--poe-amber)",
        bg: "rgba(249, 115, 22, 0.06)",
        border: "rgba(249, 115, 22, 0.15)",
        desc: "70% border closure",
    },
];

/* ── Helpers ─────────────────────────────────────────────────── */

function getAggregatedMetrics(result: ScenarioResult | null) {
    if (!result?.countries?.length) return null;
    const totalImports = result.countries.reduce(
        (sum, c) => sum + c.expected_imports_w12, 0
    );
    const maxP = Math.max(...result.countries.map(c => c.p_any_w12));
    const highestTier = result.countries.reduce((worst, c) => {
        const rank: Record<string, number> = { HIGH: 4, "HIGH-MODERATE": 3, MODERATE: 2, LOW: 1, "VERY LOW": 0 };
        return (rank[c.tier] || 0) > (rank[worst] || 0) ? c.tier : worst;
    }, "LOW");
    return { totalImports, maxP, highestTier };
}

/* ── Scenario Summary Card ───────────────────────────────────── */

function ScenarioCard({
    config,
    result,
    baselineImports,
}: {
    config: typeof SCENARIO_LABELS[0];
    result: ScenarioResult | null;
    baselineImports: number;
}) {
    const metrics = useMemo(() => getAggregatedMetrics(result), [result]);
    const reduction = useMemo(() => {
        if (!metrics || baselineImports <= 0) return null;
        const pct = ((baselineImports - metrics.totalImports) / baselineImports) * 100;
        return pct;
    }, [metrics, baselineImports]);

    if (!metrics) {
        return (
            <div className="poe-scenario-card" style={{ background: config.bg, borderColor: config.border }}>
                <div className="poe-scenario-card__header">
                    <Icon icon={config.icon} style={{ color: config.color, fontSize: "1.3rem" }} />
                    <span className="poe-scenario-card__label">{config.label}</span>
                </div>
                <div className="poe-scenario-card__empty">
                    <Icon icon="mdi:alert-circle-outline" style={{ fontSize: "2rem", color: "var(--poe-text-dim)" }} />
                    <span>Unavailable</span>
                </div>
            </div>
        );
    }

    return (
        <div
            className="poe-scenario-card"
            style={{ background: config.bg, borderColor: config.border }}
        >
            <div className="poe-scenario-card__header">
                <Icon icon={config.icon} style={{ color: config.color, fontSize: "1.3rem" }} />
                <span className="poe-scenario-card__label">{config.label}</span>
            </div>

            <div className="poe-scenario-card__desc">{config.desc}</div>

            {/* Big hero number: max P(≥1) */}
            <div className="poe-scenario-card__hero">
                <span
                    className="poe-scenario-card__hero-value"
                    style={{ color: config.color }}
                >
                    {(metrics.maxP * 100).toFixed(1)}%
                </span>
                <span className="poe-scenario-card__hero-label">Max P(≥1 import)</span>
            </div>

            {/* Expected imports */}
            <div className="poe-scenario-card__metric">
                <span className="poe-scenario-card__metric-label">Expected imports (12w)</span>
                <span className="poe-scenario-card__metric-value">
                    {metrics.totalImports.toFixed(2)}
                </span>
            </div>

            {/* Reduction delta */}
            {reduction !== null && config.key !== "baseline" && (
                <div className="poe-scenario-card__delta">
                    <Icon
                        icon={reduction > 0 ? "mdi:arrow-down-bold" : "mdi:arrow-up-bold"}
                        style={{
                            color: reduction > 0 ? "var(--poe-green)" : "var(--poe-red)",
                            fontSize: "1rem",
                        }}
                    />
                    <span
                        style={{
                            color: reduction > 0 ? "var(--poe-green)" : "var(--poe-red)",
                            fontWeight: 700,
                            fontSize: "0.85rem",
                        }}
                    >
                        {Math.abs(reduction).toFixed(1)}%{" "}
                        {reduction > 0 ? "reduction" : "increase"}
                    </span>
                </div>
            )}

            {/* Per-country breakdown */}
            <div className="poe-scenario-card__countries">
                {result?.countries.map(c => (
                    <div key={c.iso3} className="poe-scenario-card__country-row">
                        <span className="poe-scenario-card__country-name">{c.name}</span>
                        <span className="poe-scenario-card__country-p" style={{ color: config.color }}>
                            {(c.p_any_w12 * 100).toFixed(1)}%
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}

/* ── Main Panel ──────────────────────────────────────────────── */

interface ScenarioPanelProps {
    outbreak: SpilloverOutbreak | null;
    isOpen: boolean;
    onClose: () => void;
}

export function ScenarioPanel({ outbreak, isOpen, onClose }: ScenarioPanelProps) {
    const [loading, setLoading] = useState(false);
    const [comparison, setComparison] = useState<ScenarioComparison | null>(null);
    const [error, setError] = useState(false);

    // Build active-I and countries from outbreak data
    const runScenarios = useCallback(async () => {
        if (!outbreak?.neighbors?.length) return;

        setLoading(true);
        setError(false);
        try {
            // Build a synthetic active-I series from confirmed_cases
            const confirmed = outbreak.confirmed_cases || 5;
            const seedI = Math.max(1, confirmed * 0.3);
            const activeI: number[] = [];
            for (let t = 0; t < 84; t++) {
                activeI.push(Math.min(seedI * Math.pow(1.025, t), confirmed * 2));
            }

            // Build country inputs from the spillover data
            const countries: ScenarioCountryInput[] = outbreak.neighbors.map(n => ({
                name: n.name,
                iso3: n.iso3,
                daily_crossings: 500, // Default from spec
                catchment_share: 0.15,
                border_open: 1.0,
                direct_border: true,
            }));

            const result = await poe.runScenarioComparison(activeI, countries);
            setComparison(result);
        } catch (err) {
            logger.error("[ScenarioPanel] Failed:", err);
            setError(true);
        } finally {
            setLoading(false);
        }
    }, [outbreak]);

    // Auto-run when opened
    useEffect(() => {
        if (isOpen && outbreak) {
            runScenarios();
        }
    }, [isOpen, outbreak, runScenarios]);

    // Baseline imports for delta calculation
    const baselineImports = useMemo(() => {
        const metrics = getAggregatedMetrics(comparison?.baseline || null);
        return metrics?.totalImports || 0;
    }, [comparison]);

    return (
        <>
            {/* Overlay */}
            <div
                className={`poe-detail-panel-overlay ${isOpen ? "poe-detail-panel-overlay--visible" : ""}`}
                onClick={onClose}
            />

            {/* Panel */}
            <div
                className={`poe-scenario-drawer ${isOpen ? "poe-scenario-drawer--open" : ""}`}
            >
                {/* Header */}
                <div className="poe-detail-panel__header">
                    <div className="poe-detail-panel__title-group">
                        <span className="poe-detail-panel__category">
                            <Icon icon="mdi:flask-outline" style={{ fontSize: "0.9rem" }} /> SCENARIO ANALYSIS
                        </span>
                        <h3 className="poe-detail-panel__title">
                            What-If: {outbreak?.pathogen || "Outbreak"}
                        </h3>
                    </div>
                    <button className="poe-detail-panel__close" onClick={onClose}>
                        <Icon icon="mdi:close" />
                    </button>
                </div>

                {/* Content */}
                <div className="poe-scenario-drawer__content">
                    {loading ? (
                        <div className="poe-scenario-loading">
                            <div className="poe-scenario-loading__spinner" />
                            <span>Running 3 scenarios against importation model…</span>
                        </div>
                    ) : comparison ? (
                        <>
                            {/* Impact hero */}
                            {comparison.baseline && comparison.enhanced_screening && (
                                <div className="poe-scenario-hero">
                                    <Icon icon="mdi:shield-check" style={{ color: "var(--poe-green)", fontSize: "2rem" }} />
                                    <div className="poe-scenario-hero__text">
                                        <span className="poe-scenario-hero__title">Enhanced PoE screening</span>
                                        <span className="poe-scenario-hero__impact">
                                            reduces expected imports by{" "}
                                            <strong style={{ color: "var(--poe-green)", fontSize: "1.3em" }}>
                                                {baselineImports > 0
                                                    ? ((1 - (getAggregatedMetrics(comparison.enhanced_screening)?.totalImports || 0) / baselineImports) * 100).toFixed(0)
                                                    : "—"}%
                                            </strong>
                                        </span>
                                    </div>
                                </div>
                            )}

                            {/* Scenario cards */}
                            <div className="poe-scenario-grid">
                                {SCENARIO_LABELS.map(cfg => (
                                    <ScenarioCard
                                        key={cfg.key}
                                        config={cfg}
                                        result={comparison[cfg.key]}
                                        baselineImports={baselineImports}
                                    />
                                ))}
                            </div>
                        </>
                    ) : (
                        <div className="poe-scenario-empty">
                            <Icon icon={error ? "mdi:alert-circle-outline" : "mdi:flask-empty-outline"} style={{ fontSize: "3rem", color: "var(--poe-text-dim)" }} />
                            <span>{error ? "Scenario analysis failed — check backend connectivity" : "No scenario data available"}</span>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
