/**
 * ReadinessCard — T-093
 *
 * Disease-specific readiness score for the outbreak's pathogen +
 * country. Shows headline score, weakest categories, and a click-to-
 * expand category breakdown.
 */

import { useMemo, useState } from 'react';
import type { OutbreakCapacity } from '../services/outbreakApi';

interface Props {
  capacity?: OutbreakCapacity;
  pathogenName: string;
  iso3: string;
}

export default function ReadinessCard({ capacity, pathogenName, iso3 }: Props) {
  const [expanded, setExpanded] = useState(false);
  const readiness = capacity?.readiness;

  const sortedCategories = useMemo(() => {
    if (!readiness?.categories) return [];
    return Object.entries(readiness.categories).sort((a, b) => a[1] - b[1]);
  }, [readiness?.categories]);

  if (!readiness?.data_available) {
    return (
      <div className="ob-card">
        <h3 className="ob-card-title">Disease Readiness — {pathogenName}</h3>
        <p className="ob-no-data">
          No readiness data on file for {pathogenName} in {iso3}. Seed the
          relevant <code>readiness/</code> table to populate this card.
        </p>
      </div>
    );
  }

  const score = readiness.score ?? 0;
  const scoreCls = score >= 70 ? 'ob-good' : score >= 50 ? 'ob-warn' : 'ob-bad';

  return (
    <div className="ob-card ob-readiness-card">
      <div className="ob-readiness-header">
        <h3 className="ob-card-title" style={{ border: 'none', padding: 0, margin: 0 }}>
          Disease Readiness — {pathogenName}
        </h3>
        <button
          type="button"
          className="ob-readiness-toggle"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? 'Hide breakdown' : 'Show breakdown'}
        </button>
      </div>

      <div className="ob-readiness-headline">
        <div className={`ob-readiness-score ${scoreCls}`}>
          {readiness.score != null ? readiness.score.toFixed(1) : '—'}
          <span className="ob-readiness-suffix">/100</span>
        </div>
        <div className="ob-readiness-meta">
          <div>{iso3} · {Object.keys(readiness.categories).length} categories scored</div>
          {readiness.weakest && readiness.weakest.length > 0 && (
            <div className="ob-readiness-gaps">
              <span className="ob-readiness-gap-label">Key gaps:</span>
              {readiness.weakest.map((w) => (
                <span key={w.category} className="ob-readiness-gap-pill">
                  {w.category} ({w.score.toFixed(0)})
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {expanded && (
        <div className="ob-readiness-categories">
          {sortedCategories.map(([cat, val]) => {
            const pct = Math.min(100, Math.max(0, val));
            const cls = val >= 70 ? 'ob-good' : val >= 50 ? 'ob-warn' : 'ob-bad';
            return (
              <div key={cat} className="ob-readiness-row">
                <div className="ob-readiness-row-label">{cat}</div>
                <div className="ob-readiness-row-bar">
                  <div className={`ob-readiness-row-fill ${cls}`} style={{ width: `${pct}%` }} />
                </div>
                <div className="ob-readiness-row-val">{val.toFixed(0)}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
