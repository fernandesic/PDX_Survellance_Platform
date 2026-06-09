/**
 * Unit tests for alerts-v2 signalService.
 *
 * Strategy:
 * - Mock `@/lib/api` so no real HTTP calls are made.
 * - Mock `@/utils/logger` to silence error output.
 * - Test query-param building, response mapping, error handling,
 *   and the four exported functions.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ──────────────────────────────────────────────────────────────

vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock('@/utils/logger', () => ({
  logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { api } from '@/lib/api';
import {
  buildSignalQuery,
  mapSignal,
  fetchAlerts,
  fetchAlertStats,
  fetchAlertById,
  fetchDiseases,
} from '../signalService';

const mockGet = api.get as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── buildSignalQuery ──────────────────────────────────────────────────

describe('buildSignalQuery', () => {
  it('returns empty params when no filters are provided', () => {
    const params = buildSignalQuery();
    expect(params.toString()).toBe('');
  });

  it('returns empty params for undefined filter', () => {
    const params = buildSignalQuery(undefined);
    expect(params.toString()).toBe('');
  });

  it('maps a single priority', () => {
    const params = buildSignalQuery({ priority: 'P1' });
    expect(params.get('priority')).toBe('P1');
  });

  it('maps multiple priorities as repeated params', () => {
    const params = buildSignalQuery({ priority: ['P1', 'P2'] });
    expect(params.getAll('priority')).toEqual(['P1', 'P2']);
  });

  it('maps country to location_country_iso', () => {
    const params = buildSignalQuery({ country: 'NGA' });
    expect(params.get('location_country_iso')).toBe('NGA');
  });

  it('maps multiple countries as repeated params', () => {
    const params = buildSignalQuery({ country: ['NGA', 'KEN'] });
    expect(params.getAll('location_country_iso')).toEqual(['NGA', 'KEN']);
  });

  it('maps disease to disease_name', () => {
    const params = buildSignalQuery({ disease: 'Cholera' });
    expect(params.get('disease_name')).toBe('Cholera');
  });

  it('maps dateFrom and dateTo', () => {
    const params = buildSignalQuery({ dateFrom: '2026-01-01', dateTo: '2026-02-01' });
    expect(params.get('date_from')).toBe('2026-01-01');
    expect(params.get('date_to')).toBe('2026-02-01');
  });

  it('maps search param', () => {
    const params = buildSignalQuery({ search: 'cholera outbreak' });
    expect(params.get('search')).toBe('cholera outbreak');
  });

  it('maps limit as a string', () => {
    const params = buildSignalQuery({ limit: 50 });
    expect(params.get('limit')).toBe('50');
  });

  it('ignores empty string values', () => {
    const params = buildSignalQuery({ search: '', dateFrom: '', dateTo: '' });
    expect(params.toString()).toBe('');
  });

  it('handles a complex filter combination', () => {
    const params = buildSignalQuery({
      priority: ['P1', 'P2'],
      country: 'NGA',
      disease: 'Cholera',
      dateFrom: '2026-01-01',
      search: 'outbreak',
      limit: 25,
    });
    expect(params.getAll('priority')).toEqual(['P1', 'P2']);
    expect(params.get('location_country_iso')).toBe('NGA');
    expect(params.get('disease_name')).toBe('Cholera');
    expect(params.get('date_from')).toBe('2026-01-01');
    expect(params.get('search')).toBe('outbreak');
    expect(params.get('limit')).toBe('25');
  });

  it('maps status param', () => {
    const params = buildSignalQuery({ status: 'new' });
    expect(params.get('status')).toBe('new');
  });

  it('maps multiple statuses as repeated params', () => {
    const params = buildSignalQuery({ status: ['new', 'triaged'] });
    expect(params.getAll('status')).toEqual(['new', 'triaged']);
  });
});

// ─── mapSignal ─────────────────────────────────────────────────────────

describe('mapSignal', () => {
  const RAW_SIGNAL = {
    id: 42,
    signal_id: 'SIG-042',
    headline: 'Cholera outbreak in Lagos',
    summary: 'Summary text',
    signal_type: 'disease',
    disease_name: 'Cholera',
    disease_category: 'AWD',
    priority: 'P1',
    status: 'new',
    confidence_score: 0.95,
    location_country: 'Nigeria',
    location_country_iso: 'NGA',
    location_admin1: 'Lagos',
    location_admin2: null,
    location_locality: null,
    location_lat: 6.524,
    location_lng: 3.379,
    original_text: 'Original article text…',
    original_language: 'en',
    translated_text: null,
    translation_confidence: null,
    source_name: 'WHO',
    source_url: 'https://who.int/article/123',
    source_type: 'official',
    source_tier: 1,
    source_timestamp: '2026-04-20T10:00:00Z',
    reported_cases: 542,
    reported_deaths: 12,
    affected_population: '50,000',
    cross_border_risk: true,
    seasonal_pattern_match: false,
    analyst_notes: null,
    ingestion_source: 'who_rss',
    created_at: '2026-04-20T10:05:00Z',
    updated_at: '2026-04-20T10:05:00Z',
    ai_classification: 'area_alert',
    ai_severity: 'critical',
    ai_notification_scope: 'continental',
    ai_reasoning: 'High CFR, cross-border risk.',
    ai_classified_at: '2026-04-20T10:06:00Z',
  };

  it('maps id to string', () => {
    const result = mapSignal(RAW_SIGNAL);
    expect(result.id).toBe('42');
  });

  it('preserves signal_id', () => {
    expect(mapSignal(RAW_SIGNAL).signal_id).toBe('SIG-042');
  });

  it('generates signal_id fallback when missing', () => {
    const raw = { ...RAW_SIGNAL, signal_id: undefined };
    expect(mapSignal(raw).signal_id).toBe('SIG-42');
  });

  it('maps location fields', () => {
    const result = mapSignal(RAW_SIGNAL);
    expect(result.location.country).toBe('Nigeria');
    expect(result.location.iso3).toBe('NGA');
    expect(result.location.admin1).toBe('Lagos');
    expect(result.location.coordinates).toEqual({ lat: 6.524, lng: 3.379 });
  });

  it('sets coordinates to undefined when lat=0, lng=0', () => {
    const raw = { ...RAW_SIGNAL, location_lat: 0, location_lng: 0 };
    expect(mapSignal(raw).location.coordinates).toBeUndefined();
  });

  it('sets coordinates to undefined when lat/lng are null', () => {
    const raw = { ...RAW_SIGNAL, location_lat: null, location_lng: null };
    expect(mapSignal(raw).location.coordinates).toBeUndefined();
  });

  it('maps source fields', () => {
    const result = mapSignal(RAW_SIGNAL);
    expect(result.source?.name).toBe('WHO');
    expect(result.source?.url).toBe('https://who.int/article/123');
    expect(result.source?.tier).toBe(1);
    expect(result.source_tier).toBe(1);
  });

  it('defaults source tier to 3 when missing', () => {
    const raw = { ...RAW_SIGNAL, source_tier: undefined, source_display: undefined };
    expect(mapSignal(raw).source_tier).toBe(3);
  });

  it('prefers source_display over flat fields', () => {
    const raw = {
      ...RAW_SIGNAL,
      source_display: { name: 'Africa CDC', url: 'https://africacdc.org', tier: 1, type: 'official' },
    };
    const result = mapSignal(raw);
    expect(result.source?.name).toBe('Africa CDC');
    expect(result.source?.url).toBe('https://africacdc.org');
  });

  it('maps epidemiological fields', () => {
    const result = mapSignal(RAW_SIGNAL);
    expect(result.reported_cases).toBe(542);
    expect(result.reported_deaths).toBe(12);
    expect(result.affected_population).toBe('50,000');
  });

  it('maps AI agent fields', () => {
    const result = mapSignal(RAW_SIGNAL);
    expect(result.ai_classification).toBe('area_alert');
    expect(result.ai_severity).toBe('critical');
    expect(result.ai_notification_scope).toBe('continental');
    expect(result.ai_reasoning).toBe('High CFR, cross-border risk.');
    expect(result.ai_classified_at).toBe('2026-04-20T10:06:00Z');
  });

  it('maps risk flags', () => {
    const result = mapSignal(RAW_SIGNAL);
    expect(result.cross_border_risk).toBe(true);
    expect(result.seasonal_pattern_match).toBe(false);
  });

  it('maps publishedAt from source_timestamp', () => {
    const result = mapSignal(RAW_SIGNAL);
    expect(result.publishedAt).toBe('2026-04-20T10:00:00Z');
  });

  it('falls back publishedAt to created_at', () => {
    const raw = { ...RAW_SIGNAL, source_timestamp: null };
    expect(mapSignal(raw).publishedAt).toBe('2026-04-20T10:05:00Z');
  });

  it('handles a completely minimal raw object', () => {
    const minimal = { id: 1 };
    const result = mapSignal(minimal);
    expect(result.id).toBe('1');
    expect(result.headline).toBe('');
    expect(result.source?.name).toBe('Unknown Source');
    expect(result.source_tier).toBe(3);
    expect(result.location.coordinates).toBeUndefined();
  });
});

// ─── fetchAlerts ───────────────────────────────────────────────────────

describe('fetchAlerts', () => {
  it('calls sentinel/signals/ with no query string when no filters', async () => {
    mockGet.mockResolvedValue({ data: { results: [] } });
    await fetchAlerts();
    expect(mockGet).toHaveBeenCalledWith('sentinel/signals/');
  });

  it('appends query string when filters are provided', async () => {
    mockGet.mockResolvedValue({ data: { results: [] } });
    await fetchAlerts({ priority: 'P1', country: 'NGA' });
    const url = mockGet.mock.calls[0][0] as string;
    expect(url).toContain('sentinel/signals/?');
    expect(url).toContain('priority=P1');
    expect(url).toContain('location_country_iso=NGA');
  });

  it('unwraps paginated DRF envelope { results: [...] }', async () => {
    mockGet.mockResolvedValue({
      data: {
        count: 2,
        results: [
          { id: 1, headline: 'A' },
          { id: 2, headline: 'B' },
        ],
      },
    });
    const alerts = await fetchAlerts();
    expect(alerts).toHaveLength(2);
    expect(alerts[0].id).toBe('1');
    expect(alerts[1].id).toBe('2');
  });

  it('unwraps a plain array response', async () => {
    mockGet.mockResolvedValue({
      data: [{ id: 10, headline: 'Direct array' }],
    });
    const alerts = await fetchAlerts();
    expect(alerts).toHaveLength(1);
    expect(alerts[0].id).toBe('10');
  });

  it('returns empty array on network error', async () => {
    mockGet.mockRejectedValue(new Error('Network Error'));
    const alerts = await fetchAlerts();
    expect(alerts).toEqual([]);
  });

  it('maps each signal through mapSignal', async () => {
    mockGet.mockResolvedValue({
      data: { results: [{ id: 5, priority: 'P2', location_country: 'Kenya', location_country_iso: 'KEN' }] },
    });
    const alerts = await fetchAlerts();
    expect(alerts[0].id).toBe('5');
    expect(alerts[0].location.country).toBe('Kenya');
    expect(alerts[0].location.iso3).toBe('KEN');
  });
});

// ─── fetchAlertStats ───────────────────────────────────────────────────

describe('fetchAlertStats', () => {
  it('calls the stats endpoint', async () => {
    mockGet.mockResolvedValue({
      data: { total: 100, by_priority: { P1: 5 }, by_status: {}, by_country: {} },
    });
    const stats = await fetchAlertStats();
    expect(mockGet).toHaveBeenCalledWith('sentinel/signals/stats/');
    expect(stats.total).toBe(100);
    expect(stats.by_priority).toEqual({ P1: 5 });
  });

  it('returns zero-state on error', async () => {
    mockGet.mockRejectedValue(new Error('500'));
    const stats = await fetchAlertStats();
    expect(stats).toEqual({ total: 0, by_priority: {}, by_status: {}, by_country: {} });
  });

  it('defaults missing fields to empty', async () => {
    mockGet.mockResolvedValue({ data: {} });
    const stats = await fetchAlertStats();
    expect(stats.total).toBe(0);
    expect(stats.by_priority).toEqual({});
  });
});

// ─── fetchAlertById ────────────────────────────────────────────────────

describe('fetchAlertById', () => {
  it('calls the detail endpoint with numeric id', async () => {
    mockGet.mockResolvedValue({ data: { id: 7, headline: 'Single' } });
    const signal = await fetchAlertById(7);
    expect(mockGet).toHaveBeenCalledWith('sentinel/signals/7/');
    expect(signal?.id).toBe('7');
  });

  it('accepts string id', async () => {
    mockGet.mockResolvedValue({ data: { id: 7, headline: 'Single' } });
    await fetchAlertById('7');
    expect(mockGet).toHaveBeenCalledWith('sentinel/signals/7/');
  });

  it('returns null on error', async () => {
    mockGet.mockRejectedValue(new Error('404'));
    const signal = await fetchAlertById(999);
    expect(signal).toBeNull();
  });
});

// ─── fetchDiseases ─────────────────────────────────────────────────────

describe('fetchDiseases', () => {
  it('calls the diseases endpoint', async () => {
    mockGet.mockResolvedValue({
      data: {
        results: [
          { code: 'A00', disease_name: 'Cholera', syndrome: 'AWD', keywords_en: ['cholera'] },
        ],
      },
    });
    const diseases = await fetchDiseases();
    expect(mockGet).toHaveBeenCalledWith('sentinel/diseases/');
    expect(diseases).toHaveLength(1);
    expect(diseases[0].name).toBe('Cholera');
    expect(diseases[0].code).toBe('A00');
    expect(diseases[0].keywords).toEqual(['cholera']);
  });

  it('handles plain array response', async () => {
    mockGet.mockResolvedValue({
      data: [{ disease_name: 'Measles', keywords: ['measles', 'rougeole'] }],
    });
    const diseases = await fetchDiseases();
    expect(diseases).toHaveLength(1);
    expect(diseases[0].name).toBe('Measles');
    expect(diseases[0].keywords).toEqual(['measles', 'rougeole']);
  });

  it('returns empty array on error', async () => {
    mockGet.mockRejectedValue(new Error('Network'));
    expect(await fetchDiseases()).toEqual([]);
  });
});
