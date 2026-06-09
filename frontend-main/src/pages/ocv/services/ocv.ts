import rawData from '../data/ocv_data.json';
import { COVERAGE_BANDS, AFRO_TARGET, MAP_W, MAP_H, MAP_LON_MIN, MAP_LON_MAX, MAP_LAT_MIN, MAP_LAT_MAX, TREND_YEARS } from '../constants/ocv';

/** A row from countries_2024 — vaccine coverage values are nullable (no data reported). */
export interface OCVCountry {
  code: string;
  name: string;
  MCV1: number | null;
  MCV2?: number | null;
  DTP1?: number | null;
  DTP3: number | null;
  YFV: number | null;
  MCV1_doses?: number | null;
  /** Bag of additional antigen / metadata fields the JSON may include. */
  [antigen: string]: unknown;
}

/** Country enriched with derived metrics. */
export interface OCVEnrichedCountry extends OCVCountry {
  dropout: number | null;
  riskScore: number | null;
  band: typeof COVERAGE_BANDS[number];
}

/** A row of antigen × country trends. The raw JSON includes some extra
 *  metadata columns (name, etc.), accepted via index signature. */
export interface OCVTrend {
  code: string;
  antigen: string;
  years: Record<string, number | null>;
  [extra: string]: unknown;
}

/** A row of AFRO-wide annual averages. */
export interface OCVAfroAvg {
  antigen: string;
  year: number;
  avg: number;
  [extra: string]: unknown;
}

export interface OCVAlert {
  type: string;
  color: string;
  msg: string;
}

/**
 * Return the coverage band object for a given coverage value.
 */
export function getCoverageBand(value: number | null | undefined) {
  if (value === null || value === undefined) return COVERAGE_BANDS[2];
  if (value >= 95) return COVERAGE_BANDS[0];
  if (value >= 80) return COVERAGE_BANDS[1];
  return COVERAGE_BANDS[2];
}

/**
 * Return the hex color string for a coverage value.
 */
export function coverageColor(value: number | null | undefined) {
  return getCoverageBand(value).color;
}

/**
 * Format a coverage percentage for display.
 */
export function fmt(value: number | null | undefined, decimals = 1) {
  if (value === null || value === undefined) return 'N/A';
  return `${Math.min(value, 150).toFixed(decimals)}%`;
}

/**
 * Format a dose count with M/K suffixes.
 */
export function fmtDoses(value: number | null | undefined) {
  if (!value) return 'N/A';
  if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(0)}K`;
  return value.toFixed(0);
}

/**
 * Convert geographic lat/lon to SVG x/y pixel coordinates.
 */
export function geoToXY(lat: number, lon: number) {
  const x = ((lon - MAP_LON_MIN) / (MAP_LON_MAX - MAP_LON_MIN)) * MAP_W;
  const y = ((MAP_LAT_MAX - lat) / (MAP_LAT_MAX - MAP_LAT_MIN)) * MAP_H;
  return [x, y];
}

/**
 * Compute the immunity gap score for a country.
 */
export function calcImmunityGap(country: OCVCountry, antigens = ['MCV1', 'DTP3', 'YFV']) {
  let sum = 0, n = 0;
  for (const ag of antigens) {
    const val = country[ag];
    if (typeof val === 'number') {
      sum += Math.max(0, AFRO_TARGET - val);
      n++;
    }
  }
  return n > 0 ? +(sum / n).toFixed(1) : null;
}

/**
 * Compute DTP1→DTP3 dropout rate for a country.
 */
export function calcDropout(country: OCVCountry) {
  if (typeof country.DTP1 === 'number' && typeof country.DTP3 === 'number') {
    return +(country.DTP1 - country.DTP3).toFixed(1);
  }
  return null;
}

/**
 * Enrich raw country_2024 records with derived metrics.
 */
export function enrichCountries(rawCountries: OCVCountry[]): OCVEnrichedCountry[] {
  return rawCountries.map((c) => ({
    ...c,
    dropout: calcDropout(c),
    riskScore: calcImmunityGap(c),
    band: getCoverageBand(c.MCV1),
  }));
}

/**
 * Build a lookup for trends.
 */
export function buildTrendsMap(trendsArray: OCVTrend[]) {
  const map: Record<string, Record<string, OCVTrend['years']>> = {};
  for (const t of trendsArray) {
    if (!map[t.code]) map[t.code] = {};
    map[t.code][t.antigen] = t.years;
  }
  return map;
}

/**
 * Build a lookup for regional averages.
 */
export function buildAvgMap(afroAvgsArray: OCVAfroAvg[]) {
  const map: Record<string, Record<number, number>> = {};
  for (const r of afroAvgsArray) {
    if (!map[r.antigen]) map[r.antigen] = {};
    map[r.antigen][r.year] = r.avg;
  }
  return map;
}

/**
 * Generate PDX cross-dashboard intelligence alerts for a country.
 */
/** Accept either a freshly enriched country or any OCVCountry-shaped row;
 *  the renderer's local "OCVCountry" definition includes the derived fields. */
export function getPDXAlerts(country: OCVCountry & Partial<Pick<OCVEnrichedCountry, 'dropout' | 'riskScore'>>): OCVAlert[] {
  const alerts: OCVAlert[] = [];
  if (country.MCV1 !== null && country.MCV1 < 80) {
    alerts.push({ type: 'TRIAD', color: '#ff4757', msg: 'Low MCV1 coverage → elevated measles spillover risk' });
  }
  if (country.dropout != null && country.dropout > 10) {
    alerts.push({ type: 'HSSPM', color: '#ffb800', msg: `DTP dropout ${country.dropout}% → health system access gap signal` });
  }
  if (country.YFV !== null && country.YFV < 80) {
    alerts.push({ type: 'TRIAD', color: '#ffb800', msg: 'Low YFV coverage → Yellow Fever outbreak risk zone' });
  }
  if (country.riskScore != null && country.riskScore > 15) {
    alerts.push({ type: 'Risk Sentinel', color: '#ff4757', msg: 'Multi-antigen immunity gap → Priority Alert candidate' });
  }
  if (country.MCV2 != null && country.MCV2 < 75) {
    alerts.push({ type: 'HSSPM', color: '#ffb800', msg: 'Low MCV2 coverage → second-dose programme weakness' });
  }
  return alerts;
}

/**
 * Normalize country names for GeoJSON matching.
 */
export function normalizeCountryName(name: string): string {
  const normalized = name.toLowerCase().trim();
  const mappings: Record<string, string> = {
    'united republic of tanzania': 'tanzania',
    'democratic republic of the congo': 'drc',
    'congo (democratic republic of the)': 'drc',
    'dr congo': 'drc',
    'republic of the congo': 'congo',
    'republic of congo': 'congo',
    'ivory coast': 'côte d\'ivoire',
    'cote d\'ivoire': 'côte d\'ivoire',
    'cote d’ivoire': 'côte d\'ivoire',
    'guinea bissau': 'guinea-bissau',
    'somaliland': 'somalia',
    'swaziland': 'eswatini',
    'the gambia': 'gambia',
    'cabo verde': 'cape verde',
  };
  return mappings[normalized] || normalized;
}

/**
 * Main service to fetch and process OCV data.
 */
export const ocvService = {
  getRawData: () => rawData,
  getProcessedData: () => {
    const countries = enrichCountries(rawData.countries_2024 as unknown as OCVCountry[]);
    const trendsMap = buildTrendsMap(rawData.trends as unknown as OCVTrend[]);
    const avgMap = buildAvgMap(rawData.afro_averages as unknown as OCVAfroAvg[]);

    const mcv1Vals = countries
      .map((c: OCVEnrichedCountry) => c.MCV1)
      .filter((v): v is number => v !== null && v !== undefined);
    const avg = mcv1Vals.reduce((a: number, b: number) => a + b, 0) / (mcv1Vals.length || 1);
    const below95 = countries.filter((c: OCVEnrichedCountry) => c.MCV1 !== null && c.MCV1 < 95).length;
    const critical = countries.filter((c: OCVEnrichedCountry) => c.MCV1 !== null && c.MCV1 < 80).length;
    const totalDoses = countries.reduce((s: number, c: OCVEnrichedCountry) => s + (c.MCV1_doses || 0), 0);
    const reporting = mcv1Vals.length;

    const avg2020 = avgMap['MCV1']?.[2020] ?? null;
    const avg2024 = avgMap['MCV1']?.[2024] ?? null;
    const recovery = (avg2020 && avg2024) ? +(avg2024 - avg2020).toFixed(1) : null;

    const dropouts = countries
      .filter((c: OCVEnrichedCountry) => c.dropout !== null)
      .map((c: OCVEnrichedCountry) => c.dropout as number);
    const avgDropout = dropouts.length
      ? +(dropouts.reduce((a: number, b: number) => a + b, 0) / dropouts.length).toFixed(1)
      : null;

    return {
      countries,
      trendsMap,
      avgMap,
      measlesCases: rawData.measles_cases,
      yfCases: rawData.yf_cases,
      metadata: rawData.metadata,
      kpis: {
        mcv1Avg: +avg.toFixed(1),
        below95,
        critical,
        totalDoses,
        reporting,
        recovery,
        avgDropout,
      },
      trendYears: TREND_YEARS,
    };
  }
};
