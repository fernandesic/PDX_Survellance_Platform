/**
 * Translation Service — Lightweight, cached, on-the-fly translation
 * Uses MyMemory free API (no API key required, 1000 req/day)
 * Graceful degradation: returns null if translation fails
 */

const MYMEMORY_API = 'https://api.mymemory.translated.net/get';

// In-memory cache: "text|targetLang" → translated string
const translationCache = new Map<string, string>();

// Track in-flight requests to avoid duplicate fetches
const pendingRequests = new Map<string, Promise<string | null>>();

// Language code mapping (MyMemory uses ISO 639-1)
const LANG_CODES: Record<string, string> = {
    fr: 'fr', pt: 'pt', ar: 'ar', sw: 'sw', ha: 'ha',
    yo: 'yo', am: 'am', mg: 'mg', ln: 'ln', sn: 'sn',
    rw: 'rw', zu: 'zu', xh: 'xh', ti: 'ti', en: 'en',
};

/**
 * Translate text from source language to target language.
 * Returns cached result instantly if available.
 * Returns null on failure (never throws).
 */
export async function translateText(
    text: string,
    targetLang: string,
    sourceLang: string = 'en'
): Promise<string | null> {
    if (!text || text.length < 3 || targetLang === sourceLang) return text;

    // Normalize
    const target = LANG_CODES[targetLang] || targetLang;
    const source = LANG_CODES[sourceLang] || sourceLang;

    // Truncate to 500 chars (API limit)
    const truncated = text.length > 500 ? text.substring(0, 497) + '...' : text;
    const cacheKey = `${truncated}|${source}|${target}`;

    // Return from cache
    if (translationCache.has(cacheKey)) {
        return translationCache.get(cacheKey)!;
    }

    // Return pending request if already in-flight
    if (pendingRequests.has(cacheKey)) {
        return pendingRequests.get(cacheKey)!;
    }

    // Fire translation request
    const request = (async (): Promise<string | null> => {
        try {
            const params = new URLSearchParams({
                q: truncated,
                langpair: `${source}|${target}`,
            });

            const response = await fetch(`${MYMEMORY_API}?${params.toString()}`, {
                signal: AbortSignal.timeout(8000), // 8s timeout
            });

            if (!response.ok) return null;

            const data = await response.json();
            const translated = data?.responseData?.translatedText;

            if (
                translated &&
                translated !== truncated &&
                !translated.includes('MYMEMORY WARNING') &&
                !translated.includes('PLEASE SELECT TWO LANGUAGES')
            ) {
                translationCache.set(cacheKey, translated);
                return translated;
            }

            return null;
        } catch {
            return null;
        } finally {
            pendingRequests.delete(cacheKey);
        }
    })();

    pendingRequests.set(cacheKey, request);
    return request;
}

/**
 * Check if a translation is already cached (synchronous check).
 * Useful for deciding whether to render a loading state.
 */
export function getCachedTranslation(
    text: string,
    targetLang: string,
    sourceLang: string = 'en'
): string | null {
    if (!text || targetLang === sourceLang) return text;

    const target = LANG_CODES[targetLang] || targetLang;
    const source = LANG_CODES[sourceLang] || sourceLang;
    const truncated = text.length > 500 ? text.substring(0, 497) + '...' : text;
    const cacheKey = `${truncated}|${source}|${target}`;

    return translationCache.get(cacheKey) ?? null;
}

/**
 * Clear translation cache (for testing or memory pressure).
 */
export function clearTranslationCache(): void {
    translationCache.clear();
}
