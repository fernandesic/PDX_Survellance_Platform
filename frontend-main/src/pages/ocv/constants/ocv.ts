// ─────────────────────────────────────────────────────────────────────────────
// PDX OCV — Shared Constants
// WHO AFRO Health Emergency Preparedness · OCV Intelligence Platform
// ─────────────────────────────────────────────────────────────────────────────

export const ANTIGENS = [
  { key: 'MCV1', label: 'Measles (MCV1)', shortLabel: 'MCV1', color: '#00d4ff', disease: 'Measles', icon: '🔴' },
  { key: 'MCV2', label: 'Measles (MCV2)', shortLabel: 'MCV2', color: '#7b61ff', disease: 'Measles', icon: '🔴' },
  { key: 'YFV', label: 'Yellow Fever', shortLabel: 'YFV', color: '#ffb800', disease: 'Yellow Fever', icon: '🟡' },
  { key: 'DTP1', label: 'DTP (Dose 1)', shortLabel: 'DTP1', color: '#00e5a0', disease: 'DTP', icon: '🟢' },
  { key: 'DTP3', label: 'DTP (Dose 3)', shortLabel: 'DTP3', color: '#ff6b6b', disease: 'DTP', icon: '🟢' },
]

export const COVERAGE_BANDS = [
  { min: 95, label: 'Target Met', color: '#00e5a0', bg: 'rgba(0,229,160,0.12)' },
  { min: 80, label: 'Adequate', color: '#ffb800', bg: 'rgba(255,184,0,0.12)' },
  { min: 0, label: 'Critical', color: '#ff4757', bg: 'rgba(255,71,87,0.12)' },
]

export const AFRO_TARGET = 95   // WHO coverage target (%)

export const YEARS = ['2010', '2011', '2012', '2013', '2014', '2015', '2016', '2017', '2018', '2019', '2020', '2021', '2022', '2023', '2024']
export const TREND_YEARS = ['2015', '2016', '2017', '2018', '2019', '2020', '2021', '2022', '2023', '2024']

/** Approximate lat/lon centroid for each AFRO ISO-3 country code */
export const AFRO_ISO3_COORDS = {
  TZA: { lat: -6.37, lon: 34.89 },
  ZMB: { lat: -13.13, lon: 27.85 },
  ZWE: { lat: -19.00, lon: 29.15 },
  AGO: { lat: -11.20, lon: 17.87 },
  BDI: { lat: -3.37, lon: 29.92 },
  BEN: { lat: 9.31, lon: 2.32 },
  BFA: { lat: 12.36, lon: -1.53 },
  BWA: { lat: -22.32, lon: 24.68 },
  CPV: { lat: 16.00, lon: -24.01 },
  CMR: { lat: 3.86, lon: 11.52 },
  CAF: { lat: 6.61, lon: 20.94 },
  TCD: { lat: 15.45, lon: 18.73 },
  COM: { lat: -11.64, lon: 43.33 },
  COG: { lat: -0.23, lon: 15.83 },
  CIV: { lat: 7.54, lon: -5.55 },
  COD: { lat: -4.03, lon: 21.76 },
  GNQ: { lat: 1.65, lon: 10.27 },
  ERI: { lat: 15.18, lon: 39.78 },
  SWZ: { lat: -26.52, lon: 31.47 },
  ETH: { lat: 9.14, lon: 40.49 },
  GAB: { lat: -0.80, lon: 11.61 },
  GMB: { lat: 13.44, lon: -15.31 },
  GHA: { lat: 7.95, lon: -1.02 },
  GIN: { lat: 9.95, lon: -11.77 },
  GNB: { lat: 11.80, lon: -15.18 },
  KEN: { lat: -0.02, lon: 37.91 },
  LSO: { lat: -29.61, lon: 28.23 },
  LBR: { lat: 6.43, lon: -9.43 },
  MDG: { lat: -18.77, lon: 46.87 },
  MWI: { lat: -13.25, lon: 34.30 },
  MLI: { lat: 17.57, lon: -3.99 },
  MRT: { lat: 21.00, lon: -10.94 },
  MUS: { lat: -20.35, lon: 57.55 },
  MOZ: { lat: -18.66, lon: 35.53 },
  NAM: { lat: -22.96, lon: 18.49 },
  NER: { lat: 17.61, lon: 8.08 },
  NGA: { lat: 9.08, lon: 8.68 },
  RWA: { lat: -1.94, lon: 29.87 },
  STP: { lat: 0.19, lon: 6.61 },
  SEN: { lat: 14.50, lon: -14.45 },
  SYC: { lat: -4.68, lon: 55.49 },
  SLE: { lat: 8.46, lon: -11.78 },
  SOM: { lat: 5.15, lon: 46.20 },
  ZAF: { lat: -30.56, lon: 22.94 },
  SSD: { lat: 7.86, lon: 29.69 },
  SDN: { lat: 12.86, lon: 30.22 },
  TGO: { lat: 8.62, lon: 0.82 },
  UGA: { lat: 1.37, lon: 32.29 },
  DZA: { lat: 28.03, lon: 1.66 },
}

/** OCV campaign data — AFRO reactive & preventive 2025–2026 */
export const OCV_CAMPAIGNS = [
  { country: 'DRC', code: 'COD', type: 'Reactive', status: 'Completed', doses: '3.2M', date: 'Jan 2025', risk: 'High' },
  { country: 'Nigeria', code: 'NGA', type: 'Reactive', status: 'Ongoing', doses: '7.5M', date: 'Feb 2025', risk: 'High' },
  { country: 'Mozambique', code: 'MOZ', type: 'Preventive', status: 'Completed', doses: '1.4M', date: 'Feb 2026', risk: 'Medium' },
  { country: 'South Sudan', code: 'SSD', type: 'Reactive', status: 'Planned', doses: '290K', date: 'Q2 2026', risk: 'High' },
  { country: 'Ethiopia', code: 'ETH', type: 'Reactive', status: 'Completed', doses: '3.5M', date: 'Mar 2025', risk: 'High' },
  { country: 'Sudan', code: 'SDN', type: 'Reactive', status: 'Ongoing', doses: '1.1M', date: 'Mar 2026', risk: 'High' },
  { country: 'Angola', code: 'AGO', type: 'Reactive', status: 'Ongoing', doses: '900K', date: 'Mar 2026', risk: 'High' },
  { country: 'Chad', code: 'TCD', type: 'Preventive', status: 'Planned', doses: '870K', date: 'Q2 2026', risk: 'Medium' },
]

export const STATUS_COLORS: Record<string, string> = {
  Completed: '#00e5a0',
  Ongoing: '#ffb800',
  Planned: '#7b61ff',
}

/** PDX cross-dashboard link targets */
export const PDX_DASHBOARDS = ['TRIAD', 'Risk Sentinel', 'HSSPM', 'Decision WHO']

/** Map viewport constants */
export const MAP_W = 500
export const MAP_H = 420
export const MAP_LON_MIN = -20
export const MAP_LON_MAX = 55
export const MAP_LAT_MIN = -36
export const MAP_LAT_MAX = 37
