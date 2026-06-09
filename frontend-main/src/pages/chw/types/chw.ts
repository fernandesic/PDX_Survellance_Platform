// ─── Country types ───

export interface CHWCountry {
  id: number;
  country: string;
  iso_code: string;
  total_chws: number;
  total_regions: number;
  total_districts: number;
  total_facilities: number;
  active_chws: number;
  inactive_chws: number;
  volunteer_chws: number;
  paid_chws: number;
  active_percentage: number;
  data_flag: string;
  population_2024: number;
  chws_per_10000: number;
  data_year: number;
  data_date: string;
  worker_type_count: number;
}

export interface CHWCountryDetail extends CHWCountry {
  data_source: string;
  last_updated: string;
  regions: CHWRegion[];
  worker_types: WorkerTypeAgg[];
}

// ─── Region types ───

export interface CHWRegion {
  id: number;
  region_name: string;
  admin_level: string;
  total_chws: number;
  active_chws: number;
  inactive_chws: number;
  volunteer_chws: number;
  paid_chws: number;
  active_percentage: number;
  data_flag: string;
  total_population: number;
  total_facilities: number;
  district_count: number;
}

export interface CHWRegionDetail extends CHWRegion {
  country_name: string;
  districts: CHWDistrict[];
  worker_types: WorkerTypeAgg[];
}

// ─── District types ───

export interface CHWDistrict {
  id: number;
  district_name: string;
  admin_level: string;
  total_chws: number;
  active_chws: number;
  inactive_chws: number;
  volunteer_chws: number;
  paid_chws: number;
  active_percentage: number;
  data_flag: string;
  population: number;
  households: number;
  chws_per_10k: number;
  region_name: string;
  country_name: string;
}

// ─── Worker Type ───

export interface WorkerTypeAgg {
  worker_type: string;
  total: number;
}

export interface WorkerTypeByCountry {
  country__country: string;
  country__iso_code: string;
  worker_type: string;
  total: number;
}

// ─── Summary ───

export interface CHWSummary {
  total_countries: number;
  total_chws: number;
  total_active_chws: number;
  total_inactive_chws: number;
  total_volunteer_chws: number;
  total_paid_chws: number;
  total_regions: number;
  total_districts: number;
  total_facilities: number;
  total_worker_types: number;
  kobo_submissions_count?: number;
  active_chw_reports_count?: number;
  countries: CHWCountry[];
}

// ─── Map types ───

export interface CHWMapCountry {
  id: number;
  country: string;
  iso_code: string;
  total_chws: number;
  chws_per_10000: number;
}

// ─── Backward compat (keep old types working) ───

export interface Country {
  country_id: number;
  country: string;
  population_2024: number;
  total_chws: number;
  chws_per_10000: number;
  total_regions: number;
  total_districts: number;
  data_year: number;
  last_updated: string;
}

export interface Region {
  region_id: number;
  country: number;
  region_name: string;
  district_count: number;
  region_number: number;
  province?: string;
}

export interface District {
  district_id: number;
  region: number;
  country: number;
  district_name: string;
  chw_count: number;
  population_est: number;
  chws_per_10k: number;
}

export interface ChwListResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: District[];
  total_countries: number;
}

export interface ChwPipelineResponse {
  data(data: any): unknown;
  country: string;
  total_chws: number;
  chw_density: number;
  top_region: {
    name: string;
    chws: number;
  } | null;
  total_districts: number;
}

// ─── Whonghub API types ───

export interface WhonghubDatasetItem {
  id: number;
  id_string: string;
  title: string;
  description: string;
  url: string;
}

export interface WhonghubDataEntry {
  _id: number;
  _uuid: string;
  _submission_time: string;
  [key: string]: any; // Dynamic fields
}

// ─── CHW Field Reports ───

export interface CHWFieldReport {
  _id: number;
  _uuid: string;
  _submission_time: string;
  _geolocation: [number, number] | null;
  chw_name: string;
  chw_location: string;
  q1_event_type: string;
  q2_case_count: number;
  q3_age_group: string;
  q4_severity: string;
  q5_description: string;
  gps_location: string;
  today: string;
  start: string;
  end: string;
  _submitted_by: string | null;
}