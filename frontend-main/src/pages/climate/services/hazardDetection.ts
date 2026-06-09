import type {
    ClimateData,
    ClimateAnomaly,
    Hazard,
    SeverityLevel,
} from '@/pages/climate/types/climate';

const FLOOD_THRESHOLDS = {
    PRECIP_HIGH: 8,
    PRECIP_EXTREME: 25,
    SOIL_MOISTURE_HIGH: 60,
    Z_SCORE_THRESHOLD: 1.8,
};

const DROUGHT_THRESHOLDS = {
    SOIL_MOISTURE_LOW: 30,
    SOIL_MOISTURE_EXTREME: 20,
    PRECIP_LOW_PERCENTILE: 25,
    DURATION_DAYS: 14,
};

const HEATWAVE_THRESHOLDS = {
    TEMP_HIGH: 35,
    TEMP_EXTREME: 40,
    Z_SCORE_THRESHOLD: 2.2,
    DURATION_DAYS: 3,
};

const FIRE_THRESHOLDS = {
    TEMP_MIN: 30,
    SOIL_MOISTURE_MAX: 35,
    COMBINED_RISK_THRESHOLD: 0.6,
};

const WIND_THRESHOLDS = {
    HIGH: 20,
    EXTREME: 35,
};

const STORM_THRESHOLDS = {
    WIND_MIN: 15,
    PRECIP_MIN: 10,
    COMBINED_INDEX: 0.7,
};

function calculateAverage(data: ClimateData[], variable: keyof ClimateData): number {
    const values = data
        .map((d) => d[variable])
        .filter((v) => typeof v === 'number' && !isNaN(v)) as number[];

    if (values.length === 0) return 0;
    return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function calculateMax(data: ClimateData[], variable: keyof ClimateData): number {
    const values = data
        .map((d) => d[variable])
        .filter((v) => typeof v === 'number' && !isNaN(v)) as number[];

    return values.length > 0 ? Math.max(...values) : 0;
}

function countConsecutiveDaysAbove(data: ClimateData[], variable: keyof ClimateData, threshold: number): number {
    let maxConsecutive = 0;
    let currentConsecutive = 0;

    for (const d of data) {
        const value = d[variable] as number;
        if (value && value > threshold) {
            currentConsecutive++;
            maxConsecutive = Math.max(maxConsecutive, currentConsecutive);
        } else {
            currentConsecutive = 0;
        }
    }

    return maxConsecutive;
}

function calculateConfidence(factors: number[]): number {
    const avg = factors.reduce((sum, f) => sum + f, 0) / factors.length;
    return Math.max(0, Math.min(1, avg));
}

export function detectFloods(
    data: ClimateData[],
    anomalies: ClimateAnomaly[],
    isOfficialAlert?: boolean
): Hazard | null {
    const avgPrecip = calculateAverage(data, 'PRECTOTCORR');
    const maxPrecip = calculateMax(data, 'PRECTOTCORR');
    const avgSoilMoisture = calculateAverage(data, 'GWETROOT');

    const precipAnomaly = anomalies.find((a) => a.variable === 'PRECTOTCORR');
    const precipZScore = precipAnomaly?.zScore ?? 0;

    let severity: SeverityLevel = 'LOW';
    let confidence = 0;

    const indicators: ClimateAnomaly[] = [];

    const heavyWeatherCodes = [65, 82, 95, 96, 99];
    const hasHeavyWeatherCode = data.some(d => d.weatherCode && heavyWeatherCodes.includes(d.weatherCode));

    if (maxPrecip >= FLOOD_THRESHOLDS.PRECIP_EXTREME && precipZScore >= FLOOD_THRESHOLDS.Z_SCORE_THRESHOLD) {
        severity = 'HIGH';
        confidence = calculateConfidence([
            maxPrecip / FLOOD_THRESHOLDS.PRECIP_EXTREME,
            avgSoilMoisture / 100,
            (precipZScore >= 0 ? precipZScore : 0) / 4.0,
        ]);
    }
    else if (hasHeavyWeatherCode) {
        severity = 'MEDIUM';
        confidence = 0.85;
    }
    else if (
        avgPrecip >= FLOOD_THRESHOLDS.PRECIP_HIGH &&
        avgSoilMoisture >= FLOOD_THRESHOLDS.SOIL_MOISTURE_HIGH
    ) {
        severity = 'MEDIUM';
        confidence = calculateConfidence([
            avgPrecip / FLOOD_THRESHOLDS.PRECIP_HIGH,
            avgSoilMoisture / 100,
            (precipZScore >= 0 ? precipZScore : 0) / 3.0,
        ]);
    }
    else if (avgPrecip >= FLOOD_THRESHOLDS.PRECIP_HIGH / 2) {
        severity = 'LOW';
        confidence = calculateConfidence([
            avgPrecip / FLOOD_THRESHOLDS.PRECIP_HIGH,
            avgSoilMoisture / 100,
            (precipZScore >= 0 ? precipZScore : 0) / 2.0,
        ]);
    } else if (isOfficialAlert) {
        severity = 'MEDIUM';
        confidence = 0.9;
    } else {
        return null;
    }

    if (precipAnomaly) indicators.push(precipAnomaly);

    return {
        type: 'flood',
        severity,
        confidence,
        startDate: data[0]?.date ?? '',
        endDate: data[data.length - 1]?.date ?? '',
        indicators,
        description: `Heavy rainfall detected (avg: ${avgPrecip.toFixed(1)} mm/day, max: ${maxPrecip.toFixed(1)} mm/day). Soil moisture: ${avgSoilMoisture.toFixed(0)}%.`,
    };
}

export function detectDrought(
    data: ClimateData[],
    anomalies: ClimateAnomaly[]
): Hazard | null {
    const avgSoilMoisture = calculateAverage(data, 'GWETROOT');
    const avgPrecip = calculateAverage(data, 'PRECTOTCORR');

    const soilAnomaly = anomalies.find((a) => a.variable === 'GWETROOT');
    const precipAnomaly = anomalies.find((a) => a.variable === 'PRECTOTCORR');

    if (data.length < DROUGHT_THRESHOLDS.DURATION_DAYS) {
        return null;
    }

    let severity: SeverityLevel = 'LOW';
    let confidence = 0;

    const indicators: ClimateAnomaly[] = [];

    if (avgSoilMoisture <= DROUGHT_THRESHOLDS.SOIL_MOISTURE_EXTREME) {
        severity = 'HIGH';
        confidence = calculateConfidence([
            1 - avgSoilMoisture / DROUGHT_THRESHOLDS.SOIL_MOISTURE_LOW,
            precipAnomaly && precipAnomaly.percentile < 25 ? 0.8 : 0.5,
        ]);
    }
    else if (
        avgSoilMoisture <= DROUGHT_THRESHOLDS.SOIL_MOISTURE_LOW &&
        precipAnomaly &&
        precipAnomaly.percentile <= DROUGHT_THRESHOLDS.PRECIP_LOW_PERCENTILE
    ) {
        severity = 'MEDIUM';
        confidence = calculateConfidence([
            1 - avgSoilMoisture / DROUGHT_THRESHOLDS.SOIL_MOISTURE_LOW,
            1 - precipAnomaly.percentile / 50,
        ]);
    }
    else if (avgSoilMoisture <= DROUGHT_THRESHOLDS.SOIL_MOISTURE_LOW) {
        severity = 'LOW';
        confidence = calculateConfidence([1 - avgSoilMoisture / DROUGHT_THRESHOLDS.SOIL_MOISTURE_LOW]);
    } else {
        return null;
    }

    if (soilAnomaly) indicators.push(soilAnomaly);
    if (precipAnomaly) indicators.push(precipAnomaly);

    return {
        type: 'drought',
        severity,
        confidence,
        startDate: data[0]?.date ?? '',
        endDate: data[data.length - 1]?.date ?? '',
        indicators,
        description: `Low soil moisture detected (${avgSoilMoisture.toFixed(0)}%). Precipitation: ${avgPrecip.toFixed(1)} mm/day.`,
    };
}

export function detectHeatwave(
    data: ClimateData[],
    anomalies: ClimateAnomaly[]
): Hazard | null {
    const avgTempMax = calculateAverage(data, 'T2M_MAX');
    const maxTemp = calculateMax(data, 'T2M_MAX');
    const consecutiveHotDays = countConsecutiveDaysAbove(data, 'T2M_MAX', HEATWAVE_THRESHOLDS.TEMP_HIGH);

    const tempAnomaly = anomalies.find((a) => a.variable === 'T2M_MAX');
    const tempZScore = tempAnomaly?.zScore ?? 0;

    let severity: SeverityLevel = 'LOW';
    let confidence = 0;

    const indicators: ClimateAnomaly[] = [];

    if (
        maxTemp >= HEATWAVE_THRESHOLDS.TEMP_EXTREME &&
        tempZScore >= HEATWAVE_THRESHOLDS.Z_SCORE_THRESHOLD &&
        consecutiveHotDays >= HEATWAVE_THRESHOLDS.DURATION_DAYS
    ) {
        severity = 'HIGH';
        confidence = calculateConfidence([
            maxTemp / HEATWAVE_THRESHOLDS.TEMP_EXTREME,
            consecutiveHotDays / 7,
            (tempZScore >= 0 ? tempZScore : 0) / 4.0,
        ]);
    }
    else if (
        tempZScore >= HEATWAVE_THRESHOLDS.Z_SCORE_THRESHOLD &&
        consecutiveHotDays >= HEATWAVE_THRESHOLDS.DURATION_DAYS
    ) {
        severity = 'MEDIUM';
        confidence = calculateConfidence([
            avgTempMax / HEATWAVE_THRESHOLDS.TEMP_HIGH,
            (tempZScore >= 0 ? tempZScore : 0) / 2.0,
        ]);
    }
    else if (avgTempMax >= HEATWAVE_THRESHOLDS.TEMP_HIGH) {
        severity = 'LOW';
        confidence = calculateConfidence([avgTempMax / HEATWAVE_THRESHOLDS.TEMP_HIGH]);
    } else {
        return null;
    }

    if (tempAnomaly) indicators.push(tempAnomaly);

    return {
        type: 'heatwave',
        severity,
        confidence,
        startDate: data[0]?.date ?? '',
        endDate: data[data.length - 1]?.date ?? '',
        indicators,
        description: `Extreme heat detected (max: ${maxTemp.toFixed(1)}°C, avg max: ${avgTempMax.toFixed(1)}°C). ${consecutiveHotDays} consecutive hot days.`,
    };
}

export function detectFireRisk(
    data: ClimateData[],
    anomalies: ClimateAnomaly[],
    firmsFireCount?: number
): Hazard | null {
    const avgTemp = calculateAverage(data, 'T2M');
    const avgSoilMoisture = calculateAverage(data, 'GWETROOT');

    const fireIndex =
        (avgTemp / FIRE_THRESHOLDS.TEMP_MIN) * (1 - avgSoilMoisture / 100);

    let severity: SeverityLevel = 'LOW';
    let confidence = 0;

    const indicators: ClimateAnomaly[] = [];
    const tempAnomaly = anomalies.find((a) => a.variable === 'T2M');
    const soilAnomaly = anomalies.find((a) => a.variable === 'GWETROOT');

    if (firmsFireCount !== undefined && firmsFireCount > 0) {
        if (firmsFireCount >= 10) {
            severity = 'HIGH';
            confidence = 0.95;
        } else if (firmsFireCount >= 5) {
            severity = 'MEDIUM';
            confidence = 0.85;
        } else {
            severity = 'LOW';
            confidence = 0.75;
        }

        if (tempAnomaly) indicators.push(tempAnomaly);
        if (soilAnomaly) indicators.push(soilAnomaly);

        return {
            type: 'fire',
            severity,
            confidence,
            startDate: data[0]?.date ?? '',
            endDate: data[data.length - 1]?.date ?? '',
            indicators,
            description: `${firmsFireCount} active fire point${firmsFireCount > 1 ? 's' : ''} detected. Temperature: ${avgTemp.toFixed(1)}°C, Soil moisture: ${avgSoilMoisture.toFixed(0)}%.`,
        };
    }

    if (
        avgTemp >= FIRE_THRESHOLDS.TEMP_MIN &&
        avgSoilMoisture <= FIRE_THRESHOLDS.SOIL_MOISTURE_MAX &&
        fireIndex >= FIRE_THRESHOLDS.COMBINED_RISK_THRESHOLD * 1.5
    ) {
        severity = 'HIGH';
        confidence = calculateConfidence([
            avgTemp / 40,
            1 - avgSoilMoisture / 100,
            fireIndex,
        ]);
    }
    else if (fireIndex >= FIRE_THRESHOLDS.COMBINED_RISK_THRESHOLD) {
        severity = 'MEDIUM';
        confidence = calculateConfidence([fireIndex]);
    }
    else if (
        avgTemp >= FIRE_THRESHOLDS.TEMP_MIN * 0.9 &&
        avgSoilMoisture <= FIRE_THRESHOLDS.SOIL_MOISTURE_MAX * 1.2
    ) {
        severity = 'LOW';
        confidence = calculateConfidence([avgTemp / FIRE_THRESHOLDS.TEMP_MIN, 1 - avgSoilMoisture / 100]);
    } else {
        return null;
    }

    if (tempAnomaly) indicators.push(tempAnomaly);
    if (soilAnomaly) indicators.push(soilAnomaly);

    return {
        type: 'fire',
        severity,
        confidence,
        startDate: data[0]?.date ?? '',
        endDate: data[data.length - 1]?.date ?? '',
        indicators,
        description: `Fire risk conditions detected. Temperature: ${avgTemp.toFixed(1)}°C, Soil moisture: ${avgSoilMoisture.toFixed(0)}%. Fire index: ${fireIndex.toFixed(2)}.`,
    };
}

export function detectWindHazard(
    data: ClimateData[],
    anomalies: ClimateAnomaly[]
): Hazard | null {
    const avgWind = calculateAverage(data, 'WS2M');
    const maxWind = calculateMax(data, 'WS2M');

    let severity: SeverityLevel = 'LOW';
    let confidence = 0;

    const windAnomaly = anomalies.find((a) => a.variable === 'WS2M');

    if (maxWind >= WIND_THRESHOLDS.EXTREME) {
        severity = 'HIGH';
        confidence = calculateConfidence([maxWind / WIND_THRESHOLDS.EXTREME, 0.9]);
    } else if (maxWind >= WIND_THRESHOLDS.HIGH) {
        severity = 'MEDIUM';
        confidence = calculateConfidence([maxWind / WIND_THRESHOLDS.HIGH, 0.8]);
    } else if (avgWind >= WIND_THRESHOLDS.HIGH / 2) {
        severity = 'LOW';
        confidence = calculateConfidence([avgWind / (WIND_THRESHOLDS.HIGH / 2)]);
    } else {
        return null;
    }

    const indicators: ClimateAnomaly[] = [];
    if (windAnomaly) indicators.push(windAnomaly);

    return {
        type: 'wind',
        severity,
        confidence,
        startDate: data[0]?.date ?? '',
        endDate: data[data.length - 1]?.date ?? '',
        indicators,
        description: `Extreme Wind Speed detected (max: ${maxWind.toFixed(1)} m/s). Sustained high wind conditions active in the region.`,
    };
}

export function detectStormHazard(
    data: ClimateData[],
    anomalies: ClimateAnomaly[]
): Hazard | null {
    const avgWind = calculateAverage(data, 'WS2M');
    const maxPrecip = calculateMax(data, 'PRECTOTCORR');
    const avgClouds = calculateAverage(data, 'clouds');
    const avgPressure = calculateAverage(data, 'pressure');

    const stormCodes = [80, 81, 82, 95, 96, 99];
    const hasStormCode = data.some(d => d.weatherCode && stormCodes.includes(d.weatherCode));

    let severity: SeverityLevel = 'LOW';
    let confidence = 0;

    const stormRisk = (avgWind / STORM_THRESHOLDS.WIND_MIN) * (maxPrecip / STORM_THRESHOLDS.PRECIP_MIN);

    if (hasStormCode && avgWind >= STORM_THRESHOLDS.WIND_MIN) {
        severity = 'HIGH';
        confidence = 0.9;
    } else if (stormRisk >= STORM_THRESHOLDS.COMBINED_INDEX * 1.5) {
        severity = 'HIGH';
        confidence = calculateConfidence([stormRisk / 2]);
    } else if (stormRisk >= STORM_THRESHOLDS.COMBINED_INDEX) {
        severity = 'MEDIUM';
        confidence = calculateConfidence([stormRisk]);
    } else if (hasStormCode || avgClouds > 80) {
        severity = 'LOW';
        confidence = 0.7;
    } else {
        return null;
    }

    const indicators: ClimateAnomaly[] = [];
    const windAnomaly = anomalies.find((a) => a.variable === 'WS2M');
    const precipAnomaly = anomalies.find((a) => a.variable === 'PRECTOTCORR');
    const cloudAnomaly = anomalies.find((a) => a.variable === 'clouds');
    const pressureAnomaly = anomalies.find((a) => a.variable === 'pressure');

    if (windAnomaly) indicators.push(windAnomaly);
    if (precipAnomaly) indicators.push(precipAnomaly);
    if (cloudAnomaly) indicators.push(cloudAnomaly);
    if (pressureAnomaly) indicators.push(pressureAnomaly);

    return {
        type: 'storm',
        severity,
        confidence,
        startDate: data[0]?.date ?? '',
        endDate: data[data.length - 1]?.date ?? '',
        indicators,
        description: `Severe Storm conditions. Cloud Cover: ${avgClouds.toFixed(0)}%, Surface Pressure: ${avgPressure.toFixed(0)} hPa, Wind Speed: ${avgWind.toFixed(1)} m/s.`,
    };
}

export function detectAllHazards(
    data: ClimateData[],
    anomalies: ClimateAnomaly[],
    isOfficialAlert?: boolean
): Hazard[] {
    const hazards: Hazard[] = [];

    const flood = detectFloods(data, anomalies, isOfficialAlert);
    if (flood) hazards.push(flood);

    const drought = detectDrought(data, anomalies);
    if (drought) hazards.push(drought);

    const heatwave = detectHeatwave(data, anomalies);
    if (heatwave) hazards.push(heatwave);

    const fireRisk = detectFireRisk(data, anomalies);
    if (fireRisk) hazards.push(fireRisk);

    const wind = detectWindHazard(data, anomalies);
    if (wind) hazards.push(wind);

    const storm = detectStormHazard(data, anomalies);
    if (storm) hazards.push(storm);

    return hazards;
}
