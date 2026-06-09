import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertsViewV2 } from './AlertsViewV2';
import { logger } from '@/utils/logger';
import type { ActiveFilters, Incident, Signal, AutoDetection } from './types';
import { EMPTY_FILTERS } from './types';
import { toAutoDetections } from './components/autoDetectionUtils';
import { fetchAlerts, fetchAlertsStrict, triggerIngestion } from './services/signalService';
import { fetchIncidentsStrict } from './services/incidentService';
import {
  filtersSignature,
  filtersToSignalQuery,
} from './components/alertFiltersUtils';
import { DISEASE_KEYWORDS } from './constants';
import { useTenant } from '@/hooks/useTenant';

const DISEASE_CODE_TO_NAME: Record<string, string> = DISEASE_KEYWORDS.reduce(
  (acc, d) => {
    acc[d.code] = d.name;
    return acc;
  },
  {} as Record<string, string>,
);

function collectIso3s(signals: Signal[]): string[] {
  const set = new Set<string>();
  for (const s of signals) {
    const iso = s.location?.iso3 ?? s.location?.country_iso;
    if (iso) set.add(iso);
  }
  return Array.from(set);
}

/**
 * Cheap order-sensitive fingerprint of an alert payload. We use
 * id + a "freshness" stamp (updated_at, then ai_classified_at, then
 * created_at) so that re-classification or status changes still bust the
 * cache, but a refresh that returns identical rows in identical order can
 * skip `setAlerts` entirely and avoid invalidating every downstream memo.
 */
function alertsFingerprint(signals: Signal[]): string {
  const parts: string[] = [];
  for (const s of signals) {
    const stamp = s.updated_at ?? s.ai_classified_at ?? s.created_at ?? '';
    parts.push(`${s.id}:${stamp}`);
  }
  return parts.join('|');
}

function isAbortError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const name = (err as { name?: string }).name;
  const code = (err as { code?: string }).code;
  return name === 'CanceledError' || name === 'AbortError' || code === 'ERR_CANCELED';
}

// Proposed in decisions-pending; TASK 9 wires it in at 30s.
export const AUTO_REFRESH_MS = 30_000;

// ── Client-side signal cache ──────────────────────────────────────────────
// Keyed by filter signature → { data, fetchedAt }.  Switching between
// date chips (24h→3d→24h) now returns cached results instantly instead of
// re-fetching 200+ signals each time.  The cache is busted by:
//   1. Ingestion ("Fetch Live" button)
//   2. TTL expiry (5 minutes)
//   3. Auto-refresh (silently updates the cache in-place)
//   4. Tenant switch (super admin switches tenant context)

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CacheEntry {
  signals: Signal[];
  fetchedAt: number;
  fingerprint: string;
}

const signalCache = new Map<string, CacheEntry>();

export default function AlertsPageV2() {
  const [alerts, setAlerts] = useState<Signal[]>([]);
  const [globalDetections, setGlobalDetections] = useState<AutoDetection[]>([]);
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [filters, setFilters] = useState<ActiveFilters>(EMPTY_FILTERS);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  // ISO3 codes of countries with at least one signal for the currently
  // selected disease. `null` = no disease selected (no scoping needed).
  const [availableCountryIso3s, setAvailableCountryIso3s] = useState<string[] | null>(null);

  const { activeTenantId } = useTenant();

  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  // Active controller for the main alerts fetch — aborted whenever a new
  // load is kicked off so out-of-order responses can't clobber state.
  const alertsAbortRef = useRef<AbortController | null>(null);
  // Last payload fingerprint, so a silent auto-refresh that returns
  // identical rows can short-circuit `setAlerts` and avoid invalidating
  // every downstream memo (processed → groups → map markers → popup).
  const alertsFpRef = useRef<string>('');

  // ── Tenant switch: bust all caches and reset state ────────────────────
  // When a super admin switches tenant, the module-level signalCache would
  // serve stale cross-tenant data. Clear it and force a full refetch.
  const prevTenantRef = useRef(activeTenantId);
  useEffect(() => {
    if (prevTenantRef.current !== activeTenantId) {
      prevTenantRef.current = activeTenantId;
      signalCache.clear();
      alertsFpRef.current = '';
      setAlerts([]);
      setIncidents([]);
      setGlobalDetections([]);
      setSelectedAlertId(null);
      setAvailableCountryIso3s(null);
      setError(null);
      logger.info('[alerts-v2] tenant switched, caches cleared');
    }
  }, [activeTenantId]);

  const signature = useMemo(() => filtersSignature(filters), [filters]);

  const loadAlerts = useCallback(async (current: ActiveFilters, opts?: { silent?: boolean; bustCache?: boolean }) => {
    const silent = opts?.silent === true;
    const bustCache = opts?.bustCache === true;

    const cacheKey = filtersSignature(current);

    // ── Cache hit fast-path ────────────────────────────────────────
    if (!bustCache) {
      const cached = signalCache.get(cacheKey);
      if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
        // Serve from cache instantly
        if (cached.fingerprint !== alertsFpRef.current) {
          alertsFpRef.current = cached.fingerprint;
          setAlerts(cached.signals);
        }
        setLastUpdatedAt(new Date(cached.fetchedAt));
        setError(null);
        logger.info('[alerts-v2] cache hit for', cacheKey.slice(0, 40));
        return;
      }
    }

    // ── Cache miss — fetch from API ────────────────────────────────
    alertsAbortRef.current?.abort();
    const controller = new AbortController();
    alertsAbortRef.current = controller;

    if (!silent) setLoading(true);
    try {
      const query = filtersToSignalQuery(current);
      logger.info('[alerts-v2] fetching with query:', query);
      const signals = await fetchAlertsStrict(query, { signal: controller.signal });
      // Race guard — a newer load aborted us between request and response.
      if (controller.signal.aborted) return;

      const fp = alertsFingerprint(signals);

      // Update cache
      signalCache.set(cacheKey, { signals, fetchedAt: Date.now(), fingerprint: fp });

      if (fp !== alertsFpRef.current) {
        alertsFpRef.current = fp;
        setAlerts(signals);
      }
      setLastUpdatedAt(new Date());
      setError(null);
    } catch (err) {
      if (isAbortError(err)) return;
      logger.error('[alerts-v2] loadAlerts error:', err);
      // Only surface the banner when we don't already have data to show —
      // a silent auto-refresh that fails shouldn't wipe out the UI.
      if (!silent) {
        setError(
          err instanceof Error
            ? err.message || 'Failed to load alerts'
            : 'Failed to load alerts',
        );
      }
    } finally {
      if (!silent && alertsAbortRef.current === controller) setLoading(false);
    }
  }, []);

  const loadIncidents = useCallback(async () => {
    try {
      // eslint-disable-next-line no-console
      console.log('[alerts-v2] loadIncidents: calling fetchIncidentsStrict...');
      const rows = await fetchIncidentsStrict();
      // eslint-disable-next-line no-console
      console.log('[alerts-v2] loadIncidents returned', rows.length, 'rows');
      setIncidents(rows);
      return rows.length;
    } catch (err) {
       
      console.error('[alerts-v2] loadIncidents error:', err);
      return 0;
    }
  }, []);

  const loadGlobalDetections = useCallback(async () => {
    try {
      // Fetch recent global signals to find the top priority alert for detections
      const signals = await fetchAlertsStrict({ limit: 50 });
      setGlobalDetections(toAutoDetections(signals));
    } catch (err) {
      logger.error('[alerts-v2] loadGlobalDetections error:', err);
    }
  }, []);

  // Refetch alerts whenever the filter signature changes. filtersRef keeps
  // the effect body reading the *current* filters without re-running on
  // every reference churn.
  useEffect(() => {
    loadAlerts(filtersRef.current);
  }, [signature, loadAlerts]);

  // Load incidents on mount. Retry once after 3s if the first attempt
  // returns 0 — this handles the auth-cookie race on initial page load.
  useEffect(() => {
    loadIncidents().then((count) => {
      if (count === 0) {
        // eslint-disable-next-line no-console
        console.log('[alerts-v2] incidents came back empty, retrying in 3s...');
        const timer = setTimeout(() => loadIncidents(), 3_000);
        return () => clearTimeout(timer);
      }
    });
  }, [loadIncidents]);

  // Keep global AI detections up to date, completely independent of UI filters
  useEffect(() => {
    loadGlobalDetections();
    const id = window.setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      loadGlobalDetections();
    }, AUTO_REFRESH_MS);
    return () => window.clearInterval(id);
  }, [loadGlobalDetections]);

  // Discover which countries have signals for the selected disease, so the
  // country dropdown can be narrowed.
  //
  // Fast path: when no country is selected, the main `alerts` fetch is
  // already disease-narrowed only — derive the iso3 set straight from it
  // and skip the extra round-trip. This is the common case (disease picked
  // before country).
  //
  // Slow path: when a country IS selected, the main fetch is also
  // country-narrowed, so it can't tell us which *other* countries have data
  // for this disease. Fall back to a dedicated fetch with disease-only.
  const diseaseKey = filters.diseases.join(',');
  const hasCountryFilter = filters.countries.length > 0;

  useEffect(() => {
    if (!diseaseKey) {
      setAvailableCountryIso3s(null);
      return;
    }
    if (hasCountryFilter) return; // slow path handled by the next effect

    const iso3s = collectIso3s(alerts);
    setAvailableCountryIso3s(iso3s);
  }, [diseaseKey, hasCountryFilter, alerts]);

  useEffect(() => {
    if (!diseaseKey || !hasCountryFilter) return;
    const controller = new AbortController();
    const diseaseNames = diseaseKey
      .split(',')
      .map((code) => DISEASE_CODE_TO_NAME[code] ?? code);
    fetchAlerts({ disease: diseaseNames }, { signal: controller.signal }).then((signals) => {
      if (controller.signal.aborted) return;
      setAvailableCountryIso3s(collectIso3s(signals));
    });
    return () => {
      controller.abort();
    };
  }, [diseaseKey, hasCountryFilter]);

  // Auto-refresh alerts every 30s.  Busts the cache so the stored entry
  // gets silently updated in the background — the next filter-switch will
  // serve the freshest data without a network round-trip.
  useEffect(() => {
    const id = window.setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      loadAlerts(filtersRef.current, { silent: true, bustCache: true });
    }, AUTO_REFRESH_MS);
    return () => window.clearInterval(id);
  }, [loadAlerts]);

  // "Fetch Live" triggers actual ingestion from GDELT / WHO News /
  // AllAfrica / ReliefWeb, then re-fetches the signal list.
  // Ingestion runs in a background thread on the server (~15s total),
  // so we schedule two re-fetches: one at 3s (fast sources) and one
  // at 18s (all sources finished).
  // We clear the entire cache because new signals may affect every filter
  // combination.
  const handleFetchLive = useCallback(async () => {
    setLoading(true);
    const result = await triggerIngestion();
    logger.info('[alerts-v2] ingestion triggered:', result);

    // Clear all cached results — new signals invalidate every filter combo
    signalCache.clear();

    // First re-fetch after 3s — picks up fast sources (WHO RSS, AllAfrica)
    setTimeout(() => {
      loadAlerts(filtersRef.current, { silent: true, bustCache: true });
    }, 3_000);

    // Second re-fetch after 18s — picks up GDELT (has rate-limit sleeps)
    setTimeout(() => {
      loadAlerts(filtersRef.current, { silent: true, bustCache: true });
      setLoading(false);
    }, 18_000);
  }, [loadAlerts]);

  return (
    <AlertsViewV2
      alerts={alerts}
      globalDetections={globalDetections}
      selectedAlertId={selectedAlertId}
      incidents={incidents}
      filters={filters}
      loading={loading}
      error={error}
      lastUpdatedAt={lastUpdatedAt}
      availableCountryIso3s={availableCountryIso3s}
      onSelectAlert={setSelectedAlertId}
      onFiltersChange={setFilters}
      onRetry={() => loadAlerts(filtersRef.current)}
      onRefresh={handleFetchLive}
    />
  );
}
