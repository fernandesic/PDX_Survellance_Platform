/**
 * Ghana PDX — React Query Data Hook
 *
 * Central data hook for the Ghana dashboard.  Each module gets its own
 * query key so tabs load independently and cache separately.
 *
 * Usage:
 *   const { overview, ihr, chw, ... } = useGhanaData();
 *   overview.data   // typed data
 *   overview.isLoading
 *   overview.error
 */

import { useQuery } from '@tanstack/react-query';
import {
  // NOTE: getGhanaOverview was removed — the global /account/overview endpoint
  // returns continent-wide aggregates and was masking Ghana-specific signal.
  // Each KPI now sources from its own scoped query (CHW summary, IHR, etc.).
  getGhanaIHR,
  getGhanaCHWSummary,
  getGhanaCHWDetail,
  getGhanaCHWWorkerTypes,
  getGhanaReadiness,
  getGhanaReadinessOverall,
  getGhanaActiveHazards,
  getGhanaUpcomingHazards,
  getGhanaStarList,
  getGhanaAlerts,
  getGhanaPredictions,
  getGhanaPredictionsSummary,
  getGhanaCountryForecast,
  getGhanaCountryDetail,
  getGhanaInterventionPlan,
  getGhanaIHMREF,
  getGhanaIHMREFSummary,
  getGhanaHazardMonitor,
} from '../services/ghanaService';

/* ── Query key namespace ── */
const GQ = 'ghana_pdx';

const STALE_5_MIN = 5 * 60 * 1000;

/* ─────────────────────────────────────────────────────────────────
 *  Individual hooks — one per module
 * ───────────────────────────────────────────────────────────────── */

/** IHR / ESPAR capacities */
export function useGhanaIHR(year: string, enabled = true) {
  return useQuery({
    queryKey: [GQ, 'ihr', year],
    queryFn: () => getGhanaIHR(year),
    staleTime: STALE_5_MIN,
    enabled: enabled && !!year,
  });
}

/** CHW summary (find Ghana country entry) */
export function useGhanaCHWSummary(enabled = true) {
  return useQuery({
    queryKey: [GQ, 'chw', 'summary'],
    queryFn: getGhanaCHWSummary,
    staleTime: STALE_5_MIN,
    enabled,
  });
}

/** CHW country detail (regions, totals) — needs the Ghana country id */
export function useGhanaCHWDetail(ghanaCountryId: number | undefined, enabled = true) {
  return useQuery({
    queryKey: [GQ, 'chw', 'detail', ghanaCountryId],
    queryFn: () => getGhanaCHWDetail(ghanaCountryId!),
    staleTime: STALE_5_MIN,
    enabled: enabled && !!ghanaCountryId,
  });
}

/** CHW worker types breakdown */
export function useGhanaCHWWorkerTypes(ghanaCountryId: number | undefined, enabled = true) {
  return useQuery({
    queryKey: [GQ, 'chw', 'workerTypes', ghanaCountryId],
    queryFn: () => getGhanaCHWWorkerTypes(ghanaCountryId!),
    staleTime: STALE_5_MIN,
    enabled: enabled && !!ghanaCountryId,
  });
}

/** Readiness scores by tab category */
export function useGhanaReadiness(tab: string, page = 1, enabled = true) {
  return useQuery({
    queryKey: [GQ, 'readiness', tab, page],
    queryFn: () => getGhanaReadiness(tab, page),
    staleTime: STALE_5_MIN,
    enabled: enabled && !!tab,
  });
}

/** Ghana-scoped readiness completion (aggregated across all hazard types) */
export function useGhanaReadinessOverall(enabled = true) {
  return useQuery({
    queryKey: [GQ, 'readiness', 'overall'],
    queryFn: getGhanaReadinessOverall,
    staleTime: STALE_5_MIN,
    enabled,
  });
}

/** Hazard monitor */
export function useGhanaHazardMonitor(enabled = true) {
  return useQuery({
    queryKey: [GQ, 'hazardMonitor'],
    queryFn: getGhanaHazardMonitor,
    staleTime: STALE_5_MIN,
    enabled,
  });
}

/** STAR Tracker — active hazards */
export function useGhanaActiveHazards(month?: string, enabled = true) {
  return useQuery({
    queryKey: [GQ, 'star', 'active', month],
    queryFn: () => getGhanaActiveHazards(month),
    staleTime: STALE_5_MIN,
    enabled,
  });
}

/** STAR Tracker — upcoming hazards */
export function useGhanaUpcomingHazards(month?: string, enabled = true) {
  return useQuery({
    queryKey: [GQ, 'star', 'upcoming', month],
    queryFn: () => getGhanaUpcomingHazards(month),
    staleTime: STALE_5_MIN,
    enabled,
  });
}

/** STAR Tracker — paginated hazard list */
export function useGhanaStarList(
  page = 1,
  pageSize = 20,
  severity?: string,
  month?: string,
  enabled = true,
) {
  return useQuery({
    queryKey: [GQ, 'star', 'list', page, pageSize, severity, month],
    queryFn: () => getGhanaStarList(page, pageSize, severity, month),
    staleTime: STALE_5_MIN,
    enabled,
  });
}

/** Sentinel alerts for Ghana */
export function useGhanaAlerts(
  filters?: { priority?: string; status?: string; disease?: string },
  enabled = true,
) {
  return useQuery({
    queryKey: [GQ, 'alerts', filters],
    queryFn: () => getGhanaAlerts(filters),
    staleTime: 30_000, // 30 s — alerts need fresher data
    enabled,
  });
}

/** Predictions — list for Ghana */
export function useGhanaPredictions(enabled = true) {
  return useQuery({
    queryKey: [GQ, 'predictions', 'list'],
    queryFn: getGhanaPredictions,
    staleTime: STALE_5_MIN,
    enabled,
  });
}

/** Predictions — summary KPIs */
export function useGhanaPredictionsSummary(enabled = true) {
  return useQuery({
    queryKey: [GQ, 'predictions', 'summary'],
    queryFn: getGhanaPredictionsSummary,
    staleTime: STALE_5_MIN,
    enabled,
  });
}

/** Predictions — country forecast (ML model)
 *  Note: backend `COUNTRY_FORECAST_CONFIG` only ships data for COD and MOZ
 *  today, so this hook will resolve to a 404 for GHA. We intentionally do
 *  NOT retry on 404 — that would just hammer the API for data we know is absent.
 */
export function useGhanaCountryForecast(enabled = true) {
  return useQuery({
    queryKey: [GQ, 'predictions', 'forecast'],
    queryFn: getGhanaCountryForecast,
    staleTime: STALE_5_MIN,
    enabled,
    retry: (failureCount, error: any) => {
      const status = error?.response?.status ?? error?.status;
      if (status === 404) return false;
      return failureCount < 2;
    },
  });
}

/** Predictions — country detail */
export function useGhanaCountryPredictionDetail(enabled = true) {
  return useQuery({
    queryKey: [GQ, 'predictions', 'detail'],
    queryFn: getGhanaCountryDetail,
    staleTime: STALE_5_MIN,
    enabled,
  });
}

/** Predictions — intervention plan
 *  Same caveat as useGhanaCountryForecast: backend only ships MOZ/COD today.
 */
export function useGhanaInterventionPlan(enabled = true) {
  return useQuery({
    queryKey: [GQ, 'predictions', 'intervention'],
    queryFn: getGhanaInterventionPlan,
    staleTime: STALE_5_MIN,
    enabled,
    retry: (failureCount, error: any) => {
      const status = error?.response?.status ?? error?.status;
      if (status === 404) return false;
      return failureCount < 2;
    },
  });
}

/** IHMREF — country incidents */
export function useGhanaIHMREF(enabled = true) {
  return useQuery({
    queryKey: [GQ, 'ihmref', 'incidents'],
    queryFn: getGhanaIHMREF,
    staleTime: STALE_5_MIN,
    enabled,
  });
}

/** IHMREF — global summary (for context) */
export function useGhanaIHMREFSummary(enabled = true) {
  return useQuery({
    queryKey: [GQ, 'ihmref', 'summary'],
    queryFn: getGhanaIHMREFSummary,
    staleTime: STALE_5_MIN,
    enabled,
  });
}


/* ─────────────────────────────────────────────────────────────────
 *  Composite hook — convenience for the GhanaPdxPage container
 * ───────────────────────────────────────────────────────────────── */

export function useGhanaData(activeTab: string) {
  const ihr          = useGhanaIHR('2024', activeTab === 'ihr');
  const chwSummary   = useGhanaCHWSummary(activeTab === 'chw' || activeTab === 'overview');
  const alerts       = useGhanaAlerts(undefined, activeTab === 'alerts' || activeTab === 'overview');
  const predictions  = useGhanaPredictions(activeTab === 'predictions');
  const predSummary  = useGhanaPredictionsSummary(activeTab === 'predictions' || activeTab === 'overview');
  const ihmrefData   = useGhanaIHMREF(activeTab === 'ihmref');

  return {
    ihr,
    chwSummary,
    alerts,
    predictions,
    predSummary,
    ihmrefData,
  };
}
