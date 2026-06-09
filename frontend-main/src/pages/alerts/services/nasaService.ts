// @ts-nocheck
import type { Signal } from '../types';
import { AlertLevel } from '../types';

const EONET_API_URL = "https://eonet.gsfc.nasa.gov/api/v3/events";

// NASA EONET v3 uses STRING category IDs (not numeric)
const CATEGORY_MAP: Record<string, { name: string, icon: string, category: string }> = {
    'drought': { name: 'Drought', icon: '☀️', category: 'Climatological' },
    'dustHaze': { name: 'Dust Haze', icon: '💨', category: 'Meteorological' },
    'wildfires': { name: 'Wildfire', icon: '🔥', category: 'Climatological' },
    'floods': { name: 'Flood', icon: '🌊', category: 'Hydrological' },
    'severeStorms': { name: 'Severe Storm', icon: '⛈️', category: 'Meteorological' },
    'volcanoes': { name: 'Volcano', icon: '🌋', category: 'Geophysical' },
    'earthquakes': { name: 'Earthquake', icon: '🌍', category: 'Geophysical' },
    'landslides': { name: 'Landslide', icon: '⛰️', category: 'Geophysical' },
    'seaLakeIce': { name: 'Sea/Lake Ice', icon: '🧊', category: 'Hydrological' },
    'snow': { name: 'Snow', icon: '❄️', category: 'Meteorological' },
    'tempExtremes': { name: 'Temperature Extremes', icon: '🌡️', category: 'Meteorological' },
    'waterColor': { name: 'Water Discoloration', icon: '🌊', category: 'Hydrological' },
    'manmade': { name: 'Manmade Event', icon: '🏭', category: 'Manmade' },
};

// Reverse lookup: country name from coordinates using approximate bounding boxes
const AFRO_COUNTRY_BOXES: Array<{ name: string, iso3: string, lat: [number, number], lng: [number, number] }> = [
    { name: 'Nigeria', iso3: 'NGA', lat: [4, 14], lng: [2, 15] },
    { name: 'Kenya', iso3: 'KEN', lat: [-5, 5], lng: [34, 42] },
    { name: 'Ethiopia', iso3: 'ETH', lat: [3, 15], lng: [33, 48] },
    { name: 'DR Congo', iso3: 'COD', lat: [-14, 6], lng: [12, 32] },
    { name: 'South Africa', iso3: 'ZAF', lat: [-35, -22], lng: [16, 33] },
    { name: 'Tanzania', iso3: 'TZA', lat: [-12, -1], lng: [29, 41] },
    { name: 'Mozambique', iso3: 'MOZ', lat: [-27, -10], lng: [30, 41] },
    { name: 'Madagascar', iso3: 'MDG', lat: [-26, -12], lng: [43, 51] },
    { name: 'Uganda', iso3: 'UGA', lat: [-2, 4], lng: [30, 35] },
    { name: 'Ghana', iso3: 'GHA', lat: [4, 12], lng: [-4, 2] },
    { name: 'Cameroon', iso3: 'CMR', lat: [1, 14], lng: [8, 17] },
    { name: 'Niger', iso3: 'NER', lat: [11, 24], lng: [0, 16] },
    { name: 'Mali', iso3: 'MLI', lat: [10, 25], lng: [-13, 5] },
    { name: 'Senegal', iso3: 'SEN', lat: [12, 17], lng: [-18, -11] },
    { name: 'Angola', iso3: 'AGO', lat: [-18, -4], lng: [12, 24] },
    { name: 'Zambia', iso3: 'ZMB', lat: [-18, -8], lng: [22, 33] },
    { name: 'Zimbabwe', iso3: 'ZWE', lat: [-23, -15], lng: [25, 34] },
    { name: 'Algeria', iso3: 'DZA', lat: [19, 37], lng: [-9, 12] },
    { name: 'Morocco', iso3: 'MAR', lat: [27, 36], lng: [-13, -1] },
    { name: 'Sudan', iso3: 'SDN', lat: [8, 23], lng: [21, 39] },
    { name: 'South Sudan', iso3: 'SSD', lat: [3, 13], lng: [24, 36] },
    { name: 'Chad', iso3: 'TCD', lat: [7, 24], lng: [13, 24] },
];

function identifyAfricanCountry(lon: number, lat: number): { name: string, iso3: string } | null {
    for (const box of AFRO_COUNTRY_BOXES) {
        if (lat >= box.lat[0] && lat <= box.lat[1] && lon >= box.lng[0] && lon <= box.lng[1]) {
            return { name: box.name, iso3: box.iso3 };
        }
    }
    return null;
}

import {
    deriveFidelityScore,
    deriveTranslationConfidence,
    deriveRiskFlags,
    deriveLocality
} from './intelUtils';
import { logger } from "@/utils/logger";

export const fetchNasaHazards = async (): Promise<Signal[]> => {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);

        // Fetch more events and wider time range to capture African events
        const response = await fetch(`${EONET_API_URL}?days=60&status=open`, {
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (!response.ok) throw new Error('NASA EONET API Unreachable');

        const data = await response.json();
        const events = data.events || [];

        // Wider Africa bounding box: Lat -36 to 38, Lon -26 to 64 
        // Includes all of Africa + Madagascar + nearby islands
        const africanEvents = events.filter((e: any) => {
            if (!e.geometry || e.geometry.length === 0) return false;
            const coords = e.geometry[0].coordinates;
            if (!coords || coords.length < 2) return false;
            const [lon, lat] = coords;
            return lat >= -36 && lat <= 38 && lon >= -26 && lon <= 64;
        });

        // Return ONLY African events. No global fallbacks.
        return africanEvents.map((e: any) => {
            const categoryId = e.categories[0]?.id;  // String ID in v3
            const catInfo = CATEGORY_MAP[categoryId] || { name: e.categories[0]?.title || 'Hazard', icon: '⚠️', category: 'Unknown' };
            const geometry = e.geometry[0];
            const [lon, lat] = geometry.coordinates;

            // Try to identify the country from coordinates
            const countryMatch = identifyAfricanCountry(lon, lat);
            const iso3 = countryMatch?.iso3 || 'AFR';

            const risk = deriveRiskFlags(catInfo.name, e.description || e.title);
            const locality = deriveLocality(iso3);

            return {
                id: `NASA-${e.id}`,
                disease_name: catInfo.name,
                signal_type: 'hazard',
                headline: e.title,
                summary: `Active ${catInfo.name} detected by NASA satellites. ${e.description || ''}`.trim(),
                original_text: e.description || e.title || '',
                level: AlertLevel.HIGH,
                priority: 'P2',
                confidence: 0.98,
                translation_confidence: deriveTranslationConfidence('en'),
                lingua_fidelity_score: deriveFidelityScore(1),
                cross_border_risk: risk.cross_border_risk,
                seasonal_pattern_match: risk.seasonal_pattern_match,
                publishedAt: geometry.date,
                created_at: geometry.date,
                updated_at: geometry.date,
                human_readable_time: (() => {
                    const diffMs = Date.now() - new Date(geometry.date).getTime();
                    if (diffMs < 60000) return `${Math.floor(diffMs / 1000)}s ago`;
                    if (diffMs < 3600000) return `${Math.floor(diffMs / 60000)}m ago`;
                    if (diffMs < 86400000) return `${Math.floor(diffMs / 3600000)}h ago`;
                    if (diffMs < 604800000) return `${Math.floor(diffMs / 86400000)}d ago`;
                    return `${Math.floor(diffMs / 604800000)}w ago`;
                })(),
                hazard: {
                    name: catInfo.name,
                    type: 'natural_disaster',
                    category: catInfo.category,
                    who_afro_code: 'NAT'
                },
                location: {
                    country: countryMatch?.name || 'Africa Region',
                    iso3: iso3,
                    country_iso: iso3,
                    coordinates: [lon, lat],
                    admin2: locality.admin2,
                    locality: locality.locality
                },
                location_lat: lat,
                location_lng: lon,
                epi: { cases_suspected: 0, deaths: 0 },
                lingua: {
                    original_text: e.description || e.title || '',
                    original_language_name: 'English',
                    original_language_code: 'en',
                    translation_text: '',
                    local_voice: false,
                    language_location_match: true,
                    detected_keywords: []
                },
                sources: [{
                    name: 'NASA EONET',
                    type: 'Satellite',
                    tier: 1,
                    icon: '🛰️',
                    url: e.sources?.[0]?.url
                }],
                ingestion_source: 'NASA',
                tags: ['LIVE NASA DATA', 'VERIFIED', 'AFRICA']
            } as Signal;
        });

    } catch (error) {
        logger.error("NASA API Error:", error);
        return [];
    }
};
