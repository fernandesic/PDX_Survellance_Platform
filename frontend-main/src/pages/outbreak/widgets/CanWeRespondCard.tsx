/**
 * CanWeRespondCard — T-092
 *
 * The headline composite-risk card at the top of the Now pane.
 * One sentence verdict, color band, and the two weakest sub-scores
 * pulled from the capacity composite payload.
 */

import { useState } from 'react';
import type { OutbreakCapacity } from '../services/outbreakApi';

interface Props {
  capacity?: OutbreakCapacity;
  loading?: boolean;
}

interface SubScore {
  label: string;
  value: number;
}

function bandForScore(score: number | null | undefined): {
  cls: string;
  verdict: string;
} {
  if (score == null) {
    return { cls: 'ob-band--unknown', verdict: 'Insufficient data to score response capacity.' };
  }
  if (score >= 70) {
    return { cls: 'ob-band--red', verdict: 'High risk — response capacity is critically stressed.' };
  }
  if (score >= 50) {
    return { cls: 'ob-band--amber', verdict: 'Elevated risk — response capacity has material gaps.' };
  }
  if (score >= 30) {
    return { cls: 'ob-band--yellow', verdict: 'Moderate risk — response capacity is adequate but watch the gaps.' };
  }
  return { cls: 'ob-band--green', verdict: 'Lower risk — response capacity appears sufficient at present.' };
}

export default function CanWeRespondCard({ capacity, loading }: Props) {
  const [showDetail, setShowDetail] = useState(false);

  if (loading) {
    return (
      <div className="ob-card ob-cwr-card">
        <h3 className="ob-card-title">Can We Respond?</h3>
        <div className="ob-loading" style={{ height: 120 }}>
          <div className="ob-loading-spinner" />
        </div>
      </div>
    );
  }

  const composite = capacity?.composite;
  const score = composite?.score ?? null;
  const band = bandForScore(score);
  const dataAvailable = composite?.data_available ?? false;

  // Collect named sub-scores so we can rank weakest two.
  const subs: SubScore[] = [];
  if (composite?.star_score != null) subs.push({ label: 'STAR seasonal hazard', value: composite.star_score });
  if (composite?.climate_score != null) subs.push({ label: 'Climate driver', value: composite.climate_score });
  if (composite?.sentinel_score != null) subs.push({ label: 'Sentinel signal pressure', value: composite.sentinel_score });
  if (composite?.espar_score != null) subs.push({ label: 'IHR (e-SPAR)', value: composite.espar_score });
  if (composite?.readiness_score != null) subs.push({ label: 'Disease readiness', value: composite.readiness_score });

  // Higher score = higher risk in the composite engine convention, so the
  // two highest sub-scores are the weakest pillars driving the verdict.
  const weakest = [...subs].sort((a, b) => b.value - a.value).slice(0, 2);

  return (
    <div className={`ob-card ob-cwr-card ${band.cls}`}>
      <div className="ob-cwr-header">
        <h3 className="ob-card-title" style={{ border: 'none', padding: 0, margin: 0 }}>
          Can We Respond?
        </h3>
        <span className="ob-cwr-risk-label">{composite?.risk_level ?? 'unknown'}</span>
      </div>

      {!dataAvailable ? (
        <p className="ob-no-data">
          No composite risk score available for this outbreak yet. Run the predictions task
          (<code>compute_all_predictions</code>) to populate <code>OutbreakPrediction</code>.
        </p>
      ) : (
        <>
          <div className="ob-cwr-body">
            <button
              type="button"
              className="ob-cwr-score"
              onClick={() => setShowDetail((v) => !v)}
              title="Click to inspect composite formula"
            >
              <span className="ob-cwr-score-value">
                {score != null ? Math.round(score) : '?'}
              </span>
              <span className="ob-cwr-score-suffix">/100</span>
            </button>
            <div className="ob-cwr-verdict">
              <p className="ob-cwr-verdict-text">{band.verdict}</p>
              {weakest.length > 0 && (
                <div className="ob-cwr-weak">
                  <span className="ob-cwr-weak-label">Top weaknesses:</span>
                  {weakest.map((w) => (
                    <span key={w.label} className="ob-cwr-weak-pill">
                      {w.label} ({Math.round(w.value)})
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {showDetail && (
            <div className="ob-cwr-detail">
              <div className="ob-cwr-detail-title">Composite breakdown</div>
              <div className="ob-cwr-subscores">
                {subs.length === 0 && <span className="ob-no-data">No sub-scores reported.</span>}
                {subs.map((s) => (
                  <div key={s.label} className="ob-cwr-sub">
                    <div className="ob-cwr-sub-label">{s.label}</div>
                    <div className="ob-cwr-sub-bar">
                      <div
                        className="ob-cwr-sub-fill"
                        style={{ width: `${Math.min(100, Math.max(0, s.value))}%` }}
                      />
                    </div>
                    <div className="ob-cwr-sub-value">{Math.round(s.value)}</div>
                  </div>
                ))}
              </div>
              {composite?.confidence != null && (
                <div className="ob-cwr-meta">
                  Confidence: {(composite.confidence * 100).toFixed(0)}%
                  {composite.sources_used && composite.sources_used.length > 0 && (
                    <> · Sources: {composite.sources_used.join(', ')}</>
                  )}
                  {composite.valid_until && (
                    <> · Valid until {new Date(composite.valid_until).toLocaleDateString()}</>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
