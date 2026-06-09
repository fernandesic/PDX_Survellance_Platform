/**
 * Ghana PDX — Data Service Layer
 *
 * Thin wrappers around existing platform services, all hardcoded to
 * country = "Ghana" / ISO = "GHA".  No dropdown, no user selection.
 *
 * Used by: useGhanaData hook → GhanaPdx tab components
 */

import { GHANA_COUNTRY_NAME, GHANA_ISO } from '../constants';

// ── Existing services ──
import { espar } from '@/pages/ihr/services/espar';
import { chwService } from '@/pages/chw/services/chw';
import { readiness } from '@/pages/readiness/services/readiness';
import { stardata } from '@/pages/stardata/services/stardata';
import { fetchSignals } from '@/pages/alerts/services/sentinelService';
import { predictionsApi } from '@/pages/predictions/services/predictionsApi';
import { ihmref } from '@/pages/ihmref/services/ihmref';


/* ──────────────────────────────────────────────────────────────────
 *  Overview (Replaced by specific scoped queries in GhanaOverviewTab)
 * ────────────────────────────────────────────────────────────────── */


/* ──────────────────────────────────────────────────────────────────
 *  IHR / ESPAR
 * ────────────────────────────────────────────────────────────────── */

export async function getGhanaIHR(year: string) {
  const res = await espar.summary(GHANA_COUNTRY_NAME, year);
  return res.data;
}


/* ──────────────────────────────────────────────────────────────────
 *  CHW — Community Health Workers
 * ────────────────────────────────────────────────────────────────── */

/** List all countries, find Ghana, return its id + summary row. */
export async function getGhanaCHWSummary() {
  const response = await chwService.countries();
  const countriesList = Array.isArray(response) ? response : ((response as any).results || (response as any).data || []);
  const ghana = countriesList.find(
    (c: any) =>
      c.country?.toLowerCase() === GHANA_COUNTRY_NAME.toLowerCase() ||
      c.iso_code === GHANA_ISO,
  );
  return ghana ?? null;
}

/** Region-level detail for Ghana (requires country id). */
export async function getGhanaCHWDetail(ghanaCountryId: number) {
  return await chwService.countryDetail(ghanaCountryId);
}

/** Worker types breakdown for Ghana (requires country id). */
export async function getGhanaCHWWorkerTypes(ghanaCountryId: number) {
  return await chwService.workerTypes(ghanaCountryId);
}


/* ──────────────────────────────────────────────────────────────────
 *  Readiness
 * ────────────────────────────────────────────────────────────────── */

export async function getGhanaReadiness(
  tab: string,
  page = 1,
  pageSize = 15,
) {
  return await readiness.summary(page, pageSize, tab, GHANA_COUNTRY_NAME);
}

export async function getGhanaHazardMonitor() {
  return await readiness.hazardMonitor(GHANA_COUNTRY_NAME);
}

/** Aggregate readiness completion for Ghana across all hazard categories. */
const READINESS_CATS = ['Arbo Virus', 'Cholera', 'Ebola', 'Meningitis', 'Mpox', 'Pandemic Influenza'];

export async function getGhanaReadinessOverall(): Promise<{ overall_completion: number; by_category: { category: string; avg: number }[] }> {
  const results = await Promise.allSettled(
    READINESS_CATS.map(cat => readiness.summary(1, 100, cat, GHANA_COUNTRY_NAME)),
  );

  const byCategory: { category: string; avg: number }[] = [];
  for (let i = 0; i < READINESS_CATS.length; i++) {
    const r = results[i];
    if (r.status !== 'fulfilled') continue;
    const items = (r.value as any)?.data?.results ?? [];
    if (!items.length) continue;
    const scores = items.map((it: any) => it.score ?? it.completion_pct ?? 0);
    const avg = scores.reduce((a: number, b: number) => a + b, 0) / scores.length;
    byCategory.push({ category: READINESS_CATS[i], avg: Math.round(avg) });
  }

  const overall = byCategory.length
    ? Math.round(byCategory.reduce((s, c) => s + c.avg, 0) / byCategory.length)
    : 0;

  return { overall_completion: overall, by_category: byCategory };
}


/* ──────────────────────────────────────────────────────────────────
 *  STAR Tracker — local offline data, filtered for Ghana
 * ────────────────────────────────────────────────────────────────── */

export async function getGhanaStarSummary(month?: string) {
  // Star data uses offline JSON; charts & activeHazards accept country param
  return await stardata.charts(GHANA_COUNTRY_NAME, month);
}

export async function getGhanaActiveHazards(month?: string) {
  return await stardata.activeHazards(GHANA_COUNTRY_NAME, month);
}

export async function getGhanaUpcomingHazards(month?: string) {
  return await stardata.upcomingHazards(GHANA_COUNTRY_NAME, month);
}

export async function getGhanaStarList(
  page = 1,
  pageSize = 20,
  severity?: string,
  month?: string,
) {
  return await stardata.list(page, pageSize, severity, GHANA_COUNTRY_NAME, month);
}


/* ──────────────────────────────────────────────────────────────────
 *  Alerts — Sentinel signals filtered for Ghana
 * ────────────────────────────────────────────────────────────────── */

export async function getGhanaAlerts(filters?: {
  priority?: string;
  status?: string;
  disease?: string;
}) {
  return await fetchSignals({
    ...filters,
    country: GHANA_ISO,
  });
}


/* ──────────────────────────────────────────────────────────────────
 *  Predictions — filtered / scoped to Ghana
 * ────────────────────────────────────────────────────────────────── */

export async function getGhanaPredictions() {
  return await predictionsApi.list({ country: GHANA_ISO });
}

export async function getGhanaPredictionsSummary() {
  // Scope the summary to Ghana so KPIs reflect GHA-only predictions, not the
  // continental aggregate.
  return await predictionsApi.summary({ country: GHANA_ISO });
}

export async function getGhanaCountryForecast() {
  return await predictionsApi.countryForecast(GHANA_ISO);
}

export async function getGhanaCountryDetail() {
  return await predictionsApi.countryDetail(GHANA_ISO);
}

export async function getGhanaInterventionPlan() {
  return await predictionsApi.interventionPlan(GHANA_ISO);
}


/* ──────────────────────────────────────────────────────────────────
 *  IHMREF — International Health Metrics
 * ────────────────────────────────────────────────────────────────── */

export async function getGhanaIHMREF() {
  return await ihmref.country_incident(GHANA_COUNTRY_NAME);
}

export async function getGhanaIHMREFSummary() {
  return await ihmref.summary();
}
