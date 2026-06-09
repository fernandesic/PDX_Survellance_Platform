import type { BaseResponse } from "@/types";

export type IhmrefCategory =
  | "simulation_exercise"
  | "after_action_review"
  | "intra_action_review"
  | "early_action_review"
  | "naphs"
  | "nbws"
  | "jee"
  | "risk_profiling";

export interface IhmrefCategoryResponse extends BaseResponse<{
  category: string[]
}> { }

export interface IhmrefData {
  id: number;
  category: IhmrefCategory;
  year: string;
  afro: number;
  global_t: number;
  contribution: number;
  no_of_african_countries: number;
  african_countries_involved?: string | null;
}


export interface IhmrefDataSummary {
  id: number;
  category: IhmrefCategory;
  afro: number;
  global_t: number;
  contribution: number;
}

export interface IhmrefDataSummaryResponse extends BaseResponse<{
  data: IhmrefDataSummary;
  years: string[];
}> { }

export interface IhmrefCountry extends BaseResponse<{
  country: string;
  full_name: string;
  state: string;
}> { }

export interface IhmrefCountryResponse extends BaseResponse<{
  countries: string[];
}> { }

export interface IhmrefCountryIncident {
  id: number;
  country: IhmrefCountry;
  ihmref_data: IhmrefData;
  incident: string;
  start_date: string;
  end_date: string;
}


export type TimelineByYear = Record<number, IhmrefCountryIncident[]>;

export type CategoryCounts = Record<IhmrefCategory, number>;

export interface CategoryBarDatum { category: IhmrefCategory; count: number; }

export const CATEGORY_COLORS: Record<IhmrefCategory, string> = {
  simulation_exercise: "#0ea5e9",
  after_action_review: "#6366f1",
  intra_action_review: "#8b5cf6",
  early_action_review: "#14b8a6",
  naphs: "#22c55e",
  nbws: "#f59e0b",
  jee: "#ec4899",
  risk_profiling: "#64748b",
};

export const CATEGORY_LABELS: Record<string, string> = {
  simulation_exercise: "Simulation Exercises",
  after_action_review: "After Action Reviews",
  intra_action_review: "Intra Action Reviews",
  early_action_review: "Early Action Reviews",
  naphs: "NAPHS",
  nbws: "NBWS",
  jee: "JEE",
  risk_profiling: "Risk Profiling",
};