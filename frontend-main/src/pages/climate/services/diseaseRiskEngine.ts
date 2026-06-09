import type {
    ClimateData,
    ClimateAnomaly,
    Hazard,
    DiseaseRisk,
    RiskLevel,
} from '@/pages/climate/types/climate';

const CHOLERA_THRESHOLDS = {
    RAINFALL_ANOMALY_HIGH: 2.0,
    RAINFALL_AVG_HIGH: 10,
    FLOOD_SEVERITY_MIN: 'MEDIUM',
    SOIL_MOISTURE_HIGH: 60,
};

const MALARIA_THRESHOLDS = {
    TEMP_MIN: 20,
    TEMP_OPTIMAL_LOW: 25,
    TEMP_OPTIMAL_HIGH: 30,
    TEMP_MAX: 35,
    RAINFALL_MIN: 5,
    SOIL_MOISTURE_MIN: 40,
};

const MENINGITIS_THRESHOLDS = {
    TEMP_HIGH: 30,
    TEMP_ANOMALY_HIGH: 2.0,
    WIND_SPEED_HIGH: 4,
    SOIL_MOISTURE_LOW: 35,
    HEATWAVE_SEVERITY_MIN: 'MEDIUM',
};

const MALNUTRITION_THRESHOLDS = {
    DROUGHT_DURATION_MIN: 30,
    SOIL_MOISTURE_PERCENTILE: 20,
    DROUGHT_SEVERITY_MIN: 'MEDIUM',
};

function calculateAverage(data: ClimateData[], variable: keyof ClimateData): number {
    const values = data
        .map((d) => d[variable])
        .filter((v) => typeof v === 'number' && !isNaN(v)) as number[];

    if (values.length === 0) return 0;
    return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function getAnomaly(anomalies: ClimateAnomaly[], variable: string): ClimateAnomaly | undefined {
    return anomalies.find((a) => a.variable === variable);
}

function findHazard(hazards: Hazard[], type: string): Hazard | undefined {
    return hazards.find((h) => h.type === type);
}

function calculateConfidence(factors: number[]): number {
    const avg = factors.reduce((sum, f) => sum + f, 0) / factors.length;
    return Math.max(0, Math.min(1, avg));
}

export function calculateCholeraRisk(
    data: ClimateData[],
    anomalies: ClimateAnomaly[],
    hazards: Hazard[]
): DiseaseRisk | null {
    const avgRainfall = calculateAverage(data, 'PRECTOTCORR');
    const avgSoilMoisture = calculateAverage(data, 'GWETROOT');

    const rainfallAnomaly = getAnomaly(anomalies, 'PRECTOTCORR');
    const floodHazard = findHazard(hazards, 'flood');

    let riskLevel: RiskLevel = 'LOW';
    let confidence = 0;
    const climateDrivers: string[] = [];
    const thresholdsUsed: Record<string, number> = {};

    if (
        floodHazard &&
        (floodHazard.severity === 'MEDIUM' || floodHazard.severity === 'HIGH')
    ) {
        riskLevel = 'HIGH';
        confidence = calculateConfidence([
            floodHazard.confidence,
            avgRainfall / 50,
            avgSoilMoisture / 100,
        ]);
        climateDrivers.push(`Active ${floodHazard.severity.toLowerCase()} flood`);
        climateDrivers.push(`Heavy rainfall (${avgRainfall.toFixed(1)} mm/day)`);
        thresholdsUsed.flood_severity = floodHazard.severity === 'HIGH' ? 3 : 2;
    }
    else if (
        rainfallAnomaly &&
        rainfallAnomaly.zScore >= CHOLERA_THRESHOLDS.RAINFALL_ANOMALY_HIGH * 1.5
    ) {
        riskLevel = 'HIGH';
        confidence = calculateConfidence([
            rainfallAnomaly.zScore / 3.0,
            avgRainfall / CHOLERA_THRESHOLDS.RAINFALL_AVG_HIGH,
        ]);
        climateDrivers.push(
            `Extreme rainfall anomaly (${rainfallAnomaly.zScore.toFixed(1)}σ above normal)`
        );
        thresholdsUsed.rainfall_z_score = rainfallAnomaly.zScore;
    }
    else if (
        avgRainfall >= CHOLERA_THRESHOLDS.RAINFALL_AVG_HIGH &&
        avgSoilMoisture >= CHOLERA_THRESHOLDS.SOIL_MOISTURE_HIGH
    ) {
        riskLevel = 'MEDIUM';
        confidence = calculateConfidence([
            avgRainfall / (CHOLERA_THRESHOLDS.RAINFALL_AVG_HIGH * 2),
            avgSoilMoisture / 100,
        ]);
        climateDrivers.push(`Heavy rainfall (${avgRainfall.toFixed(1)} mm/day)`);
        climateDrivers.push(`High soil moisture (${avgSoilMoisture.toFixed(0)}%)`);
        thresholdsUsed.rainfall_avg = avgRainfall;
        thresholdsUsed.soil_moisture = avgSoilMoisture;
    }
    else if (
        rainfallAnomaly &&
        rainfallAnomaly.zScore >= CHOLERA_THRESHOLDS.RAINFALL_ANOMALY_HIGH
    ) {
        riskLevel = 'LOW';
        confidence = calculateConfidence([rainfallAnomaly.zScore / 2.0]);
        climateDrivers.push(
            `Rainfall above normal (${rainfallAnomaly.zScore.toFixed(1)}σ)`
        );
        thresholdsUsed.rainfall_z_score = rainfallAnomaly.zScore;
    } else {
        return null;
    }

    return {
        disease: 'cholera',
        riskLevel,
        confidence,
        climateDrivers,
        thresholdsUsed,
        explanation: `Cholera/AWD risk elevated due to ${climateDrivers.join(' and ')}. Heavy rainfall and flooding can contaminate water sources, increasing waterborne disease transmission.`,
    };
}

export function calculateMalariaRisk(
    data: ClimateData[],
    anomalies: ClimateAnomaly[],
    hazards: Hazard[]
): DiseaseRisk | null {
    const avgTemp = calculateAverage(data, 'T2M');
    const avgRainfall = calculateAverage(data, 'PRECTOTCORR');
    const avgSoilMoisture = calculateAverage(data, 'GWETROOT');

    if (
        avgTemp < MALARIA_THRESHOLDS.TEMP_MIN ||
        avgTemp > MALARIA_THRESHOLDS.TEMP_MAX
    ) {
        return null;
    }

    let riskLevel: RiskLevel = 'LOW';
    let confidence = 0;
    const climateDrivers: string[] = [];
    const thresholdsUsed: Record<string, number> = {};

    const inOptimalTempRange =
        avgTemp >= MALARIA_THRESHOLDS.TEMP_OPTIMAL_LOW &&
        avgTemp <= MALARIA_THRESHOLDS.TEMP_OPTIMAL_HIGH;
    if (
        inOptimalTempRange &&
        avgRainfall >= MALARIA_THRESHOLDS.RAINFALL_MIN * 2 &&
        avgSoilMoisture >= MALARIA_THRESHOLDS.SOIL_MOISTURE_MIN * 1.5
    ) {
        riskLevel = 'HIGH';
        confidence = calculateConfidence([
            1 - Math.abs(avgTemp - 27) / 10,
            avgRainfall / (MALARIA_THRESHOLDS.RAINFALL_MIN * 3),
            avgSoilMoisture / 100,
        ]);
        climateDrivers.push(`Optimal temperature (${avgTemp.toFixed(1)}°C)`);
        climateDrivers.push(`High rainfall (${avgRainfall.toFixed(1)} mm/day)`);
        climateDrivers.push(`High soil moisture (${avgSoilMoisture.toFixed(0)}%)`);
    }
    else if (
        avgRainfall >= MALARIA_THRESHOLDS.RAINFALL_MIN &&
        avgSoilMoisture >= MALARIA_THRESHOLDS.SOIL_MOISTURE_MIN
    ) {
        riskLevel = 'MEDIUM';
        confidence = calculateConfidence([
            avgTemp >= MALARIA_THRESHOLDS.TEMP_OPTIMAL_LOW ? 0.8 : 0.6,
            avgRainfall / (MALARIA_THRESHOLDS.RAINFALL_MIN * 2),
        ]);
        climateDrivers.push(`Suitable temperature (${avgTemp.toFixed(1)}°C)`);
        climateDrivers.push(`Adequate rainfall (${avgRainfall.toFixed(1)} mm/day)`);
    }
    else if (avgRainfall >= MALARIA_THRESHOLDS.RAINFALL_MIN / 2) {
        riskLevel = 'LOW';
        confidence = calculateConfidence([
            avgTemp / MALARIA_THRESHOLDS.TEMP_OPTIMAL_HIGH,
            avgRainfall / MALARIA_THRESHOLDS.RAINFALL_MIN,
        ]);
        climateDrivers.push(`Moderate temperature (${avgTemp.toFixed(1)}°C)`);
        climateDrivers.push(`Some rainfall (${avgRainfall.toFixed(1)} mm/day)`);
    } else {
        return null;
    }

    thresholdsUsed.temperature = avgTemp;
    thresholdsUsed.rainfall = avgRainfall;
    thresholdsUsed.soil_moisture = avgSoilMoisture;

    return {
        disease: 'malaria',
        riskLevel,
        confidence,
        climateDrivers,
        thresholdsUsed,
        explanation: `Malaria risk elevated due to ${climateDrivers.join(' and ')}. Warm, wet conditions favor Anopheles mosquito breeding and transmission.`,
    };
}

export function calculateMeningitisRisk(
    data: ClimateData[],
    anomalies: ClimateAnomaly[],
    hazards: Hazard[]
): DiseaseRisk | null {
    const avgTemp = calculateAverage(data, 'T2M_MAX');
    const avgWindSpeed = calculateAverage(data, 'WS2M');
    const avgSoilMoisture = calculateAverage(data, 'GWETROOT');

    const tempAnomaly = getAnomaly(anomalies, 'T2M_MAX');
    const heatwaveHazard = findHazard(hazards, 'heatwave');

    let riskLevel: RiskLevel = 'LOW';
    let confidence = 0;
    const climateDrivers: string[] = [];
    const thresholdsUsed: Record<string, number> = {};

    if (
        heatwaveHazard &&
        (heatwaveHazard.severity === 'MEDIUM' || heatwaveHazard.severity === 'HIGH') &&
        avgSoilMoisture <= MENINGITIS_THRESHOLDS.SOIL_MOISTURE_LOW
    ) {
        riskLevel = 'HIGH';
        confidence = calculateConfidence([
            heatwaveHazard.confidence,
            1 - avgSoilMoisture / 100,
            avgWindSpeed ? avgWindSpeed / 10 : 0.5,
        ]);
        climateDrivers.push(`Active ${heatwaveHazard.severity.toLowerCase()} heatwave`);
        climateDrivers.push(`Dry conditions (${avgSoilMoisture.toFixed(0)}% moisture)`);
        if (avgWindSpeed >= MENINGITIS_THRESHOLDS.WIND_SPEED_HIGH) {
            climateDrivers.push(`Dusty conditions (wind ${avgWindSpeed.toFixed(1)} m/s)`);
        }
    }
    else if (
        tempAnomaly &&
        tempAnomaly.zScore >= MENINGITIS_THRESHOLDS.TEMP_ANOMALY_HIGH &&
        avgTemp >= MENINGITIS_THRESHOLDS.TEMP_HIGH
    ) {
        riskLevel = 'MEDIUM';
        confidence = calculateConfidence([
            tempAnomaly.zScore / 3.0,
            avgTemp / 40,
            1 - avgSoilMoisture / MENINGITIS_THRESHOLDS.SOIL_MOISTURE_LOW,
        ]);
        climateDrivers.push(
            `Extreme heat (${avgTemp.toFixed(1)}°C, ${tempAnomaly.zScore.toFixed(1)}σ above normal)`
        );
    }
    else if (avgTemp >= MENINGITIS_THRESHOLDS.TEMP_HIGH) {
        riskLevel = 'LOW';
        confidence = calculateConfidence([avgTemp / 40]);
        climateDrivers.push(`High temperature (${avgTemp.toFixed(1)}°C)`);
    } else {
        return null;
    }

    thresholdsUsed.temperature = avgTemp;
    thresholdsUsed.soil_moisture = avgSoilMoisture;
    if (avgWindSpeed) thresholdsUsed.wind_speed = avgWindSpeed;

    return {
        disease: 'meningitis',
        riskLevel,
        confidence,
        climateDrivers,
        thresholdsUsed,
        explanation: `Meningitis risk elevated due to ${climateDrivers.join(' and ')}. Hot, dry, dusty conditions damage respiratory mucosa and facilitate bacterial transmission (meningitis belt phenomenon).`,
    };
}

export function calculateMalnutritionRisk(
    data: ClimateData[],
    anomalies: ClimateAnomaly[],
    hazards: Hazard[]
): DiseaseRisk | null {
    const avgSoilMoisture = calculateAverage(data, 'GWETROOT');
    const soilMoistureAnomaly = getAnomaly(anomalies, 'GWETROOT');
    const droughtHazard = findHazard(hazards, 'drought');

    const durationDays = data.length;

    let riskLevel: RiskLevel = 'LOW';
    let confidence = 0;
    const climateDrivers: string[] = [];
    const thresholdsUsed: Record<string, number> = {};

    if (
        droughtHazard &&
        droughtHazard.severity === 'HIGH' &&
        durationDays >= MALNUTRITION_THRESHOLDS.DROUGHT_DURATION_MIN
    ) {
        riskLevel = 'HIGH';
        confidence = calculateConfidence([
            droughtHazard.confidence,
            durationDays / 60,
            1 - avgSoilMoisture / 50,
        ]);
        climateDrivers.push(`Severe drought (${durationDays} days)`);
        climateDrivers.push(`Very low soil moisture (${avgSoilMoisture.toFixed(0)}%)`);
    }
    else if (
        droughtHazard &&
        (droughtHazard.severity === 'MEDIUM' ||
            durationDays >= MALNUTRITION_THRESHOLDS.DROUGHT_DURATION_MIN * 1.5)
    ) {
        riskLevel = 'MEDIUM';
        confidence = calculateConfidence([
            droughtHazard.confidence,
            durationDays / 45,
        ]);
        climateDrivers.push(`Prolonged drought (${durationDays} days)`);
    }
    else if (
        soilMoistureAnomaly &&
        soilMoistureAnomaly.percentile <= MALNUTRITION_THRESHOLDS.SOIL_MOISTURE_PERCENTILE
    ) {
        riskLevel = 'LOW';
        confidence = calculateConfidence([
            1 - soilMoistureAnomaly.percentile / 50,
        ]);
        climateDrivers.push(
            `Low soil moisture (${soilMoistureAnomaly.percentile}th percentile)`
        );
    } else {
        return null;
    }

    thresholdsUsed.soil_moisture = avgSoilMoisture;
    thresholdsUsed.drought_duration_days = durationDays;

    return {
        disease: 'malnutrition',
        riskLevel,
        confidence,
        climateDrivers,
        thresholdsUsed,
        explanation: `Malnutrition risk elevated due to ${climateDrivers.join(' and ')}. Prolonged drought leads to crop failure, reduced food availability, and increased food insecurity.`,
    };
}

export function assessAllDiseaseRisks(
    data: ClimateData[],
    anomalies: ClimateAnomaly[],
    hazards: Hazard[]
): DiseaseRisk[] {
    const risks: DiseaseRisk[] = [];

    const choleraRisk = calculateCholeraRisk(data, anomalies, hazards);
    if (choleraRisk) risks.push(choleraRisk);

    const malariaRisk = calculateMalariaRisk(data, anomalies, hazards);
    if (malariaRisk) risks.push(malariaRisk);

    const meningitisRisk = calculateMeningitisRisk(data, anomalies, hazards);
    if (meningitisRisk) risks.push(meningitisRisk);

    const malnutritionRisk = calculateMalnutritionRisk(data, anomalies, hazards);
    if (malnutritionRisk) risks.push(malnutritionRisk);

    return risks;
}
