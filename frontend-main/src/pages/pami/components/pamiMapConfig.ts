import SimpleLineSymbol from "@arcgis/core/symbols/SimpleLineSymbol";
import type { PAMILocation } from "@/pages/pami/types/pami";

// ── WHO ArcGIS FeatureServer URLs ───────────────────────────────────
export const COUNTRY_SHAPEFILES_BASE =
    "https://services.arcgis.com/5T5nSi527N4F7luB/arcgis/rest/services/Country_Shapefiles/FeatureServer";

export const PAMI_LAYERS = {
    zambia: "https://services.arcgis.com/5T5nSi527N4F7luB/arcgis/rest/services/Zambia_PAMIs/FeatureServer/0",
    southSudan: "https://services.arcgis.com/5T5nSi527N4F7luB/arcgis/rest/services/South_Sudan_PAMIs/FeatureServer/0",
    ghana: "https://services.arcgis.com/5T5nSi527N4F7luB/arcgis/rest/services/Ghana_shapefile_PAMIs/FeatureServer/0",
};

export const GDW_LAYER_URL = "https://services8.arcgis.com/oTalEaSXAuyNT7xf/arcgis/rest/services/GDW_v1_epsilon_gdb/FeatureServer/1";

// ── Country_Shapefiles layer indices ────────────────────────────────
export interface CountryLayerConfig {
    index: number;
    country: string;
    attributeFields: string[];
}

export const COUNTRY_LAYERS: CountryLayerConfig[] = [
    { index: 0, country: "Kenya", attributeFields: ["ADM2_NAME", "ADM1_NAME", "ADM0_NAME"] },
    { index: 1, country: "Malawi", attributeFields: ["ADM2_NAME", "ADM1_NAME", "ADM0_NAME"] },
    { index: 2, country: "Mozambique", attributeFields: ["ADM2_NAME", "ADM1_NAME", "ADM0_NAME"] },
    { index: 3, country: "Nigeria", attributeFields: ["ADM2_NAME", "ADM1_NAME", "ADM0_NAME"] },
    { index: 4, country: "South Africa", attributeFields: ["ADM2_NAME", "ADM1_NAME", "ADM0_NAME"] },
    { index: 5, country: "Tanzania", attributeFields: ["ADM2_NAME", "ADM1_NAME", "ADM0_NAME"] },
    { index: 6, country: "Uganda", attributeFields: ["ADM2_NAME", "ADM1_NAME", "ADM0_NAME"] },
    { index: 7, country: "Zimbabwe", attributeFields: ["ADM2_NAME", "ADM1_NAME", "ADM0_NAME"] },
];

// ── WHO PAMI layer configs ──────────────────────────────────────────
export interface PAMILayerConfig {
    url: string;
    country: string;
    popupFields: { fieldName: string; label: string }[];
}

export const PAMI_COLOR: [number, number, number, number] = [220, 38, 38, 0.8];
export const NO_PAMI: [number, number, number, number] = [255, 255, 255, 0.15];

export const OUTLINE_WHITE = new SimpleLineSymbol({ color: [255, 255, 255, 0.6], width: 0.8 });
export const OUTLINE_THIN = new SimpleLineSymbol({ color: [150, 150, 150, 0.4], width: 0.5 });

export const PAMI_CONFIGS: PAMILayerConfig[] = [
    {
        url: PAMI_LAYERS.zambia,
        country: "Zambia",
        popupFields: [
            { fieldName: "Province", label: "Province" },
            { fieldName: "District", label: "District" },
            { fieldName: "WARD_NAMES", label: "Ward" },
        ],
    },
    {
        url: PAMI_LAYERS.southSudan,
        country: "South Sudan",
        popupFields: [
            { fieldName: "ADM1_EN", label: "State" },
            { fieldName: "ADM2_EN", label: "County" },
        ],
    },
    {
        url: PAMI_LAYERS.ghana,
        country: "Ghana",
        popupFields: [
            { fieldName: "Region", label: "Region" },
            { fieldName: "Admin_2", label: "District" },
            { fieldName: "Cases_sum", label: "Total Cases" },
            { fieldName: "Deaths_sum", label: "Total Deaths" },
            { fieldName: "Incidence", label: "Incidence" },
            { fieldName: "Population", label: "Population" },
        ],
    },
];

// ── Helper: build region lookup from locations prop ─────────────────
export const buildRegionMap = (locations: PAMILocation[], country: string) => {
    const regionSet = new Set<string>();
    locations.forEach((loc) => {
        if (loc.country !== country) return;
        const keys = [loc.district, loc.province, loc.localMunicipality, loc.wardNumber]
            .filter(Boolean) as string[];
        keys.forEach((key) => regionSet.add(key.toLowerCase().trim()));
    });
    return regionSet;
};
