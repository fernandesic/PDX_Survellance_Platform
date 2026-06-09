/**
 * GhanaPdxPage — Container component for the Ghana Country Dashboard.
 *
 * Manages active tab state, feeds overview data to the header KPI ribbon,
 * and tracks which tabs have been visited (for keep-alive rendering).
 */

import { useState, useCallback } from 'react';
import type { GhanaTabId } from './constants';
import GhanaPdxView from './GhanaPdxView';
import { useGhanaAlerts, useGhanaCHWSummary, useGhanaIHR } from './hooks/useGhanaData';

export default function GhanaPdxPage() {
  const [activeTab, setActiveTab] = useState<GhanaTabId>('overview');
  const [visitedTabs, setVisitedTabs] = useState<Set<GhanaTabId>>(new Set(['overview']));

  const handleTabChange = useCallback((tab: GhanaTabId) => {
    setActiveTab(tab);
    setVisitedTabs((prev) => {
      if (prev.has(tab)) return prev;
      const next = new Set(prev);
      next.add(tab);
      return next;
    });
  }, []);

  // Always-on queries for the header KPI ribbon
  const alerts = useGhanaAlerts();
  const chwSummary = useGhanaCHWSummary();
  const ghanaIHR = useGhanaIHR('2024');

  // Build stats for the header — ALL Ghana-specific
  const ghanaCHW = chwSummary.data as any;
  const ihrData = ghanaIHR.data as any;

  // Format population nicely (e.g., 33500000 -> 33.5M)
  const formatPopulation = (num?: number) => {
    if (!num) return '—';
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toLocaleString();
  };

  // IHR score: ESPAR summary for Ghana returns overall.value which is already a percentage (e.g., 52)
  const ihrScoreRaw = ihrData?.overall?.value;
  const ihrScorePercent = ihrScoreRaw != null ? Math.round(ihrScoreRaw) : undefined;

  const stats = {
    population: formatPopulation(ghanaCHW?.population_2024),
    totalCHWs: ghanaCHW?.total_chws ?? undefined,
    ihrScore: ihrScorePercent,
    alertCount: Array.isArray(alerts.data) ? alerts.data.length : undefined,
  };

  return (
    <GhanaPdxView
      activeTab={activeTab}
      setActiveTab={handleTabChange}
      visitedTabs={visitedTabs}
      stats={stats}
    />
  );
}
