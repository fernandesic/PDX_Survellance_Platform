// @ts-nocheck

export const AlertLevel = {
  LOW: 'P4',
  MEDIUM: 'P3',
  HIGH: 'P2',
  CRITICAL: 'P1'
} as const;

export type AlertLevel = (typeof AlertLevel)[keyof typeof AlertLevel];

export type SeverityLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';

export interface Country {
  code: string;
  name: string;
  region: string;
}

export interface Disease {
  code: string;
  name: string;
  syndrome: string;
}

export interface ApiSource {
  source_id: string;
  source_name: string;
  status: 'active' | 'inactive';
  base_url: string;
  documentation_url?: string;
  source_type: string;
  category: string;
  coverage: string;
  priority: number;
  auth_type: string;
  data_format: string;
}

export interface ExpandedApiSource extends ApiSource { }

export interface PDXAlert {
  alert_id: string;
  title: string;
  summary: string;
  alert_level: AlertLevel;
  severity: SeverityLevel;
  country_iso3: string;
  admin1: string;
  created_at: string;
  confidence: number;
  source_link?: string;
  keywords?: Record<string, string[]>;
  hazard?: string;
  disease?: {
    icd10: string;
    name: string;
  };
  evidence: {
    unique_sources: number;
    signal_count: number;
  };
  alert_type: string;
}

export interface LinguaData {
  original_text: string;
  original_language_code: string;
  original_language_name: string;
  translation_text?: string;
  local_voice: boolean;
  language_location_match: boolean;
  detected_keywords?: string[];
}

export interface EpidemiologyData {
  cases_suspected?: number;
  cases_confirmed?: number;
  deaths?: number;
  cfr_observed?: number;
}

export interface Signal {
  id: string;
  signal_id?: string;
  headline?: string;
  summary?: string;
  publishedAt?: string;
  human_readable_time?: string;
  level?: AlertLevel;
  confidence?: number;

  // Signal classification
  signal_type?: 'disease' | 'hazard' | 'rumor';
  disease_name?: string;
  disease_category?: string;
  priority?: 'P1' | 'P2' | 'P3' | 'P4';
  status?: 'new' | 'triaged' | 'validated' | 'dismissed';
  confidence_score?: number;

  // Location data (full)
  location: {
    name: string;
    country: string;
    iso3?: string;
    country_iso?: string;
    admin1?: string;
    admin2?: string;
    locality?: string;
    coordinates?: [number, number] | { lat: number; lng: number };
  };
  location_lat?: number;
  location_lng?: number;

  // Original content (Lingua Fidelity)
  original_text?: string;
  original_language?: string;
  original_script?: string;
  translated_text?: string;
  translation_confidence?: number;
  lingua_fidelity_score?: number;

  // Source information
  source?: {
    name: string;
    url?: string;
    tier: number;
    type?: string;
  };
  source_name?: string;
  source_url?: string;
  source_type?: string;
  source_tier?: number;
  source_timestamp?: string;

  // Epidemiological data
  reported_cases?: number;
  reported_deaths?: number;
  affected_population?: string;

  // Risk flags
  cross_border_risk?: boolean;
  seasonal_pattern_match?: boolean;

  // Triage audit trail
  analyst_notes?: string;
  triaged_by?: string;
  triaged_at?: string;
  validated_by?: string;
  validated_at?: string;

  // Metadata
  ingestion_source?: string;
  created_at?: string;
  updated_at?: string;

  // AI Agent Classification
  ai_classification?: 'area_alert' | 'continent_alert' | 'no_alert' | 'uncertain';
  ai_severity?: 'low' | 'moderate' | 'high' | 'critical';
  ai_notification_scope?: 'local' | 'continental' | 'worldwide';
  ai_reasoning?: string;
  ai_classified_at?: string;

  // Legacy / compatibility fields
  hazard?: {
    type: 'disease' | 'climate' | 'health_system' | 'natural_disaster' | 'humanitarian_report';
    name: string;
    category: string;
    who_afro_code?: string;
  };

  epidemiology?: {
    suspected_cases?: number;
    deaths?: number;
  };

  lingua_data?: {
    original_text?: string;
    original_language?: string;
    translated_text?: string;
    local_voice?: boolean;
  };

  epi?: EpidemiologyData;
  lingua?: LinguaData;

  sources?: {
    tier: 1 | 2 | 3;
    type: string;
    name: string;
    icon: string;
    url?: string;
  }[];

  tags?: string[];
}


export interface RegionalSummary {
  disease: string;
  trend: 'increasing' | 'decreasing' | 'stable';
  countriesAffected: number;
  countriesList: string[];
  totalEstimatedCases: number;
  region?: string; // North, West, Central, East, Southern
}

export interface WatchtowerInsight {
  id: string;
  type: 'warning' | 'critical' | 'info';
  title: string;
  description: string;
  tags?: string[];
}

export interface BackendSignal {
  id: string;
  timestamp: string;
  type: 'heartbeat' | 'data_packet';
  status: 'ok' | 'latency';
}

export interface AutoDetection {
  id: string;
  type: 'ANOMALY_DETECTED' | 'VIRAL_SURGE';
  severity: 'HIGH' | 'CRITICAL';
  title: string;
  description: string;
  location: string;
  metric: string;
}

export interface IhmrefCategory {
  id: number;
  category: string;
}

export interface IhmrefData {
  id: number;
  category: string;
  year: string;
  afro: number;
  global_t: number;
  contribution: string;
  no_of_african_countries: number;
  african_countries_involved?: string;
}

export interface IhmrefCountry {
  id: number;
  country: string;
  full_name?: string;
  state?: string;
}

export interface Incident {
  id: number;
  country: IhmrefCountry;
  ihmref_data: IhmrefData;
  incident: string;
  start_date?: string;
  end_date?: string;
}

