/**
 * HDIS-PRO Dashboard — Situation Overview
 * Layout matches the reference image exactly.
 */
import { DashboardProvider } from "@/pages/hdis/context/DashboardContext";
import { SituationOverview } from "@/pages/hdis/components/SituationOverview";
import { GlobalRiskMap } from "@/pages/hdis/components/GlobalRiskMap";
import { RightPanel } from "@/pages/hdis/components/RightPanel";
import { TopCountryRisks } from "@/pages/hdis/components/TopCountryRisks";
import { DiplomaticImpact } from "@/pages/hdis/components/DiplomaticImpact";
import { PoliticalAlerts } from "@/pages/hdis/components/PoliticalAlerts";
import { SentimentAnalysis } from "@/pages/hdis/components/SentimentAnalysis";
import { IntelligenceSummary } from "@/pages/hdis/components/IntelligenceSummary";
import { RefreshCw, Loader2, Check } from "lucide-react";
import { useRefresh, useAutoRefresh, useRefreshStatus } from "@/pages/hdis/hooks/useIntelligence";
import { useState, useEffect, useRef } from "react";

// ── Refresh Button ───────────────────────────────────────────────────

function RefreshButton() {
  const refresh = useRefresh();
  const { data: status } = useRefreshStatus();
  const [showResult, setShowResult] = useState(false);

  const isRunning = refresh.isPending || status?.is_running;

  const handleRefresh = () => {
    refresh.mutate(undefined, {
      onSuccess: () => {
        setShowResult(true);
        setTimeout(() => setShowResult(false), 5000);
      },
    });
  };

  return (
    <div className="flex items-center gap-3">
      {/* Result toast */}
      {showResult && refresh.data && (
        <div className="flex items-center gap-2 rounded-lg border border-green-500/20 bg-green-500/5 px-3 py-1.5 animate-fade-in-up">
          <Check className="h-3.5 w-3.5 text-green-400" />
          <span className="font-mono text-sm text-green-400">
            Started background refresh
          </span>
        </div>
      )}

      {/* Error toast */}
      {refresh.isError && (
        <span className="font-mono text-sm text-red-400">
          {(refresh.error as any)?.status === 409 ? 'Refresh already running' : 'Refresh failed'}
        </span>
      )}

      {/* Button */}
      <button
        onClick={handleRefresh}
        disabled={isRunning}
        className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 font-mono text-xs transition-all ${isRunning
          ? "border-primary/30 bg-primary/5 text-primary cursor-wait"
          : "border-border/50 bg-card text-muted-foreground hover:text-foreground hover:border-primary/30 hover:bg-primary/5"
          }`}
      >
        {isRunning ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Refreshing...
          </>
        ) : (
          <>
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh Now
          </>
        )}
      </button>
    </div>
  );
}

// ── Auto Refresh Manager ─────────────────────────────────────────────
// Silently triggers ingestion if backend data is stale (>30 min)

function AutoRefreshManager() {
  const { checkAndRefresh, status, refresh } = useAutoRefresh();
  const hasChecked = useRef(false);

  // Trigger on mount if stale
  useEffect(() => {
    if (!hasChecked.current && status !== undefined) {
      hasChecked.current = true;
      checkAndRefresh();
    }
  }, [status, checkAndRefresh]);

  // Set up periodic check every 30 min
  useEffect(() => {
    const interval = setInterval(checkAndRefresh, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, [checkAndRefresh]);

  // Show subtle indicator when auto-refreshing
  if (refresh.isPending || status?.is_running) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-1.5 animate-fade-in-up">
        <Loader2 className="h-3 w-3 animate-spin text-amber-400" />
        <span className="font-mono text-sm text-amber-400">
          {status?.progress || 'Syncing data...'}
        </span>
      </div>
    );
  }

  // Show last refresh time
  if (status?.last_refresh_at) {
    const ago = Math.round((Date.now() - new Date(status.last_refresh_at).getTime()) / 60000);
    const label = ago < 1 ? 'just now' : ago < 60 ? `${ago}m ago` : `${Math.round(ago / 60)}h ago`;
    return (
      <span className="font-mono text-[13px] text-muted-foreground/60">
        Last sync: {label}
      </span>
    );
  }

  return null;
}


const Dashboard = () => {
  return (
    <DashboardProvider>
      <div className="space-y-2.5 animate-fade-in-up">

        {/* Header Row — Aligned with grid columns */}
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-2.5 px-1 mb-1.5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-foreground uppercase tracking-tight">
              Situation Overview
            </h2>
            <div className="flex items-center gap-3">
              <AutoRefreshManager />
              <RefreshButton />
              <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-1.5">
                <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
                <span className="font-mono text-xs text-primary font-medium">LIVE</span>
              </div>
            </div>
          </div>
          <h2 className="text-base font-bold text-foreground hidden xl:block tracking-tight self-center">
            Operational Pillar Hub
          </h2>
        </div>

        {/* ── Main 2-column layout: LEFT = KPIs+Map, RIGHT = single panel ── */}
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-2.5 items-stretch">

          {/* LEFT COLUMN */}
          <div className="flex flex-col gap-2.5">
            <SituationOverview />
            <GlobalRiskMap />
          </div>

          {/* RIGHT COLUMN — stretches to full height of left column */}
          <RightPanel />

        </div>
        {/* ── Political & Diplomatic Alerts ── */}
        <PoliticalAlerts />

        {/* ── Top Country Risks ── */}
        <TopCountryRisks />

        {/* ── Diplomatic Impact Score ── */}
        <DiplomaticImpact />


        {/* ── Sentiment Analysis (Social & Political Climate) ── */}
        <SentimentAnalysis />

        {/* ── Intelligence Summary ── */}
        <IntelligenceSummary />

      </div>
    </DashboardProvider>
  );
};

export default Dashboard;
