import { useState } from "react";
import OneHealthMap from "./components/OneHealthMap";
import LayerControl from "./components/LayerControl";
import MetricsStrip from "./components/MetricsStrip";
import AlertFeed, { type Alert } from "./components/AlertFeed";
import type { OHAgent, OHHITLAction } from "./services/oneHealth";
import AgentStatus from "./components/AgentStatus";
import HITLPanel from "./components/HITLPanel";
import SimulationPanel from "./components/SimulationPanel";
import MapLegend from "./components/MapLegend";
import StatusBar from "./components/StatusBar";
import SpilloverEarlyWarningPanel from "./components/SpilloverEarlyWarning";
import AlertDetailDrawer from "./components/AlertDetailDrawer";
import { tierBorderColor, type StaticCountry } from "./components/ohData";
import { type OHKPIs } from "./services/oneHealth";
import { useUnifiedSearch, type SearchResult } from "./hooks/useUnifiedSearch";
import "./one-health.css";

interface OneHealthViewProps {
  layers: Record<string, boolean>;
  toggleLayer: (key: string) => void;
  tooltip: {
    country: StaticCountry | null;
    x: number;
    y: number;
  };
  handleCountryHover: (country: StaticCountry | null, x: number, y: number) => void;
  countries: StaticCountry[];
  kpis: OHKPIs | null;
  dataSource: "loading" | "api" | "fallback";
  rightPanel: "ew" | "ops";
  setRightPanel: (panel: "ew" | "ops") => void;
  setSelectedCountryIso3: (iso3: string | undefined) => void;
  // TRIAD Additions
  search: string;
  setSearch: (s: string) => void;
  openAlertId: string | null;
  setOpenAlertId: (id: string | null) => void;
  alerts: Alert[];
  alertsSource: "db" | "static" | "loading";
  agents: OHAgent[];
  agentsSource: "db" | "loading" | "fallback";
  hitl: OHHITLAction[];
  hitlSource: "db" | "loading" | "fallback";
  onHITLApprove?: (id: string) => void;
  onHITLDismiss?: (id: string) => void;
  onHITLAcknowledge?: (id: string) => void;
}

export const OneHealthView = ({
  layers,
  toggleLayer,
  tooltip,
  handleCountryHover,
  countries,
  kpis,
  dataSource,
  rightPanel,
  setRightPanel,
  setSelectedCountryIso3,
  search,
  setSearch,
  openAlertId,
  setOpenAlertId,
  alerts,
  alertsSource,
  agents,
  agentsSource,
  hitl,
  hitlSource,
  onHITLApprove,
  onHITLDismiss,
  onHITLAcknowledge,
}: OneHealthViewProps) => {
  const [showSearch, setShowSearch] = useState(false);

  // Unified search hook
  const search2 = useUnifiedSearch(search, { limit: 8 });
  const searchResults = search2.results;

  // Map zoom handler (for search result country clicks)
  const handleZoom = (iso3: string) => {
    setSelectedCountryIso3(iso3);
  };

  // Search result click handler
  const handleSearchPick = (r: SearchResult) => {
    setShowSearch(false);
    setSearch("");
    if (r.type === "country") handleZoom(r.id);
    else if (r.type === "alert") setOpenAlertId(r.id);
  };

  const TYPE_COLOR: Record<string, string> = {
    country: "var(--oh-aqua)", disease: "var(--oh-amber)",
    alert: "var(--oh-crimson)", agent: "var(--oh-cobalt)",
  };
  const TYPE_LABEL: Record<string, string> = {
    country: "GEO", disease: "DIS", alert: "ALR", agent: "AGT",
  };

  return (
    <div className="w-full h-full overflow-hidden relative" style={{ background: "var(--oh-ink)" }}>
      {/* Data source badge */}
      <div className="absolute top-4 left-4 z-[700]">
        <span
          className="font-mono text-[8px] px-2 py-0.5 rounded tracking-wider uppercase"
          style={{
            background: dataSource === "api" ? "var(--oh-sage-dim)" : "var(--oh-amber-dim)",
            color: dataSource === "api" ? "var(--oh-sage)" : "var(--oh-amber)",
            border: `1px solid ${dataSource === "api" ? "rgba(61,232,154,0.25)" : "rgba(245,185,66,0.25)"}`,
          }}
        >
          {dataSource === "loading" ? "Loading…" : dataSource === "api" ? "LIVE · DB" : "FALLBACK · Static"}
        </span>
      </div>

      {/* Full-screen Map */}
      <div className="absolute inset-0 z-0">
        <OneHealthMap
          layers={layers}
          onCountryHover={handleCountryHover}
          countries={countries}
        />
      </div>

      {/* Search bar */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[600] w-[380px]">
        <div className="relative flex items-center">
          <span className="absolute left-3.5 text-[var(--oh-text3)] text-[13px] pointer-events-none">
            🔍
          </span>
          <input
            type="text"
            placeholder="Search country, disease, event..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setShowSearch(true); }}
            onFocus={() => setShowSearch(true)}
            className="w-full rounded-full px-4 py-2 pl-10 text-[12.5px] outline-none backdrop-blur-2xl"
            style={{
              background: "var(--oh-glass)",
              border: "1px solid var(--oh-border3)",
              color: "var(--oh-text)",
              fontFamily: "'Space Grotesk', sans-serif",
              boxShadow: "0 0 0 3px var(--oh-aqua-faint), 0 8px 32px rgba(0,0,0,0.4)",
            }}
          />
          <span
            className="absolute right-3.5 font-mono text-[9px] text-[var(--oh-text3)] px-1.5 py-0.5 rounded"
            style={{
              background: "var(--oh-ink4)",
              border: "1px solid var(--oh-border2)",
            }}
          >
            ⌘K
          </span>
        </div>

        {/* Search results dropdown */}
        {showSearch && searchResults.length > 0 && (
          <div className="oh-glass-card" style={{ marginTop: 6, overflow: "hidden" }}>
            {searchResults.map((r, i) => {
              const typeColor = TYPE_COLOR[r.type] || "var(--oh-text3)";
              const typeLabel = TYPE_LABEL[r.type] || "—";
              return (
                <div
                  key={`${r.type}-${r.id}-${i}`}
                  onClick={() => handleSearchPick(r)}
                  style={{
                    padding: "9px 14px", display: "flex", alignItems: "center", gap: 10,
                    cursor: "pointer", borderBottom: "1px solid var(--oh-border)",
                    transition: "background 0.1s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(0,223,200,0.05)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <span
                    className="font-mono"
                    style={{
                      width: 34, height: 30, borderRadius: 7,
                      background: `color-mix(in srgb, ${typeColor} 8%, transparent)`,
                      border: `1px solid color-mix(in srgb, ${typeColor} 20%, transparent)`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 8.5, color: typeColor, flexShrink: 0,
                    }}
                  >{typeLabel}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--oh-text)" }}>
                      {r.label}
                    </div>
                    <div style={{ fontSize: 10, color: "var(--oh-text3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {r.sub}
                    </div>
                  </div>
                </div>
              );
            })}
            {search2.took_ms > 0 && (
              <div className="font-mono" style={{ padding: "5px 14px", fontSize: 8.5, color: "var(--oh-text3)", textAlign: "right", borderTop: "1px solid var(--oh-border)" }}>
                {search2.total} result{search2.total !== 1 ? "s" : ""} · {search2.took_ms} ms
              </div>
            )}
          </div>
        )}
      </div>

      {/* Layer control (top-left) */}
      <LayerControl layers={layers} onToggle={toggleLayer} />

      {/* Map legend (left, above metrics) */}
      <MapLegend />

      {/* Metric cards — pass real KPIs if available */}
      <MetricsStrip kpis={kpis} />

      {/* Right panel toggle */}
      <div className="absolute top-6 right-[144px] z-[650] flex gap-1 backdrop-blur-xl rounded-lg p-1"
        style={{ background: "rgba(8,17,28,0.92)", border: "1px solid var(--oh-border2)" }}>
        <button
          className="font-mono text-[10px] px-3 py-1.5 rounded-md transition-all font-semibold"
          style={{
            background: rightPanel === "ew" ? "var(--oh-aqua-glow)" : "transparent",
            color: rightPanel === "ew" ? "var(--oh-aqua)" : "var(--oh-text2)",
            border: `1px solid ${rightPanel === "ew" ? "var(--oh-border3)" : "transparent"}`,
          }}
          onClick={() => setRightPanel("ew")}
        >
          🔬 Early Warning
        </button>
        <button
          className="font-mono text-[10px] px-3 py-1.5 rounded-md transition-all font-semibold"
          style={{
            background: rightPanel === "ops" ? "var(--oh-aqua-glow)" : "transparent",
            color: rightPanel === "ops" ? "var(--oh-aqua)" : "var(--oh-text2)",
            border: `1px solid ${rightPanel === "ops" ? "var(--oh-border3)" : "transparent"}`,
          }}
          onClick={() => setRightPanel("ops")}
        >
          📋 Operations
        </button>
      </div>

      {/* Right panel — Spillover Early Warning OR Alerts/Agents/HITL */}
      {rightPanel === "ew" ? (
        <SpilloverEarlyWarningPanel
          onSelectCountry={(iso3) => setSelectedCountryIso3(iso3)}
        />
      ) : (
        <div className="absolute top-[72px] right-3 bottom-8 w-[370px] z-[500] flex flex-col gap-2 overflow-y-auto oh-scroll">
          <AlertFeed alerts={alerts} source={alertsSource} onOpenDetail={setOpenAlertId} />
          <AgentStatus agents={agents} source={agentsSource} />
          <HITLPanel
            items={hitl}
            source={hitlSource}
            onApprove={onHITLApprove}
            onDismiss={onHITLDismiss}
            onAcknowledge={onHITLAcknowledge}
          />
        </div>
      )}

      {/* Alert detail drawer */}
      <AlertDetailDrawer
        alertId={openAlertId}
        onClose={() => setOpenAlertId(null)}
      />

      {/* Bottom simulation panel */}
      <SimulationPanel />

      {/* Status bar — show data source */}
      <StatusBar dataSource={dataSource} />

      {/* Country tooltip */}
      {tooltip.country && (
        <div
          className="fixed z-[900] oh-glass-card px-3.5 py-3 pointer-events-none min-w-[200px]"
          style={{
            left: tooltip.x + 14,
            top: tooltip.y - 20,
            boxShadow: "0 4px 24px rgba(0,0,0,0.5), 0 0 0 1px var(--oh-aqua-glow)",
          }}
        >
          <div className="text-[13px] font-bold text-[var(--oh-text)] mb-1.5 flex items-center gap-1.5">
            {tooltip.country.name}
          </div>
          {[
            ["SUBREGION", tooltip.country.sub, "var(--oh-aqua)"],
            ["SPILLOVER RISK", `${tooltip.country.risk.toFixed(1)} / 10`, tooltip.country.risk >= 8 ? "var(--oh-crimson)" : tooltip.country.risk >= 6 ? "var(--oh-amber)" : "var(--oh-cobalt)"],
            ["IHR SPAR", `${tooltip.country.spar}%`, "var(--oh-text)"],
            ["ALERT TIER", tooltip.country.tier > 0 ? `Tier ${tooltip.country.tier}` : "No active alert", tierBorderColor(tooltip.country.tier)],
          ].map(([key, val, color]) => (
            <div key={key} className="flex justify-between items-center py-0.5 border-b border-[var(--oh-border)] last:border-b-0 text-[10.5px]">
              <span className="text-[var(--oh-text3)] font-mono text-[9px]">{key}</span>
              <span className="font-semibold font-mono text-[10px]" style={{ color: color as string }}>{val}</span>
            </div>
          ))}
          {tooltip.country.alert && (
            <>
              <div className="flex justify-between items-center py-0.5 border-b border-[var(--oh-border)] text-[10.5px]">
                <span className="text-[var(--oh-text3)] font-mono text-[9px]">DISEASE</span>
                <span className="font-semibold font-mono text-[10px]" style={{ color: tierBorderColor(tooltip.country.tier) }}>
                  {tooltip.country.alert.disease}
                </span>
              </div>
              <div className="flex justify-between items-center py-0.5 text-[10.5px]">
                <span className="text-[var(--oh-text3)] font-mono text-[9px]">NOTE</span>
                <span className="font-mono text-[10px] text-[var(--oh-text2)]">
                  {tooltip.country.alert.note}
                </span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
