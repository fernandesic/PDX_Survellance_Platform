import { describe, it, expect } from 'vitest';
import type { OutbreakCluster } from '@/hooks/useOutbreakDetection';
import {
  CLUSTER_RING_MIN_COUNT,
  clusterCentroid,
  clusterRadiusPx,
  clusterRingColor,
  isRealCountryCluster,
} from '../clusterUtils';
import type { Signal } from '../../types';

function sig(id: string, lng: number | null, lat: number | null): Signal {
  if (lng === null || lat === null) {
    return { id, location: {} } as Signal;
  }
  return {
    id,
    location: { coordinates: [lng, lat] },
  } as Signal;
}

function cluster(
  // Omit the original `signals` from the partial so the alerts-v2 Signal[]
  // we pass in doesn't intersect with the alerts (v1) Signal[] that
  // OutbreakCluster declares — the two have a `location.name` mismatch
  // (optional vs required) that produces a Signal & Signal intersection.
  partial: Omit<Partial<OutbreakCluster>, 'signals'> & { signals: Signal[] },
): OutbreakCluster {
  return {
    disease: partial.disease ?? 'CHOLERA',
    country: partial.country ?? 'Nigeria',
    iso3: partial.iso3 ?? 'NGA',
    count: partial.count ?? partial.signals.length,
    signals: partial.signals as unknown as OutbreakCluster['signals'],
    firstDetected: partial.firstDetected ?? '',
    lastDetected: partial.lastDetected ?? '',
    urgency: partial.urgency ?? 'medium',
  };
}

describe('clusterCentroid', () => {
  it('averages the coords of plottable members', () => {
    const c = cluster({
      signals: [sig('a', 10, 0), sig('b', 20, 10), sig('c', 30, 20)],
    });
    expect(clusterCentroid(c)).toEqual([20, 10]);
  });

  it('ignores members with no coords', () => {
    const c = cluster({
      signals: [sig('a', 10, 0), sig('b', null, null), sig('c', 30, 20)],
    });
    expect(clusterCentroid(c)).toEqual([20, 10]);
  });

  it('returns null when no member has coords', () => {
    const c = cluster({ signals: [sig('a', null, null), sig('b', null, null)] });
    expect(clusterCentroid(c)).toBeNull();
  });
});

describe('clusterRadiusPx', () => {
  it('uses the base size for a 3-signal cluster', () => {
    expect(clusterRadiusPx(3)).toBe(36);
  });

  it('grows for larger clusters', () => {
    expect(clusterRadiusPx(5)).toBe(36 + 2 * 4);
    expect(clusterRadiusPx(8)).toBe(36 + 5 * 4);
  });

  it('clamps at 80px for very large clusters', () => {
    expect(clusterRadiusPx(100)).toBe(80);
  });
});

describe('clusterRingColor', () => {
  it('paints high-urgency clusters red', () => {
    expect(clusterRingColor('high')).toEqual([239, 68, 68]);
  });

  it('paints medium-urgency clusters orange', () => {
    expect(clusterRingColor('medium')).toEqual([251, 146, 60]);
  });

  it('paints low-urgency clusters amber', () => {
    expect(clusterRingColor('low')).toEqual([245, 158, 11]);
  });
});

describe('isRealCountryCluster', () => {
  it('accepts a cluster tied to a known AFRO ISO-3 code', () => {
    const c = cluster({ iso3: 'NGA', disease: 'CHOLERA', signals: [] });
    expect(isRealCountryCluster(c)).toBe(true);
  });

  it('rejects the continent-level AFR placeholder', () => {
    const c = cluster({
      iso3: 'AFR',
      country: 'Africa Region',
      disease: 'MALARIA',
      signals: [],
    });
    expect(isRealCountryCluster(c)).toBe(false);
  });

  it('rejects Unknown iso3', () => {
    const c = cluster({ iso3: 'Unknown', disease: 'CHOLERA', signals: [] });
    expect(isRealCountryCluster(c)).toBe(false);
  });

  it('rejects unknown-disease clusters even with a real country', () => {
    const c = cluster({
      iso3: 'NGA',
      disease: 'UNKNOWN HEALTH THREAT',
      signals: [],
    });
    expect(isRealCountryCluster(c)).toBe(false);
  });

  it('rejects clusters with empty iso3 or disease', () => {
    expect(isRealCountryCluster(cluster({ iso3: '', disease: 'X', signals: [] }))).toBe(false);
    expect(isRealCountryCluster(cluster({ iso3: 'NGA', disease: '', signals: [] }))).toBe(false);
  });
});

describe('CLUSTER_RING_MIN_COUNT', () => {
  it('is at least 5 (keeps the map uncluttered in dense regions)', () => {
    expect(CLUSTER_RING_MIN_COUNT).toBeGreaterThanOrEqual(5);
  });
});
