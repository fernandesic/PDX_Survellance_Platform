/**
 * Forecast Horizon Panel — TSX Port
 * Priority 2: Cross-Species Transmission Timeline
 * Priority 3: Ensemble Forecast (SEIR + Exponential + Bayesian)
 */
import { useState, useEffect, useCallback } from "react";
import { Line, AreaChart, Area,
  XAxis, YAxis, Tooltip, CartesianGrid,
  ResponsiveContainer, ReferenceLine,
} from "recharts";
import {
  oneHealthApi,
  type OHForecastResult,
  type OHTimelineEvent,
} from "../services/oneHealth";
import { DISEASES } from "./ohData";

/* ── Domain Colors ───────────────────────────────────────────────────────── */
const DOMAIN_COLORS: Record<string, string> = {
  environment: "#4de8a0",
  animal: "#ffb347",
  human: "#ff3d5a",
  projected: "#4f8ef7",
  unknown: "#3d5a72",
};

/* ── Probability Gauge ───────────────────────────────────────────────────── */
function ProbGauge({ value, label, color }: { value: number; label: string; color: string }) {
  const pct = Math.round(value * 100);
  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className="relative w-12 h-12">
        <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
          <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="3" />
          <circle cx="18" cy="18" r="15" fill="none" stroke={color} strokeWidth="3"
            strokeDasharray={`${pct * 0.94} ${94 - pct * 0.94}`} strokeLinecap="round" />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-mono text-[11px] font-bold" style={{ color }}>{pct}%</span>
        </div>
      </div>
      <span className="font-mono text-[7px] tracking-wider uppercase text-center leading-tight"
        style={{ color: "var(--oh-text3)", maxWidth: 56 }}>
        {label}
      </span>
    </div>
  );
}

/* ── Model Agreement Indicator ───────────────────────────────────────────── */
function ModelAgreement({ day30 }: { day30: { seir: number; exponential: number; bayesian: number } }) {
  const vals = [day30.seir, day30.exponential, day30.bayesian];
  const mean = vals.reduce((a, b) => a + b, 0) / 3;
  const variance = vals.reduce((a, b) => a + (b - mean) ** 2, 0) / 3;
  const cv = mean > 0 ? Math.sqrt(variance) / mean : 0;
  const agreement = cv < 0.3 ? "HIGH" : cv < 0.6 ? "MODERATE" : "LOW";
  const color = cv < 0.3 ? "var(--oh-sage)" : cv < 0.6 ? "var(--oh-amber)" : "var(--oh-crimson)";

  return (
    <div className="flex items-center gap-2 px-2 py-1.5 rounded"
      style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--oh-border)" }}>
      <div className="font-mono text-[8px] tracking-wider uppercase" style={{ color: "var(--oh-text3)" }}>
        Model Agreement
      </div>
      <span className="font-mono text-[9px] font-bold px-1.5 py-0.5 rounded"
        style={{ background: `${color}18`, color }}>
        {agreement}
      </span>
      <div className="flex items-center gap-2 font-mono text-[7px]" style={{ color: "var(--oh-text3)" }}>
        <span>SEIR: {day30.seir}</span>
        <span>Exp: {day30.exponential}</span>
        <span>Bayes: {day30.bayesian}</span>
      </div>
    </div>
  );
}

/* ── Transmission Timeline (inline version) ──────────────────────────────── */
function TimelinePanel({ iso3 }: { iso3: string }) {
  const [events, setEvents] = useState<OHTimelineEvent[]>([]);

  useEffect(() => {
    if (!iso3) return;
    let cancelled = false;
    oneHealthApi.getSpilloverTimeline(iso3).then(data => {
      if (!cancelled && data) setEvents(data);
    });
    return () => { cancelled = true; };
  }, [iso3]);

  if (events.length === 0) {
    return (
      <div className="flex items-center justify-center py-4">
        <span className="font-mono text-[9px]" style={{ color: "var(--oh-text3)" }}>
          Select a country for timeline
        </span>
      </div>
    );
  }

  return (
    <div className="px-2 py-2 space-y-1 max-h-[160px] overflow-y-auto oh-scroll">
      {events.map((evt, i) => {
        const clr = DOMAIN_COLORS[evt.domain] || DOMAIN_COLORS.unknown;
        return (
          <div key={i} className="flex gap-2 items-start text-[9px]"
            style={{ opacity: evt.projected ? 0.6 : 1 }}>
            <div className="flex flex-col items-center" style={{ width: 14 }}>
              <div className="w-2 h-2 rounded-full mt-1" style={{ background: clr, boxShadow: `0 0 5px ${clr}40` }} />
              {i < events.length - 1 && (
                <div className="w-px flex-1 mt-0.5" style={{ background: `${clr}30` }} />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-[7px] px-1 py-px rounded"
                  style={{ background: `${clr}18`, color: clr, textTransform: "uppercase" }}>
                  {evt.domain}
                </span>
                <span className="font-mono text-[7px]" style={{ color: "var(--oh-text3)" }}>{evt.date}</span>
              </div>
              <div className="mt-0.5" style={{ color: evt.projected ? "var(--oh-cobalt)" : "var(--oh-text)" }}>
                {evt.event}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   ENSEMBLE FORECAST PANEL
   ═══════════════════════════════════════════════════════════════════════════ */

interface ForecastPanelProps {
  selectedCountryIso3?: string;
}

function ForecastPanel({ selectedCountryIso3 }: ForecastPanelProps) {
  const [forecast, setForecast] = useState<OHForecastResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [diseaseIdx, setDiseaseIdx] = useState(0);
  const selectedDisease = DISEASES[diseaseIdx];

  const runForecast = useCallback(async () => {
    setLoading(true);
    const params = {
      pathogen: selectedDisease.name,
      r0: selectedDisease.r0,
      cfr_pct: selectedDisease.cfr,
      incubation_days: 5,
      population: 10_000_000,
      initial_cases: 1,
      days: 30,
      host_interface: 0.72,
      deforestation: 0.58,
      livestock_density: 0.81,
      vaccination_pct: 0.43,
      lab_capacity: 0.51,
      surveillance_gap: 0.49,
    };
    const result = await oneHealthApi.postForecastHorizon(params);
    if (result) setForecast(result);
    setLoading(false);
  }, [selectedDisease]);

  useEffect(() => { runForecast(); }, [diseaseIdx]);

  if (loading || !forecast) {
    return (
      <div className="flex items-center justify-center py-6">
        <span className="font-mono text-[10px] animate-pulse" style={{ color: "var(--oh-aqua)" }}>
          {loading ? "Running 3-model ensemble..." : "Select a disease to forecast"}
        </span>
      </div>
    );
  }

  return (
    <div className="px-2 py-2 space-y-3">
      {/* Disease Selector */}
      <div className="flex items-center gap-2 flex-wrap">
        {DISEASES.slice(0, 6).map((d, i) => (
          <button key={d.name}
            className="font-mono text-[8px] px-2 py-1 rounded transition-all"
            style={{
              background: i === diseaseIdx ? "var(--oh-aqua-glow)" : "transparent",
              color: i === diseaseIdx ? "var(--oh-aqua)" : "var(--oh-text3)",
              border: `1px solid ${i === diseaseIdx ? "var(--oh-border3)" : "var(--oh-border)"}`,
            }}
            onClick={() => setDiseaseIdx(i)}
          >
            {d.name}
          </button>
        ))}
      </div>

      {/* KPI Row */}
      <div className="flex items-center gap-3">
        <ProbGauge value={forecast.p_epidemic_30d} label="P(epidemic)" color="var(--oh-crimson)" />
        <ProbGauge value={forecast.p_cluster_30d} label="P(cluster)" color="var(--oh-amber)" />

        <div className="flex-1 flex flex-col gap-1 font-mono text-[9px]">
          <div style={{ color: "var(--oh-text2)" }}>
            Peak day: <span className="font-bold" style={{ color: "var(--oh-crimson)" }}>{forecast.peak_day}</span>
          </div>
          <div style={{ color: "var(--oh-text2)" }}>
            Peak cases: <span className="font-bold" style={{ color: "var(--oh-text)" }}>{forecast.peak_cases.toLocaleString()}</span>
          </div>
          {forecast.doubling_time_days && (
            <div style={{ color: "var(--oh-text2)" }}>
              Doubling: <span className="font-bold" style={{ color: "var(--oh-amber)" }}>{forecast.doubling_time_days}d</span>
            </div>
          )}
          <div style={{ color: "var(--oh-text2)" }}>
            30d total: <span style={{ color: "var(--oh-text)" }}>{forecast.total_cases_30d.toLocaleString()}</span>
            {" · "}deaths: <span style={{ color: "var(--oh-crimson)" }}>{forecast.total_deaths_30d.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Model Agreement */}
      <ModelAgreement day30={forecast.model_day30} />

      {/* Trajectory Chart */}
      <div>
        <div className="font-mono text-[8px] tracking-wider uppercase mb-1.5" style={{ color: "var(--oh-text3)" }}>
          30-Day Ensemble Forecast
        </div>
        <ResponsiveContainer width="100%" height={120}>
          <AreaChart data={forecast.trajectory} margin={{ left: 0, right: 4, top: 4, bottom: 0 }}>
            <defs>
              <linearGradient id="ciGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--oh-cobalt)" stopOpacity={0.15} />
                <stop offset="100%" stopColor="var(--oh-cobalt)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="day" tick={{ fontSize: 7, fill: "var(--oh-text3)" }} interval={4} />
            <YAxis tick={{ fontSize: 7, fill: "var(--oh-text3)" }} width={32} />
            <Tooltip
              contentStyle={{ background: "var(--oh-ink)", border: "1px solid var(--oh-border2)", borderRadius: 6, fontSize: 9 }}
              labelStyle={{ color: "var(--oh-text)" }}
              labelFormatter={(d) => `Day ${d}`}
            />
            <Area dataKey="ci_upper" stroke="none" fill="url(#ciGrad)" />
            <Area dataKey="ci_lower" stroke="none" fill="var(--oh-ink)" />
            <Line dataKey="ensemble" stroke="var(--oh-aqua)" strokeWidth={2} dot={false} />
            <Line dataKey="seir" stroke="var(--oh-crimson)" strokeWidth={1} dot={false} strokeDasharray="4 2" />
            <Line dataKey="exponential" stroke="var(--oh-amber)" strokeWidth={1} dot={false} strokeDasharray="4 2" />
            <Line dataKey="bayesian" stroke="var(--oh-cobalt)" strokeWidth={1} dot={false} strokeDasharray="4 2" />
            <ReferenceLine x={forecast.peak_day} stroke="var(--oh-crimson)" strokeDasharray="3 3" />
          </AreaChart>
        </ResponsiveContainer>
        <div className="flex items-center gap-3 mt-1 font-mono text-[7px]" style={{ color: "var(--oh-text3)" }}>
          <span><span className="inline-block w-2 h-[2px] mr-1" style={{ background: "var(--oh-aqua)" }} />Ensemble</span>
          <span><span className="inline-block w-2 h-[2px] mr-1" style={{ background: "var(--oh-crimson)", opacity: 0.6 }} />SEIR</span>
          <span><span className="inline-block w-2 h-[2px] mr-1" style={{ background: "var(--oh-amber)", opacity: 0.6 }} />Exponential</span>
          <span><span className="inline-block w-2 h-[2px] mr-1" style={{ background: "var(--oh-cobalt)", opacity: 0.6 }} />Bayesian</span>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   COMBINED SIMULATION TABS — Replaces the plain SEIR view
   ═══════════════════════════════════════════════════════════════════════════ */

export interface CombinedSimTabsProps {
  selectedCountryIso3?: string;
  children?: React.ReactNode;  // Existing SEIR content
}

export function CombinedSimTabs({ selectedCountryIso3, children }: CombinedSimTabsProps) {
  const [tab, setTab] = useState<"seir" | "ensemble" | "timeline">("seir");

  const tabs = [
    { key: "seir" as const, label: "SEIR Simulation", icon: "⚗" },
    { key: "ensemble" as const, label: "Ensemble Forecast", icon: "📊" },
    { key: "timeline" as const, label: "Transmission Chain", icon: "🔗" },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Tab Bar */}
      <div className="flex gap-1 px-3 py-1.5 border-b" style={{ borderColor: "var(--oh-border)" }}>
        {tabs.map(t => (
          <button key={t.key}
            className="font-mono text-[8px] px-2 py-1 rounded transition-all flex items-center gap-1"
            style={{
              background: tab === t.key ? "var(--oh-aqua-glow)" : "transparent",
              color: tab === t.key ? "var(--oh-aqua)" : "var(--oh-text3)",
              border: `1px solid ${tab === t.key ? "var(--oh-border3)" : "transparent"}`,
            }}
            onClick={() => setTab(t.key)}
          >
            <span>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {tab === "seir" && children}
        {tab === "ensemble" && <ForecastPanel selectedCountryIso3={selectedCountryIso3} />}
        {tab === "timeline" && <TimelinePanel iso3={selectedCountryIso3 || "NGA"} />}
      </div>
    </div>
  );
}

export default ForecastPanel;
