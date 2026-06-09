// @ts-nocheck
import { Country, RiskPrepData, OutbreakData } from './types';

const COUNTRIES: Country[] = [
    { iso: "SOM", name: "Somalia", inform_base: 8.9, ghs_base: 19.2, population: 15_000_000, priority: 1, latitude: 2.0469, longitude: 45.3182 },
    { iso: "YEM", name: "Yemen", inform_base: 8.6, ghs_base: 18.2, population: 29_000_000, priority: 1, latitude: 15.3694, longitude: 44.1910 },
    { iso: "SSD", name: "South Sudan", inform_base: 8.5, ghs_base: 22.5, population: 11_000_000, priority: 1, latitude: 4.8594, longitude: 31.5713 },
    { iso: "COD", name: "DR Congo", inform_base: 7.8, ghs_base: 25.1, population: 89_000_000, priority: 1, latitude: -4.4419, longitude: 15.2663 },
    { iso: "ETH", name: "Ethiopia", inform_base: 7.1, ghs_base: 30.8, population: 115_000_000, priority: 2, latitude: 9.0300, longitude: 38.7400 },
    { iso: "NGA", name: "Nigeria", inform_base: 6.5, ghs_base: 38.9, population: 206_000_000, priority: 2, latitude: 9.0765, longitude: 7.3986 },
    { iso: "SLE", name: "Sierra Leone", inform_base: 6.8, ghs_base: 42.1, population: 8_000_000, priority: 2, latitude: 8.4657, longitude: -13.2317 },
    { iso: "MWI", name: "Malawi", inform_base: 5.8, ghs_base: 35.5, population: 19_000_000, priority: 3, latitude: -13.9630, longitude: 33.7741 },
    { iso: "ZWE", name: "Zimbabwe", inform_base: 6.2, ghs_base: 45.1, population: 14_000_000, priority: 2, latitude: -17.8252, longitude: 31.0335 }
];

export const getCountries = (): Country[] => COUNTRIES;

export const generateMockData = (): { riskPrepData: RiskPrepData[], outbreakData: OutbreakData[] } => {
    const riskPrepData: RiskPrepData[] = [];
    const outbreakData: OutbreakData[] = [];
    const today = new Date();
    const dates: Date[] = [];

    for (let i = 24; i >= 0; i--) {
        dates.push(new Date(today.getFullYear(), today.getMonth() - i, 1));
    }

    COUNTRIES.forEach(country => {
        dates.forEach(d => {
            riskPrepData.push({
                country_iso: country.iso,
                date: d,
                inform_risk: country.inform_base + (Math.random() - 0.5) * 0.2,
                inform_vulnerability: country.inform_base + 0.5 + (Math.random() - 0.5) * 0.2,
                ghs_preparedness: country.ghs_base + (Math.random() - 0.5) * 1.0
            });
        });
        
        const diseases = ['Cholera', 'Ebola', 'Mpox', 'Lassa', 'Diphtheria'];

        const caseTrends: {[key: string]: number} = {
            'Cholera': (country.inform_base / 10) * 500,
            'Ebola': ["COD", "SSD"].includes(country.iso) ? 2 : 0,
            'Mpox': ["COD", "NGA"].includes(country.iso) ? 5 : 0,
            'Lassa': ["NGA", "SLE"].includes(country.iso) ? 10 : 0,
            'Diphtheria': ["NGA", "YEM"].includes(country.iso) ? 8 : 0,
        };

        dates.forEach((d, i) => {
             diseases.forEach(disease => {
                 let cases = caseTrends[disease] || 0;
                 if (cases > 0) {
                     const seasonality = Math.sin((d.getMonth() / 12) * 2 * Math.PI) * 0.3 + 1;
                     cases += (Math.random() - 0.45) * (cases * 0.1) * seasonality;
                     if (i > 18 + Math.random() * 4) cases *= 1.15; // Recent random spike
                     caseTrends[disease] = Math.max(0, cases);
                 }
                 outbreakData.push({ 
                    country_iso: country.iso, 
                    date: d, 
                    disease: disease, 
                    cases: Math.round(caseTrends[disease]) 
                });
             });
        });
    });

    return { riskPrepData, outbreakData };
};
