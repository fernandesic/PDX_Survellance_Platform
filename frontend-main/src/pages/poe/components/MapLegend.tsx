import { useState } from "react";
import { Icon } from "@iconify/react";
import { PIPELINE_LABELS, getLayersByGroup } from "../services/poe";
import type { IHRLayerConfig, PipelineGroup } from "../services/poe";

interface MapLegendProps {
    visibleLayerTitles: string[];
    onLayerToggle: (layerTitle: string) => void;
}

/**
 * Visual mapping: matches the renderers in PoEMap.tsx so the legend
 * shows the same colour + glyph the user sees on the map.
 */
const LEGEND_SWATCHES: Record<string, { color: string; shape: "circle" | "square" | "triangle" | "diamond" | "x" | "line" | "polygon" | "heat" }> = {
    outbreak_news:       { color: "#ef4444", shape: "diamond" },
    airports:            { color: "#ec4899", shape: "triangle" },
    seaports:            { color: "#06b6d4", shape: "square" },
    inland_ports:        { color: "#a855f7", shape: "diamond" },
    unhcr:               { color: "#f59e0b", shape: "circle" },
    unhcr_presence:      { color: "#14b8a6", shape: "circle" },
    border_crossings:    { color: "#3b82f6", shape: "x" },
    border_lines:        { color: "#fd7f6f", shape: "line" },
    informal_crossings:  { color: "#f97316", shape: "circle" },
    corridor_hotspots:   { color: "#e11d48", shape: "diamond" },
    buffer_zones:        { color: "#4682b4", shape: "polygon" },
    corridor_risk:       { color: "#dc2626", shape: "heat" },
    anim_movement_flows: { color: "#00c8c8", shape: "line" },
};

function Swatch({ layerKey }: { layerKey: string }) {
    const s = LEGEND_SWATCHES[layerKey];
    if (!s) {
        return <span className="poe-legend__swatch" style={{ background: "#888", borderRadius: "50%" }} />;
    }
    const base: React.CSSProperties = {
        display: "inline-block",
        width: 14,
        height: 14,
        flexShrink: 0,
    };
    switch (s.shape) {
        case "circle":
            return <span className="poe-legend__swatch" style={{ ...base, background: s.color, borderRadius: "50%", boxShadow: `0 0 6px ${s.color}80` }} />;
        case "square":
            return <span className="poe-legend__swatch" style={{ ...base, background: s.color }} />;
        case "triangle":
            return <span className="poe-legend__swatch" style={{ ...base, background: "transparent", width: 0, height: 0, borderLeft: "7px solid transparent", borderRight: "7px solid transparent", borderBottom: `12px solid ${s.color}` }} />;
        case "diamond":
            return <span className="poe-legend__swatch" style={{ ...base, background: s.color, transform: "rotate(45deg)", width: 10, height: 10 }} />;
        case "x":
            return (
                <span className="poe-legend__swatch" style={{ ...base, position: "relative" }}>
                    <span style={{ position: "absolute", inset: 0, background: s.color, transform: "rotate(45deg)", width: 2, height: 14, left: 6 }} />
                    <span style={{ position: "absolute", inset: 0, background: s.color, transform: "rotate(-45deg)", width: 2, height: 14, left: 6 }} />
                </span>
            );
        case "line":
            return <span className="poe-legend__swatch" style={{ ...base, height: 3, background: s.color, alignSelf: "center", borderRadius: 2 }} />;
        case "polygon":
            return <span className="poe-legend__swatch" style={{ ...base, background: `${s.color}26`, border: `1px solid ${s.color}99` }} />;
        case "heat":
            return <span className="poe-legend__swatch" style={{ ...base, borderRadius: "50%", background: `radial-gradient(circle, ${s.color} 0%, ${s.color}66 40%, transparent 75%)` }} />;
        default:
            return <span className="poe-legend__swatch" style={{ ...base, background: s.color, borderRadius: "50%" }} />;
    }
}

export function MapLegend({ visibleLayerTitles, onLayerToggle }: MapLegendProps) {
    const [collapsed, setCollapsed] = useState(false);
    const [openGroups, setOpenGroups] = useState<Record<PipelineGroup, boolean>>({
        official_poe: true,
        informal_corridors: true,
        movement_flows: true,
        animation: false,
    });

    const groups: PipelineGroup[] = ["official_poe", "informal_corridors", "movement_flows"];

    const toggleGroup = (g: PipelineGroup) =>
        setOpenGroups((prev) => ({ ...prev, [g]: !prev[g] }));

    if (collapsed) {
        return (
            <button
                className="poe-legend poe-legend--collapsed"
                onClick={() => setCollapsed(false)}
                title="Show legend"
            >
                <Icon icon="mdi:map-legend" style={{ fontSize: "1.1rem" }} />
                <span>Legend</span>
            </button>
        );
    }

    return (
        <div className="poe-legend">
            <div className="poe-legend__header">
                <Icon icon="mdi:map-legend" style={{ fontSize: "1rem", color: "var(--poe-blue)" }} />
                <span className="poe-legend__title">Map Legend</span>
                <button
                    className="poe-legend__close"
                    onClick={() => setCollapsed(true)}
                    title="Collapse"
                    aria-label="Collapse legend"
                >
                    <Icon icon="mdi:close" style={{ fontSize: "1rem" }} />
                </button>
            </div>

            <div className="poe-legend__body">
                {groups.map((g) => {
                    const layers: IHRLayerConfig[] = getLayersByGroup(g);
                    if (layers.length === 0) return null;
                    const meta = PIPELINE_LABELS[g];
                    const isOpen = openGroups[g];
                    const visibleCount = layers.filter((l) => visibleLayerTitles.includes(l.title)).length;

                    return (
                        <div key={g} className="poe-legend__group">
                            <button
                                className="poe-legend__group-header"
                                onClick={() => toggleGroup(g)}
                            >
                                <span className="poe-legend__group-icon">{meta.icon}</span>
                                <span className="poe-legend__group-label">{meta.label}</span>
                                <span className="poe-legend__group-count">
                                    {visibleCount}/{layers.length}
                                </span>
                                <Icon
                                    icon={isOpen ? "mdi:chevron-up" : "mdi:chevron-down"}
                                    style={{ fontSize: "1rem", marginLeft: "auto" }}
                                />
                            </button>

                            {isOpen && (
                                <ul className="poe-legend__items">
                                    {layers.map((layer) => {
                                        const isVisible = visibleLayerTitles.includes(layer.title);
                                        return (
                                            <li
                                                key={layer.key}
                                                className={`poe-legend__item ${isVisible ? "poe-legend__item--on" : ""}`}
                                                onClick={() => onLayerToggle(layer.title)}
                                                title={layer.description}
                                            >
                                                <Swatch layerKey={layer.key} />
                                                <span className="poe-legend__item-label">{layer.label}</span>
                                                <Icon
                                                    icon={isVisible ? "mdi:eye-outline" : "mdi:eye-off-outline"}
                                                    style={{
                                                        fontSize: "0.9rem",
                                                        color: isVisible ? "var(--poe-green)" : "var(--poe-text-dim)",
                                                        marginLeft: "auto",
                                                    }}
                                                />
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
