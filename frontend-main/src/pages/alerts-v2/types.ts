export const AlertLevel = {
  CRITICAL: 'P1',
  HIGH: 'P2',
  MEDIUM: 'P3',
  LOW: 'P4',
} as const;

export type AlertLevel = (typeof AlertLevel)[keyof typeof AlertLevel];

export type AiClassification = 'area_alert' | 'continent_alert' | 'no_alert' | 'uncertain';
export type AiSeverity = 'low' | 'moderate' | 'high' | 'critical';
export type AiNotificationScope = 'local' | 'continental' | 'worldwide';
export type SignalStatus = 'new' | 'triaged' | 'validated' | 'dismissed';

export interface SignalLocation {
  name?: string;
  country?: string;
  iso3?: string;
  country_iso?: string;
  admin1?: string;
  admin2?: string;
  locality?: string;
  coordinates?: [number, number] | { lat: number; lng: number };
}

export interface SignalSource {
  name: string;
  url?: string;
  tier: 0 | 1 | 2 | 3;
  type?: string;
}

export interface Signal {
  id: string;
  signal_id?: string;
  headline?: string;
  summary?: string;

  // Classification
  signal_type?: 'disease' | 'hazard' | 'rumor';
  disease_name?: string;
  disease_category?: string;
  priority?: AlertLevel;
  level?: AlertLevel;
  status?: SignalStatus;
  confidence_score?: number;

  // Location
  location: SignalLocation;
  location_lat?: number;
  location_lng?: number;

  // Original content
  original_text?: string;
  original_language?: string;
  translated_text?: string;
  translation_confidence?: number;

  // Source
  source?: SignalSource;
  source_name?: string;
  source_url?: string;
  source_type?: string;
  source_tier?: 0 | 1 | 2 | 3;
  source_timestamp?: string;

  // Epidemiology
  reported_cases?: number;
  reported_deaths?: number;
  affected_population?: string;

  // Risk flags
  cross_border_risk?: boolean;
  seasonal_pattern_match?: boolean;

  // Audit trail
  analyst_notes?: string;
  triaged_by?: string;
  triaged_at?: string;
  validated_by?: string;
  validated_at?: string;

  // Metadata
  ingestion_source?: string;
  created_at?: string;
  updated_at?: string;
  publishedAt?: string;

  // AI agent fields
  ai_classification?: AiClassification;
  ai_severity?: AiSeverity;
  ai_notification_scope?: AiNotificationScope;
  ai_reasoning?: string;
  ai_classified_at?: string;
}

/** Shape the feed cards render — derived from Signal by AlertsPageV2. */
export interface ProcessedAlert {
  id: string;
  priority: AlertLevel;
  title: string;
  countryName: string;
  countryIso3: string;
  flag: string;
  diseaseName: string;
  cases?: number;
  deaths?: number;
  sourceName: string;
  sourceTier: 0 | 1 | 2 | 3;
  sourceUrl?: string;
  aiSeverity?: AiSeverity;
  aiClassification?: AiClassification;
  confidenceScore?: number;
  originalLanguage?: string;
  translatedText?: string;
  originalText?: string;
  publishedAt?: string;
  raw: Signal;
}

export interface AlertStats {
  total: number;
  by_priority: Record<string, number>;
  by_status: Record<string, number>;
  by_country: Record<string, number>;
}

export interface AlertsResponse {
  signals: Signal[];
  stats?: AlertStats;
}

export type DateRange = 'all' | '24h' | '3d' | '7d' | '30d' | 'custom';

export interface ActiveFilters {
  priorities: AlertLevel[];
  countries: string[];
  diseases: string[];
  search: string;
  dateRange: DateRange;
  dateFrom: string;
  dateTo: string;
}

export const EMPTY_FILTERS: ActiveFilters = {
  priorities: [],
  countries: [],
  diseases: [],
  search: '',
  dateRange: 'all',
  dateFrom: '',
  dateTo: '',
};

export interface IhmrefCountry {
  id: number;
  country: string;
  full_name?: string;
  state?: string;
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

export interface Incident {
  id: number;
  country: IhmrefCountry;
  ihmref_data: IhmrefData;
  incident: string;
  start_date?: string;
  end_date?: string;
}

export interface DiseaseKeyword {
  code: string;
  name: string;
  syndrome: string;
  keywords: string[];
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
