// @ts-nocheck
/**
 * WHO Disease Outbreak News (DON) Service
 * 
 * Fetches real outbreak alerts from WHO's public REST API.
 * Endpoint: https://www.who.int/api/hubs/diseaseoutbreaknews
 * Free, no API key required.
 */
import type { Signal } from '../types';
import { AlertLevel } from '../types';
import { logger } from "@/utils/logger";

const WHO_DON_API = 'https://www.who.int/api/hubs/diseaseoutbreaknews';

// AFRO countries for filtering
const AFRO_COUNTRIES = new Set([
    'algeria', 'angola', 'benin', 'botswana', 'burkina faso', 'burundi',
    'cabo verde', 'cameroon', 'central african republic', 'chad', 'comoros',
    'congo', 'democratic republic of the congo', 'côte d\'ivoire', 'cote d\'ivoire',
    'djibouti', 'egypt', 'equatorial guinea', 'eritrea', 'ethiopia', 'eswatini',
    'gabon', 'gambia', 'ghana', 'guinea', 'guinea-bissau', 'kenya', 'lesotho',
    'liberia', 'libya', 'madagascar', 'malawi', 'mali', 'mauritania', 'mauritius',
    'morocco', 'mozambique', 'namibia', 'niger', 'nigeria', 'rwanda',
    'sao tome and principe', 'senegal', 'seychelles', 'sierra leone', 'somalia',
    'south africa', 'south sudan', 'sudan', 'tanzania', 'togo', 'tunisia',
    'uganda', 'zambia', 'zimbabwe', 'africa'
]);

// Country name → ISO3 mapping
const COUNTRY_ISO: Record<string, string> = {
    'algeria': 'DZA', 'angola': 'AGO', 'benin': 'BEN', 'botswana': 'BWA',
    'burkina faso': 'BFA', 'burundi': 'BDI', 'cabo verde': 'CPV', 'cameroon': 'CMR',
    'central african republic': 'CAF', 'chad': 'TCD', 'comoros': 'COM',
    'congo': 'COG', 'democratic republic of the congo': 'COD',
    'côte d\'ivoire': 'CIV', 'cote d\'ivoire': 'CIV', 'djibouti': 'DJI',
    'egypt': 'EGY', 'equatorial guinea': 'GNQ', 'eritrea': 'ERI', 'ethiopia': 'ETH',
    'eswatini': 'SWZ', 'gabon': 'GAB', 'gambia': 'GMB', 'ghana': 'GHA',
    'guinea': 'GIN', 'guinea-bissau': 'GNB', 'kenya': 'KEN', 'lesotho': 'LSO',
    'liberia': 'LBR', 'libya': 'LBY', 'madagascar': 'MDG', 'malawi': 'MWI',
    'mali': 'MLI', 'mauritania': 'MRT', 'mauritius': 'MUS', 'morocco': 'MAR',
    'mozambique': 'MOZ', 'namibia': 'NAM', 'niger': 'NER', 'nigeria': 'NGA',
    'rwanda': 'RWA', 'sao tome and principe': 'STP', 'senegal': 'SEN',
    'seychelles': 'SYC', 'sierra leone': 'SLE', 'somalia': 'SOM',
    'south africa': 'ZAF', 'south sudan': 'SSD', 'sudan': 'SDN',
    'tanzania': 'TZA', 'togo': 'TGO', 'tunisia': 'TUN', 'uganda': 'UGA',
    'zambia': 'ZMB', 'zimbabwe': 'ZWE', 'africa': 'AFR',
};

// Disease keyword extraction from title
const DISEASE_MAP: [string, string, string][] = [
    ['cholera', 'Cholera', 'enteric'],
    ['malaria', 'Malaria', 'vector_borne'],
    ['ebola', 'Ebola', 'vhf'],
    ['marburg', 'Marburg', 'vhf'],
    ['measles', 'Measles', 'vaccine_preventable'],
    ['lassa', 'Lassa Fever', 'vhf'],
    ['dengue', 'Dengue', 'vector_borne'],
    ['yellow fever', 'Yellow Fever', 'vector_borne'],
    ['meningitis', 'Meningitis', 'respiratory'],
    ['mpox', 'Mpox', 'zoonotic'],
    ['monkeypox', 'Mpox', 'zoonotic'],
    ['polio', 'Polio', 'vaccine_preventable'],
    ['nipah', 'Nipah', 'zoonotic'],
    ['avian influenza', 'Avian Influenza', 'zoonotic'],
    ['influenza', 'Influenza', 'respiratory'],
    ['rift valley', 'Rift Valley Fever', 'vhf'],
    ['plague', 'Plague', 'zoonotic'],
    ['anthrax', 'Anthrax', 'zoonotic'],
    ['hepatitis', 'Hepatitis', 'enteric'],
    ['typhoid', 'Typhoid', 'enteric'],
    ['diphtheria', 'Diphtheria', 'vaccine_preventable'],
    ['chikungunya', 'Chikungunya', 'vector_borne'],
    ['covid', 'COVID-19', 'respiratory'],
    ['mers', 'MERS-CoV', 'respiratory'],
    ['oropouche', 'Oropouche', 'vector_borne'],
];

function extractCountryFromTitle(title: string): { country: string; iso3: string } | null {
    const titleLower = title.toLowerCase();
    // WHO DON titles typically end with "– CountryName" or "- CountryName"
    const dashMatch = title.match(/[–\-]\s*(.+?)(?:\s*\(|$)/);
    if (dashMatch) {
        const countryPart = dashMatch[1].trim().toLowerCase();
        for (const [name, iso] of Object.entries(COUNTRY_ISO)) {
            if (countryPart.includes(name)) return { country: dashMatch[1].trim(), iso3: iso };
        }
    }
    // Fallback: check entire title for AFRO country names
    for (const [name, iso] of Object.entries(COUNTRY_ISO)) {
        if (titleLower.includes(name)) return { country: name.charAt(0).toUpperCase() + name.slice(1), iso3: iso };
    }
    return null;
}

function extractDiseaseFromTitle(title: string): { name: string; category: string } {
    const titleLower = title.toLowerCase();
    for (const [kw, name, cat] of DISEASE_MAP) {
        if (titleLower.includes(kw)) return { name, category: cat };
    }
    return { name: 'Health Alert', category: 'other' };
}

function extractNumbersFromText(text: string): { cases: number | null; deaths: number | null } {
    let cases: number | null = null;
    let deaths: number | null = null;
    const textLower = text.toLowerCase();

    const caseMatch = textLower.match(/(\d[\d,\s]*)\s*(?:suspected|confirmed|reported|cumulative|total|probable)?\s*cases/i);
    if (caseMatch) cases = parseInt(caseMatch[1].replace(/[,\s]/g, ''), 10);

    const deathMatch = textLower.match(/(\d[\d,\s]*)\s*(?:deaths|dead|died|fatalities)/i);
    if (deathMatch) deaths = parseInt(deathMatch[1].replace(/[,\s]/g, ''), 10);

    return { cases, deaths };
}

export const fetchWHODONAlerts = async (): Promise<Signal[]> => {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        // Fetch latest 30 DON reports
        const response = await fetch(
            `${WHO_DON_API}?$top=30&$orderby=PublicationDateAndTime%20desc`,
            { signal: controller.signal }
        );
        clearTimeout(timeoutId);

        if (!response.ok) throw new Error(`WHO DON API: ${response.status}`);

        const data = await response.json();
        const items = data.value || [];

        // Filter for AFRO countries only
        const afroItems = items.filter((item: any) => {
            const country = extractCountryFromTitle(item.Title || '');
            return country !== null;
        });

        return afroItems.map((item: any, index: number) => {
            const countryInfo = extractCountryFromTitle(item.Title);
            const diseaseInfo = extractDiseaseFromTitle(item.Title);
            const summary = item.Summary || '';
            const overview = item.Overview || '';
            const fullText = summary + ' ' + overview;
            const epiNumbers = extractNumbersFromText(fullText);

            // Determine priority from disease severity
            const P1_DISEASES = ['Ebola', 'Marburg', 'Lassa Fever', 'Plague', 'Rift Valley Fever', 'Nipah'];
            const P2_DISEASES = ['Cholera', 'Measles', 'Meningitis', 'Mpox', 'Yellow Fever', 'Avian Influenza'];
            let priority = 'P3';
            if (P1_DISEASES.includes(diseaseInfo.name)) priority = 'P1';
            else if (P2_DISEASES.includes(diseaseInfo.name)) priority = 'P2';

            const publishDate = item.PublicationDateAndTime || new Date().toISOString();

            return {
                id: `WHO-DON-${item.DonId || index}`,
                signal_id: item.DonId || `don-${index}`,
                disease_name: diseaseInfo.name,
                disease_category: diseaseInfo.category,
                signal_type: 'disease',
                status: 'validated',
                headline: item.Title,
                summary: summary.substring(0, 500) || item.Title,
                original_text: fullText.substring(0, 1500) || item.Title,
                level: priority === 'P1' ? AlertLevel.CRITICAL : priority === 'P2' ? AlertLevel.HIGH : AlertLevel.MEDIUM,
                priority,
                confidence: 1.0,
                confidence_score: 100,
                translation_confidence: 100,
                lingua_fidelity_score: 100,
                cross_border_risk: (item.Title || '').toLowerCase().includes('global') || (item.Title || '').toLowerCase().includes('multi-country'),
                seasonal_pattern_match: false,
                reported_cases: epiNumbers.cases,
                reported_deaths: epiNumbers.deaths,
                publishedAt: publishDate,
                created_at: publishDate,
                updated_at: publishDate,
                source_timestamp: publishDate,
                human_readable_time: (() => {
                    const diffMs = Date.now() - new Date(publishDate).getTime();
                    if (diffMs < 60000) return `${Math.floor(diffMs / 1000)}s ago`;
                    if (diffMs < 3600000) return `${Math.floor(diffMs / 60000)}m ago`;
                    if (diffMs < 86400000) return `${Math.floor(diffMs / 3600000)}h ago`;
                    if (diffMs < 604800000) return `${Math.floor(diffMs / 86400000)}d ago`;
                    return `${Math.floor(diffMs / 604800000)}w ago`;
                })(),
                hazard: {
                    name: diseaseInfo.name,
                    type: 'disease_outbreak',
                    category: diseaseInfo.category,
                    who_afro_code: 'DON'
                },
                location: {
                    country: countryInfo?.country || 'Africa Region',
                    country_iso: countryInfo?.iso3 || 'AFR',
                    iso3: countryInfo?.iso3 || 'AFR',
                },
                epi: {
                    cases_suspected: epiNumbers.cases || undefined,
                    deaths: epiNumbers.deaths || undefined,
                },
                source_url: item.ItemDefaultUrl
                    ? `https://www.who.int${item.ItemDefaultUrl}`
                    : `https://www.who.int/emergencies/disease-outbreak-news/${item.UrlName || ''}`,
                source_name: 'WHO Disease Outbreak News',
                lingua: {
                    original_text: item.Title,
                    original_language_name: 'English',
                    original_language_code: 'en',
                    translation_text: '',
                    local_voice: false,
                    language_location_match: true,
                    detected_keywords: []
                },
                sources: [{
                    name: 'WHO Disease Outbreak News',
                    type: 'Official/WHO',
                    tier: 1,
                    icon: '🇺🇳',
                    url: item.ItemDefaultUrl ? `https://www.who.int${item.ItemDefaultUrl}` : undefined
                }],
                ingestion_source: 'WHO-DON',
                tags: ['WHO-DON', 'OFFICIAL', priority]
            } as Signal;
        });
    } catch (error) {
        logger.error('WHO DON API Error:', error);
        return [];
    }
};
