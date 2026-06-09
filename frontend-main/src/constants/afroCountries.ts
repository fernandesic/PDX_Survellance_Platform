import type { Region } from '@/pages/climate/types/climate';

interface AfroCountryData {
    code: string;
    name: string;
    lat: number;
    lng: number;
}

const AFRO_COUNTRY_DATA: AfroCountryData[] = [
    { code: 'DZA', name: 'Algeria', lat: 28.0339, lng: 1.6596 },
    { code: 'AGO', name: 'Angola', lat: -11.2027, lng: 17.8739 },
    { code: 'BEN', name: 'Benin', lat: 9.3077, lng: 2.3158 },
    { code: 'BWA', name: 'Botswana', lat: -22.3285, lng: 24.6849 },
    { code: 'BFA', name: 'Burkina Faso', lat: 12.2383, lng: -1.5616 },
    { code: 'BDI', name: 'Burundi', lat: -3.3731, lng: 29.9189 },
    { code: 'CPV', name: 'Cabo Verde', lat: 16.5388, lng: -23.0418 },
    { code: 'CMR', name: 'Cameroon', lat: 7.3697, lng: 12.3547 },
    { code: 'CAF', name: 'Central African Republic', lat: 6.6111, lng: 20.9394 },
    { code: 'TCD', name: 'Chad', lat: 15.4542, lng: 18.7322 },
    { code: 'COM', name: 'Comoros', lat: -11.6455, lng: 43.3333 },
    { code: 'COG', name: 'Congo', lat: -0.228, lng: 15.8277 },
    { code: 'CIV', name: "Côte d'Ivoire", lat: 7.54, lng: -5.5471 },
    { code: 'COD', name: 'Democratic Republic of the Congo', lat: -4.0383, lng: 21.7587 },
    { code: 'GNQ', name: 'Equatorial Guinea', lat: 1.6508, lng: 10.2679 },
    { code: 'ERI', name: 'Eritrea', lat: 15.1794, lng: 39.7823 },
    { code: 'SWZ', name: 'Eswatini', lat: -26.5225, lng: 31.4659 },
    { code: 'ETH', name: 'Ethiopia', lat: 9.145, lng: 40.4897 },
    { code: 'GAB', name: 'Gabon', lat: -0.8037, lng: 11.6094 },
    { code: 'GMB', name: 'Gambia', lat: 13.4432, lng: -15.3101 },
    { code: 'GHA', name: 'Ghana', lat: 7.9465, lng: -1.0232 },
    { code: 'GIN', name: 'Guinea', lat: 9.9456, lng: -9.6966 },
    { code: 'GNB', name: 'Guinea-Bissau', lat: 11.8037, lng: -15.1804 },
    { code: 'KEN', name: 'Kenya', lat: -0.0236, lng: 37.9062 },
    { code: 'LSO', name: 'Lesotho', lat: -29.61, lng: 28.2336 },
    { code: 'LBR', name: 'Liberia', lat: 6.4281, lng: -9.4295 },
    { code: 'MDG', name: 'Madagascar', lat: -18.7669, lng: 46.8691 },
    { code: 'MWI', name: 'Malawi', lat: -13.2543, lng: 34.3015 },
    { code: 'MLI', name: 'Mali', lat: 17.5707, lng: -3.9962 },
    { code: 'MRT', name: 'Mauritania', lat: 21.0079, lng: -10.9408 },
    { code: 'MUS', name: 'Mauritius', lat: -20.3484, lng: 57.5522 },
    { code: 'MOZ', name: 'Mozambique', lat: -18.6657, lng: 35.5296 },
    { code: 'NAM', name: 'Namibia', lat: -22.9576, lng: 18.4904 },
    { code: 'NER', name: 'Niger', lat: 17.6078, lng: 8.0817 },
    { code: 'NGA', name: 'Nigeria', lat: 9.082, lng: 8.6753 },
    { code: 'RWA', name: 'Rwanda', lat: -1.9403, lng: 29.8739 },
    { code: 'STP', name: 'Sao Tome and Principe', lat: 0.1864, lng: 6.6131 },
    { code: 'SEN', name: 'Senegal', lat: 14.4974, lng: -14.4524 },
    { code: 'SYC', name: 'Seychelles', lat: -4.6796, lng: 55.492 },
    { code: 'SLE', name: 'Sierra Leone', lat: 8.461, lng: -11.7799 },
    { code: 'ZAF', name: 'South Africa', lat: -30.5595, lng: 22.9375 },
    { code: 'SSD', name: 'South Sudan', lat: 6.877, lng: 31.307 },
    { code: 'TZA', name: 'Tanzania', lat: -6.369, lng: 34.8888 },
    { code: 'TGO', name: 'Togo', lat: 8.6195, lng: 0.8248 },
    { code: 'UGA', name: 'Uganda', lat: 1.3733, lng: 32.2903 },
    { code: 'ZMB', name: 'Zambia', lat: -13.1339, lng: 27.8493 },
    { code: 'ZWE', name: 'Zimbabwe', lat: -19.0154, lng: 29.1549 },
];

export const AFRO_COUNTRIES: Region[] = AFRO_COUNTRY_DATA.map((country) => ({
    id: country.code,
    name: country.name,
    adminLevel: 'country',
    countryCode: country.code,
    centroid: { lat: country.lat, lng: country.lng },
}));

export const AFRO_COUNTRY_NAMES = AFRO_COUNTRY_DATA.map((c) => c.name);

export type AFROCountry = (typeof AFRO_COUNTRY_NAMES)[number];
