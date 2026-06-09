// @ts-nocheck
import { CommodityDetail as Commodity, KitContent, Inventory, Shipment, Country } from './types';

// This new database is built from the provided warehouse catalogue.
// It uses the official descriptions and models items as they are stored (e.g., as kit modules).
export const DIM_COMMODITIES: Commodity[] = [
    // --- Emergency Health Kits (Modules from Catalogue) ---
    { commodity_id: 'IEHK_BASIC_MEDS', who_description: '(IEHK 2017, BASIC) MODULE, MEDICINES', item_category: 'Emergency Health Kits', unit_cost_usd: 239.34, avg_lead_time_days: 60 },
    { commodity_id: 'IEHK_BASIC_EQUIP', who_description: '(IEHK 2017, BASIC) MODULE, RENEWABLE AND EQUIPMENT', item_category: 'Emergency Health Kits', unit_cost_usd: 176.80, avg_lead_time_days: 75 },
    { commodity_id: 'IEHK_BASIC_MALARIA', who_description: '(IEHK 2017, BASIC) MODULE, MALARIA', item_category: 'Emergency Health Kits', unit_cost_usd: 669.83, avg_lead_time_days: 60 },
    { commodity_id: 'CHOLERA_KIT_CENTRAL_DRUGS', who_description: '(kit cholera central) MODULE, DRUGS (1.1)', item_category: 'Emergency Health Kits', unit_cost_usd: 1502.78, avg_lead_time_days: 45 },
    { commodity_id: 'CHOLERA_KIT_CENTRAL_EQUIP', who_description: '(kit cholera central) MODULE, EQUIPMENT (1.3)', item_category: 'Emergency Health Kits', unit_cost_usd: 251.36, avg_lead_time_days: 50 },
    { commodity_id: 'CHOLERA_KIT_CENTRAL_RENEW', who_description: '(kit cholera central) MODULE, RENEWABLE SUPPLIES (1.2)', item_category: 'Emergency Health Kits', unit_cost_usd: 792.58, avg_lead_time_days: 30 },
    { commodity_id: 'CHOLERA_KIT_PERIPHERY_DRUGS', who_description: '(kit cholera periphery) MODULE, DRUGS (2.1)', item_category: 'Emergency Health Kits', unit_cost_usd: 811.02, avg_lead_time_days: 45 },
    { commodity_id: 'CHOLERA_KIT_PERIPHERY_EQUIP', who_description: '(kit cholera periphery) MODULE, EQUIPMENT (2.3)', item_category: 'Emergency Health Kits', unit_cost_usd: 199.01, avg_lead_time_days: 50 },
    { commodity_id: 'CHOLERA_KIT_PERIPHERY_RENEW', who_description: '(kit cholera periphery) MODULE, RENEWABLE SUPPLIES (2.2)', item_category: 'Emergency Health Kits', unit_cost_usd: 711.47, avg_lead_time_days: 30 },
    { commodity_id: 'CHOLERA_KIT_COMMUNITY_DRUGS', who_description: '(kit cholera community) MODULE, DRUGS (3.1)', item_category: 'Emergency Health Kits', unit_cost_usd: 101.90, avg_lead_time_days: 40 },
    { commodity_id: 'CHOLERA_KIT_COMMUNITY_CARE', who_description: '(kit cholera community) MODULE, ORP COMMUNITY BASED CARE (3.2)', item_category: 'Emergency Health Kits', unit_cost_usd: 267.41, avg_lead_time_days: 30 },

    // --- Lab & Diagnostics ---
    { commodity_id: 'KIT_CHOLERA_INVESTIGATION', who_description: 'KIT, CHOLERA INVESTIGATION (5), complete', item_category: 'Lab & Diagnostics', unit_cost_usd: 800.28, avg_lead_time_days: 25 },
    { commodity_id: 'RDT_CHOLERA_SD_BIOLINE', who_description: 'RDT CHOLERA (SD Bioline 44FK30), Ag, stool, w/acc., kit-20', item_category: 'Lab & Diagnostics', unit_cost_usd: 41.80, avg_lead_time_days: 30 },
    
    // --- PPE & Mortuary (Relevant for both Cholera and Ebola) ---
    { commodity_id: 'BODY_BAG_ADULT', who_description: 'BODY BAG, 8 handles, U-shaped zip, white, 400 microns, adult, 230 x 100 cm, box-5', item_category: 'PPE', unit_cost_usd: 91.61, avg_lead_time_days: 35 },
    { commodity_id: 'BODY_BAG_CHILD', who_description: 'BODY BAG, 4 handles, U-shaped zip, white, 400 microns, child, 150 x 100 cm, box-5', item_category: 'PPE', unit_cost_usd: 52.38, avg_lead_time_days: 35 },
    { commodity_id: 'COVERALL_TYVEK_L', who_description: 'COVERALL (Tyvek 800J), cat III, type 3/4/5/6, hooded, s.u., white, size L, pack-25', item_category: 'PPE', unit_cost_usd: 8.20 * 25, avg_lead_time_days: 45 },
    { commodity_id: 'GLOVES_SURGICAL_6_5', who_description: 'GLOVES, SURGICAL (Fitone), latex, pf, sterile, size 6.5, pair, case-500', item_category: 'PPE', unit_cost_usd: 124.21, avg_lead_time_days: 20 },
    
    // --- Field Support & Cold Chain ---
    { commodity_id: 'TENT_MULTIPURPOSE_48M', who_description: 'TENT MULTIPURPOSE (XPERT 48), 48m2, aluminium frame, groundsheet, w/acc', item_category: 'Field Support', unit_cost_usd: 2486.66, avg_lead_time_days: 90 },
    { commodity_id: 'ISOTHERMAL_BOX_16_8L', who_description: 'ISOTHERMAL BOX (Chilltherm-CTR17), 16.8L, int. dim. 30.5x25x22cm', item_category: 'Cold Chain', unit_cost_usd: 97.87, avg_lead_time_days: 28 },
    
    // --- Ebola-specific modules (Inferred for app functionality) ---
    { commodity_id: 'EBOLA_KIT_TREATMENT_PPE', who_description: '(kit ebola treatment) MODULE, PPE', item_category: 'Emergency Health Kits', unit_cost_usd: 4500.00, avg_lead_time_days: 60 },
    { commodity_id: 'EBOLA_KIT_BURIAL_SDB', who_description: '(kit ebola burial) MODULE, SAFE BURIAL', item_category: 'Emergency Health Kits', unit_cost_usd: 800.00, avg_lead_time_days: 50 },
    { commodity_id: 'EBOLA_KIT_TREATMENT_MEDS', who_description: '(kit ebola treatment) MODULE, MEDICINES', item_category: 'Emergency Health Kits', unit_cost_usd: 3200.00, avg_lead_time_days: 70 },
];

// This now maps the abstract response type to the specific warehouse modules needed.
export const BRIDGE_KIT_CONTENTS: KitContent[] = [
    // --- Cholera Response Composition ---
    { kit_code: "cholera_central", commodity_id: "CHOLERA_KIT_CENTRAL_DRUGS", quantity_per_kit: 1 },
    { kit_code: "cholera_central", commodity_id: "CHOLERA_KIT_CENTRAL_EQUIP", quantity_per_kit: 1 },
    { kit_code: "cholera_central", commodity_id: "CHOLERA_KIT_CENTRAL_RENEW", quantity_per_kit: 1 },
    
    { kit_code: "cholera_periphery", commodity_id: "CHOLERA_KIT_PERIPHERY_DRUGS", quantity_per_kit: 1 },
    { kit_code: "cholera_periphery", commodity_id: "CHOLERA_KIT_PERIPHERY_EQUIP", quantity_per_kit: 1 },
    { kit_code: "cholera_periphery", commodity_id: "CHOLERA_KIT_PERIPHERY_RENEW", quantity_per_kit: 1 },

    { kit_code: "cholera_community", commodity_id: "CHOLERA_KIT_COMMUNITY_DRUGS", quantity_per_kit: 1 },
    { kit_code: "cholera_community", commodity_id: "CHOLERA_KIT_COMMUNITY_CARE", quantity_per_kit: 1 },

    // --- Ebola Response Composition ---
    { kit_code: "ebola_unit", commodity_id: "EBOLA_KIT_TREATMENT_PPE", quantity_per_kit: 1 },
    { kit_code: "ebola_unit", commodity_id: "EBOLA_KIT_TREATMENT_MEDS", quantity_per_kit: 1 },
    { kit_code: "ebola_unit", commodity_id: "ISOTHERMAL_BOX_16_8L", quantity_per_kit: 5 }, // For samples

    { kit_code: "ebola_sdb", commodity_id: "EBOLA_KIT_BURIAL_SDB", quantity_per_kit: 1 },
    { kit_code: "ebola_sdb", commodity_id: "BODY_BAG_ADULT", quantity_per_kit: 2 }, // box of 5
];

// Replaced with data from the new Warehouse Inventory Snapshot
export const FACT_INVENTORY: Inventory[] = [
    { commodity_id: 'IEHK_BASIC_MALARIA', stock_on_hand: 75, quantity_in_pipeline: 22 },
    { commodity_id: 'IEHK_BASIC_EQUIP', stock_on_hand: 143, quantity_in_pipeline: 30 },
    { commodity_id: 'IEHK_BASIC_MEDS', stock_on_hand: 100, quantity_in_pipeline: 30 },
    { commodity_id: 'CHOLERA_KIT_CENTRAL_DRUGS', stock_on_hand: 22, quantity_in_pipeline: 27 },
    { commodity_id: 'CHOLERA_KIT_CENTRAL_EQUIP', stock_on_hand: 4, quantity_in_pipeline: 13 },
    { commodity_id: 'CHOLERA_KIT_CENTRAL_RENEW', stock_on_hand: 15, quantity_in_pipeline: 22 },
    { commodity_id: 'CHOLERA_KIT_COMMUNITY_DRUGS', stock_on_hand: 67, quantity_in_pipeline: 70 },
    { commodity_id: 'CHOLERA_KIT_COMMUNITY_CARE', stock_on_hand: 4, quantity_in_pipeline: 50 },
    { commodity_id: 'CHOLERA_KIT_PERIPHERY_DRUGS', stock_on_hand: 21, quantity_in_pipeline: 31 },
    { commodity_id: 'CHOLERA_KIT_PERIPHERY_RENEW', stock_on_hand: 16, quantity_in_pipeline: 18 },
    { commodity_id: 'CHOLERA_KIT_PERIPHERY_EQUIP', stock_on_hand: 2, quantity_in_pipeline: 11 },
    { commodity_id: 'RDT_CHOLERA_SD_BIOLINE', stock_on_hand: 396, quantity_in_pipeline: 0 },
    { commodity_id: 'BODY_BAG_ADULT', stock_on_hand: 81, quantity_in_pipeline: 0 },
    { commodity_id: 'COVERALL_TYVEK_L', stock_on_hand: 0, quantity_in_pipeline: 0 },
    { commodity_id: 'EBOLA_KIT_TREATMENT_PPE', stock_on_hand: 10, quantity_in_pipeline: 50 },
    { commodity_id: 'EBOLA_KIT_BURIAL_SDB', stock_on_hand: 25, quantity_in_pipeline: 10 },
];


const generateShipmentHistory = (country: Country): Shipment[] => {
    const history: Shipment[] = [];
    const baseDate = new Date();
    const highRisk = country.priority === 1;

    history.push({
        id: `SHP-${country.iso}-001`,
        commodity_id: 'CHOLERA_KIT_PERIPHERY_DRUGS',
        quantity: highRisk ? 25 : 10,
        status: 'Delivered',
        dispatch_date: new Date(baseDate.getTime() - 30 * 24 * 3600 * 1000),
        eta: new Date(baseDate.getTime() - 15 * 24 * 3600 * 1000),
        hazard: 'cholera'
    });

    if (highRisk) {
         history.push({
            id: `SHP-${country.iso}-002`,
            commodity_id: 'CHOLERA_KIT_CENTRAL_DRUGS',
            quantity: 15,
            status: 'In Transit',
            dispatch_date: new Date(baseDate.getTime() - 10 * 24 * 3600 * 1000),
            eta: new Date(baseDate.getTime() + 11 * 24 * 3600 * 1000),
            hazard: 'cholera'
        });
        
        if (country.iso === 'COD' || country.iso === 'SSD') {
            history.push({
                id: `SHP-${country.iso}-003`,
                commodity_id: 'EBOLA_KIT_TREATMENT_PPE',
                quantity: 30,
                status: 'Pending',
                dispatch_date: new Date(baseDate.getTime() + 2 * 24 * 3600 * 1000),
                eta: new Date(baseDate.getTime() + 47 * 24 * 3600 * 1000),
                hazard: 'ebola'
            });
        }
    }
     return history;
}


export const getShipmentHistoryForCountry = (country: Country): Shipment[] => {
    return generateShipmentHistory(country);
}

