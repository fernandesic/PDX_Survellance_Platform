/**
 * Languages the feed-level translator can target. Mirrors the set supported
 * by the MyMemory-backed translationService, scoped to WHO AFRO working
 * languages + a few major regional ones.
 */
export interface FeedLanguage {
  code: string;
  label: string;
}

export const FEED_LANGUAGES: FeedLanguage[] = [
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Français' },
  { code: 'pt', label: 'Português' },
  { code: 'ar', label: 'العربية' },
  { code: 'sw', label: 'Kiswahili' },
  { code: 'ha', label: 'Hausa' },
  { code: 'yo', label: 'Yorùbá' },
  { code: 'am', label: 'አማርኛ' },
  { code: 'ln', label: 'Lingála' },
  { code: 'rw', label: 'Kinyarwanda' },
  { code: 'sn', label: 'Shona' },
  { code: 'zu', label: 'isiZulu' },
];

export const DEFAULT_FEED_LANGUAGE = 'en';

/**
 * Maps an AFRO country's ISO3 code to a sensible local-language target for
 * the per-card translation pill. English-card → local language (shown in the
 * pill as `EN → SW`, `EN → FR`, etc.). Countries without a strong single
 * local language fall back to French, the most common regional lingua franca.
 */
const COUNTRY_LOCAL_LANG: Record<string, string> = {
  // Swahili-speaking East Africa
  KEN: 'sw', TZA: 'sw', UGA: 'sw', RWA: 'rw', BDI: 'fr',
  // Amharic / Ethiopia
  ETH: 'am', ERI: 'ar',
  // Francophone West & Central Africa
  BEN: 'fr', BFA: 'fr', CIV: 'fr', GIN: 'fr', MLI: 'fr', NER: 'fr',
  SEN: 'fr', TCD: 'fr', TGO: 'fr', CMR: 'fr', CAF: 'fr', COG: 'fr',
  COD: 'fr', GAB: 'fr', GNQ: 'fr', MDG: 'fr', COM: 'fr', DJI: 'fr',
  MRT: 'ar',
  // Lusophone Africa
  AGO: 'pt', MOZ: 'pt', CPV: 'pt', GNB: 'pt', STP: 'pt',
  // Arabic-speaking
  DZA: 'ar', TUN: 'ar', MAR: 'ar', LBY: 'ar', EGY: 'ar', SDN: 'ar',
  SSD: 'ar', SOM: 'ar',
  // Anglophone with a strong regional language
  NGA: 'ha', ZWE: 'sn', ZAF: 'zu', MWI: 'sn', LSO: 'zu', SWZ: 'zu',
  BWA: 'zu', NAM: 'zu', ZMB: 'sn',
};

export function localLanguageForCountry(iso3?: string): string {
  if (!iso3) return 'fr';
  return COUNTRY_LOCAL_LANG[iso3.toUpperCase()] ?? 'fr';
}
