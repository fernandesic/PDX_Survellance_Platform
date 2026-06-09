/**
 * useOutbreakStream — SSE subscription to /outbreak/<id>/stream/ (T-025).
 *
 * Pushes new events into the existing `outbreak-events` TanStack query
 * cache so the feed updates without a refetch round-trip. EventSource is
 * created/torn down per id.
 */

import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { OutbreakEvent } from '../services/outbreakApi';
import { outbreakStreamUrl } from '../services/outbreakApi';

export interface StreamState {
  connected: boolean;
  lastEventAt: string | null;
  error: string | null;
}

export function useOutbreakStream(outbreakId: number | undefined): StreamState {
  const qc = useQueryClient();
  const [state, setState] = useState<StreamState>({
    connected: false,
    lastEventAt: null,
    error: null,
  });
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!outbreakId) return;
    const url = outbreakStreamUrl(outbreakId);
    const es = new EventSource(url, { withCredentials: true });
    esRef.current = es;

    es.onopen = () => setState((s) => ({ ...s, connected: true, error: null }));
    es.onerror = () => setState((s) => ({ ...s, connected: false, error: 'connection lost' }));
    es.onmessage = (msg) => {
      try {
        const event = JSON.parse(msg.data) as OutbreakEvent;
        setState((s) => ({ ...s, lastEventAt: new Date().toISOString() }));
        qc.setQueryData<OutbreakEvent[] | undefined>(
          ['outbreak-events', outbreakId],
          (prev) => {
            if (!prev) return [event];
            if (prev.some((e) => e.id === event.id)) return prev;
            return [event, ...prev].slice(0, 300);
          },
        );
      } catch {
        // ignore non-JSON heartbeats
      }
    };

    return () => {
      es.close();
      esRef.current = null;
      setState({ connected: false, lastEventAt: null, error: null });
    };
  }, [outbreakId, qc]);

  return state;
}
