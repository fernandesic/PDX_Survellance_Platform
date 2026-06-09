import type { AlertLevel, Signal } from '../types';

export type RGBA = [number, number, number, number];

export const PRIORITY_RGB: Record<AlertLevel, [number, number, number]> = {
  P1: [239, 68, 68],
  P2: [251, 146, 60],
  P3: [245, 158, 11],
  P4: [148, 163, 184],
};

/**
 * Pull a [lng, lat] pair off a Signal regardless of which shape the backend
 * used (object, tuple, or top-level `location_lat`/`location_lng`). Returns
 * null when either axis is missing or non-numeric.
 */
export function getSignalCoords(signal: Signal): [number, number] | null {
  const coords = signal.location?.coordinates;

  if (Array.isArray(coords) && coords.length >= 2) {
    const [lng, lat] = coords;
    if (typeof lng === 'number' && typeof lat === 'number') return [lng, lat];
  }

  if (coords && typeof coords === 'object' && 'lat' in coords && 'lng' in coords) {
    const { lat, lng } = coords as { lat: number; lng: number };
    if (typeof lng === 'number' && typeof lat === 'number') return [lng, lat];
  }

  const topLat = signal.location_lat;
  const topLng = signal.location_lng;
  if (typeof topLat === 'number' && typeof topLng === 'number') {
    return [topLng, topLat];
  }

  return null;
}

/**
 * Drop signals that have no coords or that sit at the 0,0 null-island.
 * ArcGIS will happily plot these in the Gulf of Guinea and spook officers.
 */
export function shouldPlotSignal(signal: Signal): boolean {
  const coords = getSignalCoords(signal);
  if (!coords) return false;
  const [lng, lat] = coords;
  if (lng === 0 && lat === 0) return false;
  return true;
}

export function getAlertLevel(signal: Signal): AlertLevel {
  const raw = signal.priority ?? signal.level;
  if (raw === 'P1' || raw === 'P2' || raw === 'P3' || raw === 'P4') return raw;
  return 'P4';
}

export function priorityRgb(priority: AlertLevel): [number, number, number] {
  return PRIORITY_RGB[priority] ?? PRIORITY_RGB.P4;
}

/** P1 / P2 get the pulsing halo — these are the alerts officers should look at first. */
export function isPulsingPriority(priority: AlertLevel): boolean {
  return priority === 'P1' || priority === 'P2';
}

export function markerSizePx(priority: AlertLevel): number {
  if (priority === 'P1') return 18;
  if (priority === 'P2') return 14;
  if (priority === 'P3') return 11;
  return 9;
}

/** Aggregate plottable signals per country for the choropleth layer. */
export function countByIso(signals: Signal[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const s of signals) {
    if (!shouldPlotSignal(s)) continue;
    const iso2 = (s.location?.country_iso || s.location?.iso3 || '').slice(0, 2).toUpperCase();
    if (!iso2) continue;
    counts[iso2] = (counts[iso2] || 0) + 1;
  }
  return counts;
}

/** Choropleth fill for a country bucket — transparent when there's nothing to show. */
export function heatFillRgba(count: number): RGBA {
  if (count > 5) return [239, 68, 68, 0.6];
  if (count > 2) return [251, 146, 60, 0.6];
  if (count > 0) return [250, 204, 21, 0.6];
  return [255, 255, 255, 0];
}

export function countPlottable(signals: Signal[]): number {
  let n = 0;
  for (const s of signals) if (shouldPlotSignal(s)) n += 1;
  return n;
}
