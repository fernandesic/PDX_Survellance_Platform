/**
 * Static fallback data for One Health dashboard.
 * Used when the TRIAD API is unreachable.
 */

export interface StaticCountry {
  iso3: string;
  name: string;
  lat: number;
  lon: number;
  risk: number;
  spar: number;
  tier: number;
  sub: string;
  alert?: { tier: number; disease: string; note: string };
}

export const COUNTRIES: StaticCountry[] = [
  { iso3: "AGO", name: "Angola", lat: -11.2, lon: 17.87, risk: 4.2, spar: 42, tier: 0, sub: "Central Africa" },
  { iso3: "BEN", name: "Benin", lat: 9.31, lon: 2.32, risk: 3.8, spar: 48, tier: 0, sub: "West Africa" },
  { iso3: "BWA", name: "Botswana", lat: -22.33, lon: 24.68, risk: 2.1, spar: 62, tier: 0, sub: "Southern Africa" },
  { iso3: "BFA", name: "Burkina Faso", lat: 12.36, lon: -1.53, risk: 6.1, spar: 38, tier: 2, sub: "West Africa" },
  { iso3: "BDI", name: "Burundi", lat: -3.37, lon: 29.92, risk: 5.8, spar: 35, tier: 2, sub: "East Africa" },
  { iso3: "CPV", name: "Cabo Verde", lat: 16.0, lon: -24.01, risk: 1.2, spar: 70, tier: 0, sub: "West Africa" },
  { iso3: "CMR", name: "Cameroon", lat: 3.86, lon: 11.52, risk: 5.5, spar: 44, tier: 2, sub: "Central Africa" },
  { iso3: "CAF", name: "Cent. Afr. Rep.", lat: 6.61, lon: 20.94, risk: 8.8, spar: 22, tier: 3, sub: "Central Africa" },
  { iso3: "TCD", name: "Chad", lat: 15.45, lon: 18.73, risk: 7.9, spar: 28, tier: 2, sub: "Central Africa" },
  { iso3: "COM", name: "Comoros", lat: -11.64, lon: 43.33, risk: 3.1, spar: 45, tier: 0, sub: "East Africa" },
  { iso3: "COD", name: "DR Congo", lat: -4.03, lon: 21.75, risk: 9.2, spar: 24, tier: 3, sub: "Central Africa", alert: { tier: 3, disease: "Ebola VD", note: "Lab+ · 2 confirmed cases" } },
  { iso3: "COG", name: "Congo Rep.", lat: -0.23, lon: 15.83, risk: 5.1, spar: 40, tier: 0, sub: "Central Africa" },
  { iso3: "CIV", name: "Côte d'Ivoire", lat: 7.54, lon: -5.55, risk: 4.4, spar: 50, tier: 0, sub: "West Africa" },
  { iso3: "GNQ", name: "Eq. Guinea", lat: 1.65, lon: 10.27, risk: 3.9, spar: 38, tier: 0, sub: "Central Africa" },
  { iso3: "ERI", name: "Eritrea", lat: 15.18, lon: 39.78, risk: 5.4, spar: 30, tier: 0, sub: "East Africa" },
  { iso3: "SWZ", name: "Eswatini", lat: -26.52, lon: 31.47, risk: 2.8, spar: 55, tier: 0, sub: "Southern Africa" },
  { iso3: "ETH", name: "Ethiopia", lat: 9.15, lon: 40.49, risk: 6.8, spar: 69, tier: 2, sub: "East Africa" },
  { iso3: "GAB", name: "Gabon", lat: -0.8, lon: 11.61, risk: 3.5, spar: 52, tier: 0, sub: "Central Africa" },
  { iso3: "GMB", name: "Gambia", lat: 13.44, lon: -15.31, risk: 3.2, spar: 48, tier: 0, sub: "West Africa" },
  { iso3: "GHA", name: "Ghana", lat: 7.95, lon: -1.02, risk: 3.8, spar: 55, tier: 0, sub: "West Africa" },
  { iso3: "GIN", name: "Guinea", lat: 10.99, lon: -10.91, risk: 7.4, spar: 32, tier: 3, sub: "West Africa", alert: { tier: 3, disease: "Mpox Clade I", note: "8 cases · Zoonotic link" } },
  { iso3: "GNB", name: "Guinea-Bissau", lat: 11.8, lon: -15.18, risk: 6.2, spar: 30, tier: 2, sub: "West Africa" },
  { iso3: "KEN", name: "Kenya", lat: -0.02, lon: 37.91, risk: 5.2, spar: 58, tier: 2, sub: "East Africa", alert: { tier: 2, disease: "Rift Valley Fever", note: "Cattle mortality 28%" } },
  { iso3: "LSO", name: "Lesotho", lat: -29.61, lon: 28.23, risk: 2.5, spar: 52, tier: 0, sub: "Southern Africa" },
  { iso3: "LBR", name: "Liberia", lat: 6.43, lon: -9.43, risk: 6.5, spar: 34, tier: 2, sub: "West Africa" },
  { iso3: "MDG", name: "Madagascar", lat: -18.77, lon: 46.87, risk: 5.8, spar: 40, tier: 2, sub: "Southern Africa" },
  { iso3: "MWI", name: "Malawi", lat: -13.25, lon: 34.3, risk: 4.2, spar: 48, tier: 0, sub: "Southern Africa" },
  { iso3: "MLI", name: "Mali", lat: 17.57, lon: -4.0, risk: 7.6, spar: 28, tier: 2, sub: "West Africa" },
  { iso3: "MRT", name: "Mauritania", lat: 21.01, lon: -10.94, risk: 5.0, spar: 38, tier: 0, sub: "West Africa" },
  { iso3: "MUS", name: "Mauritius", lat: -20.28, lon: 57.55, risk: 0.9, spar: 78, tier: 0, sub: "Southern Africa" },
  { iso3: "MOZ", name: "Mozambique", lat: -17.27, lon: 35.55, risk: 5.5, spar: 42, tier: 2, sub: "Southern Africa" },
  { iso3: "NAM", name: "Namibia", lat: -22.96, lon: 18.49, risk: 1.8, spar: 62, tier: 0, sub: "Southern Africa" },
  { iso3: "NER", name: "Niger", lat: 17.61, lon: 8.08, risk: 7.8, spar: 26, tier: 2, sub: "West Africa" },
  { iso3: "NGA", name: "Nigeria", lat: 9.08, lon: 8.68, risk: 8.5, spar: 52, tier: 4, sub: "West Africa", alert: { tier: 4, disease: "HPAI H5N1", note: "74 birds · 3 humans exposed" } },
  { iso3: "RWA", name: "Rwanda", lat: -1.94, lon: 29.87, risk: 2.8, spar: 65, tier: 0, sub: "East Africa" },
  { iso3: "STP", name: "São Tomé & Pr.", lat: 0.18, lon: 6.61, risk: 2.0, spar: 48, tier: 0, sub: "Central Africa" },
  { iso3: "SEN", name: "Senegal", lat: 14.5, lon: -14.45, risk: 4.0, spar: 58, tier: 0, sub: "West Africa" },
  { iso3: "SLE", name: "Sierra Leone", lat: 8.46, lon: -11.78, risk: 6.8, spar: 30, tier: 2, sub: "West Africa" },
  { iso3: "SOM", name: "Somalia", lat: 5.15, lon: 46.2, risk: 9.5, spar: 18, tier: 2, sub: "East Africa" },
  { iso3: "ZAF", name: "South Africa", lat: -30.56, lon: 22.94, risk: 2.2, spar: 68, tier: 0, sub: "Southern Africa" },
  { iso3: "SSD", name: "South Sudan", lat: 6.88, lon: 31.31, risk: 9.1, spar: 20, tier: 2, sub: "East Africa" },
  { iso3: "TZA", name: "Tanzania", lat: -6.37, lon: 34.89, risk: 4.5, spar: 52, tier: 0, sub: "East Africa" },
  { iso3: "TGO", name: "Togo", lat: 8.62, lon: 0.82, risk: 3.5, spar: 46, tier: 0, sub: "West Africa" },
  { iso3: "UGA", name: "Uganda", lat: 1.37, lon: 32.29, risk: 5.8, spar: 55, tier: 2, sub: "East Africa" },
  { iso3: "ZMB", name: "Zambia", lat: -13.13, lon: 27.85, risk: 4.8, spar: 50, tier: 2, sub: "Southern Africa", alert: { tier: 2, disease: "Cholera", note: "312 cases · +42% this week" } },
  { iso3: "ZWE", name: "Zimbabwe", lat: -19.02, lon: 29.15, risk: 4.2, spar: 48, tier: 0, sub: "Southern Africa" },
];

export const EPI_LINKS = [
  { from: "NGA", to: "CMR", type: "zoonotic" },
  { from: "COD", to: "UGA", type: "zoonotic" },
  { from: "GIN", to: "LBR", type: "zoonotic" },
  { from: "GIN", to: "SLE", type: "zoonotic" },
  { from: "COD", to: "COG", type: "proximity" },
  { from: "ETH", to: "SSD", type: "proximity" },
  { from: "CAF", to: "COD", type: "proximity" },
];

export const DISEASES = [
  { name: "HPAI H5N1", r0: 1.85, cfr: 55, r0Range: "0.8–1.0 human", riskLabel: "Critical", riskScore: 89 },
  { name: "Ebola VD", r0: 2.0, cfr: 50, r0Range: "1.5–2.5", riskLabel: "Critical", riskScore: 82 },
  { name: "Mpox Clade I", r0: 1.5, cfr: 4, r0Range: "0.6–2.4", riskLabel: "High", riskScore: 71 },
  { name: "Rift Valley Fever", r0: 1.2, cfr: 1, r0Range: "1.0–1.5", riskLabel: "High", riskScore: 68 },
  { name: "Cholera", r0: 2.5, cfr: 2, r0Range: "1.0–3.0", riskLabel: "Moderate", riskScore: 0 },
];

export function riskColor(v: number): string {
  if (v < 2) return "rgba(13,26,39,0.8)";
  if (v < 4) return "rgba(15,72,130,0.55)";
  if (v < 6) return "rgba(0,168,150,0.5)";
  if (v < 8) return "rgba(245,180,50,0.55)";
  return "rgba(255,61,90,0.65)";
}

export function riskColorRgba(v: number): [number, number, number, number] {
  if (v < 2) return [13, 26, 39, 0.8];
  if (v < 4) return [15, 72, 130, 0.55];
  if (v < 6) return [0, 168, 150, 0.5];
  if (v < 8) return [245, 180, 50, 0.55];
  return [255, 61, 90, 0.65];
}

export function tierBorderColor(t: number): string {
  if (t === 4) return "#ff3d5a";
  if (t === 3) return "#ffb347";
  if (t === 2) return "#4f8ef7";
  return "rgba(255,255,255,0.1)";
}

export function tierBorderRgba(t: number): [number, number, number, number] {
  if (t === 4) return [255, 61, 90, 1];
  if (t === 3) return [255, 179, 71, 1];
  if (t === 2) return [79, 142, 247, 1];
  return [255, 255, 255, 0.1];
}
