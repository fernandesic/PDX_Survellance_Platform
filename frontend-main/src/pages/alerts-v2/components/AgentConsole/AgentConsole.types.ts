export type AgentStepKind =
  | 'perceive'
  | 'classify'
  | 'corroborate'
  | 'debate'
  | 'review'
  | 'notify'
  | 'reflect';

export type AgentRunStatus = 'queued' | 'running' | 'completed' | 'failed';

export interface Citation {
  source_id: number;
  source_name: string;
  source_url: string | null;
  tier: 1 | 2 | 3;
  relevance: number;
  matched_at: string;
}

export interface AgentStep {
  step_number: number;
  kind: AgentStepKind;
  agent_name: string;
  input_summary: string;
  output_summary: string;
  reasoning: string;
  citations: Citation[];
  latency_ms: number;
  tokens_used: number | null;
  model_name: string;
  created_at: string;
}

export interface AgentRun {
  run_id: string;
  signal_id: number;
  status: AgentRunStatus;
  started_at: string;
  finished_at: string | null;
  confidence: number;
  corroboration_count: number;
  provider?: string;
  model_name?: string;
  steps: AgentStep[];
}

export interface AgentStats {
  total_classified: number;
  total_unclassified: number;
  by_classification: Record<string, number>;
  by_severity: Record<string, number>;
  last_run_at: string | null;
  agent_health: 'healthy' | 'degraded' | 'down';
  model_name: string;
  provider: string;
}
