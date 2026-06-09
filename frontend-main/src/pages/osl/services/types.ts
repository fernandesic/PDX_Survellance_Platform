// @ts-nocheck
// --- Core domain types ---

export type Hazard = 'cholera' | 'ebola' | 'mpox' | 'lassa' | 'diphtheria';
export type PriorityLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface Country {
    iso: string;
    name: string;
    inform_base: number;
    ghs_base: number;
    population: number;
    priority: 1 | 2 | 3;
}

export interface RiskPrepData {
    country_iso: string;
    date: Date;
    inform_risk: number;
    inform_vulnerability: number;
    ghs_preparedness: number;
}

export interface OutbreakData {
    country_iso: string;
    date: Date;
    disease: string;
    cases: number;
}

export interface Shipment {
    commodity_id: string;
    dispatch_date: Date;
    arrival_date?: Date;
    quantity: number;
    status: 'SHIPPED' | 'DELIVERED' | 'IN_TRANSIT';
    location?: string;
}

export interface OutbreakStat {
    iso: string;
    country: string;
    hazard: Hazard;
    confirmed: number;
    deaths: number;
    recovered?: number;
    active?: number;
    incidencePer100k: number;
    cfr: number;
    lastUpdated: string;
}

export interface Scenario {
    country: string;
    disease: string;
    population_at_risk: number;
    attack_rate_percent: number;
    severity_ratio_severe_percent: number;
    narrative: string;
    estimationParams: EstimationParams;
}

export interface ScenarioDemandMetrics {
    projectedCases: number;
    severeCases: number;
    moderateCases: number;
    bedCount: number;
    bedMonths: number;
    weeks: number;
}

export interface EstimationParams {
    number_of_beds: number;
    expected_patients_per_week: number;
    period_weeks: number;
}

export interface CalculationRule {
    type:
    | 'per_patient'
    | 'per_severe_patient'
    | 'per_moderate_patient'
    | 'per_bed'
    | 'per_bed_month'
    | 'per_centre'
    | 'per_shift'
    | 'per_staff'
    | 'per_week'
    | 'per_month'
    | 'per_hundred_patients'
    | 'fixed';
    value: number;
}

export interface ItemNeed {
    id?: string;
    description: string;
    category: string;
    need: number;
    unit: string;
    assumption: string;
    cost?: number;
    priority?: PriorityLevel;
    calculation?: CalculationRule;
    commodity_id?: string;
}

export interface HumanResourceNeed {
    profile: string;
    need: number;
    variable: string;
    value: string;
    priority?: PriorityLevel;
}

export interface HazardData {
    params: EstimationParams;
    medicines: ItemNeed[];
    devices: ItemNeed[];
    ppe: ItemNeed[];
    logistics: ItemNeed[];
    hr: HumanResourceNeed[];
    metrics?: ScenarioDemandMetrics;
}

// --- Replenishment / reporting ---

export interface ReplenishmentItem {
    commodity_id: string;
    who_description: string;
    gross_need: number;
    stock_on_hand: number;
    quantity_in_pipeline: number;
    quantity_to_ship: number;
    estimated_cost_usd: number;
    avg_lead_time_days: number;
}

export interface ReplenishmentLineItem {
    description: string;
    category: string;
    unit: string;
    assumption: string;
    gross_need: number;
    available_stock: number;
    quantity_in_pipeline: number;
    net_to_ship: number;
    unit_cost_usd?: number;
    estimated_cost_usd?: number;
    commodity_id?: string;
    priority?: PriorityLevel;
}

export interface ReplenishmentCategorySummary {
    category: string;
    gross_need: number;
    net_to_ship: number;
    estimated_cost_usd: number;
}

export interface ReplenishmentReport {
    country_iso: string;
    hazard: Hazard;
    scenario_summary: {
        population_at_risk: number;
        projected_cases: number;
        severe_cases: number;
        narrative: string;
    };
    total_estimated_cost_usd: number;
    total_gross_need: number;
    total_net_to_ship: number;
    category_summaries: ReplenishmentCategorySummary[];
    top_priorities: ReplenishmentLineItem[];
    line_items: ReplenishmentLineItem[];
    estimation_params: EstimationParams;
}

export interface EpidemiologicalSummary {
    attack_rate_percent: number;
    case_fatality_ratio_percent: number;
    confirmed_cases: number;
    total_cases: number;
    severe_cases: number;
    mild_cases: number;
}

// --- PI / Index ---

export interface RiskPillar {
    name: 'Collaborative Surveillance' | 'Community Vulnerability' | 'System Capacity & Readiness' | 'Logistical & Geographic Risk';
    value: number;
    color: string;
}

export interface PiScore {
    country_iso: string;
    date: Date;
    pi_scores: { [key in Hazard]?: number };
    priorityScore: number;
    risk_norm: number;
    preparedness_norm: number;
    vulnerability_norm: number;
    outbreak_norms: { [key in Hazard]?: number };
}

export interface ForecastPoint {
    date: Date;
    forecast: number;
    lower_ci: number;
    upper_ci: number;
}

export interface InventoryProjectionPoint {
    week: number;
    date: string;
    level: number;
}

// --- Logistics & UI domain ---

export interface ShipmentData {
    request_reference: string;
    origin: string;
    origin_longitude: number;
    origin_latitude: number;
    destination: string;
    destination_longitude: number;
    destination_latitude: number;
    weight_kg: number;
    volume_cbm: number;
    cargo_description: string;
    freight_carrier: string;
    cost_usd: number;
    transit_days: number;
    on_time: boolean;
    forwarder: string;
}

export interface FormData {
    request_reference: string;
    origin: string;
    destination: string;
    weight: number;
    volume: number;
    cargoType: string;
    forwarders: string[];
    [key: string]: any; // Allow dynamic access for price/days inputs
}

export interface ForwarderKPI {
    totalShipments: number;
    avgTransitDays: number;
    avgCost: number;
    onTimeRate: number;
    costPerKg: number;
    isUserInput: boolean;
}

export interface RankedForwarder extends ForwarderKPI {
    name: string;
    score: number;
}

export interface ForwarderInputDef {
    id: string;
    name: string;
    defaultPrice: number;
    defaultDays: number;
}

// --- LPI AI Types ---

export interface LpiScenario {
    country: string;
    region: string;
    disease: string;
    severity: string;
    population: number;
    vulnerabilityGroup: string;
    season: string;
    infrastructure: string;
    localCapacity: string;
}

export interface CommodityItem {
    commodityName: string;
    quantity: number;
    unit: string;
}

export interface CommodityCategory {
    category: string;
    items: CommodityItem[];
}

export interface LpiResult {
    changeSummary: string;
    executiveSummary: string;
    riskAssessment: {
        riskLevel: string;
        reproductionNumberR0: number;
        projectedSpreadRadiusKm: number;
    };
    logisticsConstraints: string[];
    planningAssumptions: string[];
    commodityStockpile: CommodityCategory[];
    logisticsPlan: {
        prepositioningHub: string;
        totalWeightKg: number;
        totalVolumeCbm: number;
        transportMode: string;
        estimatedLeadTimeDays: number;
    };
    budgetAnalysis: {
        totalCostUSD: number;
        breakdown: {
            pillar: string;
            estimatedCostUSD: number;
        }[];
    };
    keyInterventions: string[];
}

