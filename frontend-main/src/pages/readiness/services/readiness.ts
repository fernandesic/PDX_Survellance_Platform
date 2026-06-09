import { apiGet } from "@/lib/api";
import type { RegionScore, ReadinessListResponse } from "@/pages/readiness/types/readiness";
import { normalizeText } from "@/utils";

export const readiness = {
    summary: async (page: any, page_size: any, tab: any, country: any): Promise<ReadinessListResponse> => {
        return await apiGet<ReadinessListResponse>(`/readiness/summary/${normalizeText(tab)}?page=${page}&page_size=${page_size}&readiness=${tab}&country=${country}`);
    },
    heatmap: async (readiness_type: string): Promise<RegionScore[]> => {
        return await apiGet<RegionScore[]>(`/readiness/heatmap?readiness=${readiness_type}`)
    },
    categoryAverages: async (readiness_type: string): Promise<Record<string, number>> => {
        return await apiGet<Record<string, number>>(`/readiness/category-averages?readiness=${readiness_type}`)
    },
    hazardMonitor: async (country?: string): Promise<any> => {
        const query = country ? `?country=${country}` : '';
        return await apiGet<any>(`/readiness/hazard-monitor${query}`)
    }
};