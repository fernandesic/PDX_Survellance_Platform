/**
 * DecisionLog (T-060) — append-only log of decisions, sitreps, notes.
 * Backend rejects edits/deletes via the model's save() override; the UI
 * never shows edit/delete affordances.
 */

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createDecision, fetchDecisions, generateSitrep, type Decision,
} from '../services/outbreakApi';

interface Props {
  outbreakId: number;
  onCitationClick?: (c: string) => void;
}

export default function DecisionLog({ outbreakId, onCitationClick }: Props) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState({ title: '', body: '' });

  const { data: items = [], isLoading } = useQuery<Decision[]>({
    queryKey: ['outbreak-decisions', outbreakId],
    queryFn: () => fetchDecisions(outbreakId),
    refetchInterval: 60_000,
  });

  const create = useMutation({
    mutationFn: (payload: { title: string; body: string }) =>
      createDecision(outbreakId, { kind: 'decision', ...payload }),
    onSuccess: () => {
      setDraft({ title: '', body: '' });
      qc.invalidateQueries({ queryKey: ['outbreak-decisions', outbreakId] });
    },
  });

  const sitrep = useMutation({
    mutationFn: () => generateSitrep(outbreakId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['outbreak-decisions', outbreakId] });
    },
  });

  return (
    <div className="ob-card ob-decision-card">
      <div className="ob-decision-header">
        <h3 className="ob-card-title" style={{ border: 'none', padding: 0, margin: 0 }}>
          Decision Log
        </h3>
        <button
          className="ob-readiness-toggle"
          onClick={() => sitrep.mutate()}
          disabled={sitrep.isPending}
        >
          {sitrep.isPending ? 'generating...' : 'Generate sitrep'}
        </button>
      </div>

      <div className="ob-decision-form">
        <input
          type="text"
          className="ob-chat-input"
          placeholder="Title (optional)"
          value={draft.title}
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
        />
        <textarea
          className="ob-chat-input"
          placeholder="Decision body. Cite events with [evt:N]."
          rows={3}
          value={draft.body}
          onChange={(e) => setDraft({ ...draft, body: e.target.value })}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
          <button
            className="ob-ingest-btn"
            disabled={!draft.body.trim() || create.isPending}
            onClick={() => create.mutate(draft)}
          >
            {create.isPending ? 'saving...' : 'Append decision'}
          </button>
        </div>
      </div>

      {isLoading && <div className="ob-no-data">loading...</div>}
      {!isLoading && items.length === 0 && (
        <p className="ob-no-data">
          Nothing logged yet. Decisions and sitreps appear here, append-only.
        </p>
      )}

      <ul className="ob-decision-list">
        {items.map((d) => (
          <li key={d.id} className={`ob-decision-item ob-decision-${d.kind}`}>
            <div className="ob-decision-meta">
              <span className="ob-decision-kind">{d.kind}</span>
              <span className="ob-decision-author">{d.author || 'anon'}</span>
              <span className="ob-decision-time">
                {new Date(d.created_at).toLocaleString()}
              </span>
            </div>
            {d.title && <div className="ob-decision-title">{d.title}</div>}
            <div className="ob-decision-body">{d.body}</div>
            {d.citations.length > 0 && (
              <div className="ob-chat-cite-row">
                {d.citations.map((c) => (
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
          </li>
        ))}
      </ul>
    </div>
  );
}
