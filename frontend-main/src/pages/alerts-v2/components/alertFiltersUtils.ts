import type { ActiveFilters, DateRange } from '../types';
import type { SignalQuery } from '../services/signalService';
import { DISEASE_KEYWORDS } from '../constants';

const DISEASE_CODE_TO_NAME: Record<string, string> = DISEASE_KEYWORDS.reduce(
  (acc, d) => {
    acc[d.code] = d.name;
    return acc;
  },
  {} as Record<string, string>,
);

export interface DateBounds {
  dateFrom?: string;
  dateTo?: string;
}

export const DATE_RANGE_LABELS: Record<DateRange, string> = {
  all: 'All time',
  '24h': 'Last 24 hours',
  '3d': 'Last 3 days',
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  custom: 'Custom',
};

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/**
 * Resolve a DateRange preset into ISO date bounds. Returns bounds as date-only
 * strings (YYYY-MM-DD) because the Sentinel API accepts `date_from` / `date_to`
 * in that format. `all` and `custom` return empty bounds — the caller supplies
 * explicit from/to for custom ranges.
 */
export function dateRangeToBounds(range: DateRange, now: Date = new Date()): DateBounds {
  if (range === 'all' || range === 'custom') return {};
  const span =
    range === '24h' ? HOUR_MS * 24
    : range === '3d' ? DAY_MS * 3
    : range === '7d' ? DAY_MS * 7
    : DAY_MS * 30;
  const from = new Date(now.getTime() - span);
  return { dateFrom: toIsoDate(from), dateTo: toIsoDate(now) };
}

function toIsoDate(d: Date): string {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Hard cap on signals fetched per request. The feed and map both render every
 * row in memory; without a cap a wide-open filter could pull thousands and
 * stall the first paint. Tweak alongside the feed's progressive-render limit.
 */
export const SIGNAL_QUERY_LIMIT = 200;

/**
 * Map the frontend ActiveFilters shape to the SignalQuery that the Sentinel
 * service accepts. Empty facets drop out so the server sees the minimal
 * query. Date preset wins over manual dateFrom/dateTo unless `custom`.
 */
export function filtersToSignalQuery(
  filters: ActiveFilters,
  now: Date = new Date(),
): SignalQuery {
  const query: SignalQuery = { limit: SIGNAL_QUERY_LIMIT };
  if (filters.priorities.length > 0) query.priority = filters.priorities;
  if (filters.countries.length > 0) query.country = filters.countries;
  if (filters.diseases.length > 0) {
    // Frontend stores DISEASE_KEYWORDS codes (e.g. 'A00'), but the Sentinel
    // API filters on the free-text `disease_name` column — convert before sending.
    query.disease = filters.diseases.map((code) => DISEASE_CODE_TO_NAME[code] ?? code);
  }
  if (filters.search.trim()) query.search = filters.search.trim();

  if (filters.dateRange === 'custom') {
    if (filters.dateFrom) query.dateFrom = filters.dateFrom;
    if (filters.dateTo) query.dateTo = filters.dateTo;
  } else {
    const bounds = dateRangeToBounds(filters.dateRange, now);
    if (bounds.dateFrom) query.dateFrom = bounds.dateFrom;
    if (bounds.dateTo) query.dateTo = bounds.dateTo;
  }

  return query;
}

/**
 * Count how many filter *facets* are active (not how many values within
 * each). Drives the badge next to the Filters label. Search and date range
 * count as one facet each; `all` / empty search are ignored.
 */
export function countActiveFilters(filters: ActiveFilters): number {
  let n = 0;
  if (filters.priorities.length > 0) n += 1;
  if (filters.countries.length > 0) n += 1;
  if (filters.diseases.length > 0) n += 1;
  if (filters.search.trim()) n += 1;
  if (filters.dateRange !== 'all') n += 1;
  return n;
}

/** Serialise filters into a stable key so React effects refetch only on change. */
export function filtersSignature(filters: ActiveFilters): string {
  return JSON.stringify({
    p: [...filters.priorities].sort(),
    c: [...filters.countries].sort(),
    d: [...filters.diseases].sort(),
    s: filters.search.trim(),
    r: filters.dateRange,
    f: filters.dateFrom,
    t: filters.dateTo,
  });
}
