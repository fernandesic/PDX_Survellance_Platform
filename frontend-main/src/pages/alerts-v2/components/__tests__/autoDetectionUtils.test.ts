import { describe, it, expect } from 'vitest';
import { toAutoDetections } from '../autoDetectionUtils';
import type { Signal } from '../../types';

const NOW = new Date('2026-04-24T12:00:00Z');

function sig(overrides: Partial<Signal> = {}): Signal {
  return {
    id: overrides.id ?? 's-1',
    location: overrides.location ?? {},
    ...overrides,
  } as Signal;
}

describe('toAutoDetections', () => {
  it('returns [] when there are no signals', () => {
    expect(toAutoDetections([], NOW)).toEqual([]);
  });

  it('returns [] when no signal is P1/P2', () => {
    const signals = [
      sig({ id: '1', priority: 'P3', publishedAt: '2026-04-24T10:00:00Z' }),
      sig({ id: '2', priority: 'P4', publishedAt: '2026-04-24T11:00:00Z' }),
    ];
    expect(toAutoDetections(signals, NOW)).toEqual([]);
  });

  it('ignores P1/P2 signals older than 7 days', () => {
    const signals = [
      sig({ id: 'old', priority: 'P1', publishedAt: '2026-04-10T00:00:00Z' }),
    ];
    expect(toAutoDetections(signals, NOW)).toEqual([]);
  });

  it('picks the freshest P1/P2 signal in the last 7 days', () => {
    const signals = [
      sig({
        id: 'older-p1',
        priority: 'P1',
        disease_name: 'Cholera',
        publishedAt: '2026-04-20T10:00:00Z',
        location: { country: 'Nigeria' },
      }),
      sig({
        id: 'fresh-p1',
        priority: 'P1',
        disease_name: 'Ebola',
        publishedAt: '2026-04-24T08:00:00Z',
        location: { country: 'DRC' },
        signal_type: 'disease',
      }),
      sig({
        id: 'fresh-p3',
        priority: 'P3',
        publishedAt: '2026-04-24T11:00:00Z',
      }),
    ];

    const result = toAutoDetections(signals, NOW);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 'DET-fresh-p1',
      type: 'VIRAL_SURGE',
      severity: 'CRITICAL',
      title: 'Ebola',
      location: 'DRC',
    });
  });

  it('maps P2 disease signals to HIGH severity', () => {
    const signals = [
      sig({
        id: 'p2',
        priority: 'P2',
        disease_name: 'Measles',
        publishedAt: '2026-04-24T08:00:00Z',
        location: { country: 'Kenya' },
      }),
    ];
    expect(toAutoDetections(signals, NOW)[0].severity).toBe('HIGH');
  });

  it('maps hazard signals to ANOMALY_DETECTED', () => {
    const signals = [
      sig({
        id: 'haz',
        priority: 'P1',
        signal_type: 'hazard',
        publishedAt: '2026-04-24T08:00:00Z',
        headline: 'Flood in Mozambique',
        location: { country: 'Mozambique' },
      }),
    ];
    expect(toAutoDetections(signals, NOW)[0].type).toBe('ANOMALY_DETECTED');
  });

  it('truncates a long summary to 200 characters', () => {
    const long = 'A'.repeat(500);
    const signals = [
      sig({
        id: 'long',
        priority: 'P1',
        disease_name: 'Cholera',
        summary: long,
        publishedAt: '2026-04-24T08:00:00Z',
      }),
    ];
    expect(toAutoDetections(signals, NOW)[0].description.length).toBe(200);
  });

  it('leaves description empty when summary equals the headline', () => {
    const signals = [
      sig({
        id: 's',
        priority: 'P1',
        disease_name: 'Cholera',
        summary: 'Cholera',
        publishedAt: '2026-04-24T08:00:00Z',
      }),
    ];
    expect(toAutoDetections(signals, NOW)[0].description).toBe('');
  });
});
