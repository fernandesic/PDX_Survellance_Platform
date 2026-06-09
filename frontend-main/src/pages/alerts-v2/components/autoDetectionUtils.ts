import type { AutoDetection, Signal } from '../types';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function signalTimestamp(signal: Signal): number {
  const raw =
    signal.source_timestamp ??
    signal.publishedAt ??
    signal.created_at ??
    null;
  if (!raw) return 0;
  const t = Date.parse(raw);
  return Number.isNaN(t) ? 0 : t;
}

/**
 * Pick the freshest P1/P2 signal from the last 7 days and shape it into the
 * AutoDetection the popup expects. Returns an empty array when no signal
 * qualifies — the popup then renders nothing.
 *
 * We derive this on the frontend instead of calling a new backend endpoint
 * because alerts-v2 already holds the classified signals the Monitor/Review
 * agents produced; the popup is a view over that same data.
 */
export function toAutoDetections(
  signals: Signal[],
  now: Date = new Date(),
): AutoDetection[] {
  if (!signals || signals.length === 0) return [];
  const cutoff = now.getTime() - SEVEN_DAYS_MS;

  const candidates = signals.filter((s) => {
    const p = s.priority ?? s.level;
    if (p !== 'P1' && p !== 'P2') return false;
    const ts = signalTimestamp(s);
    return ts > 0 && ts >= cutoff;
  });

  if (candidates.length === 0) return [];

  candidates.sort((a, b) => signalTimestamp(b) - signalTimestamp(a));
  const top = candidates[0];

  const signalType = top.signal_type ?? 'disease';
  const headline = top.disease_name || top.headline || 'Unknown event';
  const summary =
    top.summary ||
    top.translated_text ||
    top.original_text ||
    '';
  const description = summary && summary !== headline ? summary.slice(0, 200) : '';
  const country = top.location?.country || top.location?.iso3 || 'Unknown location';

  return [
    {
      id: `DET-${top.id}`,
      type: signalType === 'hazard' ? 'ANOMALY_DETECTED' : 'VIRAL_SURGE',
      severity: top.priority === 'P1' ? 'CRITICAL' : 'HIGH',
      title: headline,
      description,
      location: country,
      metric: 'Verified live event',
    },
  ];
}
