import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
const API = axios.create({ baseURL: `${API_BASE_URL}/pip`, timeout: 15000 })


// ─── Types ───────────────────────────────────────────────────────
export interface SummaryStats {
  total_countries: number
  total_indicators: number
  total_categories: number
  overall_yes_rate: number
  countries_with_nic: number
  countries_with_pcr: number
  countries_with_vaccination_policy: number
  countries_with_pandemic_plan: number
  countries_reporting_fluid: number
  countries_reporting_flunet: number
}

export interface CategorySummary {
  category: string
  category_id: number
  total_indicators: number
  yes_rate: number
  countries_responding: number
}

export interface CountrySummary {
  country: string
  readiness_score: number
  has_nic: boolean
  has_pcr: boolean
  has_vaccination_policy: boolean
  has_pandemic_plan: boolean
  reports_fluid: boolean
  reports_flunet: boolean
}

export interface IndicatorDetail {
  indicator_id: number
  category: string
  indicator: string
  responses: Record<string, number>
  yes_rate: number | null
}

export interface EpiBulletinMeta {
  epi_week: string
  publication_date: string
  headline: string
  key_findings: string[]
  bulletin_url: string
  source: string
}

export interface PIPIndicator {
  output: string
  indicator_id: string
  indicator_name: string
  description: string
  baseline_2024: number
  target_2025: number
  current_value: number
  unit: string
  status: 'on_track' | 'at_risk' | 'achieved' | 'not_started'
}

export interface HeatmapData {
  countries: string[]
  indicators: string[]
  matrix: number[][]
  legend: Record<string, string>
}

export interface CountryDetail {
  country: string
  readiness_score: number
  categories: Record<string, {
    indicators: { indicator_id: number; indicator: string; response: string }[]
    yes_rate: number
  }>
}

// ─── API calls ───────────────────────────────────────────────────
export const fetchSummary = () => API.get<SummaryStats>('/summary').then(r => r.data)
export const fetchCategories = () => API.get<CategorySummary[]>('/categories').then(r => r.data)
export const fetchCountries = () => API.get<CountrySummary[]>('/countries').then(r => r.data)
export const fetchCountryDetail = (name: string) => API.get<CountryDetail>(`/country/${encodeURIComponent(name)}`).then(r => r.data)
export const fetchIndicators = (category?: string) =>
  API.get<IndicatorDetail[]>('/indicators', { params: category ? { category } : {} }).then(r => r.data)
export const fetchBulletin = () => API.get<EpiBulletinMeta>('/bulletin').then(r => r.data)
export const fetchPIPIndicators = (output?: string) =>
  API.get<PIPIndicator[]>('/pip-indicators', { params: output ? { output } : {} }).then(r => r.data)
export const fetchHeatmap = (category: string) =>
  API.get<HeatmapData>('/heatmap', { params: { category } }).then(r => r.data)
export const fetchRegionalComparison = () =>
  API.get<Record<string, number>>('/regional-comparison').then(r => r.data)
