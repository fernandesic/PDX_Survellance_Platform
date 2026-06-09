import { AFRO_COUNTRY_BY_ISO } from '../constants';
import type { AlertLevel, ProcessedAlert, Signal } from '../types';

export interface PriorityGroups {
  critical: ProcessedAlert[];
  high: ProcessedAlert[];
  monitoring: ProcessedAlert[];
}

export interface PriorityCounts {
  critical: number;
  high: number;
  monitoring: number;
}

function isAlertLevel(value: unknown): value is AlertLevel {
  return value === 'P1' || value === 'P2' || value === 'P3' || value === 'P4';
}

function coerceText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** Derive the card-shaped ProcessedAlert from a raw Signal. */
export function toProcessedAlert(signal: Signal): ProcessedAlert {
  const rawPriority = signal.priority ?? signal.level;
  const priority: AlertLevel = isAlertLevel(rawPriority) ? rawPriority : 'P4';

  const iso3 =
    coerceText(signal.location?.iso3) ||
    coerceText(signal.location?.country_iso);
  const country = AFRO_COUNTRY_BY_ISO[iso3];
  const countryName = country?.name || coerceText(signal.location?.country) || 'Unknown location';
  const flag = country?.flag || '🌍';

  const diseaseName = coerceText(signal.disease_name);
  const headline =
    coerceText(signal.headline) ||
    coerceText(signal.summary) ||
    coerceText(signal.translated_text) ||
    coerceText(signal.original_text);
  // Prefer the full headline — it's what tells the story ("Kenya: Govt to
  // Clear Sh116mn Eduafya Claims By May 8 - MoH"). Disease name on its own
  // is too sparse for the feed card.
  const title = headline || diseaseName || 'Untitled alert';

  const sourceTierRaw = signal.source?.tier ?? signal.source_tier ?? 3;
  const sourceTierNum =
    typeof sourceTierRaw === 'string' ? parseInt(sourceTierRaw, 10) : sourceTierRaw;
  const sourceTier = (sourceTierNum === 0 || sourceTierNum === 1 || sourceTierNum === 2 ? sourceTierNum : 3) as 0 | 1 | 2 | 3;
  const sourceName = coerceText(signal.source?.name) || coerceText(signal.source_name) || 'Unknown source';

  return {
    id: signal.id,
    priority,
    title,
    countryName,
    countryIso3: iso3,
    flag,
    diseaseName,
    cases: typeof signal.reported_cases === 'number' ? signal.reported_cases : undefined,
    deaths: typeof signal.reported_deaths === 'number' ? signal.reported_deaths : undefined,
    sourceName,
    sourceTier,
    sourceUrl: signal.source?.url || signal.source_url,
    aiSeverity: signal.ai_severity,
    aiClassification: signal.ai_classification,
    confidenceScore: signal.confidence_score,
    originalLanguage: signal.original_language,
    translatedText: signal.translated_text,
    originalText: signal.original_text,
    publishedAt: signal.publishedAt ?? signal.created_at ?? signal.source_timestamp,
    raw: signal,
  };
}

/** Case-insensitive substring search across title / disease / country. */
export function filterBySearch(alerts: ProcessedAlert[], query: string): ProcessedAlert[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return alerts;
  return alerts.filter((a) => {
    const hay = `${a.title} ${a.diseaseName} ${a.countryName} ${a.countryIso3}`.toLowerCase();
    return hay.includes(needle);
  });
}

/**
 * Split alerts into severity buckets. Within each bucket, more-recent alerts
 * float to the top; ties broken by higher case count, so officers see the
 * sharpest signals first.
 */
export function groupByPriority(alerts: ProcessedAlert[]): PriorityGroups {
  const groups: PriorityGroups = { critical: [], high: [], monitoring: [] };
  for (const alert of alerts) {
    if (alert.priority === 'P1') groups.critical.push(alert);
    else if (alert.priority === 'P2') groups.high.push(alert);
    else groups.monitoring.push(alert);
  }
  const parseTs = (iso?: string): number => {
    if (!iso) return 0;
    const ts = Date.parse(iso);
    return Number.isNaN(ts) ? 0 : ts;
  };
  const sorter = (a: ProcessedAlert, b: ProcessedAlert) => {
    const at = parseTs(a.publishedAt);
    const bt = parseTs(b.publishedAt);
    if (bt !== at) return bt - at;
    return (b.cases ?? 0) - (a.cases ?? 0);
  };
  groups.critical.sort(sorter);
  groups.high.sort(sorter);
  groups.monitoring.sort(sorter);
  return groups;
}

export function countByPriority(alerts: ProcessedAlert[]): PriorityCounts {
  const counts: PriorityCounts = { critical: 0, high: 0, monitoring: 0 };
  for (const alert of alerts) {
    if (alert.priority === 'P1') counts.critical += 1;
    else if (alert.priority === 'P2') counts.high += 1;
    else counts.monitoring += 1;
  }
  return counts;
}

/** Relative-time formatter matching the v1 DataRegistry output. */
export function formatRelativeTime(iso?: string, now: Date = new Date()): string {
  if (!iso) return '—';
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return '—';
  const diff = now.getTime() - ts;
  if (diff < 0) return 'Just now';
  const hours = Math.floor(diff / 3_600_000);
  if (hours < 1) return 'Just now';
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString();
}

/** Short relative label for the ribbon's "Last updated" field. */
export function formatLastUpdated(lastUpdatedAt: Date | null, now: Date = new Date()): string {
  if (!lastUpdatedAt) return 'Never';
  const diff = now.getTime() - lastUpdatedAt.getTime();
  if (diff < 0) return 'Just now';
  const secs = Math.floor(diff / 1000);
  if (secs < 5) return 'Just now';
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return lastUpdatedAt.toLocaleString();
}
