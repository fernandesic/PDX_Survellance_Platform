import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { AFRO_COUNTRIES } from '@/constants/afroCountries';
import { getClimateDataWithAnomalies, calculateAnomalies, getTimeWindowDates, fetchHistoricalAnnualData } from '@/pages/climate/services/climateApi';
import { fetchRealTimeClimateDataBatch } from '@/pages/climate/services/openMeteoApi';
import { detectAllHazards } from '@/pages/climate/services/hazardDetection';
import { assessAllDiseaseRisks } from '@/pages/climate/services/diseaseRiskEngine';
import { calculateKPIs } from '@/utils/kpiUtils';
import { applyAllFilters } from '@/utils/filterUtils';
import type {
    Region,
    RegionClimateProfile,
    TimeWindowPreset,
    ClimateFilters
} from '@/pages/climate/types/climate';
import { DEFAULT_FILTERS } from '@/pages/climate/types/climate';
import { logger } from "@/utils/logger";

export function useClimateIntelligence() {
    const [selectedRegion, setSelectedRegion] = useState<Region | null>(AFRO_COUNTRIES.find(c => c.id === 'NGA') || null);
    const [timeWindow, setTimeWindow] = useState<TimeWindowPreset>('7days');
    const [filters, setFilters] = useState<ClimateFilters>(DEFAULT_FILTERS);
    const [loading, setLoading] = useState(false);
    const [regionProfiles, setRegionProfiles] = useState<Map<string, RegionClimateProfile>>(new Map());
    const profilesRef = useRef<Map<string, RegionClimateProfile>>(new Map());

    const regions = AFRO_COUNTRIES;

    useEffect(() => {
        if (!regions.length) return;
        let isMounted = true;

        async function loadClimateData() {
            setLoading(true);
            profilesRef.current.clear();
            setRegionProfiles(new Map());
            try {
                const newProfiles = new Map<string, RegionClimateProfile>();
                const isRealTime = timeWindow === 'today';

                let batchedData: Map<string, any> = new Map();
                if (isRealTime) {
                    logger.log('[Climate Intelligence] Pre-fetching batch real-time data...');
                    batchedData = await fetchRealTimeClimateDataBatch(regions);
                }

                const BATCH_SIZE = 10;

                for (let i = 0; i < regions.length; i += BATCH_SIZE) {
                    if (!isMounted) break;
                    const batch = regions.slice(i, i + BATCH_SIZE);

                    const batchResults = await Promise.all(
                        batch.map(async (region, index) => {
                            try {
                                let response;

                                if (isRealTime && batchedData.has(region.id)) {
                                    const data = batchedData.get(region.id);
                                    const currentData = [data];
                                    const baseline = [];
                                    const { fetchHistoricalBaseline } = await import('@/pages/climate/services/climateApi');
                                    const baselineData = await fetchHistoricalBaseline(region);

                                    response = {
                                        region,
                                        timeWindow: getTimeWindowDates(timeWindow),
                                        data: currentData,
                                        baseline: baselineData,
                                        success: true
                                    };

                                } else {
                                    response = await getClimateDataWithAnomalies(region, timeWindow);
                                }

                                const isMOZ = region.id === 'MOZ';
                                const anomalies = calculateAnomalies(response.data, response.baseline);
                                const hazards = detectAllHazards(response.data, anomalies, isMOZ);
                                const diseaseRisks = assessAllDiseaseRisks(response.data, anomalies, hazards);
                                const annualData = await fetchHistoricalAnnualData(region);

                                return {
                                    regionId: region.id,
                                    profile: {
                                        region,
                                        timeWindow: {
                                            start: response.timeWindow?.startDate || getTimeWindowDates(timeWindow).startDate,
                                            end: response.timeWindow?.endDate || getTimeWindowDates(timeWindow).endDate
                                        },
                                        currentData: response.data,
                                        anomalies,
                                        activeHazards: hazards,
                                        diseaseRisks,
                                        historicalAnnualData: annualData,
                                        convergingEvidence: {
                                            hasMediaSignal: region.id === 'MOZ',
                                            hasOfficialAlert: region.id === 'MOZ',
                                            pdxLinks: region.id === 'MOZ' ? ['https://reliefweb.int/report/mozambique/mozambique-floods-february-2026'] : []
                                        },
                                        exposureMetrics: {
                                            populationExposed: 0,
                                            exposureLevel: hazards.length > 2 ? 'HIGH' : hazards.length > 0 ? 'MEDIUM' : 'LOW' as const,
                                            healthFacilitiesInZone: 0
                                        }
                                    } as RegionClimateProfile
                                };
                            } catch (err) {
                                logger.error(`Error loading data for ${region.name}:`, err);
                                return null;
                            }
                        })
                    );

                    if (!isMounted) break;

                    batchResults.forEach(res => {
                        if (res) {
                            newProfiles.set(res.regionId, res.profile);
                            profilesRef.current.set(res.regionId, res.profile);
                        }
                    });

                    setRegionProfiles(new Map(profilesRef.current));
                }
            } finally {
                if (isMounted) setLoading(false);
            }
        }

        loadClimateData();

        return () => {
            isMounted = false;
        };
    }, [regions, timeWindow]);

    const filteredProfiles = useMemo(() =>
        applyAllFilters(regionProfiles, filters),
        [regionProfiles, filters]);

    const kpiMetrics = useMemo(() =>
        calculateKPIs(filteredProfiles),
        [filteredProfiles]);

    const selectedProfile = useMemo(() =>
        selectedRegion ? filteredProfiles.get(selectedRegion.id) : null,
        [selectedRegion, filteredProfiles]);

    const handleRegionClick = useCallback((region: Region) => {
        setSelectedRegion(region);
    }, []);

    const handleAlertClick = useCallback((regionId: string) => {
        const region = regions.find(r => r.id === regionId);
        if (region) setSelectedRegion(region);
    }, [regions]);

    return {
        regions,
        regionProfiles,
        filteredProfiles,
        selectedRegion,
        selectedProfile,
        kpiMetrics,
        loading,
        timeWindow,
        setTimeWindow,
        filters,
        setFilters,
        handleRegionClick,
        handleAlertClick,
        setSelectedRegion
    };
}
