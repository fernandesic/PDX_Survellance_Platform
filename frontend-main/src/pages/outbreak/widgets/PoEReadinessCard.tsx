/**
 * PoEReadinessCard — Points of Entry readiness for the outbreak country.
 *
 * Reads from `capacity.poe`, which the backend aggregates from the
 * `readiness.FVDPoE` rows (joined on country name via ISO3_TO_ESPAR_NAME).
 * No client-side fetch — keeps the capacity story single-source-of-truth.
 *
 * Fails open: when the country isn't scored in readiness data, shows
 * an honest "No FVD PoE score recorded" — never fabricates.
 */

import { Plane } from 'lucide-react';
import type { OutbreakCapacity } from '../services/outbreakApi';
import { countryName } from '../utils/countryNames';

interface Props {
  iso3: string;
  capacity?: OutbreakCapacity;
}

function bandColor(score: number | null): string {
  if (score == null) return 'var(--ob-text-muted)';
  if (score >= 70) return '#86efac';
  if (score >= 50) return '#fde047';
  if (score >= 30) return '#fdba74';
  return '#fca5a5';
}

function verdict(score: number | null): string {
  if (score == null) return '';
  if (score >= 70) return 'Borders well-prepared';
  if (score >= 50) return 'Adequate — monitor';
  if (score >= 30) return 'Gaps — strengthen PoE response';
  return 'Severe gaps — PoE is a bottleneck';
}

export default function PoEReadinessCard({ iso3, capacity }: Props) {
  const poe = capacity?.poe;
  const score = poe?.score ?? null;
  const color = bandColor(score);
  const name = countryName(iso3);

  return (
    <div className="ob-card">
      <h3 className="ob-card-title">
        <Plane size={14} style={{ verticalAlign: 'middle', marginRight: 6, opacity: 0.7 }} />
        Points of Entry readiness — {name}
      </h3>
      {score == null ? (
        <p className="ob-no-data">
          No FVD PoE readiness score recorded for {name}. Borders not yet
          scored in the readiness service, or the country's questionnaires
          aren't populated.
        </p>
      ) : (
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap' }}>
          <span style={{ fontSize: '2rem', fontWeight: 700, color, lineHeight: 1.1 }}>
            {Math.round(score)}
          </span>
          <span style={{ color: 'var(--ob-text-muted)', fontSize: '0.9rem' }}>/100</span>
          <span style={{ fontSize: '0.85rem', color: 'var(--ob-text-dim)', marginLeft: 'auto' }}>
            {verdict(score)}
          </span>
          {poe?.questions_answered != null && poe?.questions_total != null && (
            <span style={{
              flexBasis: '100%',
              fontSize: '0.72rem',
              color: 'var(--ob-text-dim)',
              marginTop: 4,
            }}>
              {poe.questions_answered.toLocaleString()} of {poe.questions_total.toLocaleString()} questions answered
            </span>
          )}
        </div>
      )}
    </div>
  );
}
