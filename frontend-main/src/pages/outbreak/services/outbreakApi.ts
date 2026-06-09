/**
 * Outbreak Workspace — API Service
 *
 * All calls go through the shared `api` axios instance from @/lib/api
 * which handles auth cookies and base URL.
 */

import { api } from '@/lib/api';

const OUTBREAK_API = 'outbreak';

// ─── Types ─────────────────────────────────────────────────────

export interface Pathogen {
  id: number;
  name: string;
  family: string;
  r0_min: string;
  r0_max: string;
  cfr_min: string;
  cfr_max: string;
  incubation_days_min: number;
  incubation_days_max: number;
  transmission_modes: string[];
  vaccine_available: boolean;
  antiviral_available: boolean;
  profile_json: Record<string, unknown>;
  monitor_widgets?: string[];
}

export interface Outbreak {
  id: number;
  pathogen: Pathogen;
  pathogen_name?: string;
  iso3: string;
  regions: string[];
  declared_at: string;
  status: 'suspected' | 'confirmed' | 'contained' | 'closed';
  severity: 'low' | 'moderate' | 'high' | 'critical';
  lead_focal_point: string;
  summary: string;
  neighbor_iso3s: string[];
  event_count: number;
  latest_event_ts: string | null;
  confirmed_cases: number | null;
  confirmed_deaths: number | null;
  confirmed_as_of: string | null;
  confirmed_source: string;
  latest_tracker: TrackerSnapshot | null;
  tracker_breakdown: TrackerBreakdownRow[];
  latest_lab: LabSnapshot | null;
}

export interface TrackerSnapshot {
  as_of: string | null;
  confirmed_cases: number | null;
  confirmed_deaths: number | null;
  suspected_cases: number | null;
  suspected_deaths: number | null;
  new_confirmed_cases: number | null;
  new_confirmed_deaths: number | null;
  new_suspected_cases: number | null;
  new_suspected_deaths: number | null;
  total_contacts: number | null;
  new_contacts: number | null;
  cfr_pct: number | null;
  verification: string;
  event_id: number;
  retrieved_at: string;
}

export interface TrackerBreakdownRow {
  province: string;
  health_zone: string;
  as_of: string | null;
  confirmed_cases: number | null;
  confirmed_deaths: number | null;
  suspected_cases: number | null;
  suspected_deaths: number | null;
  new_confirmed_cases: number | null;
  new_suspected_cases: number | null;
  contacts: number | null;
}

export interface LabSnapshot {
  as_of: string | null;
  samples_received: number | null;
  samples_analyzed: number | null;
  positive_samples: number | null;
  positivity_pct: number | null;
  daily_throughput: number | null;
  backlog: number | null;
  event_id: number;
  retrieved_at: string;
}

export interface OutbreakEvent {
  id: number;
  outbreak: number;
  ts: string;
  source: string;
  kind: string;
  geo: string;
  payload_json: Record<string, unknown>;
  confidence: string;
  source_ref: string;
  created_at: string;
}

export interface HistoricalEpisode {
  id: number;
  pathogen: number;
  pathogen_name: string;
  country: string;
  country_iso3: string;
  year_start: number;
  year_end: number | null;
  cases: number;
  deaths: number;
  response_summary: string;
  lessons: string;
  source_urls: string[];
}

export interface OutbreakStats {
  total_events: number;
  events_24h: number;
  events_7d: number;
  by_kind: Record<string, number>;
  by_source: Record<string, number>;
  countries_detected: string[];
  outbreak_status: string;
  outbreak_severity: string;
  // Authoritative — entered from Ministry/WHO sitrep, NULL if not yet recorded.
  confirmed_cases: number | null;
  confirmed_deaths: number | null;
  confirmed_as_of: string | null;
  confirmed_source: string;
  // Signal-derived (MAX over epicenter signals since declared_at). Informational
  // cross-check; never authoritative.
  latest_reported_cases: number;
  latest_reported_deaths: number;
  latest_reported_ts: string | null;
}

export interface EpiCurvePoint {
  date: string;
  signals: number;
  cumulative: number;
}

// ─── API Calls ─────────────────────────────────────────────────

export async function fetchOutbreaks(): Promise<Outbreak[]> {
  const { data } = await api.get(`${OUTBREAK_API}/outbreaks/`);
  return data;
}

export async function fetchOutbreak(id: number): Promise<Outbreak> {
  const { data } = await api.get(`${OUTBREAK_API}/outbreaks/${id}/`);
  return data;
}

export async function fetchOutbreakEvents(
  id: number,
  params?: {
    kind?: string[];
    since?: string;
    until?: string;
    as_of?: string;
    geo?: string;
    source?: string;
    limit?: number;
  }
): Promise<OutbreakEvent[]> {
  const searchParams = new URLSearchParams();
  if (params?.kind) {
    params.kind.forEach((k) => searchParams.append('kind', k));
  }
  if (params?.since) searchParams.set('since', params.since);
  if (params?.until) searchParams.set('until', params.until);
  if (params?.as_of) searchParams.set('as_of', params.as_of);
  if (params?.geo) searchParams.set('geo', params.geo);
  if (params?.source) searchParams.set('source', params.source);
  if (params?.limit) searchParams.set('limit', String(params.limit));

  const { data } = await api.get(
    `${OUTBREAK_API}/outbreaks/${id}/events/?${searchParams.toString()}`
  );
  return data;
}

export async function fetchOutbreakStats(id: number): Promise<OutbreakStats> {
  const { data } = await api.get(`${OUTBREAK_API}/outbreaks/${id}/stats/`);
  return data;
}

export async function fetchEpiCurve(id: number): Promise<EpiCurvePoint[]> {
  const { data } = await api.get(`${OUTBREAK_API}/outbreaks/${id}/epi-curve/`);
  return data;
}

export async function fetchHistory(id: number): Promise<HistoricalEpisode[]> {
  const { data } = await api.get(`${OUTBREAK_API}/outbreaks/${id}/history/`);
  return data;
}

export async function triggerIngest(id: number): Promise<{ status: string; message: string }> {
  const { data } = await api.post(`${OUTBREAK_API}/outbreaks/${id}/ingest/`);
  return data;
}

// ─── T-090: Capacity Endpoint ──────────────────────────────────

export interface OutbreakCapacity {
  iso3: string;
  pathogen: string;
  country: string;
  readiness: {
    score: number | null;
    categories: Record<string, number>;
    weakest?: Array<{ category: string; score: number }>;
    data_available: boolean;
  };
  ihr: {
    overall: number | null;
    year?: string | null;
    components: Array<{
      code: string;
      label: string;
      value: number;
      below_50: boolean;
    }>;
    headlines?: {
      surveillance: number | null;
      laboratory: number | null;
      response: number | null;
      workforce: number | null;
    };
    weak_count?: number;
    data_available: boolean;
  };
  chw: {
    density: number | null;
    total_chws?: number;
    active_chws?: number;
    active_pct?: number;
    population?: number;
    districts: Array<{
      district: string;
      region: string;
      total_chws: number;
      active_chws: number;
      active_pct: number;
      chws_per_10k: number;
      population: number;
      gap_flag: boolean;
    }>;
    data_available: boolean;
  };
  star: {
    score: number | null;
    hazard: string | null;
    risk_level: string | null;
    seasonality: string | null;
    current_month: string | null;
    data_available: boolean;
  };
  spillover: {
    score: number | null;
    stage: number | null;
    stage_label?: string;
    stage_color?: string;
    p_spillover_30d?: number;
    seasonality_active?: boolean;
    active_animal_events?: number;
    human_contacts?: number;
    environmental_flags?: string[];
    // One Health enrichment — full assessment + early-warning peers
    recommended_actions?: string[];
    signal_breakdown?: Array<{ label?: string; value?: number; weight?: number }>;
    alert_tier?: number;
    peers?: Array<{
      iso3: string;
      country?: string;
      score?: number;
      stage?: number;
      stage_label?: string;
      p_spillover_30d?: number;
      alert_tier?: number;
      active_animal_events?: number;
      human_contacts?: number;
    }>;
    data_available: boolean;
  };
  poe?: {
    score: number | null;
    questions_total?: number;
    questions_answered?: number;
    country?: string;
    data_available: boolean;
  };
  composite: {
    score: number | null;
    risk_level: string | null;
    star_score?: number;
    climate_score?: number;
    sentinel_score?: number;
    espar_score?: number;
    readiness_score?: number;
    confidence?: number;
    drivers?: string[];
    sources_used?: string[];
    valid_until?: string | null;
    data_available: boolean;
  };
  // Scope metadata — present on every response. `scope_is_override` is
  // true when the caller passed a `?iso3=` query that differs from the
  // outbreak's epicenter; the UI uses this to show a "viewing neighbour"
  // pill so the officer doesn't confuse override data with epicenter data.
  scope_iso3?: string;
  scope_is_override?: boolean;
  epicenter_iso3?: string;
}

export async function fetchOutbreakCapacity(
  id: number,
  viewIso3?: string,
): Promise<OutbreakCapacity> {
  const qs = viewIso3 ? `?iso3=${encodeURIComponent(viewIso3.toUpperCase())}` : '';
  const { data } = await api.get(`${OUTBREAK_API}/outbreaks/${id}/capacity/${qs}`);
  return data;
}

// ─── T-032/T-126/T-128 LLM ask + audit ─────────────────────────

export interface AskResult {
  answer: string | null;
  reason: string | null;
  source: 'canned' | 'llm' | 'router';
  citations: string[];
  canned_query?: string | null;
  invalid_citations?: string[];
  value?: number | string | null;
}

export async function askOutbreak(id: number, question: string): Promise<AskResult> {
  const { data } = await api.post(`${OUTBREAK_API}/outbreaks/${id}/ask/`, { question });
  return data;
}

export interface LlmInteraction {
  id: number;
  outbreak: number;
  source: 'ask' | 'sitrep' | 'other';
  question: string;
  final_answer: string;
  refusal_reason: string;
  canned_query: string;
  model: string;
  provider: string;
  latency_ms: number;
  prompt_tokens: number;
  completion_tokens: number;
  created_at: string;
}

export async function fetchLlmLog(id: number): Promise<LlmInteraction[]> {
  const { data } = await api.get(`${OUTBREAK_API}/outbreaks/${id}/llm-log/`);
  return data;
}

// ─── T-033/T-124 Sitrep ────────────────────────────────────────

export interface Decision {
  id: number;
  outbreak: number;
  kind: 'decision' | 'sitrep' | 'note';
  title: string;
  body: string;
  author: string;
  evidence_event_ids: number[];
  citations: string[];
  created_at: string;
}

export async function fetchLatestSitrep(id: number): Promise<Decision | { answer: null; reason: string }> {
  const { data } = await api.get(`${OUTBREAK_API}/outbreaks/${id}/sitrep/latest/`);
  return data;
}

export async function generateSitrep(id: number): Promise<{ ok: boolean; reason: string | null; decision_id: number | null; answer: string }> {
  const { data } = await api.post(`${OUTBREAK_API}/outbreaks/${id}/sitrep/generate/`);
  return data;
}

// ─── T-060 Decision log ────────────────────────────────────────

export async function fetchDecisions(id: number, kind?: string): Promise<Decision[]> {
  const q = kind ? `?kind=${encodeURIComponent(kind)}` : '';
  const { data } = await api.get(`${OUTBREAK_API}/outbreaks/${id}/decisions/${q}`);
  return data;
}

export async function createDecision(
  id: number,
  payload: { kind?: string; title?: string; body: string; evidence_event_ids?: number[]; citations?: string[] }
): Promise<Decision> {
  const { data } = await api.post(`${OUTBREAK_API}/outbreaks/${id}/decisions/`, payload);
  return data;
}

// ─── T-040..T-044 Notifications ────────────────────────────────

export interface OutbreakNotification {
  id: number;
  outbreak: number;
  rule: number;
  rule_name: string;
  event: number;
  event_kind: string;
  event_geo: string;
  event_ts: string;
  state: 'pending' | 'pending_confirm' | 'sent' | 'acked' | 'dismissed' | 'failed';
  channel: string;
  rendered_message: string;
  hold_until: string | null;
  dispatched_at: string | null;
  error: string;
  created_at: string;
  updated_at: string;
}

export async function fetchNotifications(id: number, state?: string): Promise<OutbreakNotification[]> {
  const q = state ? `?state=${encodeURIComponent(state)}` : '';
  const { data } = await api.get(`${OUTBREAK_API}/outbreaks/${id}/notifications/${q}`);
  return data;
}

export async function confirmNotification(
  outbreakId: number,
  notifId: number,
  send: boolean
): Promise<OutbreakNotification> {
  const { data } = await api.post(
    `${OUTBREAK_API}/outbreaks/${outbreakId}/notifications/${notifId}/confirm/`,
    { send }
  );
  return data;
}

// ─── T-081 Adaptor health ──────────────────────────────────────

export interface AdaptorHealth {
  name: string;
  kinds_emitted: string[];
  healthy: boolean;
  last_event_ts: string | null;
  events_last_hour: number;
  status: 'ok' | 'degraded' | 'dead';
}

export async function fetchAdaptorHealth(id: number): Promise<AdaptorHealth[]> {
  const { data } = await api.get(`${OUTBREAK_API}/outbreaks/${id}/adaptor-health/`);
  return data;
}

// ─── T-052 Scenario trigger ────────────────────────────────────

export async function triggerScenario(id: number): Promise<unknown> {
  const { data } = await api.post(`${OUTBREAK_API}/outbreaks/${id}/scenario/`);
  return data;
}

// ─── T-062 Export bundle ───────────────────────────────────────

export interface ExportBundle {
  manifest: {
    sha256: string;
    signature: string;
    algorithm: string;
    size_bytes: number;
  };
  bundle: Record<string, unknown>;
}

export async function fetchExport(id: number): Promise<ExportBundle> {
  const { data } = await api.get(`${OUTBREAK_API}/outbreaks/${id}/export/`);
  return data;
}

// ─── T-025 SSE stream URL ──────────────────────────────────────

export function outbreakStreamUrl(id: number): string {
  const base = (api.defaults.baseURL || '').replace(/\/$/, '');
  return `${base}/${OUTBREAK_API}/outbreaks/${id}/stream/`;
}

// ─── Pathogen monitor_widgets ──────────────────────────────────
// (Already on Pathogen.profile_json via API response — add explicit field on serializer.)


// ─── Admin: upload manual tracker xlsx ─────────────────────────

export interface TrackerUploadSummary {
  daily_emitted: number;
  daily_skipped: number;
  daily_total: number;
  zone_emitted: number;
  zone_skipped: number;
  zone_total: number;
  lab_emitted: number;
  lab_skipped: number;
  lab_total: number;
  latest_as_of: string | null;
  warnings: string[];
}

export interface TrackerUploadResponse {
  ok: boolean;
  outbreak_id: number;
  filename: string;
  summary: TrackerUploadSummary;
}

export async function uploadTracker(
  outbreakId: number,
  file: File,
): Promise<TrackerUploadResponse> {
  const form = new FormData();
  form.append('file', file);
  form.append('outbreak_id', String(outbreakId));
  const { data } = await api.post(
    `${OUTBREAK_API}/upload-tracker/`,
    form,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
  return data;
}


