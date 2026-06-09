import { describe, it, expect } from 'vitest';
import {
  countActiveFilters,
  dateRangeToBounds,
  filtersSignature,
  filtersToSignalQuery,
  DATE_RANGE_LABELS,
} from '../alertFiltersUtils';
import { EMPTY_FILTERS } from '../../types';
import type { ActiveFilters } from '../../types';

const NOW = new Date('2026-04-23T12:00:00Z');

function makeFilters(overrides: Partial<ActiveFilters> = {}): ActiveFilters {
  return { ...EMPTY_FILTERS, ...overrides };
}

describe('dateRangeToBounds', () => {
  it('returns empty bounds for "all"', () => {
    expect(dateRangeToBounds('all', NOW)).toEqual({});
  });

  it('returns empty bounds for "custom" (caller provides their own)', () => {
    expect(dateRangeToBounds('custom', NOW)).toEqual({});
  });

  it('subtracts 24 hours for "24h" and returns YYYY-MM-DD', () => {
    expect(dateRangeToBounds('24h', NOW)).toEqual({
      dateFrom: '2026-04-22',
      dateTo: '2026-04-23',
    });
  });

  it('subtracts 7 days for "7d"', () => {
    expect(dateRangeToBounds('7d', NOW)).toEqual({
      dateFrom: '2026-04-16',
      dateTo: '2026-04-23',
    });
  });

  it('subtracts 30 days for "30d"', () => {
    expect(dateRangeToBounds('30d', NOW)).toEqual({
      dateFrom: '2026-03-24',
      dateTo: '2026-04-23',
    });
  });
});

describe('filtersToSignalQuery', () => {
  it('always pins a hard limit so unbounded fetches cannot stall the UI', () => {
    expect(filtersToSignalQuery(EMPTY_FILTERS, NOW).limit).toBe(200);
  });

  it('returns only the safety limit for EMPTY_FILTERS', () => {
    expect(filtersToSignalQuery(EMPTY_FILTERS, NOW)).toEqual({ limit: 200 });
  });

  it('includes priorities only when non-empty', () => {
    const q = filtersToSignalQuery(makeFilters({ priorities: ['P1', 'P2'] }), NOW);
    expect(q.priority).toEqual(['P1', 'P2']);
  });

  it('includes countries as arrays and resolves disease codes to names', () => {
    const q = filtersToSignalQuery(
      makeFilters({ countries: ['NGA'], diseases: ['A00'] }),
      NOW,
    );
    expect(q.country).toEqual(['NGA']);
    // A00 is Cholera in DISEASE_KEYWORDS — sent to the backend as a name so
    // it can hit Signal.disease_name (icontains) rather than the
    // choice-validated disease_category column.
    expect(q.disease).toEqual(['Cholera']);
  });

  it('passes through unknown disease codes verbatim', () => {
    const q = filtersToSignalQuery(
      makeFilters({ diseases: ['UNKNOWN_CODE'] }),
      NOW,
    );
    expect(q.disease).toEqual(['UNKNOWN_CODE']);
  });

  it('trims search and drops empty strings', () => {
    expect(filtersToSignalQuery(makeFilters({ search: '   ' }), NOW)).toEqual({
      limit: 200,
    });
    expect(
      filtersToSignalQuery(makeFilters({ search: '  cholera  ' }), NOW).search,
    ).toBe('cholera');
  });

  it('maps a preset range into dateFrom/dateTo', () => {
    const q = filtersToSignalQuery(makeFilters({ dateRange: '7d' }), NOW);
    expect(q.dateFrom).toBe('2026-04-16');
    expect(q.dateTo).toBe('2026-04-23');
  });

  it('uses explicit dateFrom/dateTo when range is "custom"', () => {
    const q = filtersToSignalQuery(
      makeFilters({ dateRange: 'custom', dateFrom: '2026-01-01', dateTo: '2026-02-01' }),
      NOW,
    );
    expect(q.dateFrom).toBe('2026-01-01');
    expect(q.dateTo).toBe('2026-02-01');
  });

  it('ignores manual dateFrom/dateTo when a non-custom preset is set', () => {
    const q = filtersToSignalQuery(
      makeFilters({ dateRange: '24h', dateFrom: '1999-12-31', dateTo: '2000-01-01' }),
      NOW,
    );
    expect(q.dateFrom).toBe('2026-04-22');
    expect(q.dateTo).toBe('2026-04-23');
  });
});

describe('countActiveFilters', () => {
  it('returns 0 for EMPTY_FILTERS', () => {
    expect(countActiveFilters(EMPTY_FILTERS)).toBe(0);
  });

  it('counts each active facet once regardless of inner length', () => {
    expect(
      countActiveFilters(
        makeFilters({ priorities: ['P1', 'P2'], countries: ['NGA'], diseases: ['A00'] }),
      ),
    ).toBe(3);
  });

  it('counts search when non-empty after trim', () => {
    expect(countActiveFilters(makeFilters({ search: '  ' }))).toBe(0);
    expect(countActiveFilters(makeFilters({ search: 'x' }))).toBe(1);
  });

  it('counts date range when not "all"', () => {
    expect(countActiveFilters(makeFilters({ dateRange: 'all' }))).toBe(0);
    expect(countActiveFilters(makeFilters({ dateRange: '7d' }))).toBe(1);
    expect(countActiveFilters(makeFilters({ dateRange: 'custom' }))).toBe(1);
  });
});

describe('filtersSignature', () => {
  it('produces identical signatures for equivalent filters regardless of array order', () => {
    const a = makeFilters({ priorities: ['P1', 'P2'], countries: ['NGA', 'KEN'] });
    const b = makeFilters({ priorities: ['P2', 'P1'], countries: ['KEN', 'NGA'] });
    expect(filtersSignature(a)).toBe(filtersSignature(b));
  });

  it('changes when any facet changes', () => {
    const base = filtersSignature(EMPTY_FILTERS);
    expect(filtersSignature(makeFilters({ dateRange: '7d' }))).not.toBe(base);
    expect(filtersSignature(makeFilters({ search: 'x' }))).not.toBe(base);
    expect(filtersSignature(makeFilters({ priorities: ['P1'] }))).not.toBe(base);
  });
});

describe('DATE_RANGE_LABELS', () => {
  it('provides a human label for every DateRange value', () => {
    expect(DATE_RANGE_LABELS.all).toBe('All time');
    expect(DATE_RANGE_LABELS['24h']).toMatch(/24/);
    expect(DATE_RANGE_LABELS['7d']).toMatch(/7/);
    expect(DATE_RANGE_LABELS['30d']).toMatch(/30/);
    expect(DATE_RANGE_LABELS.custom).toBe('Custom');
  });
});
