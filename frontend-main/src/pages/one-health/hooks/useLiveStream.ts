/**
 * useLiveStream — SSE hook for real-time dashboard updates
 * Replaces the 120s polling with 5s server-push via EventSource.
 * Ported from TRIAD_React.jsx → TypeScript.
 */
import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthProvider";

export interface LiveFrame {
  ts: string | null;
  kpis: Record<string, number> | null;
  alerts: any[] | null;
  agents: any[] | null; // OHAgent[] when populated
  hitl: any[] | null;   // OHHITLAction[] when populated
  error: string | null;
}

const API_BASE = `${import.meta.env.VITE_API_BASE_URL || ""}/onehealth`;

export function useLiveStream(): LiveFrame {
  const [data, setData] = useState<LiveFrame>({
    ts: null, kpis: null, alerts: null, agents: null, hitl: null, error: null,
  });
  const { user } = useAuth();
  const esRef = useRef<EventSource | null>(null);
  const retryRef = useRef(0);

  useEffect(() => {
    let cancelled = false;

    const connect = () => {
      if (cancelled) return;
      try {
        // Auth is handled via httpOnly cookies (withCredentials: true).
        // EventSource cannot send custom headers, but cookies are
        // attached automatically by the browser.
        const url = `${API_BASE}/stream/live`;
        
        const es = new EventSource(url, { withCredentials: true });
        esRef.current = es;

        es.onmessage = (e) => {
          try {
            const frame = JSON.parse(e.data);
            setData((prev) => ({ ...prev, ...frame }));
            retryRef.current = 0;
          } catch {
            // malformed frame — ignore, keep stream
          }
        };

        es.onerror = () => {
          es.close();
          esRef.current = null;
          if (cancelled) return;
          // Exponential backoff: 1s → 2s → 4s → 8s → cap 15s
          retryRef.current = Math.min(retryRef.current + 1, 5);
          const delay = Math.min(15000, 1000 * 2 ** (retryRef.current - 1));
          setData((prev) => ({ ...prev, error: "reconnecting" }));
          setTimeout(connect, delay);
        };
      } catch (err) {
        setData((prev) => ({ ...prev, error: String(err) }));
      }
    };

    connect();
    return () => {
      cancelled = true;
      if (esRef.current) esRef.current.close();
    };
  }, []);

  return data;
}
