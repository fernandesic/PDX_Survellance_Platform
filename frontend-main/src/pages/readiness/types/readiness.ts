import type { PaginatedResponse } from "@/types";

export interface BaseReadiness {
  key_on_table: string;
  question_id: number | null;
  question_key: string | null;
  language: string | null;
  category: string;
  category_code: string | null;
  affects_score: number | null;
  category_score: number | null;
  category_weight: number | null;
  question_score: number;
  question_category_weight: number | null;
  category_language: string | null;
  question_language: string | null;
  national_yn_value: string | null;
  national_yn: string | null;
  comments: string | null;
  file_name: string | null;
  country: string;
  admin_level: string | null;
  admin_level_name: string | null;
  file_language: string | null;
  table: string | null;
  row_no: number | null;
  question: string;
}


export interface ReadinessListResponse extends PaginatedResponse<BaseReadiness[]> {
  countries: string[];
  completion_pct: number;
  answered_questions: number;
  total_questions: number;
}


export interface RegionScore {
  region: string;
  score: number;
  trust_score?: number;
  national_only?: boolean;
  total_indicators?: number;
  evidence_provided?: number;
}