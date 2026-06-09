/**
 * One Health API Service
 * Fetches real data from Django backend (oh_* tables).
 */

import { apiGet, apiPost } from "@/lib/api";

/* ─── Types ─────────────────────────────────── */

export interface OHCountry {
  iso3: string;
  name: string;
  sub: string;
  population_m: number;
  lat: number;
  lon: number;
  climate_zone: string;
  fragility_index: number;
  risk: number;
  spar: number;
  displacement_index: number;
  bushmeat: boolean;
  aedes_aegypti_suitability: number | null;
  anopheles_gambiae_suitability: number | null;
  bat_species_count: number | null;
  host_diversity_index: number | null;
  zoonotic_host_richness_class: string | null;
}

export interface OHPathogen {
  disease: string;
  domain: string;
  r0_min: number;
  r0_max: number;
  cfr_pct: number;
  spillover_score: number | null;
  ihr_notifiable: boolean;
  woah_listed: boolean;
  pandemic_potential: string;
  natural_host: string;
  reservoir: string;
  incubation_days_min: number;
  incubation_days_max: number;
}

export interface OHKPIs {
  total_countries: number;
  afro_spar_avg: number;
  spillover_risk_idx: number;
  bushmeat_countries: number;
  pathogen_profiles: number;
  tier_high_alerts: number;
  active_outbreaks: number;
}

export interface OHSpillover {
  iso3: string;
  country_name: string;
  who_subregion: string;
  composite_spillover_risk_0_100: number;
  ihr_overall_score: number | null;
  interface_risk_score: number | null;
  host_diversity_index: number | null;
  aedes_aegypti_suitability: number | null;
}

export interface OHSignalBreakdown {
  signal: string;
  sub_score: number;
  weight_pct: number;
  weighted: number;
  evidence: string;
  source?: string;
}

export interface OHEarlyWarning {
  iso3: string;
  country_name: string;
  pathogen: string;
  assessment_date?: string;
  composite_score: number;
  stage: number;
  stage_label: string;
  stage_color: string;
  days_to_first_human_case_min: number;
  days_to_first_human_case_max: number;
  days_to_first_human_case_est: number;
  p_spillover_30d: number;
  p_cluster_30d: number;
  active_animal_events: number;
  human_contacts: number;
  environmental_flags: string[];
  seasonality_active: boolean;
  ihr_notifiable: boolean;
  alert_tier: number;
  recommended_actions: string[];
  signal_breakdown?: OHSignalBreakdown[];
  sources_used?: string[];
}

export interface OHTimelineEvent {
  date: string;
  domain: string;
  event: string;
  tier?: number;
  cases?: number;
  district?: string;
  flags?: string[];
  precip?: number;
  projected?: boolean;
}

export interface OHForecastResult {
  trajectory: Array<{
    day: number;
    ensemble: number;
    seir: number;
    exponential: number;
    bayesian: number;
    ci_lower: number;
    ci_upper: number;
    hospitalised: number;
  }>;
  peak_day: number;
  peak_cases: number;
  doubling_time_days: number | null;
  p_epidemic_30d: number;
  p_cluster_30d: number;
  total_cases_30d: number;
  total_deaths_30d: number;
  model_weights: Record<string, number>;
  models_used: string[];
  generated_at: string;
  model_day30: {
    seir: number;
    exponential: number;
    bayesian: number;
  };
}

export interface OHLiveKPIs {
  tier_high_alerts: number;
  active_outbreaks: number;
  countries_reporting: number;
  afro_spar_avg: number;
  spillover_risk_idx: number;
  imminent_events: number;
  warning_events: number;
  score_last_computed: string | null;
  score_is_stale: boolean;
}

/* ─── TRIAD Addition Types ───────────────────── */

export interface OHSearchResult {
  type: "country" | "disease" | "alert" | "agent";
  id: string;
  label: string;
  sub: string;
  extra?: Record<string, any>;
  score: number;
}

export interface OHSearchResponse {
  query: string;
  results: OHSearchResult[];
  total: number;
  took_ms: number;
}

export interface OHAlertExplain {
  alert: Record<string, any>;
  narrative: string;
  what_to_watch: string[];
  pathogen: Record<string, any> | null;
  country: Record<string, any> | null;
  report: Record<string, any> | null;
  human_cases: any[];
  animal_events: any[];
  env_recent: any[];
  ihr_flags: { ihr_notifiable: boolean; woah_listed: boolean };
  summary: { human_cases_total: number; deaths_total: number; animals_affected: number; tier: number };
}

export interface OHSeirExplain {
  r0_baseline: number;
  r0_adjusted: number;
  r_effective: number;
  doubling_days: number | null;
  regime: string;
  verdict: string;
  dominant_driver: string;
  driver_text: string;
}

/* ─── Endpoints (Django backend) ─────────────── */

export const oneHealthApi = {
  /** All 47 AFRO countries with risk/spar/vector/host data */
  getCountries: () => apiGet<OHCountry[]>("/onehealth/countries"),

  /** KPI summary numbers */
  getKPIs: () => apiGet<OHKPIs>("/onehealth/kpis"),

  /** Pathogen profiles for simulation */
  getPathogens: () => apiGet<OHPathogen[]>("/onehealth/pathogens"),

  /** Composite spillover risk view */
  getSpillover: () => apiGet<OHSpillover[]>("/onehealth/spillover"),

  /** Vector ecology per country */
  getVectors: () => apiGet<any[]>("/onehealth/vectors"),

  /** Host/reservoir ecology per country */
  getHosts: () => apiGet<any[]>("/onehealth/hosts"),

  /** Single country full detail */
  getCountryDetail: (iso3: string) => apiGet<any>(`/onehealth/country/${iso3}`),

  /** Active alerts — supports ?min_tier=N&limit=N */
  getAlerts: (minTier = 1, limit = 50) =>
    apiGet<any[]>(`/onehealth/alerts?min_tier=${minTier}&limit=${limit}`),

  /** Epidemiological links */
  getEpiLinks: () => apiGet<any[]>("/onehealth/epilinks"),

  /** Disease report aggregation */
  getDiseaseStats: () => apiGet<any[]>("/onehealth/disease-stats"),

  /** Ranked spillover early warning assessments */
  getEarlyWarning: (minStage = 1, pathogen?: string, limit = 50) => {
    let qs = `?min_stage=${minStage}&limit=${limit}`;
    if (pathogen) qs += `&pathogen=${encodeURIComponent(pathogen)}`;
    return apiGet<OHEarlyWarning[]>(`/onehealth/spillover/early-warning${qs}`);
  },

  /** Cross-species transmission timeline for a country */
  getSpilloverTimeline: (iso3: string) =>
    apiGet<OHTimelineEvent[]>(`/onehealth/spillover/timeline/${iso3}`),

  /** 3-model ensemble forecast */
  postForecastHorizon: (params: Record<string, any>) =>
    apiPost<OHForecastResult>("/onehealth/forecast/horizon", params),

  /** Live KPIs with engine-computed risk index */
  getLiveKPIs: () => apiGet<OHLiveKPIs>("/onehealth/kpis/live"),

  // ── TRIAD Dashboard Additions ──────────────────────────

  /** Unified search across countries, diseases, alerts, agents */
  searchUnified: (q: string, limit = 8, types?: string) => {
    let qs = `?q=${encodeURIComponent(q)}&limit=${limit}`;
    if (types) qs += `&types=${types}`;
    return apiGet<OHSearchResponse>(`/onehealth/search${qs}`);
  },

  /** Rich alert explanation with narrative + One Health context */
  getAlertExplain: (alertId: string) =>
    apiGet<OHAlertExplain>(`/onehealth/alerts/${alertId}/explain`),

  /** Pre-run SEIR interpretation */
  postSeirExplain: (params: Record<string, any>) =>
    apiPost<OHSeirExplain>("/onehealth/simulation/seir/explain", params),

  /** AI Agent Status panel — list of dashboard agents */
  getAgents: () => apiGet<OHAgent[]>("/onehealth/agents"),

  /** Human-in-the-Loop pending actions */
  getHITLPending: (limit = 10) =>
    apiGet<OHHITLAction[]>(`/onehealth/hitl/pending?limit=${limit}`),

  approveHITL: (actionId: string) =>
    apiPost<{ ok: boolean; status: string }>(
      `/onehealth/hitl/${actionId}/approve`, {}
    ),

  dismissHITL: (actionId: string) =>
    apiPost<{ ok: boolean; status: string }>(
      `/onehealth/hitl/${actionId}/dismiss`, {}
    ),

  acknowledgeHITL: (actionId: string) =>
    apiPost<{ ok: boolean; status: string }>(
      `/onehealth/hitl/${actionId}/acknowledge`, {}
    ),

  /** Real ingestion source freshness for StatusBar */
  getIngestionStatus: () => apiGet<OHIngestionSource[]>("/onehealth/ingestion-status"),

  // ── Cross-border Importation sub-module ──────────────────

  /** List available corridor presets (returns preset name strings) */
  getCorridorPresets: () =>
    apiGet<string[]>("/onehealth/cross-border/corridor-presets"),

  /** Fetch a single corridor preset with country configs */
  getCorridorPreset: (name: string) =>
    apiGet<OHCorridorPreset>(`/onehealth/cross-border/corridor-presets/${name}`),

  /** Run the cross-border importation hazard model */
  postCrossBorderImportation: (params: OHCrossBorderRequest) =>
    apiPost<OHCrossBorderResponse>("/onehealth/cross-border/importation", params),

  /** Sensitivity sweep on travel-while-infectious parameter */
  postCrossBorderSensitivity: (params: OHCrossBorderSensitivityRequest) =>
    apiPost<OHCrossBorderSensitivityResponse>("/onehealth/cross-border/importation/sensitivity", params),
};

export interface OHIngestionSource {
  name: string;
  status: "fresh" | "stale" | "disconnected" | "not_configured" | string;
  label: string;
  last_seen: string | null;
  error?: string;
}

export interface OHHITLAction {
  action_id: string;
  kind: "approve" | "inform" | "review" | string;
  title: string;
  description: string | null;
  severity: "amber" | "cobalt" | "crimson" | string | null;
  requested_by: string | null;
  related_alert: string | null;
  status: "pending" | "approved" | "dismissed" | "acknowledged" | string;
  created_at: string;
}

export interface OHAgent {
  agent_id: string;
  name: string;
  icon: string | null;
  status: string; // running | alert | idle | pending
  status_label: string;
  description: string | null;
  phase: string | null;
  sort_order: number;
  last_heartbeat: string | null;
  updated_at: string | null;
}

/* ─── Cross-border Importation Types ─────── */

export interface OHCrossBorderCountry {
  name: string;
  iso3: string;
  daily_crossings: number;
  catchment_share: number;
  border_open: number;
  direct_border: boolean;
  ghs_index: number | null;
  readiness_composite: number | null;
  note?: string;
}

export interface OHCorridorPreset {
  name: string;
  countries: OHCrossBorderCountry[];
}

export interface OHCrossBorderRequest {
  active_I_series: number[];
  source_catchment_population?: number;
  travel_while_infectious?: number;
  detection_at_poe?: number;
  horizon_days?: number;
  countries: OHCrossBorderCountry[];
  scenario_id?: string | null;
}

export interface OHCrossBorderCountryResult {
  name: string;
  iso3: string;
  expected_imports: number;
  p_any_import: number;
  tier: string;
  expected_imports_w4: number;
  expected_imports_w8: number;
  expected_imports_w12: number;
  p_any_w4: number;
  p_any_w8: number;
  p_any_w12: number;
  daily_lambda: number[];
  cumulative_lambda: number[];
}

export interface OHCrossBorderResponse {
  run_id: string;
  run_timestamp: string;
  scenario_id: string | null;
  horizon_days: number;
  countries: OHCrossBorderCountryResult[];
  inputs_echo: {
    travel_while_infectious: number;
    detection_at_poe: number;
    source_catchment_population: number;
  };
}

export interface OHCrossBorderSensitivityRequest {
  active_I_series: number[];
  source_catchment_population?: number;
  detection_at_poe?: number;
  horizon_days?: number;
  countries: OHCrossBorderCountry[];
  twi_values?: number[];
}

export interface OHCrossBorderSensitivityResponse {
  twi_values: number[];
  by_country: Record<string, Record<string, number>>;
}
