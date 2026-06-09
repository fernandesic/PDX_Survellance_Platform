export interface NewsItem {
  country: string;
  score: number;
  value: number;
}

export interface BaseResponse<T> {
  status: string;
  message: string;
  data: T;
}

export interface PlainBaseResponse extends BaseResponse<{

}> { }

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T
}

export interface CHWOverview {
  total_chw: number;
  total_chw_per_10k: number;
  countries: string[];
  districts: number;
  regions: number;
  top_region: { region: string; percentage: number }[];
  source: string;
  updated_at: string;
  top_countries?: { country: string; rate: number }[];
}

interface YearData {
  year: string;
  count: number;
  countries: string[];
  country_scores: Record<string, number>;
}

export interface EsparOverview {
  total_capacities: number;
  countries: string[];
  years: string[];
  years_data: YearData[];
  country_scores: Record<string, number>;
  avg_score: number;
  source: string;
  updated_at: string;
}

export interface ReadinessResult {
  total: number;
  answered: number;
  completion_pct: number;
}

export interface ReadinessSummary {
  arbovirus: ReadinessResult;
  cholera: ReadinessResult;
  cholera_subnational: ReadinessResult;
  cyclone: ReadinessResult;
  fvd: ReadinessResult;
  fvd_poe: ReadinessResult;
  lassa_fever: ReadinessResult;
  lassa_fever_district: ReadinessResult;
  marburg: ReadinessResult;
  meningitis: ReadinessResult;
  meningitise_elimination: ReadinessResult;
  mpox: ReadinessResult;
  mpox_district: ReadinessResult;
  natural_disaster: ReadinessResult;
  rift_valley_fever: ReadinessResult;
}

export interface ReadinessOverview {
  total_hazards: number;
  summary: ReadinessSummary;
  country_completion: Record<string, number>;
  overall_completion: number;
  fully_completed: Array<{ name: string; pct: number }>;
  needs_attention: Array<{ name: string; pct: number }>;
  source: string;
  updated_at: string;
}

export interface HazardBreakdown {
  hazard: string;
  risk_level: string;
  severity: string;
  count: number;
  numeric_risk: number;
  seasonality: number[];
}

export interface StarCountryData {
  country: string;
  code: string;
  total: number;
  very_high: number;
  high: number;
  moderate: number;
  low: number;
  very_low: number;
  risk_score: number;
  avg_risk: number;
  seasonality: number[];
  hazards: HazardBreakdown[];
}

export interface StarTickerAlert {
  country: string;
  code: string;
  hazard: string;
  risk_level: string;
  hazard_type: string;
}

export interface RiskDistribution {
  very_high: number;
  high: number;
  moderate: number;
  low: number;
  very_low: number;
}

export interface HazardMonthlyData {
  month: string;
  month_index: number;
  risk_level: number;
  count: number;
}

export interface HazardTypeRisk {
  hazard_type: string;
  monthly_data: HazardMonthlyData[];
  total_events: number;
}

export interface StardataOverview {
  countries: number;
  hazards: number;
  hazard_types: number;
  active: number;
  levels: string[];
  years: string[];
  available_hazards: string[];
  available_hazard_types: string[];
  hazard_type_monthly_risk: HazardTypeRisk[];
  chart_by_country: StarCountryData[];
  risk_distribution: RiskDistribution;
  ticker_alerts: StarTickerAlert[];
  source: string;
  updated_at: string;
}

export interface PamiOverview {
  countries: number;
  total_incidents: number;
  active_countries: string[];
  source: string;
  updated_at: string;
}

export interface PdxOverview {
  countries: number;
  source: string;
  updated_at: string;
}

export interface OverviewResponse extends BaseResponse<{
  last_updated: string;
  chart: {
    total_chw_and_population_2024: { year: string; country: string; chw: string; population: string; }[],
  }
  chw: CHWOverview;
  espar: EsparOverview;
  readiness: ReadinessOverview;
  stardata: StardataOverview;
  pami: PamiOverview;
  pdx: PdxOverview;
}> { }

export interface NewsType {
  key: string;
  value_1: string;
  value_2: string;
}



export interface NewsResponse {
  chw: NewsType[]
  espar: NewsType[],
  stardata: NewsType[],
}

export interface AlertType {
  id: number;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  category: string;
  status: "active" | "acknowledged" | "resolved";
  title: string;
  description: string;
  country: string;
  region: string;
  date: string;
  acknowledged_by?: string;
}

export interface AlertResponse extends PaginatedResponse<AlertType[]> {
  high: number;
  medium: number;
  low: number;
  critical: number;
}