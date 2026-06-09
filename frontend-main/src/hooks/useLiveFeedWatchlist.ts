import type { DashboardResponse } from "@/types/liveFeed";
import { useState, useEffect, useCallback, useRef } from "react";
import { fetchRegionalSignals } from "@/pages/alerts/services/azureService";
import { fetchAutoDetections } from "@/pages/alerts/services/backendService";
import { useAuth } from "@/contexts/AuthProvider";
import { logger } from "@/utils/logger";
import {
  getCachedSignals,
  getFreshnessStatus,
  getCacheAgeLabel,
  type FreshnessStatus,
} from "@/utils/signalCacheManager";

interface RawSignal {
  source_timestamp?: string | number | Date;
  publishedAt?: string | number | Date;
  created_at?: string | number | Date;
  disease_name?: string;
  headline?: string;
  original_text?: string;
  hazard?: { name?: string };
  title?: string;
  source?: { name?: string };
  sources?: Array<{ name?: string }>;
  source_name?: string;
  human_readable_time?: string;
  timeAgo?: string;
  priority?: string;
  level?: string;
  summary?: string;
  signal_type?: string;
  lingua_data?: {
    original_text?: string;
    translated_text?: string;
    original_language?: string;
  };
  translated_text?: string;
  original_language?: string;
  reported_cases?: number;
  reported_deaths?: number;
  epidemiology?: { suspected_cases?: number; deaths?: number };
  location?: { country?: string; iso3?: string; country_iso?: string; name?: string };
}

// Working type for the per-country accumulator. We use 'stable' as a placeholder
// while building, then cast to WatchItem at the return — the existing UI
// tolerates this since it only inspects `bars`/`value`/`country`.
interface WatchlistEntry {
  country: string;
  metric: string;
  value: number;
  change: number;
  trend: 'up' | 'down' | 'stable';
  bars: number[];
}

/**
 * Build a DashboardResponse from raw signals array.
 * Shared by both fresh-fetch and cache-restore paths.
 */
function buildDashboardResponse(signals: RawSignal[]): DashboardResponse {
  const liveFeed = [...signals]
    .sort((a, b) => {
      const getTime = (s: RawSignal) => new Date(s.source_timestamp || s.publishedAt || s.created_at || 0).getTime();
      return getTime(b) - getTime(a);
    })
    .slice(0, 100)
    .map((signal: RawSignal) => {
      const country = signal.location?.country || 'Unknown Location';

      let name = '';
      if (signal.disease_name && signal.disease_name !== 'unknown') {
        name = signal.disease_name;
      } else if (signal.headline && signal.headline !== 'Signal' && signal.headline.length > 5) {
        name = signal.headline.length > 80 ? signal.headline.substring(0, 77) + '...' : signal.headline;
      } else if (signal.original_text && signal.original_text.length > 5) {
        name = signal.original_text.length > 80 ? signal.original_text.substring(0, 77) + '...' : signal.original_text;
      } else if (signal.hazard?.name && signal.hazard.name !== 'hazard') {
        name = signal.hazard.name;
      } else if (signal.title) {
        name = signal.title;
      } else {
        name = `${signal.signal_type || 'Health'} Signal - ${country}`;
      }

      const title = name;
      const source = signal.source?.name || signal.sources?.[0]?.name || signal.source_name || 'AFRO Sentinel';

      // Compute accurate relative time from actual timestamp
      let timeAgo = signal.human_readable_time || signal.timeAgo || '';
      if (!timeAgo || timeAgo === 'Just now') {
        const ts = signal.source_timestamp || signal.publishedAt || signal.created_at;
        if (ts) {
          const diffMs = Date.now() - new Date(ts).getTime();
          if (diffMs < 60000) timeAgo = `${Math.floor(diffMs / 1000)}s ago`;
          else if (diffMs < 3600000) timeAgo = `${Math.floor(diffMs / 60000)}m ago`;
          else if (diffMs < 86400000) timeAgo = `${Math.floor(diffMs / 3600000)}h ago`;
          else timeAgo = `${Math.floor(diffMs / 86400000)}d ago`;
        } else {
          timeAgo = 'Unknown';
        }
      }
      const priority = signal.priority || signal.level || 'P4';

      return {
        title,
        source,
        timeAgo,
        progress: [0, 0, 0, 0, 0],
        country,
        headline: title,
        priority,
        summary: signal.summary || '',
        original_text: signal.original_text || signal.lingua_data?.original_text || '',
        translated_text: signal.translated_text || signal.lingua_data?.translated_text || '',
        original_language: signal.original_language || signal.lingua_data?.original_language || 'en',
        reported_cases: signal.reported_cases || signal.epidemiology?.suspected_cases || 0,
        reported_deaths: signal.reported_deaths || signal.epidemiology?.deaths || 0,
        iso3: signal.location?.iso3 || signal.location?.country_iso || '',
        country_iso: signal.location?.country_iso || signal.location?.iso3 || '',
        original_signal: signal
      };
    });

  const countryMap = new Map<string, WatchlistEntry>();
  signals.forEach((signal: RawSignal) => {
    const country = signal.location?.country || signal.location?.name || 'Unknown';
    if (!countryMap.has(country) && country !== 'Unknown') {
      countryMap.set(country, {
        country,
        metric: 'Active Signals',
        value: 0,
        change: 0,
        trend: 'stable',
        bars: [0, 0, 0, 0, 0, 0],
      });
    }
    const existing = countryMap.get(country);
    if (existing) {
      existing.value++;
    }
  });

  const watchlist = Array.from(countryMap.values()).slice(0, 4);

  return {
    liveFeed: liveFeed.length > 0 ? liveFeed : [{
      title: "AFRO Regional Surveillance Active",
      source: "WHO",
      timeAgo: "Live",
      progress: [80, 40, 60, 20, 90],
      country: "AFRO Region",
      headline: "AFRO Regional Surveillance Active",
      priority: "P4"
    }],
    watchlist: (watchlist.length > 0 ? watchlist : [
      {
        country: "AFRO Region",
        metric: "Active Signals",
        value: signals.length,
        change: 0,
        trend: "stable" as const,
        bars: [0, 0, 0, 0, 0, 0],
      },
    ]) as DashboardResponse['watchlist'],
  };
}

export function fetchDashboardData(): Promise<DashboardResponse> {
  return new Promise(async (resolve) => {
    try {
      const [signals, detections] = await Promise.all([
        fetchRegionalSignals().catch(() => []),
        fetchAutoDetections().catch(() => [])
      ]);

      logger.log('LiveFeedWatchlist - Raw signals:', signals.length);
      resolve(buildDashboardResponse(signals));
    } catch (error) {
      logger.error('fetchDashboardData error:', error);
      resolve({
        liveFeed: [{
          title: "Connecting to AFRO Sentinel...",
          source: "System",
          timeAgo: "Now",
          progress: [0, 0, 0, 0, 0],
          country: "System",
          headline: "Connecting to AFRO Sentinel...",
          priority: "P4"
        }],
        watchlist: [],
      });
    }
  });
}

export default function useLiveFeedWatchlist() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  const [forceUpdate, setForceUpdate] = useState(0);
  const [freshness, setFreshness] = useState<FreshnessStatus>('offline');
  const [cacheAgeLabel, setCacheAgeLabel] = useState<string>('');
  const initialLoadDone = useRef(false);
  const dataRef = useRef<DashboardResponse | null>(null);

  // Keep ref in sync with state (avoids stale closure in error handler)
  useEffect(() => { dataRef.current = data; }, [data]);

  // Step 1: On mount, instantly load from localStorage cache (never empty)
  useEffect(() => {
    if (initialLoadDone.current) return;
    initialLoadDone.current = true;

    const cachedSignals = getCachedSignals();
    if (cachedSignals.length > 0) {
      const cachedResponse = buildDashboardResponse(cachedSignals);
      setData(cachedResponse);
      setLoading(false);
      setFreshness(getFreshnessStatus());
      setCacheAgeLabel(getCacheAgeLabel());
      logger.log('LiveFeed: Loaded', cachedSignals.length, 'signals from cache');
    }
  }, []);

  // Step 2: Background refresh — fetches fresh data and updates silently
  const refreshData = useCallback(() => {
    if (!user || user.role === 'supplier') {
      setLoading(false);
      return;
    }

    // Skip polling when tab is not visible
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      return;
    }

    setForceUpdate(prev => prev + 1);

    fetchDashboardData()
      .then((res: DashboardResponse) => {
        setData(res);
        setLoading(false);
        setError("");
        setFreshness(getFreshnessStatus());
        setCacheAgeLabel(getCacheAgeLabel());
      })
      .catch((err) => {
        logger.error("Failed to load dashboard data:", err);
        // Only set error if we have NO cached data at all (use ref for fresh value)
        if (!dataRef.current) {
          setError("Failed to load data");
        }
        setLoading(false);
        setFreshness(getFreshnessStatus());
        setCacheAgeLabel(getCacheAgeLabel());
      });
  }, [user]);  // data removed — prevents interval recreation on every fetch

  useEffect(() => {
    refreshData();

    // Poll every 15 seconds — real-time feed
    const interval = setInterval(refreshData, 15000);
    return () => clearInterval(interval);
  }, [refreshData]);

  return { data, loading, error, refreshData, forceUpdate, freshness, cacheAgeLabel };
}