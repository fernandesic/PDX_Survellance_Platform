import type { PAMILocation, PAMIData } from "@/pages/pami/types/pami";
import { logger } from "@/utils/logger";
import { apiGet } from "@/lib/api";

let cachedData: PAMIData | null = null;
let loadingPromise: Promise<PAMIData> | null = null;

export const pami = {
    getData: async (): Promise<PAMIData> => {
        if (cachedData) {
            return cachedData;
        }

        if (loadingPromise) {
            return loadingPromise;
        }

        loadingPromise = (async () => {
            try {
                const rawData: any[] = await apiGet('/pami/');

                // Map backend data to frontend type
                const locations: PAMILocation[] = rawData.map((item) => ({
                    id: `pami-${item.id}`,
                    country: item.country,
                    province: item.province || '',
                    district: item.district || '',
                    priorityIndex: item.priority_index,
                    risk: item.risk_level || '',
                    latitude: item.additional_data?.latitude ? parseFloat(item.additional_data.latitude) : undefined,
                    longitude: item.additional_data?.longitude ? parseFloat(item.additional_data.longitude) : undefined,
                    wardNumber: item.additional_data?.['WARDNUMBER *'] || item.additional_data?.wardNumber || '',
                }));

                // Extract unique countries
                const countries = Array.from(new Set(locations.map(loc => loc.country)));

                cachedData = {
                    locations,
                    totalLocations: locations.length,
                    countries,
                };

                logger.log(`Total PAMI locations loaded from API: ${locations.length}`);
                logger.log(`Countries: ${countries.join(', ')}`);

                return cachedData;
            } catch (error) {
                logger.error('Error loading PAMI data from backend:', error);
                // Fallback to empty state
                return {
                    locations: [],
                    totalLocations: 0,
                    countries: [],
                };
            } finally {
                loadingPromise = null;
            }
        })();

        return loadingPromise;
    },
};
