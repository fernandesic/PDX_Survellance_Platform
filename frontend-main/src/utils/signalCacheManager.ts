/**
 * Signal Cache Manager
 * 
 * Persistent localStorage cache for Live Feed signals.
 * Strategy: "Never Show Empty" — cache lasts forever, always show something.
 * Fresh API data overwrites cache silently in background.
 */

import { logger } from '@/utils/logger';

const CACHE_KEY = 'afro_sentinel_signals_cache';
const CACHE_META_KEY = 'afro_sentinel_cache_meta';
const SOURCE_HEALTH_KEY = 'afro_sentinel_source_health';
const MAX_CACHED_SIGNALS = 50; // ~150KB max in localStorage

// ── Types ──

export interface CachedSignalData {
  signals: any[];
  timestamp: number;
}

export interface CacheMeta {
  lastSuccessfulFetch: number;
  signalCount: number;
  sources: string[];
}

export interface SourceHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'down';
  lastSuccess: number;
  consecutiveFailures: number;
  skipUntil: number; // timestamp — skip this source until this time
}

export type SourceHealthMap = Record<string, SourceHealth>;

// ── Cache Operations ──

export function getCachedSignals(): any[] {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return [];
    const parsed: CachedSignalData = JSON.parse(raw);
    return parsed.signals || [];
  } catch (e) {
    logger.warn('SignalCacheManager: Failed to read cache', e);
    return [];
  }
}

export function setCachedSignals(signals: any[]): void {
  try {
    // Only cache if we have actual data
    if (!signals || signals.length === 0) return;

    const data: CachedSignalData = {
      signals: signals.slice(0, MAX_CACHED_SIGNALS),
      timestamp: Date.now(),
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));

    // Update meta
    const meta: CacheMeta = {
      lastSuccessfulFetch: Date.now(),
      signalCount: data.signals.length,
      sources: [...new Set(signals.map(s => s.ingestion_source || 'unknown').filter(Boolean))],
    };
    localStorage.setItem(CACHE_META_KEY, JSON.stringify(meta));
  } catch (e) {
    logger.warn('SignalCacheManager: Failed to write cache, clearing and retrying', e);
    // If localStorage is full, clear old data and retry once
    try {
      localStorage.removeItem(CACHE_KEY);
      localStorage.removeItem(CACHE_META_KEY);
      // Retry write after clearing
      const retryData: CachedSignalData = {
        signals: signals.slice(0, MAX_CACHED_SIGNALS),
        timestamp: Date.now(),
      };
      localStorage.setItem(CACHE_KEY, JSON.stringify(retryData));
    } catch (_) {
      logger.warn('SignalCacheManager: Retry also failed, giving up');
    }
  }
}

export function getCacheAge(): number {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return Infinity;
    const parsed: CachedSignalData = JSON.parse(raw);
    return Date.now() - parsed.timestamp;
  } catch {
    return Infinity;
  }
}

/** Returns cache age in human-readable format */
export function getCacheAgeLabel(): string {
  const ageMs = getCacheAge();
  if (ageMs === Infinity) return 'No cache';
  const mins = Math.floor(ageMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/** Data freshness status for UI */
export type FreshnessStatus = 'live' | 'stale' | 'offline';

export function getFreshnessStatus(): FreshnessStatus {
  const ageMs = getCacheAge();
  if (ageMs === Infinity) return 'offline';
  if (ageMs < 3 * 60 * 1000) return 'live';    // < 3 min
  if (ageMs < 30 * 60 * 1000) return 'stale';   // < 30 min
  return 'offline';
}

// ── Source Health Tracking ──

export function getSourceHealth(): SourceHealthMap {
  try {
    const raw = localStorage.getItem(SOURCE_HEALTH_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function saveSourceHealth(map: SourceHealthMap): void {
  try {
    localStorage.setItem(SOURCE_HEALTH_KEY, JSON.stringify(map));
  } catch { /* noop */ }
}

export function markSourceSuccess(sourceName: string): void {
  const map = getSourceHealth();
  map[sourceName] = {
    name: sourceName,
    status: 'healthy',
    lastSuccess: Date.now(),
    consecutiveFailures: 0,
    skipUntil: 0,
  };
  saveSourceHealth(map);
}

export function markSourceFailure(sourceName: string): void {
  const map = getSourceHealth();
  const existing = map[sourceName] || {
    name: sourceName,
    status: 'healthy' as const,
    lastSuccess: 0,
    consecutiveFailures: 0,
    skipUntil: 0,
  };

  existing.consecutiveFailures += 1;

  if (existing.consecutiveFailures >= 3) {
    existing.status = 'down';
    // Circuit breaker: skip for 5 minutes after 3 consecutive failures
    existing.skipUntil = Date.now() + 5 * 60 * 1000;
  } else {
    existing.status = 'degraded';
  }

  map[sourceName] = existing;
  saveSourceHealth(map);
}

export function shouldSkipSource(sourceName: string): boolean {
  const map = getSourceHealth();
  const health = map[sourceName];
  if (!health) return false;
  if (health.skipUntil && Date.now() < health.skipUntil) return true;
  return false;
}
