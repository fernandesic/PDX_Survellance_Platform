/**
 * SeasonalSpilloverCard — T-096
 *
 * Combines (a) pathogen's seasonal months vs today, (b) trigger
 * env conditions, (c) live spillover engine score, (d) reservoir.
 *
 * Strain comparison stays in the Past pane — this card does not
 * repeat it.
 */

import type { OutbreakCapacity, Outbreak } from '../services/outbreakApi';

interface Props {
  capacity?: OutbreakCapacity;
  outbreak: Outbreak;
}

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function rangesFromMonths(months: number[]): string {
  if (!months || months.length === 0) return 'unknown';
  const sorted = [...months].sort((a, b) => a - b);
  const ranges: string[] = [];
  let start = sorted[0];
  let prev = sorted[0];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === prev + 1) {
      prev = sorted[i];
      continue;
    }
    ranges.push(start === prev ? MONTH_NAMES[start - 1] : `${MONTH_NAMES[start - 1]}–${MONTH_NAMES[prev - 1]}`);
    start = sorted[i];
    prev = sorted[i];
  }
  ranges.push(start === prev ? MONTH_NAMES[start - 1] : `${MONTH_NAMES[start - 1]}–${MONTH_NAMES[prev - 1]}`);
  return ranges.join(', ');
}

function spilloverBand(score: number | null | undefined): string {
  if (score == null) return 'ob-band--unknown';
  if (score >= 70) return 'ob-band--red';
  if (score >= 50) return 'ob-band--amber';
  if (score >= 30) return 'ob-band--yellow';
  return 'ob-band--green';
}

export default function SeasonalSpilloverCard({ capacity, outbreak }: Props) {
  const profile = (outbreak.pathogen?.profile_json ?? {}) as Record<string, unknown>;
  const seasonMonths = (profile.trigger_season_months as number[]) ?? [];
  const envConditions = (profile.trigger_env_conditions as string[]) ?? [];
  const reservoir = (profile.reservoir as string) ?? '';
  const naturalHosts = (profile.natural_hosts as string[]) ?? [];

  const currentMonth = new Date().getMonth() + 1;
  const inSeason = seasonMonths.includes(currentMonth);
  const seasonRange = rangesFromMonths(seasonMonths);

  const spillover = capacity?.spillover;
  const star = capacity?.star;
  const spilloverScore = spillover?.score ?? null;
  const bandCls = spilloverBand(spilloverScore);

  return (
    <div className={`ob-card ob-season-card ${bandCls}`}>
      <h3 className="ob-card-title">Seasonal &amp; Spillover Risk</h3>

      <div className="ob-season-grid">
        <div className="ob-season-tile">
          <div className="ob-season-tile-label">Peak season</div>
          <div className={`ob-season-tile-value ${inSeason ? 'ob-bad' : 'ob-good'}`}>
            {seasonMonths.length === 0 ? 'Unknown' : inSeason ? 'YES' : 'NO'}
          </div>
          <div className="ob-season-tile-sub">
            {seasonMonths.length > 0 ? seasonRange : 'No seasonal pattern recorded'}
          </div>
        </div>

        <div className="ob-season-tile">
          <div className="ob-season-tile-label">Spillover score</div>
          <div className={`ob-season-tile-value ${bandCls}`}>
            {spilloverScore != null ? Math.round(spilloverScore) : '—'}
          </div>
          <div className="ob-season-tile-sub">
            {spillover?.stage_label ?? (spillover?.data_available ? 'live engine' : 'no data')}
          </div>
        </div>

        <div className="ob-season-tile">
          <div className="ob-season-tile-label">STAR hazard</div>
          <div className="ob-season-tile-value">
            {star?.score != null ? Math.round(star.score) : '—'}
          </div>
          <div className="ob-season-tile-sub">
            {star?.hazard ?? (star?.data_available ? 'scored' : 'no country hazard match')}
          </div>
        </div>

        <div className="ob-season-tile">
          <div className="ob-season-tile-label">30-day P(spillover)</div>
          <div className="ob-season-tile-value">
            {spillover?.p_spillover_30d != null
              ? `${(spillover.p_spillover_30d * 100).toFixed(1)}%`
              : '—'}
          </div>
          <div className="ob-season-tile-sub">
            {spillover?.active_animal_events != null
              ? `${spillover.active_animal_events} active animal events`
              : 'no animal events tracked'}
          </div>
        </div>
      </div>

      <div className="ob-season-meta">
        <div className="ob-season-meta-row">
          <span className="ob-season-meta-label">Reservoir:</span>
          <span>{reservoir || 'unknown'}</span>
          {naturalHosts.length > 0 && (
            <span className="ob-season-meta-hosts">
              hosts: {naturalHosts.join(', ')}
            </span>
          )}
        </div>
        {envConditions.length > 0 && (
          <div className="ob-season-meta-row">
            <span className="ob-season-meta-label">Monitored triggers:</span>
            {envConditions.map((c) => (
              <span key={c} className="ob-season-trigger-pill">{c.replace(/_/g, ' ')}</span>
            ))}
          </div>
        )}
        {spillover?.environmental_flags && spillover.environmental_flags.length > 0 && (
          <div className="ob-season-meta-row">
            <span className="ob-season-meta-label">Live env flags:</span>
            {spillover.environmental_flags.map((f) => (
              <span key={f} className="ob-season-flag-pill">{f}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
