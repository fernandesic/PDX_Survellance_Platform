/**
 * HDIS-PRO — TypeScript types matching Django HDIS API responses.
 * These replace the Supabase-generated types.
 */

// ─── Trust ────────────────────────────────────────────────────────────

export type TrustLevel = "verified" | "corroborated" | "unverified" | "unconfirmed";

export interface TrustScore {
  score: number;
  trust_level: TrustLevel;
  source_tier_weight: number;
  corroboration_count: number;
  disease_match_confidence: number;
  recency_factor: number;
  computed_at: string;
}

// ─── Intel Record (Signal enriched with HDIS data) ───────────────────

export type RiskLevel = "critical" | "high" | "medium" | "low";

export interface IntelRecord {
  id: number;
  headline: string;
  risk_level: RiskLevel;
  event_type: string;
  country_tags: string[];
  signal_strength: number;
  status: string;
  disease_name: string | null;
  disease_category: string | null;
  pillar: string;
  secondary_pillars: string[];
  pillar_label: string;
  location_country: string;
  location_country_iso: string;
  location_lat: number | null;
  location_lng: number | null;
  original_language: string | null;
  priority: string;
  confidence_score: number;
  reported_cases: number | null;
  reported_deaths: number | null;
  source_display: {
    name: string;
    tier: number;
    url: string | null;
    type: string | null;
  };
  cross_border_risk: boolean;
  analyst_notes: string | null;
  ingestion_source: string | null;
  created_at: string;
  updated_at: string;
  trust: TrustScore | null;
}

export interface IntelRecordDetail extends IntelRecord {
  impact_assessment: string;
  recommended_posture: string;
  topics: string[];
  actors: Array<{ name: string; role: string }>;
  stance: string;
  scs_tier: number;
  source_url: string | null;
  translated_text: string | null;
  affected_population: string | null;
  triaged_at: string | null;
  validated_at: string | null;
}

// ─── Alert ────────────────────────────────────────────────────────────

export interface Alert {
  id: number;
  record_id: number;
  risk_level: RiskLevel;
  trigger_reason: string;
  confidence_score: number;
  signal_strength: number;
  multi_source_validated: boolean;
  acknowledged_by: number | null;
  acknowledged_at: string | null;
  country: string;
  country_iso: string;
  created_at: string;
}

export type BriefingScope = "daily_global" | "country_focus" | "crisis_alert";
export type ConfidenceLevel = "high" | "medium" | "low";

export interface BriefingContent {
  executive_summary?: string;
  risk_assessment?: {
    level: string;
    direction: string;
    comparison?: string;
    reasoning?: string;
  };
  cross_pillar_correlation?: string;
  recommended_actions?: Array<{
    action: string;
    urgency: "immediate" | "48h" | "this_week" | "monitor";
    pillar: string;
    rationale?: string;
  }>;
  open_actions_status?: Array<{
    from_date: string;
    action: string;
    status: string;
  }>;
  information_gaps?: Array<{
    area: string;
    criticality: "high" | "medium" | "low";
    suggested_investigation?: string;
  }>;
  sources_summary?: {
    total_signals: number;
    total_sources: number;
    confidence_distribution?: Record<string, number>;
  };
}

export interface Briefing {
  id: number;
  briefing_type: string;
  scope: BriefingScope;
  scope_display: string;
  country_iso: string;
  content: BriefingContent;
  status: "draft" | "published";
  confidence_level: ConfidenceLevel;
  signal_count: number;
  source_count: number;
  generation_time_ms: number;
  llm_model: string;
  pipeline_data: Record<string, any>;
  country_filter: string[];
  generated_by: string;
  period_start: string | null;
  period_end: string | null;
  generated_at: string;
}

export interface GenerationStatus {
  is_running: boolean;
  stage: string;
  briefing_id: number | null;
  error: string | null;
  started_at: string | null;
  briefing?: Briefing;
}

// ─── Source ───────────────────────────────────────────────────────────

export interface IntelSource {
  id: number;
  source_name: string;
  source_url: string | null;
  source_type: string;
  tier: number;
  credibility_score: number;
  total_signals: number;
  validated_signals: number;
  false_positive_count: number;
  last_signal_at: string | null;
  notes: string | null;
  active: boolean;
  created_at: string;
}

// ─── Dashboard Stats ─────────────────────────────────────────────────

export interface DashboardStats {
  total_records: number;
  critical_alerts: number;
  countries_monitored: number;
  active_sources: number;
  by_priority: Record<string, number>;
  by_trust_level: Record<string, number>;
  by_country: Array<{ location_country_iso: string; count: number }>;
  by_pillar: Record<string, number>;
}

// ─── Country Intelligence ────────────────────────────────────────────

export interface CountryIntelligence {
  country_iso: string;
  country_name: string;
  signal_count: number;
  risk_level: RiskLevel;
  critical_count: number;
  high_count: number;
  pillars: Record<string, number>;
  active_pillars: number;
}

export interface PillarDetail {
  label: string;
  count: number;
  latest_headline: string;
  latest_date: string | null;
  critical: number;
}

export interface CountryDetail {
  country_iso: string;
  country_name: string;
  signal_count: number;
  risk_level: RiskLevel;
  by_priority: Record<string, number>;
  pillars: Record<string, PillarDetail>;
  active_pillars: number;
  timeline: IntelRecord[];
}

// ─── Filters ─────────────────────────────────────────────────────────

export interface RecordFilters {
  risk_level?: string;
  event_type?: string;
  country_tag?: string;
  trust_level?: string;
  status?: string;
  pillar?: string;
  q?: string;
}
