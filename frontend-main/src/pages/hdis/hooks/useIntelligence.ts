/**
 * HDIS-PRO — React Query hooks calling Django HDIS REST APIs.
 * Replaces the Supabase hooks in the original HDIS module.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ApiConsumer } from "@/lib/api";
import type {
  IntelRecord,
  IntelRecordDetail,
  Alert,
  Briefing,
  GenerationStatus,
  IntelSource,
  DashboardStats,
  RecordFilters,
  CountryIntelligence,
  CountryDetail,
} from "@/pages/hdis/types";

const HDIS_BASE = "/hdis";
const REFRESH_INTERVAL = 2 * 60 * 1000; // 2 minutes

// ─── Intel Records (Signals + Trust) ─────────────────────────────────

export function useIntelRecords(filters?: RecordFilters) {
  return useQuery({
    queryKey: ["hdis-pro-records", filters],
    queryFn: () =>
      ApiConsumer.get<IntelRecord[]>(`${HDIS_BASE}/records/`, {
        params: {
          risk_level: filters?.risk_level || undefined,
          event_type: filters?.event_type || undefined,
          country_tag: filters?.country_tag || undefined,
          trust_level: filters?.trust_level || undefined,
          status: filters?.status || undefined,
          q: filters?.q || undefined,
          pillar: filters?.pillar || undefined,
        },
      }),
    refetchInterval: REFRESH_INTERVAL,
  });
}

export function useIntelRecord(id: string | number) {
  return useQuery({
    queryKey: ["hdis-pro-record", id],
    queryFn: () =>
      ApiConsumer.get<IntelRecordDetail>(`${HDIS_BASE}/records/${id}/`),
    enabled: !!id,
  });
}

// ─── Alerts ──────────────────────────────────────────────────────────

export function useAlerts(options?: { acknowledged?: boolean }) {
  return useQuery({
    queryKey: ["hdis-pro-alerts", options],
    queryFn: () =>
      ApiConsumer.get<Alert[]>(`${HDIS_BASE}/alerts/`, {
        params: {
          acknowledged:
            options?.acknowledged === undefined
              ? undefined
              : options.acknowledged
              ? "true"
              : "false",
        },
      }),
    refetchInterval: REFRESH_INTERVAL,
  });
}

// ─── Sources ─────────────────────────────────────────────────────────

export function useSources() {
  return useQuery({
    queryKey: ["hdis-pro-sources"],
    queryFn: () => ApiConsumer.get<IntelSource[]>(`${HDIS_BASE}/sources/`),
  });
}

// ─── Briefings ───────────────────────────────────────────────────────

export function useBriefings() {
  return useQuery({
    queryKey: ["hdis-pro-briefings"],
    queryFn: () => ApiConsumer.get<Briefing[]>(`${HDIS_BASE}/briefings/`),
    refetchInterval: REFRESH_INTERVAL,
  });
}

export function useBriefing(id: number) {
  return useQuery({
    queryKey: ["hdis-pro-briefing", id],
    queryFn: () => ApiConsumer.get<Briefing>(`${HDIS_BASE}/briefings/${id}/`),
    enabled: !!id,
  });
}

// ─── Briefing Generation ─────────────────────────────────────────────

interface GenerateParams {
  scope?: "daily_global" | "country_focus" | "crisis_alert";
  country_iso?: string;
  hours_back?: number;
}

export function useGenerateBriefing() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: GenerateParams = {}) =>
      ApiConsumer.post<{ status: string; message: string }>(
        `${HDIS_BASE}/briefings/generate/`,
        params,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hdis-pro-briefings"] });
      queryClient.invalidateQueries({ queryKey: ["hdis-pro-generation-status"] });
    },
  });
}

export function useGenerationStatus(enabled = false) {
  return useQuery({
    queryKey: ["hdis-pro-generation-status"],
    queryFn: () =>
      ApiConsumer.get<GenerationStatus>(`${HDIS_BASE}/briefings/generation_status/`),
    refetchInterval: enabled ? 2000 : false,
    enabled,
  });
}

export function usePublishBriefing() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      ApiConsumer.post<Briefing>(`${HDIS_BASE}/briefings/${id}/publish/`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["hdis-pro-briefings"] });
    },
  });
}

// ─── Dashboard Stats ─────────────────────────────────────────────────

export function useDashboardStats() {
  return useQuery({
    queryKey: ["hdis-pro-stats"],
    queryFn: () =>
      ApiConsumer.get<DashboardStats>(`${HDIS_BASE}/records/stats/`),
    refetchInterval: REFRESH_INTERVAL,
  });
}

// ─── Country Intelligence ────────────────────────────────────────────

export function useCountries() {
  return useQuery({
    queryKey: ["hdis-pro-countries"],
    queryFn: () =>
      ApiConsumer.get<CountryIntelligence[]>(`${HDIS_BASE}/records/countries/`),
    refetchInterval: REFRESH_INTERVAL,
  });
}

export function useCountryDetail(countryIso: string) {
  return useQuery({
    queryKey: ["hdis-pro-country", countryIso],
    queryFn: () =>
      ApiConsumer.get<CountryDetail>(`${HDIS_BASE}/records/countries/${countryIso}/`),
    enabled: !!countryIso,
  });
}

// ─── Manual Refresh ──────────────────────────────────────────────────

interface RefreshResult {
  status: string;
  sources_processed: number;
  signals_fetched: number;
  signals_ingested: number;
  duplicates_skipped: number;
  trust_scores_updated: number;
  alerts_created: number;
  refreshed_at: string;
}

export function useRefresh() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => ApiConsumer.post<RefreshResult>(`${HDIS_BASE}/refresh/`),
    onSuccess: () => {
      // Invalidate ALL hdis-pro queries so dashboard refreshes
      queryClient.invalidateQueries({ queryKey: ["hdis-pro-records"] });
      queryClient.invalidateQueries({ queryKey: ["hdis-pro-stats"] });
      queryClient.invalidateQueries({ queryKey: ["hdis-pro-countries"] });
      queryClient.invalidateQueries({ queryKey: ["hdis-pro-alerts"] });
      queryClient.invalidateQueries({ queryKey: ["hdis-pro-sources"] });
      queryClient.invalidateQueries({ queryKey: ["hdis-pro-briefings"] });
    },
  });
}

export function useRefreshStatus() {
  return useQuery({
    queryKey: ["hdis-pro-refresh-status"],
    queryFn: () => ApiConsumer.get<{
      is_running: boolean;
      last_refresh_at: string | null;
      last_result: RefreshResult | null;
      progress: string;
    }>(`${HDIS_BASE}/refresh/status/`),
    refetchInterval: 5000, // Poll every 5s while visible
  });
}

// ─── Auto Refresh ────────────────────────────────────────────────────
// Automatically triggers ingestion when data is stale.
// Stale = last refresh > STALE_THRESHOLD_MS ago (default 30 min).

const STALE_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes
const AUTO_REFRESH_INTERVAL_MS = 30 * 60 * 1000; // Re-check every 30 min

export function useAutoRefresh() {
  const { data: status } = useRefreshStatus();
  const refresh = useRefresh();
  const triggeredRef = { current: false };

  // Check staleness and trigger on mount + interval
  const checkAndRefresh = () => {
    // Don't trigger if already running or already triggered this cycle
    if (refresh.isPending || status?.is_running) return;

    const lastRefresh = status?.last_refresh_at;
    const isStale = !lastRefresh ||
      (Date.now() - new Date(lastRefresh).getTime()) > STALE_THRESHOLD_MS;

    if (isStale && !triggeredRef.current) {
      triggeredRef.current = true;
      refresh.mutate(undefined, {
        onSettled: () => {
          // Reset trigger flag after settling so next interval can fire
          setTimeout(() => { triggeredRef.current = false; }, AUTO_REFRESH_INTERVAL_MS);
        },
      });
    }
  };

  return { checkAndRefresh, status, refresh };
}
