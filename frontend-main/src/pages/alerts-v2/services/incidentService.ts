import { api } from '@/lib/api';
import type { Incident } from '../types';

const INCIDENT_ENDPOINT = '/ihmref/country/incident';

function unwrapList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === 'object' && Array.isArray((data as { results?: unknown }).results)) {
    return (data as { results: T[] }).results;
  }
   
  console.warn('[incidents] unwrapList: unexpected response shape:', typeof data, data);
  return [];
}

export async function fetchIncidentsStrict(country?: string): Promise<Incident[]> {
  // eslint-disable-next-line no-console
  console.log('[incidents] fetching from', INCIDENT_ENDPOINT, country ? `country=${country}` : '(all)');
  const response = await api.get(INCIDENT_ENDPOINT, {
    params: country ? { country } : undefined,
  });
  // eslint-disable-next-line no-console
  console.log('[incidents] response status:', response.status, 'isArray:', Array.isArray(response.data), 'length:', Array.isArray(response.data) ? response.data.length : 'N/A');
  const items = unwrapList<Incident>(response.data);
  // eslint-disable-next-line no-console
  console.log('[incidents] unwrapped', items.length, 'incidents');
  return items;
}

export async function fetchIncidents(country?: string): Promise<Incident[]> {
  try {
    return await fetchIncidentsStrict(country);
  } catch (error) {
     
    console.error('[incidents] fetchIncidents error:', error);
    return [];
  }
}
