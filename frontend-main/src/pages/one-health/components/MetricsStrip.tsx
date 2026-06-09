import { useEffect, useState } from "react";

interface MetricCard {
  label: string;
  value: number;
  suffix?: string;
  color: "crimson" | "amber" | "aqua" | "cobalt";
  delta?: string;
  deltaType?: "up" | "down" | "warn";
  sub?: string;
}

const FALLBACK_METRICS: MetricCard[] = [
  { label: "Tier 3–4 Alerts", value: 7, color: "crimson", delta: "+3", deltaType: "up", sub: "vs last week" },
  { label: "Active Outbreaks", value: 23, color: "amber", delta: "+2", deltaType: "warn", sub: "new this week" },
  { label: "AFRO SPAR Avg", value: 51, suffix: "%", color: "aqua", sub: "2024 regional score" },
  { label: "Spillover Risk", value: 6.2, color: "cobalt", delta: "↑ elevated", deltaType: "up", sub: "3 hotspots" },
];

const COLOR_MAP = {
  crimson: { border: "var(--oh-crimson)", text: "var(--oh-crimson)" },
  amber: { border: "var(--oh-amber)", text: "var(--oh-amber)" },
  aqua: { border: "var(--oh-aqua)", text: "var(--oh-aqua)" },
  cobalt: { border: "var(--oh-cobalt)", text: "var(--oh-cobalt)" },
};

const DELTA_STYLES = {
  up: "bg-[rgba(255,61,90,0.12)] text-[var(--oh-crimson)]",
  down: "bg-[rgba(77,232,160,0.1)] text-[var(--oh-sage)]",
  warn: "bg-[rgba(255,179,71,0.12)] text-[var(--oh-amber)]",
};

function AnimatedValue({ target, suffix }: { target: number; suffix?: string }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    let cur = 0;
    const step = Math.max(target / 40, 0.01);
    const iv = setInterval(() => {
      cur = Math.min(cur + step, target);
      setDisplay(cur);
      if (cur >= target) clearInterval(iv);
    }, 20);
    return () => clearInterval(iv);
  }, [target]);

  const formatted = target % 1 !== 0 ? display.toFixed(1) : Math.round(display).toString();
  return <>{formatted}{suffix || ""}</>;
}

import type { OHKPIs } from "../services/oneHealth";

interface MetricsStripProps {
  kpis?: OHKPIs | null;
}

// Empty placeholders shown while the live KPIs are loading — avoids the
// flicker where hardcoded fallback values briefly appear before the real
// numbers arrive.
const LOADING_METRICS: MetricCard[] = [
  { label: "Tier 3–4 Alerts", value: 0, color: "crimson", sub: "loading…" },
  { label: "Active Outbreaks", value: 0, color: "amber", sub: "loading…" },
  { label: "AFRO SPAR Avg", value: 0, suffix: "%", color: "aqua", sub: "loading…" },
  { label: "Spillover Risk", value: 0, color: "cobalt", sub: "loading…" },
];

export default function MetricsStrip({ kpis }: MetricsStripProps) {
  const metrics: MetricCard[] = kpis
    ? [
      { label: "Tier 3–4 Alerts", value: kpis.tier_high_alerts, color: "crimson", sub: "active high-tier" },
      { label: "Active Outbreaks", value: kpis.active_outbreaks, color: "amber", sub: "disease×country" },
      { label: "AFRO SPAR Avg", value: kpis.afro_spar_avg, suffix: "%", color: "aqua", sub: "IHR capacity" },
      { label: "Spillover Risk", value: kpis.spillover_risk_idx, color: "cobalt", sub: "avg risk index" },
    ]
    : LOADING_METRICS;

  return (
    <div className="absolute bottom-8 left-3 z-[500] flex flex-col gap-1.5 w-[200px]">
      {metrics.map((m, i) => (
        <div
          key={m.label}
          className="oh-glass-card px-2.5 py-1.5 cursor-pointer relative overflow-hidden hover:translate-y-[-1px] transition-transform"
          style={{ animationDelay: `${i * 0.05}s` }}
        >
          {/* Top colored bar */}
          <div
            className="absolute top-0 left-0 right-0 h-[2px] rounded-t-[10px]"
            style={{ background: COLOR_MAP[m.color].border }}
          />

          <div className="font-mono text-[7.5px] text-white tracking-widest uppercase mb-0.5">
            {m.label}
          </div>
          <div className="flex items-baseline gap-2">
            <div
              className="font-serif text-[22px] font-bold leading-none shrink-0"
              style={{ color: COLOR_MAP[m.color].text, fontFamily: "'Fraunces', serif" }}
            >
              <AnimatedValue target={m.value} suffix={m.suffix} />
            </div>
            <div className="text-[9px] text-[var(--oh-text3)] flex items-center gap-1 flex-wrap">
              {m.delta && (
                <span
                  className={`font-mono text-[8px] px-1 py-px rounded ${DELTA_STYLES[m.deltaType || "up"]}`}
                >
                  {m.delta}
                </span>
              )}
              <span>{m.sub}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
