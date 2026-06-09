// @ts-nocheck
/**
 * AFRO Sentinel Watchtower - Frontend Service
 * Connects to Django backend /api/v1/sentinel/ endpoints
 */

import type { Signal } from '../types';
import { logger } from "@/utils/logger";

// Backend API base URL - uses proxy in vite.config or direct URL
const API_BASE = import.meta.env.VITE_BACKEND_URL?.replace(/\/$/, '') || 'http://localhost:8000';
const SENTINEL_API = `sentinel`; // api instance already prepends VITE_API_BASE_URL (which includes /api/v1)

import { api } from '@/lib/api';

/**
 * Convert a timestamp to a human-readable relative time string.
 * e.g. "2m ago", "3h ago", "1d ago"
 */
function getRelativeTime(dateStr: string | undefined): string {
    if (!dateStr) return 'Unknown';
    const now = Date.now();
    const then = new Date(dateStr).getTime();
    if (isNaN(then)) return 'Unknown';

    const diffMs = now - then;
    if (diffMs < 0) return 'Just now'; // future timestamp edge case

    const seconds = Math.floor(diffMs / 1000);
    if (seconds < 60) return `${seconds}s ago`;

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;

    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;

    const weeks = Math.floor(days / 7);
    if (weeks < 4) return `${weeks}w ago`;

    return new Date(dateStr).toLocaleDateString();
}

// Cache for reducing API calls — keyed by filter to support filtered queries
const SIGNAL_CACHE: Record<string, { data: Signal[]; timestamp: number }> = {};
const STATS_CACHE: { data: any | null; timestamp: number } = { data: null, timestamp: 0 };
const CACHE_TTL = 3000; // 3 seconds — aggressive for real-time feel

/**
 * Fetch all signals from Django backend with optional filters
 */
export async function fetchSignals(filters?: {
    priority?: string;
    status?: string;
    country?: string;
    disease?: string;
    limit?: number;
}): Promise<Signal[]> {
    const cacheKey = JSON.stringify(filters || {});

    // Return cached data if fresh (filter-aware)
    const cached = SIGNAL_CACHE[cacheKey];
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.data;
    }

    try {
        const params = new URLSearchParams();
        if (filters?.priority) params.append('priority', filters.priority);
        if (filters?.status) params.append('status', filters.status);
        if (filters?.country) params.append('location_country_iso', filters.country);
        if (filters?.disease) params.append('disease_category', filters.disease);

        const url = `${SENTINEL_API}/signals/?${params.toString()}`;
        const response = await api.get(url);
        const data = response.data;

        // Handle paginated response
        const signals = Array.isArray(data) ? data : (data.results || []);

        // Country centroids for fallback when lat/lng is 0,0
        const COUNTRY_CENTROIDS: Record<string, { lat: number, lng: number }> = {
            'NGA': { lat: 9.08, lng: 8.68 }, 'KEN': { lat: -0.02, lng: 37.91 },
            'ZAF': { lat: -30.56, lng: 22.94 }, 'ETH': { lat: 9.15, lng: 40.49 },
            'COD': { lat: -4.04, lng: 21.76 }, 'GHA': { lat: 7.95, lng: -1.02 },
            'TZA': { lat: -6.37, lng: 34.89 }, 'UGA': { lat: 1.37, lng: 32.29 },
            'RWA': { lat: -1.94, lng: 29.87 }, 'SEN': { lat: 14.50, lng: -14.45 },
            'MOZ': { lat: -18.67, lng: 35.53 }, 'ZMB': { lat: -13.13, lng: 27.85 },
            'ZWE': { lat: -19.02, lng: 29.15 }, 'MWI': { lat: -13.25, lng: 34.30 },
            'AGO': { lat: -11.20, lng: 17.87 }, 'CMR': { lat: 7.37, lng: 12.35 },
            'CIV': { lat: 7.54, lng: -5.55 }, 'MLI': { lat: 17.57, lng: -3.99 },
            'NER': { lat: 17.61, lng: 8.08 }, 'BFA': { lat: 12.24, lng: -1.56 },
            'DZA': { lat: 28.03, lng: 1.66 }, 'MAR': { lat: 31.79, lng: -7.09 },
            'TUN': { lat: 33.89, lng: 9.54 }, 'LBY': { lat: 26.34, lng: 17.23 },
            'SSD': { lat: 6.88, lng: 31.31 }, 'BEN': { lat: 9.31, lng: 2.32 },
            'BWA': { lat: -22.33, lng: 24.68 }, 'BDI': { lat: -3.37, lng: 29.92 },
            'CPV': { lat: 16.00, lng: -24.01 }, 'CAF': { lat: 6.61, lng: 20.94 },
            'TCD': { lat: 15.45, lng: 18.73 }, 'COM': { lat: -11.65, lng: 43.33 },
            'COG': { lat: -0.23, lng: 15.83 }, 'GNQ': { lat: 1.65, lng: 10.27 },
            'ERI': { lat: 15.18, lng: 39.78 }, 'GAB': { lat: -0.80, lng: 11.61 },
            'GMB': { lat: 13.44, lng: -15.31 }, 'GIN': { lat: 9.95, lng: -9.70 },
            'GNB': { lat: 11.80, lng: -15.18 }, 'LSO': { lat: -29.61, lng: 28.23 },
            'LBR': { lat: 6.43, lng: -9.43 }, 'MDG': { lat: -18.77, lng: 46.87 },
            'MRT': { lat: 21.01, lng: -10.94 }, 'MUS': { lat: -20.35, lng: 57.55 },
            'NAM': { lat: -22.96, lng: 18.49 }, 'STP': { lat: 0.19, lng: 6.61 },
            'SYC': { lat: -4.68, lng: 55.49 }, 'SLE': { lat: 8.46, lng: -11.78 },
            'SWZ': { lat: -26.52, lng: 31.47 }, 'TGO': { lat: 8.62, lng: 0.82 },
        };

        const AFRO_ISOS = new Set(Object.keys(COUNTRY_CENTROIDS));

        // Map Django model to frontend Signal type + AFRO Filter
        const mappedSignals: Signal[] = signals.filter((s: any) => {
            // Include if in Afro, OR if there's no ISO (don't drop data with missing metadata or global designations)
            return !s.location_country_iso || AFRO_ISOS.has(s.location_country_iso) || s.location_country_iso === 'Global';
        }).map((s: any) => {
            // Get coordinates, falling back to country centroid if lat/lng is 0,0
            const rawLat = parseFloat(s.location_lat || '0');
            const rawLng = parseFloat(s.location_lng || '0');
            const isZeroCoords = (rawLat === 0 && rawLng === 0) || (!s.location_lat && !s.location_lng);
            const centroid = COUNTRY_CENTROIDS[s.location_country_iso];
            const lat = isZeroCoords && centroid ? centroid.lat : rawLat;
            const lng = isZeroCoords && centroid ? centroid.lng : rawLng;

            // Build source info from source_display or individual fields
            const srcDisplay = s.source_display || {};
            const sourceName = srcDisplay.name || s.source_name || 'Intelligence Feed';
            const sourceUrl = srcDisplay.url || s.source_url;
            const sourceTier = srcDisplay.tier || s.source_tier || 2;

            // ── ENRICHMENT: Extract disease name from text when DB field is null ──
            const textLower = (s.original_text || '').toLowerCase();
            let enrichedDisease = s.disease_name;
            if (!enrichedDisease || enrichedDisease === 'unknown') {
                const DISEASE_KEYWORDS: [string, string][] = [
                    ['cholera', 'Cholera'], ['malaria', 'Malaria'], ['ebola', 'Ebola'],
                    ['marburg', 'Marburg'], ['measles', 'Measles'], ['lassa', 'Lassa Fever'],
                    ['dengue', 'Dengue'], ['yellow fever', 'Yellow Fever'],
                    ['meningitis', 'Meningitis'], ['typhoid', 'Typhoid'],
                    ['mpox', 'Mpox'], ['monkeypox', 'Mpox'], ['polio', 'Polio'],
                    ['hepatitis', 'Hepatitis'], ['tuberculosis', 'Tuberculosis'],
                    ['hiv', 'HIV/AIDS'], ['influenza', 'Influenza'], ['flu', 'Influenza'],
                    ['diphtheria', 'Diphtheria'], ['plague', 'Plague'],
                    ['rift valley', 'Rift Valley Fever'], ['anthrax', 'Anthrax'],
                    ['foot-and-mouth', 'Foot-and-Mouth'], ['foot - and - mouth', 'Foot-and-Mouth'],
                    ['avian', 'Avian Influenza'], ['bird flu', 'Avian Influenza'],
                    ['rabies', 'Rabies'], ['covid', 'COVID-19'], ['coronavirus', 'COVID-19'],
                    ['whooping cough', 'Pertussis'], ['pertussis', 'Pertussis'],
                    ['tetanus', 'Tetanus'], ['chikungunya', 'Chikungunya'],
                    ['flood', 'Flood'], ['drought', 'Drought'], ['earthquake', 'Earthquake'],
                    ['cyclone', 'Cyclone'], ['wildfire', 'Wildfire'],
                ];
                for (const [kw, name] of DISEASE_KEYWORDS) {
                    if (textLower.includes(kw)) { enrichedDisease = name; break; }
                }
                if (!enrichedDisease) enrichedDisease = 'Health Signal';
            }

            // Derive disease category from disease name
            let enrichedCategory = s.disease_category;
            if (!enrichedCategory || enrichedCategory === 'unknown') {
                const CAT_MAP: Record<string, string> = {
                    'Cholera': 'enteric', 'Typhoid': 'enteric', 'Hepatitis': 'enteric',
                    'Malaria': 'vector_borne', 'Dengue': 'vector_borne', 'Yellow Fever': 'vector_borne',
                    'Chikungunya': 'vector_borne', 'Rift Valley Fever': 'vector_borne',
                    'Ebola': 'vhf', 'Marburg': 'vhf', 'Lassa Fever': 'vhf',
                    'Measles': 'vaccine_preventable', 'Polio': 'vaccine_preventable',
                    'Diphtheria': 'vaccine_preventable', 'Pertussis': 'vaccine_preventable',
                    'Tetanus': 'vaccine_preventable',
                    'Meningitis': 'respiratory', 'Influenza': 'respiratory',
                    'COVID-19': 'respiratory', 'Tuberculosis': 'respiratory',
                    'Mpox': 'zoonotic', 'Avian Influenza': 'zoonotic', 'Rabies': 'zoonotic',
                    'Anthrax': 'zoonotic', 'Plague': 'zoonotic', 'Foot-and-Mouth': 'zoonotic',
                    'HIV/AIDS': 'other',
                    'Flood': 'natural_hazard', 'Drought': 'natural_hazard',
                    'Earthquake': 'natural_hazard', 'Cyclone': 'natural_hazard',
                    'Wildfire': 'natural_hazard',
                };
                enrichedCategory = CAT_MAP[enrichedDisease] || 'other';
            }

            // Extract cases/deaths from text if not in DB
            let enrichedCases = s.reported_cases;
            let enrichedDeaths = s.reported_deaths;
            if (!enrichedCases) {
                const caseMatch = textLower.match(/(\d[\d,]*)\s*(?:suspected|confirmed|reported|new)?\s*cases/i)
                    || textLower.match(/cases[:\s]*(\d[\d,]*)/i);
                if (caseMatch) enrichedCases = parseInt(caseMatch[1].replace(/,/g, ''), 10);
            }
            if (!enrichedDeaths) {
                const deathMatch = textLower.match(/(\d[\d,]*)\s*(?:deaths|dead|died|fatalities|killed)/i)
                    || textLower.match(/deaths[:\s]*(\d[\d,]*)/i);
                if (deathMatch) enrichedDeaths = parseInt(deathMatch[1].replace(/,/g, ''), 10);
            }

            return {
                id: String(s.id),
                signal_id: `SIG-${s.id}`,
                signal_type: s.signal_type,
                disease_name: enrichedDisease,
                disease_category: enrichedCategory,

                // Fields that UI components read directly
                headline: s.original_text || enrichedDisease || 'Signal',
                summary: s.translated_text || s.original_text || '',
                level: s.priority,     // SignalCard, LiveTicker use 'level'
                priority: s.priority,  // SignalModal uses 'priority'
                // Use source_timestamp (actual publication time) over created_at (DB ingestion time)
                // This prevents e.g. 12h old news showing as 8h because ingestion was delayed.
                publishedAt: s.source_timestamp || s.created_at,
                created_at: s.created_at,
                updated_at: s.updated_at,
                human_readable_time: getRelativeTime(s.source_timestamp || s.created_at),
                confidence: (s.confidence_score || 0) / 100, // Normalize to 0-1
                confidence_score: s.confidence_score,
                status: s.status,

                // Lingua fields — top level for DataRegistry language toggle
                original_text: s.original_text,
                original_language: s.original_language || 'en',
                translated_text: s.translated_text,
                translation_confidence: s.translation_confidence,
                lingua_fidelity_score: s.lingua_fidelity_score,

                // Epi fields — top level
                reported_cases: enrichedCases,
                reported_deaths: enrichedDeaths,

                // Risk flags
                cross_border_risk: s.cross_border_risk,
                seasonal_pattern_match: s.seasonal_pattern_match,

                // Ingestion source
                ingestion_source: s.ingestion_source,

                // Source detail fields
                source_name: s.source_name,
                source_url: s.source_url || s.source_display?.url,
                source_type: s.source_type || s.source_display?.type,
                source_tier: s.source_tier || s.source_display?.tier,
                source_timestamp: s.source_timestamp,
                original_script: s.original_script,

                // Triage fields
                affected_population: s.affected_population,
                analyst_notes: s.analyst_notes,
                triaged_by: s.triaged_by,
                triaged_at: s.triaged_at,
                validated_by: s.validated_by,
                validated_at: s.validated_at,

                // AI Agent Classification
                ai_classification: s.ai_classification,
                ai_severity: s.ai_severity,
                ai_notification_scope: s.ai_notification_scope,
                ai_reasoning: s.ai_reasoning,
                ai_classified_at: s.ai_classified_at,

                // Location with centroid fallback
                location: {
                    country: s.location_country || 'Unknown',
                    iso3: s.location_country_iso,
                    country_iso: s.location_country_iso,
                    admin1: s.location_admin1,
                    admin2: s.location_admin2,
                    locality: s.location_locality,
                    coordinates: (lat !== 0 || lng !== 0) ? { lat, lng } : undefined
                },

                // Hazard info
                hazard: {
                    name: enrichedDisease || s.signal_type || 'Health Signal',
                    type: s.signal_type === 'disease' ? 'disease' : 'health_system',
                    category: enrichedCategory || 'unknown',
                },

                // Lingua data — map to both formats for compatibility
                lingua: {
                    original_text: s.original_text,
                    original_language_name: s.original_language || 'English',
                    original_language_code: s.original_language || 'en',
                    translation_text: s.translated_text || '',
                    local_voice: false,
                    language_location_match: true,
                    detected_keywords: []
                },
                lingua_data: {
                    original_text: s.original_text,
                    original_language: s.original_language,
                    translated_text: s.translated_text,
                    local_voice: false
                },

                // Epi data — map to both formats
                epi: {
                    cases_suspected: enrichedCases || undefined,
                    deaths: enrichedDeaths || undefined,
                },
                epidemiology: {
                    suspected_cases: enrichedCases,
                    deaths: enrichedDeaths,
                },

                // Source info
                source: { name: sourceName, url: sourceUrl, tier: sourceTier },
                sources: [{
                    name: sourceName,
                    type: s.ingestion_source || 'Intelligence',
                    tier: sourceTier,
                    icon: sourceTier === 1 ? '🏛️' : '📰',
                    url: sourceUrl
                }],

                tags: [s.ingestion_source || 'DB', s.priority].filter(Boolean),
            };
        });

        SIGNAL_CACHE[cacheKey] = { data: mappedSignals, timestamp: Date.now() };

        return mappedSignals;
    } catch (error) {
        logger.error('Sentinel API Error:', error);
        return SIGNAL_CACHE[cacheKey]?.data || [];
    }
}

/**
 * Fetch signal statistics from Django backend
 */
export async function fetchSignalStats(): Promise<{
    total: number;
    by_priority: Record<string, number>;
    by_status: Record<string, number>;
    by_country: Array<{ location_country_iso: string; count: number }>;
}> {
    try {
        const response = await api.get(`${SENTINEL_API}/signals/stats/`);
        const stats = response.data;
        STATS_CACHE.data = stats;
        STATS_CACHE.timestamp = Date.now();
        return stats;
    } catch (error) {
        logger.error('Sentinel Stats Error:', error);
        // Return cached stats or defaults
        return STATS_CACHE.data || {
            total: 0,
            by_priority: { P1: 0, P2: 0, P3: 0, P4: 0 },
            by_status: { new: 0, triaged: 0, validated: 0, dismissed: 0 },
            by_country: []
        };
    }
}

/**
 * Fetch a single signal by ID
 */
export async function fetchSignalById(id: string | number): Promise<Signal | null> {
    try {
        const response = await api.get(`${SENTINEL_API}/signals/${id}/`);
        return response.data;
    } catch (error) {
        logger.error('Sentinel Signal Fetch Error:', error);
        return null;
    }
}

/**
 * Trigger AI triage on a signal
 */
export async function triageSignal(id: string | number, data: {
    priority: string;
    status: string;
    confidence_score: number;
    analyst_notes?: string;
}): Promise<Signal | null> {
    try {
        const response = await api.post(`${SENTINEL_API}/signals/${id}/triage/`, data);

        // Invalidate cache
        Object.keys(SIGNAL_CACHE).forEach(k => delete SIGNAL_CACHE[k]);

        return response.data;
    } catch (error) {
        logger.error('Sentinel Triage Error:', error);
        return null;
    }
}

/**
 * Validate a signal
 */
export async function validateSignal(id: string | number): Promise<Signal | null> {
    try {
        const response = await api.post(`${SENTINEL_API}/signals/${id}/validate/`);

        Object.keys(SIGNAL_CACHE).forEach(k => delete SIGNAL_CACHE[k]);
        return response.data;
    } catch (error) {
        logger.error('Sentinel Validate Error:', error);
        return null;
    }
}

/**
 * Classify a signal using AI agent
 */
export async function classifySignal(id: string | number): Promise<any> {
    try {
        const response = await api.post(`${SENTINEL_API}/signals/${id}/classify/`);

        Object.keys(SIGNAL_CACHE).forEach(k => delete SIGNAL_CACHE[k]);
        return response.data;
    } catch (error) {
        logger.error('Sentinel Classify Error:', error);
        return null;
    }
}

/**
 * Dismiss a signal
 */
export async function dismissSignal(id: string | number, reason?: string): Promise<Signal | null> {
    try {
        const response = await api.post(`${SENTINEL_API}/signals/${id}/dismiss/`, { reason });

        Object.keys(SIGNAL_CACHE).forEach(k => delete SIGNAL_CACHE[k]);
        return response.data;
    } catch (error) {
        logger.error('Sentinel Dismiss Error:', error);
        return null;
    }
}

/**
 * Fetch disease keywords for frontend filtering
 */
export async function fetchDiseases(): Promise<Array<{
    id: number;
    disease_name: string;
    category: string;
    default_priority: string;
    keywords_en: string[];
    keywords_fr: string[];
    keywords_pt: string[];
    keywords_ar: string[];
    keywords_sw: string[];
    keywords_ha: string[];
    keywords_yo: string[];
    keywords_am: string[];
    symptoms_cluster: string[];
    endemic_regions: string[];
    case_fatality_rate: number | null;
    incubation_days_min: number | null;
    incubation_days_max: number | null;
    transmission_routes: string[];
}>> {
    try {
        const response = await api.get(`${SENTINEL_API}/diseases/`);
        const data = response.data;
        return Array.isArray(data) ? data : (data.results || []);
    } catch (error) {
        logger.error('Sentinel Diseases Error:', error);
        return [];
    }
}

export async function fetchSourceCredibility(): Promise<Array<{
    id: number;
    source_name: string;
    source_url: string | null;
    source_type: string;
    tier: number;
    credibility_score: number;
    total_signals: number;
    validated_signals: number;
    false_positive_count: number;
    last_signal_at: string | null;
    notes: string | null;
}>> {
    try {
        const response = await api.get(`${SENTINEL_API}/sources/`);
        const data = response.data;
        return Array.isArray(data) ? data : (data.results || []);
    } catch (error) {
        logger.error('Source Credibility Error:', error);
        return [];
    }
}

export async function fetchIHRSummary(): Promise<Array<{
    id: number;
    category: { id: number; category: string };
    afro: number;
    global_t: number;
    contribution: string;
}>> {
    try {
        const response = await api.get(`/ihmref/summary`);
        const data = response.data;
        return Array.isArray(data) ? data : (data.results || []);
    } catch (error) {
        logger.error('IHR Summary Error:', error);
        return [];
    }
}

/**
 * Combined fetch for regional signals (keeps compatibility with azureService)
 */
export async function fetchRegionalSignalsFromDb(): Promise<Signal[]> {
    return fetchSignals({ limit: 100 });
}

