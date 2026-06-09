import { apiGet } from "@/lib/api";
import type {
    CHWSummary, CHWCountry, CHWCountryDetail,
    CHWRegion, CHWRegionDetail, CHWDistrict,
    CHWMapCountry, WorkerTypeByCountry,
    ChwListResponse, ChwPipelineResponse,
    WhonghubDatasetItem, WhonghubDataEntry,
    CHWFieldReport,
} from "@/pages/chw/types/chw";

const BASE = '/chwfolder';

export const chwService = {
    // ─── New Dashboard API ───

    /** Global summary KPIs */
    summary: async (): Promise<CHWSummary> => {
        return await apiGet<CHWSummary>(`${BASE}/summary/`);
    },

    /** List all countries */
    countries: async (search?: string): Promise<CHWCountry[]> => {
        const params = search ? `?search=${encodeURIComponent(search)}` : '';
        return await apiGet<CHWCountry[]>(`${BASE}/countries/${params}`);
    },

    /** Country detail with regions and worker types */
    countryDetail: async (id: number): Promise<CHWCountryDetail> => {
        return await apiGet<CHWCountryDetail>(`${BASE}/countries/${id}/`);
    },

    /** Regions for a country */
    countryRegions: async (countryId: number): Promise<CHWRegion[]> => {
        return await apiGet<CHWRegion[]>(`${BASE}/countries/${countryId}/regions/`);
    },

    /** Districts for a country */
    countryDistricts: async (countryId: number, search?: string): Promise<CHWDistrict[]> => {
        const params = search ? `?search=${encodeURIComponent(search)}` : '';
        return await apiGet<CHWDistrict[]>(`${BASE}/countries/${countryId}/districts/${params}`);
    },

    /** Region detail with districts */
    regionDetail: async (id: number): Promise<CHWRegionDetail> => {
        return await apiGet<CHWRegionDetail>(`${BASE}/regions/${id}/`);
    },

    /** Map data (country choropleth) */
    mapData: async (): Promise<CHWMapCountry[]> => {
        return await apiGet<CHWMapCountry[]>(`${BASE}/map/`);
    },

    /** Map data for specific country (region level) */
    mapCountryData: async (countryId: number): Promise<CHWRegion[]> => {
        return await apiGet<CHWRegion[]>(`${BASE}/map/${countryId}/`);
    },

    /** Worker types aggregated by country */
    workerTypes: async (countryId?: number): Promise<WorkerTypeByCountry[]> => {
        const params = countryId ? `?country_id=${countryId}` : '';
        return await apiGet<WorkerTypeByCountry[]>(`${BASE}/worker-types/${params}`);
    },

    /** Worker types for specific country by region */
    workerTypesCountry: async (countryId: number) => {
        return await apiGet(`${BASE}/worker-types/${countryId}/`);
    },

    // ─── Backward-compatible API ───

    list: async (page: number, page_size: number): Promise<ChwListResponse> => {
        return await apiGet<ChwListResponse>(`${BASE}/?page=${page}&page_size=${page_size}`);
    },

    pipeline: async (country: string): Promise<ChwPipelineResponse> => {
        return await apiGet<ChwPipelineResponse>(`${BASE}/pipeline/?country=${country}`);
    },

    // ─── Whonghub Proxy API ───
    getWhonghubDatasets: async (): Promise<WhonghubDatasetItem[]> => {
        return await apiGet<WhonghubDatasetItem[]>(`${BASE}/whonghub/proxy/`);
    },

    getWhonghubDatasetDetail: async (id: number): Promise<WhonghubDataEntry[]> => {
        return await apiGet<WhonghubDataEntry[]>(`${BASE}/whonghub/proxy/${id}/`);
    },

    // ─── CHW Field Reports ───
    getFieldReports: async (): Promise<CHWFieldReport[]> => {
        return await apiGet<CHWFieldReport[]>(`${BASE}/field-reports/`);
    },
};

// Keep old export for backward compat
export const chw = chwService;