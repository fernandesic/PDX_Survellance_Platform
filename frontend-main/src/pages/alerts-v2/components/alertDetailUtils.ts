import type {
  AiClassification,
  AiNotificationScope,
  AiSeverity,
  Signal,
} from '../types';

export const LANG_LABELS: Record<string, string> = {
  en: 'English',
  fr: 'Français',
  ha: 'Hausa',
  pt: 'Português',
  sw: 'Kiswahili',
  ar: 'العربية',
  yo: 'Yorùbá',
  am: 'አማርኛ',
};

export function languageLabel(code?: string): string {
  if (!code) return 'Unknown';
  return LANG_LABELS[code.toLowerCase()] ?? code;
}

/**
 * Case-fatality rate as a percentage. Returns null when cases are missing,
 * non-positive, or deaths exceed cases (bad data).
 */
export function computeCFR(
  cases?: number | null,
  deaths?: number | null,
): number | null {
  if (typeof cases !== 'number' || typeof deaths !== 'number') return null;
  if (cases <= 0 || deaths < 0) return null;
  if (deaths > cases) return null;
  return (deaths / cases) * 100;
}

export function formatCFR(cfr: number | null): string {
  if (cfr === null) return '—';
  return `${cfr.toFixed(1)}%`;
}

export interface TimelineStep {
  key: 'created' | 'source' | 'classified';
  label: string;
  iso?: string;
  display: string;
  complete: boolean;
}

export function buildTimeline(signal: Signal): TimelineStep[] {
  return [
    {
      key: 'created',
      label: 'Ingested',
      iso: signal.created_at,
      display: formatDateTime(signal.created_at),
      complete: Boolean(signal.created_at),
    },
    {
      key: 'source',
      label: 'Published',
      iso: signal.source_timestamp ?? signal.publishedAt,
      display: formatDateTime(signal.source_timestamp ?? signal.publishedAt),
      complete: Boolean(signal.source_timestamp ?? signal.publishedAt),
    },
    {
      key: 'classified',
      label: 'AI Classified',
      iso: signal.ai_classified_at,
      display: formatDateTime(signal.ai_classified_at),
      complete: Boolean(signal.ai_classified_at),
    },
  ];
}

export function formatDateTime(iso?: string): string {
  if (!iso) return '—';
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return '—';
  return new Date(ts).toLocaleString();
}

export interface AiClassificationPresentation {
  label: string;
  tone: 'red' | 'orange' | 'emerald' | 'slate';
}

export function aiClassificationPresentation(
  c?: AiClassification,
): AiClassificationPresentation {
  switch (c) {
    case 'continent_alert':
      return { label: '🌍 Continent alert', tone: 'red' };
    case 'area_alert':
      return { label: '📍 Area alert', tone: 'orange' };
    case 'no_alert':
      return { label: '✓ No alert', tone: 'emerald' };
    case 'uncertain':
      return { label: '? Uncertain', tone: 'slate' };
    default:
      return { label: 'Not classified', tone: 'slate' };
  }
}

export function aiSeverityLabel(s?: AiSeverity): string {
  if (!s) return 'Unknown';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function aiScopeLabel(s?: AiNotificationScope): string {
  switch (s) {
    case 'worldwide':
      return '🌐 Worldwide';
    case 'continental':
      return '🌍 Continental';
    case 'local':
      return '📍 Local';
    default:
      return '—';
  }
}

const CSV_COLUMNS: Array<{ header: string; get: (s: Signal) => unknown }> = [
  { header: 'id', get: (s) => s.id },
  { header: 'priority', get: (s) => s.priority ?? s.level ?? '' },
  { header: 'status', get: (s) => s.status ?? '' },
  { header: 'disease', get: (s) => s.disease_name ?? '' },
  { header: 'headline', get: (s) => s.headline ?? '' },
  { header: 'summary', get: (s) => s.summary ?? '' },
  { header: 'country', get: (s) => s.location?.country ?? '' },
  { header: 'iso3', get: (s) => s.location?.iso3 ?? s.location?.country_iso ?? '' },
  { header: 'cases', get: (s) => s.reported_cases ?? '' },
  { header: 'deaths', get: (s) => s.reported_deaths ?? '' },
  { header: 'cross_border_risk', get: (s) => (s.cross_border_risk ? 'true' : 'false') },
  { header: 'source_name', get: (s) => s.source?.name ?? s.source_name ?? '' },
  { header: 'source_url', get: (s) => s.source?.url ?? s.source_url ?? '' },
  { header: 'source_tier', get: (s) => s.source?.tier ?? s.source_tier ?? '' },
  { header: 'ai_classification', get: (s) => s.ai_classification ?? '' },
  { header: 'ai_severity', get: (s) => s.ai_severity ?? '' },
  { header: 'ai_notification_scope', get: (s) => s.ai_notification_scope ?? '' },
  { header: 'ai_reasoning', get: (s) => s.ai_reasoning ?? '' },
  { header: 'ingestion_source', get: (s) => s.ingestion_source ?? '' },
  { header: 'created_at', get: (s) => s.created_at ?? '' },
  { header: 'source_timestamp', get: (s) => s.source_timestamp ?? '' },
  { header: 'ai_classified_at', get: (s) => s.ai_classified_at ?? '' },
];

function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/** Produce an RFC-4180-style CSV string for a single signal. */
export function buildSignalCsv(signal: Signal): string {
  const header = CSV_COLUMNS.map((c) => c.header).join(',');
  const row = CSV_COLUMNS.map((c) => escapeCsvCell(c.get(signal))).join(',');
  return `${header}\r\n${row}\r\n`;
}

export function buildSignalCsvFilename(signal: Signal, now: Date = new Date()): string {
  const iso3 =
    (signal.location?.iso3 || signal.location?.country_iso || 'SIG').toUpperCase();
  const stamp = now.toISOString().slice(0, 10);
  return `alert_${iso3}_${signal.id}_${stamp}.csv`;
}

/**
 * RFC-4180-style CSV for a batch of signals — one header row followed by one
 * row per signal. Used by the SitRep flow to export every signal from the
 * same country in a single file.
 */
export function buildSignalsCsv(signals: Signal[]): string {
  const header = CSV_COLUMNS.map((c) => c.header).join(',');
  const rows = signals.map((s) =>
    CSV_COLUMNS.map((c) => escapeCsvCell(c.get(s))).join(','),
  );
  return [header, ...rows].join('\r\n') + '\r\n';
}

export function buildSignalsCsvFilename(
  country: string,
  iso3: string,
  now: Date = new Date(),
): string {
  const code = (iso3 || country || 'REGION').toUpperCase().replace(/[^A-Z0-9]+/g, '_');
  const stamp = now.toISOString().slice(0, 10);
  return `sitrep_${code}_${stamp}.csv`;
}
