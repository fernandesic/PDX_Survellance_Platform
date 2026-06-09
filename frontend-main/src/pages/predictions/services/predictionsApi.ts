/**
 * Predictions API Service
 * Fetches outbreak risk prediction data from the backend.
 */

import { apiGet, apiPost } from '@/lib/api';
import type {
    OutbreakPrediction,
    OutbreakPredictionDetail,
    CountryRiskData,
    CountryForecastData,
    InterventionPlanData,
    PredictionsSummary,
    TrendDataItem,
    PredictionModel,
} from '@/pages/predictions/types/predictions';

const BASE = '/predictions';

export const predictionsApi = {
    /** Fetch all predictions with optional filters */
    list: async (params?: {
        country?: string;
        disease?: string;
        risk_level?: string;
        min_score?: number;
    }): Promise<OutbreakPrediction[]> => {
        const query = new URLSearchParams();
        if (params?.country) query.append('country', params.country);
        if (params?.disease) query.append('disease', params.disease);
        if (params?.risk_level) query.append('risk_level', params.risk_level);
        if (params?.min_score) query.append('min_score', params.min_score.toString());
        const qs = query.toString() ? `?${query.toString()}` : '';
        return await apiGet<OutbreakPrediction[]>(`${BASE}/predictions/${qs}`);
    },

    /** Top N highest-risk country-disease combos */
    topRisks: async (limit = 10): Promise<OutbreakPrediction[]> => {
        return await apiGet<OutbreakPrediction[]>(`${BASE}/predictions/top_risks/?limit=${limit}`);
    },

    /** All predictions for a specific country (with forecast data) */
    countryDetail: async (iso: string): Promise<OutbreakPredictionDetail[]> => {
        return await apiGet<OutbreakPredictionDetail[]>(`${BASE}/predictions/country/${iso}/`);
    },

    /** Dashboard summary KPIs (optionally scoped to a country ISO) */
    summary: async (params?: { country?: string }): Promise<PredictionsSummary> => {
        const qs = params?.country ? `?country=${encodeURIComponent(params.country)}` : '';
        return await apiGet<PredictionsSummary>(`${BASE}/predictions/summary/${qs}`);
    },

    /** Country-level risk map data */
    riskMap: async (horizon?: string, disease?: string): Promise<CountryRiskData[]> => {
        const query = new URLSearchParams();
        if (horizon) query.append('horizon', horizon);
        if (disease) query.append('disease', disease);
        const qs = query.toString() ? `?${query.toString()}` : '';
        return await apiGet<CountryRiskData[]>(`${BASE}/predictions/risk_map/${qs}`);
    },

    /** Forecast trend data for a disease */
    trendData: async (disease: string, country?: string): Promise<TrendDataItem[]> => {
        const query = new URLSearchParams({ disease });
        if (country) query.append('country', country);
        return await apiGet<TrendDataItem[]>(`${BASE}/predictions/trend_data/?${query.toString()}`);
    },

    /** Prediction models metadata */
    models: async (): Promise<PredictionModel[]> => {
        return await apiGet<PredictionModel[]>(`${BASE}/models/`);
    },

    /** National-level weekly forecast from real ML model */
    countryForecast: async (iso: string): Promise<CountryForecastData> => {
        return await apiGet<CountryForecastData>(`${BASE}/predictions/country_forecast/${iso}/`);
    },

    /** District/province intervention plan — cases + deaths + risk */
    interventionPlan: async (iso: string): Promise<InterventionPlanData> => {
        return await apiGet<InterventionPlanData>(`${BASE}/predictions/intervention_plan/${iso}/`);
    },

    /** Recompute predictions from live data */
    compute: async (): Promise<{ status: string; created: number; updated: number; errors: number }> => {
        return await apiPost(`${BASE}/predictions/compute/`, {});
    },
};
