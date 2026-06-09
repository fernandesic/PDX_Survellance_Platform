/**
 * IhrCapacityCard — T-094
 *
 * 13 IHR / e-SPAR top-level capacities rendered as mini-bars.
 * Any component below 50 is flagged red. Headline rollups for
 * surveillance, laboratory, response, workforce shown at top.
 */

import type { OutbreakCapacity } from '../services/outbreakApi';

interface Props {
  capacity?: OutbreakCapacity;
  iso3: string;
}

const HEADLINE_ORDER: Array<{ key: keyof NonNullable<OutbreakCapacity['ihr']['headlines']>; label: string }> = [
  { key: 'surveillance', label: 'Surveillance' },
  { key: 'laboratory', label: 'Laboratory' },
  { key: 'response', label: 'Response' },
  { key: 'workforce', label: 'Workforce' },
];

function barClass(value: number): string {
  if (value < 50) return 'ob-bad';
  if (value < 70) return 'ob-warn';
  return 'ob-good';
}

export default function IhrCapacityCard({ capacity, iso3 }: Props) {
  const ihr = capacity?.ihr;

  if (!ihr?.data_available) {
    return (
      <div className="ob-card">
        <h3 className="ob-card-title">IHR / e-SPAR Capacity — {iso3}</h3>
        <p className="ob-no-data">
          No e-SPAR data on file for {iso3}. Run the espar import to populate
          the latest reporting year.
        </p>
      </div>
    );
  }

  const headlines = ihr.headlines ?? {
    surveillance: null,
    laboratory: null,
    response: null,
    workforce: null,
  };

  return (
    <div className="ob-card ob-ihr-card">
      <div className="ob-ihr-header">
        <h3 className="ob-card-title" style={{ border: 'none', padding: 0, margin: 0 }}>
          IHR / e-SPAR Capacity — {iso3}
        </h3>
        <div className="ob-ihr-overall">
          <span className="ob-ihr-overall-label">Overall</span>
          <span className={`ob-ihr-overall-value ${ihr.overall != null ? barClass(ihr.overall) : ''}`}>
            {ihr.overall != null ? ihr.overall : '—'}
          </span>
          {ihr.year && <span className="ob-ihr-year">({ihr.year})</span>}
        </div>
      </div>

      <div className="ob-ihr-headlines">
        {HEADLINE_ORDER.map(({ key, label }) => {
          const value = headlines[key];
          return (
            <div key={key} className="ob-ihr-headline">
              <div className="ob-ihr-headline-label">{label}</div>
              <div
                className={`ob-ihr-headline-value ${value != null ? barClass(value) : ''}`}
              >
                {value != null ? value : '—'}
              </div>
            </div>
          );
        })}
      </div>

      {(ihr.weak_count ?? 0) > 0 && (
        <div className="ob-ihr-warn">
          <strong>{ihr.weak_count}</strong> of {ihr.components.length} core capacities below 50 — bottlenecks flagged in red.
        </div>
      )}

      <div className="ob-ihr-components">
        {ihr.components.map((c) => {
          const pct = Math.min(100, Math.max(0, c.value));
          const cls = c.below_50 ? 'ob-bad' : barClass(c.value);
          return (
            <div key={c.code} className="ob-ihr-row" title={`${c.code} ${c.label}: ${c.value}`}>
              <div className="ob-ihr-row-code">{c.code}</div>
              <div className="ob-ihr-row-label">{c.label}</div>
              <div className="ob-ihr-row-bar">
                <div className={`ob-ihr-row-fill ${cls}`} style={{ width: `${pct}%` }} />
              </div>
              <div className={`ob-ihr-row-value ${cls}`}>{c.value}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
