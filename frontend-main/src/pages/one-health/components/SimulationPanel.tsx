import { useState, useCallback, useMemo, useEffect } from "react";
import { DISEASES } from "./ohData";
import SeirLiveRunner from "./SeirLiveRunner";
import CrossBorderPanel from "./CrossBorderPanel";
import { oneHealthApi, type OHPathogen } from "../services/oneHealth";

const RISK_LABEL_STYLE: Record<string, string> = {
  Critical: "bg-[rgba(255,61,90,0.12)] text-[var(--oh-crimson)]",
  High: "bg-[rgba(255,179,71,0.1)] text-[var(--oh-amber)]",
  Moderate: "bg-[rgba(79,142,247,0.1)] text-[var(--oh-cobalt)]",
  Low: "bg-[rgba(77,232,160,0.1)] text-[var(--oh-sage)]",
};

interface SimDisease {
  name: string;
  r0: number;
  cfr: number;
  r0Range: string;
  riskLabel: string;
  riskScore: number;
}

function pathogenToSimDisease(p: OHPathogen): SimDisease {
  const r0Min = Number(p.r0_min ?? 0);
  const r0Max = Number(p.r0_max ?? 1.5);
  const score = Number(p.spillover_score ?? 0);
  const label = score >= 80 ? "Critical" :
    score >= 60 ? "High" :
      score >= 40 ? "Moderate" : "Low";
  return {
    name: p.disease,
    r0: (r0Min + r0Max) / 2 || 1,
    cfr: Number(p.cfr_pct ?? 0),
    r0Range: `${r0Min}–${r0Max}`,
    riskLabel: label,
    riskScore: score,
  };
}

export default function SimulationPanel() {
  const [expanded, setExpanded] = useState(false);
  const [simTab, setSimTab] = useState<"zoonotic" | "xborder">("zoonotic");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [sliders, setSliders] = useState([72, 58, 81, 43, 51]);
  const [diseases, setDiseases] = useState<SimDisease[]>(DISEASES);
  const [diseaseSource, setDiseaseSource] = useState<"db" | "loading" | "fallback">("loading");

  // Fetch real pathogen profiles from backend (oh_pathogen_profiles table).
  // Falls back to the static DISEASES array if API empty/unreachable.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await oneHealthApi.getPathogens();
        if (cancelled) return;
        if (data && Array.isArray(data) && data.length > 0) {
          const mapped = data.map(pathogenToSimDisease);
          // Sort highest risk first so the panel surfaces important diseases
          mapped.sort((a, b) => b.riskScore - a.riskScore);
          setDiseases(mapped);
          setDiseaseSource("db");
        } else {
          setDiseaseSource("fallback");
        }
      } catch {
        if (!cancelled) setDiseaseSource("fallback");
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const sliderLabels = ["Host-Human Interface", "Deforestation Rate", "Livestock Density", "Vaccination Coverage", "Lab Capacity (IHR)"];
  const disease = diseases[selectedIdx] || diseases[0] || DISEASES[0];

  // Stable reference so SeirLiveRunner doesn't reset on every parent re-render.
  const seirDisease = useMemo(
    () => ({ r0_min: disease.r0 * 0.8, r0_max: disease.r0 * 1.2, cfr_pct: disease.cfr }),
    [disease.r0, disease.cfr]
  );

  const updateSlider = useCallback((idx: number, val: number) => {
    setSliders((prev) => { const n = [...prev]; n[idx] = val; return n; });
  }, []);

  return (
    <div
      className={`absolute bottom-8 z-[500] backdrop-blur-3xl border-t border-l border-r rounded-t-xl transition-all duration-300 overflow-hidden`}
      style={{
        left: "220px", right: "390px",
        height: expanded ? (simTab === "xborder" ? "440px" : "340px") : "44px",
        background: "var(--oh-glass2)",
        borderColor: "var(--oh-border2)",
      }}
    >
      {/* Toggle bar */}
      <div
        className="h-11 flex items-center justify-between px-4 cursor-pointer select-none border-b border-[var(--oh-border)]"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2.5 text-[13px] font-semibold text-[var(--oh-text)]">
          <span>⚗</span>
          <span>Spillover Simulation Engine</span>
          {expanded && (
            <div className="flex gap-1 ml-2" onClick={e => e.stopPropagation()}>
              <button
                onClick={() => setSimTab("zoonotic")}
                className="font-mono text-[9px] px-2 py-0.5 rounded transition-all"
                style={{
                  background: simTab === "zoonotic" ? "var(--oh-aqua-glow)" : "transparent",
                  color: simTab === "zoonotic" ? "var(--oh-aqua)" : "var(--oh-text3)",
                  border: `1px solid ${simTab === "zoonotic" ? "var(--oh-border3)" : "var(--oh-border)"}`,
                  cursor: "pointer",
                }}>
                Zoonotic Spillover
              </button>
              <button
                onClick={() => setSimTab("xborder")}
                className="font-mono text-[9px] px-2 py-0.5 rounded transition-all"
                style={{
                  background: simTab === "xborder" ? "var(--oh-aqua-glow)" : "transparent",
                  color: simTab === "xborder" ? "var(--oh-aqua)" : "var(--oh-text3)",
                  border: `1px solid ${simTab === "xborder" ? "var(--oh-border3)" : "var(--oh-border)"}`,
                  cursor: "pointer",
                }}>
                Cross-border Import
              </button>
            </div>
          )}
          {!expanded && (
            <span className="font-mono text-[9px] px-2 py-0.5 rounded bg-[var(--oh-aqua-glow)] text-[var(--oh-aqua)] border border-[var(--oh-border3)] tracking-wider uppercase">
              AI · SEIR Ensemble
            </span>
          )}
          <span
            className="font-mono text-[9px] px-1.5 py-0.5 rounded tracking-wider uppercase"
            style={{
              background: diseaseSource === "db" ? "var(--oh-sage-glow)" : "var(--oh-amber-dim)",
              color: diseaseSource === "db" ? "var(--oh-sage)" : "var(--oh-amber)",
              border: `1px solid ${diseaseSource === "db" ? "rgba(77,232,160,0.2)" : "rgba(245,185,66,0.25)"}`,
            }}
          >
            {diseaseSource === "db" ? "LIVE DB" : diseaseSource === "loading" ? "Loading…" : "Static"}
          </span>
        </div>
        <div className="flex items-center gap-3 font-mono text-[10px] text-[var(--oh-text3)]">
          {simTab === "zoonotic" && (
            <div className="flex gap-3.5">
              <span>R₀: <span className="text-[var(--oh-text2)]">{disease.r0}</span></span>
              <span>CFR: <span className="text-[var(--oh-text2)]">{disease.cfr}%</span></span>
            </div>
          )}
          {simTab === "xborder" && (
            <span className="font-mono text-[9px] px-1.5 py-0.5 rounded" style={{
              background: "rgba(0,147,213,0.1)", color: "var(--oh-who, #0093D5)",
              border: "1px solid rgba(0,147,213,0.25)",
            }}>POISSON · HAZARD</span>
          )}
          <span className={`text-[11px] transition-transform duration-300 ${expanded ? "rotate-180" : ""}`}>▼</span>
        </div>
      </div>

      {/* Body */}
      {simTab === "zoonotic" ? (
        <div className="grid grid-cols-[180px_1fr_180px] gap-5 px-5 py-4 h-[296px] overflow-hidden">
          {/* Disease picker */}
          <div className="flex flex-col gap-1.5 overflow-y-auto oh-scroll">
            {diseases.map((d, i) => (
              <div
                key={d.name}
                onClick={() => setSelectedIdx(i)}
                className={`px-3 py-2 rounded cursor-pointer transition-all border ${i === selectedIdx
                  ? "bg-[var(--oh-aqua-glow)] border-[var(--oh-border3)]"
                  : "border-transparent hover:bg-[rgba(255,255,255,0.04)] hover:border-[var(--oh-border2)]"
                  }`}
              >
                <div className={`text-[12.5px] font-semibold mb-0.5 leading-tight ${i === selectedIdx ? "text-[var(--oh-aqua)]" : "text-[var(--oh-text)]"}`}
                  title={d.name}>
                  {d.name}
                </div>
                <div className="font-mono text-[10px] text-[var(--oh-text3)]">R₀ {d.r0Range}</div>
                {d.riskScore > 0 && (
                  <span className={`inline-block font-mono text-[9px] px-1.5 py-px rounded mt-1 ${RISK_LABEL_STYLE[d.riskLabel] || ""}`}>
                    {d.riskLabel} · {d.riskScore}
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Chart — Live Streaming SEIR */}
          <div className="flex flex-col" style={{ minHeight: 0 }}>
            <SeirLiveRunner
              disease={seirDisease}
              sliders={sliders}
            />
          </div>

          {/* Sliders */}
          <div className="flex flex-col gap-2.5 overflow-y-auto oh-scroll">
            {sliderLabels.map((label, idx) => (
              <div key={idx} className="bg-[rgba(255,255,255,0.02)] border border-[var(--oh-border)] rounded-md px-3 py-2.5">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11.5px] text-[var(--oh-text2)]">{label}</span>
                  <span className="font-mono text-[11.5px] text-[var(--oh-aqua)]">{(sliders[idx] / 100).toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={sliders[idx]}
                  onChange={(e) => updateSlider(idx, parseInt(e.target.value))}
                  className="oh-slider"
                />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ height: simTab === "xborder" ? 396 : 296, overflow: "hidden" }}>
          <CrossBorderPanel />
        </div>
      )}
    </div>
  );
}
