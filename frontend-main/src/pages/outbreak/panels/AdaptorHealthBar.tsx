/**
 * AdaptorHealthBar (T-081) — footer strip on the Now pane that surfaces
 * each adaptor's health: last run, events emitted in the past hour, and
 * a green/amber/red status pill.
 */

import { useQuery } from '@tanstack/react-query';
import { fetchAdaptorHealth, type AdaptorHealth } from '../services/outbreakApi';

interface Props { outbreakId: number; }

function statusCls(s: AdaptorHealth['status']): string {
  if (s === 'ok') return 'ob-ahealth--ok';
  if (s === 'degraded') return 'ob-ahealth--degraded';
  return 'ob-ahealth--dead';
}

export default function AdaptorHealthBar({ outbreakId }: Props) {
  const { data = [], isLoading } = useQuery<AdaptorHealth[]>({
    queryKey: ['outbreak-adaptor-health', outbreakId],
    queryFn: () => fetchAdaptorHealth(outbreakId),
    refetchInterval: 60_000,
  });

  if (isLoading) {
    return <div className="ob-ahealth-bar">loading adaptor health...</div>;
  }
  if (data.length === 0) return null;

  return (
    <div className="ob-ahealth-bar">
      {data.map((a) => (
        <div key={a.name} className={`ob-ahealth-pill ${statusCls(a.status)}`}>
          <span className="ob-ahealth-name">{a.name}</span>
          <span className="ob-ahealth-count">{a.events_last_hour}/hr</span>
          {a.last_event_ts && (
            <span className="ob-ahealth-last">
              {new Date(a.last_event_ts).toLocaleTimeString()}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
