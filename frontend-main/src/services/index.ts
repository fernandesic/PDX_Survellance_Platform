import { apiPost, apiGet } from "@/lib/api";
import type { AlertResponse, NewsResponse, OverviewResponse } from "@/types";

export const service = {
    overview: async (refresh?: boolean): Promise<OverviewResponse> => {
        return await apiGet<OverviewResponse>(`/account/overview${refresh ? '?refresh=1' : ''}`);
    },
    news: async (): Promise<NewsResponse> => {
        return await apiGet<NewsResponse>('/account/news')
    },
    alert: {
        list: async (page: number, page_size: number, severity: string, status: string, category: string, search: string): Promise<AlertResponse> => {
            return await apiGet<AlertResponse>(`/account/alerts?page=${page}&page_size=${page_size}&severity=${severity}&status=${status}&category=${category}&search=${search}`)
        },
        create: async (data: Record<string, unknown>): Promise<void> => {
            return await apiPost<void>('/account/alerts', data)
        },
        resolve: async (id: string | number): Promise<void> => {
            return await apiPost<void>(`/account/alert/${id}/resolve`)
        },
        acknowledge: async (id: string | number): Promise<void> => {
            return await apiPost<void>(`/account/alert/${id}/acknowledge`)
        }
    }
};