import { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  CircleCheck,
  CircleX,
  Cpu,
  RefreshCw,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react';
import { fetchAiStats } from '../../services/signalService';
import type { AgentStats } from './AgentConsole.types';

const POLL_INTERVAL = 30_000; // 30s

const HEALTH_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  healthy: {
    label: 'Healthy',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/15',
    icon: <ShieldCheck className="h-3 w-3" />,
  },
  degraded: {
    label: 'Degraded',
    color: 'text-amber-400',
    bg: 'bg-amber-500/15',
    icon: <TriangleAlert className="h-3 w-3" />,
  },
  down: {
    label: 'Down',
    color: 'text-red-400',
    bg: 'bg-red-500/15',
    icon: <CircleX className="h-3 w-3" />,
  },
};

/** Color palette for classification/severity distribution bars */
const CLASSIFICATION_COLORS: Record<string, string> = {
  continent_alert: 'bg-red-500',
  area_alert: 'bg-orange-500',
  no_alert: 'bg-emerald-500',
  uncertain: 'bg-slate-500',
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'bg-red-500',
  high: 'bg-orange-500',
  moderate: 'bg-amber-400',
  low: 'bg-sky-400',
};

function DistributionBar({
  data,
  colorMap,
  label,
}: {
  data: Record<string, number>;
  colorMap: Record<string, string>;
  label: string;
}) {
  const entries = Object.entries(data).filter(([, v]) => v > 0);
  const total = entries.reduce((sum, [, v]) => sum + v, 0);
  if (total === 0) {
    return (
      <div className="space-y-1">
        <span className="text-[9px] font-semibold uppercase tracking-widest text-slate-500">
          {label}
        </span>
        <div className="h-2 w-full rounded-full bg-white/5" />
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <span className="text-[9px] font-semibold uppercase tracking-widest text-slate-500">
        {label}
      </span>
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-white/5">
        {entries.map(([key, value]) => (
          <div
            key={key}
            className={`${colorMap[key] ?? 'bg-slate-600'} transition-all duration-500`}
            style={{ width: `${(value / total) * 100}%` }}
            title={`${key}: ${value}`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5">
        {entries.map(([key, value]) => (
          <span key={key} className="flex items-center gap-1 text-[9px] text-slate-500">
            <span className={`inline-block h-1.5 w-1.5 rounded-full ${colorMap[key] ?? 'bg-slate-600'}`} />
            {key.replace(/_/g, ' ')}: {value}
          </span>
        ))}
      </div>
    </div>
  );
}

export function AgentConsoleStats() {
  const [stats, setStats] = useState<AgentStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const data = await fetchAiStats();
      setStats(data);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Initial + periodic poll. Skip ticks while the tab is hidden so a
  // backgrounded page doesn't keep hammering the API and waking the
  // GPU/CPU on every tick.
  useEffect(() => {
    load();
    const id = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      load();
    }, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [load]);

  // ── Loading skeleton ───────────────────────────────────────────────────
  if (loading && !stats) {
    return (
      <div className="space-y-2.5 p-3" data-testid="agent-console-stats-skeleton">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-3 animate-pulse rounded bg-white/5" />
        ))}
      </div>
    );
  }

  if (!stats) {
    return (
      <div
        className="flex h-full items-center justify-center p-4 text-xs text-slate-600"
        data-testid="agent-console-stats"
      >
        Unable to load stats
      </div>
    );
  }

  const health = HEALTH_CONFIG[stats.agent_health] ?? HEALTH_CONFIG.down;
  const lastRunAgo = stats.last_run_at
    ? formatRelative(stats.last_run_at)
    : 'never';

  return (
    <div
      className="space-y-3 p-3 text-xs select-none"
      data-testid="agent-console-stats"
    >
      {/* Row 1: Health + Provider + Refresh */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Health badge */}
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${health.color} ${health.bg}`}
          >
            {health.icon}
            {health.label}
          </span>

          {/* Provider + model */}
          <span className="flex items-center gap-1 text-[10px] text-slate-500">
            <Cpu className="h-3 w-3" />
            {stats.provider}/{stats.model_name || '—'}
          </span>
        </div>

        {/* Refresh button */}
        <button
          type="button"
          onClick={() => load(true)}
          disabled={refreshing}
          className="rounded p-1 text-slate-500 transition-colors hover:bg-white/5 hover:text-slate-300 disabled:opacity-40"
          aria-label="Refresh stats"
          data-testid="agent-stats-refresh"
        >
          <RefreshCw className={`h-3 w-3 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Row 2: Classification counts */}
      <div className="flex items-center gap-3">
        <span className="flex items-center gap-1 text-slate-300">
          <CircleCheck className="h-3 w-3 text-emerald-400" />
          <span className="font-medium">{stats.total_classified}</span>
          <span className="text-slate-500">classified</span>
        </span>
        <span className="text-slate-700">·</span>
        <span className="flex items-center gap-1 text-slate-300">
          <Activity className="h-3 w-3 text-slate-500" />
          <span className="font-medium">{stats.total_unclassified}</span>
          <span className="text-slate-500">pending</span>
        </span>
        <span className="text-slate-700">·</span>
        <span className="text-[10px] text-slate-600">
          last run {lastRunAgo}
        </span>
      </div>

      {/* Row 3: By classification bar */}
      <DistributionBar
        data={stats.by_classification}
        colorMap={CLASSIFICATION_COLORS}
        label="By Classification"
      />

      {/* Row 4: By severity bar */}
      <DistributionBar
        data={stats.by_severity}
        colorMap={SEVERITY_COLORS}
        label="By Severity"
      />
    </div>
  );
}

/** Lightweight relative-time formatter */
function formatRelative(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const diffMs = Date.now() - d.getTime();
  const diffS = Math.round(diffMs / 1000);
  if (diffS < 60) return `${diffS}s ago`;
  const diffM = Math.round(diffS / 60);
  if (diffM < 60) return `${diffM}m ago`;
  const diffH = Math.round(diffM / 60);
  if (diffH < 24) return `${diffH}h ago`;
  return `${Math.round(diffH / 24)}d ago`;
}
