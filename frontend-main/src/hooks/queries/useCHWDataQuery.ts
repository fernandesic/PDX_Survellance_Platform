import { useQuery } from '@tanstack/react-query';
import { chwService } from '@/pages/chw/services/chw';
import { service } from '@/services';
import { QUERY_KEYS } from './queryKeys';

export const fetchCHWData = async () => {
    const [sum, wt, overviewRes] = await Promise.all([
        chwService.summary(),
        chwService.workerTypes(),
        service.overview().catch(() => null),
    ]);
    
    let topRegions = undefined;
    if (overviewRes?.data?.chw?.top_region) {
        topRegions = overviewRes.data.chw.top_region.map((r: { region: string; percentage: number }) => {
            const parts = r.region.split(', ');
            return { region: parts[0], country: parts[parts.length - 1], chws: 0, percentage: r.percentage };
        });
    }

    return { sum, wt, topRegions };
};

export function useCHWDataQuery() {
    return useQuery({
        queryKey: QUERY_KEYS.chwStats,
        queryFn: fetchCHWData,
    });
}
