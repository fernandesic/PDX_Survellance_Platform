// @ts-nocheck
import { RiskPrepData, OutbreakData, PiScore, ForecastPoint, RiskPillar, Hazard } from './types';
import { INDEX_WEIGHTS } from './constants';
import { HAZARDS } from './estimatorDatabase';

type CombinedData = RiskPrepData & { [key in Hazard]?: number };

const scalers: { [key: string]: { min: number; max: number } } = {};

const normalize = (data: number[], key: string, invert: boolean = false): number[] => {
    const minVal = Math.min(...data);
    const maxVal = Math.max(...data);
    scalers[key] = { min: minVal, max: maxVal };
    if (maxVal - minVal === 0) return data.map(() => 0.5);

    const normalized = data.map(val => (val - minVal) / (maxVal - minVal));
    return invert ? normalized.map(val => 1 - val) : normalized;
};

/**
 * Simulates a complex Multi-Criteria Decision Making (MCDM) model like Neutrosophic AHP+TOPSIS + Grey Theory.
 * It adjusts the raw PI score based on data quality/uncertainty indicators to produce a final Priority Score.
 * @param scores - The array of raw PI scores for a given date.
 * @returns An array of scores with an added `priorityScore` field.
 */
const applyMcdmPrioritization = (scores: Omit<PiScore, 'priorityScore'>[]): PiScore[] => {
    return scores.map(score => {
        // Find the highest raw PI score across all hazards for this country
        const maxPi = Math.max(...Object.values(score.pi_scores).filter(v => v !== undefined) as number[]);

        // Simulate "Grey Theory" by creating a data uncertainty factor.
        // Here, we use preparedness as a proxy: lower preparedness implies higher data uncertainty.
        const uncertaintyFactor = 1 + (1 - score.preparedness_norm) * 0.1; // Max 10% penalty for poor readiness data

        // Simulate AHP/TOPSIS by applying a non-linear weight to the max PI score.
        // This amplifies the separation between high-risk and medium-risk countries.
        const prioritizedPi = Math.pow(maxPi, 1.2);

        // Final Priority Score combines the prioritized PI with the uncertainty penalty.
        const priorityScore = prioritizedPi * uncertaintyFactor;
        
        return { ...score, priorityScore };
    });
};


export const calculatePiScores = (riskPrepData: RiskPrepData[], outbreakData: OutbreakData[]): PiScore[] => {
    const outbreakPivot = new Map<string, { [key in Hazard]?: number }>();
    outbreakData.forEach(d => {
        const key = `${d.country_iso}_${d.date.toISOString()}`;
        const existing = outbreakPivot.get(key) || {};
        const hazardKey = d.disease.toLowerCase() as Hazard;
        if (HAZARDS.includes(hazardKey)) {
          existing[hazardKey] = d.cases;
        }
        outbreakPivot.set(key, existing);
    });

    const combinedData: CombinedData[] = riskPrepData.map(d => {
        const key = `${d.country_iso}_${d.date.toISOString()}`;
        const outbreaks = outbreakPivot.get(key) || {};
        return { ...d, ...outbreaks };
    });

    // Normalize base indicators
    const risk_norm_vals = normalize(combinedData.map(d => d.inform_risk), 'inform_risk');
    const vulnerability_norm_vals = normalize(combinedData.map(d => d.inform_vulnerability), 'inform_vulnerability');
    const preparedness_norm_vals = normalize(combinedData.map(d => d.ghs_preparedness), 'ghs_preparedness', true);

    // Normalize outbreak data for each hazard
    const outbreak_norm_vals: { [key in Hazard]?: number[] } = {};
    HAZARDS.forEach(hazard => {
        outbreak_norm_vals[hazard] = normalize(combinedData.map(d => d[hazard] || 0), hazard);
    });

    // Calculate raw PI scores for each date
    const dates = [...new Set(riskPrepData.map(d => d.date.toISOString()))];
    const allScores: PiScore[] = [];

    dates.forEach(dateStr => {
        const date = new Date(dateStr);
        const dateScores: Omit<PiScore, 'priorityScore'>[] = [];
        const dateIndices = combinedData.map((d, i) => d.date.getTime() === date.getTime() ? i : -1).filter(i => i !== -1);
        
        dateIndices.forEach(i => {
            const d = combinedData[i];
            const baseScores = {
                risk_norm: risk_norm_vals[i],
                preparedness_norm: preparedness_norm_vals[i],
                vulnerability_norm: vulnerability_norm_vals[i],
            };
            
            const pi_scores: { [key in Hazard]?: number } = {};
            const outbreak_norms: { [key in Hazard]?: number } = {};

            HAZARDS.forEach(hazard => {
                const outbreak_norm = outbreak_norm_vals[hazard]?.[i] ?? 0;
                pi_scores[hazard] =
                    INDEX_WEIGHTS.risk * baseScores.risk_norm +
                    INDEX_WEIGHTS.preparedness * baseScores.preparedness_norm +
                    INDEX_WEIGHTS.vulnerability * baseScores.vulnerability_norm +
                    INDEX_WEIGHTS.outbreak * outbreak_norm;
                outbreak_norms[hazard] = outbreak_norm;
            });
            
            dateScores.push({
                country_iso: d.country_iso,
                date: d.date,
                pi_scores,
                outbreak_norms,
                ...baseScores,
            });
        });
        
        // Normalize PI scores for each hazard across countries for the current date
        HAZARDS.forEach(hazard => {
            const hazardScores = dateScores.map(s => s.pi_scores[hazard] || 0);
            const normalizedHazardScores = normalize(hazardScores, `pi_${hazard}_${dateStr}`);
            dateScores.forEach((s, i) => {
                if(s.pi_scores[hazard] !== undefined) {
                    s.pi_scores[hazard] = normalizedHazardScores[i];
                }
            });
        });
        
        // Apply MCDM model to get final priority score for this date
        const prioritizedDateScores = applyMcdmPrioritization(dateScores);
        allScores.push(...prioritizedDateScores);
    });

    return allScores;
};

export const forecastPi = (historicalPi: number[], lastDate: Date, horizonMonths: number = 6): ForecastPoint[] => {
    if (historicalPi.length < 2) return [];

    const x = historicalPi.map((_, i) => i);
    const y = historicalPi;

    const n = x.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    const predictions = x.map(xi => slope * xi + intercept);
    const residuals = y.map((yi, i) => yi - predictions[i]);
    
    const stdErrDenominator = n - 2;
    const stdErr = stdErrDenominator > 0
        ? Math.sqrt(residuals.reduce((sum, r) => sum + r * r, 0) / stdErrDenominator)
        : 0;

    const forecast: ForecastPoint[] = [];
    
    for (let i = 1; i <= horizonMonths; i++) {
        const futureX = n + i - 1;
        const predY = slope * futureX + intercept;
        const marginOfError = 1.96 * stdErr;

        forecast.push({
            date: new Date(lastDate.getFullYear(), lastDate.getMonth() + i, 1),
            forecast: Math.max(0, Math.min(1, predY)),
            lower_ci: Math.max(0, Math.min(1, predY - marginOfError)),
            upper_ci: Math.max(0, Math.min(1, predY + marginOfError)),
        });
    }

    return forecast;
};

export const calculatePillarScores = (score: PiScore, hazard: Hazard): RiskPillar[] => {
    const outbreak_norm = score.outbreak_norms[hazard] || 0;
    const pillars: RiskPillar[] = [
        { name: 'Collaborative Surveillance', value: outbreak_norm, color: 'bg-red-500' },
        { name: 'Community Vulnerability', value: score.vulnerability_norm, color: 'bg-orange-500' },
        { name: 'System Capacity & Readiness', value: score.preparedness_norm, color: 'bg-yellow-500' },
        { name: 'Logistical & Geographic Risk', value: score.risk_norm, color: 'bg-purple-500' },
    ];
    return pillars.sort((a,b) => b.value - a.value);
};
