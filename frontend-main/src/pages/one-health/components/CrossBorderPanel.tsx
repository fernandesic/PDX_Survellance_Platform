/**
 * CrossBorderPanel.tsx
 * --------------------
 * Cross-border Importation sub-tab for the OneHealth Spillover Simulation Engine.
 *
 * Ported from Isaias Fernandes Co's CrossBorderPanel.jsx to TypeScript,
 * adapted to use the existing OH design system CSS variables and
 * oneHealthApi service layer.
 *
 * Features:
 *   1. Corridor preset selector (Ituri, N-Kivu, Equateur, Cross-Sahel)
 *   2. Editable country grid with mobility data
 *   3. Global hazard parameter sliders
 *   4. Active-I trajectory input (manual paste or future wbepi link)
 *   5. Per-country importation results with risk tiers
 *   6. Cumulative imports line chart + sensitivity bar chart
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, BarChart, Bar, ReferenceLine,
} from "recharts";
import {
  oneHealthApi,
  type OHCrossBorderCountry,
  type OHCrossBorderResponse,
  type OHCrossBorderSensitivityResponse,
} from "../services/oneHealth";

/* ═══════════════════════════════════════════════════════════════════════════
   Design tokens — use OH CSS variables where possible, hex fallbacks match
   ═══════════════════════════════════════════════════════════════════════════ */
const TIER_COLORS: Record<string, string> = {
  "HIGH":          "var(--oh-crimson, #FF3A58)",
  "HIGH-MODERATE": "#FF7A59",
  "MODERATE":      "var(--oh-amber, #F5B942)",
  "LOW":           "var(--oh-sage, #3DE89A)",
  "VERY LOW":      "var(--oh-cobalt, #4D8EF5)",
};

const COUNTRY_LINE_COLORS = ["#FF3A58", "#F5B942", "#00DFC8", "#4D8EF5", "#3DE89A", "#B17DFF"];

/* ═══════════════════════════════════════════════════════════════════════════
   Default data
   ═══════════════════════════════════════════════════════════════════════════ */
const DEFAULT_COUNTRIES: OHCrossBorderCountry[] = [
  { name: "Uganda",      iso3: "UGA", daily_crossings: 4500, catchment_share: 0.35, border_open: 1.0, direct_border: true,  ghs_index: 49.6, readiness_composite: 0.62 },
  { name: "South Sudan", iso3: "SSD", daily_crossings: 1200, catchment_share: 0.55, border_open: 0.7, direct_border: true,  ghs_index: 28.6, readiness_composite: 0.28 },
  { name: "Rwanda",      iso3: "RWA", daily_crossings: 600,  catchment_share: 0.05, border_open: 1.0, direct_border: false, ghs_index: 44.1, readiness_composite: 0.75 },
  { name: "Burundi",     iso3: "BDI", daily_crossings: 200,  catchment_share: 0.02, border_open: 1.0, direct_border: false, ghs_index: 33.5, readiness_composite: 0.48 },
];

interface HazardParams {
  travel_while_infectious: number;
  detection_at_poe: number;
  source_catchment_population: number;
  horizon_days: number;
}

const DEFAULT_PARAMS: HazardParams = {
  travel_while_infectious: 0.15,
  detection_at_poe: 0.20,
  source_catchment_population: 250000,
  horizon_days: 84,
};

/* ═══════════════════════════════════════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════════════════════════════════════ */
export default function CrossBorderPanel() {
  // State
  const [params, setParams] = useState<HazardParams>(DEFAULT_PARAMS);
  const [countries, setCountries] = useState<OHCrossBorderCountry[]>(DEFAULT_COUNTRIES);
  const [presets, setPresets] = useState<string[]>([]);
  const [selectedPreset, setSelectedPreset] = useState("ituri");
  const [activeI, setActiveI] = useState<number[]>([]);
  const [activeISource, setActiveISource] = useState<"manual" | "wbepi">("manual");
  const [results, setResults] = useState<OHCrossBorderResponse | null>(null);
  const [sensitivity, setSensitivity] = useState<OHCrossBorderSensitivityResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);

  // Load corridor presets on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await oneHealthApi.getCorridorPresets();
        if (!cancelled && Array.isArray(list)) setPresets(list);
      } catch {
        if (!cancelled) setPresets(["ituri", "north-kivu-goma", "equateur"]);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Load a corridor preset
  const loadPreset = useCallback(async (name: string) => {
    try {
      const data = await oneHealthApi.getCorridorPreset(name);
      if (data?.countries) {
        setCountries(data.countries);
        setSelectedPreset(name);
        setStale(true);
      }
    } catch (e: any) {
      setError(`Preset load failed: ${e?.message || e}`);
    }
  }, []);

  // Run the importation hazard model
  const run = useCallback(async () => {
    if (!activeI || activeI.length < params.horizon_days) {
      setError(`Active-I series too short (${activeI.length} < ${params.horizon_days}). Paste a trajectory or load a scenario.`);
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const r = await oneHealthApi.postCrossBorderImportation({
        active_I_series: activeI,
        source_catchment_population: params.source_catchment_population,
        travel_while_infectious: params.travel_while_infectious,
        detection_at_poe: params.detection_at_poe,
        horizon_days: params.horizon_days,
        countries,
      });
      setResults(r);
      setStale(false);
    } catch (e: any) {
      setError(`Run failed: ${e?.message || e}`);
    } finally {
      setLoading(false);
    }
  }, [activeI, params, countries]);

  // Sensitivity sweep
  const runSensitivity = useCallback(async () => {
    if (!activeI || activeI.length < params.horizon_days) {
      setError("Cannot run sensitivity without a valid active-I trajectory.");
      return;
    }
    setLoading(true);
    try {
      const r = await oneHealthApi.postCrossBorderSensitivity({
        active_I_series: activeI,
        source_catchment_population: params.source_catchment_population,
        detection_at_poe: params.detection_at_poe,
        horizon_days: params.horizon_days,
        countries,
        twi_values: [0.05, 0.10, 0.15, 0.25, 0.40],
      });
      setSensitivity(r);
    } catch (e: any) {
      setError(`Sensitivity failed: ${e?.message || e}`);
    } finally {
      setLoading(false);
    }
  }, [activeI, params, countries]);

  // Chart data
  const chartData = useMemo(() => {
    if (!results) return [];
    return Array.from({ length: results.horizon_days }, (_, t) => {
      const point: Record<string, number> = { day: t };
      results.countries.forEach(c => {
        point[c.name] = c.cumulative_lambda[t] || 0;
      });
      return point;
    });
  }, [results]);

  const sensitivityData = useMemo(() => {
    if (!sensitivity) return [];
    return sensitivity.twi_values.map(twi => {
      const row: Record<string, string | number> = { twi: `${Math.round(twi * 100)}%` };
      Object.entries(sensitivity.by_country).forEach(([name, byTwi]) => {
        row[name] = byTwi[String(twi)] || 0;
      });
      return row;
    });
  }, [sensitivity]);

  // Country grid editing
  const updateCountry = (idx: number, field: string, value: any) => {
    setCountries(prev => prev.map((c, i) => i === idx ? { ...c, [field]: value } : c));
    setStale(true);
  };
  const removeCountry = (idx: number) => {
    setCountries(prev => prev.filter((_, i) => i !== idx));
    setStale(true);
  };
  const addCountry = () => {
    setCountries(prev => [...prev, {
      name: "New Country", iso3: "XXX",
      daily_crossings: 0, catchment_share: 0, border_open: 1.0,
      direct_border: false, ghs_index: null, readiness_composite: null,
    }]);
    setStale(true);
  };

  return (
    <div className="px-4 py-3 overflow-y-auto oh-scroll" style={{ height: "100%", color: "var(--oh-text)" }}>

      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-[14px] font-semibold" style={{ color: "var(--oh-text)" }}>
            Cross-border Importation
          </div>
          <div className="font-mono text-[10px]" style={{ color: "var(--oh-text3)" }}>
            Poisson hazard model · driven by source-outbreak active-I trajectory
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={run} disabled={loading}
            className="font-mono text-[11px] px-3 py-1.5 rounded-md font-semibold transition-all"
            style={{
              background: loading ? "var(--oh-border)" : "var(--oh-who, #0093D5)",
              color: "#fff", border: "none",
              cursor: loading ? "not-allowed" : "pointer",
            }}>
            {loading ? "Running…" : (stale ? "▶ Refresh" : "▶ Run")}
          </button>
          <button onClick={runSensitivity} disabled={loading}
            className="font-mono text-[11px] px-3 py-1.5 rounded-md transition-all"
            style={{
              background: "transparent", color: "var(--oh-text)",
              border: "1px solid var(--oh-border2)",
              cursor: loading ? "not-allowed" : "pointer",
            }}>
            Sensitivity
          </button>
        </div>
      </div>

      {/* Two-column layout: Left (trajectory + params) | Right (countries + results) */}
      <div className="grid gap-4" style={{ gridTemplateColumns: "1fr 1fr" }}>

        {/* LEFT COLUMN */}
        <div className="flex flex-col gap-3">

          {/* Source trajectory */}
          <SectionLabel title="Source outbreak — active-I trajectory" />
          <div className="flex gap-3 items-center mb-1">
            <label className="flex gap-1.5 items-center text-[11px]" style={{ color: "var(--oh-text2)" }}>
              <input type="radio" checked={activeISource === "manual"} onChange={() => setActiveISource("manual")} />
              Manual paste
            </label>
            <label className="flex gap-1.5 items-center text-[11px]" style={{ color: "var(--oh-text2)" }}>
              <input type="radio" checked={activeISource === "wbepi"} onChange={() => setActiveISource("wbepi")} />
              wbepi scenario
            </label>
            {activeI.length > 0 && (
              <span className="font-mono text-[10px]" style={{ color: "var(--oh-text3)" }}>
                {activeI.length}d loaded · peak {Math.round(Math.max(...activeI))}
              </span>
            )}
          </div>
          {activeISource === "manual" && (
            <textarea
              placeholder='Paste JSON array: [2, 3, 4, ...]'
              value={activeI.length > 0 ? JSON.stringify(activeI) : ""}
              onChange={(e) => {
                try { setActiveI(JSON.parse(e.target.value)); setStale(true); }
                catch { /* ignore while typing */ }
              }}
              className="font-mono text-[11px] rounded-md"
              style={{
                width: "100%", minHeight: 48, padding: 6,
                background: "var(--oh-ink3, rgba(11,23,38,0.8))", color: "var(--oh-text)",
                border: "1px solid var(--oh-border)", resize: "vertical",
              }}
            />
          )}
          {activeISource === "wbepi" && (
            <div className="text-[11px] px-2 py-2 rounded" style={{
              background: "rgba(79,142,247,0.08)", border: "1px solid rgba(79,142,247,0.2)",
              color: "var(--oh-cobalt)",
            }}>
              wbepi scenario endpoint not yet available. Use manual paste for now.
            </div>
          )}

          {/* Global hazard parameters */}
          <SectionLabel title="Global hazard parameters" />
          <ParamSlider label="Travel-while-infectious" value={params.travel_while_infectious}
            min={0.05} max={0.40} step={0.01}
            onChange={v => { setParams(p => ({ ...p, travel_while_infectious: v })); setStale(true); }}
            format={v => `${Math.round(v * 100)}%`}
            hint="Most influential parameter" />
          <ParamSlider label="Detection at PoE" value={params.detection_at_poe}
            min={0} max={1} step={0.05}
            onChange={v => { setParams(p => ({ ...p, detection_at_poe: v })); setStale(true); }}
            format={v => `${Math.round(v * 100)}%`} />
          <div className="grid gap-2" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <ParamNumber label="Catchment pop." value={params.source_catchment_population}
              onChange={v => { setParams(p => ({ ...p, source_catchment_population: v })); setStale(true); }} />
            <ParamNumber label="Horizon (days)" value={params.horizon_days}
              onChange={v => { setParams(p => ({ ...p, horizon_days: v })); setStale(true); }} />
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div className="flex flex-col gap-3">

          {/* Corridor preset + country grid */}
          <SectionLabel title="Neighbouring countries" />
          <div className="flex gap-1.5 items-center flex-wrap mb-1">
            <span className="font-mono text-[10px]" style={{ color: "var(--oh-text3)" }}>Preset:</span>
            {presets.map(p => (
              <button key={p} onClick={() => loadPreset(p)}
                className="font-mono text-[10px] px-2 py-0.5 rounded transition-all"
                style={{
                  background: "transparent",
                  color: selectedPreset === p ? "var(--oh-aqua)" : "var(--oh-text3)",
                  border: `1px solid ${selectedPreset === p ? "var(--oh-aqua)" : "var(--oh-border)"}`,
                  cursor: "pointer",
                }}>
                {p}
              </button>
            ))}
            <button onClick={addCountry}
              className="font-mono text-[10px] px-2 py-0.5 rounded ml-auto"
              style={{ background: "transparent", color: "var(--oh-text2)", border: "1px solid var(--oh-border2)", cursor: "pointer" }}>
              + Add
            </button>
          </div>

          {/* Compact country table */}
          <div className="overflow-x-auto" style={{ maxHeight: 160 }}>
            <table className="w-full text-[11px]" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--oh-border)" }}>
                  {["Country", "ISO3", "Crossings/d", "Catchment", "Border", "Direct", ""].map(h =>
                    <th key={h} className="text-left font-mono font-semibold px-1 py-1" style={{ color: "var(--oh-text3)", fontSize: 10 }}>{h}</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {countries.map((c, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid var(--oh-border)" }}>
                    <td className="px-1 py-0.5"><CellInput value={c.name} onChange={v => updateCountry(i, "name", v)} /></td>
                    <td className="px-1 py-0.5"><CellInput value={c.iso3} onChange={v => updateCountry(i, "iso3", v.toUpperCase())} style={{ width: 40 }} /></td>
                    <td className="px-1 py-0.5"><CellInput type="number" value={c.daily_crossings} onChange={v => updateCountry(i, "daily_crossings", Number(v))} /></td>
                    <td className="px-1 py-0.5"><CellInput type="number" value={c.catchment_share} onChange={v => updateCountry(i, "catchment_share", Number(v))} step="0.01" /></td>
                    <td className="px-1 py-0.5"><CellInput type="number" value={c.border_open} onChange={v => updateCountry(i, "border_open", Number(v))} step="0.05" /></td>
                    <td className="text-center px-1 py-0.5">
                      <input type="checkbox" checked={c.direct_border} onChange={e => updateCountry(i, "direct_border", e.target.checked)} />
                    </td>
                    <td className="px-1 py-0.5">
                      <button onClick={() => removeCountry(i)} className="text-[14px]" style={{ color: "var(--oh-crimson)", background: "none", border: "none", cursor: "pointer" }}>×</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mt-2 px-3 py-2 rounded text-[11px]" style={{
          background: "rgba(255,58,88,0.08)", border: "1px solid var(--oh-crimson)",
          color: "#FFD7D7",
        }}>
          {error}
        </div>
      )}

      {/* Results */}
      {results && (
        <div className="mt-3">
          <SectionLabel title={`Results — ${results.horizon_days} days`} />
          {stale && (
            <div className="px-2 py-1.5 rounded text-[10px] mb-2" style={{
              background: "rgba(245,185,66,0.08)", border: "1px solid var(--oh-amber)", color: "var(--oh-amber)",
            }}>
              Inputs changed since last run — click Refresh.
            </div>
          )}

          {/* Per-country cards */}
          <div className="grid gap-2 mb-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
            {results.countries.map(c => (
              <div key={c.iso3} className="rounded-md px-2.5 py-2" style={{
                background: "var(--oh-ink3, rgba(11,23,38,0.6))",
                border: "1px solid var(--oh-border)",
                borderLeft: `3px solid ${TIER_COLORS[c.tier] || "var(--oh-text3)"}`,
              }}>
                <div className="flex justify-between items-baseline mb-1">
                  <span className="text-[12px] font-semibold">{c.name}</span>
                  <span className="font-mono text-[9px] font-bold" style={{ color: TIER_COLORS[c.tier] }}>
                    {c.tier}
                  </span>
                </div>
                <div className="font-mono text-[20px] font-bold" style={{ color: TIER_COLORS[c.tier] }}>
                  {(c.p_any_import * 100).toFixed(1)}%
                </div>
                <div className="font-mono text-[10px]" style={{ color: "var(--oh-text3)" }}>
                  P(≥1 import) · E={c.expected_imports.toFixed(2)}
                </div>
                <div className="grid grid-cols-3 gap-1 mt-1.5 font-mono text-[10px]">
                  <div><span style={{ color: "var(--oh-text3)" }}>4w</span> {(c.p_any_w4 * 100).toFixed(1)}%</div>
                  <div><span style={{ color: "var(--oh-text3)" }}>8w</span> {(c.p_any_w8 * 100).toFixed(1)}%</div>
                  <div><span style={{ color: "var(--oh-text3)" }}>12w</span> {(c.p_any_w12 * 100).toFixed(1)}%</div>
                </div>
              </div>
            ))}
          </div>

          {/* Cumulative trajectory chart */}
          <div className="rounded-md px-3 py-2" style={{
            background: "var(--oh-ink3, rgba(11,23,38,0.6))", border: "1px solid var(--oh-border)",
          }}>
            <div className="font-mono text-[10px] mb-2" style={{ color: "var(--oh-text3)" }}>
              Cumulative expected imports over horizon
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--oh-border, #1B2A3D)" />
                <XAxis dataKey="day" stroke="var(--oh-text3)" fontSize={9}
                  label={{ value: "Days", position: "insideBottom", offset: -2, fill: "var(--oh-text3)", fontSize: 9 }} />
                <YAxis stroke="var(--oh-text3)" fontSize={9} />
                <Tooltip contentStyle={{ background: "var(--oh-ink)", border: "1px solid var(--oh-border2)", fontSize: 11, borderRadius: 6 }} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                {[28, 56, 84].map(w => (
                  <ReferenceLine key={w} x={w - 1} stroke="var(--oh-text3)" strokeDasharray="2 4" />
                ))}
                {results.countries.map((c, i) => (
                  <Line key={c.iso3} type="monotone" dataKey={c.name}
                    stroke={COUNTRY_LINE_COLORS[i % COUNTRY_LINE_COLORS.length]}
                    strokeWidth={2} dot={false} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Sensitivity */}
      {sensitivity && (
        <div className="mt-3">
          <SectionLabel title="Sensitivity — travel-while-infectious" />
          <div className="rounded-md px-3 py-2" style={{
            background: "var(--oh-ink3, rgba(11,23,38,0.6))", border: "1px solid var(--oh-border)",
          }}>
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={sensitivityData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--oh-border, #1B2A3D)" />
                <XAxis dataKey="twi" stroke="var(--oh-text3)" fontSize={9} />
                <YAxis stroke="var(--oh-text3)" fontSize={9} />
                <Tooltip contentStyle={{ background: "var(--oh-ink)", border: "1px solid var(--oh-border2)", fontSize: 11, borderRadius: 6 }} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                {Object.keys(sensitivity.by_country).map((name, i) => (
                  <Bar key={name} dataKey={name}
                    fill={COUNTRY_LINE_COLORS[i % COUNTRY_LINE_COLORS.length]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Sub-components
   ═══════════════════════════════════════════════════════════════════════════ */

function SectionLabel({ title }: { title: string }) {
  return (
    <div className="font-mono text-[10px] font-semibold tracking-widest uppercase pb-1"
      style={{ color: "var(--oh-text3)", borderBottom: "1px solid var(--oh-border)" }}>
      {title}
    </div>
  );
}

function ParamSlider({ label, value, min, max, step, onChange, format, hint }: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; format?: (v: number) => string; hint?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <div style={{ width: 140 }}>
        <div className="text-[11px]" style={{ color: "var(--oh-text2)" }}>{label}</div>
        {hint && <div className="text-[9px]" style={{ color: "var(--oh-text3)" }}>{hint}</div>}
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))} className="oh-slider flex-1" />
      <span className="font-mono text-[11px] w-10 text-right" style={{ color: "var(--oh-aqua)" }}>
        {format ? format(value) : value}
      </span>
    </div>
  );
}

function ParamNumber({ label, value, onChange }: {
  label: string; value: number; onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="text-[10px] mb-0.5" style={{ color: "var(--oh-text3)" }}>{label}</div>
      <input type="number" value={value} onChange={(e) => onChange(Number(e.target.value))}
        className="font-mono text-[11px] w-full rounded px-2 py-1"
        style={{
          background: "var(--oh-ink3, rgba(11,23,38,0.8))", color: "var(--oh-text)",
          border: "1px solid var(--oh-border)",
        }} />
    </div>
  );
}

function CellInput({ value, onChange, type = "text", style, step }: {
  value: string | number; onChange: (v: string) => void; type?: string; style?: React.CSSProperties; step?: string;
}) {
  return (
    <input type={type} value={value} step={step}
      onChange={(e) => onChange(e.target.value)}
      className="font-mono text-[10px] rounded px-1 py-0.5"
      style={{
        background: "var(--oh-ink3, rgba(11,23,38,0.8))", color: "var(--oh-text)",
        border: "1px solid var(--oh-border)", width: "100%",
        ...style,
      }} />
  );
}
