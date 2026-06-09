import type { DiseaseKeyword } from './types';

export interface AfroCountry {
  iso3: string;
  name: string;
  region: 'North' | 'West' | 'Central' | 'East' | 'Southern';
  lat: number;
  lng: number;
  flag: string;
}

/**
 * Canonical AFRO country list — single source of truth.
 * 47 WHO AFRO member states + Somalia + Sudan (often included in African
 * disease-surveillance context via IHR/Africa CDC) = 49 entries.
 * Coordinates are country centroids (approximate).
 */
export const AFRO_COUNTRIES: AfroCountry[] = [
  { iso3: 'DZA', name: 'Algeria', region: 'North', lat: 28.0339, lng: 1.6596, flag: '🇩🇿' },
  { iso3: 'AGO', name: 'Angola', region: 'Southern', lat: -11.2027, lng: 17.8739, flag: '🇦🇴' },
  { iso3: 'BEN', name: 'Benin', region: 'West', lat: 9.3077, lng: 2.3158, flag: '🇧🇯' },
  { iso3: 'BWA', name: 'Botswana', region: 'Southern', lat: -22.3285, lng: 24.6849, flag: '🇧🇼' },
  { iso3: 'BFA', name: 'Burkina Faso', region: 'West', lat: 12.2383, lng: -1.5616, flag: '🇧🇫' },
  { iso3: 'BDI', name: 'Burundi', region: 'East', lat: -3.3731, lng: 29.9189, flag: '🇧🇮' },
  { iso3: 'CPV', name: 'Cabo Verde', region: 'West', lat: 16.5388, lng: -23.0418, flag: '🇨🇻' },
  { iso3: 'CMR', name: 'Cameroon', region: 'Central', lat: 7.3697, lng: 12.3547, flag: '🇨🇲' },
  { iso3: 'CAF', name: 'Central African Republic', region: 'Central', lat: 6.6111, lng: 20.9394, flag: '🇨🇫' },
  { iso3: 'TCD', name: 'Chad', region: 'Central', lat: 15.4542, lng: 18.7322, flag: '🇹🇩' },
  { iso3: 'COM', name: 'Comoros', region: 'East', lat: -11.6455, lng: 43.3333, flag: '🇰🇲' },
  { iso3: 'COG', name: 'Congo', region: 'Central', lat: -0.228, lng: 15.8277, flag: '🇨🇬' },
  { iso3: 'CIV', name: "Côte d'Ivoire", region: 'West', lat: 7.54, lng: -5.5471, flag: '🇨🇮' },
  { iso3: 'COD', name: 'Democratic Republic of the Congo', region: 'Central', lat: -4.0383, lng: 21.7587, flag: '🇨🇩' },
  { iso3: 'GNQ', name: 'Equatorial Guinea', region: 'Central', lat: 1.6508, lng: 10.2679, flag: '🇬🇶' },
  { iso3: 'ERI', name: 'Eritrea', region: 'East', lat: 15.1794, lng: 39.7823, flag: '🇪🇷' },
  { iso3: 'SWZ', name: 'Eswatini', region: 'Southern', lat: -26.5225, lng: 31.4659, flag: '🇸🇿' },
  { iso3: 'ETH', name: 'Ethiopia', region: 'East', lat: 9.145, lng: 40.4897, flag: '🇪🇹' },
  { iso3: 'GAB', name: 'Gabon', region: 'Central', lat: -0.8037, lng: 11.6094, flag: '🇬🇦' },
  { iso3: 'GMB', name: 'Gambia', region: 'West', lat: 13.4432, lng: -15.3101, flag: '🇬🇲' },
  { iso3: 'GHA', name: 'Ghana', region: 'West', lat: 7.9465, lng: -1.0232, flag: '🇬🇭' },
  { iso3: 'GIN', name: 'Guinea', region: 'West', lat: 9.9456, lng: -9.6966, flag: '🇬🇳' },
  { iso3: 'GNB', name: 'Guinea-Bissau', region: 'West', lat: 11.8037, lng: -15.1804, flag: '🇬🇼' },
  { iso3: 'KEN', name: 'Kenya', region: 'East', lat: -0.0236, lng: 37.9062, flag: '🇰🇪' },
  { iso3: 'LSO', name: 'Lesotho', region: 'Southern', lat: -29.61, lng: 28.2336, flag: '🇱🇸' },
  { iso3: 'LBR', name: 'Liberia', region: 'West', lat: 6.4281, lng: -9.4295, flag: '🇱🇷' },
  { iso3: 'MDG', name: 'Madagascar', region: 'East', lat: -18.7669, lng: 46.8691, flag: '🇲🇬' },
  { iso3: 'MWI', name: 'Malawi', region: 'Southern', lat: -13.2543, lng: 34.3015, flag: '🇲🇼' },
  { iso3: 'MLI', name: 'Mali', region: 'West', lat: 17.5707, lng: -3.9962, flag: '🇲🇱' },
  { iso3: 'MRT', name: 'Mauritania', region: 'West', lat: 21.0079, lng: -10.9408, flag: '🇲🇷' },
  { iso3: 'MUS', name: 'Mauritius', region: 'East', lat: -20.3484, lng: 57.5522, flag: '🇲🇺' },
  { iso3: 'MOZ', name: 'Mozambique', region: 'Southern', lat: -18.6657, lng: 35.5296, flag: '🇲🇿' },
  { iso3: 'NAM', name: 'Namibia', region: 'Southern', lat: -22.9576, lng: 18.4904, flag: '🇳🇦' },
  { iso3: 'NER', name: 'Niger', region: 'West', lat: 17.6078, lng: 8.0817, flag: '🇳🇪' },
  { iso3: 'NGA', name: 'Nigeria', region: 'West', lat: 9.082, lng: 8.6753, flag: '🇳🇬' },
  { iso3: 'RWA', name: 'Rwanda', region: 'East', lat: -1.9403, lng: 29.8739, flag: '🇷🇼' },
  { iso3: 'STP', name: 'Sao Tome and Principe', region: 'Central', lat: 0.1864, lng: 6.6131, flag: '🇸🇹' },
  { iso3: 'SEN', name: 'Senegal', region: 'West', lat: 14.4974, lng: -14.4524, flag: '🇸🇳' },
  { iso3: 'SYC', name: 'Seychelles', region: 'East', lat: -4.6796, lng: 55.492, flag: '🇸🇨' },
  { iso3: 'SLE', name: 'Sierra Leone', region: 'West', lat: 8.4606, lng: -11.7799, flag: '🇸🇱' },
  { iso3: 'SOM', name: 'Somalia', region: 'East', lat: 5.1521, lng: 46.1996, flag: '🇸🇴' },
  { iso3: 'ZAF', name: 'South Africa', region: 'Southern', lat: -30.5595, lng: 22.9375, flag: '🇿🇦' },
  { iso3: 'SSD', name: 'South Sudan', region: 'East', lat: 6.877, lng: 31.307, flag: '🇸🇸' },
  { iso3: 'SDN', name: 'Sudan', region: 'East', lat: 12.8628, lng: 30.2176, flag: '🇸🇩' },
  { iso3: 'TZA', name: 'Tanzania', region: 'East', lat: -6.369, lng: 34.8888, flag: '🇹🇿' },
  { iso3: 'TGO', name: 'Togo', region: 'West', lat: 8.6195, lng: 0.8248, flag: '🇹🇬' },
  { iso3: 'UGA', name: 'Uganda', region: 'East', lat: 1.3733, lng: 32.2903, flag: '🇺🇬' },
  { iso3: 'ZMB', name: 'Zambia', region: 'Southern', lat: -13.1339, lng: 27.8493, flag: '🇿🇲' },
  { iso3: 'ZWE', name: 'Zimbabwe', region: 'Southern', lat: -19.0154, lng: 29.1549, flag: '🇿🇼' },
];

export const AFRO_COUNTRY_BY_ISO: Record<string, AfroCountry> = AFRO_COUNTRIES.reduce(
  (acc, c) => {
    acc[c.iso3] = c;
    return acc;
  },
  {} as Record<string, AfroCountry>,
);

/**
 * Canonical disease keyword list — used by frontend filters and mirrors the
 * backend disease_detector taxonomy.
 */
export const DISEASE_KEYWORDS: DiseaseKeyword[] = [
  { code: 'A00', name: 'Cholera', syndrome: 'AWD', keywords: ['cholera', 'choléra', 'vibrio cholerae', 'awd', 'acute watery diarrhea'] },
  { code: 'A01', name: 'Typhoid fever', syndrome: 'Febrile', keywords: ['typhoid', 'salmonella typhi'] },
  { code: 'A20', name: 'Plague', syndrome: 'Febrile', keywords: ['plague', 'yersinia pestis', 'peste'] },
  { code: 'A80', name: 'Polio', syndrome: 'AFP', keywords: ['polio', 'poliomyelitis', 'afp', 'acute flaccid paralysis', 'cvdpv'] },
  { code: 'A90', name: 'Dengue', syndrome: 'Febrile', keywords: ['dengue'] },
  { code: 'A92', name: 'Yellow fever', syndrome: 'Febrile', keywords: ['yellow fever', 'fièvre jaune'] },
  { code: 'B50', name: 'Malaria', syndrome: 'Febrile', keywords: ['malaria', 'paludisme', 'plasmodium'] },
  { code: 'B05', name: 'Measles', syndrome: 'Rash', keywords: ['measles', 'rougeole'] },
  { code: 'A98', name: 'Viral hemorrhagic fevers', syndrome: 'Hemorrhagic', keywords: ['vhf', 'hemorrhagic fever', 'fièvre hémorragique'] },
  { code: 'A99', name: 'Ebola', syndrome: 'Hemorrhagic', keywords: ['ebola', 'evd'] },
  { code: 'A99.1', name: 'Marburg', syndrome: 'Hemorrhagic', keywords: ['marburg', 'mvd'] },
  { code: 'U07', name: 'COVID-19', syndrome: 'Respiratory', keywords: ['covid', 'sars-cov-2', 'coronavirus'] },
  { code: 'A82', name: 'Rabies', syndrome: 'Neurological', keywords: ['rabies', 'rage'] },
  { code: 'A39', name: 'Meningococcal disease', syndrome: 'Neurological', keywords: ['meningitis', 'méningite', 'meningococcal'] },
  { code: 'A96', name: 'Lassa fever', syndrome: 'Hemorrhagic', keywords: ['lassa'] },
  { code: 'MPOX', name: 'Mpox', syndrome: 'Rash', keywords: ['mpox', 'monkeypox', 'variole du singe'] },
  { code: 'H5N1', name: 'Avian influenza', syndrome: 'Respiratory', keywords: ['h5n1', 'avian flu', 'bird flu', 'grippe aviaire'] },
];

/**
 * Source tier map — tier 1 = official (WHO, Africa CDC, ministries),
 * tier 2 = established media / NGOs, tier 3 = unverified aggregators.
 */
export const SOURCE_TIERS: Record<number, { label: string; icon: string }> = {
  0: { label: 'Field Intelligence', icon: '🏥' },
  1: { label: 'Official', icon: '🏛️' },
  2: { label: 'Established Media', icon: '📰' },
  3: { label: 'Unverified', icon: '❓' },
};

export const SOURCE_TIER_BY_DOMAIN: Record<string, 1 | 2 | 3> = {
  'who.int': 1,
  'afro.who.int': 1,
  'africacdc.org': 1,
  'nicd.ac.za': 1,
  'reliefweb.int': 1,
  'reuters.com': 2,
  'bbc.com': 2,
  'allafrica.com': 2,
  'aljazeera.com': 2,
  'gdeltproject.org': 3,
};

export const PRIORITY_COLORS: Record<string, string> = {
  P1: '#ef4444',
  P2: '#f97316',
  P3: '#f59e0b',
  P4: '#94a3b8',
};

export const PRIORITY_LABELS: Record<string, string> = {
  P1: 'Critical',
  P2: 'High',
  P3: 'Monitoring',
  P4: 'Low',
};
