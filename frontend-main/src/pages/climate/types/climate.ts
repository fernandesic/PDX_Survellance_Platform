export interface ClimateData {
    region: string;
    date: string;
    T2M: number;
    T2M_MAX: number;
    PRECTOTCORR: number;
    GWETROOT: number;
    WS2M?: number;
    WD10M?: number;
    RH2M?: number;
    weatherCode?: number;
    clouds?: number;
    pressure?: number;
}

export interface AnnualClimateData {
    year: string;
    T2M: number;
    PRECTOT: number;
    isEstimate?: boolean;
}

export interface ClimateBaseline {
    variable: string;
    mean: number;
    stdDev: number;
    percentiles: {
        p10: number;
        p25: number;
        p50: number;
        p75: number;
        p90: number;
    };
}

export interface ClimateAnomaly {
    variable: string;
    value: number;
    zScore: number;
    percentile: number;
    anomalyMagnitude: number;
}
export type HazardType = 'flood' | 'drought' | 'heatwave' | 'cold' | 'fire' | 'wind' | 'storm';
export type SeverityLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface Hazard {
    type: HazardType;
    severity: SeverityLevel;
    confidence: number;
    startDate: string;
    endDate: string;
    indicators: ClimateAnomaly[];
    description: string;
}

export type DiseaseType = 'cholera' | 'malaria' | 'meningitis' | 'malnutrition';
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface DiseaseRisk {
    disease: DiseaseType;
    riskLevel: RiskLevel;
    confidence: number;
    climateDrivers: string[];
    explanation: string;
    thresholdsUsed: Record<string, number>;
}

export type AdminLevel = 'country' | 'admin1';

export interface Region {
    id: string;
    name: string;
    adminLevel: AdminLevel;
    countryCode: string;
    admin1Code?: string;
    centroid: {
        lat: number;
        lng: number;
    };
    population?: number;
}

export interface RegionClimateProfile {
    region: Region;
    timeWindow: {
        start: string;
        end: string;
    };
    currentData: ClimateData[];
    anomalies: ClimateAnomaly[];
    activeHazards: Hazard[];
    diseaseRisks: DiseaseRisk[];
    convergingEvidence: {
        hasMediaSignal: boolean;
        hasOfficialAlert: boolean;
        pdxLinks: string[];
    };
    exposureMetrics?: {
        populationExposed: number;
        exposureLevel: 'LOW' | 'MEDIUM' | 'HIGH';
        healthFacilitiesInZone: number;
    };
    historicalAnnualData?: AnnualClimateData[];
}

export type LayerType = 'hazard' | 'anomaly' | 'exposure' | 'health-risk' | 'temperature' | 'wind' | 'flood' | 'precipitation' | 'cyclone';
export interface MapLayer {
    id: LayerType;
    name: string;
    enabled: boolean;
    opacity: number;
    zIndex: number;
}

export interface ChoroplethData {
    regionId: string;
    value: number;
    label: string;
    color: string;
    metadata?: any;
}

export type TimeWindowPreset = 'today' | '7days' | '14days' | '30days' | '90days';

export interface TimeWindow {
    preset: TimeWindowPreset;
    startDate: string;
    endDate: string;
    label: string;
}

export type PriorityLevel = 'P1' | 'P2' | 'P3' | 'P4';
export type HazardTypeFilter = 'flood' | 'drought' | 'heatwave' | 'fire' | 'wind' | 'storm';
export type DiseaseTypeFilter = 'cholera' | 'malaria' | 'meningitis' | 'malnutrition';

export interface ClimateFilters {
    countries: string[];
    admin1: string[];
    hazardTypes: HazardTypeFilter[];
    diseaseTypes: DiseaseTypeFilter[];
    priorities: PriorityLevel[];
    confidenceThreshold: number;
}

export const DEFAULT_FILTERS: ClimateFilters = {
    countries: [],
    admin1: [],
    hazardTypes: [],
    diseaseTypes: [],
    priorities: [],
    confidenceThreshold: 0
};


export interface NASAPowerResponse {
    type: string;
    geometry: {
        type: string;
        coordinates: number[];
    };
    properties: {
        parameter: Record<string, Record<string, number>>;
    };
    header: {
        title: string;
        api_version: string;
        start: string;
        end: string;
    };
}

export interface ClimateDataResponse {
    region: Region;
    timeWindow: TimeWindow;
    data: ClimateData[];
    baseline: ClimateBaseline[];
    success: boolean;
    error?: string;
}

export interface ClimatePageState {
    selectedRegion: Region | null;
    timeWindow: TimeWindowPreset;
    activeLayers: LayerType[];
    loading: boolean;
    error: string | null;
    hazardPanelOpen: boolean;
}


export interface MapClickEvent {
    regionId: string;
    latlng: {
        lat: number;
        lng: number;
    };
}
