/**
 * SeirLiveRunner — Streaming SEIR simulation with live narration
 * Replaces the static SVG chart in SimulationPanel.
 * Streams from /api/v1/onehealth/simulation/seir/stream and animates day-by-day.
 * Ported from TRIAD_React.jsx → TypeScript using Recharts.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import {
  ResponsiveContainer, AreaChart, Area,
  CartesianGrid, XAxis, YAxis, Tooltip,
} from "recharts";
import { apiPost } from "@/lib/api";

interface SeirLiveRunnerProps {
  disease: { r0_min?: number; r0_max?: number; cfr_pct?: number; cfr?: number };
  sliders: number[]; // [host, deforest, livestock, vax, lab] each 0-100
}

interface TrajPoint {
  day: number; I: number; H: number; D: number;
  S: number; E: number; R: number; ciU: number; ciL: number;
}

interface NarrationEntry { day: number; text: string; kind: string }

interface ExplainResult {
  r_effective: number; regime: string; verdict: string; driver_text: string; r0_adjusted: number;
}

// Local fallback SEIR (same as existing SimulationPanel)
function seirLocal(disease: SeirLiveRunnerProps["disease"], sliders: number[]) {
  const r0 = ((disease.r0_min || 0) + (disease.r0_max || 1.5)) / 2;
  const host = sliders[0] / 100, defor = sliders[1] / 100, live = sliders[2] / 100;
  const vax = sliders[3] / 100, lab = sliders[4] / 100;
  const beta = r0 * (0.5 + host * 0.5) * (0.6 + defor * 0.4) * (0.7 + live * 0.3) * 0.07 * (1 + lab * 0.3);
  const gamma = 0.07 * (1 + lab * 0.3), sigma = 0.14;
  const N = 5_000_000, I0 = 10;
  let S = N - I0 * 4, E_ = I0 * 3, Iv = I0, Rv = 0;
  const result: TrajPoint[] = [];
  for (let d = 0; d <= 90; d++) {
    const vaxEff = 1.0 - (vax * 0.6 * Math.min(1.0, d / 30));
    const dS = -beta * S * vaxEff * Iv;
    const dE = beta * S * vaxEff * Iv - sigma * E_;
    const dI = sigma * E_ - gamma * Iv;
    const dR = gamma * Iv;
    S = Math.max(0, S + dS); E_ = Math.max(0, E_ + dE);
    Iv = Math.max(0, Iv + dI); Rv += dR;
    result.push({ day: d, I: Math.round(Iv), H: Math.round(Iv * 0.12), D: 0, S: Math.round(S), E: Math.round(E_), R: Math.round(Rv), ciU: Math.round(Iv * 1.25), ciL: Math.round(Math.max(0, Iv * 0.75)) });
  }
  return result;
}

const PHASE_COLOR: Record<string, string> = {
  "exponential growth": "var(--oh-crimson)", "active spread": "var(--oh-amber)",
  "plateau": "var(--oh-cobalt)", "decline": "var(--oh-sage)",
  "fade-out (population immunity)": "var(--oh-sage)", "ignition": "var(--oh-amber)",
  "complete": "var(--oh-aqua)", "complete (local)": "var(--oh-aqua)",
  "running": "var(--oh-aqua)", "idle": "var(--oh-text3)", "starting": "var(--oh-amber)",
};

export default function SeirLiveRunner({ disease, sliders }: SeirLiveRunnerProps) {
  const [traj, setTraj] = useState<TrajPoint[]>([]);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [meta, setMeta] = useState<any>(null);
  const [explain, setExplain] = useState<ExplainResult | null>(null);
  const [narration, setNarration] = useState<NarrationEntry[]>([]);
  const [currentDay, setCurrentDay] = useState(0);
  const [phase, setPhase] = useState("idle");
  const abortRef = useRef<AbortController | null>(null);

  const sliderObj = {
    host_interface: sliders[0] / 100, deforestation: sliders[1] / 100,
    livestock_density: sliders[2] / 100, vaccination_coverage: sliders[3] / 100,
    lab_capacity: sliders[4] / 100,
  };

  // Pre-run explanation
  useEffect(() => {
    let cancelled = false;
    const r0avg = ((disease.r0_min || 0) + (disease.r0_max || 1.5)) / 2;
    apiPost<ExplainResult>("/onehealth/simulation/seir/explain", {
      r0: r0avg, gamma: 0.07, sigma: 0.14,
      cfr_pct: disease.cfr_pct || disease.cfr || 5,
      population: 5_000_000, initial_infected: 10, days: 90,
      ...sliderObj,
    }).then((d) => { if (!cancelled && d) setExplain(d); }).catch(() => {});
    return () => { cancelled = true; };
  }, [disease, sliders]);

  // Reset on input change
  useEffect(() => {
    abortRef.current?.abort();
    setTraj([]); setNarration([]); setRunning(false); setDone(false);
    setMeta(null); setCurrentDay(0); setPhase("idle");
  }, [disease, sliders]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const run = useCallback(async () => {
    if (running) return;
    setRunning(true); setDone(false);
    setTraj([]); setNarration([]); setCurrentDay(0); setPhase("starting");

    const r0avg = ((disease.r0_min || 0) + (disease.r0_max || 1.5)) / 2;
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const resp = await fetch(`${import.meta.env.VITE_API_BASE_URL || ""}/onehealth/simulation/seir/stream`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          r0: r0avg, gamma: 0.07, sigma: 0.14,
          cfr_pct: disease.cfr_pct || disease.cfr || 5,
          population: 5_000_000, initial_infected: 10, days: 90,
          ...sliderObj,
        }),
        signal: ctrl.signal,
      });
      if (!resp.ok || !resp.body) throw new Error("stream failed");
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const { value, done: streamDone } = await reader.read();
        if (streamDone) break;
        buf += decoder.decode(value, { stream: true });
        const parts = buf.split("\n\n");
        buf = parts.pop() ?? "";
        for (const part of parts) {
          const line = part.split("\n").find((l) => l.startsWith("data:"));
          if (!line) continue;
          let frame: any;
          try { frame = JSON.parse(line.slice(5).trim()); } catch { continue; }

          if (frame.event === "start") {
            setMeta(frame); setPhase("running");
            if (frame.narration) setNarration((n) => [...n, { day: 0, text: frame.narration, kind: "start" }]);
          } else if (frame.event === "step") {
            setTraj((t) => [...t, { day: frame.day, I: frame.infected, H: frame.hospitalised, D: frame.deaths_cum, S: frame.susceptible, E: frame.exposed, R: frame.recovered, ciU: frame.ci_upper, ciL: frame.ci_lower }]);
            setCurrentDay(frame.day);
            setPhase(frame.phase || "running");
            if (frame.narration) setNarration((n) => [...n, { day: frame.day, text: frame.narration, kind: "milestone" }]);
          } else if (frame.event === "done") {
            setMeta((m: any) => ({ ...(m || {}), ...frame }));
            setPhase("complete"); setDone(true);
            if (frame.narration) setNarration((n) => [...n, { day: frame.peak_day, text: frame.narration, kind: "done" }]);
          }
        }
      }
    } catch (err: any) {
      if (err.name !== "AbortError") {
        setNarration((n) => [...n, { day: 0, text: `Stream error: ${err.message}. Falling back to local model.`, kind: "error" }]);
        const data = seirLocal(disease, sliders);
        setTraj(data); setCurrentDay(data.length - 1); setDone(true); setPhase("complete (local)");
      }
    } finally {
      setRunning(false);
    }
  }, [disease, sliders, running]);

  const reset = () => {
    abortRef.current?.abort();
    setTraj([]); setNarration([]); setRunning(false); setDone(false);
    setMeta(null); setCurrentDay(0); setPhase("idle");
  };

  const phaseColor = PHASE_COLOR[phase] || "var(--oh-text2)";

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Header: state + controls */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className="font-mono" style={{ fontSize: 10, color: "var(--oh-text3)", letterSpacing: "1px", textTransform: "uppercase" }}>
            {meta?.r0_adjusted ? `R₀adj ${meta.r0_adjusted}` : "Live SEIR"}
          </span>
          <span className="font-mono" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 9px", borderRadius: 10, fontSize: 10.5, fontWeight: 600, background: `color-mix(in srgb, ${phaseColor} 10%, transparent)`, border: `1px solid color-mix(in srgb, ${phaseColor} 25%, transparent)`, color: phaseColor }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: phaseColor, animation: running ? "oh-pulse-dot 1.2s infinite" : "none" }} />
            {phase.toUpperCase()}
          </span>
          {currentDay > 0 && <span className="font-mono" style={{ fontSize: 11, color: "var(--oh-text2)" }}>D{currentDay}/90</span>}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={running ? () => abortRef.current?.abort() : run}
            style={{ padding: "5px 14px", fontSize: 12, fontWeight: 600, borderRadius: 6, cursor: "pointer",
              background: running ? "var(--oh-crimson-glow)" : "var(--oh-aqua-glow)",
              color: running ? "var(--oh-crimson)" : "var(--oh-aqua)",
              border: `1px solid ${running ? "rgba(255,61,90,0.35)" : "rgba(0,229,200,0.35)"}` }}>
            {running ? "■ Stop" : done ? "↻ Replay" : "▶ Run"}
          </button>
          {(traj.length > 0 || done) && (
            <button onClick={reset} style={{ padding: "5px 12px", fontSize: 12, borderRadius: 6, cursor: "pointer", background: "rgba(255,255,255,0.04)", color: "var(--oh-text2)", border: "1px solid var(--oh-border2)" }}>Reset</button>
          )}
        </div>
      </div>

      {/* Pre-run insight */}
      {explain && !running && traj.length === 0 && (
        <div style={{ background: "var(--oh-aqua-faint)", border: "1px solid rgba(0,229,200,0.15)", borderRadius: 6, padding: "8px 12px", marginBottom: 8, fontSize: 12, lineHeight: 1.5, color: "var(--oh-text2)" }}>
          <span style={{ color: "var(--oh-aqua)", fontWeight: 600 }}>R_eff {explain.r_effective} · {explain.regime}.</span>{" "}
          {explain.verdict}{" "}
          <span style={{ color: "var(--oh-text3)" }}>{explain.driver_text}</span>
        </div>
      )}

      {/* Chart */}
      <div style={{ flex: 1, position: "relative", minHeight: 0 }}>
        {traj.length === 0 && !running ? (
          <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 11, color: "var(--oh-text3)" }}>▶ Press Run to start the simulation</span>
            <span style={{ fontSize: 9.5, color: "var(--oh-text3)", maxWidth: 320, textAlign: "center", lineHeight: 1.5 }}>
              The model splits the population into S → E → I → R compartments and steps forward day by day.
            </span>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={traj} margin={{ top: 4, right: 4, left: 0, bottom: 16 }}>
              <defs>
                <linearGradient id="iG2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--oh-crimson)" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="var(--oh-crimson)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 6" stroke="rgba(255,255,255,0.03)" vertical={false} />
              <XAxis dataKey="day" tick={{ fill: "var(--oh-text3)", fontSize: 8 }} tickLine={false}
                axisLine={{ stroke: "var(--oh-border)" }} interval={14} tickFormatter={(v) => `D${v}`} />
              {/* Adaptive Y-axis: auto-scale to the trajectory's peak with
                  20% headroom, but enforce a minimum so a 5-case outbreak
                  doesn't render as a single pixel. Avoids both:
                   (a) recharts' default flattening of every shape, and
                   (b) a 2M fixed scale that hides modest curves. */}
              <YAxis
                domain={[0, (dataMax: number) => {
                  const padded = (dataMax || 0) * 1.2;
                  // Snap to nice round upper bounds for readability
                  if (padded < 50)        return 50;
                  if (padded < 500)       return 500;
                  if (padded < 5_000)     return 5_000;
                  if (padded < 50_000)    return 50_000;
                  if (padded < 500_000)   return 500_000;
                  if (padded < 2_000_000) return 2_000_000;
                  return 5_000_000;
                }]}
                tick={{ fill: "var(--oh-text3)", fontSize: 8 }}
                tickLine={false}
                axisLine={{ stroke: "var(--oh-border)" }}
                width={42}
                tickFormatter={(v) => {
                  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
                  if (v >= 1_000) return `${Math.round(v / 1_000)}K`;
                  return String(Math.round(v));
                }}
              />
              <Tooltip contentStyle={{ background: "var(--oh-glass)", border: "1px solid var(--oh-border2)", borderRadius: 6, fontSize: 10 }} />
              <Area type="monotone" dataKey="ciU" name="CI95" stroke="none" fill="rgba(255,58,88,0.07)" />
              <Area type="monotone" dataKey="I" name="Infected" stroke="var(--oh-crimson)" strokeWidth={2} fill="url(#iG2)" dot={false} isAnimationActive={false} />
              <Area type="monotone" dataKey="H" name="Hospitalised" stroke="var(--oh-cobalt)" strokeWidth={1.5} strokeDasharray="4 3" fill="none" dot={false} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Narration log */}
      {narration.length > 0 && (
        <div className="oh-scroll font-mono" style={{ marginTop: 8, maxHeight: 78, overflowY: "auto", background: "rgba(255,255,255,0.02)", border: "1px solid var(--oh-border)", borderRadius: 6, padding: "6px 12px", fontSize: 11.5, lineHeight: 1.55 }}>
          {narration.slice(-4).map((n, i) => (
            <div key={i} style={{ color: n.kind === "error" ? "var(--oh-crimson)" : n.kind === "done" ? "var(--oh-sage)" : n.kind === "start" ? "var(--oh-aqua)" : "var(--oh-text2)" }}>
              <span style={{ color: "var(--oh-text3)" }}>D{String(n.day).padStart(2, "0")}</span>{" · "}{n.text}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
