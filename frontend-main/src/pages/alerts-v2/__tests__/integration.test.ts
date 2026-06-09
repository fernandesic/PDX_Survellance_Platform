/**
 * TASK 9 — Frontend integration test.
 *
 * Composes the full alerts-v2 data pipeline end-to-end WITHOUT a DOM:
 *
 *   api.get()  →  fetchAlertsStrict  →  mapSignal  →  toProcessedAlert
 *             →  filterBySearch  →  groupByPriority (feed)
 *             →  shouldPlotSignal + countByIso + countPlottable (map)
 *             →  filtersToSignalQuery + filtersSignature (filter refetch)
 *             →  buildSignalCsv (detail export)
 *
 * The vitest env is 'node' (see vite.config.ts), so we can't render React.
 * What we *can* (and do) verify is that the real service → utils pipeline
 * agrees on the invariants the UI relies on:
 *
 *   - Map markers and feed cards derive from the same Signal[]
 *   - Selection round-trips between map click → feed highlight by signal id
 *   - Filter changes produce a new signature and a new backend query
 *   - Auto-refresh fires on interval and hits the same pipeline
 *   - Error bubbles out of fetchAlertsStrict for the page to render a banner
 *   - fetchAlerts (non-strict) still returns [] on error — TASK 2 contract
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/api', () => ({
  api: { get: vi.fn() },
}));
vi.mock('@/utils/logger', () => ({
  logger: { log: vi.fn(), warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

import { api } from '@/lib/api';
import {
  fetchAlerts,
  fetchAlertsStrict,
  mapSignal,
} from '../services/signalService';
import {
  fetchIncidents,
  fetchIncidentsStrict,
} from '../services/incidentService';
import {
  toProcessedAlert,
  filterBySearch,
  groupByPriority,
  countByPriority,
} from '../components/alertFeedUtils';
import {
  countByIso,
  countPlottable,
  shouldPlotSignal,
} from '../components/alertMapUtils';
import {
  filtersToSignalQuery,
  filtersSignature,
} from '../components/alertFiltersUtils';
import { buildSignalCsv } from '../components/alertDetailUtils';
import { EMPTY_FILTERS } from '../types';
import type { ActiveFilters } from '../types';

const mockGet = api.get as ReturnType<typeof vi.fn>;

// Raw Django payloads for 4 signals spread across priorities + countries.
// Coordinates pulled from constants to match AFRO_COUNTRY_BY_ISO entries.
const DJANGO_SIGNALS = [
  {
    id: 101,
    signal_id: 'SIG-101',
    headline: 'Cholera outbreak confirmed in Lagos',
    disease_name: 'Cholera',
    disease_category: 'cholera',
    priority: 'P1',
    status: 'triaged',
    location_country: 'Nigeria',
    location_country_iso: 'NGA',
    location_lat: 9.082,
    location_lng: 8.675,
    source_display: { name: 'WHO AFRO', tier: 1, type: 'who' },
    source_url: 'https://who.int/news/cholera-ngn',
    reported_cases: 250,
    reported_deaths: 12,
    cross_border_risk: true,
    original_text: 'Cholera cases confirmed',
    original_language: 'en',
    ai_classification: 'continent_alert',
    ai_severity: 'critical',
    ai_notification_scope: 'continental',
    ai_reasoning: 'Rising case count + deaths in urban centre',
    ai_classified_at: '2026-04-22T10:00:00Z',
    created_at: '2026-04-22T09:45:00Z',
    source_timestamp: '2026-04-22T09:30:00Z',
  },
  {
    id: 102,
    signal_id: 'SIG-102',
    headline: 'Measles cluster reported',
    disease_name: 'Measles',
    priority: 'P2',
    status: 'new',
    location_country: 'Kenya',
    location_country_iso: 'KEN',
    location_lat: -0.023,
    location_lng: 37.906,
    source_display: { name: 'AllAfrica', tier: 2, type: 'news' },
    reported_cases: 40,
    reported_deaths: 1,
    ai_severity: 'high',
    created_at: '2026-04-22T08:00:00Z',
    source_timestamp: '2026-04-22T07:55:00Z',
  },
  {
    id: 103,
    signal_id: 'SIG-103',
    headline: 'Unconfirmed fever reports',
    disease_name: '',
    priority: 'P3',
    status: 'new',
    location_country: 'Ghana',
    location_country_iso: 'GHA',
    location_lat: 7.946,
    location_lng: -1.021,
    source_display: { name: 'GDELT', tier: 3, type: 'news' },
    reported_cases: 5,
    created_at: '2026-04-22T07:00:00Z',
  },
  // Signal with null-island coords — must be filtered from the map.
  {
    id: 104,
    signal_id: 'SIG-104',
    headline: 'Signal with no location',
    disease_name: 'Influenza',
    priority: 'P4',
    status: 'new',
    location_country: null,
    location_country_iso: null,
    location_lat: 0,
    location_lng: 0,
    source_display: { name: 'Unknown', tier: 3, type: 'news' },
    created_at: '2026-04-22T06:00:00Z',
  },
];

const INCIDENT_PAYLOAD = [
  {
    id: 1,
    country: { id: 1, country: 'Nigeria' },
    ihmref_data: {
      id: 1,
      category: 'disease_outbreak',
      year: '2024',
      afro: 3,
      global_t: 8,
      contribution: '',
      no_of_african_countries: 3,
    },
    incident: 'West Africa Cholera',
    start_date: '2024-05-01',
    end_date: '2024-08-01',
  },
];

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

// ──────────────────────────────────────────────────────────────────────
describe('TASK 9 integration — end-to-end data pipeline', () => {
  it('fetches, maps, and feeds both map and feed panel from the same Signal[]', async () => {
    mockGet.mockResolvedValueOnce({ data: { results: DJANGO_SIGNALS } });

    const signals = await fetchAlertsStrict();

    // One roundtrip to the Sentinel API, default URL, no query params.
    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockGet).toHaveBeenCalledWith('sentinel/signals/');

    // Field renames applied; null-island preserved on the raw Signal but
    // the map filter should drop it from plotting.
    expect(signals).toHaveLength(4);
    expect(signals[0].priority).toBe('P1');
    expect(signals[0].location.iso3).toBe('NGA');
    expect(signals[3].location_lat).toBe(0);

    // Feed pipeline
    const processed = signals.map(toProcessedAlert);
    const groups = groupByPriority(processed);
    expect(groups.critical).toHaveLength(1);
    expect(groups.critical[0].id).toBe('101');
    expect(groups.high).toHaveLength(1);
    expect(groups.high[0].id).toBe('102');
    expect(groups.monitoring.map((a) => a.id).sort()).toEqual(['103', '104']);

    const counts = countByPriority(processed);
    expect(counts).toEqual({ critical: 1, high: 1, monitoring: 2 });

    // Map pipeline — the null-island signal must not plot.
    const plottable = signals.filter(shouldPlotSignal);
    expect(plottable.map((s) => s.id).sort()).toEqual(['101', '102', '103']);
    expect(countPlottable(signals)).toBe(3);

    const iso2Counts = countByIso(signals);
    expect(iso2Counts).toEqual({ NG: 1, KE: 1, GH: 1 });
  });

  it('syncs selection between map click and feed card by signal id', () => {
    const signals = DJANGO_SIGNALS.map(mapSignal);
    const processed = signals.map(toProcessedAlert);

    // Simulate a map hitTest returning the ArcGIS signal attr for id 102.
    const mapClickedId = '102';
    const selected = processed.find((p) => p.id === mapClickedId);
    expect(selected).toBeDefined();
    expect(selected!.priority).toBe('P2');
    expect(selected!.countryName).toBe('Kenya');
  });

  it('filter changes produce a new signature and a new backend query', async () => {
    mockGet.mockResolvedValue({ data: { results: [] } });

    const base: ActiveFilters = { ...EMPTY_FILTERS };
    const withSeverity: ActiveFilters = { ...base, priorities: ['P1', 'P2'] };
    const withCountry: ActiveFilters = { ...withSeverity, countries: ['NGA'] };

    expect(filtersSignature(base)).not.toBe(filtersSignature(withSeverity));
    expect(filtersSignature(withSeverity)).not.toBe(filtersSignature(withCountry));

    await fetchAlertsStrict(filtersToSignalQuery(withCountry));

    const url = mockGet.mock.calls[0][0] as string;
    expect(url).toContain('sentinel/signals/?');
    expect(url).toContain('priority=P1');
    expect(url).toContain('priority=P2');
    expect(url).toContain('location_country_iso=NGA');
  });

  it('search narrows feed results while map still sees all plottable signals', () => {
    const signals = DJANGO_SIGNALS.map(mapSignal);
    const processed = signals.map(toProcessedAlert);

    const narrowed = filterBySearch(processed, 'cholera');
    // Disease name match drops everything except the cholera signal.
    expect(narrowed.map((a) => a.id)).toEqual(['101']);

    // Search is a feed-only concern; map count is unchanged.
    expect(countPlottable(signals)).toBe(3);
  });

  it('incidents endpoint feeds the incidents tab independently', async () => {
    mockGet.mockResolvedValueOnce({ data: INCIDENT_PAYLOAD });

    const incidents = await fetchIncidentsStrict();
    expect(mockGet).toHaveBeenCalledWith(
      '/ihmref/country/incident',
      { params: undefined },
    );
    expect(incidents).toHaveLength(1);
    expect(incidents[0].country.country).toBe('Nigeria');
    expect(incidents[0].ihmref_data.category).toBe('disease_outbreak');
  });

  it('CSV export assembles the detail row from the same mapped Signal', () => {
    const signal = mapSignal(DJANGO_SIGNALS[0]);
    const csv = buildSignalCsv(signal);
    const [header, row] = csv.split('\r\n');
    expect(header).toContain('priority');
    expect(header).toContain('ai_classification');
    expect(row).toContain('NGA');
    expect(row).toContain('continent_alert');
  });
});

// ──────────────────────────────────────────────────────────────────────
describe('TASK 9 integration — error + resilience', () => {
  it('fetchAlertsStrict throws on network failure so the page can show a banner', async () => {
    mockGet.mockRejectedValueOnce(new Error('boom'));
    await expect(fetchAlertsStrict()).rejects.toThrow('boom');
  });

  it('fetchAlerts (non-strict) still returns [] on failure — TASK 2 contract preserved', async () => {
    mockGet.mockRejectedValueOnce(new Error('boom'));
    const result = await fetchAlerts();
    expect(result).toEqual([]);
  });

  it('fetchIncidentsStrict throws; fetchIncidents returns []', async () => {
    mockGet.mockRejectedValueOnce(new Error('boom'));
    await expect(fetchIncidentsStrict()).rejects.toThrow('boom');

    mockGet.mockRejectedValueOnce(new Error('boom'));
    await expect(fetchIncidents()).resolves.toEqual([]);
  });
});

// ──────────────────────────────────────────────────────────────────────
describe('TASK 9 integration — 30s auto-refresh cadence', () => {
  it('a setInterval(30_000) loop re-hits the alerts pipeline on each tick', async () => {
    vi.useFakeTimers();
    mockGet.mockResolvedValue({ data: { results: DJANGO_SIGNALS } });

    // Mirror the AlertsPageV2 pattern: initial load, then interval polling.
    let latestCount = 0;
    const refresh = async () => {
      const s = await fetchAlertsStrict();
      latestCount = s.length;
    };
    await refresh();
    expect(latestCount).toBe(4);
    expect(mockGet).toHaveBeenCalledTimes(1);

    const id = setInterval(refresh, 30_000);
    try {
      await vi.advanceTimersByTimeAsync(30_000);
      expect(mockGet).toHaveBeenCalledTimes(2);

      await vi.advanceTimersByTimeAsync(60_000);
      expect(mockGet).toHaveBeenCalledTimes(4);
    } finally {
      clearInterval(id);
    }
  });
});
