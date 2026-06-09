import type { ClimateData, Region } from '@/pages/climate/types/climate';
import { logger } from "@/utils/logger";

const OPEN_METEO_BASE_URL = 'https://api.open-meteo.com/v1/forecast';

interface OpenMeteoCurrentResponse {
    latitude: number;
    longitude: number;
    timezone: string;
    current: {
        time: string;
        temperature_2m: number;
        relative_humidity_2m: number;
        precipitation: number;
        wind_speed_10m: number;
        wind_direction_10m: number;
        weather_code: number;
        cloud_cover: number;
        surface_pressure: number;
    };
    hourly?: {
        time: string[];
        temperature_2m: number[];
        relative_humidity_2m: number[];
        precipitation: number[];
        wind_speed_10m: number[];
        soil_moisture_0_to_10cm: number[];
    };
    daily?: {
        time: string[];
        temperature_2m_max: number[];
        temperature_2m_min: number[];
        precipitation_sum: number[];
        wind_speed_10m_max: number[];
    };
}

const CACHE_PREFIX = 'weather_cache_';

interface CacheItem<T> {
    data: T;
    timestamp: number;
}

function getFromCache<T>(key: string, ttlForSeconds: number): T | null {
    try {
        const itemStr = localStorage.getItem(CACHE_PREFIX + key);
        if (!itemStr) return null;

        const item: CacheItem<T> = JSON.parse(itemStr);
        const age = (Date.now() - item.timestamp) / 1000;

        if (age > ttlForSeconds) {
            localStorage.removeItem(CACHE_PREFIX + key);
            return null;
        }
        return item.data;
    } catch (e) {
        return null;
    }
}

function saveToCache<T>(key: string, data: T) {
    try {
        const item: CacheItem<T> = {
            data,
            timestamp: Date.now()
        };
        localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(item));
    } catch (e) {
    }
}

export async function fetchCurrentWeather(
    lat: number,
    lng: number
): Promise<OpenMeteoCurrentResponse> {
    const params = new URLSearchParams({
        latitude: lat.toString(),
        longitude: lng.toString(),
        current: [
            'temperature_2m',
            'relative_humidity_2m',
            'precipitation',
            'wind_speed_10m',
            'wind_direction_10m',
            'weather_code',
            'cloud_cover',
            'surface_pressure'
        ].join(','),
        hourly: [
            'temperature_2m',
            'relative_humidity_2m',
            'precipitation',
            'wind_speed_10m',
            'soil_moisture_0_to_10cm',
            'cloud_cover',
            'surface_pressure'
        ].join(','),
        daily: [
            'temperature_2m_max',
            'temperature_2m_min',
            'precipitation_sum',
            'wind_speed_10m_max'
        ].join(','),
        timezone: 'auto',
        forecast_days: '1'
    });

    const cacheKey = `current_${lat}_${lng}`;
    const cached = getFromCache<OpenMeteoCurrentResponse>(cacheKey, 1800);
    if (cached) return cached;

    const url = `${OPEN_METEO_BASE_URL}?${params.toString()}`;
    logger.log('[Open-Meteo] Fetching real-time data:', url);

    try {
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Open-Meteo API error: ${response.status} ${response.statusText}`);
        }

        const data: OpenMeteoCurrentResponse = await response.json();
        saveToCache(cacheKey, data);
        return data;
    } catch (error) {
        logger.error('[Open-Meteo] Fetch error:', error);
        throw error;
    }
}

export async function fetchQuickTemp(
    lat: number,
    lng: number
): Promise<{ temp: number; precipitation: number; time: string }> {
    const params = new URLSearchParams({
        latitude: lat.toString(),
        longitude: lng.toString(),
        current: 'temperature_2m,precipitation',
        timezone: 'auto'
    });

    const url = `${OPEN_METEO_BASE_URL}?${params.toString()}`;

    try {
        const response = await fetch(url);

        if (response.status === 429) {
            throw new Error('RateLimit');
        }

        if (!response.ok) throw new Error('API Error');

        const data = await response.json();
        return {
            temp: data.current.temperature_2m,
            precipitation: data.current.precipitation,
            time: data.current.time
        };
    } catch (error: any) {
        if (error.message === 'RateLimit') throw error;
        logger.error('[Open-Meteo] Quick fetch error:', error);
        throw error;
    }
}

export function convertToClimateData(
    response: OpenMeteoCurrentResponse,
    regionId: string
): ClimateData {
    const today = new Date().toISOString().split('T')[0];

    if (!response || !response.current) {
        return {
            date: today,
            region: regionId,
            T2M: 0,
            T2M_MAX: 0,
            PRECTOTCORR: 0,
            GWETROOT: 50,
            WS2M: 0,
            WD10M: 0,
            RH2M: 50,
            weatherCode: 0
        };
    }

    const avgTemp = response.current.temperature_2m || 0;
    const maxTemp = response.current.temperature_2m || 0;
    const totalPrecip = response.current.precipitation || 0;
    const avgHumidity = response.current.relative_humidity_2m || 50;
    const avgWind = response.current.wind_speed_10m || 0;
    const windDir = response.current.wind_direction_10m || 0;
    const weatherCode = response.current.weather_code || 0;
    const clouds = response.current.cloud_cover || 0;
    const pressure = response.current.surface_pressure || 1013;
    const avgSoilMoisture = 50;

    return {
        region: regionId,
        date: today,
        T2M: avgTemp,
        T2M_MAX: maxTemp,
        PRECTOTCORR: totalPrecip,
        GWETROOT: avgSoilMoisture,
        WS2M: avgWind,
        WD10M: windDir,
        RH2M: avgHumidity,
        weatherCode: weatherCode,
        clouds: clouds,
        pressure: pressure
    };
}

export async function fetchRealTimeClimateData(
    region: Region
): Promise<ClimateData | null> {
    try {
        const { lat, lng } = region.centroid;
        const response = await fetchCurrentWeather(lat, lng);
        return convertToClimateData(response, region.id);
    } catch (error) {
        logger.error(`[Open-Meteo] Failed to fetch data for ${region.name}:`, error);
        logger.warn(`[Open-Meteo] Falling back to SIMULATED data for ${region.name}`);

        const mockTemp = 25 + Math.random() * 10;
        return {
            region: region.id,
            date: new Date().toISOString().split('T')[0],
            T2M: mockTemp,
            T2M_MAX: mockTemp + 5,
            PRECTOTCORR: Math.random() > 0.7 ? Math.random() * 20 : 0,
            GWETROOT: 40 + Math.random() * 40,
            WS2M: 2 + Math.random() * 8,
            RH2M: 60 + Math.random() * 20,
            clouds: 20 + Math.random() * 60,
            pressure: 1000 + Math.random() * 20
        };
    }
}

export async function fetchForecastClimateData(
    region: Region,
    days: number
): Promise<ClimateData[]> {
    try {
        const { lat, lng } = region.centroid;
        const params = new URLSearchParams({
            latitude: lat.toString(),
            longitude: lng.toString(),
            hourly: [
                'temperature_2m',
                'relative_humidity_2m',
                'precipitation',
                'wind_speed_10m',
                'soil_moisture_0_to_10cm'
            ].join(','),
            daily: [
                'temperature_2m_max',
                'temperature_2m_min',
                'precipitation_sum',
                'wind_speed_10m_max'
            ].join(','),
            timezone: 'auto',
            forecast_days: days.toString()
        });

        const url = `${OPEN_METEO_BASE_URL}?${params.toString()}`;
        logger.log(`[Open-Meteo] Fetching ${days}-day forecast:`, url);

        const response = await fetch(url);
        if (!response.ok) throw new Error(`API Error: ${response.status}`);

        const data: OpenMeteoCurrentResponse = await response.json();

        if (!data.daily || !data.daily.time) return [];

        return data.daily.time.map((date, index) => {
            return {
                region: region.id,
                date: date,
                T2M: (data.daily!.temperature_2m_max[index] + data.daily!.temperature_2m_min[index]) / 2,
                T2M_MAX: data.daily!.temperature_2m_max[index],
                PRECTOTCORR: data.daily!.precipitation_sum[index],
                GWETROOT: data.hourly?.soil_moisture_0_to_10cm
                    ? (data.hourly.soil_moisture_0_to_10cm.slice(index * 24, (index + 1) * 24)
                        .reduce((sum, val) => sum + (val || 0), 0) / 24) * 100
                    : 50,
                WS2M: data.daily!.wind_speed_10m_max[index],
                RH2M: data.hourly?.relative_humidity_2m
                    ? data.hourly.relative_humidity_2m.slice(index * 24, (index + 1) * 24)
                        .reduce((sum, val) => sum + (val || 0), 0) / 24
                    : 50,
                weatherCode: data.current?.weather_code
            };
        });

    } catch (error) {
        logger.error(`[Open-Meteo] Forecast failed for ${region.name}:`, error);
        logger.warn(`[Open-Meteo] Falling back to SIMULATED forecast for ${region.name}`);

        const today = new Date();
        const mockData: ClimateData[] = [];

        for (let i = 0; i < days; i++) {
            const date = new Date(today);
            date.setDate(today.getDate() + i);
            const dateStr = date.toISOString().split('T')[0];
            const baseTemp = 25 + Math.random() * 8;

            mockData.push({
                region: region.id,
                date: dateStr,
                T2M: baseTemp,
                T2M_MAX: baseTemp + 5,
                PRECTOTCORR: Math.random() > 0.6 ? Math.random() * 15 : 0,
                GWETROOT: 45 + Math.random() * 10,
                WS2M: 3 + Math.random() * 5,
                RH2M: 55 + Math.random() * 20
            });
        }
        return mockData;
    }
}

export async function fetchRealTimeClimateDataBatch(
    regions: Region[],
    batchSize: number = 50
): Promise<Map<string, ClimateData>> {
    const results = new Map<string, ClimateData>();

    for (let i = 0; i < regions.length; i += batchSize) {
        const batch = regions.slice(i, i + batchSize);
        logger.log(`[Open-Meteo] Batching fetch for ${batch.length} regions...`);

        try {
            const lats = batch.map(r => r.centroid.lat).join(',');
            const lngs = batch.map(r => r.centroid.lng).join(',');

            const params = new URLSearchParams({
                latitude: lats,
                longitude: lngs,
                current: [
                    'temperature_2m',
                    'relative_humidity_2m',
                    'precipitation',
                    'wind_speed_10m',
                    'wind_direction_10m',
                    'weather_code'
                ].join(','),
                hourly: [
                    'temperature_2m',
                    'relative_humidity_2m',
                    'precipitation',
                    'wind_speed_10m',
                    'soil_moisture_0_to_10cm'
                ].join(','),
                daily: [
                    'temperature_2m_max',
                    'temperature_2m_min',
                    'precipitation_sum',
                    'wind_speed_10m_max'
                ].join(','),
                timezone: 'auto',
                forecast_days: '1'
            });

            const url = `${OPEN_METEO_BASE_URL}?${params.toString()}`;
            const response = await fetch(url);

            if (!response.ok) {
                logger.warn(`[Open-Meteo] Batch request failed: ${response.status}`);
                continue;
            }

            const data = await response.json();

            const responseArray = Array.isArray(data) ? data : [data];

            responseArray.forEach((item: any, index: number) => {
                if (index < batch.length) {
                    const region = batch[index];
                    const climateData = convertToClimateData(item, region.id);
                    results.set(region.id, climateData);
                }
            });

        } catch (err) {
            logger.error('[Open-Meteo] Batch fetch error:', err);
        }

        if (i + batchSize < regions.length) await new Promise(r => setTimeout(r, 200));
    }

    return results;
}

export function getWeatherDescription(weatherCode: number): string {
    const codes: Record<number, string> = {
        0: 'Clear sky',
        1: 'Mainly clear',
        2: 'Partly cloudy',
        3: 'Overcast',
        45: 'Fog',
        48: 'Depositing rime fog',
        51: 'Light drizzle',
        53: 'Moderate drizzle',
        55: 'Dense drizzle',
        61: 'Slight rain',
        63: 'Moderate rain',
        65: 'Heavy rain',
        71: 'Slight snow',
        73: 'Moderate snow',
        75: 'Heavy snow',
        77: 'Snow grains',
        80: 'Slight rain showers',
        81: 'Moderate rain showers',
        82: 'Violent rain showers',
        85: 'Slight snow showers',
        86: 'Heavy snow showers',
        95: 'Thunderstorm',
        96: 'Thunderstorm with slight hail',
        99: 'Thunderstorm with heavy hail'
    };
    return codes[weatherCode] || 'Unknown';
}
export async function fetchWeatherGrid(
    latMin: number,
    latMax: number,
    lngMin: number,
    lngMax: number,
    spacing: number = 5
): Promise<any[]> {
    const coords: { lat: number, lng: number }[] = [];
    for (let lat = latMin; lat <= latMax; lat += spacing) {
        for (let lng = lngMin; lng <= lngMax; lng += spacing) {
            coords.push({ lat, lng });
        }
    }

    const BATCH_SIZE = 50;
    const batches = [];
    for (let i = 0; i < coords.length; i += BATCH_SIZE) {
        batches.push(coords.slice(i, i + BATCH_SIZE));
    }


    const results: any[] = [];

    await Promise.all(batches.map(async (batch, batchIndex) => {
        try {
            const latitudes = batch.map(c => c.lat).join(',');
            const longitudes = batch.map(c => c.lng).join(',');

            const params = new URLSearchParams({
                latitude: latitudes,
                longitude: longitudes,
                current: 'temperature_2m,wind_speed_10m,wind_direction_10m',
                timezone: 'auto'
            });

            const url = `${OPEN_METEO_BASE_URL}?${params.toString()}`;
            const response = await fetch(url);

            if (!response.ok) {
                return;
            }

            const data = await response.json();
            const batchResults = Array.isArray(data) ? data : [data];

            const processed = batchResults.map((d: any) => ({
                latitude: d.latitude,
                longitude: d.longitude,
                temp: d.current.temperature_2m,
                windSpeed: d.current.wind_speed_10m,
                windDirection: d.current.wind_direction_10m,
                u: d.current.wind_speed_10m * Math.cos((270 - d.current.wind_direction_10m) * Math.PI / 180),
                v: d.current.wind_speed_10m * Math.sin((270 - d.current.wind_direction_10m) * Math.PI / 180)
            }));

            results.push(...processed);
        } catch (error) {
            logger.error(`[Open-Meteo] Batch ${batchIndex} error:`, error);
        }
    }));

    return results;
}

export async function fetchAfricaHighResGrid(): Promise<(ClimateData & { lat: number, lng: number })[]> {
    logger.log('[Open-Meteo] Generating High-Res Africa Grid...');
    const gridPoints: Region[] = [];
    const latMin = -35, latMax = 38;
    const lngMin = -18, lngMax = 52;
    const step = 4;

    let idCounter = 0;
    for (let lat = latMin; lat <= latMax; lat += step) {
        for (let lng = lngMin; lng <= lngMax; lng += step) {
            gridPoints.push({
                id: `grid_${idCounter++}`,
                name: 'Grid Point',
                adminLevel: 'country',
                countryCode: 'XX',
                centroid: { lat, lng }
            });
        }
    }

    const cacheKey = 'africa_high_res_grid';
    const cachedGrid = getFromCache<(ClimateData & { lat: number, lng: number })[]>(cacheKey, 3600);
    if (cachedGrid) {
        return cachedGrid;
    }

    const gridMap = await fetchRealTimeClimateDataBatch(gridPoints, 60);

    const result = gridPoints.map(point => {
        const data = gridMap.get(point.id);
        if (!data) return null;
        return {
            ...data,
            lat: point.centroid.lat,
            lng: point.centroid.lng
        };
    }).filter(d => d !== null) as (ClimateData & { lat: number, lng: number })[];

    if (result.length > 0) {
        saveToCache(cacheKey, result);
    }

    return result;
}
