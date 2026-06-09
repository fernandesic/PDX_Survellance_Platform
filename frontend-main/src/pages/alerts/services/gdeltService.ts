// @ts-nocheck
import type { Signal } from '../types';
import { AlertLevel } from '../types';

const GDELT_API_URL = "https://api.gdeltproject.org/api/v2/doc/doc";

// Approximate centroids for AFRO countries to map news items
const COUNTRY_COORDS: Record<string, [number, number]> = {
    'Algeria': [1.6, 28.0], 'Angola': [17.8, -11.2], 'Benin': [2.3, 9.3], 'Botswana': [24.6, -22.3],
    'Burkina Faso': [-1.5, 12.2], 'Burundi': [29.9, -3.3], 'Cabo Verde': [-24.0, 16.0], 'Cameroon': [12.3, 7.3],
    'Central African Republic': [20.9, 6.6], 'Chad': [18.7, 15.4], 'Comoros': [43.3, -11.6], 'Congo': [15.8, -0.2],
    'Democratic Republic of the Congo': [21.7, -4.0], 'Cote d\'Ivoire': [-5.5, 7.5], 'Djibouti': [42.5, 11.8],
    'Egypt': [30.8, 26.8], 'Equatorial Guinea': [10.2, 1.6], 'Eritrea': [39.7, 15.1], 'Ethiopia': [40.4, 9.1],
    'Gabon': [11.6, -0.8], 'Gambia': [-15.3, 13.4], 'Ghana': [-1.0, 7.9], 'Guinea': [-9.6, 9.9],
    'Guinea-Bissau': [-15.1, 11.8], 'Kenya': [37.9, -0.02], 'Lesotho': [28.2, -29.6], 'Liberia': [-9.4, 6.4],
    'Libya': [17.2, 26.3], 'Madagascar': [46.8, -18.7], 'Malawi': [34.3, -13.2], 'Mali': [-3.9, 17.5],
    'Mauritania': [-10.9, 21.0], 'Mauritius': [57.5, -20.3], 'Morocco': [-7.0, 31.7], 'Mozambique': [35.5, -18.6],
    'Namibia': [18.4, -22.9], 'Niger': [8.0, 17.6], 'Nigeria': [8.6, 9.0], 'Rwanda': [29.8, -1.9],
    'Sao Tome and Principe': [6.6, 0.18], 'Senegal': [-14.4, 14.4], 'Seychelles': [55.4, -4.6],
    'Sierra Leone': [-11.7, 8.4], 'Somalia': [46.1, 5.1], 'South Africa': [22.9, -30.5], 'South Sudan': [31.3, 6.8],
    'Sudan': [30.2, 12.8], 'Eswatini': [31.4, -26.5], 'Togo': [0.8, 8.6], 'Tunisia': [9.5, 33.8],
    'Uganda': [32.2, 1.3], 'Zambia': [27.8, -13.1], 'Zimbabwe': [29.1, -19.0]
};

import {
    deriveFidelityScore,
    deriveTranslationConfidence,
    extractEpiData,
    deriveRiskFlags,
    deriveLocality
} from './intelUtils';
import { logger } from "@/utils/logger";

export const fetchGdeltSignals = async (): Promise<Signal[]> => {
    try {
        // Add sourcelang:english to filter at API level
        const query = `(outbreak OR cholera OR malaria OR measles OR ebola OR marburg OR lassa OR dengue OR "yellow fever" OR poliovirus) (Africa OR Nigeria OR Congo OR Kenya OR Uganda OR Ethiopia OR "South Africa") sourcelang:english`;
        const url = `${GDELT_API_URL}?query=${encodeURIComponent(query)}&mode=artlist&format=json&maxrecords=100&timespan=7d&sort=datedesc`;

        const response = await fetch(url);
        if (!response.ok) throw new Error('GDELT API Unreachable');

        const data = await response.json();
        const articles = data.articles || [];

        // Health keywords that MUST appear in the title for relevance
        const HEALTH_KEYWORDS = [
            'outbreak', 'cholera', 'malaria', 'measles', 'ebola', 'marburg', 'lassa',
            'dengue', 'yellow fever', 'poliovirus', 'polio', 'disease', 'fever',
            'epidemic', 'cases', 'deaths', 'died', 'infected', 'virus', 'health',
            'hospital', 'vaccination', 'vaccine', 'who ', 'outbreak', 'pandemic',
            'meningitis', 'typhoid', 'mpox', 'monkeypox', 'plague', 'anthrax',
            'rift valley', 'hepatitis', 'tuberculosis', 'hiv', 'aids', 'diphtheria',
            'respiratory', 'influenza', 'flu', 'quarantine', 'surveillance'
        ];

        // Filter: Latin script + Health keyword + Africa-Only
        const filteredArticles = articles.filter((doc: any) => {
            const title = doc.title || '';

            // 1. Reject non-Latin script
            const hasNonLatin = /[\u4e00-\u9fff\u0600-\u06ff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/.test(title);
            if (hasNonLatin) return false;

            // 2. Must contain at least one health keyword
            const titleLower = title.toLowerCase();
            const hasHealthKeyword = HEALTH_KEYWORDS.some(kw => titleLower.includes(kw));
            if (!hasHealthKeyword) return false;

            // 3. STRICT AFRO CHECK: Must match a country in our AFRO registry
            const countryName = doc.sourcecountry;
            if (!countryName || !COUNTRY_COORDS[countryName]) return false;

            return true;
        });

        return filteredArticles.map((doc: any, index: number) => {
            const countryName = doc.sourcecountry || 'Africa Region';
            const countryCoords = COUNTRY_COORDS[countryName] || [20, 0];
            const title = doc.title.toLowerCase();
            let disease = 'Health Hazard';
            if (title.includes('cholera')) disease = 'Cholera';
            else if (title.includes('malaria')) disease = 'Malaria';
            else if (title.includes('ebola')) disease = 'Ebola';
            else if (title.includes('measles')) disease = 'Measles';
            else if (title.includes('lassa')) disease = 'Lassa Fever';
            else if (title.includes('dengue')) disease = 'Dengue';
            else if (title.includes('meningitis')) disease = 'Meningitis';
            else if (title.includes('typhoid')) disease = 'Typhoid';
            else if (title.includes('mpox') || title.includes('monkeypox')) disease = 'Mpox';
            else if (title.includes('polio')) disease = 'Polio';
            else if (title.includes('yellow fever')) disease = 'Yellow Fever';
            else if (title.includes('hepatitis')) disease = 'Hepatitis';

            const epi = extractEpiData(doc.title);
            const risk = deriveRiskFlags(disease, doc.title);

            // Map country name to ISO3
            const COUNTRY_ISO: Record<string, string> = {
                'Algeria': 'DZA', 'Angola': 'AGO', 'Benin': 'BEN', 'Botswana': 'BWA',
                'Burkina Faso': 'BFA', 'Burundi': 'BDI', 'Cabo Verde': 'CPV', 'Cameroon': 'CMR',
                'Central African Republic': 'CAF', 'Chad': 'TCD', 'Comoros': 'COM', 'Congo': 'COG',
                'Democratic Republic of the Congo': 'COD', 'Cote d\'Ivoire': 'CIV', 'Djibouti': 'DJI',
                'Egypt': 'EGY', 'Equatorial Guinea': 'GNQ', 'Eritrea': 'ERI', 'Ethiopia': 'ETH',
                'Gabon': 'GAB', 'Gambia': 'GMB', 'Ghana': 'GHA', 'Guinea': 'GIN',
                'Guinea-Bissau': 'GNB', 'Kenya': 'KEN', 'Lesotho': 'LSO', 'Liberia': 'LBR',
                'Libya': 'LBY', 'Madagascar': 'MDG', 'Malawi': 'MWI', 'Mali': 'MLI',
                'Mauritania': 'MRT', 'Mauritius': 'MUS', 'Morocco': 'MAR', 'Mozambique': 'MOZ',
                'Namibia': 'NAM', 'Niger': 'NER', 'Nigeria': 'NGA', 'Rwanda': 'RWA',
                'Sao Tome and Principe': 'STP', 'Senegal': 'SEN', 'Seychelles': 'SYC',
                'Sierra Leone': 'SLE', 'Somalia': 'SOM', 'South Africa': 'ZAF', 'South Sudan': 'SSD',
                'Sudan': 'SDN', 'Eswatini': 'SWZ', 'Togo': 'TGO', 'Tunisia': 'TUN',
                'Uganda': 'UGA', 'Zambia': 'ZMB', 'Zimbabwe': 'ZWE', 'Tanzania': 'TZA'
            };
            const iso3 = COUNTRY_ISO[countryName] || 'AFR';
            const locality = deriveLocality(iso3);

            // Derive disease category
            const categoryMap: Record<string, string> = {
                'Cholera': 'enteric', 'Malaria': 'vector_borne', 'Ebola': 'vhf',
                'Measles': 'vaccine_preventable', 'Mpox': 'zoonotic', 'Dengue': 'vector_borne',
                'Yellow Fever': 'vector_borne', 'Meningitis': 'respiratory', 'Lassa Fever': 'vhf',
                'Typhoid': 'enteric', 'Polio': 'vaccine_preventable', 'Hepatitis': 'enteric',
            };
            const diseaseCategory = categoryMap[disease] || 'other';

            return {
                id: `GDELT-${index}-${doc.url.slice(-5)}`,
                signal_id: doc.url,
                disease_name: disease === 'Health Hazard' ? doc.title : disease,
                disease_category: diseaseCategory,
                signal_type: 'rumor',
                status: 'new',
                headline: doc.title,
                summary: `Intel Report: ${doc.title}.`,
                original_text: doc.title,
                level: AlertLevel.MEDIUM,
                priority: 'P3',
                confidence: 0.75,
                translation_confidence: deriveTranslationConfidence(doc.language || 'en'),
                lingua_fidelity_score: deriveFidelityScore(2),
                cross_border_risk: risk.cross_border_risk,
                seasonal_pattern_match: risk.seasonal_pattern_match,
                reported_cases: epi.cases_suspected || 0,
                reported_deaths: epi.deaths || 0,
                publishedAt: doc.seendate ? doc.seendate.replace(/(\d{4})(\d{2})(\d{2})[T\s]?(\d{2})(\d{2})(\d{2})Z?/, '$1-$2-$3T$4:$5:$6Z') : new Date().toISOString(),
                created_at: doc.seendate ? doc.seendate.replace(/(\d{4})(\d{2})(\d{2})[T\s]?(\d{2})(\d{2})(\d{2})Z?/, '$1-$2-$3T$4:$5:$6Z') : new Date().toISOString(),
                updated_at: doc.seendate ? doc.seendate.replace(/(\d{4})(\d{2})(\d{2})[T\s]?(\d{2})(\d{2})(\d{2})Z?/, '$1-$2-$3T$4:$5:$6Z') : new Date().toISOString(),
                human_readable_time: (() => {
                    const ts = doc.seendate ? doc.seendate.replace(/(\d{4})(\d{2})(\d{2})[T\s]?(\d{2})(\d{2})(\d{2})Z?/, '$1-$2-$3T$4:$5:$6Z') : '';
                    if (!ts) return 'Unknown';
                    const diffMs = Date.now() - new Date(ts).getTime();
                    if (diffMs < 60000) return `${Math.floor(diffMs / 1000)}s ago`;
                    if (diffMs < 3600000) return `${Math.floor(diffMs / 60000)}m ago`;
                    if (diffMs < 86400000) return `${Math.floor(diffMs / 3600000)}h ago`;
                    return `${Math.floor(diffMs / 86400000)}d ago`;
                })(),
                hazard: {
                    name: disease,
                    type: 'disease',
                    category: 'Health',
                    who_afro_code: 'DIS'
                },
                location: {
                    country: countryName,
                    country_iso: iso3,
                    iso3: iso3,
                    coordinates: countryCoords,
                    admin2: locality.admin2,
                    locality: locality.locality
                },
                location_lat: countryCoords[1],
                location_lng: countryCoords[0],
                epi: epi,
                source_url: doc.url,
                source_name: doc.domain || 'GDELT',
                lingua: {
                    original_text: doc.title,
                    original_language_code: doc.language || 'en',
                    original_language_name: 'English',
                    local_voice: false,
                    language_location_match: true
                },
                sources: [{
                    name: doc.domain || 'GDELT Node',
                    type: 'Open Source',
                    tier: 2,
                    icon: '🌐'
                }],
                ingestion_source: 'GDELT',
                tags: ['GDELT', 'LIVE NEWS']
            } as Signal;
        });

    } catch (error) {
        logger.error("GDELT API Error:", error);
        return [];
    }
};

