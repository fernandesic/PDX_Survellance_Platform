// @ts-nocheck
import type { Signal } from '../types';

/**
 * ReliefWeb API v1 was deprecated (410 Gone) as of 2025.
 * This service is disabled until ReliefWeb API v2 is integrated.
 * All live signals now come from: Sentinel DB, WHO DON, NASA EONET, GDELT, AllAfrica.
 */
export const fetchReliefWebReports = async (): Promise<Signal[]> => {
    return [];
};
