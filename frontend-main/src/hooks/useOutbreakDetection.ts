import { useMemo } from 'react';
import type { Signal } from '@/pages/alerts/types';

export interface OutbreakCluster {
    disease: string;
    country: string;
    iso3: string;
    count: number;
    signals: Signal[];
    firstDetected: string;
    lastDetected: string;
    urgency: 'high' | 'medium' | 'low';
}

export function useOutbreakDetection(signals: Signal[]) {
    const clusters = useMemo(() => {
        if (!signals || signals.length === 0) return [];

        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        // Group signals by Country + Disease
        const groupings: Record<string, Signal[]> = {};

        signals.forEach(signal => {
            const pubDate = new Date(signal.publishedAt || signal.created_at || Date.now());
            if (pubDate < sevenDaysAgo) return;

            const country = signal.location?.iso3 || signal.location?.country_iso || 'Unknown';
            const disease = (signal.hazard?.name || signal.disease_name || 'Unknown Health Threat').toLowerCase();

            // Skip generic news/hazards if they don't look like outbreaks
            if (disease.includes('monitoring') || disease.includes('report')) return;

            const key = `${country}|${disease}`;
            if (!groupings[key]) groupings[key] = [];
            groupings[key].push(signal);
        });

        // Convert to clusters if count >= 3
        const result: OutbreakCluster[] = [];

        Object.entries(groupings).forEach(([key, clusteredSignals]) => {
            if (clusteredSignals.length >= 3) {
                const [iso3, disease] = key.split('|');

                // Sort by date
                const sorted = [...clusteredSignals].sort((a, b) =>
                    new Date(a.publishedAt || a.created_at || 0).getTime() -
                    new Date(b.publishedAt || b.created_at || 0).getTime()
                );

                result.push({
                    disease: disease.toUpperCase(),
                    country: clusteredSignals[0].location?.country || iso3,
                    iso3: iso3,
                    count: clusteredSignals.length,
                    signals: clusteredSignals,
                    firstDetected: sorted[0].publishedAt || sorted[0].created_at || '',
                    lastDetected: sorted[sorted.length - 1].publishedAt || sorted[sorted.length - 1].created_at || '',
                    urgency: clusteredSignals.length > 5 ? 'high' : 'medium'
                });
            }
        });

        return result;
    }, [signals]);

    return clusters;
}
