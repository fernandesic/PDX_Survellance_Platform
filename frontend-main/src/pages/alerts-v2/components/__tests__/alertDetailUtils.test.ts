import { describe, it, expect } from 'vitest';
import {
  aiClassificationPresentation,
  aiScopeLabel,
  aiSeverityLabel,
  buildSignalCsv,
  buildSignalCsvFilename,
  buildSignalsCsv,
  buildSignalsCsvFilename,
  buildTimeline,
  computeCFR,
  formatCFR,
  formatDateTime,
  languageLabel,
} from '../alertDetailUtils';
import type { Signal } from '../../types';

function makeSignal(overrides: Partial<Signal> = {}): Signal {
  return {
    id: overrides.id ?? 's-1',
    location: overrides.location ?? {},
    ...overrides,
  } as Signal;
}

describe('computeCFR', () => {
  it('returns percentage deaths/cases when both positive', () => {
    expect(computeCFR(100, 10)).toBe(10);
    expect(computeCFR(200, 1)).toBeCloseTo(0.5);
  });

  it('returns null when cases is non-positive', () => {
    expect(computeCFR(0, 0)).toBeNull();
    expect(computeCFR(-5, 1)).toBeNull();
  });

  it('returns null for missing inputs', () => {
    expect(computeCFR(undefined, 1)).toBeNull();
    expect(computeCFR(1, undefined)).toBeNull();
    expect(computeCFR(null, null)).toBeNull();
  });

  it('returns null when deaths exceed cases (bad data)', () => {
    expect(computeCFR(5, 10)).toBeNull();
  });

  it('returns null when deaths is negative', () => {
    expect(computeCFR(10, -1)).toBeNull();
  });
});

describe('formatCFR', () => {
  it('formats a number to one decimal place with percent', () => {
    expect(formatCFR(12.345)).toBe('12.3%');
    expect(formatCFR(0)).toBe('0.0%');
  });

  it('renders em-dash for null', () => {
    expect(formatCFR(null)).toBe('—');
  });
});

describe('languageLabel', () => {
  it('maps known codes to human names', () => {
    expect(languageLabel('en')).toBe('English');
    expect(languageLabel('FR')).toBe('Français');
  });

  it('falls back to the code itself for unknown codes', () => {
    expect(languageLabel('xx')).toBe('xx');
  });

  it('returns Unknown for empty/undefined', () => {
    expect(languageLabel(undefined)).toBe('Unknown');
    expect(languageLabel('')).toBe('Unknown');
  });
});

describe('aiClassificationPresentation', () => {
  it('maps each classification to a distinct tone', () => {
    expect(aiClassificationPresentation('continent_alert').tone).toBe('red');
    expect(aiClassificationPresentation('area_alert').tone).toBe('orange');
    expect(aiClassificationPresentation('no_alert').tone).toBe('emerald');
    expect(aiClassificationPresentation('uncertain').tone).toBe('slate');
  });

  it('defaults to a neutral "Not classified" label when missing', () => {
    const pres = aiClassificationPresentation(undefined);
    expect(pres.label).toMatch(/Not classified/i);
    expect(pres.tone).toBe('slate');
  });
});

describe('aiSeverityLabel and aiScopeLabel', () => {
  it('capitalises severity labels', () => {
    expect(aiSeverityLabel('critical')).toBe('Critical');
    expect(aiSeverityLabel('low')).toBe('Low');
  });

  it('returns Unknown for missing severity', () => {
    expect(aiSeverityLabel(undefined)).toBe('Unknown');
  });

  it('maps scopes to labelled strings', () => {
    expect(aiScopeLabel('worldwide')).toContain('Worldwide');
    expect(aiScopeLabel('continental')).toContain('Continental');
    expect(aiScopeLabel('local')).toContain('Local');
    expect(aiScopeLabel(undefined)).toBe('—');
  });
});

describe('buildTimeline', () => {
  it('produces the three fixed steps', () => {
    const steps = buildTimeline(makeSignal());
    expect(steps.map((s) => s.key)).toEqual(['created', 'source', 'classified']);
  });

  it('renders em-dash when an iso is missing', () => {
    const steps = buildTimeline(makeSignal());
    expect(steps.every((s) => s.display === '—')).toBe(true);
  });

  it('fills display when iso is provided', () => {
    const steps = buildTimeline(
      makeSignal({ created_at: '2026-04-22T10:00:00Z' }),
    );
    const created = steps.find((s) => s.key === 'created');
    expect(created?.display).not.toBe('—');
  });
});

describe('formatDateTime', () => {
  it('returns em-dash for missing or unparseable', () => {
    expect(formatDateTime(undefined)).toBe('—');
    expect(formatDateTime('not-a-date')).toBe('—');
  });

  it('returns a non-dash string for a valid iso', () => {
    expect(formatDateTime('2026-04-22T10:00:00Z')).not.toBe('—');
  });
});

describe('buildSignalCsv', () => {
  it('contains header and a data row separated by CRLF', () => {
    const csv = buildSignalCsv(
      makeSignal({
        id: 'sig-42',
        priority: 'P1',
        disease_name: 'Cholera',
        reported_cases: 100,
        reported_deaths: 12,
        location: { iso3: 'NGA', country: 'Nigeria' },
        source: { name: 'WHO', tier: 1 },
        source_url: 'https://who.int/x',
      }),
    );
    const [header, row] = csv.trim().split('\r\n');
    expect(header).toContain('id');
    expect(header).toContain('ai_classification');
    expect(row).toContain('sig-42');
    expect(row).toContain('P1');
    expect(row).toContain('Cholera');
    expect(row).toContain('NGA');
  });

  it('escapes cells containing commas or quotes', () => {
    const csv = buildSignalCsv(
      makeSignal({ id: 'sig-1', headline: 'Hello, "world"' }),
    );
    expect(csv).toContain('"Hello, ""world"""');
  });

  it('handles missing optional fields without throwing', () => {
    const csv = buildSignalCsv(makeSignal({ id: 'sig-2' }));
    expect(csv.split('\r\n')[1].startsWith('sig-2,')).toBe(true);
  });
});

describe('buildSignalCsvFilename', () => {
  it('includes iso3 and id', () => {
    const name = buildSignalCsvFilename(
      makeSignal({ id: 'sig-9', location: { iso3: 'nga' } }),
      new Date('2026-04-22T00:00:00Z'),
    );
    expect(name).toContain('NGA');
    expect(name).toContain('sig-9');
    expect(name).toMatch(/\.csv$/);
  });

  it('falls back to SIG prefix when iso3 is unknown', () => {
    const name = buildSignalCsvFilename(
      makeSignal({ id: 'sig-9' }),
      new Date('2026-04-22T00:00:00Z'),
    );
    expect(name.startsWith('alert_SIG_')).toBe(true);
  });
});

describe('buildSignalsCsv', () => {
  it('emits one header row followed by one row per signal', () => {
    const csv = buildSignalsCsv([
      makeSignal({ id: 'a', priority: 'P1', disease_name: 'Cholera' }),
      makeSignal({ id: 'b', priority: 'P2', disease_name: 'Measles' }),
    ]);
    const lines = csv.trim().split('\r\n');
    expect(lines).toHaveLength(3);
    expect(lines[0]).toContain('id');
    expect(lines[1]).toContain('a');
    expect(lines[1]).toContain('Cholera');
    expect(lines[2]).toContain('b');
    expect(lines[2]).toContain('Measles');
  });

  it('returns just the header when given an empty list', () => {
    const csv = buildSignalsCsv([]);
    const lines = csv.trim().split('\r\n');
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('id');
  });

  it('escapes commas and quotes across multiple rows', () => {
    const csv = buildSignalsCsv([
      makeSignal({ id: 'a', headline: 'A, B' }),
      makeSignal({ id: 'b', headline: 'with "quotes"' }),
    ]);
    expect(csv).toContain('"A, B"');
    expect(csv).toContain('"with ""quotes"""');
  });
});

describe('buildSignalsCsvFilename', () => {
  it('uses iso3 when present', () => {
    expect(
      buildSignalsCsvFilename('Nigeria', 'NGA', new Date('2026-04-22T00:00:00Z')),
    ).toBe('sitrep_NGA_2026-04-22.csv');
  });

  it('falls back to a sanitised country name when iso3 is missing', () => {
    expect(
      buildSignalsCsvFilename('DR Congo', '', new Date('2026-04-22T00:00:00Z')),
    ).toBe('sitrep_DR_CONGO_2026-04-22.csv');
  });

  it('falls back to REGION when both are empty', () => {
    expect(
      buildSignalsCsvFilename('', '', new Date('2026-04-22T00:00:00Z')),
    ).toBe('sitrep_REGION_2026-04-22.csv');
  });
});
