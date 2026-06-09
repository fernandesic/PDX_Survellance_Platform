/**
 * usePredictions Hook
 * Manages state and data fetching for the Predictions Dashboard.
 */

import { useState, useEffect, useCallback } from 'react';
import { predictionsApi } from '@/pages/predictions/services/predictionsApi';
import { logger } from "@/utils/logger";
import type {
    OutbreakPrediction,
    OutbreakPredictionDetail,
    CountryRiskData,
    PredictionsSummary,
    TrendDataItem,
    PredictionModel,
    PredictionDisease,
} from '@/pages/predictions/types/predictions';

interface UsePredictionsReturn {
    // Data
    summary: PredictionsSummary | null;
    topRisks: OutbreakPrediction[];
    riskMapData: CountryRiskData[];
    trendData: TrendDataItem[];
    predictionModels: PredictionModel[];
    countryPredictions: OutbreakPredictionDetail[];

    // State
    loading: boolean;
    error: string | null;
    selectedCountry: string | null;
    selectedDisease: PredictionDisease;
    timeHorizon: '30' | '60' | '90';

    // Actions
    setSelectedCountry: (iso: string | null) => void;
    setSelectedDisease: (disease: PredictionDisease) => void;
    setTimeHorizon: (horizon: '30' | '60' | '90') => void;
    refresh: () => void;
}

export function usePredictions(): UsePredictionsReturn {
    const [summary, setSummary] = useState<PredictionsSummary | null>(null);
    const [topRisks, setTopRisks] = useState<OutbreakPrediction[]>([]);
    const [riskMapData, setRiskMapData] = useState<CountryRiskData[]>([]);
    const [trendData, setTrendData] = useState<TrendDataItem[]>([]);
    const [predictionModels, setPredictionModels] = useState<PredictionModel[]>([]);
    const [countryPredictions, setCountryPredictions] = useState<OutbreakPredictionDetail[]>([]);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
    const [selectedDisease, setSelectedDisease] = useState<PredictionDisease>('cholera');
    const [timeHorizon, setTimeHorizon] = useState<'30' | '60' | '90'>('30');

    // Load core data (summary, top risks, models)
    const loadCoreData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [summaryData, topRisksData, modelsData] = await Promise.all([
                predictionsApi.summary(),
                predictionsApi.topRisks(10),
                predictionsApi.models(),
            ]);
            setSummary(summaryData);
            setTopRisks(topRisksData);
            setPredictionModels(modelsData);
        } catch (err) {
            logger.error('[Predictions] Failed to load core data:', err);
            setError(err instanceof Error ? err.message : 'Failed to load predictions');
        } finally {
            setLoading(false);
        }
    }, []);

    // Load risk map data (depends on horizon and disease filter)
    const loadRiskMap = useCallback(async () => {
        try {
            const data = await predictionsApi.riskMap(timeHorizon);
            setRiskMapData(data);
        } catch (err) {
            logger.error('[Predictions] Failed to load risk map:', err);
        }
    }, [timeHorizon]);

    // Load trend data (depends on disease and country selection)
    const loadTrendData = useCallback(async () => {
        try {
            const data = await predictionsApi.trendData(
                selectedDisease,
                selectedCountry || undefined
            );
            setTrendData(data);
        } catch (err) {
            logger.error('[Predictions] Failed to load trend data:', err);
        }
    }, [selectedDisease, selectedCountry]);

    // Load country-specific predictions
    const loadCountryPredictions = useCallback(async (iso: string) => {
        try {
            const data = await predictionsApi.countryDetail(iso);
            setCountryPredictions(data);
        } catch (err) {
            logger.error('[Predictions] Failed to load country detail:', err);
        }
    }, []);

    // Initial load
    useEffect(() => {
        loadCoreData();
    }, [loadCoreData]);

    // Re-fetch risk map when horizon changes
    useEffect(() => {
        loadRiskMap();
    }, [loadRiskMap]);

    // Re-fetch trends when disease/country changes
    useEffect(() => {
        loadTrendData();
    }, [loadTrendData]);

    // Re-fetch country predictions when selection changes
    useEffect(() => {
        if (selectedCountry) {
            loadCountryPredictions(selectedCountry);
        } else {
            setCountryPredictions([]);
        }
    }, [selectedCountry, loadCountryPredictions]);

    const refresh = useCallback(() => {
        loadCoreData();
        loadRiskMap();
        loadTrendData();
    }, [loadCoreData, loadRiskMap, loadTrendData]);

    return {
        summary,
        topRisks,
        riskMapData,
        trendData,
        predictionModels,
        countryPredictions,
        loading,
        error,
        selectedCountry,
        selectedDisease,
        timeHorizon,
        setSelectedCountry,
        setSelectedDisease,
        setTimeHorizon,
        refresh,
    };
}
