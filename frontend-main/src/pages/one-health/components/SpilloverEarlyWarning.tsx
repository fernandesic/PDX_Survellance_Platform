/**
 * Spillover Early Warning Panel — TSX Port
 * Displays pre-spillover risk intelligence with ranked risk list,
 * score gauges, countdowns, signal bar charts, and transmission timelines.
 */
import { useState, useEffect } from "react";
import {
  RadialBarChart, RadialBar, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import {
  oneHealthApi,
  type OHEarlyWarning,
  type OHTimelineEvent,
} from "../services/oneHealth";

/* ── Stage metadata ──────────────────────────────────────────────────────── */
const STAGE_META: Record<number, { label: string; color: string; glow: string; pulse: boolean }> = {
  0: { label: "Background", color: "var(--oh-text3)", glow: "rgba(46,74,96,0.3)", pulse: false },
  1: { label: "Watch", color: "var(--oh-cobalt)", glow: "rgba(79,142,247,0.25)", pulse: false },
  2: { label: "Warning", color: "var(--oh-amber)", glow: "rgba(255,179,71,0.3)", pulse: true },
  3: { label: "Imminent", color: "var(--oh-crimson)", glow: "rgba(255,61,90,0.35)", pulse: true },
};

/* ── Score Gauge ─────────────────────────────────────────────────────────── */
function ScoreGauge({ score, stage }: { score: number; stage: number }) {
  const meta = STAGE_META[stage] || STAGE_META[0];
  const data = [
    { name: "score", value: score, fill: meta.color },
    { name: "bg", value: 100 - score, fill: "rgba(255,255,255,0.04)" },
  ];

  return (
    <div className="relative flex items-center justify-center" style={{ width: 90, height: 90 }}>
      <ResponsiveContainer>
        <RadialBarChart
          innerRadius="70%" outerRadius="100%"
          startAngle={230} endAngle={-50}
          data={[data[0]]}
          barSize={6}
        >
          <RadialBar background={{ fill: "rgba(255,255,255,0.04)" }}
            dataKey="value" cornerRadius={3} />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-[22px] font-bold" style={{ color: meta.color }}>{score}</span>
        <span className="font-mono text-[10px] tracking-wider uppercase" style={{ color: meta.color, opacity: 0.7 }}>
          / 100
        </span>
      </div>
    </div>
  );
}

/* ── Signal Bars Chart ───────────────────────────────────────────────────── */
function SignalBars({ signals }: { signals: OHEarlyWarning["signal_breakdown"] }) {
  if (!signals || signals.length === 0) return null;

  const SIGNAL_COLORS: Record<string, string> = {
    animal_mortality: "#ff3d5a",
    human_exposure: "#ffb347",
    environmental_risk: "#4de8a0",
    surveillance_gap: "#4f8ef7",
    seasonality: "#f5b942",
    spatial_proximity: "#00e5c8",
  };

  const data = (signals || []).map(s => ({
    signal: s.signal.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
    sub_score: s.sub_score,
    fill: SIGNAL_COLORS[s.signal] || "#4f8ef7",
  }));

  return (
    <div className="mt-3">
      <div className="font-mono text-[11px] tracking-wider uppercase mb-2" style={{ color: "var(--oh-text3)" }}>
        Signal Breakdown
      </div>
      <ResponsiveContainer width="100%" height={120}>
        <BarChart data={data} layout="vertical" margin={{ left: 0, right: 8 }}>
          <CartesianGrid horizontal={false} stroke="rgba(255,255,255,0.04)" />
          <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10, fill: "var(--oh-text3)" }} />
          <YAxis type="category" dataKey="signal" width={100}
            tick={{ fontSize: 10, fill: "var(--oh-text2)" }} />
          <Tooltip
            contentStyle={{ background: "var(--oh-ink)", border: "1px solid var(--oh-border2)", borderRadius: 6, fontSize: 12 }}
            labelStyle={{ color: "var(--oh-text)" }}
          />
          <Bar dataKey="sub_score" radius={[0, 3, 3, 0]} barSize={10}>
            {data.map((entry, idx) => (
              <rect key={idx} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ── Countdown Clock ─────────────────────────────────────────────────────── */
function CountdownClock({ daysMin, daysMax, daysEst, stage }: {
  daysMin: number; daysMax: number; daysEst: number; stage: number;
}) {
  const meta = STAGE_META[stage] || STAGE_META[0];
  return (
    <div className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg"
      style={{ background: meta.glow, border: `1px solid ${meta.color}30` }}>
      <div className="font-mono text-[24px] font-bold leading-none" style={{ color: meta.color }}>
        {daysEst}
      </div>
      <div className="font-mono text-[10px] tracking-wider uppercase" style={{ color: meta.color, opacity: 0.7 }}>
        Days Est
      </div>
      <div className="font-mono text-[11px]" style={{ color: "var(--oh-text3)" }}>
        {daysMin}–{daysMax} range
      </div>
    </div>
  );
}

/* ── Transmission Timeline ───────────────────────────────────────────────── */
const DOMAIN_COLORS: Record<string, string> = {
  environment: "#4de8a0",
  animal: "#ffb347",
  human: "#ff3d5a",
  projected: "#4f8ef7",
  unknown: "#3d5a72",
};

function TransmissionTimeline({ events }: { events: OHTimelineEvent[] }) {
  if (!events || events.length === 0) return null;

  return (
    <div className="mt-3">
      <div className="font-mono text-[11px] tracking-wider uppercase mb-2" style={{ color: "var(--oh-text3)" }}>
        Cross-Species Transmission Timeline
      </div>
      <div className="flex flex-col gap-1 max-h-[180px] overflow-y-auto oh-scroll pr-1">
        {events.map((evt, i) => {
          const clr = DOMAIN_COLORS[evt.domain] || DOMAIN_COLORS.unknown;
          return (
            <div key={i} className="flex gap-2 items-start text-[12px]"
              style={{ opacity: evt.projected ? 0.6 : 1 }}>
              <div className="flex flex-col items-center" style={{ width: 14 }}>
                <div className="w-2 h-2 rounded-full mt-1" style={{ background: clr, boxShadow: `0 0 6px ${clr}40` }} />
                {i < events.length - 1 && (
                  <div className="w-px flex-1 mt-0.5" style={{ background: `${clr}30` }} />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-[10px] px-1.5 py-0.5 rounded"
                    style={{ background: `${clr}18`, color: clr, textTransform: "uppercase" }}>
                    {evt.domain}
                  </span>
                  <span className="font-mono text-[10px]" style={{ color: "var(--oh-text3)" }}>
                    {evt.date}
                  </span>
                </div>
                <div className="mt-0.5" style={{ color: evt.projected ? "var(--oh-cobalt)" : "var(--oh-text)" }}>
                  {evt.event}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Risk Card ───────────────────────────────────────────────────────────── */
function RiskCard({ item, selected, onClick }: {
  item: OHEarlyWarning; selected: boolean; onClick: () => void;
}) {
  const meta = STAGE_META[item.stage] || STAGE_META[0];
  return (
    <div
      className="px-3 py-2.5 rounded-lg cursor-pointer transition-all duration-200"
      onClick={onClick}
      style={{
        background: selected ? `${meta.glow}` : "rgba(255,255,255,0.02)",
        border: `1px solid ${selected ? meta.color + "40" : "var(--oh-border)"}`,
      }}
    >
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          {meta.pulse && (
            <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: meta.color }} />
          )}
          <span className="text-[13px] font-semibold" style={{ color: "var(--oh-text)" }}>
            {item.country_name}
          </span>
          <span className="font-mono text-[10px] px-1.5 py-0.5 rounded"
            style={{ background: `${meta.color}18`, color: meta.color, textTransform: "uppercase" }}>
            {meta.label}
          </span>
        </div>
        <span className="font-mono text-[16px] font-bold" style={{ color: meta.color }}>
          {item.composite_score}
        </span>
      </div>

      <div className="flex items-center gap-3 font-mono text-[11px]">
        <span style={{ color: "var(--oh-aqua)" }}>🦠 {item.pathogen}</span>
        <span style={{ color: "var(--oh-text2)" }}>⏱ {item.days_to_first_human_case_est}d</span>
        <span style={{ color: "var(--oh-text2)" }}>P₃₀ {(item.p_spillover_30d * 100).toFixed(0)}%</span>
        {item.active_animal_events > 0 && <span style={{ color: "var(--oh-amber)" }}>🐾 {item.active_animal_events}</span>}
      </div>

      {item.environmental_flags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {item.environmental_flags.map((f, i) => (
            <span key={i} className="font-mono text-[10px] px-1.5 py-0.5 rounded"
              style={{ background: "rgba(77,232,160,0.08)", color: "var(--oh-sage)" }}>
              {f}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Detail Panel ────────────────────────────────────────────────────────── */
function DetailPanel({ item, timeline }: {
  item: OHEarlyWarning; timeline: OHTimelineEvent[];
}) {
  const meta = STAGE_META[item.stage] || STAGE_META[0];

  return (
    <div className="flex-1 overflow-y-auto oh-scroll px-3 py-3 space-y-3">
      {/* Header */}
      <div className="flex items-start gap-3">
        <ScoreGauge score={item.composite_score} stage={item.stage} />
        <div className="flex-1 min-w-0">
          <div className="text-[16px] font-bold mb-1" style={{ color: "var(--oh-text)" }}>
            {item.country_name} — {item.pathogen}
          </div>
          <div className="flex items-center gap-2 mb-2">
            <span className="font-mono text-[11px] px-2 py-0.5 rounded"
              style={{ background: `${meta.color}18`, color: meta.color, border: `1px solid ${meta.color}30` }}>
              STAGE {item.stage}: {meta.label.toUpperCase()}
            </span>
            {item.ihr_notifiable && (
              <span className="font-mono text-[10px] px-1.5 py-0.5 rounded oh-tag-ihr">IHR</span>
            )}
          </div>
          <div className="flex items-center gap-4">
            <CountdownClock
              daysMin={item.days_to_first_human_case_min}
              daysMax={item.days_to_first_human_case_max}
              daysEst={item.days_to_first_human_case_est}
              stage={item.stage}
            />
            <div className="flex flex-col gap-1">
              <div className="font-mono text-[12px]" style={{ color: "var(--oh-text2)" }}>
                P(spillover 30d): <span style={{ color: meta.color }}>{(item.p_spillover_30d * 100).toFixed(0)}%</span>
              </div>
              <div className="font-mono text-[12px]" style={{ color: "var(--oh-text2)" }}>
                P(cluster 30d): <span style={{ color: "var(--oh-text)" }}>{(item.p_cluster_30d * 100).toFixed(0)}%</span>
              </div>
              <div className="font-mono text-[12px]" style={{ color: "var(--oh-text2)" }}>
                Animal events: <span style={{ color: "var(--oh-amber)" }}>{item.active_animal_events}</span>
              </div>
              <div className="font-mono text-[12px]" style={{ color: "var(--oh-text2)" }}>
                Human contacts: <span style={{ color: "var(--oh-crimson)" }}>{item.human_contacts}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Signal Breakdown */}
      {item.signal_breakdown && <SignalBars signals={item.signal_breakdown} />}

      {/* Recommended Actions */}
      {item.recommended_actions && item.recommended_actions.length > 0 && (
        <div>
          <div className="font-mono text-[11px] tracking-wider uppercase mb-1.5" style={{ color: "var(--oh-text3)" }}>
            Recommended Actions
          </div>
          <div className="flex flex-col gap-1">
            {item.recommended_actions.map((a, i) => (
              <div key={i} className="text-[12px] px-2 py-1.5 rounded"
                style={{ background: "rgba(255,255,255,0.02)", color: "var(--oh-text2)", border: "1px solid var(--oh-border)" }}>
                {a}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Transmission Timeline */}
      <TransmissionTimeline events={timeline} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN PANEL
   ═══════════════════════════════════════════════════════════════════════════ */

interface SpilloverEarlyWarningPanelProps {
  onSelectCountry?: (iso3: string) => void;
  onZoom?: (lat: number, lng: number) => void;
}

export default function SpilloverEarlyWarningPanel({
  onSelectCountry, onZoom,
}: SpilloverEarlyWarningPanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [warnings, setWarnings] = useState<OHEarlyWarning[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [timeline, setTimeline] = useState<OHTimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [stageFilter, setStageFilter] = useState(0);

  // Fetch early warning data — no mock fallback. Empty API response means
  // the backend cache is empty / no real signals; show that honestly instead
  // of fake outbreaks (Nigeria HPAI 87, DR Congo Ebola 78, ...).
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const data = await oneHealthApi.getEarlyWarning(stageFilter);
      if (cancelled) return;
      setWarnings(Array.isArray(data) ? data : []);
      setSelectedIdx(0);
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [stageFilter]);

  // Fetch real transmission timeline for the selected country — no mock.
  useEffect(() => {
    const item = warnings[selectedIdx];
    if (!item) { setTimeline([]); return; }

    let cancelled = false;
    async function loadTimeline() {
      const tl = await oneHealthApi.getSpilloverTimeline(item.iso3);
      if (cancelled) return;
      setTimeline(Array.isArray(tl) ? tl : []);
    }
    loadTimeline();
    return () => { cancelled = true; };
  }, [warnings, selectedIdx]);

  const selected = warnings[selectedIdx] || null;
  const imminentCount = warnings.filter(w => w.stage >= 3).length;
  const warningCount = warnings.filter(w => w.stage === 2).length;

  if (collapsed) {
    return (
      <div className="absolute top-[72px] right-3 z-[600] w-10 cursor-pointer"
        onClick={() => setCollapsed(false)}>
        <div className="oh-glass-card px-2 py-3 flex flex-col items-center gap-2">
          <span className="text-[14px]">🔬</span>
          {imminentCount > 0 && (
            <span className="font-mono text-[11px] w-5 h-5 flex items-center justify-center rounded-full"
              style={{ background: "var(--oh-crimson-glow)", color: "var(--oh-crimson)" }}>
              {imminentCount}
            </span>
          )}
          <span className="text-[12px] font-bold" style={{ color: "var(--oh-text3)", writingMode: "vertical-rl" }}>
            EW
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute top-[72px] right-3 bottom-[30px] z-[600] flex flex-col"
      style={{ width: 370 }}>
      <div className="oh-glass-card flex flex-col h-full overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b"
          style={{ borderColor: "var(--oh-border)" }}>
          <div className="flex items-center gap-2">
            <span className="text-[12px]">🔬</span>
            <span className="text-[13px] font-semibold" style={{ color: "var(--oh-text)" }}>
              Spillover Early Warning
            </span>
            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded tracking-wider"
              style={{ background: "var(--oh-aqua-glow)", color: "var(--oh-aqua)", border: "1px solid var(--oh-border3)" }}>
              AI ENGINE
            </span>
          </div>
          <div className="flex items-center gap-2">
            {imminentCount > 0 && (
              <span className="font-mono text-[11px] px-1.5 py-0.5 rounded animate-pulse"
                style={{ background: "var(--oh-crimson-glow)", color: "var(--oh-crimson)" }}>
                {imminentCount} IMMINENT
              </span>
            )}
            <button onClick={() => setCollapsed(true)}
              className="text-[12px] px-1 hover:opacity-70 transition-opacity"
              style={{ color: "var(--oh-text3)" }}>
              ✕
            </button>
          </div>
        </div>

        {/* Stage Filter Tabs */}
        <div className="flex gap-1 px-3 py-1.5 border-b" style={{ borderColor: "var(--oh-border)" }}>
          {[
            { stage: 0, label: "All" },
            { stage: 1, label: "Watch+" },
            { stage: 2, label: "Warning+" },
            { stage: 3, label: "Imminent" },
          ].map(f => (
            <button key={f.stage}
              className="font-mono text-[11px] px-2 py-1 rounded transition-all"
              style={{
                background: stageFilter === f.stage ? "var(--oh-aqua-glow)" : "transparent",
                color: stageFilter === f.stage ? "var(--oh-aqua)" : "var(--oh-text3)",
                border: `1px solid ${stageFilter === f.stage ? "var(--oh-border3)" : "transparent"}`,
              }}
              onClick={() => setStageFilter(f.stage)}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="font-mono text-[12px] animate-pulse" style={{ color: "var(--oh-aqua)" }}>
              Scanning pre-spillover signals...
            </div>
          </div>
        ) : warnings.length === 0 ? (
          <div className="flex-1 flex items-center justify-center px-4 text-center">
            <div className="font-mono text-[12px]" style={{ color: "var(--oh-text3)" }}>
              No spillover risks at this threshold.
              <br />Try lowering the stage filter.
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Risk List (top half) */}
            <div className="flex-none overflow-y-auto oh-scroll px-2 py-1.5 space-y-1"
              style={{ maxHeight: selected ? "40%" : "100%" }}>
              {warnings.map((w, i) => (
                <RiskCard key={`${w.iso3}-${w.pathogen}`}
                  item={w}
                  selected={i === selectedIdx}
                  onClick={() => {
                    setSelectedIdx(i);
                    if (onSelectCountry) onSelectCountry(w.iso3);
                  }}
                />
              ))}
            </div>

            {/* Detail (bottom half) */}
            {selected && (
              <div className="flex-1 border-t overflow-hidden flex flex-col"
                style={{ borderColor: "var(--oh-border)" }}>
                <DetailPanel item={selected} timeline={timeline} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
