import logger from "@/utils/logger";

interface TemperaturePoint {
    lat: number;
    lng: number;
    temp: number;
    tempF: number;
    windSpeed: number;
    windDirection: number;
}

interface CachedGrid {
    data: TemperaturePoint[];
    timestamp: number;
    bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number };
}

let cachedGrid: CachedGrid | null = null;
const CACHE_TTL = 10 * 60 * 1000;
let globalBackoffUntil = 0;


export function celsiusToFahrenheit(celsius: number): number {
    return (celsius * 9 / 5) + 32;
}


export async function fetchRealTemperatureGrid(
    minLat: number,
    maxLat: number,
    minLng: number,
    maxLng: number,
    gridSize: number = 10
): Promise<TemperaturePoint[]> {
    if (cachedGrid &&
        Date.now() - cachedGrid.timestamp < CACHE_TTL &&
        cachedGrid.bounds.minLat <= minLat + 5 &&
        cachedGrid.bounds.maxLat >= maxLat - 5 &&
        cachedGrid.bounds.minLng <= minLng + 5 &&
        cachedGrid.bounds.maxLng >= maxLng - 5) {
        return cachedGrid.data;
    }

    const startTime = performance.now();

    const points: TemperaturePoint[] = [];


    minLat = Math.max(-60, minLat);
    maxLat = Math.min(70, maxLat);
    minLng = Math.max(-180, minLng);
    maxLng = Math.min(180, maxLng);

    const latStep = (maxLat - minLat) / (gridSize - 1);
    const lngStep = (maxLng - minLng) / (gridSize - 1);


    const allCoords: { lat: number; lng: number }[] = [];

    for (let i = 0; i < gridSize; i++) {
        for (let j = 0; j < gridSize; j++) {
            allCoords.push({
                lat: Number((minLat + i * latStep).toFixed(2)),
                lng: Number((minLng + j * lngStep).toFixed(2))
            });
        }
    }


    const BATCH_SIZE = 50;
    const batches = [];
    for (let i = 0; i < allCoords.length; i += BATCH_SIZE) {
        batches.push(allCoords.slice(i, i + BATCH_SIZE));
    }

    try {

        const batchResults = [];
        for (let i = 0; i < batches.length; i++) {
            const batch = batches[i];

            if (Date.now() < globalBackoffUntil) {
                logger.warn('[Open-Meteo] Backing off due to previous 429...');
                batchResults.push({ data: [], coords: batch });
                continue;
            }

            try {
                const latitudes = batch.map(c => c.lat);
                const longitudes = batch.map(c => c.lng);
                const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitudes.join(',')}&longitude=${longitudes.join(',')}&current=temperature_2m,wind_speed_10m,wind_direction_10m&temperature_unit=celsius&wind_speed_unit=ms&timezone=auto`;

                const response = await fetch(url);
                if (response.status === 429) {
                    logger.error('[Open-Meteo] 429 Too Many Requests detected. Backing off for 60s.');
                    globalBackoffUntil = Date.now() + 60000;
                    throw new Error(`API error: ${response.status}`);
                }
                if (!response.ok) throw new Error(`API error: ${response.status}`);

                const data = await response.json();
                batchResults.push({ data, coords: batch });

                if (i < batches.length - 1) await new Promise(r => setTimeout(r, 200));
            } catch (error) {
                logger.error(`[Open-Meteo] Batch ${i} fetch error:`, error);
                batchResults.push({ data: [], coords: batch, error: true });
            }
        }


        batchResults.forEach(({ data, coords, error }) => {
            if (error || (Array.isArray(data) && data.length === 0)) {
            } else if (Array.isArray(data)) {
                data.forEach((item: any, idx: number) => {
                    if (item.current?.temperature_2m !== undefined) {
                        const tempC = item.current.temperature_2m;
                        points.push({
                            lat: coords[idx].lat,
                            lng: coords[idx].lng,
                            temp: tempC,
                            tempF: celsiusToFahrenheit(tempC),
                            windSpeed: item.current.wind_speed_10m || 0,
                            windDirection: item.current.wind_direction_10m || 0
                        });
                    }
                });
            } else if (data.current?.temperature_2m !== undefined) {
                const tempC = data.current.temperature_2m;
                points.push({
                    lat: coords[0].lat,
                    lng: coords[0].lng,
                    temp: tempC,
                    tempF: celsiusToFahrenheit(tempC),
                    windSpeed: data.current.wind_speed_10m || 0,
                    windDirection: data.current.wind_direction_10m || 0
                });
            }
        });

        const elapsed = performance.now() - startTime;


        if (points.length > 0) {
            cachedGrid = {
                data: points,
                timestamp: Date.now(),
                bounds: { minLat, maxLat, minLng, maxLng }
            };
        }

        return points;

    } catch (error) {
        logger.error('Temperature grid fetch failed:', error);
        return [];
    }
}


export function interpolateTemperature(
    lat: number,
    lng: number,
    points: TemperaturePoint[],
    useFahrenheit: boolean = true
): number {
    if (points.length === 0) return -999;

    let weightedTemp = 0;
    let totalWeight = 0;

    for (const point of points) {
        const distance = Math.sqrt(
            Math.pow(lat - point.lat, 2) + Math.pow(lng - point.lng, 2)
        );

        if (distance < 0.5) {
            return useFahrenheit ? point.tempF : point.temp;
        }

        const weight = 1 / Math.pow(distance, 2);
        const temp = useFahrenheit ? point.tempF : point.temp;
        weightedTemp += temp * weight;
        totalWeight += weight;
    }

    return totalWeight > 0 ? weightedTemp / totalWeight : -999;
}


export function interpolateWind(
    lat: number,
    lng: number,
    points: TemperaturePoint[]
): { u: number, v: number, speed: number } {
    if (points.length === 0) return { u: 0, v: 0, speed: 0 };

    let weightedU = 0;
    let weightedV = 0;
    let totalWeight = 0;

    for (const point of points) {
        const distance = Math.sqrt(
            Math.pow(lat - point.lat, 2) + Math.pow(lng - point.lng, 2)
        );

        if (distance < 0.1) {
            const rad = (point.windDirection + 180) * Math.PI / 180;
            const u = Math.sin(rad) * point.windSpeed;
            const v = Math.cos(rad) * point.windSpeed;
            return { u, v, speed: point.windSpeed };
        }

        const weight = 1 / Math.pow(distance, 2);

        const rad = (point.windDirection + 180) * Math.PI / 180;
        const u = Math.sin(rad) * point.windSpeed;
        const v = Math.cos(rad) * point.windSpeed;

        weightedU += u * weight;
        weightedV += v * weight;
        totalWeight += weight;
    }

    if (totalWeight > 0) {
        const finalU = weightedU / totalWeight;
        const finalV = weightedV / totalWeight;
        const speed = Math.sqrt(finalU * finalU + finalV * finalV);
        return { u: finalU, v: finalV, speed };
    }
    return { u: 0, v: 0, speed: 0 };
}



