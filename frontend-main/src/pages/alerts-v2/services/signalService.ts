import { api } from '@/lib/api';
import { logger } from '@/utils/logger';
import type {
  AlertLevel,
  AlertStats,
  DiseaseKeyword,
  Signal,
  SignalStatus,
} from '../types';
import type { AgentRun, AgentStep, AgentStats } from '../components/AgentConsole/AgentConsole.types';

const SENTINEL_API = 'sentinel';
const AGENT_API = 'sentinel/agent';

export interface SignalQuery {
  priority?: AlertLevel | AlertLevel[];
  status?: SignalStatus | SignalStatus[];
  country?: string | string[];
  disease?: string | string[];
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  limit?: number;
}

/**
 * Translate the frontend filter shape into the Django query params accepted
 * by the Sentinel API. Array values expand to repeated params.
 */
export function buildSignalQuery(filters?: SignalQuery): URLSearchParams {
  const params = new URLSearchParams();
  if (!filters) return params;

  const appendParam = (key: string, value: string | undefined) => {
    if (value === undefined || value === null || value === '') return;
    params.append(key, value);
  };

  const appendMany = (key: string, value: string | string[] | undefined) => {
    if (!value) return;
    if (Array.isArray(value)) {
      value.forEach((v) => appendParam(key, v));
    } else {
      appendParam(key, value);
    }
  };

  appendMany('priority', filters.priority);
  appendMany('status', filters.status);
  appendMany('location_country_iso', filters.country);
  appendMany('disease_name', filters.disease);
  appendParam('date_from', filters.dateFrom);
  appendParam('date_to', filters.dateTo);
  appendParam('search', filters.search);
  if (typeof filters.limit === 'number') {
    appendParam('limit', String(filters.limit));
  }

  return params;
}

/**
 * Unwraps a paginated DRF response (`{ results: [...] }`) or returns the
 * array directly.
 */
function unwrapList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === 'object' && Array.isArray((data as { results?: unknown }).results)) {
    return (data as { results: T[] }).results;
  }
  return [];
}

/**
 * Thin field-rename mapping from the Django Signal serializer shape to the
 * frontend Signal type. No enrichment, no centroid fallback, no caching —
 * those all live in v1 and were intentionally dropped for v2.
 */
export function mapSignal(raw: any): Signal {
  const lat = raw.location_lat !== undefined && raw.location_lat !== null
    ? Number(raw.location_lat)
    : undefined;
  const lng = raw.location_lng !== undefined && raw.location_lng !== null
    ? Number(raw.location_lng)
    : undefined;

  // Detail endpoint returns `source` as a full SourceCredibility object
  // (source_name, source_url, tier, source_type); list endpoint returns
  // `source_display` (name, url, tier, type). Handle both shapes.
  const sourceFk = raw.source && typeof raw.source === 'object' ? raw.source : {};
  const sourceDisplay = raw.source_display || {};
  const sourceName: string =
    sourceFk.source_name || sourceDisplay.name || raw.source_name || 'Unknown Source';
  const sourceUrl: string | undefined =
    sourceFk.source_url || sourceDisplay.url || raw.source_url || undefined;
  const rawTier = sourceFk.tier !== undefined && sourceFk.tier !== null ? sourceFk.tier : (sourceDisplay.tier !== undefined && sourceDisplay.tier !== null ? sourceDisplay.tier : (raw.source_tier !== undefined && raw.source_tier !== null ? raw.source_tier : 3));
  const sourceTier = (rawTier === 0 || rawTier === 1 || rawTier === 2 ? rawTier : 3) as 0 | 1 | 2 | 3;
  const sourceType: string | undefined =
    sourceFk.source_type || raw.source_type || sourceDisplay.type || undefined;

  return {
    id: String(raw.id),
    signal_id: raw.signal_id ?? `SIG-${raw.id}`,
    headline: raw.headline ?? raw.original_text ?? '',
    summary: raw.summary ?? raw.translated_text ?? raw.original_text ?? '',

    signal_type: raw.signal_type,
    disease_name: raw.disease_name ?? undefined,
    disease_category: raw.disease_category ?? undefined,
    priority: raw.priority,
    level: raw.priority,
    status: raw.status,
    confidence_score: raw.confidence_score ?? undefined,

    location: {
      country: raw.location_country ?? undefined,
      iso3: raw.location_country_iso ?? undefined,
      country_iso: raw.location_country_iso ?? undefined,
      admin1: raw.location_admin1 ?? undefined,
      admin2: raw.location_admin2 ?? undefined,
      locality: raw.location_locality ?? undefined,
      coordinates:
        lat !== undefined && lng !== undefined && !(lat === 0 && lng === 0)
          ? { lat, lng }
          : undefined,
    },
    location_lat: lat,
    location_lng: lng,

    original_text: raw.original_text ?? undefined,
    original_language: raw.original_language ?? undefined,
    translated_text: raw.translated_text ?? undefined,
    translation_confidence: raw.translation_confidence ?? undefined,

    source: { name: sourceName, url: sourceUrl, tier: sourceTier, type: sourceType },
    source_name: raw.source_name ?? undefined,
    source_url: sourceUrl,
    source_type: sourceType,
    source_tier: sourceTier,
    source_timestamp: raw.source_timestamp ?? undefined,

    reported_cases: raw.reported_cases ?? undefined,
    reported_deaths: raw.reported_deaths ?? undefined,
    affected_population: raw.affected_population ?? undefined,

    cross_border_risk: raw.cross_border_risk ?? undefined,
    seasonal_pattern_match: raw.seasonal_pattern_match ?? undefined,

    analyst_notes: raw.analyst_notes ?? undefined,
    triaged_by: raw.triaged_by ?? undefined,
    triaged_at: raw.triaged_at ?? undefined,
    validated_by: raw.validated_by ?? undefined,
    validated_at: raw.validated_at ?? undefined,

    ingestion_source: raw.ingestion_source ?? undefined,
    created_at: raw.created_at ?? undefined,
    updated_at: raw.updated_at ?? undefined,
    publishedAt: raw.source_timestamp ?? raw.created_at ?? undefined,

    ai_classification: raw.ai_classification ?? undefined,
    ai_severity: raw.ai_severity ?? undefined,
    ai_notification_scope: raw.ai_notification_scope ?? undefined,
    ai_reasoning: raw.ai_reasoning ?? undefined,
    ai_classified_at: raw.ai_classified_at ?? undefined,
  };
}

function mapDisease(raw: any): DiseaseKeyword {
  return {
    code: String(raw.code ?? raw.id ?? raw.disease_name ?? ''),
    name: raw.disease_name ?? raw.name ?? '',
    syndrome: raw.syndrome ?? raw.category ?? '',
    keywords: Array.isArray(raw.keywords)
      ? raw.keywords
      : Array.isArray(raw.keywords_en)
        ? raw.keywords_en
        : [],
  };
}

/**
 * Strict variant — throws on network / parse error so callers can surface
 * an error state in the UI. `fetchAlerts` stays swallow-on-error to keep
 * the contract asserted by existing unit tests.
 */
export interface FetchOptions {
  signal?: AbortSignal;
}

export async function fetchAlertsStrict(
  filters?: SignalQuery,
  options?: FetchOptions,
): Promise<Signal[]> {
  const params = buildSignalQuery(filters);
  const qs = params.toString();
  const url = qs ? `${SENTINEL_API}/signals/?${qs}` : `${SENTINEL_API}/signals/`;
  const response = options?.signal
    ? await api.get(url, { signal: options.signal })
    : await api.get(url);
  return unwrapList<any>(response.data).map(mapSignal);
}

export async function fetchAlerts(
  filters?: SignalQuery,
  options?: FetchOptions,
): Promise<Signal[]> {
  try {
    return await fetchAlertsStrict(filters, options);
  } catch (error) {
    logger.error('[alerts-v2] fetchAlerts error:', error);
    return [];
  }
}

export async function fetchAlertStats(): Promise<AlertStats> {
  try {
    const response = await api.get(`${SENTINEL_API}/signals/stats/`);
    const data = response.data || {};
    return {
      total: Number(data.total ?? 0),
      by_priority: data.by_priority ?? {},
      by_status: data.by_status ?? {},
      by_country: data.by_country ?? {},
    };
  } catch (error) {
    logger.error('[alerts-v2] fetchAlertStats error:', error);
    return { total: 0, by_priority: {}, by_status: {}, by_country: {} };
  }
}

export async function fetchAlertById(id: number | string): Promise<Signal | null> {
  try {
    const response = await api.get(`${SENTINEL_API}/signals/${id}/`);
    return mapSignal(response.data);
  } catch (error) {
    logger.error('[alerts-v2] fetchAlertById error:', error);
    return null;
  }
}

/**
 * Trigger the Monitor/Review agent pipeline for a single native signal.
 * Used when an officer drills into an unclassified alert and wants an
 * assessment on demand. Returns the classified signal on success.
 */
export async function classifySignal(id: number | string): Promise<Signal | null> {
  try {
    const response = await api.post(`${SENTINEL_API}/signals/${id}/classify/`);
    // Backend returns { status, ai_classification, ..., signal: {...} }
    const raw = response.data?.signal ?? response.data;
    return mapSignal(raw);
  } catch (error) {
    logger.error('[alerts-v2] classifySignal error:', error);
    return null;
  }
}

/**
 * Trigger live ingestion from all external sources (GDELT, WHO News,
 * AllAfrica, ReliefWeb).  The backend runs ingestion in a background thread
 * and returns immediately with 202 Accepted.  Callers should wait ~15s then
 * re-fetch signals to see newly ingested data.
 */
export async function triggerIngestion(): Promise<{ status: string; message: string }> {
  try {
    const response = await api.post(`${SENTINEL_API}/signals/ingest/`);
    return response.data;
  } catch (error) {
    logger.error('[alerts-v2] triggerIngestion error:', error);
    return { status: 'error', message: 'Failed to trigger ingestion' };
  }
}

export async function fetchDiseases(): Promise<DiseaseKeyword[]> {
  try {
    const response = await api.get(`${SENTINEL_API}/diseases/`);
    return unwrapList<any>(response.data).map(mapDisease);
  } catch (error) {
    logger.error('[alerts-v2] fetchDiseases error:', error);
    return [];
  }
}

/**
 * Validate a signal — marks it as analyst-confirmed.
 */
export async function validateSignal(id: number | string): Promise<Signal | null> {
  try {
    const response = await api.post(`${SENTINEL_API}/signals/${id}/validate/`);
    return mapSignal(response.data);
  } catch (error) {
    logger.error('[alerts-v2] validateSignal error:', error);
    return null;
  }
}

/**
 * Dismiss a signal with an optional reason.
 */
export async function dismissSignal(id: number | string, reason?: string): Promise<Signal | null> {
  try {
    const response = await api.post(`${SENTINEL_API}/signals/${id}/dismiss/`, { reason });
    return mapSignal(response.data);
  } catch (error) {
    logger.error('[alerts-v2] dismissSignal error:', error);
    return null;
  }
}

/**
 * Re-triage a signal — update priority, status, confidence, and optional
 * analyst notes.
 */
export async function triageSignal(
  id: number | string,
  data: {
    priority: string;
    confidence_score?: number;
    analyst_notes?: string;
  },
): Promise<Signal | null> {
  try {
    const response = await api.post(`${SENTINEL_API}/signals/${id}/triage/`, data);
    return mapSignal(response.data);
  } catch (error) {
    logger.error('[alerts-v2] triageSignal error:', error);
    return null;
  }
}

// ── Agent run fetchers ────────────────────────────────────────────────────

function mapAgentRun(raw: any): AgentRun {
  return {
    run_id: String(raw.run_id),
    signal_id: Number(raw.signal_id),
    status: raw.status,
    started_at: raw.started_at,
    finished_at: raw.finished_at ?? null,
    confidence: raw.confidence != null ? Number(raw.confidence) : 0,
    corroboration_count: Number(raw.corroboration_count ?? 0),
    provider: raw.provider ?? undefined,
    model_name: raw.model_name ?? undefined,
    steps: Array.isArray(raw.steps) ? raw.steps.map(mapAgentStep) : [],
  };
}

function mapAgentStep(raw: any): AgentStep {
  return {
    step_number: Number(raw.step_number),
    kind: raw.kind,
    agent_name: raw.agent_name ?? '',
    input_summary: raw.input_summary ?? '',
    output_summary: raw.output_summary ?? '',
    reasoning: raw.reasoning ?? '',
    citations: Array.isArray(raw.citations) ? raw.citations : [],
    latency_ms: Number(raw.latency_ms ?? 0),
    tokens_used: raw.tokens_used != null ? Number(raw.tokens_used) : null,
    model_name: raw.model_name ?? '',
    created_at: raw.created_at,
  };
}

/** List recent AgentRuns for a signal, optionally narrowed to one country (ISO3). */
export async function fetchAgentRuns(
  signalId?: number | string,
  country?: string | null,
): Promise<AgentRun[]> {
  try {
    const params = new URLSearchParams();
    if (signalId != null) params.append('signal_id', String(signalId));
    if (country) params.append('country', country);
    const qs = params.toString();
    const response = await api.get(`${AGENT_API}/runs/${qs ? `?${qs}` : ''}`);
    return (Array.isArray(response.data) ? response.data : []).map(mapAgentRun);
  } catch (error) {
    logger.error('[alerts-v2] fetchAgentRuns error:', error);
    return [];
  }
}

/** Get one AgentRun by ID with all its steps. */
export async function fetchAgentRun(runId: string): Promise<AgentRun | null> {
  try {
    const response = await api.get(`${AGENT_API}/runs/${runId}/`);
    return mapAgentRun(response.data);
  } catch (error) {
    logger.error('[alerts-v2] fetchAgentRun error:', error);
    return null;
  }
}

/**
 * Poll for AgentStep rows newer than `since`, optionally narrowed to one
 * country (ISO3 — joins through AgentRun → Signal.location_country_iso).
 * Includes `run_id` and `signal_id` on each step (added server-side).
 */
export async function fetchAgentActivity(
  since?: string,
  country?: string | null,
): Promise<(AgentStep & { run_id: string; signal_id: number })[]> {
  try {
    const params = new URLSearchParams();
    if (since) params.append('since', since);
    if (country) params.append('country', country);
    const qs = params.toString();
    const response = await api.get(`${AGENT_API}/activity/${qs ? `?${qs}` : ''}`);
    return (Array.isArray(response.data) ? response.data : []).map((raw: any) => ({
      ...mapAgentStep(raw),
      run_id: String(raw.run_id),
      signal_id: Number(raw.signal_id),
    }));
  } catch (error) {
    logger.error('[alerts-v2] fetchAgentActivity error:', error);
    return [];
  }
}

/** Agent health + usage stats for the Stats tab. */
export async function fetchAiStats(): Promise<AgentStats | null> {
  try {
    const response = await api.get(`${AGENT_API}/stats/`);
    const d = response.data;
    return {
      total_classified: Number(d.total_classified ?? 0),
      total_unclassified: Number(d.total_unclassified ?? 0),
      by_classification: d.by_classification ?? {},
      by_severity: d.by_severity ?? {},
      last_run_at: d.last_run_at ?? null,
      agent_health: d.agent_health ?? 'down',
      model_name: d.model_name ?? '',
      provider: d.provider ?? '',
    };
  } catch (error) {
    logger.error('[alerts-v2] fetchAiStats error:', error);
    return null;
  }
}
