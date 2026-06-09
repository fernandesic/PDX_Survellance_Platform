import type { AiClassification, AiSeverity } from '../types';

interface AgentBadgeProps {
  aiClassification: AiClassification | undefined;
  aiSeverity: AiSeverity | undefined;
  confidence?: number;
  aiReasoning?: string;
  corroborationCount?: number;
  corroborationSources?: { tier: 1 | 2 | 3; name: string }[];
}

const TONE: Record<AiClassification, { bg: string; text: string; label: string }> = {
  continent_alert: {
    bg: 'bg-gradient-to-r from-red-500/90 to-rose-600/90',
    text: 'text-white',
    label: 'CONTINENT ALERT',
  },
  area_alert: {
    bg: 'bg-gradient-to-r from-orange-500/90 to-amber-600/90',
    text: 'text-white',
    label: 'AREA ALERT',
  },
  no_alert: {
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-400',
    label: 'NO ALERT',
  },
  uncertain: {
    bg: 'bg-slate-500/10',
    text: 'text-slate-400',
    label: 'UNCERTAIN',
  },
};

const SEVERITY_SHORT: Record<string, string> = {
  critical: 'CRITICAL',
  high: 'HIGH',
  moderate: 'MOD',
  low: 'LOW',
};

/**
 * Normalize confidence to 0–100 percentage.
 */
function normalizeConf(raw: number): number {
  if (!Number.isFinite(raw)) return 0;
  // If >1, treat as already a percentage; if ≤1, multiply by 100
  const pct = raw > 1 ? raw : raw * 100;
  return Math.max(0, Math.min(100, pct));
}

/**
 * Compact AI verdict badge for alert cards.
 *
 * Design: One gradient pill with classification + severity.
 * Confidence shown as "85%" not "conf 0.85". No robot emoji.
 * Tooltip shows first 140 chars of reasoning on hover.
 */
export function AgentBadge({
  aiClassification,
  aiSeverity,
  confidence,
  aiReasoning,
  corroborationCount,
}: AgentBadgeProps) {
  if (!aiClassification && !aiSeverity) return null;

  const tone = aiClassification
    ? (TONE[aiClassification] ?? TONE.uncertain)
    : TONE.uncertain;

  // Gradient pills (continent_alert, area_alert) use white text;
  // flat pills (no_alert, uncertain) use colored text
  const isGradient = aiClassification === 'continent_alert' || aiClassification === 'area_alert';
  const tooltipText = aiReasoning ? aiReasoning.slice(0, 140) : undefined;

  const confPct = confidence != null ? normalizeConf(confidence) : null;

  return (
    <div
      className="flex items-center gap-2"
      title={tooltipText}
      data-testid="agent-badge"
    >
      {/* Classification + Severity pill */}
      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-[3px] text-[9px] font-bold uppercase tracking-widest ${tone.bg} ${tone.text} ${isGradient ? 'shadow-sm' : 'border border-white/10'}`}
        style={isGradient ? { textShadow: '0 1px 2px rgba(0,0,0,0.2)' } : undefined}
      >
        {tone.label}
        {aiSeverity ? (
          <>
            <span className={isGradient ? 'opacity-50' : 'opacity-30'}>·</span>
            {SEVERITY_SHORT[aiSeverity] ?? aiSeverity.toUpperCase()}
          </>
        ) : null}
      </span>

      {/* Confidence as clean percentage */}
      {confPct !== null ? (
        <span
          className="text-[9px] font-semibold tabular-nums text-slate-500"
          data-testid="agent-badge-confidence"
        >
          {Math.round(confPct)}%
        </span>
      ) : null}

      {/* Corroboration as subtle count */}
      {corroborationCount != null && corroborationCount > 0 ? (
        <span
          className="text-[9px] text-slate-600"
          data-testid="agent-badge-corroboration"
        >
          · {corroborationCount} source{corroborationCount !== 1 ? 's' : ''}
        </span>
      ) : null}
    </div>
  );
}
