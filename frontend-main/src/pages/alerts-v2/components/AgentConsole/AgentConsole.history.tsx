import { useCallback, useEffect, useState } from 'react';
import {
  Clock,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Loader2,
  BrainCircuit,
} from 'lucide-react';
import { fetchAgentRuns } from '../../services/signalService';
import type { AgentRun, AgentRunStatus } from './AgentConsole.types';

const POLL_INTERVAL = 30_000; // 30s — same cadence as Stats tab
const MAX_RUNS = 20;

/** Status badge configuration */
const STATUS_CONFIG: Record<AgentRunStatus, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  completed: {
    label: 'Done',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/15',
    icon: <CheckCircle2 className="h-2.5 w-2.5" />,
  },
  running: {
    label: 'Running',
    color: 'text-sky-400',
    bg: 'bg-sky-500/15',
    icon: <Loader2 className="h-2.5 w-2.5 animate-spin" />,
  },
  queued: {
    label: 'Queued',
    color: 'text-slate-400',
    bg: 'bg-slate-500/15',
    icon: <Clock className="h-2.5 w-2.5" />,
  },
  failed: {
    label: 'Failed',
    color: 'text-red-400',
    bg: 'bg-red-500/15',
    icon: <XCircle className="h-2.5 w-2.5" />,
  },
};

/** Classification → color for the confidence badge */
const CLASSIFICATION_TONE: Record<string, string> = {
  continent_alert: 'text-red-400',
  area_alert: 'text-orange-400',
  no_alert: 'text-emerald-400',
  uncertain: 'text-slate-400',
};

interface AgentConsoleHistoryProps {
  onSelectAlert?: (id: string | null) => void;
  /** When set, History narrows to runs for signals in this ISO3 country. */
  activeCountry?: string | null;
}

export function AgentConsoleHistory({ onSelectAlert, activeCountry }: AgentConsoleHistoryProps) {
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const data = await fetchAgentRuns(undefined, activeCountry ?? null);
      setRuns(data.slice(0, MAX_RUNS));
    } catch {
      // swallow — fetchAgentRuns already logs internally
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeCountry]);

  // Initial load + periodic poll. Skip ticks while the tab is hidden.
  useEffect(() => {
    load();
    const id = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      load();
    }, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [load]);

  // ── Loading skeleton ──────────────────────────────────────────────────
  if (loading && runs.length === 0) {
    return (
      <div className="space-y-1.5 p-2" data-testid="agent-console-history-skeleton">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2 rounded-lg px-2 py-2">
            <div className="h-3 w-3 animate-pulse rounded-full bg-white/5" />
            <div className="flex-1 space-y-1">
              <div className="h-2.5 w-3/4 animate-pulse rounded bg-white/5" />
              <div className="h-2 w-1/2 animate-pulse rounded bg-white/5" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // ── Empty state ───────────────────────────────────────────────────────
  if (runs.length === 0) {
    return (
      <div
        className="flex h-full flex-col items-center justify-center gap-1.5 p-4 text-center"
        data-testid="agent-console-history"
      >
        <BrainCircuit className="h-5 w-5 text-slate-700" />
        <span className="text-[10px] text-slate-600">
          No agent runs yet — runs appear here after signals are classified
        </span>
      </div>
    );
  }

  // ── Run list ──────────────────────────────────────────────────────────
  return (
    <div className="flex h-full flex-col" data-testid="agent-console-history">
      {/* Header with refresh */}
      <div className="flex shrink-0 items-center justify-between border-b border-white/5 px-2.5 py-1">
        <span className="text-[9px] font-semibold uppercase tracking-widest text-slate-500">
          Last {runs.length} runs
        </span>
        <button
          type="button"
          onClick={() => load(true)}
          disabled={refreshing}
          className="rounded p-0.5 text-slate-500 transition-colors hover:bg-white/5 hover:text-slate-300 disabled:opacity-40"
          aria-label="Refresh history"
          data-testid="agent-history-refresh"
        >
          <RefreshCw className={`h-3 w-3 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Scrollable run list */}
      <ul className="flex-1 space-y-0.5 overflow-y-auto p-1" data-testid="agent-history-list">
        {runs.map((run) => {
          const statusCfg = STATUS_CONFIG[run.status] ?? STATUS_CONFIG.queued;
          const latencyMs = computeLatency(run);
          // Derive classification from the last classify or review step
          const classification = deriveClassification(run);
          const confTone = CLASSIFICATION_TONE[classification ?? ''] ?? 'text-slate-400';

          return (
            <li key={run.run_id}>
              <button
                type="button"
                onClick={() => onSelectAlert?.(String(run.signal_id))}
                className="flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-white/[0.04] focus-visible:outline focus-visible:outline-1 focus-visible:outline-indigo-500"
                data-testid="agent-history-item"
              >
                {/* Status icon */}
                <span className={`mt-0.5 shrink-0 ${statusCfg.color}`}>
                  {statusCfg.icon}
                </span>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  {/* Row 1: SIG-ID + status badge */}
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-[10px] font-medium text-slate-300">
                      SIG-{run.signal_id}
                    </span>
                    <span
                      className={`inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-px text-[8px] font-semibold uppercase tracking-wider ${statusCfg.color} ${statusCfg.bg}`}
                    >
                      {statusCfg.label}
                    </span>
                  </div>

                  {/* Row 2: Classification + confidence + latency */}
                  <div className="mt-0.5 flex items-center gap-1.5 text-[9px]">
                    {classification ? (
                      <span className={`font-medium ${confTone}`}>
                        {classification.replace(/_/g, ' ')}
                      </span>
                    ) : (
                      <span className="text-slate-600">—</span>
                    )}
                    {run.confidence > 0 ? (
                      <>
                        <span className="text-slate-700">·</span>
                        <span className="tabular-nums text-slate-500">
                          conf {run.confidence.toFixed(2)}
                        </span>
                      </>
                    ) : null}
                    {latencyMs > 0 ? (
                      <>
                        <span className="text-slate-700">·</span>
                        <span className="tabular-nums text-slate-600">
                          {(latencyMs / 1000).toFixed(1)}s
                        </span>
                      </>
                    ) : null}
                    {run.corroboration_count > 0 ? (
                      <>
                        <span className="text-slate-700">·</span>
                        <span className="text-slate-600">
                          {run.corroboration_count} src{run.corroboration_count !== 1 ? 's' : ''}
                        </span>
                      </>
                    ) : null}
                  </div>

                  {/* Row 3: Relative time */}
                  <span className="mt-0.5 block text-[9px] text-slate-600">
                    {formatRelative(run.started_at)}
                  </span>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Derive the classification string from the run's steps.
 * Look for the last 'review' or 'classify' step's output_summary.
 */
function deriveClassification(run: AgentRun): string | null {
  if (!run.steps || run.steps.length === 0) return null;
  // Prefer the review step — it has the final classification
  const reviewStep = [...run.steps].reverse().find((s) => s.kind === 'review');
  if (reviewStep) {
    const match = reviewStep.output_summary.match(
      /\b(continent_alert|area_alert|no_alert|uncertain)\b/i,
    );
    if (match) return match[1].toLowerCase();
  }
  // Fall back to classify step
  const classifyStep = [...run.steps].reverse().find((s) => s.kind === 'classify');
  if (classifyStep) {
    const match = classifyStep.output_summary.match(
      /\b(continent_alert|area_alert|no_alert|uncertain)\b/i,
    );
    if (match) return match[1].toLowerCase();
  }
  return null;
}

/**
 * Compute total latency from start to finish, or sum of step latencies.
 * Returns milliseconds.
 */
function computeLatency(run: AgentRun): number {
  if (run.finished_at && run.started_at) {
    const start = new Date(run.started_at).getTime();
    const end = new Date(run.finished_at).getTime();
    if (!Number.isNaN(start) && !Number.isNaN(end) && end > start) {
      return end - start;
    }
  }
  // Fallback: sum step latencies
  if (run.steps && run.steps.length > 0) {
    return run.steps.reduce((sum, s) => sum + (s.latency_ms || 0), 0);
  }
  return 0;
}

/** Lightweight relative-time formatter — same style as Stats tab */
function formatRelative(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const diffMs = Date.now() - d.getTime();
  if (diffMs < 0) return 'just now';
  const diffS = Math.round(diffMs / 1000);
  if (diffS < 60) return `${diffS}s ago`;
  const diffM = Math.round(diffS / 60);
  if (diffM < 60) return `${diffM}m ago`;
  const diffH = Math.round(diffM / 60);
  if (diffH < 24) return `${diffH}h ago`;
  return `${Math.round(diffH / 24)}d ago`;
}
