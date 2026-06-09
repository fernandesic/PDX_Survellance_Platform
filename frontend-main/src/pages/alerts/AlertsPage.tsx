import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { AlertsView } from './AlertsView';
import type { Signal, AutoDetection, Incident } from './types';
import { fetchRegionalSignals } from './services/azureService';
import { fetchAutoDetections } from './services/backendService';
import { fetchIncidents } from './services/incidentService';
import { fetchDiseases, fetchSourceCredibility, fetchIHRSummary, fetchSignalStats } from './services/sentinelService';
import { useTheme } from '@/contexts/ThemeContext';
import { useOutbreakDetection } from '@/hooks/useOutbreakDetection';
import { logger } from "@/utils/logger";

/** Active filter shape shared between AlertsPage ↔ AdvancedFilters */
export interface ActiveFilters {
    priorities: string[];   // ['P1','P2'] etc.
    countries: string[];    // ISO3 codes ['NGA','KEN']
    diseases: string[];     // disease names ['Cholera','Measles']
    search: string;
    dateFrom: string;
    dateTo: string;
}

const EMPTY_FILTERS: ActiveFilters = {
    priorities: [],
    countries: [],
    diseases: [],
    search: '',
    dateFrom: '',
    dateTo: '',
};

const LIVE_REFRESH_MS = 15000; // 15 seconds auto-refresh

const COUNTRY_REGION: Record<string, string> = {
    'DZA': 'North', 'TUN': 'North', 'LBY': 'North', 'MAR': 'North',
    'BEN': 'West', 'BFA': 'West', 'CPV': 'West', 'CIV': 'West', 'GMB': 'West',
    'GHA': 'West', 'GIN': 'West', 'GNB': 'West', 'LBR': 'West', 'MLI': 'West',
    'MRT': 'West', 'NER': 'West', 'NGA': 'West', 'SEN': 'West', 'SLE': 'West', 'TGO': 'West',
    'CMR': 'Central', 'CAF': 'Central', 'TCD': 'Central', 'COG': 'Central', 'COD': 'Central',
    'GNQ': 'Central', 'GAB': 'Central', 'STP': 'Central',
    'BDI': 'East', 'COM': 'East', 'ERI': 'East', 'ETH': 'East', 'KEN': 'East',
    'MDG': 'East', 'MUS': 'East', 'RWA': 'East', 'SYC': 'East', 'SSD': 'East',
    'TZA': 'East', 'UGA': 'East',
    'AGO': 'Southern', 'BWA': 'Southern', 'LSO': 'Southern', 'MWI': 'Southern',
    'MOZ': 'Southern', 'NAM': 'Southern', 'ZAF': 'Southern', 'SWZ': 'Southern',
    'ZMB': 'Southern', 'ZWE': 'Southern',
};

const AFRO_ISOS = [
    'DZA', 'AGO', 'BEN', 'BWA', 'BFA', 'BDI', 'CPV', 'CMR', 'CAF', 'TCD', 'COM', 'COG', 'COD', 'CIV', 'DJI', 'EGY', 'GNQ', 'ERI', 'ETH', 'GAB', 'GMB', 'GHA', 'GIN', 'GNB', 'KEN', 'LSO', 'LBR', 'LBY', 'MDG', 'MWI', 'MLI', 'MRT', 'MUS', 'MAR', 'MOZ', 'NAM', 'NER', 'NGA', 'RWA', 'STP', 'SEN', 'SYC', 'SLE', 'SOM', 'ZAF', 'SSD', 'SDN', 'SWZ', 'TZA', 'TGO', 'TUN', 'UGA', 'ZMB', 'ZWE'
];

export default function AlertsPage() {
    const { theme } = useTheme();
    const isLight = theme === 'light';
    const [selectedCountry, setSelectedCountry] = useState('NGA'); // Focus on Nigeria for heatwave demo
    const [showSitRep, setShowSitRep] = useState(false);
    const [signals, setSignals] = useState<Signal[]>([]);
    const [incidents, setIncidents] = useState<Incident[]>([]);
    const [detections, setDetections] = useState<AutoDetection[]>([]);
    const [loading, setLoading] = useState(false);
    const [activeSignal, setActiveSignal] = useState<Signal | null>(null);
    const [activeIncident, setActiveIncident] = useState<Incident | null>(null);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [isRateLimited, setIsRateLimited] = useState(false);
    const [isControlCenterOpen, setIsControlCenterOpen] = useState(false);
    const [isIncidentModalOpen, setIsIncidentModalOpen] = useState(false);

    const [diseaseDb, setDiseaseDb] = useState<any[]>([]);
    const [sourcesDb, setSourcesDb] = useState<any[]>([]);
    const [ihrSummary, setIhrSummary] = useState<any[]>([]);
    const [statsData, setStatsData] = useState<any>(null);
    const [activeFilters, setActiveFilters] = useState<ActiveFilters>(EMPTY_FILTERS);
    const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
    const filtersRef = useRef<ActiveFilters>(EMPTY_FILTERS);

    // Keep ref in sync so interval callback always has latest filters
    useEffect(() => { filtersRef.current = activeFilters; }, [activeFilters]);

    const loadAllIntelligence = useCallback(async (location: string, isSilent = false, filters?: ActiveFilters) => {
        // Skip when tab is hidden (save bandwidth)
        if (isSilent && typeof document !== 'undefined' && document.visibilityState === 'hidden') return;

        if (!isSilent) setLoading(true);
        setErrorMsg(null);
        setIsRateLimited(false);

        const f = filters || filtersRef.current;

        try {
            const [regionalSignals, bDetections, bIncidents] = await Promise.all([
                fetchRegionalSignals().catch(() => []),
                fetchAutoDetections().catch(() => []),
                fetchIncidents().catch(() => [])
            ]);

            const AFRO_NAMES = [
                'ALGERIA', 'ANGOLA', 'BENIN', 'BOTSWANA', 'BURKINA FASO', 'BURUNDI',
                'CABO VERDE', 'CAMEROON', 'CENTRAL AFRICAN REPUBLIC', 'CHAD', 'COMOROS',
                'CONGO', 'DEMOCRATIC REPUBLIC OF THE CONGO', 'COTE D\'IVOIRE', 'DJIBOUTI',
                'EGYPT', 'EQUATORIAL GUINEA', 'ERITREA', 'ETHIOPIA', 'GABON', 'GAMBIA',
                'GHANA', 'GUINEA', 'GUINEA-BISSAU', 'KENYA', 'LESOTHO', 'LIBERIA', 'LIBYA',
                'MADAGASCAR', 'MALAWI', 'MALI', 'MAURITANIA', 'MAURITIUS', 'MOROCCO',
                'MOZAMBIQUE', 'NAMIBIA', 'NIGER', 'NIGERIA', 'RWANDA',
                'SAO TOME AND PRINCIPE', 'SENEGAL', 'SEYCHELLES', 'SIERRA LEONE', 'SOMALIA',
                'SOUTH AFRICA', 'SOUTH SUDAN', 'SUDAN', 'ESWATINI', 'TANZANIA', 'TOGO',
                'TUNISIA', 'UGANDA', 'ZAMBIA', 'ZIMBABWE', 'AFRO REGION', 'AFRICA'
            ];

            const isAfro = (item: any) => {
                const countryStr = typeof item.location === 'string' ? item.location : '';
                const countryName = (item.location?.country || item.country || countryStr || '').toUpperCase();
                const isoCode = (item.location?.iso3 || item.location?.country_iso || item.iso3 || '').toUpperCase();

                if (AFRO_ISOS.includes(isoCode)) return true;
                if (isoCode === 'AFR') return true;
                return AFRO_NAMES.includes(countryName);
            };

            let filteredSignals = (regionalSignals || []).filter(s => isAfro(s));
            const filteredDetections = (bDetections || []).filter(d => isAfro(d));
            const filteredIncidents = (bIncidents || []).filter(i => {
                const name = (i.country?.country || '').toUpperCase();
                return AFRO_NAMES.includes(name);
            });

            // ── Apply active filters on signals ──
            if (f.priorities.length > 0) {
                filteredSignals = filteredSignals.filter(s =>
                    f.priorities.includes(s.level || '') || f.priorities.includes(s.priority || '')
                );
            }
            if (f.countries.length > 0) {
                filteredSignals = filteredSignals.filter(s => {
                    const iso = (s.location?.iso3 || s.location?.country_iso || '').toUpperCase();
                    return f.countries.includes(iso);
                });
            }
            if (f.diseases.length > 0) {
                filteredSignals = filteredSignals.filter(s => {
                    const dName = (s.disease_name || s.hazard?.name || '').toLowerCase();
                    return f.diseases.some(d => dName.includes(d.toLowerCase()));
                });
            }
            if (f.search) {
                const q = f.search.toLowerCase();
                filteredSignals = filteredSignals.filter(s => {
                    const text = [s.headline, s.summary, s.disease_name, s.location?.country, s.original_text].join(' ').toLowerCase();
                    return text.includes(q);
                });
            }
            if (f.dateFrom) {
                const from = new Date(f.dateFrom).getTime();
                filteredSignals = filteredSignals.filter(s => {
                    const t = new Date(s.created_at || s.publishedAt || 0).getTime();
                    return t >= from;
                });
            }
            if (f.dateTo) {
                const to = new Date(f.dateTo).getTime() + 86400000; // end of day
                filteredSignals = filteredSignals.filter(s => {
                    const t = new Date(s.created_at || s.publishedAt || 0).getTime();
                    return t <= to;
                });
            }

            setSignals(filteredSignals);
            setDetections(filteredDetections);
            setIncidents(filteredIncidents);
            setLastRefreshed(new Date());

        } catch (error: any) {
            logger.error("Watchtower Surveillance Outage:", error);
            setSignals([]);
            setDetections([]);
        } finally {
            if (!isSilent) setLoading(false);
        }
    }, []);

    // Initial load + auto-refresh every 15s
    useEffect(() => {
        loadAllIntelligence(selectedCountry);

        const interval = setInterval(() => {
            loadAllIntelligence(selectedCountry, true);
        }, LIVE_REFRESH_MS);

        return () => clearInterval(interval);
    }, [selectedCountry, loadAllIntelligence]);

    // Re-fetch when filters change
    useEffect(() => {
        loadAllIntelligence(selectedCountry, true, activeFilters);
    }, [activeFilters, selectedCountry, loadAllIntelligence]);

    // Handle filter change from AdvancedFilters
    const handleFilterChange = useCallback((filters: ActiveFilters) => {
        setActiveFilters(filters);
    }, []);

    useEffect(() => {
        const loadExtraData = async () => {
            try {
                const results = await Promise.allSettled([
                    fetchDiseases().catch(() => []),
                    fetchSourceCredibility().catch(() => []),
                    fetchIHRSummary().catch(() => []),
                ]);
                setDiseaseDb(results[0].status === 'fulfilled' ? results[0].value : []);
                setSourcesDb(results[1].status === 'fulfilled' ? results[1].value : []);
                setIhrSummary(results[2].status === 'fulfilled' ? results[2].value : []);
            } catch { }
        };
        loadExtraData();
    }, []);

    useEffect(() => {
        const fetchStats = async () => {
            if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
            const data = await fetchSignalStats();
            setStatsData(data);
        };
        fetchStats();
        const interval = setInterval(fetchStats, 15000); // 15s — real-time stats
        return () => clearInterval(interval);
    }, []);

    const stats = useMemo(() => {
        const confirmed = signals.filter(s => s.status === 'validated').length;
        const critical = signals.filter(s => s.level === 'P1' || s.priority === 'P1').length;
        const pending = signals.filter(s => s.status === 'new' || s.status === 'triaged').length;
        const totalAggregate = signals.length;

        const priorityStats = {
            P1: signals.filter(s => s.level === 'P1').length,
            P2: signals.filter(s => s.level === 'P2').length,
            P3: signals.filter(s => s.level === 'P3').length,
            P4: signals.filter(s => s.level === 'P4').length
        };

        return {
            cards: [
                {
                    label: 'SYS1// CONFIRMED',
                    val: confirmed.toLocaleString(),
                    icon: "ShieldCheck",
                    status: 'success'
                },
                {
                    label: 'LIVE// CRITICAL (AFRO)',
                    val: critical.toLocaleString(),
                    icon: "AlertTriangle",
                    status: 'warning',
                    pulse: true
                },
                {
                    label: 'SYS1// PENDING TRIAGE',
                    val: pending.toLocaleString(),
                    icon: "Clock",
                    status: 'neutral'
                },
                {
                    label: 'FILTER:// TOTAL INTELLIGENCE',
                    val: totalAggregate.toLocaleString(),
                    icon: "Radio",
                    status: 'info'
                }
            ],
            priorityStats
        };
    }, [signals]);

    const clusters = useOutbreakDetection(signals);

    return (
        <AlertsView
            isLight={isLight}
            selectedCountry={selectedCountry}
            setSelectedCountry={setSelectedCountry}
            showSitRep={showSitRep}
            setShowSitRep={setShowSitRep}
            signals={signals}
            incidents={incidents}
            detections={detections}
            setDetections={setDetections}
            loading={loading}
            activeSignal={activeSignal}
            setActiveSignal={setActiveSignal}
            activeIncident={activeIncident}
            setActiveIncident={setActiveIncident}
            errorMsg={errorMsg}
            isRateLimited={isRateLimited}
            isControlCenterOpen={isControlCenterOpen}
            setIsControlCenterOpen={setIsControlCenterOpen}
            isIncidentModalOpen={isIncidentModalOpen}
            setIsIncidentModalOpen={setIsIncidentModalOpen}
            diseaseDb={diseaseDb}
            sourcesDb={sourcesDb}
            ihrSummary={ihrSummary}
            statsData={statsData}
            stats={stats}
            clusters={clusters}
            loadAllIntelligence={loadAllIntelligence}
            activeFilters={activeFilters}
            onFilterChange={handleFilterChange}
            lastRefreshed={lastRefreshed}
        />
    );
}
