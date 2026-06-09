import { useQuery } from '@tanstack/react-query';
import { service } from '@/services';
import { QUERY_KEYS } from './queryKeys';

export const fetchOverview = async (refresh: boolean = false) => {
    const response = await service.overview(refresh);
    return response.data;
};

export function useOverviewQuery(refresh: boolean = false) {
    return useQuery({
        queryKey: [...QUERY_KEYS.overview, refresh],
        queryFn: () => fetchOverview(refresh),
    });
}
