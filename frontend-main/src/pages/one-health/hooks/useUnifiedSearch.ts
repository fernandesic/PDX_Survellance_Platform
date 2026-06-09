/**
 * useUnifiedSearch — Debounced multi-entity search hook
 * Hits /api/v1/onehealth/search with 120ms debounce and race-guard.
 * Ported from TRIAD_React.jsx → TypeScript.
 */
import { useState, useEffect, useRef } from "react";
import { apiGet } from "@/lib/api";

export interface SearchResult {
  type: "country" | "disease" | "alert" | "agent";
  id: string;
  label: string;
  sub: string;
  extra?: Record<string, any>;
  score: number;
}

export interface SearchState {
  results: SearchResult[];
  loading: boolean;
  took_ms: number;
  total: number;
  error?: string;
}

interface SearchOptions {
  limit?: number;
  types?: string;
}

export function useUnifiedSearch(
  query: string,
  options: SearchOptions = {}
): SearchState {
  const { limit = 8, types } = options;
  const [state, setState] = useState<SearchState>({
    results: [], loading: false, took_ms: 0, total: 0,
  });
  const debRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seqRef = useRef(0); // race-guard: drop stale responses

  useEffect(() => {
    if (debRef.current) clearTimeout(debRef.current);
    if (!query || query.length < 1) {
      setState({ results: [], loading: false, took_ms: 0, total: 0 });
      return;
    }

    setState((s) => ({ ...s, loading: true }));
    const mySeq = ++seqRef.current;

    // 120ms debounce — feels instant, prevents request flood while typing
    debRef.current = setTimeout(async () => {
      let qs = `?q=${encodeURIComponent(query)}&limit=${limit}`;
      if (types) qs += `&types=${types}`;

      try {
        const data = await apiGet<{
          results: SearchResult[];
          total: number;
          took_ms: number;
        }>(`/onehealth/search${qs}`);
        if (mySeq !== seqRef.current) return; // stale, ignore
        setState({
          results: data?.results || [],
          loading: false,
          took_ms: data?.took_ms || 0,
          total: data?.total || 0,
        });
      } catch (err) {
        if (mySeq !== seqRef.current) return;
        setState({
          results: [], loading: false, took_ms: 0, total: 0,
          error: String(err),
        });
      }
    }, 120);

    return () => {
      if (debRef.current) clearTimeout(debRef.current);
    };
  }, [query, limit, types]);

  return state;
}
