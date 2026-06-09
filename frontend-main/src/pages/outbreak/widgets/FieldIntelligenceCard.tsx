/**
 * FieldIntelligenceCard — CHW Sentinel Ground Truth alerts.
 * Fuses real-time community surveillance signals (Tier 0) into
 * the Outbreak Workspace.
 */

import type { OutbreakEvent } from '../services/outbreakApi';

interface Props {
  events: OutbreakEvent[];
  onSelectEvent?: (id: number) => void;
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.max(0, Math.floor(diff / 60000));
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function FieldIntelligenceCard({ events, onSelectEvent }: Props) {
  const items = events.filter((e) => e.source === 'kobo_chw');

  return (
    <div className="ob-card ob-chw-intel-card">
      <div className="ob-card-header flex items-center justify-between" style={{ marginBottom: '12px' }}>
        <h3 className="ob-card-title flex items-center gap-2" style={{ border: 'none', margin: 0, padding: 0 }}>
          <span style={{ fontSize: '1.2em' }}>🏥</span> Field Intelligence
        </h3>
        <span className="ob-chat-badge" style={{ color: 'var(--ob-green)', background: 'rgba(34, 197, 94, 0.08)' }}>
          Tier 0 Ground Truth
        </span>
      </div>

      {items.length === 0 ? (
        <p className="ob-no-data">
          No real-time CHW sentinel reports received for this outbreak. 
          Ingest new Kobo submissions to populate this ground-truth stream.
        </p>
      ) : (
        <div className="ob-event-list">
          {items.slice(0, 30).map((e) => {
            const priority = (e.payload_json?.priority as string || 'P3').toUpperCase();
            const cases = e.payload_json?.reported_cases as number | null;
            const deaths = e.payload_json?.reported_deaths as number | null;
            const confidence = Math.round(Number(e.confidence || 0.85) * 100);
            
            let priCls = 'ob-priority--p3';
            if (priority === 'P1') priCls = 'ob-priority--p1';
            else if (priority === 'P2') priCls = 'ob-priority--p2';
            else if (priority === 'P4') priCls = 'ob-priority--p4';

            return (
              <button
                key={e.id}
                type="button"
                className="ob-event-row"
                style={{ borderLeft: '3px solid var(--ob-green)', position: 'relative' }}
                onClick={() => onSelectEvent?.(e.id)}
              >
                <div className="ob-event-meta flex justify-between" style={{ width: '100%' }}>
                  <span className="ob-event-geo flex items-center gap-1">
                    📍 {e.geo || 'Unknown Location'}
                  </span>
                  <div className="flex gap-2 items-center">
                    <span className={`ob-signal-priority ${priCls}`} style={{ padding: '1px 6px', borderRadius: '3px', fontSize: '0.7rem' }}>
                      {priority}
                    </span>
                    <span className="ob-event-time">{relTime(e.ts)}</span>
                    <span className="ob-event-id">evt:{e.id}</span>
                  </div>
                </div>

                <div className="ob-event-head" style={{ marginTop: '4px', fontWeight: 600 }}>
                  {(e.payload_json?.headline as string) || 'CHW Field Signal'}
                </div>

                <div className="flex items-center gap-3" style={{ marginTop: '8px', fontSize: '0.78rem', color: 'var(--ob-text-muted)' }}>
                  <span className="flex items-center gap-1" style={{ background: 'var(--ob-surface)', padding: '2px 6px', borderRadius: '4px' }}>
                    👥 Cases: <strong style={{ color: 'var(--ob-orange)' }}>{cases ?? 0}</strong>
                  </span>
                  {deaths != null && deaths > 0 && (
                    <span className="flex items-center gap-1" style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '2px 6px', borderRadius: '4px' }}>
                      ☠️ Deaths: <strong style={{ color: 'var(--ob-red)' }}>{deaths}</strong>
                    </span>
                  )}
                  <span className="flex items-center gap-1" style={{ marginLeft: 'auto', opacity: 0.8 }}>
                    🎯 Confidence: <strong>{confidence}%</strong>
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
