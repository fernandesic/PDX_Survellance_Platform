/**
 * Scenarios API Service
 *
 * Endpoints for the SEIRDV counterfactual simulator:
 * - createRun:  POST /predictions/scenario-runs/adhoc/
 * - getRun:     GET  /predictions/scenario-runs/<id>/
 * - getOutput:  GET  /predictions/scenario-runs/<id>/output/
 * - listRuns:   GET  /predictions/scenario-runs/
 */

import { apiGet, apiPost } from '@/lib/api';

const RUNS_BASE = '/predictions/scenario-runs';

/* ── Types ──────────────────────────────────────────────────────── */

export interface ScenarioConfig {
    n_populations: number;
    ini_S: number[];
    ini_I: number[];
    ini_E?: number[];
    ini_R?: number[];
    ini_D?: number[];
    ini_V?: number[];
    beta: number;
    sigma: number;
    gamma: number;
    mu?: number;
    vacc_coverage?: number;
    vacc_efficacy?: number;
    interv_delay?: number;
    interv_efficacy?: number;
    interv_vacc_type?: 1 | 2;
    interv_vacc_coverage?: number;
    target_size?: number;
    interv_release?: number;
    time: number;
    n_sims?: number;
    diffusion?: number;
    delta?: number[][];
    rng_seed?: number | null;
}

export interface ScenarioRunSummary {
    id: number;
    status: 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED';
    parameters_snapshot: ScenarioConfig;
    n_sims: number;
    time_steps: number;
    seed: number | null;
    created_at: string;
    started_at: string | null;
    completed_at: string | null;
    duration_seconds: number | null;
}

export interface QuantileData {
    median: number[];
    q05: number[];
    q25: number[];
    q75: number[];
    q95: number[];
}

export interface SummaryStats {
    compartments: string[];
    populations: number[];
    steps: number[];
    quantiles: Record<string, QuantileData>;
}

export interface ScenarioRunDetail extends ScenarioRunSummary {
    summary_stats: SummaryStats | null;
    error_message: string;
    has_output: boolean;
}

export interface ScenarioFitRequest {
    pathogen_id: string;
    observed_cumulative_cases: number[];
    time_grid: number[];
    initial_S: number;
    initial_I?: number;
    n_bootstrap?: number;
}

export interface ScenarioFitResponse {
    pathogen_id: string;
    point_estimate: { beta: number; sigma: number; gamma: number; mu: number };
    ci_lower: { beta: number; sigma: number; gamma: number; mu: number };
    ci_upper: { beta: number; sigma: number; gamma: number; mu: number };
    rmse: number;
    n_bootstrap: number;
    converged: boolean;
    notes: string;
}


/* ── API ────────────────────────────────────────────────────────── */

export const scenariosApi = {
    /** Submit a new ad-hoc scenario run → returns 202 with run stub */
    createRun: async (config: ScenarioConfig): Promise<ScenarioRunSummary> => {
        const { rng_seed, ...parameters } = config;
        return await apiPost<ScenarioRunSummary>(`${RUNS_BASE}/adhoc/`, {
            parameters,
            seed: rng_seed ?? null,
        });
    },

    /** Get run status + summary stats */
    getRun: async (id: number): Promise<ScenarioRunDetail> => {
        return await apiGet<ScenarioRunDetail>(`${RUNS_BASE}/${id}/`);
    },

    /** Get raw output blob (only when status = SUCCESS) */
    getOutput: async (id: number): Promise<any> => {
        return await apiGet<any>(`${RUNS_BASE}/${id}/output/`);
    },

    /** List recent runs for current user */
    listRuns: async (): Promise<ScenarioRunSummary[]> => {
        return await apiGet<ScenarioRunSummary[]>(`${RUNS_BASE}/`);
    },

    /** Fit SEIRDV parameters from observed cases */
    fitParameters: async (request: ScenarioFitRequest): Promise<ScenarioFitResponse> => {
        return await apiPost<ScenarioFitResponse>('/predictions/scenarios/fit/', request);
    },
};
