/**
 * SitrepPanel (T-033/T-124) — renders the latest auto-sitrep stored as
 * an OutbreakDecision(kind=sitrep). Citations are clickable.
 */

import { useQuery } from '@tanstack/react-query';
import { fetchLatestSitrep, type Decision } from '../services/outbreakApi';

interface Props {
  outbreakId: number;
  onCitationClick?: (c: string) => void;
}

export default function SitrepPanel({ outbreakId, onCitationClick }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ['outbreak-sitrep-latest', outbreakId],
    queryFn: () => fetchLatestSitrep(outbreakId),
    refetchInterval: 5 * 60_000,
  });

  if (isLoading) {
    return (
      <div className="ob-card">
        <h3 className="ob-card-title">Latest sitrep</h3>
        <div className="ob-no-data">loading...</div>
      </div>
    );
  }

  if (!data || !(data as Decision).body) {
    return (
      <div className="ob-card">
        <h3 className="ob-card-title">Latest sitrep</h3>
        <p className="ob-no-data">
          No sitrep yet. Run "Generate sitrep" in the Decision Log or wait
          for the daily 06:30 UTC job.
        </p>
      </div>
    );
  }

  const sitrep = data as Decision;
  return (
    <div className="ob-card ob-sitrep-card">
      <h3 className="ob-card-title">{sitrep.title || 'Latest sitrep'}</h3>
      <div className="ob-sitrep-meta">
        {sitrep.author} · {new Date(sitrep.created_at).toLocaleString()}
      </div>
      <pre className="ob-sitrep-body">{sitrep.body}</pre>
      {sitrep.citations.length > 0 && (
        <div className="ob-chat-cite-row">
          {sitrep.citations.map((c) => (
            <button
              key={c}
              type="button"
              className="ob-chat-cite"
              onClick={() => onCitationClick?.(c)}
            >
              {c}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
