import { useState } from 'react';
import { BrainCircuit, ChevronDown, ChevronRight, Eye, Link2, Scale, Send, Sparkles, Swords } from 'lucide-react';
import type { AgentStep, AgentStepKind } from './AgentConsole/AgentConsole.types';
import { CitationChips } from './CitationChips';

interface AgentTraceTimelineProps {
  steps: AgentStep[];
  loading?: boolean;
}

const STEP_META: Record<AgentStepKind, { icon: React.ReactNode; label: string; color: string }> = {
  perceive: {
    icon: <Eye className="h-3.5 w-3.5" />,
    label: 'Perceive',
    color: 'text-sky-400',
  },
  classify: {
    icon: <BrainCircuit className="h-3.5 w-3.5" />,
    label: 'Classify',
    color: 'text-violet-400',
  },
  corroborate: {
    icon: <Link2 className="h-3.5 w-3.5" />,
    label: 'Corroborate',
    color: 'text-emerald-400',
  },
  debate: {
    icon: <Swords className="h-3.5 w-3.5" />,
    label: 'Debate',
    color: 'text-rose-400',
  },
  review: {
    icon: <Scale className="h-3.5 w-3.5" />,
    label: 'Review',
    color: 'text-amber-400',
  },
  notify: {
    icon: <Send className="h-3.5 w-3.5" />,
    label: 'Notify',
    color: 'text-indigo-400',
  },
  reflect: {
    icon: <Sparkles className="h-3.5 w-3.5" />,
    label: 'Reflect',
    color: 'text-pink-400',
  },
};

export function AgentTraceTimeline({ steps, loading = false }: AgentTraceTimelineProps) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const toggle = (stepNumber: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(stepNumber)) {
        next.delete(stepNumber);
      } else {
        next.add(stepNumber);
      }
      return next;
    });
  };

  if (loading) {
    return (
      <ul className="space-y-1.5" data-testid="agent-trace-skeleton" aria-busy="true">
        {Array.from({ length: 5 }).map((_, i) => (
          <li
            key={i}
            className="flex items-center gap-2 rounded-md border border-white/5 bg-white/[0.02] px-2 py-1.5"
          >
            <div className="h-3.5 w-3.5 animate-pulse rounded bg-white/10" />
            <div className="h-2.5 w-16 animate-pulse rounded bg-white/10" />
            <div className="h-2.5 flex-1 animate-pulse rounded bg-white/5" />
          </li>
        ))}
      </ul>
    );
  }

  if (steps.length === 0) {
    return (
      <p className="text-xs text-slate-500" data-testid="agent-trace-empty">
        Not yet classified — click Re-run agent below
      </p>
    );
  }

  return (
    <ul className="space-y-1" data-testid="agent-trace-timeline">
      {steps.map((step) => {
        const meta = STEP_META[step.kind] ?? {
          icon: <Sparkles className="h-3.5 w-3.5" />,
          label: step.kind,
          color: 'text-slate-400',
        };
        const isExpanded = expanded.has(step.step_number);

        return (
          <li
            key={step.step_number}
            className="rounded-md border border-white/5 bg-white/[0.02] text-xs"
            data-testid={`agent-trace-step-${step.kind}`}
          >
            {/* Collapsed row */}
            <button
              type="button"
              onClick={() => toggle(step.step_number)}
              className="flex w-full items-center gap-2 px-2 py-1.5 text-left"
              aria-expanded={isExpanded}
            >
              <span className={meta.color}>{meta.icon}</span>
              <span className={`w-[72px] shrink-0 font-semibold uppercase tracking-[0.1em] text-[9px] ${meta.color}`}>
                {meta.label}
              </span>
              <span className="flex-1 truncate text-slate-300">{step.output_summary}</span>
              <span className="shrink-0 text-slate-600">
                {isExpanded ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )}
              </span>
            </button>

            {/* Expanded detail */}
            {isExpanded ? (
              <div className="border-t border-white/5 px-2 py-2 space-y-1.5" data-testid={`agent-trace-step-${step.kind}-expanded`}>
                {step.reasoning ? (
                  <p className="leading-relaxed text-slate-400">{step.reasoning}</p>
                ) : null}
                {step.citations && step.citations.length > 0 ? (
                  <CitationChips citations={step.citations} />
                ) : null}
                <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[10px] text-slate-600">
                  {step.model_name && step.model_name !== '—' ? (
                    <span>model: {step.model_name}</span>
                  ) : null}
                  {step.latency_ms > 0 ? (
                    <span>{step.latency_ms}ms</span>
                  ) : null}
                  {step.tokens_used != null ? (
                    <span>{step.tokens_used} tokens</span>
                  ) : null}
                </div>
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
