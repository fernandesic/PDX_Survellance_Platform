import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ChevronRight,
  Clock,
  ExternalLink,
  FileText,
  Loader2,
  MapPin,
  TrendingUp,
  X,
  BrainCircuit,
  Bell,
  BellOff,
  RefreshCw,
  Link2,
} from 'lucide-react';
import type { Signal } from '../types';
import { SOURCE_TIERS } from '../constants';
import {
  computeCFR,
  formatCFR,
  languageLabel,
} from './alertDetailUtils';
import { SituationReport } from './SituationReport';
import {
  classifySignal,
  fetchAgentRuns,
  fetchAlertById,
} from '../services/signalService';
import { AgentTraceTimeline } from './AgentTraceTimeline';
import { CitationChips } from './CitationChips';
import type { AgentStep, Citation } from './AgentConsole/AgentConsole.types';
import {
  synthesizeVerdict,
  notifyStatusLine,
  confidenceLevel,
  classificationAccent,
  severityLabel,
  relativeTime,
  totalLatency,
} from './verdictUtils';


export interface AlertDetailProps {
  signal: Signal;
  allSignals: Signal[];
  onClose: () => void;
  onUpdate?: () => void;
  onPromote?: (signal: Signal) => void;
}

export function AlertDetail({
  signal: listSignal,
  allSignals,
  onClose,
  onUpdate,
  onPromote,
}: AlertDetailProps) {
  const [showSitRep, setShowSitRep] = useState(false);
  const [detailSignal, setDetailSignal] = useState<Signal | null>(null);
  const [detailLoading, setDetailLoading] = useState(true);
  const [detailError, setDetailError] = useState(false);
  const [classifyState, setClassifyState] = useState<
    { status: 'idle' } | { status: 'loading' } | { status: 'error'; message: string }
  >({ status: 'idle' });
  const [agentSteps, setAgentSteps] = useState<AgentStep[]>([]);
  const [agentLoading, setAgentLoading] = useState(true);
  const [traceOpen, setTraceOpen] = useState(false);

  // Fetch full signal detail from the API (uses SignalDetailSerializer with
  // complete source FK, source_url, etc.) — falls back to the list data.
  useEffect(() => {
    let cancelled = false;
    setDetailLoading(true);
    setDetailError(false);
    fetchAlertById(listSignal.id)
      .then((full) => {
        if (cancelled) return;
        if (full) setDetailSignal(full);
        else setDetailError(true);
      })
      .catch(() => {
        if (!cancelled) setDetailError(true);
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => { cancelled = true; };
  }, [listSignal.id]);

  // Fetch real agent steps from the latest run for this signal.
  useEffect(() => {
    let cancelled = false;
    setAgentLoading(true);
    fetchAgentRuns(listSignal.id)
      .then((runs) => {
        if (cancelled) return;
        const latest = runs[0];
        setAgentSteps(latest?.steps ?? []);
      })
      .catch(() => {
        if (!cancelled) setAgentSteps([]);
      })
      .finally(() => {
        if (!cancelled) setAgentLoading(false);
      });
    return () => { cancelled = true; };
  }, [listSignal.id]);

  // Use the detail-endpoint signal when available; fall back to list data.
  const signal = detailSignal ?? listSignal;

  const cases = typeof signal.reported_cases === 'number' ? signal.reported_cases : null;
  const deaths = typeof signal.reported_deaths === 'number' ? signal.reported_deaths : null;
  const cfr = useMemo(() => computeCFR(cases, deaths), [cases, deaths]);

  const originalText = signal.original_text ?? '';
  const translatedText = signal.translated_text ?? '';
  const lang = signal.original_language ?? '';
  const isMultilingual = Boolean(lang) && lang.toLowerCase() !== 'en';

  const sourceName = signal.source?.name ?? signal.source_name ?? 'Unknown source';
  const sourceUrl = signal.source?.url ?? signal.source_url ?? '';
  const sourceTierRaw = signal.source?.tier ?? signal.source_tier ?? 3;
  const sourceTierNum =
    typeof sourceTierRaw === 'string' ? parseInt(sourceTierRaw, 10) : sourceTierRaw;
  const sourceTier = (sourceTierNum === 0 || sourceTierNum === 1 || sourceTierNum === 2 ? sourceTierNum : 3) as 0 | 1 | 2 | 3;
  const tier = SOURCE_TIERS[sourceTier] ?? SOURCE_TIERS[3];

  const country = signal.location?.country;
  const iso3 = signal.location?.iso3 || signal.location?.country_iso || '';
  const admin1 = signal.location?.admin1;

  // Verdict data
  const accent = classificationAccent(signal.ai_classification);
  const severity = severityLabel(signal.ai_severity);
  const confScore = signal.confidence_score;
  const confNormalized = confScore !== undefined ? (confScore > 1 ? confScore : confScore * 100) : undefined;
  const confLevel = confidenceLevel(confScore);
  const verdict = synthesizeVerdict(agentSteps);
  const notify = notifyStatusLine(agentSteps);
  const corroborationStep = agentSteps.find((s) => s.kind === 'corroborate');
  const corrobCount = corroborationStep?.output_summary?.match(/(\d+)\s+independent/)?.[1] ?? '0';
  const latency = totalLatency(agentSteps);

  // Collect unique citations across all agent steps
  const allCitations = useMemo(() => {
    const seen = new Set<string>();
    const result: Citation[] = [];
    for (const step of agentSteps) {
      if (!step.citations) continue;
      for (const c of step.citations) {
        const key = `${c.source_name}::${c.tier}`;
        if (!seen.has(key)) {
          seen.add(key);
          result.push(c);
        }
      }
    }
    return result;
  }, [agentSteps]);

  const handleClassify = async () => {
    setClassifyState({ status: 'loading' });
    try {
      const classified = await classifySignal(listSignal.id);
      if (classified) {
        setDetailSignal(classified);
        setClassifyState({ status: 'idle' });
        setAgentLoading(true);
        fetchAgentRuns(listSignal.id)
          .then((runs) => setAgentSteps(runs[0]?.steps ?? []))
          .catch(() => {})
          .finally(() => setAgentLoading(false));
      } else {
        setClassifyState({
          status: 'error',
          message: 'Classification returned empty — check backend logs',
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setClassifyState({
        status: 'error',
        message: `Agent error: ${msg.slice(0, 120)}`,
      });
    }
  };

  // All signals from the same country — used by SituationReport
  const countrySignals = useMemo(() => {
    if (!iso3 && !country) return [signal];
    return allSignals.filter((s) => {
      const sIso = s.location?.iso3 || s.location?.country_iso || '';
      if (iso3 && sIso && sIso === iso3) return true;
      if (country && s.location?.country === country) return true;
      return false;
    });
  }, [allSignals, iso3, country, signal]);

  // Display text for source block
  const displayText = isMultilingual && translatedText ? translatedText : originalText;
  const displayLang = isMultilingual && translatedText ? 'en' : lang;

  return (
    <>
      <div
        className="border-t border-white/[0.06] bg-[#0C1424] text-sm text-slate-200"
        data-testid="alert-detail"
        role="region"
        aria-label="alert detail"
      >
        {/* ── HEADER: Disease headline ── */}
        <div className="px-5 pt-5 pb-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              {/* Disease name — THE headline */}
              <h2 className="text-[18px] font-bold tracking-tight text-white leading-tight">
                {signal.disease_name || signal.headline || 'Untitled Alert'}
              </h2>
              {/* Subtitle: location · time · source */}
              <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-slate-400">
                {country ? (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3 w-3 text-slate-500" />
                    {country}{iso3 ? ` (${iso3})` : ''}
                    {admin1 ? ` · ${admin1}` : ''}
                  </span>
                ) : null}
                {signal.created_at ? (
                  <>
                    <span className="text-slate-600">·</span>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3 text-slate-500" />
                      {relativeTime(signal.created_at)}
                    </span>
                  </>
                ) : null}
                <span className="text-slate-600">·</span>
                <span className="truncate">{sourceName}</span>
                {signal.cross_border_risk ? (
                  <span className="inline-flex items-center gap-1 text-red-400">
                    <AlertTriangle className="h-3 w-3" /> Cross-border
                  </span>
                ) : null}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {/* SIG-ID — tiny, unobtrusive */}
              <span className="rounded-md bg-white/[0.04] px-2 py-0.5 font-mono text-[9px] text-slate-500 border border-white/[0.06]">
                SIG-{signal.id}
              </span>
              {detailLoading ? <Loader2 className="h-3 w-3 animate-spin text-slate-500" /> : null}
              <button
                type="button"
                onClick={onClose}
                aria-label="close detail"
                className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-white/[0.06] hover:text-slate-300"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* ── VERDICT CARD — the hero ── */}
        <div className="px-5 py-3">
          <div
            className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5"
            style={{ backdropFilter: 'blur(20px)' }}
            data-testid="alert-detail-verdict"
          >
            {/* Classification + Severity pills */}
            {signal.ai_classification ? (
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r ${accent.gradient} px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-white shadow-lg`}
                  style={{ textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}
                >
                  {accent.label}
                </span>
                {severity ? (
                  <span
                    className={`inline-flex items-center rounded-full ${accent.bg} ${accent.text} ${accent.border} border px-3 py-1 text-[10px] font-bold uppercase tracking-widest`}
                  >
                    {severity} Severity
                  </span>
                ) : null}
              </div>
            ) : (
              <div className="mb-4">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-500/10 border border-slate-500/20 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  <BrainCircuit className="h-3 w-3" /> Not yet classified
                </span>
              </div>
            )}

            {/* Epi stats — inline, clean typography */}
            <div className="flex items-end gap-8 mb-5" data-testid="alert-detail-situation">
              <div>
                <div className="text-[26px] font-bold tracking-tight text-white leading-none">
                  {cases !== null ? cases.toLocaleString() : '—'}
                </div>
                <div className="mt-0.5 text-[9px] font-semibold uppercase tracking-widest text-slate-500">Cases</div>
              </div>
              <div>
                <div className={`text-[26px] font-bold tracking-tight leading-none ${deaths && deaths > 0 ? 'text-red-400' : 'text-white'}`}>
                  {deaths !== null ? deaths.toLocaleString() : '—'}
                </div>
                <div className="mt-0.5 text-[9px] font-semibold uppercase tracking-widest text-slate-500">Deaths</div>
              </div>
              <div>
                <div className={`text-[26px] font-bold tracking-tight leading-none ${cfr !== null && cfr >= 10 ? 'text-red-400' : 'text-white'}`}>
                  {cfr !== null ? formatCFR(cfr) : '—'}
                </div>
                <div className="mt-0.5 text-[9px] font-semibold uppercase tracking-widest text-slate-500">CFR</div>
              </div>
            </div>

            {/* Confidence bar — the signature element */}
            {confNormalized !== undefined ? (
              <div className="mb-4">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                    AI Confidence
                  </span>
                  <span className={`text-[11px] font-bold ${confLevel.color}`}>
                    {Math.round(confNormalized)}% · {confLevel.label}
                  </span>
                </div>
                <div className="relative h-[5px] w-full rounded-full bg-white/[0.06] overflow-hidden">
                  {/* Fill */}
                  <div
                    className={`absolute inset-y-0 left-0 rounded-full ${accent.barFill} transition-all duration-700 ease-out`}
                    style={{ width: `${Math.min(confNormalized, 100)}%` }}
                  />
                  {/* Glow dot at endpoint */}
                  <div
                    className="absolute top-1/2 -translate-y-1/2 h-[9px] w-[9px] rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.4)]"
                    style={{ left: `calc(${Math.min(confNormalized, 100)}% - 4px)` }}
                  />
                  {/* 70% threshold marker */}
                  <div
                    className="absolute top-0 bottom-0 w-px bg-white/20"
                    style={{ left: '70%' }}
                    title="Notification threshold: 70%"
                  />
                </div>
                <div className="relative mt-0.5">
                  <span
                    className="absolute text-[8px] text-slate-600 -translate-x-1/2"
                    style={{ left: '70%' }}
                  >
                    70% threshold
                  </span>
                </div>
              </div>
            ) : null}

            {/* Verdict sentence — Claude speaking as a colleague */}
            {verdict || !agentLoading ? (
              <div className="mt-5 space-y-1.5">
                {verdict ? (
                  <p className="text-[11px] italic text-slate-400 leading-relaxed">
                    {verdict}
                  </p>
                ) : null}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-500">
                  <span className="inline-flex items-center gap-1">
                    <Link2 className="h-3 w-3" /> {corrobCount} corroborating source{corrobCount !== '1' ? 's' : ''}
                  </span>
                  {notify.text ? (
                    <span className="inline-flex items-center gap-1">
                      {notify.sent ? (
                        <Bell className="h-3 w-3 text-emerald-400" />
                      ) : (
                        <BellOff className="h-3 w-3 text-slate-500" />
                      )}
                      <span className={notify.sent ? 'text-emerald-400' : ''}>{notify.text}</span>
                    </span>
                  ) : null}
                  {latency ? (
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {latency}
                    </span>
                  ) : null}
                </div>
              </div>
            ) : null}

            {/* Citation chips inside verdict if present */}
            {allCitations.length > 0 ? (
              <div className="mt-3 pt-3 border-t border-white/[0.04]">
                <CitationChips citations={allCitations} />
              </div>
            ) : null}
          </div>
        </div>

        {/* ── SOURCE BLOCK — compact quote ── */}
        {displayText ? (
          <div className="px-5 py-2">
            <div className="border-l-2 border-sky-500/30 pl-3.5">
              <p className="text-[11px] italic leading-relaxed text-slate-300">
                &ldquo;{displayText.length > 200 ? displayText.slice(0, 200) + '…' : displayText}&rdquo;
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-slate-500">
                <span className="font-medium text-slate-400">{sourceName}</span>
                <span>· {tier.icon} Tier {sourceTier}</span>
                {signal.ingestion_source ? <span>· {signal.ingestion_source}</span> : null}
                {isMultilingual && lang ? (
                  <span>· Translated from {languageLabel(lang)}</span>
                ) : null}
                {sourceUrl ? (
                  <a
                    href={sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-0.5 text-sky-400 hover:text-sky-300 transition-colors"
                  >
                    Open source <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        {/* ── AI REASONING — collapsed by default ── */}
        <div className="px-5 py-2">
          <button
            type="button"
            onClick={() => setTraceOpen(!traceOpen)}
            className="flex w-full items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-2.5 text-left transition-colors hover:bg-white/[0.04]"
            aria-expanded={traceOpen}
          >
            <BrainCircuit className="h-3.5 w-3.5 text-violet-400" />
            <span className="text-[11px] font-semibold text-slate-300">
              AI Reasoning
            </span>
            <span className="flex-1" />
            {!agentLoading && agentSteps.length > 0 ? (
              <span className="text-[10px] text-slate-500">
                {agentSteps.length} steps{latency ? ` · ${latency}` : ''}
              </span>
            ) : null}
            <ChevronRight
              className={`h-3 w-3 text-slate-500 transition-transform duration-200 ${traceOpen ? 'rotate-90' : ''}`}
            />
          </button>
          {traceOpen ? (
            <div className="mt-2 pl-1">
              <AgentTraceTimeline steps={agentSteps} loading={agentLoading} />
            </div>
          ) : null}
        </div>

        {/* ── TIMELINE — one line ── */}
        <div className="px-5 py-2">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-slate-500" data-testid="alert-detail-timeline">
            <Clock className="h-3 w-3 text-slate-600" />
            <span>Ingested {relativeTime(signal.created_at)}</span>
            <span className="text-slate-700">·</span>
            <span>Published {relativeTime(signal.source_timestamp ?? signal.publishedAt)}</span>
            {signal.ai_classified_at ? (
              <>
                <span className="text-slate-700">·</span>
                <span>AI {relativeTime(signal.ai_classified_at)}</span>
              </>
            ) : null}
          </div>
        </div>

        {/* Analyst Notes */}
        {signal.analyst_notes ? (
          <div className="px-5 py-2">
            <div className="rounded-xl border border-amber-500/15 bg-amber-500/[0.04] p-3 text-[11px] text-slate-300 leading-relaxed">
              <span className="text-[9px] font-semibold uppercase tracking-widest text-amber-500/70 block mb-1">Analyst Note</span>
              {signal.analyst_notes}
            </div>
          </div>
        ) : null}

        {/* ── ACTION BAR — sticky, all actions together ── */}
        <div className="sticky bottom-0 flex flex-wrap items-center gap-2 border-t border-white/[0.06] bg-[#0C1424]/95 backdrop-blur-sm px-5 py-3">
          {/* Primary: Generate SitRep */}
          <button
            type="button"
            onClick={() => setShowSitRep(true)}
            data-testid="alert-detail-sitrep"
            className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-cyan-600 to-teal-600 px-4 py-2 text-[11px] font-bold text-white shadow-lg shadow-cyan-900/20 transition-all hover:shadow-cyan-800/30 hover:brightness-110 active:scale-[0.97]"
          >
            <FileText className="h-3.5 w-3.5" /> Generate SitRep
          </button>

          {/* Secondary: Re-run AI */}
          <button
            type="button"
            onClick={handleClassify}
            disabled={classifyState.status === 'loading'}
            data-testid="alert-detail-classify"
            className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-[11px] font-semibold text-slate-300 transition-all hover:bg-white/[0.06] hover:text-white disabled:opacity-50 active:scale-[0.97]"
          >
            {classifyState.status === 'loading' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            {classifyState.status === 'loading'
              ? 'Running…'
              : agentSteps.length > 0
                ? 'Re-run AI'
                : 'Run AI'}
          </button>

          {/* Promote to Incident */}
          {onPromote ? (
            <button
              type="button"
              onClick={() => onPromote(signal)}
              data-testid="alert-detail-promote"
              className="inline-flex items-center gap-1.5 rounded-full border border-indigo-500/20 bg-indigo-500/10 px-4 py-2 text-[11px] font-semibold text-indigo-300 transition-all hover:bg-indigo-500/20 active:scale-[0.97]"
            >
              <TrendingUp className="h-3.5 w-3.5" /> Promote
            </button>
          ) : null}

          {/* Classification error */}
          {classifyState.status === 'error' ? (
            <p className="text-[10px] text-red-400" data-testid="alert-detail-classify-error">
              {classifyState.message}
            </p>
          ) : null}
        </div>
      </div>

      {showSitRep ? (
        <SituationReport
          country={country || iso3 || 'Region'}
          iso3={iso3}
          signals={countrySignals}
          onClose={() => setShowSitRep(false)}
        />
      ) : null}
    </>
  );
}
