import { describe, it, expect } from 'vitest';
import {
  countByPriority,
  filterBySearch,
  formatRelativeTime,
  groupByPriority,
  toProcessedAlert,
} from '../alertFeedUtils';
import type { Signal } from '../../types';

function makeSignal(overrides: Partial<Signal> = {}): Signal {
  return {
    id: overrides.id ?? 's-1',
    location: overrides.location ?? {},
    ...overrides,
  } as Signal;
}

describe('toProcessedAlert', () => {
  it('derives title / country / flag from a Nigeria cholera signal', () => {
    const pa = toProcessedAlert(
      makeSignal({
        id: 's-42',
        priority: 'P1',
        disease_name: 'Cholera',
        reported_cases: 120,
        reported_deaths: 3,
        location: { iso3: 'NGA', country: 'Nigeria' },
        source: { name: 'WHO AFRO', tier: 1 },
        ai_severity: 'critical',
        ai_classification: 'area_alert',
        publishedAt: '2026-04-22T10:00:00Z',
      }),
    );

    expect(pa).toMatchObject({
      id: 's-42',
      priority: 'P1',
      title: 'Cholera',
      diseaseName: 'Cholera',
      countryIso3: 'NGA',
      countryName: 'Nigeria',
      flag: '🇳🇬',
      cases: 120,
      deaths: 3,
      sourceName: 'WHO AFRO',
      sourceTier: 1,
      aiSeverity: 'critical',
      aiClassification: 'area_alert',
    });
  });

  it('falls back to P4 when priority is missing or invalid', () => {
    expect(toProcessedAlert(makeSignal()).priority).toBe('P4');
    // @ts-expect-error intentionally bogus
    expect(toProcessedAlert(makeSignal({ priority: 'P9' })).priority).toBe('P4');
  });

  it('uses headline then summary then original_text as title when disease_name is absent', () => {
    expect(
      toProcessedAlert(makeSignal({ headline: 'Unusual fever cluster', summary: 'x' })).title,
    ).toBe('Unusual fever cluster');
    expect(toProcessedAlert(makeSignal({ summary: 'Only a summary' })).title).toBe(
      'Only a summary',
    );
    expect(toProcessedAlert(makeSignal({ original_text: 'Raw text' })).title).toBe('Raw text');
    expect(toProcessedAlert(makeSignal()).title).toBe('Untitled alert');
  });

  it('reads iso3 from country_iso when iso3 is missing and shows globe if not AFRO', () => {
    const paKen = toProcessedAlert(
      makeSignal({ location: { country_iso: 'KEN', country: 'Kenya' } }),
    );
    expect(paKen.countryIso3).toBe('KEN');
    expect(paKen.flag).toBe('🇰🇪');

    const paNonAfro = toProcessedAlert(
      makeSignal({ location: { iso3: 'USA', country: 'United States' } }),
    );
    expect(paNonAfro.flag).toBe('🌍');
    expect(paNonAfro.countryName).toBe('United States');
  });

  it('clamps source tier into the 1..3 range and defaults to 3', () => {
    expect(toProcessedAlert(makeSignal({ source_tier: 1 })).sourceTier).toBe(1);
    expect(toProcessedAlert(makeSignal({ source_tier: 2 })).sourceTier).toBe(2);
    // @ts-expect-error tier 5 is invalid
    expect(toProcessedAlert(makeSignal({ source_tier: 5 })).sourceTier).toBe(3);
    expect(toProcessedAlert(makeSignal()).sourceTier).toBe(3);
  });

  it('prefers the structured source object over flat fields', () => {
    const pa = toProcessedAlert(
      makeSignal({
        source: { name: 'Reuters', tier: 2 },
        source_name: 'something-else',
        source_tier: 3,
      }),
    );
    expect(pa.sourceName).toBe('Reuters');
    expect(pa.sourceTier).toBe(2);
  });
});

describe('filterBySearch', () => {
  const alerts = [
    toProcessedAlert(
      makeSignal({ id: '1', disease_name: 'Cholera', location: { iso3: 'NGA', country: 'Nigeria' } }),
    ),
    toProcessedAlert(
      makeSignal({ id: '2', disease_name: 'Measles', location: { iso3: 'KEN', country: 'Kenya' } }),
    ),
    toProcessedAlert(
      makeSignal({ id: '3', disease_name: 'Ebola', location: { iso3: 'COD', country: 'DRC' } }),
    ),
  ];

  it('returns all alerts for empty / whitespace query', () => {
    expect(filterBySearch(alerts, '').map((a) => a.id)).toEqual(['1', '2', '3']);
    expect(filterBySearch(alerts, '   ').map((a) => a.id)).toEqual(['1', '2', '3']);
  });

  it('matches on disease name (case-insensitive)', () => {
    expect(filterBySearch(alerts, 'cho').map((a) => a.id)).toEqual(['1']);
    expect(filterBySearch(alerts, 'EBOLA').map((a) => a.id)).toEqual(['3']);
  });

  it('matches on country name and iso3', () => {
    expect(filterBySearch(alerts, 'kenya').map((a) => a.id)).toEqual(['2']);
    expect(filterBySearch(alerts, 'NGA').map((a) => a.id)).toEqual(['1']);
  });

  it('returns empty when nothing matches', () => {
    expect(filterBySearch(alerts, 'xyz-no-match')).toEqual([]);
  });
});

describe('groupByPriority', () => {
  const p1 = toProcessedAlert(
    makeSignal({ id: 'a', priority: 'P1', publishedAt: '2026-04-20T00:00:00Z' }),
  );
  const p1Newer = toProcessedAlert(
    makeSignal({ id: 'a2', priority: 'P1', publishedAt: '2026-04-22T00:00:00Z' }),
  );
  const p2 = toProcessedAlert(makeSignal({ id: 'b', priority: 'P2' }));
  const p3 = toProcessedAlert(makeSignal({ id: 'c', priority: 'P3' }));
  const p4 = toProcessedAlert(makeSignal({ id: 'd', priority: 'P4' }));
  const pNone = toProcessedAlert(makeSignal({ id: 'e' }));

  it('puts P1 in critical, P2 in high, and P3/P4/unknown in monitoring', () => {
    const g = groupByPriority([p1, p2, p3, p4, pNone]);
    expect(g.critical.map((a) => a.id)).toEqual(['a']);
    expect(g.high.map((a) => a.id)).toEqual(['b']);
    expect(g.monitoring.map((a) => a.id)).toEqual(['c', 'd', 'e']);
  });

  it('sorts each bucket newest-first by publishedAt', () => {
    const g = groupByPriority([p1, p1Newer]);
    expect(g.critical.map((a) => a.id)).toEqual(['a2', 'a']);
  });

  it('returns empty buckets when given no alerts', () => {
    const g = groupByPriority([]);
    expect(g.critical).toEqual([]);
    expect(g.high).toEqual([]);
    expect(g.monitoring).toEqual([]);
  });
});

describe('countByPriority', () => {
  it('counts P1/P2/other into critical/high/monitoring', () => {
    const alerts = [
      toProcessedAlert(makeSignal({ id: '1', priority: 'P1' })),
      toProcessedAlert(makeSignal({ id: '2', priority: 'P1' })),
      toProcessedAlert(makeSignal({ id: '3', priority: 'P2' })),
      toProcessedAlert(makeSignal({ id: '4', priority: 'P3' })),
      toProcessedAlert(makeSignal({ id: '5', priority: 'P4' })),
      toProcessedAlert(makeSignal({ id: '6' })),
    ];
    expect(countByPriority(alerts)).toEqual({ critical: 2, high: 1, monitoring: 3 });
  });

  it('returns zeros for an empty list', () => {
    expect(countByPriority([])).toEqual({ critical: 0, high: 0, monitoring: 0 });
  });
});

describe('formatRelativeTime', () => {
  const now = new Date('2026-04-22T12:00:00Z');

  it('returns em-dash for missing or unparseable input', () => {
    expect(formatRelativeTime(undefined, now)).toBe('—');
    expect(formatRelativeTime('', now)).toBe('—');
    expect(formatRelativeTime('not-a-date', now)).toBe('—');
  });

  it('returns "Just now" for recent times and future drift', () => {
    expect(formatRelativeTime('2026-04-22T11:59:30Z', now)).toBe('Just now');
    expect(formatRelativeTime('2026-04-22T12:00:10Z', now)).toBe('Just now');
  });

  it('uses hours within the last day', () => {
    expect(formatRelativeTime('2026-04-22T09:00:00Z', now)).toBe('3h ago');
    expect(formatRelativeTime('2026-04-21T13:00:00Z', now)).toBe('23h ago');
  });

  it('uses days within the last week', () => {
    expect(formatRelativeTime('2026-04-20T12:00:00Z', now)).toBe('2d ago');
    expect(formatRelativeTime('2026-04-16T12:00:00Z', now)).toBe('6d ago');
  });

  it('falls back to a locale date string for anything older', () => {
    const older = formatRelativeTime('2026-03-01T12:00:00Z', now);
    expect(older).not.toBe('—');
    expect(older).not.toMatch(/ago$/);
  });
});
