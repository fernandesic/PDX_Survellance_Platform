import { apiGet, apiPost } from "@/lib/api";
import { logger } from "@/utils/logger";
import { arcgisService } from "@/services/arcgisService";
import type { ArcGISFeature } from "@/services/arcgisService";

/* ── Types ──────────────────────────────────────────────────────── */

export interface CorridorIntelligence {
    corridor: string;
    flow_count: number | null;
    flow_weight: number | null;
    flow_type: string | null;
    ihr_screening_priority: string | null;
    risk_score: number | null;
}

export interface RiskDistributionCategory {
    category: string;
    count: number;
    color: string;
}

export interface CriticalCorridorsCount {
    critical: number;
    high: number;
    medium: number;
    low: number;
}

export interface FlowVolumeData {
    corridor: string;
    flow_count: number;
    flow_weight: number;
}


export interface CHWFeature {
    attributes: {
        ADM0_NAME?: string;
        Total_CHW?: number;
        Active_CHWs?: number;
        [key: string]: any;
    };
    geometry?: any;
}

export interface IHRLayerMeta {
    id: string;
    title: string;
    url: string;
    layerType: string;
    visibility?: boolean;
}

/* ── Pipeline group type ───────────────────────────────────────── */

export type PipelineGroup =
    | "official_poe"       // Pipeline 1 — Official Designated PoE
    | "informal_corridors" // Pipeline 2 — Africa Informal Corridors
    | "movement_flows"     // Pipeline 3 — Population Movement Flows
    | "animation";         // Pipeline 4 — Time Animation Layers

export type GeometryType = "point" | "line" | "polygon";

export interface IHRLayerConfig {
    key: string;
    title: string;
    url: string;
    label: string;
    description: string;
    color: string;
    dotColor: string;
    visible: boolean;
    group: PipelineGroup;
    geometryType: GeometryType;
}

export const PIPELINE_LABELS: Record<PipelineGroup, { label: string; icon: string }> = {
    official_poe:       { label: "Official Designated PoE", icon: "🏛️" },
    informal_corridors: { label: "Africa Informal Corridors", icon: "🛤️" },
    movement_flows:     { label: "Population Movement Flows", icon: "🚶" },
    animation:          { label: "Time Animation Layers", icon: "⏱️" },
};

/* ── AFRO ISO-3 codes (47 WHO AFRO member states + SOM + SDN) ─── */

export const AFRO_ISO3 = [
    'DZA','AGO','BEN','BWA','BFA','BDI','CPV','CMR','CAF','TCD',
    'COM','COG','CIV','COD','GNQ','ERI','SWZ','ETH','GAB','GMB',
    'GHA','GIN','GNB','KEN','LSO','LBR','MDG','MWI','MLI','MRT',
    'MUS','MOZ','NAM','NER','NGA','RWA','STP','SEN','SYC','SLE',
    'SOM','ZAF','SSD','SDN','TZA','TGO','UGA','ZMB','ZWE',
] as const;

/* ISO-2 codes for airports layer (which uses iso_country as 2-letter code) */
export const AFRO_ISO2 = [
    'DZ','AO','BJ','BW','BF','BI','CV','CM','CF','TD',
    'KM','CG','CI','CD','GQ','ER','SZ','ET','GA','GM',
    'GH','GN','GW','KE','LS','LR','MG','MW','ML','MR',
    'MU','MZ','NA','NE','NG','RW','ST','SN','SC','SL',
    'SO','ZA','SS','SD','TZ','TG','UG','ZM','ZW',
] as const;

/* Country names for seaport layer (which uses full country name) */
export const AFRO_COUNTRY_NAMES = [
    'Algeria','Angola','Benin','Botswana','Burkina Faso','Burundi',
    'Cabo Verde','Cape Verde','Cameroon','Central African Republic','Chad',
    'Comoros','Congo','Republic of the Congo',"Côte d'Ivoire","Cote d'Ivoire",'Ivory Coast',
    'Democratic Republic of the Congo','DRC',
    'Equatorial Guinea','Eritrea','Eswatini','Swaziland','Ethiopia',
    'Gabon','Gambia','The Gambia','Ghana','Guinea','Guinea-Bissau',
    'Kenya','Lesotho','Liberia','Madagascar','Malawi','Mali','Mauritania',
    'Mauritius','Mozambique','Namibia','Niger','Nigeria',
    'Rwanda','Sao Tome and Principe','São Tomé and Príncipe',
    'Senegal','Seychelles','Sierra Leone','Somalia',
    'South Africa','South Sudan','Sudan',
    'Tanzania','United Republic of Tanzania',
    'Togo','Uganda','Zambia','Zimbabwe',
] as const;

/* Extended AFRO ISO3 list used by the WebMap definition expressions (includes DJI, EGY, LBY, MAR, TUN) */
const AFRO_ISO3_EXTENDED = [
    ...AFRO_ISO3,
    'DJI','EGY','LBY','MAR','TUN',
] as const;

/* ── Build AFRO definition expressions per layer ────────────────── */

function sqlInList(values: readonly string[]): string {
    return values.map(v => `'${v.replace(/'/g, "''")}'`).join(',');
}

/**
 * Per-layer ArcGIS definitionExpression to filter to AFRO countries only.
 * Each layer uses a different field name for country identification.
 * Layers with no entry here are Africa-only by design and need no filter.
 */
export const AFRO_FILTERS: Record<string, string> = {
    // Pipeline 1 — Official PoE
    outbreak_news:    `country_iso3 IN (${sqlInList(AFRO_ISO3_EXTENDED)})`,
    airports:         `iso_country IN (${sqlInList(AFRO_ISO2)})`,
    seaports:         `country IN (${sqlInList(AFRO_COUNTRY_NAMES)})`,
    unhcr:            `iso3 IN (${sqlInList(AFRO_ISO3)})`,
    border_crossings: `iso3_1 IN (${sqlInList(AFRO_ISO3_EXTENDED)}) OR iso3_2 IN (${sqlInList(AFRO_ISO3_EXTENDED)})`,
    inland_ports:     `country IN (${sqlInList(AFRO_ISO3_EXTENDED)})`,
    unhcr_presence:   `iso3 IN (${sqlInList(AFRO_ISO3)})`,
    // Pipeline 2 — Africa-only layers, no filter needed
    // Pipeline 3 — Africa-only layers, no filter needed
    // Pipeline 4 — Animation layers, no filter needed
};

/* ── IHR PoE Layer Endpoints ────────────────────────────────────── */
/* URLs from live WebMap e3cf5055cebd4acab7235a65492e732c           */

export const IHR_POE_LAYERS: IHRLayerConfig[] = [
    /* ── Pipeline 1 — Official Designated PoE (7 layers) ─────── */
    {
        key: "outbreak_news",
        title: "IHR_PoE_WHO_Disease_Outbreak_News",
        url: "https://services.arcgis.com/5T5nSi527N4F7luB/arcgis/rest/services/IHR_PoE_WHO_Disease_Outbreak_News_TEMP_1779443409/FeatureServer/0",
        label: "Disease Outbreak News",
        description: "WHO Disease Outbreak News alerts — AFRO region",
        color: "text-red-500",
        dotColor: "bg-red-500",
        visible: true,
        group: "official_poe",
        geometryType: "point",
    },
    {
        key: "airports",
        title: "IHR_PoE_Global_Airports",
        url: "https://services.arcgis.com/5T5nSi527N4F7luB/arcgis/rest/services/IHR_PoE_Global_Airports/FeatureServer/0",
        label: "AFRO Airports",
        description: "International airports with scheduled service — IHR designated airport PoEs",
        color: "text-pink-500",
        dotColor: "bg-pink-500",
        visible: true,
        group: "official_poe",
        geometryType: "point",
    },
    {
        key: "seaports",
        title: "IHR_PoE_NGA_World_Seaports",
        url: "https://services.arcgis.com/5T5nSi527N4F7luB/arcgis/rest/services/IHR_PoE_Global_Seaports/FeatureServer/0",
        label: "AFRO Seaports",
        description: "Major commercial seaports — IHR designated seaport PoEs",
        color: "text-cyan-500",
        dotColor: "bg-cyan-500",
        visible: true,
        group: "official_poe",
        geometryType: "point",
    },
    {
        key: "inland_ports",
        title: "IHR_PoE_Inland_River_Ports",
        url: "https://services.arcgis.com/5T5nSi527N4F7luB/arcgis/rest/services/IHR_PoE_Inland_River_Ports_TEMP_1779439214/FeatureServer/0",
        label: "Inland River Ports",
        description: "Inland container depots, river terminals, and lake ports",
        color: "text-purple-500",
        dotColor: "bg-purple-500",
        visible: true,
        group: "official_poe",
        geometryType: "point",
    },
    {
        key: "unhcr",
        title: "IHR_PoE_UNHCR_People_of_Concern",
        url: "https://services.arcgis.com/5T5nSi527N4F7luB/arcgis/rest/services/IHR_PoE_UNHCR_People_of_Concern_TEMP_1779439242/FeatureServer/0",
        label: "UNHCR People of Concern",
        description: "Refugees, IDPs, and stateless persons near PoEs",
        color: "text-amber-500",
        dotColor: "bg-amber-500",
        visible: true,
        group: "official_poe",
        geometryType: "point",
    },
    {
        key: "unhcr_presence",
        title: "IHR_PoE_UNHCR_Presence",
        url: "https://services.arcgis.com/5T5nSi527N4F7luB/arcgis/rest/services/IHR_PoE_UNHCR_Presence_TEMP_1779439278/FeatureServer/0",
        label: "UNHCR Office Presence",
        description: "UNHCR office locations for IHR cross-border coordination",
        color: "text-teal-500",
        dotColor: "bg-teal-500",
        visible: false,
        group: "official_poe",
        geometryType: "point",
    },
    {
        key: "border_crossings",
        title: "IHR_PoE_WFP_Border_Crossing_Points",
        url: "https://services.arcgis.com/5T5nSi527N4F7luB/arcgis/rest/services/IHR_PoE_WFP_Border_Crossing_Points_TEMP_1779439129/FeatureServer/0",
        label: "WFP Border Crossings",
        description: "Official designated land border PoEs — WFP compiled",
        color: "text-blue-500",
        dotColor: "bg-blue-500",
        visible: true,
        group: "official_poe",
        geometryType: "point",
    },

    /* ── Pipeline 2 — Africa Informal Corridors (5 layers) ───── */
    {
        key: "border_lines",
        title: "Africa_PoE_Border_Lines",
        url: "https://services.arcgis.com/5T5nSi527N4F7luB/arcgis/rest/services/Africa_PoE_Border_Lines_TEMP_1779439583/FeatureServer/0",
        label: "Border Lines",
        description: "Africa international boundary lines — spatial backbone",
        color: "text-gray-400",
        dotColor: "bg-gray-400",
        visible: false,
        group: "informal_corridors",
        geometryType: "line",
    },
    {
        key: "informal_crossings",
        title: "Africa_PoE_Informal_Crossings",
        url: "https://services.arcgis.com/5T5nSi527N4F7luB/arcgis/rest/services/Africa_PoE_Informal_Crossings_TEMP_1779439966/FeatureServer/0",
        label: "Informal Crossings",
        description: "OSM-detected unofficial road/track border crossings",
        color: "text-orange-500",
        dotColor: "bg-orange-500",
        visible: true,
        group: "informal_corridors",
        geometryType: "point",
    },
    {
        key: "corridor_hotspots",
        title: "Africa_PoE_Corridor_Hotspots",
        url: "https://services.arcgis.com/5T5nSi527N4F7luB/arcgis/rest/services/Africa_PoE_Corridor_Hotspots_TEMP_1779441247/FeatureServer/0",
        label: "Corridor Hotspots",
        description: "ACLED conflict events within 10km of borders",
        color: "text-rose-600",
        dotColor: "bg-rose-600",
        visible: true,
        group: "informal_corridors",
        geometryType: "point",
    },
    {
        key: "buffer_zones",
        title: "Africa_PoE_Border_Buffer_Zones",
        url: "https://services.arcgis.com/5T5nSi527N4F7luB/arcgis/rest/services/Africa_PoE_Border_Buffer_Zones_TEMP_1779441342/FeatureServer/0",
        label: "Border Buffer Zones",
        description: "5km / 10km / 25km IHR health surveillance zones",
        color: "text-sky-500",
        dotColor: "bg-sky-500",
        visible: false,
        group: "informal_corridors",
        geometryType: "polygon",
    },
    {
        key: "corridor_risk",
        title: "Africa_PoE_Corridor_Risk_Scores",
        url: "https://services.arcgis.com/5T5nSi527N4F7luB/arcgis/rest/services/Africa_PoE_Corridor_Risk_Scores_TEMP_1779441632/FeatureServer/0",
        label: "Corridor Risk Heat",
        description: "Composite 0–100 risk score per informal crossing — rendered as heat",
        color: "text-red-600",
        dotColor: "bg-red-600",
        visible: false,
        group: "informal_corridors",
        geometryType: "point",
    },

    /* ── Pipeline 3 — Population Movement Flows (1 layer in WebMap) */
    {
        key: "anim_movement_flows",
        title: "IHR_Anim_Movement_Flows",
        url: "https://services.arcgis.com/5T5nSi527N4F7luB/arcgis/rest/services/IHR_Anim_Movement_Flows_TEMP_1779445548/FeatureServer/0",
        label: "Movement Flow Lines (live)",
        description: "Cross-border population movement — animated directional flow",
        color: "text-teal-400",
        dotColor: "bg-teal-400",
        visible: true,
        group: "movement_flows",
        geometryType: "line",
    },
    {
        key: "chw_signals",
        title: "🏥 Field Intelligence (CHW)",
        url: "", // Client-side graphics layer
        label: "Field Intelligence (CHW)",
        description: "Community Health Worker (Tier 0) ground truth reports",
        color: "text-emerald-500",
        dotColor: "bg-emerald-500",
        visible: true,
        group: "official_poe",
        geometryType: "point",
    },
];

/* ── Helper: get layers by pipeline group ──────────────────────── */

export function getLayersByGroup(group: PipelineGroup): IHRLayerConfig[] {
    return IHR_POE_LAYERS.filter(l => l.group === group);
}

/* ── Service ────────────────────────────────────────────────────── */

export const poe = {
    /**
     * Fetch PoE readiness summary which is currently proxied from readiness summary
     * with specific filters for PoE.
     */
    getSummary: async (page = 1, pageSize = 10) => {
        try {
            // The correct endpoint for PoE summary as per backend readiness/urls.py
            return await apiGet(`/readiness/summary/fvdpoe?page=${page}&page_size=${pageSize}&readiness=FVD PoE`);
        } catch (error) {
            logger.error("Error fetching POE summary:", error);
            throw error;
        }
    },

    /**
     * Fetch CHW country-level summary from ArcGIS via the backend proxy.
     * Uses the CHW_ADM0 layer for aggregated country stats.
     */
    getCHWCountrySummary: async (): Promise<CHWFeature[]> => {
        try {
            const response = await arcgisService.queryLayer(
                "https://services.arcgis.com/5T5nSi527N4F7luB/arcgis/rest/services/CHW_ADM0/FeatureServer/0",
                {
                    where: "1=1",
                    outFields: "*",
                    returnGeometry: false,
                    resultRecordCount: 2000,
                }
            );
            return (response.features || []) as CHWFeature[];
        } catch (error) {
            logger.error("Error fetching CHW country summary:", error);
            throw error;
        }
    },

    /**
     * Fetch the operational layers metadata from the IHR PoE WebMap via backend proxy.
     */
    getIHRWebMapLayers: async (): Promise<IHRLayerMeta[]> => {
        try {
            return await arcgisService.getWebMapLayers("poe_ihr");
        } catch (error) {
            logger.error("Error fetching IHR PoE WebMap layers:", error);
            throw error;
        }
    },

    /**
     * Query a specific IHR PoE layer for feature data.
     * Automatically applies AFRO region filter.
     */
    queryIHRLayer: async (
        layerUrl: string,
        params?: {
            where?: string;
            outFields?: string;
            returnGeometry?: boolean;
            resultRecordCount?: number;
            resultOffset?: number;
        },
        layerKey?: string,
    ): Promise<ArcGISFeature[]> => {
        try {
            // Build AFRO-filtered WHERE clause
            let where = params?.where || "1=1";
            if (layerKey && AFRO_FILTERS[layerKey]) {
                const afroFilter = AFRO_FILTERS[layerKey];
                where = where === "1=1"
                    ? afroFilter
                    : `(${where}) AND (${afroFilter})`;
            }

            const response = await arcgisService.queryLayer(layerUrl, {
                where,
                outFields: params?.outFields || "*",
                returnGeometry: params?.returnGeometry ?? false,
                resultRecordCount: params?.resultRecordCount || 2000,
                resultOffset: params?.resultOffset || 0,
            });
            return response.features || [];
        } catch (error) {
            logger.error(`Error querying IHR PoE layer (${layerUrl}):`, error);
            throw error;
        }
    },

    /**
     * Fetch disease outbreak news count for stats display.
     */
    getOutbreakNewsCount: async (): Promise<number> => {
        try {
            const features = await poe.queryIHRLayer(
                IHR_POE_LAYERS[0].url,
                { where: "1=1", outFields: "OBJECTID", returnGeometry: false },
                IHR_POE_LAYERS[0].key,
            );
            return features.length;
        } catch {
            return 0;
        }
    },

    /**
     * Query population movement corridors and compute/merge risk metrics.
     */
    queryCorridorIntelligence: async (): Promise<CorridorIntelligence[]> => {
        try {
            const flowLayer = IHR_POE_LAYERS.find(l => l.key === "anim_movement_flows");
            if (!flowLayer) return [];

            const features = await poe.queryIHRLayer(
                flowLayer.url,
                { where: "1=1", outFields: "*" },
                flowLayer.key
            );

            let riskFeatures: any[] = [];
            try {
                const riskLayer = IHR_POE_LAYERS.find(l => l.key === "corridor_risk");
                if (riskLayer) {
                    riskFeatures = await poe.queryIHRLayer(
                        riskLayer.url,
                        { where: "1=1", outFields: "risk_score,risk_category,ADM0_NAME" },
                        riskLayer.key
                    );
                }
            } catch (err) {
                logger.warn("[POE] Failed to query corridor risk for matching:", err);
            }

            return features.map(f => {
                const attrs = f.attributes || {};
                const corridor = String(attrs.corridor ?? "Unknown");

                let avgRisk: number | null = null;
                const parts = corridor.split("->");
                if (parts.length > 0 && riskFeatures.length > 0) {
                    const countriesInCorridor = parts.map((p: string) => p.trim().toUpperCase());
                    const matchedRisks = riskFeatures.filter(r => {
                        const country = String(r.attributes?.ADM0_NAME ?? "").toUpperCase();
                        return countriesInCorridor.includes(country);
                    });
                    if (matchedRisks.length > 0) {
                        const sum = matchedRisks.reduce((acc, curr) => acc + (Number(curr.attributes?.risk_score) || 0), 0);
                        avgRisk = Math.round(sum / matchedRisks.length);
                    }
                }

                if (avgRisk === null) {
                    const priority = String(attrs.ihr_priority ?? attrs.ihr_screening_priority ?? "Low").toUpperCase();
                    if (priority.includes("CRIT")) avgRisk = 85;
                    else if (priority.includes("HIGH")) avgRisk = 70;
                    else if (priority.includes("MED")) avgRisk = 45;
                    else avgRisk = 20;
                }

                return {
                    corridor,
                    flow_count: (attrs.flow_count ?? null) as number | null,
                    flow_weight: (attrs.flow_weight ?? null) as number | null,
                    flow_type: (attrs.flow_type ?? null) as string | null,
                    ihr_screening_priority: String(attrs.ihr_screening_priority ?? attrs.ihr_priority ?? "Low"),
                    risk_score: avgRisk,
                };
            });
        } catch (error) {
            logger.error("[POE] queryCorridorIntelligence failed:", error);
            return [];
        }
    },

    /**
     * Query informal border crossings and group by composite risk score category.
     */
    queryRiskDistribution: async (): Promise<RiskDistributionCategory[]> => {
        try {
            const riskLayer = IHR_POE_LAYERS.find(l => l.key === "corridor_risk");
            if (!riskLayer) return [];

            const features = await poe.queryIHRLayer(
                riskLayer.url,
                { where: "1=1", outFields: "risk_category,risk_score" },
                riskLayer.key
            );

            const counts = { Critical: 0, High: 0, Medium: 0, Low: 0 };
            features.forEach(f => {
                const cat = String(f.attributes?.risk_category ?? "").toUpperCase();
                if (cat.startsWith("CRIT")) counts.Critical++;
                else if (cat.startsWith("HIGH")) counts.High++;
                else if (cat.startsWith("MED")) counts.Medium++;
                else counts.Low++;
            });

            return [
                { category: "Critical", count: counts.Critical, color: "#ef4444" },
                { category: "High", count: counts.High, color: "#d97706" },
                { category: "Medium", count: counts.Medium, color: "#eab308" },
                { category: "Low", count: counts.Low, color: "#00e676" },
            ];
        } catch (error) {
            logger.error("[POE] queryRiskDistribution failed:", error);
            return [
                { category: "Critical", count: 0, color: "#ef4444" },
                { category: "High", count: 0, color: "#d97706" },
                { category: "Medium", count: 0, color: "#eab308" },
                { category: "Low", count: 0, color: "#00e676" },
            ];
        }
    },

    /**
     * Fetch active geocoded disease outbreak news count within AFRO region.
     */
    queryDONAlertsCount: async (): Promise<number> => {
        try {
            return await poe.getOutbreakNewsCount();
        } catch (error) {
            logger.error("[POE] queryDONAlertsCount failed:", error);
            return 0;
        }
    },

    /**
     * Query corridors from movement flows layer and count by IHR priority.
     */
    queryCriticalCorridors: async (): Promise<CriticalCorridorsCount> => {
        try {
            const flowLayer = IHR_POE_LAYERS.find(l => l.key === "anim_movement_flows");
            if (!flowLayer) return { critical: 0, high: 0, medium: 0, low: 0 };

            const features = await poe.queryIHRLayer(
                flowLayer.url,
                { where: "1=1", outFields: "ihr_priority,ihr_screening_priority" },
                flowLayer.key
            );

            const counts = { critical: 0, high: 0, medium: 0, low: 0 };
            features.forEach(f => {
                const priority = String(f.attributes?.ihr_priority ?? f.attributes?.ihr_screening_priority ?? "Low").toUpperCase();
                if (priority.includes("CRIT")) counts.critical++;
                else if (priority.includes("HIGH")) counts.high++;
                else if (priority.includes("MED")) counts.medium++;
                else counts.low++;
            });

            return counts;
        } catch (error) {
            logger.error("[POE] queryCriticalCorridors failed:", error);
            return { critical: 0, high: 0, medium: 0, low: 0 };
        }
    },

    /**
     * Fetch cross-border population flows sorted by flow volume descending.
     */
    queryFlowVolumes: async (): Promise<FlowVolumeData[]> => {
        try {
            const corridors = await poe.queryCorridorIntelligence();
            return corridors
                .filter(c => c.flow_count !== null && c.flow_count > 0)
                .map(c => ({
                    corridor: c.corridor,
                    flow_count: c.flow_count || 0,
                    flow_weight: c.flow_weight || 0,
                }))
                .sort((a, b) => b.flow_count - a.flow_count);
        } catch (error) {
            logger.error("[POE] queryFlowVolumes failed:", error);
            return [];
        }
    },

    /* ── Predictive Intelligence — Spillover Risk ──────────────── */

    /**
     * Fetch auto-detected spillover importation risk summary.
     * Returns active outbreaks with per-neighbor P(≥1 import) probabilities.
     */
    getSpilloverRisk: async (): Promise<SpilloverRisk> => {
        return await apiGet<SpilloverRisk>("/onehealth/poe-risk-summary");
    },

    /* ── Predictive Intelligence — Border Signals ─────────────── */

    /**
     * Fetch cross-border signal aggregation for PoE intelligence.
     * Returns per-country signal counts, trends, and individual signal details.
     */
    getBorderSignals: async (days = 30): Promise<BorderSignalSummary> => {
        return await apiGet<BorderSignalSummary>(
            `/sentinel/border-signals/?days=${days}`
        );
    },

    /* ── Predictive Intelligence — Scenario Comparison ────────── */

    /**
     * Run 3 importation scenarios with different intervention parameters.
     * Returns structured comparison of baseline vs enhanced screening vs border restriction.
     */
    runScenarioComparison: async (
        activeISeries: number[],
        countries: ScenarioCountryInput[],
    ): Promise<ScenarioComparison> => {
        const basePayload = {
            active_I_series: activeISeries,
            source_catchment_population: 250_000,
            horizon_days: 84,
            countries,
        };

        try {
            const [baseline, enhanced, restricted] = await Promise.allSettled([
                // Scenario 1: Current trajectory (d=0.20)
                apiPost<ScenarioResult>("/onehealth/cross-border/importation", {
                    ...basePayload,
                    detection_at_poe: 0.20,
                }),
                // Scenario 2: Enhanced PoE screening (d=0.80)
                apiPost<ScenarioResult>("/onehealth/cross-border/importation", {
                    ...basePayload,
                    detection_at_poe: 0.80,
                }),
                // Scenario 3: Border restriction (border_open=0.3)
                apiPost<ScenarioResult>("/onehealth/cross-border/importation", {
                    ...basePayload,
                    detection_at_poe: 0.20,
                    countries: countries.map(c => ({ ...c, border_open: 0.3 })),
                }),
            ]);

            const getResult = (r: PromiseSettledResult<ScenarioResult>): ScenarioResult | null =>
                r.status === "fulfilled" ? r.value : null;

            return {
                baseline: getResult(baseline),
                enhanced_screening: getResult(enhanced),
                border_restriction: getResult(restricted),
            };
        } catch (error) {
            logger.error("[POE] Scenario comparison failed:", error);
            return {
                baseline: null,
                enhanced_screening: null,
                border_restriction: null,
            };
        }
    },
};


/* ── Predictive Intelligence Types ─────────────────────────────── */

export interface SpilloverNeighbor {
    name: string;
    iso3: string;
    p_any_import: number;
    p_any_w4: number;
    p_any_w8: number;
    p_any_w12: number;
    p_any_w4_pct: number;
    p_any_w8_pct: number;
    p_any_w12_pct: number;
    expected_imports: number;
    expected_imports_w4: number;
    expected_imports_w8: number;
    expected_imports_w12: number;
    tier: string;
    daily_lambda: number[];
    cumulative_lambda: number[];
}

export interface SpilloverOutbreak {
    outbreak_id: number;
    pathogen: string;
    source_country: string;
    source_iso3: string;
    confirmed_cases: number;
    confirmed_deaths: number;
    declared_at: string | null;
    severity: string;
    regions: string[];
    preset_used: string | null;
    neighbors: SpilloverNeighbor[];
}

export interface SpilloverRisk {
    active_outbreaks: SpilloverOutbreak[];
    updated_at: string;
}

export interface BorderSignalDetail {
    id: number;
    disease: string;
    lat: number | null;
    lng: number | null;
    priority: string;
    ai_severity: string;
    source_name: string;
    headline: string;
    days_ago: number;
    cross_border_risk: boolean;
    source_tier?: number;
}

export interface BorderCountrySignals {
    country: string;
    iso3: string;
    signal_count_7d: number;
    signal_count_30d: number;
    trend: "increasing" | "stable" | "decreasing";
    top_disease: string | null;
    highest_priority: string;
    nearest_poe_signals: BorderSignalDetail[];
}

export interface BorderSignalSummary {
    total_cross_border_signals: number;
    signals_near_poe: number;
    by_country: BorderCountrySignals[];
    days_queried: number;
    updated_at: string;
}

export interface ScenarioCountryInput {
    name: string;
    iso3: string;
    daily_crossings: number;
    catchment_share: number;
    border_open: number;
    direct_border?: boolean;
    ghs_index?: number | null;
    readiness_composite?: number | null;
    note?: string;
}

export interface ScenarioCountryResult {
    name: string;
    iso3: string;
    expected_imports: number;
    p_any_import: number;
    tier: string;
    expected_imports_w4: number;
    expected_imports_w8: number;
    expected_imports_w12: number;
    p_any_w4: number;
    p_any_w8: number;
    p_any_w12: number;
    daily_lambda: number[];
    cumulative_lambda: number[];
}

export interface ScenarioResult {
    run_id: string;
    run_timestamp: string;
    horizon_days: number;
    countries: ScenarioCountryResult[];
    inputs_echo: {
        travel_while_infectious: number;
        detection_at_poe: number;
        source_catchment_population: number;
    };
}

export interface ScenarioComparison {
    baseline: ScenarioResult | null;
    enhanced_screening: ScenarioResult | null;
    border_restriction: ScenarioResult | null;
}
