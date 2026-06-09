import type { BaseResponse, PaginatedResponse } from "@/types";

export interface StardataSummaryResponse extends BaseResponse<{
    filters: {
        hazards: string[];
        hazard_types: string[];
        severities: string[];
        statuses: string[];
    };
    incident: {
        total: number;
        active: number;
        affected_country: number;
    }
}> { }


export interface StardataChartResponse extends BaseResponse<{
    filters: {
        countries: string[];
    };
    hazard_frequency: { name: string, value: string | number }[];
    severity_distribution: { name: string, value: string | number }[];
    status: { name: string, value: string | number }[];
}> { }


export interface StarDataType {
    id: number;
    key_on_table: string;
    n: string;
    country: string;
    level: string;
    year: string;
    start_date: string;
    end_date: string;
    subgroup_of_hazards: string;
    main_type_of_hazard: string;
    hazard: string;
    health_consequences: string;
    scale: string;
    geographical_area: string;
    exposure: string;
    frequency: string;
    seasonality: string;
    jan: string;
    feb: string;
    mar: string;
    apr: string;
    may: string;
    jun: string;
    jul: string;
    aug: string;
    sep: string;
    oct: string;
    nov: string;
    dec: string;
    likelihood: string;
    severity: string;
    vulnerability: string;
    vulnerability_details: string;
    coping_capacity: string;
    coping_capacity_details: string | null;
    governance_and_resouces: string;
    health_sector_capacity: string;
    non_health_sector_capcity: string;
    commuty_capacity: string;
    resources: string | null;
    impact: string;
    confidence_level: string;
    risk_level: string;
    risk_level_number: string;
    status: string;
}


export interface StardataListResponse extends PaginatedResponse<StarDataType[]> { }


export interface StardataMapCountry {
    id: number;
    country: string;
    lat: number;
    lng: number;
    severity: string;
    hazard_count: number;
    hazards: { name: string; severity: string }[];
    month: string;
}

export interface StardataMapResponse extends BaseResponse<{
    current_month: string;
    countries: StardataMapCountry[];
    total_countries: number;
}> { }


export interface UpcomingHazard {
    hazard: string;
    severity: string;
    month1_value: string;
    month2_value: string;
    month1_color: string;
    month2_color: string;
}

export interface UpcomingHazardsResponse extends BaseResponse<{
    month1: string;
    month2: string;
    month1_field: string;
    month2_field: string;
    hazards: UpcomingHazard[];
    total_hazards: number;
}> { }


export interface ActiveHazard {
    hazard: string;
    hazard_type: string;
    severity: string;
    severity_color: string;
    month_value: string;
    is_active: boolean;
    geographical_area: string;
}

export interface ActiveHazardsResponse extends BaseResponse<{
    current_month: string;
    month_field: string;
    hazards: ActiveHazard[];
    total_hazards: number;
    severity_counts: Record<string, number>;
}> { }