import { apiGet } from "@/lib/api";
import type {
    StardataChartResponse,
    StardataListResponse,
    StardataMapResponse,
    StardataSummaryResponse,
    UpcomingHazardsResponse,
    ActiveHazardsResponse
} from "@/pages/stardata/types/stardata";

export const stardata = {
    summary: async (hazard?: string, hazard_type?: string, severity?: string, status?: string, month?: string): Promise<StardataSummaryResponse> => {
        const params = new URLSearchParams();
        if (hazard) params.append('hazard', hazard);
        if (hazard_type) params.append('hazard_type', hazard_type);
        if (severity) params.append('severity', severity);
        if (status) params.append('status', status);
        if (month) params.append('month', month);

        const query = params.toString();
        return await apiGet<StardataSummaryResponse>(`/stardata/summary${query ? `?${query}` : ''}`);
    },

    charts: async (country?: string, month?: string): Promise<StardataChartResponse> => {
        const params = new URLSearchParams();
        if (country) params.append('country', country);
        if (month) params.append('month', month);

        const query = params.toString();
        return await apiGet<StardataChartResponse>(`/stardata/charts${query ? `?${query}` : ''}`);
    },

    list: async (page: number = 1, page_size: number = 20, severity?: string, country?: string, month?: string): Promise<StardataListResponse> => {
        const params = new URLSearchParams();
        params.append('page', String(page));
        params.append('page_size', String(page_size));
        if (severity) params.append('severity', severity);
        if (country) params.append('country', country);
        if (month) params.append('month', month);

        const query = params.toString();
        return await apiGet<StardataListResponse>(`/stardata/${query ? `?${query}` : ''}`);
    },

    map: async (severity?: string, month?: string, hazard?: string, hazardType?: string): Promise<StardataMapResponse> => {
        const params = new URLSearchParams();
        if (severity) params.append('severity', severity);
        if (month) params.append('month', month);
        if (hazard) params.append('hazard', hazard);
        if (hazardType) params.append('hazard_type', hazardType);

        const query = params.toString();
        return await apiGet<StardataMapResponse>(`/stardata/map${query ? `?${query}` : ''}`);
    },

    upcomingHazards: async (country?: string, month?: string): Promise<UpcomingHazardsResponse> => {
        const params = new URLSearchParams();
        if (country) params.append('country', country);
        if (month) params.append('month', month);

        const query = params.toString();
        return await apiGet<UpcomingHazardsResponse>(`/stardata/upcoming-hazards${query ? `?${query}` : ''}`);
    },

    activeHazards: async (country?: string, month?: string): Promise<ActiveHazardsResponse> => {
        const params = new URLSearchParams();
        if (country) params.append('country', country);
        if (month) params.append('month', month);

        const query = params.toString();
        return await apiGet<ActiveHazardsResponse>(`/stardata/active-hazards${query ? `?${query}` : ''}`);
    },

    rvfCandlestick: async (hazard?: string, country?: string, year?: string): Promise<any> => {
        const params = new URLSearchParams();
        if (hazard) params.append('hazard', hazard);
        if (country) params.append('country', country);
        if (year) params.append('year', year);
        
        const query = params.toString();
        return await apiGet<any>(`/stardata/rvf-candlestick${query ? `?${query}` : ''}`);
    },
    
    candlestickMetadata: async (): Promise<any> => {
        return await apiGet<any>('/stardata/candlestick-metadata');
    }
};
