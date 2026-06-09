import { Icon } from "@iconify/react";

interface FeatureDetailPanelProps {
    feature: any | null; // The attributes object
    layerKey: string | null; // The key of the layer clicked
    onClose: () => void;
}

export function FeatureDetailPanel({ feature, layerKey, onClose }: FeatureDetailPanelProps) {
    const isOpen = !!feature;

    // Helper to map 0-100 risk score to category and color
    const getRiskInfo = (score: number) => {
        if (score >= 80) return { label: "Critical", color: "var(--poe-red)" };
        if (score >= 60) return { label: "High", color: "var(--poe-amber)" };
        if (score >= 30) return { label: "Medium", color: "hsl(45, 90%, 50%)" };
        return { label: "Low", color: "var(--poe-green)" };
    };

    // Helper to format values nicely
    const renderVal = (v: any) => {
        if (v === null || v === undefined || v === "") return "—";
        if (typeof v === "number") return v.toLocaleString();
        return String(v);
    };

    const renderContent = () => {
        if (!feature || !layerKey) return null;

        // ── Template: Disease Outbreak News Alerts ─────────────────
        if (layerKey === "outbreak_news") {
            const country = feature.country_iso3 || feature.country || "Unknown";
            return (
                <>
                    <div className="poe-detail-item">
                        <span className="poe-detail-item__label">Alert Title</span>
                        <span className="poe-detail-item__value">{renderVal(feature.title || feature.Title)}</span>
                    </div>
                    <div className="poe-detail-item">
                        <span className="poe-detail-item__label">Country Centroid</span>
                        <span className="poe-detail-item__value">{renderVal(country)}</span>
                    </div>
                    <div className="poe-detail-item">
                        <span className="poe-detail-item__label">Publication Date</span>
                        <span className="poe-detail-item__value">
                            {feature.published ? new Date(feature.published).toLocaleDateString() : "—"}
                        </span>
                    </div>
                    {feature.who_url && (
                        <div className="poe-detail-item" style={{ marginTop: "12px" }}>
                            <a
                                href={feature.who_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="poe-badge poe-badge--red"
                                style={{ display: "inline-flex", alignItems: "center", gap: "6px", textDecoration: "none" }}
                            >
                                <Icon icon="mdi:open-in-new" />
                                <span>Read Full WHO DON Report</span>
                            </a>
                        </div>
                    )}
                </>
            );
        }

        // ── Template: Airports ──────────────────────────────────────
        if (layerKey === "airports") {
            return (
                <>
                    <div className="poe-detail-item">
                        <span className="poe-detail-item__label">Airport Name</span>
                        <span className="poe-detail-item__value">{renderVal(feature.name || feature.Name)}</span>
                    </div>
                    <div className="poe-detail-item">
                        <span className="poe-detail-item__label">IATA / ICAO Codes</span>
                        <span className="poe-detail-item__value">
                            {renderVal(feature.iata_code)} / {renderVal(feature.icao_code)}
                        </span>
                    </div>
                    <div className="poe-detail-item">
                        <span className="poe-detail-item__label">Municipality</span>
                        <span className="poe-detail-item__value">{renderVal(feature.municipality)}</span>
                    </div>
                    <div className="poe-detail-item">
                        <span className="poe-detail-item__label">Country ISO Code</span>
                        <span className="poe-detail-item__value">{renderVal(feature.iso_country)}</span>
                    </div>
                    <div className="poe-detail-item">
                        <span className="poe-detail-item__label">Elevation</span>
                        <span className="poe-detail-item__value">
                            {feature.elevation_ft !== undefined ? `${feature.elevation_ft.toLocaleString()} ft` : "—"}
                        </span>
                    </div>
                </>
            );
        }

        // ── Template: Seaports & Inland River Ports ────────────────
        if (layerKey === "seaports" || layerKey === "inland_ports") {
            return (
                <>
                    <div className="poe-detail-item">
                        <span className="poe-detail-item__label">Port Name</span>
                        <span className="poe-detail-item__value">{renderVal(feature.port_name || feature.Port_Name || feature.name)}</span>
                    </div>
                    <div className="poe-detail-item">
                        <span className="poe-detail-item__label">Country</span>
                        <span className="poe-detail-item__value">{renderVal(feature.country || feature.Country)}</span>
                    </div>
                    <div className="poe-detail-item">
                        <span className="poe-detail-item__label">Port Details</span>
                        <span className="poe-detail-item__value">
                            Harbor: {renderVal(feature.harbor_size || "Standard")} · Type: {renderVal(feature.harbor_type)}
                        </span>
                    </div>
                    <div className="poe-detail-item">
                        <span className="poe-detail-item__label">UN / LOCODE</span>
                        <span className="poe-detail-item__value">{renderVal(feature.un_locode || feature.UN_LOCODE)}</span>
                    </div>
                </>
            );
        }

        // ── Template: UNHCR People of Concern / UNHCR Presence ──────
        if (layerKey === "unhcr" || layerKey === "unhcr_presence") {
            return (
                <>
                    <div className="poe-detail-item">
                        <span className="poe-detail-item__label">Location / Office Name</span>
                        <span className="poe-detail-item__value">{renderVal(feature.name || feature.office_name || "UNHCR Site")}</span>
                    </div>
                    <div className="poe-detail-item">
                        <span className="poe-detail-item__label">Office / Camp Type</span>
                        <span className="poe-detail-item__value">
                            {renderVal(feature.office_type || feature.location_type || "Settlement")}
                        </span>
                    </div>
                    <div className="poe-detail-item">
                        <span className="poe-detail-item__label">Displacement Status</span>
                        <span className="poe-detail-item__value">
                            {renderVal(feature.population_type || "Refugees & IDPs")} ({renderVal(feature.unhcr_situation || "Active Situation")})
                        </span>
                    </div>
                    <div className="poe-detail-item">
                        <span className="poe-detail-item__label">Country Code</span>
                        <span className="poe-detail-item__value">{renderVal(feature.country || feature.iso3)}</span>
                    </div>
                </>
            );
        }

        // ── Template: Border Crossings (WFP) ────────────────────────
        if (layerKey === "border_crossings") {
            const status = String(feature.status || "Unknown").toUpperCase();
            const badgeClass = status === "OPEN" ? "poe-badge poe-badge--green" : "poe-badge poe-badge--red";
            return (
                <>
                    <div className="poe-detail-item">
                        <span className="poe-detail-item__label">PoE Land Crossing</span>
                        <span className="poe-detail-item__value">{renderVal(feature.name || feature.poe_type || "Land Border Crossing")}</span>
                    </div>
                    <div className="poe-detail-item">
                        <span className="poe-detail-item__label">Operational Status</span>
                        <div>
                            <span className={badgeClass}>{status}</span>
                        </div>
                    </div>
                    <div className="poe-detail-item">
                        <span className="poe-detail-item__label">Connecting Countries</span>
                        <span className="poe-detail-item__value">
                            Origin: {renderVal(feature.iso3_1)} · Destination: {renderVal(feature.iso3_2)}
                        </span>
                    </div>
                </>
            );
        }

        // ── Template: Informal Crossings ───────────────────────────
        if (layerKey === "informal_crossings") {
            return (
                <>
                    <div className="poe-detail-item">
                        <span className="poe-detail-item__label">Informal PoE Crossing</span>
                        <span className="poe-detail-item__value">OSM ID: {renderVal(feature.osm_id)}</span>
                    </div>
                    <div className="poe-detail-item">
                        <span className="poe-detail-item__label">Highway Track Type</span>
                        <span className="poe-detail-item__value">{renderVal(feature.highway_type || feature.highway)}</span>
                    </div>
                    <div className="poe-detail-item">
                        <span className="poe-detail-item__label">Crossing Security Class</span>
                        <div>
                            <span className="poe-badge poe-badge--orange">{renderVal(feature.crossing_class || "Informal Crossing")}</span>
                        </div>
                    </div>
                    <div className="poe-detail-item">
                        <span className="poe-detail-item__label">Surface Type</span>
                        <span className="poe-detail-item__value">{renderVal(feature.surface || "Unpaved Route")}</span>
                    </div>
                </>
            );
        }

        // ── Template: ACLED Corridor Hotspots ───────────────────────
        if (layerKey === "corridor_hotspots") {
            const fatal = feature.fatalities || 0;
            return (
                <>
                    <div className="poe-detail-item">
                        <span className="poe-detail-item__label">Border Conflict Event</span>
                        <span className="poe-detail-item__value">{renderVal(feature.event_type || "Security Hotspot")}</span>
                    </div>
                    <div className="poe-detail-item">
                        <span className="poe-detail-item__label">Risk Assessment</span>
                        <div>
                            <span className="poe-badge poe-badge--red">{renderVal(feature.ihr_risk_flag || "Critical Alert")}</span>
                        </div>
                    </div>
                    <div className="poe-detail-item">
                        <span className="poe-detail-item__label">Reported Fatalities</span>
                        <span className="poe-detail-item__value" style={{ color: "var(--poe-red)", fontWeight: "bold" }}>
                            {renderVal(fatal)} lives
                        </span>
                    </div>
                </>
            );
        }

        // ── Template: Corridor Risk Scores ──────────────────────────
        if (layerKey === "corridor_risk") {
            const score = Number(feature.risk_score || 0);
            const riskInfo = getRiskInfo(score);
            return (
                <>
                    <div className="poe-detail-item">
                        <span className="poe-detail-item__label">Corridor Track Name</span>
                        <span className="poe-detail-item__value">{renderVal(feature.crossing_name || feature.name || "Informal Crossing")}</span>
                    </div>
                    <div className="poe-detail-item">
                        <span className="poe-detail-item__label">Country Territory</span>
                        <span className="poe-detail-item__value">{renderVal(feature.ADM0_NAME || feature.country)}</span>
                    </div>
                    <div className="poe-detail-item">
                        <span className="poe-detail-item__label">IHR Deployment Priority</span>
                        <div className="poe-progress-wrapper">
                            <div className="poe-progress-header" style={{ color: riskInfo.color, fontWeight: "bold" }}>
                                <span>{riskInfo.label} Risk</span>
                                <span>{score} / 100</span>
                            </div>
                            <div className="poe-progress-bar">
                                <div
                                    className="poe-progress-bar__fill"
                                    style={{
                                        width: `${score}%`,
                                        backgroundColor: riskInfo.color,
                                        boxShadow: `0 0 10px ${riskInfo.color}80`,
                                    }}
                                />
                            </div>
                        </div>
                    </div>
                    <div className="poe-detail-item" style={{ borderTop: "1px solid var(--poe-border)", paddingTop: "12px", marginTop: "8px" }}>
                        <span className="poe-detail-item__label" style={{ marginBottom: "6px" }}>Composite Score Breakdown</span>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", fontSize: "0.75rem", color: "var(--poe-text-muted)" }}>
                            <div>Road Index: <strong>{renderVal(feature.score_road)} / 40</strong></div>
                            <div>Conflict Index: <strong>{renderVal(feature.score_conflict)} / 30</strong></div>
                            <div>Surface Index: <strong>{renderVal(feature.score_surface)} / 20</strong></div>
                        </div>
                    </div>
                </>
            );
        }

        // ── Template: Movement Flows (Lines) ───────────────────────
        if (layerKey === "anim_movement_flows") {
            const flowCount = feature.flow_count || 0;
            const flowWeight = feature.flow_weight || 0;
            return (
                <>
                    <div className="poe-detail-item">
                        <span className="poe-detail-item__label">Flow Corridor</span>
                        <span className="poe-detail-item__value" style={{ color: "var(--poe-teal)", fontWeight: "bold" }}>
                            {renderVal(feature.corridor)}
                        </span>
                    </div>
                    <div className="poe-detail-item">
                        <span className="poe-detail-item__label">Estimated Annual Flow Volume</span>
                        <span className="poe-detail-item__value" style={{ fontSize: "1.1rem", fontWeight: "800" }}>
                            {flowCount > 0 ? flowCount.toLocaleString() : "—"}{" "}
                            passages/yr
                        </span>
                    </div>
                    <div className="poe-detail-item">
                        <span className="poe-detail-item__label">Flow weight rating</span>
                        <div className="poe-progress-wrapper">
                            <div className="poe-progress-header" style={{ color: "var(--poe-teal)" }}>
                                <span>Normalised Flow weight</span>
                                <span>{flowWeight} / 10</span>
                            </div>
                            <div className="poe-progress-bar">
                                <div
                                    className="poe-progress-bar__fill"
                                    style={{
                                        width: `${flowWeight * 10}%`,
                                        backgroundColor: "var(--poe-teal)",
                                    }}
                                />
                            </div>
                        </div>
                    </div>
                    <div className="poe-detail-item">
                        <span className="poe-detail-item__label">Primary Flow Type</span>
                        <span className="poe-detail-item__value">{renderVal(feature.flow_type || "Labour migration / Cross-border trade")}</span>
                    </div>
                </>
            );
        }

        // ── Template: Border Buffer Zones (Polygons) ────────────────
        if (layerKey === "buffer_zones") {
            const dist = feature.buffer_distance || feature.buffer_dist || "10";
            return (
                <>
                    <div className="poe-detail-item">
                        <span className="poe-detail-item__label">Surveillance Buffer Zone</span>
                        <span className="poe-detail-item__value">{renderVal(feature.zone_type || "IHR Health Surveillance Boundary")}</span>
                    </div>
                    <div className="poe-detail-item">
                        <span className="poe-detail-item__label">Surveillance Radius</span>
                        <span className="poe-detail-item__value" style={{ fontSize: "1.05rem", fontWeight: "bold", color: "var(--poe-blue)" }}>
                            {dist} km Border Buffer
                        </span>
                    </div>
                    <div className="poe-detail-item">
                        <span className="poe-detail-item__label">Surveillance Mandate</span>
                        <span className="poe-detail-item__value" style={{ color: "var(--poe-text-muted)", fontSize: "0.8rem", lineHeight: "1.4" }}>
                            Requires proactive case identification, cross-border coordination, and rapid diagnostic capacities in alignment with Annex 1B.
                        </span>
                    </div>
                </>
            );
        }

        // ── Template: General Fallback ──────────────────────────────
        return (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {Object.entries(feature)
                    .filter(([k]) => !k.startsWith("_") && k !== "OBJECTID" && k !== "Shape" && k !== "Shape__Length" && k !== "Shape__Area")
                    .slice(0, 10)
                    .map(([k, v]) => (
                        <div key={k} className="poe-detail-item">
                            <span className="poe-detail-item__label">{k.replace(/_/g, " ")}</span>
                            <span className="poe-detail-item__value">{renderVal(v)}</span>
                        </div>
                    ))}
            </div>
        );
    };

    return (
        <>
            <div
                className={`poe-detail-panel-overlay ${isOpen ? "poe-detail-panel-overlay--visible" : ""}`}
                onClick={onClose}
            />
            <div className={`poe-detail-panel ${isOpen ? "poe-detail-panel--open" : ""}`}>
                <div className="poe-detail-panel__header">
                    <div className="poe-detail-panel__title-group">
                        <span className="poe-detail-panel__category">Geospatial Intelligence</span>
                        <h2 className="poe-detail-panel__title">Feature Details</h2>
                    </div>
                    <button className="poe-detail-panel__close" onClick={onClose} aria-label="Close details panel">
                        <Icon icon="mdi:close" />
                    </button>
                </div>
                <div className="poe-detail-panel__content">{renderContent()}</div>
            </div>
        </>
    );
}
