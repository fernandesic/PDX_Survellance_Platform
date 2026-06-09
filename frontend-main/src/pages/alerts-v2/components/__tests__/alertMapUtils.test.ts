import { describe, it, expect } from 'vitest';
import {
  countByIso,
  countPlottable,
  getAlertLevel,
  getSignalCoords,
  heatFillRgba,
  isPulsingPriority,
  markerSizePx,
  priorityRgb,
  shouldPlotSignal,
} from '../alertMapUtils';
import type { Signal } from '../../types';

function makeSignal(overrides: Partial<Signal> = {}): Signal {
  return {
    id: overrides.id ?? 's-1',
    location: overrides.location ?? {},
    ...overrides,
  } as Signal;
}

describe('getSignalCoords', () => {
  it('reads [lng, lat] tuple coordinates', () => {
    const s = makeSignal({ location: { coordinates: [7.48, 9.08] } });
    expect(getSignalCoords(s)).toEqual([7.48, 9.08]);
  });

  it('reads { lat, lng } object coordinates', () => {
    const s = makeSignal({ location: { coordinates: { lat: 9.08, lng: 7.48 } } });
    expect(getSignalCoords(s)).toEqual([7.48, 9.08]);
  });

  it('falls back to top-level location_lat / location_lng', () => {
    const s = makeSignal({ location_lat: -1.94, location_lng: 29.87, location: {} });
    expect(getSignalCoords(s)).toEqual([29.87, -1.94]);
  });

  it('returns null when nothing usable is present', () => {
    expect(getSignalCoords(makeSignal())).toBeNull();
  });

  it('returns null for malformed tuple', () => {
    const s = makeSignal({
      location: { coordinates: ['x' as unknown as number, 5 as number] as [number, number] },
    });
    expect(getSignalCoords(s)).toBeNull();
  });
});

describe('shouldPlotSignal', () => {
  it('drops signals with no coordinates', () => {
    expect(shouldPlotSignal(makeSignal())).toBe(false);
  });

  it('drops the 0,0 null-island sentinel', () => {
    expect(shouldPlotSignal(makeSignal({ location: { coordinates: [0, 0] } }))).toBe(false);
  });

  it('keeps valid African coordinates', () => {
    expect(shouldPlotSignal(makeSignal({ location: { coordinates: [7.48, 9.08] } }))).toBe(true);
  });

  it('keeps coordinates where only one axis is zero', () => {
    expect(shouldPlotSignal(makeSignal({ location: { coordinates: [0, 9.08] } }))).toBe(true);
    expect(shouldPlotSignal(makeSignal({ location: { coordinates: [7.48, 0] } }))).toBe(true);
  });
});

describe('getAlertLevel', () => {
  it('prefers priority over level', () => {
    expect(getAlertLevel(makeSignal({ priority: 'P1', level: 'P4' }))).toBe('P1');
  });

  it('falls back to level when priority is missing', () => {
    expect(getAlertLevel(makeSignal({ level: 'P2' }))).toBe('P2');
  });

  it('defaults to P4 on unknown input', () => {
    expect(getAlertLevel(makeSignal())).toBe('P4');
  });
});

describe('priorityRgb / markerSizePx / isPulsingPriority', () => {
  it('returns red/orange/amber/gray for P1..P4', () => {
    expect(priorityRgb('P1')).toEqual([239, 68, 68]);
    expect(priorityRgb('P2')).toEqual([251, 146, 60]);
    expect(priorityRgb('P3')).toEqual([245, 158, 11]);
    expect(priorityRgb('P4')).toEqual([148, 163, 184]);
  });

  it('grows markers for higher-severity alerts', () => {
    expect(markerSizePx('P1')).toBeGreaterThan(markerSizePx('P2'));
    expect(markerSizePx('P2')).toBeGreaterThan(markerSizePx('P3'));
    expect(markerSizePx('P3')).toBeGreaterThan(markerSizePx('P4'));
  });

  it('only P1 and P2 pulse', () => {
    expect(isPulsingPriority('P1')).toBe(true);
    expect(isPulsingPriority('P2')).toBe(true);
    expect(isPulsingPriority('P3')).toBe(false);
    expect(isPulsingPriority('P4')).toBe(false);
  });
});

describe('countByIso', () => {
  it('counts plottable signals per ISO2 country code', () => {
    const signals = [
      makeSignal({ id: '1', location: { iso3: 'NGA', coordinates: [7.48, 9.08] } }),
      makeSignal({ id: '2', location: { iso3: 'NGA', coordinates: [8.0, 10.0] } }),
      makeSignal({ id: '3', location: { country_iso: 'KEN', coordinates: [37.9, -0.02] } }),
      // Zero-island: should be ignored.
      makeSignal({ id: '4', location: { iso3: 'ETH', coordinates: [0, 0] } }),
      // No coords: should be ignored.
      makeSignal({ id: '5', location: { iso3: 'GHA' } }),
    ];
    expect(countByIso(signals)).toEqual({ NG: 2, KE: 1 });
  });

  it('returns an empty object when no signals qualify', () => {
    expect(countByIso([])).toEqual({});
    expect(countByIso([makeSignal({ location: { coordinates: [0, 0] } })])).toEqual({});
  });
});

describe('heatFillRgba', () => {
  it('scales color from yellow to red as count grows', () => {
    expect(heatFillRgba(0)).toEqual([255, 255, 255, 0]);
    expect(heatFillRgba(1)).toEqual([250, 204, 21, 0.6]);
    expect(heatFillRgba(3)).toEqual([251, 146, 60, 0.6]);
    expect(heatFillRgba(6)).toEqual([239, 68, 68, 0.6]);
  });
});

describe('countPlottable', () => {
  it('counts only signals that would actually appear on the map', () => {
    const signals = [
      makeSignal({ id: '1', location: { coordinates: [7.48, 9.08] } }),
      makeSignal({ id: '2', location: { coordinates: [0, 0] } }),
      makeSignal({ id: '3' }),
      makeSignal({ id: '4', location_lat: -1.94, location_lng: 29.87, location: {} }),
    ];
    expect(countPlottable(signals)).toBe(2);
  });
});
