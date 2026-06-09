/**
 * OutbreakSeverityStrip — top-of-Now-pane honest verdict.
 *
 * Replaces the misleading "Can We Respond?" composite as the headline
 * of the Now pane. That score is response *capacity*; this strip is
 * outbreak *severity* — what's actually happening to people.
 *
 * Three tiles, derived not stored:
 *   1. Severity verdict (Critical / Severe / Significant / Monitoring)
 *      synthesised from confirmed deaths, CFR, vaccine availability,
 *      geographic spread, and PHEIC status.
 *   2. Trajectory — events_24h vs events_7d/7 average to flag escalation.
 *   3. Key threat — the dominant factor pushing severity up (no vaccine,
 *      high CFR, cross-border spread, etc.) so the officer sees WHY.
 *
 * Every value here is derived from props the workspace already loads;
 * no extra API calls.
 */

import { AlertOctagon, TrendingUp, TrendingDown, Minus, ShieldAlert } from 'lucide-react';
import type { Outbreak, OutbreakStats } from '../services/outbreakApi';

interface Props {
  outbreak: Outbreak;
  stats?: OutbreakStats;
}

type SeverityLevel = 'critical' | 'severe' | 'significant' | 'monitoring' | 'unknown';

interface SeverityVerdict {
  level: SeverityLevel;
  label: string;
  reasons: string[];
  primaryReason: string;
}

function computeSeverity(outbreak: Outbreak, stats?: OutbreakStats): SeverityVerdict {
  const reasons: string[] = [];
  let score = 0;

  // Confirmed deaths are the strongest signal — people are dying right now.
  const deaths = stats?.confirmed_deaths ?? 0;
  const cases = stats?.confirmed_cases ?? 0;
  if (deaths > 0) {
    score += 2;
    reasons.push(`${deaths.toLocaleString()} confirmed deaths`);
  }
  // CFR tiering uses the standard public-health thresholds.
  const cfr = cases > 0 && deaths != null ? (deaths / cases) * 100 : null;
  if (cfr != null) {
    if (cfr >= 50) { score += 3; reasons.unshift(`CFR ${cfr.toFixed(0)}% (extreme)`); }
    else if (cfr >= 25) { score += 2; reasons.unshift(`CFR ${cfr.toFixed(0)}% (very high)`); }
    else if (cfr >= 10) { score += 1; reasons.unshift(`CFR ${cfr.toFixed(0)}% (high)`); }
  }
  // No vaccine for the active strain is a non-pharmaceutical-only response —
  // a major severity multiplier.
  const profile = (outbreak.pathogen?.profile_json ?? {}) as Record<string, unknown>;
  const strains = (profile.strains as Record<string, Record<string, unknown>> | undefined) ?? {};
  const primaryStrainKey = (profile.primary_strain as string | undefined) ?? Object.keys(strains)[0] ?? '';
  const strainInfo = primaryStrainKey ? strains[primaryStrainKey] : undefined;
  const strainHasVaccine = strainInfo?.vaccine_available as boolean | undefined;
  const vaccineAvailable = strainHasVaccine !== undefined
    ? strainHasVaccine
    : !!outbreak.pathogen?.vaccine_available;
  if (!vaccineAvailable) {
    score += 2;
    reasons.push('no approved vaccine');
  }
  // Multi-country spread = cross-border transmission risk.
  const countryCount = stats?.countries_detected?.length ?? 0;
  if (countryCount >= 5) {
    score += 2;
    reasons.push(`${countryCount} countries detected`);
  } else if (countryCount >= 2) {
    score += 1;
    reasons.push(`${countryCount} countries detected`);
  }
  // PHEIC declared = WHO has formally escalated.
  if (outbreak.status === 'confirmed' && outbreak.severity === 'critical') {
    score += 2;
    reasons.push('PHEIC declared');
  } else if (outbreak.status === 'confirmed') {
    score += 1;
  }
  // Active signal pressure — current operational tempo.
  const events24h = stats?.events_24h ?? 0;
  if (events24h >= 50) {
    score += 1;
    reasons.push(`${events24h} new signals 24h`);
  }

  let level: SeverityLevel;
  let label: string;
  if (cases === 0 && deaths === 0 && !stats?.confirmed_as_of) {
    // No authoritative counts entered — refuse to verdict.
    return {
      level: 'unknown',
      label: 'Awaiting sitrep',
      reasons: ['Confirmed case/death counts not yet entered. See banner above.'],
      primaryReason: 'Awaiting Ministry/WHO sitrep',
    };
  }
  if (score >= 8) { level = 'critical'; label = 'CRITICAL'; }
  else if (score >= 5) { level = 'severe'; label = 'SEVERE'; }
  else if (score >= 2) { level = 'significant'; label = 'SIGNIFICANT'; }
  else { level = 'monitoring'; label = 'MONITORING'; }

  return {
    level,
    label,
    reasons,
    primaryReason: reasons[0] ?? 'No active severity drivers',
  };
}

function verdictTone(level: SeverityLevel): { color: string; bg: string } {
  switch (level) {
    case 'critical':    return { color: '#fca5a5', bg: 'rgba(239, 68, 68, 0.10)' };
    case 'severe':      return { color: '#fdba74', bg: 'rgba(249, 115, 22, 0.10)' };
    case 'significant': return { color: '#fde047', bg: 'rgba(234, 179, 8, 0.08)' };
    case 'monitoring':  return { color: '#86efac', bg: 'rgba(34, 197, 94, 0.06)' };
    default:            return { color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.06)' };
  }
}

function computeTrajectory(stats?: OutbreakStats):
  { delta: 'up' | 'down' | 'flat' | 'na'; label: string; sub: string } {
  if (!stats) return { delta: 'na', label: '—', sub: 'no data' };
  const e24 = stats.events_24h ?? 0;
  const e7 = stats.events_7d ?? 0;
  // 7-day-trailing daily average excluding the last 24h.
  const trailing = Math.max(0, e7 - e24);
  const avg = trailing / 6;
  if (e7 === 0) return { delta: 'na', label: '0', sub: 'no signals in last 7d' };
  if (avg === 0) return { delta: 'up', label: `+${e24}`, sub: 'first signals in 7d' };
  const ratio = e24 / avg;
  if (ratio >= 1.5) return { delta: 'up',   label: `+${e24}`, sub: `${ratio.toFixed(1)}× 7d average` };
  if (ratio <= 0.5) return { delta: 'down', label: `+${e24}`, sub: `${ratio.toFixed(1)}× 7d average` };
  return { delta: 'flat', label: `+${e24}`, sub: `~7d average (${avg.toFixed(1)}/d)` };
}

export default function OutbreakSeverityStrip({ outbreak, stats }: Props) {
  const verdict = computeSeverity(outbreak, stats);
  const tone = verdictTone(verdict.level);
  const traj = computeTrajectory(stats);

  return (
    <div className="ob-severity-strip">
      {/* Severity verdict — the lede */}
      <div
        className="ob-sev-tile ob-sev-tile--verdict"
        style={{ borderLeft: `3px solid ${tone.color}`, background: tone.bg }}
      >
        <div className="ob-sev-tile__head">
          <AlertOctagon size={16} style={{ color: tone.color }} />
          <span className="ob-sev-tile__label">Outbreak severity</span>
        </div>
        <div className="ob-sev-tile__value" style={{ color: tone.color }}>
          {verdict.label}
        </div>
        <div className="ob-sev-tile__sub">
          {verdict.primaryReason}
        </div>
      </div>

      {/* Trajectory — escalating / stable / receding */}
      <div className="ob-sev-tile">
        <div className="ob-sev-tile__head">
          {traj.delta === 'up' && <TrendingUp size={16} style={{ color: '#fca5a5' }} />}
          {traj.delta === 'down' && <TrendingDown size={16} style={{ color: '#86efac' }} />}
          {traj.delta === 'flat' && <Minus size={16} style={{ color: '#94a3b8' }} />}
          {traj.delta === 'na' && <Minus size={16} style={{ color: '#94a3b8' }} />}
          <span className="ob-sev-tile__label">Trajectory (24h)</span>
        </div>
        <div
          className="ob-sev-tile__value"
          style={{ color: traj.delta === 'up' ? '#fca5a5' : traj.delta === 'down' ? '#86efac' : '#e2e8f0' }}
        >
          {traj.label}
        </div>
        <div className="ob-sev-tile__sub">{traj.sub}</div>
      </div>

      {/* Key drivers — the reasons stack so the officer sees why */}
      <div className="ob-sev-tile ob-sev-tile--reasons">
        <div className="ob-sev-tile__head">
          <ShieldAlert size={16} style={{ color: 'var(--ob-text-muted)' }} />
          <span className="ob-sev-tile__label">Severity drivers</span>
        </div>
        {verdict.reasons.length === 0 ? (
          <div className="ob-sev-tile__sub" style={{ marginTop: 4 }}>
            No active escalating factors recorded.
          </div>
        ) : (
          <div className="ob-sev-reasons">
            {verdict.reasons.map((r) => (
              <span key={r} className="ob-sev-reason-pill">{r}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
