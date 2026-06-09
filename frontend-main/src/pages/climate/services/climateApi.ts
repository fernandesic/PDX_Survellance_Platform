import type {
    ClimateData,
    ClimateBaseline,
    ClimateAnomaly,
    NASAPowerResponse,
    ClimateDataResponse,
    Region,
    TimeWindow,
    TimeWindowPreset,
    AnnualClimateData,
} from '@/pages/climate/types/climate';
import { fetchRealTimeClimateData, fetchForecastClimateData } from './openMeteoApi';
import { logger } from "@/utils/logger";

const NASA_POWER_BASE_URL = 'https://power.larc.nasa.gov/api/temporal/daily/point';
const NASA_POWER_ANNUAL_URL = 'https://power.larc.nasa.gov/api/temporal/annual/point';
const CLIMATE_VARIABLES = ['T2M', 'T2M_MAX', 'PRECTOTCORR', 'GWETROOT', 'WS2M', 'RH2M'];
const CACHE_TTL_MS = 0;

interface CacheEntry {
    data: any;
    timestamp: number;
}

const cache = new Map<string, CacheEntry>();

export function getTimeWindowDates(preset: TimeWindowPreset): TimeWindow {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    if (preset === 'today') {
        return {
            preset,
            startDate: todayStr,
            endDate: todayStr,
            label: 'Today (Live)',
        };
    }

    if (preset === '7days') {
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + 7);
        return {
            preset,
            startDate: todayStr,
            endDate: endDate.toISOString().split('T')[0],
            label: 'Next 7 Days (Forecast)',
        };
    }

    if (preset === '14days') {
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + 14);
        return {
            preset,
            startDate: todayStr,
            endDate: endDate.toISOString().split('T')[0],
            label: 'Next 14 Days (Forecast)',
        };
    }

    const endDate = new Date();
    endDate.setDate(endDate.getDate() - 5);
    const startDate = new Date(endDate);

    switch (preset) {
        case '30days':
            startDate.setDate(endDate.getDate() - 30);
            break;
        case '90days':
            startDate.setDate(endDate.getDate() - 90);
            break;
    }

    const daysCount = preset.replace('days', '');
    return {
        preset,
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        label: `Last ${daysCount} Days (Historical)`,
    };
}

function formatDateForAPI(dateStr: string): string {
    return dateStr.replace(/-/g, '');
}

function getCacheKey(lat: number, lng: number, start: string, end: string): string {
    return `${lat},${lng},${start},${end}`;
}

function isCacheValid(entry: CacheEntry | undefined): boolean {
    if (!entry) return false;
    return Date.now() - entry.timestamp < CACHE_TTL_MS;
}

async function fetchNASAPowerData(
    lat: number,
    lng: number,
    startDate: string,
    endDate: string,
    variables: string[] = CLIMATE_VARIABLES
): Promise<NASAPowerResponse> {
    const cacheKey = getCacheKey(lat, lng, startDate, endDate);
    const cached = cache.get(cacheKey);

    if (isCacheValid(cached)) {
        logger.log('[NASA API] Using cached data for', cacheKey);
        return cached!.data;
    }

    const params = new URLSearchParams({
        parameters: variables.join(','),
        community: 'AG',
        longitude: lng.toString(),
        latitude: lat.toString(),
        start: formatDateForAPI(startDate),
        end: formatDateForAPI(endDate),
        format: 'JSON',
    });

    const url = `${NASA_POWER_BASE_URL}?${params.toString()}`;

    logger.log('[NASA API] Fetching:', url);

    try {
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`NASA API error: ${response.status} ${response.statusText}`);
        }

        const data: NASAPowerResponse = await response.json();

        cache.set(cacheKey, {
            data,
            timestamp: Date.now(),
        });

        return data;
    } catch (error) {
        logger.error('[NASA API] Fetch error:', error);
        throw error;
    }
}

export async function fetchHistoricalBaseline(region: Region): Promise<ClimateBaseline[]> {
    logger.log(`[Climate API] Using Open-Meteo baseline for ${region.name} (NASA API disabled)`);
    
    return [
        { variable: 'T2M', mean: 25, stdDev: 3, percentiles: { p10: 20, p25: 22, p50: 25, p75: 28, p90: 30 } },
        { variable: 'PRECTOTCORR', mean: 2, stdDev: 1, percentiles: { p10: 1, p25: 1.5, p50: 2, p75: 2.5, p90: 3 } },
        { variable: 'WS2M', mean: 10, stdDev: 2, percentiles: { p10: 7, p25: 8.5, p50: 10, p75: 11.5, p90: 13 } },
        { variable: 'RH2M', mean: 60, stdDev: 10, percentiles: { p10: 45, p25: 52.5, p50: 60, p75: 67.5, p90: 75 } },
        { variable: 'GWETROOT', mean: 0.3, stdDev: 0.1, percentiles: { p10: 0.2, p25: 0.25, p50: 0.3, p75: 0.35, p90: 0.4 } }
    ];
}

export async function fetchClimateData(
    region: Region,
    timeWindow: TimeWindow,
    variables: string[] = CLIMATE_VARIABLES
): Promise<ClimateData[]> {
    const { lat, lng } = region.centroid;
    const { startDate, endDate } = timeWindow;

    try {
        const response = await fetchNASAPowerData(lat, lng, startDate, endDate, variables);

        const climateData: ClimateData[] = [];

        const dates = Object.keys(response.properties.parameter[variables[0]] || {});

        for (const date of dates) {
            const formattedDate = `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`;
            const T2M = response.properties.parameter.T2M?.[date];
            const T2M_MAX = response.properties.parameter.T2M_MAX?.[date];
            const PRECTOTCORR = response.properties.parameter.PRECTOTCORR?.[date];
            const GWETROOT = response.properties.parameter.GWETROOT?.[date];
            const WS2M = response.properties.parameter.WS2M?.[date];
            const RH2M = response.properties.parameter.RH2M?.[date];

            if (T2M === -999 || T2M_MAX === -999 || PRECTOTCORR === -999 || GWETROOT === -999) {
                logger.log(`[NASA API] Skipping ${formattedDate} due to missing data (-999 fill values)`);
                continue;
            }

            climateData.push({
                region: region.id,
                date: formattedDate,
                T2M: T2M ?? 0,
                T2M_MAX: T2M_MAX ?? 0,
                PRECTOTCORR: PRECTOTCORR ?? 0,
                GWETROOT: (GWETROOT ?? 0) * 100,
                WS2M: WS2M !== -999 ? WS2M : undefined,
                RH2M: RH2M !== -999 ? RH2M : undefined,
            });
        }

        return climateData.sort((a, b) => a.date.localeCompare(b.date));
    } catch (error) {
        logger.warn(`[Climate API] Failed to fetch historical data for ${region.name}`, error);
        return [];
    }
}

export function calculateAnomalies(
    currentData: ClimateData[],
    baselines: ClimateBaseline[]
): ClimateAnomaly[] {
    const anomalies: ClimateAnomaly[] = [];
    const avgValues: Record<string, number> = {};
    const variables = ['T2M', 'T2M_MAX', 'PRECTOTCORR', 'GWETROOT', 'WS2M', 'RH2M', 'clouds', 'pressure'];

    for (const variable of variables) {
        const values = currentData
            .map((d) => (d as any)[variable])
            .filter((v) => v !== undefined && v !== null && !isNaN(v));

        if (values.length > 0) {
            avgValues[variable] = values.reduce((sum, v) => sum + v, 0) / values.length;
        }
    }

    for (const baseline of baselines) {
        const currentValue = avgValues[baseline.variable];
        if (currentValue === undefined) continue;

        const zScore = (currentValue - baseline.mean) / (baseline.stdDev || 1);

        let percentile = 50;
        if (currentValue <= baseline.percentiles.p10) percentile = 10;
        else if (currentValue <= baseline.percentiles.p25) percentile = 25;
        else if (currentValue <= baseline.percentiles.p50) percentile = 50;
        else if (currentValue <= baseline.percentiles.p75) percentile = 75;
        else if (currentValue <= baseline.percentiles.p90) percentile = 90;
        else percentile = 95;

        anomalies.push({
            variable: baseline.variable,
            value: currentValue,
            zScore,
            percentile,
            anomalyMagnitude: currentValue - baseline.mean,
        });
    }

    return anomalies;
}

export async function getClimateDataWithAnomalies(
    region: Region,
    timeWindowPreset: TimeWindowPreset
): Promise<ClimateDataResponse> {
    try {
        const timeWindow = getTimeWindowDates(timeWindowPreset);

        let currentData: ClimateData[];

        if (timeWindowPreset === 'today') {
            const realTimeData = await fetchRealTimeClimateData(region);
            currentData = realTimeData ? [realTimeData] : [];
        } else if (timeWindowPreset === '7days' || timeWindowPreset === '14days') {
            const days = parseInt(timeWindowPreset.replace('days', ''));
            currentData = await fetchForecastClimateData(region, days);
        } else {
            currentData = await fetchClimateData(region, timeWindow);
        }

        if (currentData.length > 0) {
            logger.log(`[${region.name}] Data loaded (${timeWindowPreset}): ${currentData.length} records`);
        }

        const baseline = await fetchHistoricalBaseline(region);

        return {
            region,
            timeWindow,
            data: currentData,
            baseline,
            success: true,
        };
    } catch (error: any) {
        logger.error('[Climate API] Error:', error);
        return {
            region,
            timeWindow: getTimeWindowDates(timeWindowPreset),
            data: [],
            baseline: [],
            success: false,
            error: error.message || 'Failed to fetch climate data',
        };
    }
}

export async function fetchHistoricalAnnualData(region: Region): Promise<AnnualClimateData[]> {
    logger.log(`[Climate API] NASA Annual API disabled for ${region.name} due to CORS issues`);
    
    return [];
}

export function clearCache(): void {
    cache.clear();
    logger.log('[NASA API] Cache cleared');
}
