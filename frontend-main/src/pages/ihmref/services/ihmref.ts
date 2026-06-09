import { apiGet } from "@/lib/api";
import type { IhmrefCategoryResponse, IhmrefCountryIncident, IhmrefCountryResponse, IhmrefData, IhmrefDataSummary, IhmrefDataSummaryResponse } from "@/pages/ihmref/types/ihmref";

export const ihmref = {
    categories: async (): Promise<IhmrefCategoryResponse> => {
        return await apiGet(`/ihmref/categories`);
    },
    category_summary: async (category: string): Promise<IhmrefDataSummaryResponse> => {
        return await apiGet(`/ihmref/category/${category}/summary`)
    },
    summary: async (): Promise<IhmrefDataSummary[]> => {
        return await apiGet(`/ihmref/summary`)
    },
    data: async (category: string, year?: string): Promise<IhmrefData[]> => {
        return await apiGet(`/ihmref/category/${category}/data?year=${year}`)
    },
    countries: async(): Promise<IhmrefCountryResponse> => {
        return await apiGet(`/ihmref/countries`)
    },
    country_incident: async(country: string): Promise<IhmrefCountryIncident[]> => {
        return await apiGet(`/ihmref/country/incident?country=${country}`)
    }
};