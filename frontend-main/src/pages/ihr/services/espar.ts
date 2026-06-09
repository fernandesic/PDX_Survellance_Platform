import { apiGet } from "@/lib/api";
import type { EsparComparisonResponse, EsparSummaryResponse, HumanitarianComparisonResponse } from "@/pages/ihr/types/espar";

export const espar = {
    summary: async (country: any, year: any): Promise<EsparSummaryResponse> => {
        return await apiGet<EsparSummaryResponse>(`/espar/summary?country=${country}&year=${year}`);
    },
    comparison: async (countries: { country: string; year: any }[]): Promise<EsparComparisonResponse> => {
        return await apiGet<EsparComparisonResponse>(`/espar/comparison?countries=${JSON.stringify(countries)}`);
    },
    humanitarianComparison: async (): Promise<HumanitarianComparisonResponse> => {
        return await apiGet<HumanitarianComparisonResponse>(`/espar/humanitarian-comparison`);
    },
};  