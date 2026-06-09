import type { Incident } from '../types';

export interface IncidentRow {
  id: number;
  incidentName: string;
  countryName: string;
  state?: string;
  category: string;
  year: string;
  afro: string;
  global: string;
  durationLabel: string;
}

function coerceText(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

/** Compute duration in whole days between two ISO date strings. Returns null when either is missing or unparseable. */
export function computeIncidentDurationDays(
  startDate?: string,
  endDate?: string,
): number | null {
  if (!startDate || !endDate) return null;
  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
  return Math.ceil((end - start) / (24 * 60 * 60 * 1000));
}

export function formatIncidentDuration(
  startDate?: string,
  endDate?: string,
): string {
  const days = computeIncidentDurationDays(startDate, endDate);
  if (days === null) {
    if (startDate && !endDate) return 'Ongoing';
    return '—';
  }
  if (days <= 0) return '1 day';
  if (days === 1) return '1 day';
  if (days < 30) return `${days} days`;
  const months = Math.round(days / 30);
  return months <= 1 ? '~1 month' : `~${months} months`;
}

/** Derive the flat row shape the UI renders from the nested Incident. */
export function toIncidentRow(incident: Incident): IncidentRow {
  const data = incident.ihmref_data ?? ({} as Incident['ihmref_data']);
  const country = incident.country ?? ({} as Incident['country']);
  return {
    id: incident.id,
    incidentName: coerceText(incident.incident) || 'General Incident',
    countryName: coerceText(country?.country) || '—',
    state: coerceText(country?.state) || undefined,
    category: coerceText(data?.category).replace(/_/g, ' ') || '—',
    year: coerceText(data?.year) || '—',
    afro: data?.afro !== undefined && data?.afro !== null ? String(data.afro) : '—',
    global: data?.global_t !== undefined && data?.global_t !== null ? String(data.global_t) : '—',
    durationLabel: formatIncidentDuration(incident.start_date, incident.end_date),
  };
}

/** Case-insensitive filter on incident name / country / category. */
export function filterIncidents(incidents: Incident[], query: string): Incident[] {
  const q = query.trim().toLowerCase();
  if (!q) return incidents;
  return incidents.filter((i) => {
    const name = (i.incident ?? '').toLowerCase();
    const country = (i.country?.country ?? '').toLowerCase();
    const category = (i.ihmref_data?.category ?? '').toLowerCase();
    return name.includes(q) || country.includes(q) || category.includes(q);
  });
}
