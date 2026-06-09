import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { espar } from '@/pages/ihr/services/espar';
import { QUERY_KEYS } from './queryKeys';

export const fetchIHRData = async (country: string, year: string) => {
    const response = await espar.summary(country, year);
    return response.data;
};

export function useIHRQuery(country: string, year: string) {
    return useQuery({
        queryKey: [...QUERY_KEYS.ihrCapacities, country, year],
        queryFn: () => fetchIHRData(country, year),
        enabled: !!country && !!year,
        placeholderData: keepPreviousData,
    });
}
