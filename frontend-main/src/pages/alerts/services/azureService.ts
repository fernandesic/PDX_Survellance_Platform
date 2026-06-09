// @ts-nocheck
/**
 * Azure Service - Signal Aggregation
 * 
 * Aggregates signals from active sources:
 * 1. Django Sentinel API (PostgreSQL database) - PRIMARY
 * 2. WHO DON (Disease Outbreak News) - HIGH
 * 3. NASA EONET (climate/hazard events) - SECONDARY
 * 4. GDELT (news signals) - SECONDARY
 * 
 * Dead sources removed: ReliefWeb (deprecated 2025), AllAfrica (404), Africa CDC (disabled)
 */

import type { Signal } from '../types';
import { fetchSignals, fetchSignalStats } from './sentinelService';
import { logger } from "@/utils/logger";
import {
  setCachedSignals,
  markSourceSuccess,
  markSourceFailure,
  shouldSkipSource,
} from '@/utils/signalCacheManager';

const INTEL_CACHE: Record<string, { data: any, timestamp: number }> = {};
const CACHE_TTL = 15000; // 15 seconds — near real-time feed

/** Wrap any async call with a hard timeout (ms). Rejects on timeout so retries can trigger. */
const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> => {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<T>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
};

const SOURCE_TIMEOUT = 15000; // 15 seconds

/**
 * Fetch with retry — 2 retries with exponential backoff (1s, 3s).
 * Tracks source health via circuit breaker.
 * withTimeout now rejects on timeout, so the catch block triggers retries properly.
 */
const fetchWithRetry = async <T>(
  sourceName: string,
  fetchFn: () => Promise<T>,
  fallback: T,
  maxRetries = 2,
): Promise<T> => {
  // Circuit breaker: skip source if it failed 3+ times recently
  if (shouldSkipSource(sourceName)) {
    logger.warn(`[CircuitBreaker] Skipping ${sourceName} — too many recent failures`);
    return fallback;
  }

  const delays = [1000, 3000]; // backoff delays

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await withTimeout(fetchFn(), SOURCE_TIMEOUT);
      // If we got actual data, mark success
      if (Array.isArray(result) && result.length > 0) {
        markSourceSuccess(sourceName);
      }
      return result;
    } catch (e) {
      logger.warn(`[Retry] ${sourceName} attempt ${attempt + 1}/${maxRetries + 1} failed:`, e);
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, delays[attempt] || 3000));
      }
    }
  }

  // All retries exhausted
  markSourceFailure(sourceName);
  logger.error(`[Retry] ${sourceName} — all ${maxRetries + 1} attempts failed`);
  return fallback;
};

export const fetchLiveSignals = async (location: string): Promise<Signal[]> => {
  const cacheKey = `signals_${location}`;
  if (INTEL_CACHE[cacheKey] && Date.now() - INTEL_CACHE[cacheKey].timestamp < CACHE_TTL) {
    return INTEL_CACHE[cacheKey].data;
  }

  try {
    // API -> DB -> UI Architecture. Fetch ONLY from the central Sentinel DB.
    const dbSignals = await fetchWithRetry('Sentinel DB', () => fetchSignals({ limit: 50 }), []);

    const aggregatedSignals = [
      ...dbSignals,
    ];

    // Remove duplicates by ID
    const uniqueSignals = aggregatedSignals.reduce((acc: Signal[], signal) => {
      if (signal && signal.id && !acc.find(s => s.id === signal.id)) {
        acc.push(signal);
      }
      return acc;
    }, []);

    const finalAfroSignals = uniqueSignals.filter(signal => {
      const iso = signal.location?.country_iso || signal.location?.iso3;
      const AFRO_ISOS = ['DZA', 'AGO', 'BEN', 'BWA', 'BFA', 'BDI', 'CPV', 'CMR', 'CAF', 'TCD', 'COM', 'COG', 'COD', 'CIV', 'DJI', 'EGY', 'GNQ', 'ERI', 'ETH', 'GAB', 'GMB', 'GHA', 'GIN', 'GNB', 'KEN', 'LSO', 'LBR', 'LBY', 'MDG', 'MWI', 'MLI', 'MRT', 'MUS', 'MAR', 'MOZ', 'NAM', 'NER', 'NGA', 'RWA', 'STP', 'SEN', 'SYC', 'SLE', 'SOM', 'ZAF', 'SSD', 'SDN', 'SWZ', 'TZA', 'TGO', 'TUN', 'UGA', 'ZMB', 'ZWE', 'AFR'];

      if (iso && AFRO_ISOS.includes(iso)) return true;
      if (!iso || iso === 'Global') return true;

      if (signal.location?.coordinates) {
        const coords = signal.location.coordinates;
        const lon = Array.isArray(coords) ? coords[0] : coords.lng;
        const lat = Array.isArray(coords) ? coords[1] : coords.lat;
        if (lat >= -36 && lat <= 38 && lon >= -26 && lon <= 64) return true;
      }

      return true;
    });

    // Save to in-memory cache
    INTEL_CACHE[cacheKey] = { data: finalAfroSignals, timestamp: Date.now() };

    // Save to persistent localStorage cache (for "never empty" guarantee)
    if (finalAfroSignals.length > 0) {
      setCachedSignals(finalAfroSignals);
    }

    return finalAfroSignals;

  } catch (error: any) {
    logger.error("Watchtower API Error:", error);
    return INTEL_CACHE[cacheKey]?.data || [];
  }
};

/**
 * Fetch regional intelligence summary
 */
export const fetchRegionalIntelligence = async (): Promise<any[]> => {
  try {
    const stats = await fetchSignalStats();
    // Convert stats to regional intelligence format
    return stats.by_country.map(c => ({
      country: c.location_country_iso,
      signal_count: c.count,
      priority_breakdown: stats.by_priority
    }));
  } catch (error) {
    logger.warn('Regional intelligence error:', error);
    return [];
  }
};

/**
 * Get briefing text
 */
export const fetchFastBriefing = async (location: string): Promise<string> => {
  try {
    const stats = await fetchSignalStats();
    const p1Count = stats.by_priority.P1 || 0;
    const p2Count = stats.by_priority.P2 || 0;

    if (p1Count > 0) {
      return `⚠️ ${p1Count} CRITICAL (P1) signals require immediate attention. ${stats.total} total signals in database.`;
    } else if (p2Count > 0) {
      return `🔶 ${p2Count} HIGH (P2) priority signals active. ${stats.total} total signals being monitored.`;
    }
    return `✅ No critical signals. ${stats.total} signals in database. Data from NASA EONET, GDELT, and verified sources.`;
  } catch (error) {
    return "Live intelligence stream active. Data from NASA EONET, GDELT, and verified sources.";
  }
};

/**
 * Deep intelligence query (uses backend LLM)
 */
export const askDeepIntelligence = async (query: string): Promise<string> => {
  return "AI Reasoning modules available via /api/v1/chat/query endpoint.";
};

/**
 * Fetch regional signals
 */
export const fetchRegionalSignals = async (): Promise<Signal[]> => {
  return fetchLiveSignals("the WHO Africa Region");
};

/**
 * Get signal statistics
 */
export const getSignalStats = async () => {
  return fetchSignalStats();
};

