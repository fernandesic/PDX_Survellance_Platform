import type { OutbreakCluster } from '@/hooks/useOutbreakDetection';
import type { Signal } from '../types';
import { AFRO_COUNTRY_BY_ISO } from '../constants';
import { getSignalCoords } from './alertMapUtils';

export const CLUSTER_RING_MIN_COUNT = 5;

export function isRealCountryCluster(cluster: OutbreakCluster): boolean {
  const iso3 = (cluster.iso3 || '').toUpperCase();
  if (!iso3 || iso3 === 'UNKNOWN') return false;
  if (!AFRO_COUNTRY_BY_ISO[iso3]) return false;
  const disease = (cluster.disease || '').toLowerCase();
  if (!disease || disease === 'unknown' || disease === 'unknown health threat') return false;
  return true;
}

export function clusterCentroid(cluster: OutbreakCluster): [number, number] | null {
  const members = cluster.signals as unknown as Signal[];
  let sumLng = 0;
  let sumLat = 0;
  let n = 0;
  for (const s of members) {
    const c = getSignalCoords(s);
    if (!c) continue;
    sumLng += c[0];
    sumLat += c[1];
    n += 1;
  }
  if (n === 0) return null;
  return [sumLng / n, sumLat / n];
}

/**
 * Ring radius in screen pixels. Grows with cluster count so officers can tell
 * a 3-signal cluster from a 15-signal cluster at a glance, but clamps so a
 * single runaway outbreak doesn't swallow the whole map.
 */
export function clusterRadiusPx(count: number): number {
  const base = 36;
  const grow = Math.max(0, count - 3) * 4;
  return Math.min(base + grow, 80);
}

/** Color the ring red for high-urgency clusters, amber for the rest. */
export function clusterRingColor(
  urgency: OutbreakCluster['urgency'],
): [number, number, number] {
  if (urgency === 'high') return [239, 68, 68];
  if (urgency === 'medium') return [251, 146, 60];
  return [245, 158, 11];
}
