// @ts-nocheck
import type { Country, Disease, ExpandedApiSource } from './types';

export const AFRO_COUNTRIES: Country[] = [
  { code: 'AGO', name: 'Angola', region: 'Southern' },
  { code: 'BEN', name: 'Benin', region: 'West' },
  { code: 'BWA', name: 'Botswana', region: 'Southern' },
  { code: 'BFA', name: 'Burkina Faso', region: 'West' },
  { code: 'BDI', name: 'Burundi', region: 'East' },
  { code: 'CPV', name: 'Cabo Verde', region: 'West' },
  { code: 'CMR', name: 'Cameroon', region: 'Central' },
  { code: 'CAF', name: 'Central African Republic', region: 'Central' },
  { code: 'TCD', name: 'Chad', region: 'Central' },
  { code: 'COM', name: 'Comoros', region: 'East' },
  { code: 'COG', name: 'Congo', region: 'Central' },
  { code: 'CIV', name: "Côte d'Ivoire", region: 'West' },
  { code: 'COD', name: 'DR Congo', region: 'Central' },
  { code: 'GNQ', name: 'Equatorial Guinea', region: 'Central' },
  { code: 'ERI', name: 'Eritrea', region: 'East' },
  { code: 'ETH', name: 'Ethiopia', region: 'East' },
  { code: 'GAB', name: 'Gabon', region: 'Central' },
  { code: 'GMB', name: 'Gambia', region: 'West' },
  { code: 'GHA', name: 'Ghana', region: 'West' },
  { code: 'GIN', name: 'Guinea', region: 'West' },
  { code: 'GNB', name: 'Guinea-Bissau', region: 'West' },
  { code: 'KEN', name: 'Kenya', region: 'East' },
  { code: 'LSO', name: 'Lesotho', region: 'Southern' },
  { code: 'LBR', name: 'Liberia', region: 'West' },
  { code: 'MDG', name: 'Madagascar', region: 'East' },
  { code: 'MWI', name: 'Malawi', region: 'Southern' },
  { code: 'MLI', name: 'Mali', region: 'West' },
  { code: 'MRT', name: 'Mauritania', region: 'West' },
  { code: 'MUS', name: 'Mauritius', region: 'East' },
  { code: 'MOZ', name: 'Mozambique', region: 'Southern' },
  { code: 'NAM', name: 'Namibia', region: 'Southern' },
  { code: 'NER', name: 'Niger', region: 'West' },
  { code: 'NGA', name: 'Nigeria', region: 'West' },
  { code: 'RWA', name: 'Rwanda', region: 'East' },
  { code: 'STP', name: 'Sao Tome and Principe', region: 'Central' },
  { code: 'SEN', name: 'Senegal', region: 'West' },
  { code: 'SYC', name: 'Seychelles', region: 'East' },
  { code: 'SLE', name: 'Sierra Leone', region: 'West' },
  { code: 'ZAF', name: 'South Africa', region: 'Southern' },
  { code: 'SSD', name: 'South Sudan', region: 'East' },
  { code: 'SWZ', name: 'Eswatini', region: 'Southern' },
  { code: 'TZA', name: 'Tanzania', region: 'East' },
  { code: 'TGO', name: 'Togo', region: 'West' },
  { code: 'UGA', name: 'Uganda', region: 'East' },
  { code: 'ZMB', name: 'Zambia', region: 'Southern' },
  { code: 'ZWE', name: 'Zimbabwe', region: 'Southern' },
  { code: 'DZA', name: 'Algeria', region: 'North' },
];

export const AFRO_DISEASES: Disease[] = [
  { code: "A00", name: "Cholera", syndrome: "AWD" },
  { code: "A01", name: "Typhoid fever", syndrome: "Febrile" },
  { code: "A20", name: "Plague", syndrome: "Febrile" },
  { code: "A80", name: "Polio", syndrome: "AFP" },
  { code: "A90", name: "Dengue", syndrome: "Febrile" },
  { code: "A92", name: "Yellow fever", syndrome: "Febrile" },
  { code: "B50", name: "Malaria", syndrome: "Febrile" },
  { code: "B05", name: "Measles", syndrome: "Rash" },
  { code: "A98", name: "Viral hemorrhagic fevers", syndrome: "Hemorrhagic" },
  { code: "A99", name: "Ebola/Marburg", syndrome: "Hemorrhagic" },
  { code: "U07", name: "COVID-19", syndrome: "Respiratory" },
  { code: "A82", name: "Rabies", syndrome: "Neurological" },
  { code: "A39", name: "Meningococcal disease", syndrome: "Neurological" },
  { code: "A96", name: "Lassa fever", syndrome: "Hemorrhagic" },
  { code: "MPOX", name: "Mpox", syndrome: "Rash" },
];

export const API_SOURCES: ExpandedApiSource[] = [
  {
    source_id: 'GDELT-V2',
    source_name: 'GDELT Project 2.0 Doc API',
    status: 'active',
    base_url: 'https://api.gdeltproject.org/api/v2/doc/doc',
    documentation_url: 'https://blog.gdeltproject.org/gdelt-doc-2-0-api-debuts/',
    source_type: 'Aggregator',
    category: 'News_Aggregator',
    coverage: 'Global',
    priority: 1,
    auth_type: 'None',
    data_format: 'JSON',
  },
  {
    source_id: 'BING-NEWS',
    source_name: 'Microsoft Bing News Search v7',
    status: 'active',
    base_url: 'https://api.bing.microsoft.com/v7.0/news/search',
    source_type: 'Aggregator',
    category: 'News_Aggregator',
    coverage: 'Global',
    priority: 1,
    auth_type: 'ApiKey',
    data_format: 'JSON',
  },
  {
    source_id: 'GOOGLE-TRENDS-RSS',
    source_name: 'Google Trends (Health)',
    status: 'active',
    base_url: 'https://trends.google.com/trends/trendingsearches/daily/rss?geo=KE',
    source_type: 'Intelligence',
    category: 'Social_Internet',
    coverage: 'Global',
    priority: 3,
    auth_type: 'None',
    data_format: 'RSS',
  },

  {
    source_id: 'RELIEF-WEB',
    source_name: 'ReliefWeb API (UN OCHA)',
    status: 'active',
    base_url: 'https://api.reliefweb.int/v1/reports',
    documentation_url: 'https://reliefweb.int/help/api',
    source_type: 'Official',
    category: 'Humanitarian',
    coverage: 'Global',
    priority: 1,
    auth_type: 'None',
    data_format: 'JSON',
  },
  {
    source_id: 'WHO-AFRO-OFFICIAL',
    source_name: 'WHO AFRO Weekly Bulletins',
    status: 'active',
    base_url: 'https://apps.who.int/iris/rest/items',
    source_type: 'Official',
    category: 'Official',
    coverage: 'Regional',
    priority: 2,
    auth_type: 'None',
    data_format: 'XML',
  },

  {
    source_id: 'AFRICA-CDC-FEED',
    source_name: 'Africa CDC News Feed',
    status: 'active',
    base_url: 'https://africacdc.org/feed/',
    source_type: 'Official',
    category: 'Official',
    coverage: 'Regional',
    priority: 2,
    auth_type: 'None',
    data_format: 'RSS',
  },
  {
    source_id: 'NICD-SA',
    source_name: 'South Africa NICD Alerts',
    status: 'active',
    base_url: 'https://www.nicd.ac.za/feed/',
    source_type: 'Official',
    category: 'Official',
    coverage: 'National',
    priority: 2,
    auth_type: 'None',
    data_format: 'RSS',
  },
  {
    source_id: 'ALLAFRICA-HEALTH',
    source_name: 'AllAfrica Health Headlines',
    status: 'active',
    base_url: 'https://allafrica.com/tools/headlines/v2/xml/os/categories/health.xml',
    source_type: 'Aggregator',
    category: 'News_Aggregator',
    coverage: 'Regional',
    priority: 3,
    auth_type: 'None',
    data_format: 'XML',
  },

  {
    source_id: 'RADIO-BROWSER',
    source_name: 'Radio Browser API',
    status: 'active',
    base_url: 'https://de1.api.radio-browser.info/json/stations/search',
    documentation_url: 'https://api.radio-browser.info/',
    source_type: 'Aggregator',
    category: 'Traditional_Media',
    coverage: 'Global',
    priority: 4,
    auth_type: 'None',
    data_format: 'JSON',

  }
];

export const EXPANDED_API_SOURCES = API_SOURCES;
export const getQueryUrl = (sourceId: string, keyword: string, country: string): string => {
  const source = API_SOURCES.find(s => s.source_id === sourceId);
  if (!source) return '';

  switch (sourceId) {
    case 'GDELT-V2':
      return `${source.base_url}?query=${keyword} sourcecountry:${country}&mode=artlist&format=json`;

    case 'RELIEF-WEB':
      return `${source.base_url}?appname=HealthMonitor&query[value]=primary_country.iso3:${country} AND ${keyword}`;

    case 'RADIO-BROWSER':
      return `${source.base_url}?countrycode=${country}&tag=news`;

    default:
      return source.base_url;
  }
};

