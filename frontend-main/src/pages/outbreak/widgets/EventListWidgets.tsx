/**
 * EventListWidgets — UnsafeBurialList (T-028/T-100), HcwInfectionAlarm
 * (T-027/T-101), SilenceAnomalyList (T-029).
 *
 * All three project the same OutbreakEvent stream onto kind-filtered
 * lists with a thin headline. Empty-state copy is informative, not
 * a fake placeholder (T-082).
 */

import type { OutbreakEvent } from '../services/outbreakApi';

interface ListProps {
  events: OutbreakEvent[];
  onSelectEvent?: (id: number) => void;
}

function filterByKind(events: OutbreakEvent[], kind: string): OutbreakEvent[] {
  return events.filter((e) => e.kind === kind);
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.max(0, Math.floor(diff / 60000));
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ─── UnsafeBurialList ──────────────────────────────────────────────────

export function UnsafeBurialList({ events, onSelectEvent }: ListProps) {
  const items = filterByKind(events, 'burial');
  return (
    <div className="ob-card">
      <h3 className="ob-card-title">Unsafe Burial Signals</h3>
      {items.length === 0 ? (
        <p className="ob-no-data">
          No unsafe-burial signals detected. The keyword adaptor scans
          existing sentinel signals — populated once one matches.
        </p>
      ) : (
        <div className="ob-event-list">
          {items.slice(0, 30).map((e) => (
            <button
              key={e.id}
              type="button"
              className="ob-event-row"
              onClick={() => onSelectEvent?.(e.id)}
            >
              <span className="ob-event-meta">
                <span className="ob-event-geo">{e.geo || '?'}</span>
                <span className="ob-event-time">{relTime(e.ts)}</span>
                <span className="ob-event-id">evt:{e.id}</span>
              </span>
              <span className="ob-event-head">
                {(e.payload_json?.headline as string) || (e.payload_json?.matched_keyword as string) || 'burial event'}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── HcwInfectionAlarm ─────────────────────────────────────────────────

export function HcwInfectionAlarm({ events, onSelectEvent }: ListProps) {
  const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000;
  const recent = filterByKind(events, 'hcw_infection').filter(
    (e) => new Date(e.ts).getTime() >= cutoff
  );
  const isAlarm = recent.length > 0;
  return (
    <div className={`ob-card ob-hcw-card ${isAlarm ? 'ob-hcw-card--alarm' : ''}`}>
      <h3 className="ob-card-title">HCW Infections (last 14 days)</h3>
      {!isAlarm ? (
        <p className="ob-no-data">
          No HCW infection signals detected in the last 14 days. Confidence
          is bounded by what sentinel ingestion captures.
        </p>
      ) : (
        <>
          <div className="ob-hcw-banner">
            <strong>{recent.length}</strong> health-worker infection signal{recent.length === 1 ? '' : 's'}.
          </div>
          <div className="ob-event-list">
            {recent.slice(0, 20).map((e) => (
              <button
                key={e.id}
                type="button"
                className="ob-event-row"
                onClick={() => onSelectEvent?.(e.id)}
              >
                <span className="ob-event-meta">
                  <span className="ob-event-geo">{e.geo || '?'}</span>
                  <span className="ob-event-time">{relTime(e.ts)}</span>
                  <span className="ob-event-id">evt:{e.id}</span>
                </span>
                <span className="ob-event-head">
                  {(e.payload_json?.headline as string) || (e.payload_json?.matched_keyword as string) || 'HCW infection'}
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── SilenceAnomalyList ────────────────────────────────────────────────

export function SilenceAnomalyList({ events, onSelectEvent }: ListProps) {
  const items = filterByKind(events, 'silence_anomaly');
  return (
    <div className="ob-card">
      <h3 className="ob-card-title">Districts Unusually Quiet</h3>
      {items.length === 0 ? (
        <p className="ob-no-data">
          No silence anomalies right now. The detector flags districts
          whose reporting cadence has stopped relative to their baseline.
        </p>
      ) : (
        <div className="ob-event-list">
          {items.slice(0, 20).map((e) => {
            const quietHours = e.payload_json?.quiet_for_hours as number | undefined;
            const baseline = e.payload_json?.median_gap_hours as number | undefined;
            return (
              <button
                key={e.id}
                type="button"
                className="ob-event-row"
                onClick={() => onSelectEvent?.(e.id)}
              >
                <span className="ob-event-meta">
                  <span className="ob-event-geo">{e.geo || '?'}</span>
                  <span className="ob-event-time">{relTime(e.ts)}</span>
                  <span className="ob-event-id">evt:{e.id}</span>
                </span>
                <span className="ob-event-head">
                  Silent for {(quietHours ?? 0) / 24 < 1
                    ? `${(quietHours ?? 0).toFixed(1)}h`
                    : `${((quietHours ?? 0) / 24).toFixed(1)}d`}
                  {baseline != null && ` (baseline ${baseline.toFixed(1)}h)`}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
