/**
 * Predictions Dashboard — TypeScript Types
 * Matches backend API response structure from predictions app.
 */

// Risk levels
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

// Disease types tracked by predictions
export type PredictionDisease =
    | 'cholera' | 'mpox' | 'malaria' | 'meningitis' | 'ebola'
    | 'marburg' | 'lassa_fever' | 'rift_valley_fever' | 'measles' | 'yellow_fever';

// Prediction model metadata
export interface PredictionModel {
    id: number;
    name: string;
    model_type: string;
    description: string;
    weight: number;
    accuracy_score: number | null;
    last_run: string | null;
    is_active: boolean;
}

// Forecast data point (per day)
export interface ForecastDataPoint {
    date: string;
    predicted: number;
    lower: number;
    upper: number;
}

// Outbreak prediction (list view — no forecast_data)
export interface OutbreakPrediction {
    id: number;
    country_iso: string;
    country_name: string;
    disease_name: PredictionDisease;
    composite_risk_score: number;
    risk_level: RiskLevel;
    star_score: number;
    climate_score: number;
    sentinel_score: number;
    espar_score: number;
    readiness_score: number;
    predicted_cases_30d: number;
    predicted_cases_60d: number;
    predicted_cases_90d: number;
    confidence: number;
    confidence_lower: number;
    confidence_upper: number;
    climate_drivers: string[];
    data_sources_used: string[];
    source_model_name: string | null;
    prediction_date: string;
    valid_until: string | null;
}

// Full prediction with forecast data (detail view)
export interface OutbreakPredictionDetail extends OutbreakPrediction {
    forecast_data: ForecastDataPoint[];
    source_model: PredictionModel | null;
}

// Risk map country data
export interface CountryRiskData {
    country_iso: string;
    country_name: string;
    score: number;
    risk_level: RiskLevel;
    top_disease: string;
    predicted_cases: number;
    confidence: number;
    data_sources: string[];
}

// Dashboard summary KPIs
export interface PredictionsSummary {
    total_predictions: number;
    critical_count: number;
    high_count: number;
    countries_at_risk: number;
    avg_confidence: number;
    highest_risk: {
        country: string;
        disease: string;
        score: number;
    } | null;
    last_computed: string | null;
}

// Trend data response
export interface TrendDataItem {
    country_iso: string;
    country_name: string;
    disease: string;
    risk_score: number;
    forecast: ForecastDataPoint[];
    confidence: number;
}

// Country forecast data (real ML model output)
export interface WeeklyForecastPoint {
    date: string;
    cases: number;
    deaths: number;
    cumulative_cases: number;
    cumulative_deaths: number;
}

export interface CountryForecastData {
    country_iso: string;
    country_name: string;
    disease: string;
    data: WeeklyForecastPoint[];
}

// District/province intervention plan
export interface InterventionRegion {
    district: string;
    province: string;
    total_cases: number;
    total_deaths: number;
    risk_level: RiskLevel;
    action_required: string;
}

export interface InterventionPlanData {
    country_iso: string;
    country_name: string;
    region_label: 'district' | 'province';
    disease: string;
    total_regions: number;
    data: InterventionRegion[];
}

// Risk level styling
export const RISK_LEVEL_CONFIG: Record<RiskLevel, { color: string; bgColor: string; label: string }> = {
    CRITICAL: { color: '#ef4444', bgColor: 'rgba(239, 68, 68, 0.15)', label: 'Critical' },
    HIGH: { color: '#f97316', bgColor: 'rgba(249, 115, 22, 0.15)', label: 'High' },
    MEDIUM: { color: '#eab308', bgColor: 'rgba(234, 179, 8, 0.15)', label: 'Medium' },
    LOW: { color: '#22c55e', bgColor: 'rgba(34, 197, 94, 0.15)', label: 'Low' },
};

// Disease display names
export const DISEASE_DISPLAY_NAMES: Record<PredictionDisease, string> = {
    cholera: 'Cholera',
    mpox: 'Mpox',
    malaria: 'Malaria',
    meningitis: 'Meningitis',
    ebola: 'Ebola',
    marburg: 'Marburg',
    lassa_fever: 'Lassa Fever',
    rift_valley_fever: 'Rift Valley Fever',
    measles: 'Measles',
    yellow_fever: 'Yellow Fever',
};
