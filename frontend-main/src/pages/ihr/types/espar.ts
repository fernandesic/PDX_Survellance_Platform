import type { BaseResponse } from "@/types";

interface CapacityAverage {
    [key: string]: number;
}

export interface EsparSummaryResponse extends BaseResponse<{
    filters: {
        country: string;
        year: string;
        countries: string[];
        years: string[];
    };
    capacity_summary: { category: string; value: string }[];
    capacity_average: CapacityAverage;
    capacity_average_named: CapacityAverage;
    overall: {
        value: number;
        change: number;
        prev_year: number;
    }
}> { }

export type CountryScoresType = Record<string, Record<string, number>>;

export interface EsparComparisonResponse extends BaseResponse<{
    categories: string[],
    country_scores: CountryScoresType;
}> { }

export interface HumanitarianComparisonResponse extends BaseResponse<{
    years: string[];
    humanitarian_scores: number[];
    non_humanitarian_scores: number[];
    global_scores: number[];
    afro_scores: number[];
    humanitarian_count: number;
}> { }