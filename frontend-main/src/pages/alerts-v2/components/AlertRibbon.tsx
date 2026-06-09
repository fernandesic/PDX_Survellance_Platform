import { useEffect, useMemo, useState } from 'react';
import type { Signal } from '../types';
import {
  countByPriority,
  formatLastUpdated,
  toProcessedAlert,
} from './alertFeedUtils';

interface AlertRibbonProps {
  alerts: Signal[];
  lastUpdatedAt: Date | null;
}

export function AlertRibbon({ alerts, lastUpdatedAt }: AlertRibbonProps) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const counts = useMemo(
    () => countByPriority(alerts.map(toProcessedAlert)),
    [alerts],
  );
  const lastUpdatedLabel = formatLastUpdated(lastUpdatedAt, now);

  return (
    <footer
      data-testid="alert-ribbon"
      className="flex flex-wrap items-center justify-between gap-3 border-t border-white/5 bg-[#0B1120]/95 px-4 py-2 text-xs text-slate-300 backdrop-blur"
    >
      <div className="flex flex-wrap items-center gap-3">
        <span className="inline-flex items-center gap-1">
          <span aria-hidden="true">🔴</span>
          <span className="font-semibold text-red-400">{counts.critical}</span>
          <span className="text-slate-400">Critical</span>
        </span>
        <span className="text-slate-600">·</span>
        <span className="inline-flex items-center gap-1">
          <span aria-hidden="true">🟠</span>
          <span className="font-semibold text-orange-400">{counts.high}</span>
          <span className="text-slate-400">High</span>
        </span>
        <span className="text-slate-600">·</span>
        <span className="inline-flex items-center gap-1">
          <span aria-hidden="true">📡</span>
          <span className="font-semibold text-amber-400">{counts.monitoring}</span>
          <span className="text-slate-400">Monitoring</span>
        </span>
      </div>
      <div className="text-slate-400">
        Last updated: <span className="text-slate-200">{lastUpdatedLabel}</span>
      </div>
    </footer>
  );
}
