// @ts-nocheck

import type {
    Scenario,
    Country,
    ReplenishmentItem,
    Shipment,
    Hazard,
    HazardData,
    EstimationParams,
    ItemNeed,
    HumanResourceNeed,
    InventoryProjectionPoint,
    ReplenishmentReport,
    ReplenishmentLineItem,
    ScenarioDemandMetrics,
    ReplenishmentCategorySummary,
} from './types';
import { DIM_COMMODITIES, FACT_INVENTORY, getShipmentHistoryForCountry } from './database';
import { ESTIMATOR_DB } from './estimatorDatabase';

type PriorityLevel = NonNullable<ItemNeed['priority']>;

const PRIORITY_RANK: Record<PriorityLevel, number> = {
    CRITICAL: 0,
    HIGH: 1,
    MEDIUM: 2,
    LOW: 3,
};

const DEFAULT_PRIORITY: PriorityLevel = 'MEDIUM';
const SHIFTS_PER_DAY = 3;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

const computeScenarioMetrics = (scenario: Scenario, params: EstimationParams): ScenarioDemandMetrics => {
    const projectedCases = Math.max(
        0,
        Math.round(scenario.population_at_risk * (scenario.attack_rate_percent / 100))
    );
    const severeCases = Math.max(
        0,
        Math.round(projectedCases * (scenario.severity_ratio_severe_percent / 100))
    );
    const moderateCases = Math.max(0, projectedCases - severeCases);
    const bedCount = params.number_of_beds;
    const bedMonths = bedCount * (params.period_weeks / 4);
    const weeks = params.period_weeks;

    return {
        projectedCases,
        severeCases,
        moderateCases,
        bedCount,
        bedMonths,
        weeks,
    };
};

const extractBedsPerStaff = (text: string): number | undefined => {
    const match = text.match(/every\s+(\d+)/i);
    if (!match) return undefined;
    const value = parseFloat(match[1]);
    return Number.isFinite(value) ? value : undefined;
};

const computeNeedFromCalculation = (
    item: ItemNeed,
    params: EstimationParams,
    metrics: ScenarioDemandMetrics
): number => {
    if (!item.calculation) {
        return 0;
    }

    const { type, value } = item.calculation;

    switch (type) {
        case 'per_patient':
            return metrics.projectedCases * value;
        case 'per_severe_patient':
            return metrics.severeCases * value;
        case 'per_moderate_patient':
            return metrics.moderateCases * value;
        case 'per_bed':
            return params.number_of_beds * value;
        case 'per_bed_month':
            return metrics.bedMonths * value;
        case 'per_centre':
            return value;
        case 'per_shift':
            return metrics.weeks * 7 * SHIFTS_PER_DAY * value;
        case 'per_staff':
            return value * Math.max(params.number_of_beds / 10, 1);
        case 'per_week':
            return metrics.weeks * value;
        case 'fixed':
            return value;
        case 'per_hundred_patients':
            return (metrics.projectedCases / 100) * value;
        default:
            return 0;
    }
};

const getPriority = (priority?: PriorityLevel): PriorityLevel => priority ?? DEFAULT_PRIORITY;


export const generateAiScenario = (country: Country, hazard: Hazard): Scenario => {
    const riskFactor = country.inform_base / 10;
    const population_at_risk = Math.round(country.population * riskFactor * 0.05);

    const baseParams = ESTIMATOR_DB[hazard]?.params || { number_of_beds: 100, expected_patients_per_week: 10, period_weeks: 16 };

    const estimationParams: EstimationParams = {
        ...baseParams,
        number_of_beds: Math.max(50, Math.round(baseParams.number_of_beds * riskFactor)),
        expected_patients_per_week: Math.max(10, Math.round(baseParams.expected_patients_per_week * riskFactor * 1.5))
    };

    const hazardSpecifics = {
        cholera: `Seasonal rains and pre-existing vulnerabilities suggest a heightened risk of a Cholera outbreak, potentially affecting up to ${population_at_risk.toLocaleString()} people.`,
        ebola: `Proximity to recent hotspots and population mobility create a risk of Ebola spillover, with an estimated ${population_at_risk.toLocaleString()} people in vulnerable regions.`,
        mpox: `An increase in sporadic cases suggests potential for wider community transmission of Mpox, particularly in dense urban areas affecting ${population_at_risk.toLocaleString()}.`,
        lassa: `Seasonal patterns indicate a higher risk of Lassa Fever transmission, with an estimated ${population_at_risk.toLocaleString()} people in endemic zones.`,
        diphtheria: `Gaps in vaccination coverage could lead to a Diphtheria outbreak, with models indicating ${population_at_risk.toLocaleString()} people could be at risk.`
    };

    return {
        country: country.name,
        disease: hazard.charAt(0).toUpperCase() + hazard.slice(1),
        population_at_risk: population_at_risk,
        attack_rate_percent: 0.5 + riskFactor * 0.5,
        severity_ratio_severe_percent: 15.0 + riskFactor * 10,
        narrative: `AI Simulation: ${hazardSpecifics[hazard]}`,
        estimationParams,
    };
};

const extractNumericValue = (text: string): number => {
    const match = text.match(/-?\d+(\.\d+)?/);
    return match ? parseFloat(match[0]) : NaN;
};

const parseAssumption = (
    assumption: string,
    params: EstimationParams,
    metrics?: ScenarioDemandMetrics
): number => {
    const { number_of_beds, expected_patients_per_week, period_weeks } = params;
    const patients = metrics?.projectedCases ?? expected_patients_per_week * period_weeks;
    const severePatients = metrics?.severeCases ?? Math.round(patients * 0.25);
    const bedMonths = metrics?.bedMonths ?? number_of_beds * (period_weeks / 4);
    const cleanAssumption = assumption.toLowerCase();
    const value = extractNumericValue(assumption);

    if (!Number.isFinite(value)) {
        return 0;
    }

    if (cleanAssumption.includes('per bed month')) {
        return value * bedMonths;
    }
    if (cleanAssumption.includes('per bed')) {
        return value * number_of_beds;
    }
    if (cleanAssumption.includes('per severe patient')) {
        return value * severePatients;
    }
    if (cleanAssumption.includes('per patient')) {
        return value * patients;
    }
    if (cleanAssumption.includes('for 100 patients')) {
        return (value / 100) * patients;
    }
    if (cleanAssumption.includes('per week')) {
        return value * period_weeks;
    }
    if (cleanAssumption.includes('per centre')) {
        return value;
    }
    if (cleanAssumption.includes('per shift')) {
        const totalShifts = metrics ? metrics.weeks * 7 * SHIFTS_PER_DAY : SHIFTS_PER_DAY;
        return value * totalShifts;
    }
    if (cleanAssumption.includes('per month')) {
        return value * (period_weeks / 4);
    }

    return value;
};


export const calculateNeeds = (scenario: Scenario, hazard: Hazard): HazardData | null => {
    const hazardData = ESTIMATOR_DB[hazard];
    if (!hazardData) return null;

    const params = scenario.estimationParams;
    const metrics = computeScenarioMetrics(scenario, params);

    const augmentItem = (item: ItemNeed): ItemNeed => {
        const priority = getPriority(item.priority);
        let computedNeed = 0;

        if (item.calculation) {
            computedNeed = computeNeedFromCalculation(item, params, metrics);
        } else {
            computedNeed = parseAssumption(item.assumption, params, metrics);
        }

        if (!Number.isFinite(computedNeed)) {
            computedNeed = 0;
        }

        const need = Math.max(0, Math.ceil(computedNeed));

        return {
            ...item,
            priority,
            need,
        };
    };

    const calculateCategory = (items: ItemNeed[]): ItemNeed[] => items.map(augmentItem);

    const calculatedHr = hazardData.hr.map((item: HumanResourceNeed) => {
        const priority = getPriority(item.priority);
        const lowerValue = item.value.toLowerCase();
        const numericValue = extractNumericValue(item.value);
        const bedsPerStaff = extractBedsPerStaff(item.value);

        let need = item.need || 0;

        if (lowerValue.includes('per shift, every') && bedsPerStaff) {
            need = Math.ceil((params.number_of_beds / bedsPerStaff) * SHIFTS_PER_DAY);
        } else if (lowerValue.includes('per number of beds per shift') && bedsPerStaff) {
            need = Math.ceil((params.number_of_beds / bedsPerStaff) * SHIFTS_PER_DAY);
        } else if (item.variable === 'Per centre') {
            need = Math.ceil(Number.isFinite(numericValue) ? numericValue : 0);
        } else if (item.variable === 'Per shift' || lowerValue.includes('per shift')) {
            const base = Number.isFinite(numericValue) ? numericValue : 0;
            if (bedsPerStaff && bedsPerStaff > 0) {
                need = Math.ceil((params.number_of_beds / bedsPerStaff) * SHIFTS_PER_DAY);
            } else {
                need = Math.ceil(base * SHIFTS_PER_DAY);
            }
        } else if (lowerValue.includes('per bed') && bedsPerStaff) {
            need = Math.ceil(params.number_of_beds / bedsPerStaff);
        } else if (Number.isFinite(numericValue)) {
            need = Math.ceil(numericValue);
        }

        return {
            ...item,
            priority,
            need,
        };
    });

    return {
        params,
        medicines: calculateCategory(hazardData.medicines),
        devices: calculateCategory(hazardData.devices),
        ppe: calculateCategory(hazardData.ppe),
        logistics: calculateCategory(hazardData.logistics),
        hr: calculatedHr,
        metrics,
    };
};


export const calculateReplenishmentPlan = (grossNeeds: HazardData, hazard: Hazard): ReplenishmentItem[] => {

    const plan: ReplenishmentItem[] = [];

    let relevantCommodityIds: string[] = [];

    if (hazard === 'cholera') {
        relevantCommodityIds = ['CHOLERA_KIT_CENTRAL_DRUGS', 'CHOLERA_KIT_CENTRAL_EQUIP', 'CHOLERA_KIT_CENTRAL_RENEW'];
    } else if (hazard === 'ebola') {
        relevantCommodityIds = ['EBOLA_KIT_TREATMENT_PPE', 'EBOLA_KIT_BURIAL_SDB'];
    } else {
        relevantCommodityIds = ['IEHK_BASIC_MEDS', 'IEHK_BASIC_EQUIP'];
    }

    relevantCommodityIds.forEach(commodityId => {
        const commodity = DIM_COMMODITIES.find(c => c.commodity_id === commodityId);
        if (commodity) {
            const inventory = FACT_INVENTORY.find(inv => inv.commodity_id === commodity.commodity_id) || { stock_on_hand: 0, quantity_in_pipeline: 0 };


            const gross_need = 10 + Math.ceil(grossNeeds.params.number_of_beds / (hazard === 'cholera' ? 10 : 20));

            const quantity_to_ship = Math.max(0, gross_need - inventory.stock_on_hand - inventory.quantity_in_pipeline);

            plan.push({
                commodity_id: commodity.commodity_id,
                who_description: commodity.who_description,
                gross_need,
                stock_on_hand: inventory.stock_on_hand,
                quantity_in_pipeline: inventory.quantity_in_pipeline,
                quantity_to_ship,
                estimated_cost_usd: quantity_to_ship * commodity.unit_cost_usd,
                avg_lead_time_days: commodity.avg_lead_time_days
            });
        }
    })

    return plan.sort((a, b) => b.estimated_cost_usd - a.estimated_cost_usd);
}



export const getShipmentHistory = (country: Country): (Shipment & { who_description: string })[] => {
    const history = getShipmentHistoryForCountry(country);
    return history.map(s => {
        const commodity = DIM_COMMODITIES.find(c => c.commodity_id === s.commodity_id);
        return {
            ...s,
            who_description: commodity ? commodity.who_description : 'Unknown Commodity'
        };
    }).sort((a, b) => b.dispatch_date.getTime() - a.dispatch_date.getTime());
};


export const getInventoryProjections = (item: ItemNeed, country: Country, weeks: number, demandMultiplier: number = 1) => {
    const weekly_demand = Math.ceil((item.need / weeks) * demandMultiplier);

    const representativeModule = DIM_COMMODITIES.find(c => c.item_category === item.category && c.who_description.toLowerCase().includes(item.description.split(' ')[0].toLowerCase()));


    const base_lead_time_days = representativeModule?.avg_lead_time_days || 45;
    const countryModifier = 1 + ((country.inform_base - 5) / 5) * 0.5;
    const lead_time_days = Math.round(base_lead_time_days * Math.max(1, countryModifier));

    const inventory = FACT_INVENTORY.find(inv => inv.commodity_id === representativeModule?.commodity_id) || { stock_on_hand: 0, quantity_in_pipeline: 0 };

    const current_inventory = inventory.stock_on_hand;
    const safety_stock = weekly_demand * 2;

    const projection: InventoryProjectionPoint[] = [];
    let stockLevel = current_inventory;
    let stockout_week = -1;

    for (let i = 0; i <= weeks; i++) {
        projection.push({
            week: i,
            date: new Date(new Date().getTime() + i * 7 * 24 * 3600 * 1000).toLocaleDateString('en-CA'),
            level: stockLevel,
        });
        if (stockLevel <= safety_stock && stockout_week === -1) {
            stockout_week = i;
        }
        stockLevel -= weekly_demand;
        if (stockLevel < 0) stockLevel = 0;
    }

    const stockout_date = new Date(new Date().getTime() + stockout_week * 7 * 24 * 3600 * 1000);
    const order_by_date = new Date(stockout_date.getTime() - lead_time_days * 24 * 3600 * 1000);
    const expected_arrival_date = new Date(order_by_date.getTime() + lead_time_days * 24 * 3600 * 1000);

    return {
        projection,
        weeks,
        weekly_demand,
        current_inventory,
        safety_stock,
        stockout_week,
        stockout_week_date: stockout_week !== -1 ? stockout_date.toISOString() : null,
        lead_time_days,
        order_by_date: order_by_date.toISOString(),
        expected_arrival_date: expected_arrival_date.toISOString()
    };
};
type ScrollActionState = 'TRIGGER' | 'STANDBY';

export interface ScrollTriggerMap {
    trigger: string;
    scroll: string;
    action: string;
    evaluator?: (stock: number) => ScrollActionState;
}

interface SymbolicModuleConfig {
    module: string;
    purpose: string;
    method: string;
    api_endpoint?: string;
    example_query?: string;
    application_logic: string;
    is_external_api?: boolean;
    configuration_example?: {
        disease_code: string;
        threshold_trigger: number;
        required_supplies: {
            sku: string;
            name: string;
            quantity_per_case: number;
        }[];
    };
}

export interface LogisticsTriggerLogic {
    trigger_type: string;
    threshold_value?: number;
    action?: string;
    priority_level?: string;
    percent_increase?: number;
    time_window_days?: number;
    usage?: string;
    inverse_correlation?: boolean;
}

export interface SupplyRequirement {
    item_name: string;
    sku_id: string;
    unit_per_case: number;
    stock_category: string;
    storage_condition: string;
}

export interface MonitoredIndicator {
    disease_name: string;
    description: string;
    who_indicator_code: string;
    official_data_endpoint: string;
    spatial_dimension_filter: string;
    logistics_trigger_logic: LogisticsTriggerLogic;
    supply_requirements: SupplyRequirement[];
}

export interface WhoGhoDiseaseSupplyConfig {
    config_name: string;
    description: string;
    last_updated: string;
    api_base_url: string;
    monitored_indicators: MonitoredIndicator[];
}

export const symbolicScrolls: {
    triggers: ScrollTriggerMap[];
    modules: SymbolicModuleConfig[];
} = {
    triggers: [
        {
            trigger: 'onWeekAdvance',
            scroll: 'CheckDecayTrigger',
            action: 'Evaluate weekly stock decay and raise TRIGGER when inventory slips below 20%.',
            evaluator: (stock: number) => (stock < 0.2 ? 'TRIGGER' : 'STANDBY'),
        },
        {
            trigger: 'onJubaFail',
            scroll: 'FallbackToMombasa',
            action: 'Switch logistics path to fallback route',
        },
        {
            trigger: 'onMombasaStorm',
            scroll: 'RerouteToNairobiAir',
            action: 'Override sea port, route air via Nairobi',
        },
        {
            trigger: 'onRiskThreshold',
            scroll: 'TriggerHQAlert',
            action: 'Notify operations HQ of critical risk',
        },
        {
            trigger: 'onTOPSISRecalc',
            scroll: 'RankProvinces',
            action: 'Recompute LPI and apply TOPSIS sorting',
        },
    ],
    modules: [
        {
            module: 'Disease Indicator Discovery',
            purpose: 'Identify the specific WHO codes for diseases relevant to logistic prepositioning (e.g., Malaria, Cholera, HIV).',
            method: 'Search for specific disease terms within the Indicator list.',
            api_endpoint: 'https://ghoapi.azureedge.net/api/Indicator',
            example_query: "https://ghoapi.azureedge.net/api/Indicator?$filter=contains(IndicatorName,'Malaria')",
            application_logic: "Store the returned IndicatorCode (e.g., 'MALARIA_EST_CASES') to automate future data fetches.",
        },
        {
            module: 'Geographic Demand Sensing',
            purpose: 'Determine which regions or countries have the highest prevalence of the tracked diseases to allocate warehouses/supplies.',
            method: 'Fetch Country dimensions and then filter disease data by those codes.',
            api_endpoint: 'https://ghoapi.azureedge.net/api/DIMENSION/COUNTRY/DimensionValues',
            example_query: "https://ghoapi.azureedge.net/api/MALARIA_EST_CASES?$filter=SpatialDimType eq 'COUNTRY' and TimeDimensionBegin ge 2022-01-01",
            application_logic: "Map 'SpatialDim' (Country Code) to your internal Warehouse_ID to calculate distance to the affected area.",
        },
        {
            module: 'Supply Chain Mapping',
            purpose: 'Link the WHO disease data to specific physical inventory (SKUs) needed for prepositioning.',
            method: 'Translate disease thresholds into logistics kit demands.',
            application_logic: 'Maintain a lookup between indicator thresholds and response bill-of-materials so alerts generate actionable SKUs.',
            is_external_api: false,
            configuration_example: {
                disease_code: 'MALARIA_EST_CASES',
                threshold_trigger: 50000,
                required_supplies: [
                    {
                        sku: 'MED-ACT-001',
                        name: 'Artemisinin-based combination therapy',
                        quantity_per_case: 1,
                    },
                    {
                        sku: 'NET-ITN-005',
                        name: 'Insecticide-treated bed net',
                        quantity_per_case: 0.5,
                    },
                ],
            },
        },
        {
            module: 'Temporal Trend Analysis',
            purpose: 'Analyze historical data to predict seasonal outbreaks (e.g., rainy seasons) for proactive prepositioning.',
            method: 'Filter indicator data by date ranges to visualize trends over time.',
            api_endpoint: 'https://ghoapi.azureedge.net/api/[IndicatorCode]',
            example_query: "https://ghoapi.azureedge.net/api/MALARIA_EST_CASES?$filter=date(TimeDimensionBegin) ge 2015-01-01",
            application_logic: "Ingest 'NumericValue' and 'TimeDimensionBegin' into a time-series forecasting model to predict next quarter's demand.",
        },
    ],
};

export const whoGhoDiseaseSupplyMap: WhoGhoDiseaseSupplyConfig = {
    config_name: 'WHO_GHO_Disease_Supply_Map',
    description: 'Configuration linking WHO OData Indicators to Logistic Prepositioning Requirements',
    last_updated: '2024-05-20',
    api_base_url: 'https://ghoapi.azureedge.net/api',
    monitored_indicators: [
        {
            disease_name: 'Malaria',
            description: 'Confirmed malaria cases (microscopy or RDT)',
            who_indicator_code: 'MALARIA_CONF_CASES',
            official_data_endpoint: 'https://ghoapi.azureedge.net/api/MALARIA_CONF_CASES',
            spatial_dimension_filter: "SpatialDimType eq 'COUNTRY'",
            logistics_trigger_logic: {
                trigger_type: 'THRESHOLD_EXCEED',
                threshold_value: 10000,
                action: 'PREPOSITION_STOCK',
                priority_level: 'HIGH',
            },
            supply_requirements: [
                {
                    item_name: 'Artemisinin-based Combination Therapy (ACT)',
                    sku_id: 'MED-MAL-ACT-001',
                    unit_per_case: 1.0,
                    stock_category: 'Pharmaceuticals',
                    storage_condition: 'Climate Control (15-25°C)',
                },
                {
                    item_name: 'Long-lasting insecticidal nets (LLINs)',
                    sku_id: 'PREV-MAL-NET-005',
                    unit_per_case: 0.5,
                    stock_category: 'Prevention',
                    storage_condition: 'Dry Storage',
                },
                {
                    item_name: 'Rapid Diagnostic Tests (RDT)',
                    sku_id: 'DIAG-MAL-RDT-020',
                    unit_per_case: 1.2,
                    stock_category: 'Diagnostics',
                    storage_condition: 'Cool Dry Place',
                },
            ],
        },
        {
            disease_name: 'Cholera',
            description: 'Cholera reported cases',
            who_indicator_code: 'CHOLERA_000001',
            official_data_endpoint: 'https://ghoapi.azureedge.net/api/CHOLERA_000001',
            spatial_dimension_filter: "SpatialDimType eq 'COUNTRY'",
            logistics_trigger_logic: {
                trigger_type: 'RATE_OF_CHANGE',
                percent_increase: 20,
                time_window_days: 14,
                action: 'EMERGENCY_AIRLIFT',
                priority_level: 'CRITICAL',
            },
            supply_requirements: [
                {
                    item_name: 'Oral Rehydration Salts (ORS)',
                    sku_id: 'MED-CHO-ORS-100',
                    unit_per_case: 5.0,
                    stock_category: 'Pharmaceuticals',
                    storage_condition: 'Dry Storage',
                },
                {
                    item_name: "IV Fluids (Ringer's Lactate)",
                    sku_id: 'MED-CHO-IVF-050',
                    unit_per_case: 2.0,
                    stock_category: 'Pharmaceuticals',
                    storage_condition: 'Climate Control',
                },
                {
                    item_name: 'Water Purification Tablets (NaDCC)',
                    sku_id: 'WASH-TAB-010',
                    unit_per_case: 20.0,
                    stock_category: 'WASH',
                    storage_condition: 'Dry Storage',
                },
            ],
        },
        {
            disease_name: 'Life Expectancy / General Health Context',
            description: 'Life expectancy at birth (used for vulnerability weighting)',
            who_indicator_code: 'WHOSIS_000001',
            official_data_endpoint: 'https://ghoapi.azureedge.net/api/WHOSIS_000001',
            spatial_dimension_filter: "Dim1 eq 'BOTH_SEXES'",
            logistics_trigger_logic: {
                trigger_type: 'BASELINE_WEIGHTING',
                usage: "Used to calculate 'Vulnerability Score' for location prioritization, not direct supply trigger.",
                inverse_correlation: true,
            },
            supply_requirements: [],
        },
    ],
};

const hazardCommodityFallback: Record<Hazard | 'default', Record<string, string[]>> = {
    cholera: {
        Medicines: ['CHOLERA_KIT_CENTRAL_DRUGS', 'CHOLERA_KIT_PERIPHERY_DRUGS', 'CHOLERA_KIT_COMMUNITY_DRUGS'],
        'Medical Devices': ['CHOLERA_KIT_CENTRAL_EQUIP', 'CHOLERA_KIT_PERIPHERY_EQUIP'],
        PPE: ['CHOLERA_KIT_CENTRAL_RENEW', 'CHOLERA_KIT_PERIPHERY_RENEW'],
        'Logistics & WASH': ['CHOLERA_KIT_CENTRAL_RENEW', 'CHOLERA_KIT_PERIPHERY_RENEW'],
    },
    ebola: {
        Medicines: ['EBOLA_KIT_TREATMENT_MEDS'],
        'Medical Devices': [],
        PPE: ['EBOLA_KIT_TREATMENT_PPE', 'BODY_BAG_ADULT'],
        'Logistics & WASH': ['EBOLA_KIT_BURIAL_SDB', 'BODY_BAG_ADULT'],
    },
    mpox: {
        Medicines: ['IEHK_BASIC_MEDS'],
        'Medical Devices': ['IEHK_BASIC_EQUIP'],
        PPE: ['COVERALL_TYVEK_L'],
        'Logistics & WASH': ['IEHK_BASIC_EQUIP'],
    },
    lassa: {
        Medicines: ['IEHK_BASIC_MEDS'],
        'Medical Devices': ['IEHK_BASIC_EQUIP'],
        PPE: ['COVERALL_TYVEK_L'],
        'Logistics & WASH': ['IEHK_BASIC_EQUIP'],
    },
    diphtheria: {
        Medicines: ['IEHK_BASIC_MEDS'],
        'Medical Devices': ['IEHK_BASIC_EQUIP'],
        PPE: ['COVERALL_TYVEK_L'],
        'Logistics & WASH': ['IEHK_BASIC_EQUIP'],
    },
    default: {
        Medicines: ['IEHK_BASIC_MEDS'],
        'Medical Devices': ['IEHK_BASIC_EQUIP'],
        PPE: ['COVERALL_TYVEK_L'],
        'Logistics & WASH': ['IEHK_BASIC_EQUIP'],
    },
};

const resolveCommodityForItem = (item: ItemNeed, hazard: Hazard) => {
    if (item.commodity_id) {
        return DIM_COMMODITIES.find((c) => c.commodity_id === item.commodity_id);
    }

    const hazardMap = hazardCommodityFallback[hazard] || hazardCommodityFallback.default;
    const fallbackList = hazardMap[item.category] || hazardCommodityFallback.default[item.category] || [];

    const commodity = fallbackList
        .map((id) => DIM_COMMODITIES.find((c) => c.commodity_id === id))
        .find((c) => !!c);

    if (commodity) return commodity;

    const keyword = item.description.split(' ')[0]?.toLowerCase();
    return DIM_COMMODITIES.find((c) => c.who_description.toLowerCase().includes(keyword));
};

const buildLineItem = (item: ItemNeed, hazard: Hazard): ReplenishmentLineItem => {
    const commodity = resolveCommodityForItem(item, hazard);
    const inventory = commodity ? FACT_INVENTORY.find((inv) => inv.commodity_id === commodity.commodity_id) : undefined;
    const stock_on_hand = inventory?.stock_on_hand ?? 0;
    const quantity_in_pipeline = inventory?.quantity_in_pipeline ?? 0;
    const available_stock = stock_on_hand + quantity_in_pipeline;
    const gross_need = Math.max(0, Math.ceil(item.need));
    const net_to_ship = Math.max(0, gross_need - available_stock);
    const unit_cost_usd = item.cost ?? commodity?.unit_cost_usd;
    const estimated_cost_usd = unit_cost_usd !== undefined ? parseFloat((unit_cost_usd * net_to_ship).toFixed(2)) : undefined;

    return {
        description: item.description,
        category: item.category,
        unit: item.unit,
        assumption: item.assumption,
        gross_need,
        available_stock,
        quantity_in_pipeline,
        net_to_ship,
        unit_cost_usd,
        estimated_cost_usd,
        commodity_id: commodity?.commodity_id,
        priority: item.priority ?? DEFAULT_PRIORITY,
    };
};


export const buildReplenishmentReport = (country: Country, hazard: Hazard): ReplenishmentReport | null => {
    const scenario = generateAiScenario(country, hazard);
    const needs = calculateNeeds(scenario, hazard);

    if (!needs) return null;

    const metrics = needs.metrics;
    const projected_cases =
        metrics?.projectedCases ??
        Math.max(0, Math.round(scenario.estimationParams.expected_patients_per_week * scenario.estimationParams.period_weeks));
    const severe_cases = metrics?.severeCases ?? Math.round(projected_cases * 0.25);

    const rawItems: ItemNeed[] = [...needs.medicines, ...needs.devices, ...needs.ppe, ...needs.logistics].filter(
        (item) => item.need > 0
    );

    const line_items = rawItems
        .map((item) => buildLineItem(item, hazard))
        .filter((item) => item.net_to_ship > 0)
        .sort((a, b) => {
            const priorityA = PRIORITY_RANK[getPriority(a.priority)];
            const priorityB = PRIORITY_RANK[getPriority(b.priority)];
            if (priorityA !== priorityB) return priorityA - priorityB;
            return b.net_to_ship - a.net_to_ship;
        });

    const categoryMap: Record<string, ReplenishmentCategorySummary> = {};
    line_items.forEach((item) => {
        if (!categoryMap[item.category]) {
            categoryMap[item.category] = {
                category: item.category,
                gross_need: 0,
                net_to_ship: 0,
                estimated_cost_usd: 0,
            };
        }
        categoryMap[item.category].gross_need += item.gross_need;
        categoryMap[item.category].net_to_ship += item.net_to_ship;
        categoryMap[item.category].estimated_cost_usd += item.estimated_cost_usd || 0;
    });

    const category_summaries = Object.values(categoryMap).sort((a, b) => b.net_to_ship - a.net_to_ship);

    const total_estimated_cost_usd = line_items.reduce((sum, item) => sum + (item.estimated_cost_usd || 0), 0);
    const total_gross_need = line_items.reduce((sum, item) => sum + item.gross_need, 0);
    const total_net_to_ship = line_items.reduce((sum, item) => sum + item.net_to_ship, 0);

    const top_priorities = [...line_items].slice(0, 5);

    return {
        country_iso: country.iso,
        hazard,
        scenario_summary: {
            population_at_risk: scenario.population_at_risk,
            projected_cases,
            severe_cases,
            narrative: scenario.narrative,
        },
        total_estimated_cost_usd: parseFloat(total_estimated_cost_usd.toFixed(2)),
        total_gross_need,
        total_net_to_ship,
        category_summaries,
        top_priorities,
        line_items,
        estimation_params: needs.params,
    };
};

const summarizePlan = (plan: ReplenishmentItem[]) => {
    const totalGrossNeed = plan.reduce((sum, p) => sum + p.gross_need, 0);
    const available = plan.reduce((sum, p) => sum + p.stock_on_hand + p.quantity_in_pipeline, 0);
    const backlog = plan.reduce((sum, p) => sum + p.quantity_to_ship, 0);
    return {
        coverage: totalGrossNeed > 0 ? clamp01(available / totalGrossNeed) : 1,
        backlog
    };
};

const makeSignature = (country: Country, hazard: Hazard, coverage: number, backlog: number): string => {
    const payload = `${country.iso}-${hazard}-${Math.round(coverage * 100)}-${Math.round(backlog)}`;
    let hash = 0;
    for (let i = 0; i < payload.length; i++) {
        hash = (hash * 31 + payload.charCodeAt(i)) >>> 0;
    }
    return `SIG-${hash.toString(16).padStart(8, '0').toUpperCase()}`;
};

export type ScrollId = 'X' | 'Y' | 'Z';

export interface ScrollDirective {
    id: ScrollId;
    label: string;
    country: Country;
    hazard: Hazard;
    focus: string;
    signature: string;
    hybridScore: number;
    coverage: number;
    backlog: number;
    monitor?: {
        item: string;
        weeklyDemand: number;
        safetyStock: number;
        stockoutWeek: number;
        stockoutDate: string | null;
        orderByDate: string;
        expectedArrivalDate: string;
    };
    plan: ReplenishmentItem[];
}

export interface SoulprintRecord {
    id: ScrollId;
    signature: string;
    timestamp: string;
    summary: string;
}

const soulprintChain: SoulprintRecord[] = [];

const buildScroll = (
    id: ScrollId,
    country: Country,
    hazard: Hazard,
    focus: string,
    demandMultiplier: number
): ScrollDirective => {
    const scenario = generateAiScenario(country, hazard);
    const needs = calculateNeeds(scenario, hazard);
    const plan = needs ? calculateReplenishmentPlan(needs, hazard) : [];
    const { coverage, backlog } = summarizePlan(plan);

    // Lightweight hybrid score: risk + coverage + backlog penalty (proxy for N-AHP + TOPSIS + Grey)
    const riskComponent = Math.pow(country.inform_base / 10, 1.1);
    const coverageComponent = coverage;
    const backlogComponent = 1 - clamp01(backlog / (backlog + 50));
    const hybridScore = clamp01(riskComponent * 0.5 + coverageComponent * 0.35 + backlogComponent * 0.15);

    const signature = makeSignature(country, hazard, coverage, backlog);
    let monitor: ScrollDirective['monitor'];

    if (hazard === 'cholera' && needs && needs.medicines.length > 0) {
        const anchorItem = needs.medicines[0];
        const projections = getInventoryProjections(anchorItem, country, scenario.estimationParams.period_weeks, demandMultiplier);
        monitor = {
            item: anchorItem.description,
            weeklyDemand: projections.weekly_demand,
            safetyStock: projections.safety_stock,
            stockoutWeek: projections.stockout_week,
            stockoutDate: projections.stockout_week_date,
            orderByDate: projections.order_by_date,
            expectedArrivalDate: projections.expected_arrival_date
        };
    }

    const directive: ScrollDirective = {
        id,
        label: `Scroll ${id}`,
        country,
        hazard,
        focus,
        signature,
        hybridScore,
        coverage,
        backlog,
        monitor,
        plan
    };

    soulprintChain.push({
        id,
        signature,
        timestamp: new Date().toISOString(),
        summary: `${directive.label}: ${focus}`
    });

    return directive;
};

/**
 * Developer-mode utility to create the three requested "Scrolls" and log them to the SoulprintChain.
 * - Scroll X: DeepCAL trace on the active hazard/country with a truth signature.
 * - Scroll Y: Cholera decay monitor for the same country.
 * - Scroll Z: Command response view anchored on South Sudan (or fallback to current country).
 */
export const runDeveloperScrolls = (
    country: Country,
    countries: Country[],
    hazard: Hazard,
    demandMultiplier: number = 1
): { scrolls: ScrollDirective[]; log: SoulprintRecord[] } => {
    const southSudan = countries.find(c => c.iso === 'SSD') || country;

    const scrollX = buildScroll('X', country, hazard, 'Woo trace -> DeepCAL -> system truth signature', demandMultiplier);
    const scrollY = buildScroll('Y', country, 'cholera', 'Bind cholera supply decay monitor', demandMultiplier);
    const scrollZ = buildScroll('Z', southSudan, hazard, 'Command response in South Sudan', demandMultiplier);

    return {
        scrolls: [scrollX, scrollY, scrollZ],
        log: [...soulprintChain]
    };
};

export const getSoulprintChain = (): SoulprintRecord[] => [...soulprintChain];


