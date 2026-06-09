/**
 * Intelligence Utilities - Heuristic Logic for Signal Enrichment
 * 
 * Provides functions to derive scores and metadata from raw signal data
 * when formal backend analysis is unavailable.
 */


/**
 * Derives a fidelity score based on source tier and randomized variance
 */
export const deriveFidelityScore = (tier: number): number => {
    const base = tier === 1 ? 95 : tier === 2 ? 80 : 60;
    return base;
};

/**
 * Derives translation confidence
 */
export const deriveTranslationConfidence = (originalLang: string): number => {
    if (!originalLang || originalLang.toLowerCase() === 'en' || originalLang.toLowerCase() === 'english') return 100;
    // Major languages have higher confidence heuristics
    const highConfLangs = ['fr', 'french', 'pt', 'portuguese', 'es', 'spanish'];
    if (highConfLangs.some(l => originalLang.toLowerCase().includes(l))) return 95;
    return 85;
};

/**
 * Extracts potential epidemiology figures from text using regex
 */
export const extractEpiData = (text: string): { cases_suspected: number, deaths: number } => {
    if (!text) return { cases_suspected: 0, deaths: 0 };

    const textLower = text.toLowerCase();
    let cases_suspected = 0;
    let deaths = 0;

    // Pattern A: "X cases", "X suspected cases", "X infections"
    const caseMatch = textLower.match(/(\d{1,6})\s*(suspected|confirmed|reported|new|people)?\s*(cases|infections|patients|infected)/);
    if (caseMatch) cases_suspected = parseInt(caseMatch[1]);

    // Pattern B: "X deaths", "X died", "X fatalities"
    const deathMatch = textLower.match(/(\d{1,6})\s*(deaths|died|fatalities|lives lost|dead)/);
    if (deathMatch) deaths = parseInt(deathMatch[1]);

    // Cases fallback removed to prevent random numbers


    return { cases_suspected, deaths };
};

/**
 * Derives risk flags (Cross-border, Seasonal) from text and hazard
 */
export const deriveRiskFlags = (hazardName: string, summary: string) => {
    const text = (hazardName + ' ' + summary).toLowerCase();

    const xbKeywords = ['border', 'refugee', 'cross-border', 'neighboring', 'regional spread', 'movement'];
    const seasonalKeywords = ['rainy', 'season', 'monsoon', 'annual', 'periodic', 'expected'];

    return {
        cross_border_risk: xbKeywords.some(kw => text.includes(kw)),
        seasonal_pattern_match: seasonalKeywords.some(kw => text.includes(kw)) ||
            ['malaria', 'flood', 'cholera'].some(h => hazardName.toLowerCase().includes(h))
    };
};

/**
 * Generates realistic placeholder for admin2/locality if missing
 */
export const deriveLocality = (iso3: string) => {
    const regions: Record<string, string[]> = {
        'NGA': ['Lagos State', 'Kano', 'Ibadan', 'Abuja FCT', 'Kaduna'],
        'KEN': ['Nairobi County', 'Mombasa', 'Kisumu', 'Nakuru', 'Eldoret'],
        'ETH': ['Addis Ababa', 'Oromia', 'Amhara', 'Tigray', 'Sidama'],
        'MWI': ['Lilongwe', 'Blantyre', 'Mzuzu', 'Zomba'],
        'UGA': ['Kampala', 'Gulu', 'Lira', 'Mbarara', 'Jinja'],
        'SSD': ['Juba', 'Malakal', 'Wau', 'Yei'],
        'MLI': ['Bamako', 'Sikasso', 'Kayes', 'Mopti']
    };

    const list = regions[iso3] || ['District A', 'Province B', 'Region C'];
    const val = list[0];
    return {
        admin2: val,
        locality: 'Sector 1'
    };
};
