import { useEffect, useRef, useState } from 'react';
import { fetchAgentActivity } from '../../services/signalService';
import type { AgentStep } from './AgentConsole.types';

const POLL_INTERVAL_MS = 5000;
const MAX_STEPS = 100;

/**
 * Polls /agent/activity/?since=<ts>[&country=<iso3>] every 5s and emits real
 * AgentStep rows from the database. Skips ticks while the tab is hidden.
 *
 * Pass an ISO3 country code to scope the stream to one country (e.g. when
 * the user has clicked a country on the map). Changing the country resets
 * the buffer and the since-cursor.
 */
export function useAgentStream(country: string | null = null): AgentStep[] {
  const [steps, setSteps] = useState<AgentStep[]>([]);
  const latestCreatedAtRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    // Country switch — start fresh so old country's lines don't linger.
    latestCreatedAtRef.current = undefined;
    setSteps([]);

    let cancelled = false;

    const poll = async () => {
      if (typeof document !== 'undefined' && document.hidden) return;
      try {
        const newSteps = await fetchAgentActivity(
          latestCreatedAtRef.current,
          country ?? undefined,
        );
        if (cancelled || newSteps.length === 0) return;

        // Server returns newest-first; newest created_at = first item
        latestCreatedAtRef.current = newSteps[0].created_at;

        setSteps((prev) => [...newSteps, ...prev].slice(0, MAX_STEPS));
      } catch {
        // Silent — polling failures don't alarm the UI
      }
    };

    poll();
    const handle = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(handle);
    };
  }, [country]);

  return steps;
}
