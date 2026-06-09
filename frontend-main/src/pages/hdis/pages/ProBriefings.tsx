/**
 * ProBriefings — Intelligence Briefing Management Page
 *
 * Features:
 * - Generate new briefings (daily global or country-specific)
 * - View briefing history with status badges
 * - Expand to read full briefing content
 * - Publish draft briefings
 * - Live generation status polling
 */

import React, { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/contexts/ToastProvider";
import {
  useBriefings,
  useGenerateBriefing,
  useGenerationStatus,
  usePublishBriefing,
} from "@/pages/hdis/hooks/useIntelligence";
import type { Briefing, BriefingContent } from "@/pages/hdis/types";
import {
  FileText, Loader2, Sparkles, Check, AlertTriangle,
  ChevronDown, ChevronUp, Send, Clock, Shield,
  BarChart3, Target, HelpCircle, ArrowUpRight, Info, X,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { BackButton } from "@/pages/hdis/components/shared/BackButton";


// ── Urgency Badge ─────────────────────────────────────────────────────

const urgencyColors: Record<string, string> = {
  immediate: "bg-red-500/10 text-red-400 border-red-500/20",
  "48h": "bg-amber-500/10 text-amber-400 border-amber-500/20",
  this_week: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  monitor: "bg-slate-500/10 text-slate-400 border-slate-500/20",
};

const urgencyIcons: Record<string, string> = {
  immediate: "⚡",
  "48h": "📅",
  this_week: "📅",
  monitor: "👁",
};

// ── Confidence Badge ──────────────────────────────────────────────────

function ConfidenceBadge({ level }: { level: string }) {
  const styles: Record<string, string> = {
    high: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    medium: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    low: "bg-red-500/10 text-red-400 border-red-500/20",
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 font-mono text-sm uppercase ${styles[level] ?? styles.medium}`}>
      <Shield className="h-3 w-3" />
      {level}
    </span>
  );
}

// ── Status Badge ──────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  if (status === "published") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 font-mono text-sm text-emerald-400 uppercase">
        <Check className="h-3 w-3" /> Published
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 font-mono text-sm text-amber-400 uppercase">
      <Clock className="h-3 w-3" /> Draft
    </span>
  );
}

// ── Briefing Detail View ──────────────────────────────────────────────

function BriefingDetail({ briefing }: { briefing: Briefing }) {
  const content = briefing.content as BriefingContent;
  const publish = usePublishBriefing();

  return (
    <div className="space-y-4 border-t border-border/30 pt-4 animate-fade-in-up">

      {/* Executive Summary */}
      {content.executive_summary && (
        <div className="rounded-lg border border-primary/10 bg-primary/5 p-4">
          <h4 className="mb-2 flex items-center gap-2 text-xs font-semibold text-primary uppercase">
            <FileText className="h-3.5 w-3.5" /> Executive Summary
          </h4>
          <p className="text-sm leading-relaxed text-foreground/90">
            {content.executive_summary}
          </p>
        </div>
      )}

      {/* Risk Assessment */}
      {content.risk_assessment && (
        <div className="rounded-lg border border-border/30 bg-card/50 p-4">
          <h4 className="mb-2 flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase">
            <BarChart3 className="h-3.5 w-3.5" /> Risk Assessment
          </h4>
          <div className="flex items-center gap-3">
            <span className={`rounded-md px-2.5 py-1 font-mono text-xs font-bold uppercase ${content.risk_assessment.level === "critical" ? "bg-red-500/10 text-red-400" :
              content.risk_assessment.level === "high" ? "bg-orange-500/10 text-orange-400" :
                content.risk_assessment.level === "medium" ? "bg-amber-500/10 text-amber-400" :
                  "bg-emerald-500/10 text-emerald-400"
              }`}>
              {content.risk_assessment.level}
            </span>
            <span className="text-xs text-muted-foreground">
              {content.risk_assessment.direction === "worsening" ? "↑ Worsening" :
                content.risk_assessment.direction === "improving" ? "↓ Improving" : "→ Stable"}
            </span>
          </div>
          {content.risk_assessment.reasoning && (
            <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
              {content.risk_assessment.reasoning}
            </p>
          )}
        </div>
      )}

      {/* Cross-Pillar Correlation */}
      {content.cross_pillar_correlation && (
        <div className="rounded-lg border border-border/30 bg-card/50 p-4">
          <h4 className="mb-2 flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase">
            <Target className="h-3.5 w-3.5" /> Cross-Pillar Correlation
          </h4>
          <p className="text-xs text-foreground/80 leading-relaxed">
            {content.cross_pillar_correlation}
          </p>
        </div>
      )}

      {/* Recommended Actions */}
      {content.recommended_actions && content.recommended_actions.length > 0 && (
        <div className="rounded-lg border border-border/30 bg-card/50 p-4">
          <h4 className="mb-3 flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase">
            <ArrowUpRight className="h-3.5 w-3.5" /> Recommended Actions
          </h4>
          <div className="space-y-2">
            {content.recommended_actions.map((act, i) => (
              <div key={i} className="flex items-start gap-3 rounded-md border border-border/20 bg-muted/20 p-3">
                <span className={`mt-0.5 shrink-0 rounded-md border px-2 py-0.5 font-mono text-sm uppercase ${urgencyColors[act.urgency] ?? urgencyColors.monitor}`}>
                  {urgencyIcons[act.urgency] ?? "👁"} {act.urgency}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-foreground">{act.action}</p>
                  {act.rationale && (
                    <p className="mt-0.5 text-sm text-muted-foreground">{act.rationale}</p>
                  )}
                  <span className="mt-1 inline-block rounded bg-muted/30 px-1.5 py-0.5 font-mono text-sm text-muted-foreground">
                    {act.pillar}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Information Gaps */}
      {content.information_gaps && content.information_gaps.length > 0 && (
        <div className="rounded-lg border border-amber-500/10 bg-amber-500/5 p-4">
          <h4 className="mb-3 flex items-center gap-2 text-xs font-semibold text-amber-400 uppercase">
            <HelpCircle className="h-3.5 w-3.5" /> Information Gaps
          </h4>
          <div className="space-y-2">
            {content.information_gaps.map((gap, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="mt-0.5 text-amber-400">❓</span>
                <div>
                  <p className="text-xs font-medium text-foreground">{gap.area}</p>
                  {gap.suggested_investigation && (
                    <p className="text-sm text-muted-foreground">{gap.suggested_investigation}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sources Summary */}
      {content.sources_summary && (
        <div className="flex items-center gap-4 rounded-lg border border-border/20 bg-muted/10 px-4 py-2">
          <span className="font-mono text-sm text-muted-foreground">
            Based on {content.sources_summary.total_signals} signals from {content.sources_summary.total_sources} sources
          </span>
          <span className="font-mono text-sm text-muted-foreground">
            LLM: {briefing.llm_model}
          </span>
          <span className="font-mono text-sm text-muted-foreground">
            Generated in {(briefing.generation_time_ms / 1000).toFixed(1)}s
          </span>
        </div>
      )}

      {/* Publish Button */}
      {briefing.status === "draft" && (
        <div className="flex justify-end pt-2">
          <button
            onClick={() => publish.mutate(briefing.id)}
            disabled={publish.isPending}
            className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 font-mono text-xs text-emerald-400 transition-all hover:bg-emerald-500/20 disabled:opacity-50"
          >
            {publish.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            Publish Briefing
          </button>
        </div>
      )}
    </div>
  );
}

// ── Briefing Card ─────────────────────────────────────────────────────

function BriefingCard({ briefing }: { briefing: Briefing }) {
  const [expanded, setExpanded] = useState(false);
  const content = briefing.content as BriefingContent;

  return (
    <div className="rounded-xl border border-border/30 bg-card/80 backdrop-blur-sm transition-all hover:border-border/50">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 text-left"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="mb-1.5 flex flex-wrap items-center gap-2">
              <StatusBadge status={briefing.status} />
              <ConfidenceBadge level={briefing.confidence_level} />
              <span className="rounded bg-muted/30 px-1.5 py-0.5 font-mono text-sm text-muted-foreground">
                {briefing.scope_display}
              </span>
              {briefing.country_iso && (
                <span className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-sm text-primary">
                  {briefing.country_iso}
                </span>
              )}
            </div>
            <p className="text-sm text-foreground/90 line-clamp-2">
              {content.executive_summary ?? "No executive summary available."}
            </p>
            <div className="mt-2 flex items-center gap-3 text-sm text-muted-foreground">
              <span>{briefing.signal_count} signals</span>
              <span>•</span>
              <span>{briefing.source_count} sources</span>
              <span>•</span>
              <span>{formatDistanceToNow(new Date(briefing.generated_at), { addSuffix: true })}</span>
            </div>
          </div>
          {expanded ? (
            <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}
        </div>
      </button>
      {expanded && (
        <div className="px-4 pb-4">
          <BriefingDetail briefing={briefing} />
        </div>
      )}
    </div>
  );
}


// ── Already-Running Popup ─────────────────────────────────────────────

function BlockingJobPopup({
  startedAt,
  autoClearInSeconds,
  onDismiss,
}: {
  startedAt: string;
  autoClearInSeconds: number;
  onDismiss: () => void;
}) {
  // Tick once a second so "started X ago" and the countdown stay live.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const startedAgo = formatDistanceToNow(new Date(startedAt), { addSuffix: true });
  const startedMs = new Date(startedAt).getTime();
  const clearAtMs = startedMs + autoClearInSeconds * 1000;
  const remainingSeconds = Math.max(0, Math.ceil((clearAtMs - Date.now()) / 1000));
  const remainingLabel =
    remainingSeconds >= 60
      ? `${Math.ceil(remainingSeconds / 60)} min`
      : `${remainingSeconds}s`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md rounded-2xl border border-amber-500/30 bg-card p-6 shadow-2xl">
        <button
          onClick={onDismiss}
          className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground hover:bg-muted/30 hover:text-foreground transition-colors"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-amber-500/10 p-2">
            <Info className="h-5 w-5 text-amber-400" />
          </div>
          <div className="flex-1 pt-1">
            <p className="text-sm font-medium text-foreground">
              A briefing is already being generated
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Started {startedAgo}. Only one briefing can run at a time.
            </p>
            <p className="mt-3 font-mono text-xs text-amber-400/90">
              {remainingSeconds > 0
                ? `Auto-clears in ${remainingLabel} if it doesn't finish.`
                : 'Should clear any moment — you can retry.'}
            </p>
          </div>
        </div>
        <div className="mt-5 flex justify-end">
          <button
            onClick={onDismiss}
            className="rounded-lg border border-border/50 bg-muted/20 px-4 py-1.5 font-mono text-xs text-foreground hover:bg-muted/40 transition-colors"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}


// ── Generation Status Card ────────────────────────────────────────────

function GenerationProgress() {
  const { data: status } = useGenerationStatus(true);

  if (!status?.is_running && !status?.error) return null;

  const stageLabels: Record<string, string> = {
    starting: "Initializing pipeline...",
    pending: "Waiting for background worker...",
    gathering: "Gathering intelligence context...",
    analyzing: "Running cross-pillar analysis...",
    verifying: "Verifying claims & trust scores...",
    composing: "Writing briefing for leadership...",
    complete: "Briefing generated!",
    failed: "Generation failed",
  };

  return (
    <div className={`rounded-xl border p-4 ${status?.error
      ? "border-red-500/20 bg-red-500/5"
      : "border-primary/20 bg-primary/5"
      }`}>
      <div className="flex items-center gap-3">
        {status?.is_running ? (
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        ) : status?.error ? (
          <AlertTriangle className="h-5 w-5 text-red-400" />
        ) : (
          <Check className="h-5 w-5 text-emerald-400" />
        )}
        <div>
          <p className="text-sm font-medium text-foreground">
            {stageLabels[status?.stage ?? "starting"] ?? status?.stage}
          </p>
          {status?.error && (
            <p className="mt-0.5 font-mono text-xs text-red-400">{status.error}</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────

export default function ProBriefings() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { data: briefings, isLoading } = useBriefings();
  const generate = useGenerateBriefing();
  const [scope, setScope] = useState<"daily_global" | "country_focus">("daily_global");
  const [mutationError, setMutationError] = useState<string | null>(null);
  // When the user clicks Generate but another briefing already holds the
  // singleton lock, we show a friendly info popup with relative time + auto-
  // clear countdown — and start polling the status so we can notify the user
  // the moment the slot frees up.
  const [blockingJob, setBlockingJob] = useState<{
    started_at: string;
    auto_clear_in_seconds: number;
    job_id: number | null;
  } | null>(null);
  // Poll the status if a generation is actively running, recently succeeded,
  // or we're waiting for a blocking job to clear.
  const { data: genStatus } = useGenerationStatus(
    generate.isPending || generate.isSuccess || blockingJob !== null,
  );

  // Auto-refresh when generation completes successfully
  useEffect(() => {
    if (genStatus && !genStatus.is_running && genStatus.stage === 'complete' && generate.isSuccess) {
      // Invalidate briefings to show the new one
      queryClient.invalidateQueries({ queryKey: ["hdis-pro-briefings"] });

      // Also clear the status after a short delay so the progress bar disappears
      const timer = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["hdis-pro-generation-status"] });
        generate.reset();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [genStatus?.is_running, genStatus?.stage, generate.isSuccess, queryClient, generate]);

  // Handle errors: If a job failed, also clear it after a delay so it doesn't block the UI
  useEffect(() => {
    if (genStatus?.error && generate.isSuccess) {
      const timer = setTimeout(() => {
        generate.reset();
      }, 8000); // Give user more time to read the error
      return () => clearTimeout(timer);
    }
  }, [genStatus?.error, generate.isSuccess, generate]);

  // Clear mutation error after 10 seconds
  useEffect(() => {
    if (mutationError) {
      const timer = setTimeout(() => setMutationError(null), 10000);
      return () => clearTimeout(timer);
    }
  }, [mutationError]);

  // While a blocking job is being waited on, watch genStatus for the moment
  // the slot frees up (either job finished or the backend auto-cleared it as
  // stale). When that happens, notify the user and close the popup.
  useEffect(() => {
    if (!blockingJob) return;
    if (genStatus && !genStatus.is_running) {
      setBlockingJob(null);
      showToast('Briefing slot is free. You can generate now.', 'success');
      queryClient.invalidateQueries({ queryKey: ["hdis-pro-briefings"] });
    }
  }, [blockingJob, genStatus, showToast, queryClient]);

  // Safety net: if for some reason the status poll never reports cleared
  // (e.g. network blip), close the popup once the backend's auto-clear window
  // has elapsed plus a small buffer.
  useEffect(() => {
    if (!blockingJob) return;
    const ms = (blockingJob.auto_clear_in_seconds + 15) * 1000;
    const timer = setTimeout(() => {
      setBlockingJob(null);
      showToast('Briefing slot should now be free. Try again.', 'info');
    }, Math.max(ms, 5000));
    return () => clearTimeout(timer);
  }, [blockingJob, showToast]);

  const isGenerating = genStatus?.is_running || generate.isPending;

  return (
    <div className="mx-auto space-y-4 p-4 animate-fade-in-up">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-start gap-2 -ml-2">
          <BackButton />
          <div className="pt-0.5">
            <h1 className="font-mono text-lg font-bold text-foreground tracking-wide mb-3t">Intelligence Briefings</h1>
            <p className="text-sm text-muted-foreground">
              AI-generated executive briefings for WHO AFRO leadership
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Scope selector */}
          <select
            value={scope}
            onChange={(e) => setScope(e.target.value as any)}
            className="rounded-lg border border-border/50 px-3 py-1.5 font-mono text-xs text-muted-foreground focus:border-primary/50 focus:outline-none"
          >
            <option value="daily_global">All AFRO Region</option>
            <option value="country_focus">Country Focus</option>
          </select>

          {/* Generate button */}
          <button
            onClick={() => {
              setMutationError(null);
              setBlockingJob(null);
              generate.mutate({ scope }, {
                onError: (error: any) => {
                  const msg = error?.detail || error?.message || 'Failed to start briefing generation';
                  const status = error?.status;
                  if (status === 409) {
                    const data = error?.data || {};
                    setBlockingJob({
                      started_at: data.started_at || new Date().toISOString(),
                      auto_clear_in_seconds: typeof data.auto_clear_in_seconds === 'number'
                        ? data.auto_clear_in_seconds
                        : 60,
                      job_id: data.job_id ?? null,
                    });
                  } else {
                    showToast(msg, 'error');
                    setMutationError(msg);
                  }
                },
              });
            }}
            disabled={isGenerating}
            className={`flex items-center gap-2 rounded-lg border px-4 py-1.5 font-mono text-xs transition-all ${isGenerating
              ? "border-primary/30 bg-primary/5 text-primary cursor-wait"
              : "border-primary/30 bg-primary/10 text-primary hover:bg-primary/20"
              }`}
          >
            {isGenerating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            {isGenerating ? "Generating..." : "Generate Briefing"}
          </button>
        </div>
      </div>

      {/* Mutation Error Banner — shown only for non-409 errors (5xx, network).
          The 409 "already running" case is handled by BlockingJobPopup below. */}
      {mutationError && (
        <div className="flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/5 p-4">
          <AlertTriangle className="h-5 w-5 shrink-0 text-red-400" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-400">Generation request failed</p>
            <p className="mt-0.5 font-mono text-xs text-red-400/70">{mutationError}</p>
          </div>
          <button
            onClick={() => setMutationError(null)}
            className="shrink-0 rounded-md px-2 py-1 text-xs text-red-400 hover:bg-red-500/10 transition-colors"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Already-Running Popup — modal dialog shown on 409. Tells the user
          another briefing is in progress, when it started, and when it will
          auto-clear. Closes itself when the slot is freed. */}
      {blockingJob && (
        <BlockingJobPopup
          startedAt={blockingJob.started_at}
          autoClearInSeconds={blockingJob.auto_clear_in_seconds}
          onDismiss={() => setBlockingJob(null)}
        />
      )}

      {/* Generation Progress */}
      {/* Show if actively generating (either API call pending or background job running) */}
      {/* Only show errors from the backend state if we aren't currently waiting on the POST /generate request */}
      {(isGenerating || (genStatus?.error && !generate.isPending)) && <GenerationProgress />}

      {/* Briefings List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl border border-border/20 bg-card/30" />
          ))}
        </div>
      ) : !briefings || briefings.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border/20 bg-card/30 py-16">
          <FileText className="mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No briefings generated yet</p>
          <p className="mt-1 text-xs text-muted-foreground/60">
            Click "Generate Briefing" to create your first intelligence briefing
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {briefings.map((b) => (
            <BriefingCard key={b.id} briefing={b} />
          ))}
        </div>
      )}
    </div>
  );
}
