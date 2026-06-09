import { MapPin, X, Zap } from 'lucide-react';
import type { AgentStep, AgentStepKind } from './AgentConsole.types';
import { useAgentStream } from './useAgentStream';

interface AgentConsoleLiveProps {
  /** When set, polling and the rendered list are filtered to this ISO3 country. */
  activeCountry?: string | null;
  onClearCountry?: () => void;
}

/**
 * Translate raw pipeline step output into a human-readable one-liner.
 * A WHO officer should be able to scan these and understand what happened
 * without knowing what "pass_1=uncertain" means.
 */
function humanize(step: AgentStep): string {
  const out = step.output_summary || '';

  switch (step.kind) {
    case 'perceive': {
      // "Picked up SIG-837 — Cholera, Ghana" → keep as-is, already readable
      return out.replace(/^Picked up /, '📥 ');
    }
    case 'classify': {
      // "pass_1=uncertain · pass_2=area_alert · ✗ DISAGREEMENT" → humanize
      const agreementMatch = out.match(/✓\s*AGREEMENT/i);
      const disagreementMatch = out.match(/✗\s*DISAGREEMENT/i);
      // Extract the classifications
      const classMatch = out.match(/pass_\d=(\w+)/g);
      const classes = classMatch?.map((m) => m.split('=')[1]) ?? [];

      if (agreementMatch && classes.length > 0) {
        return `🧠 Classified as ${formatClass(classes[0])} — both analyses agreed`;
      }
      if (disagreementMatch && classes.length >= 2) {
        return `🧠 Split verdict: ${formatClass(classes[0])} vs ${formatClass(classes[1])}`;
      }
      // Fallback: just show classification
      if (classes.length > 0) {
        return `🧠 Classified as ${formatClass(classes[0])}`;
      }
      return `🧠 ${out}`;
    }
    case 'corroborate': {
      // "0 independent source(s) · Tier-1: 0" → simplify
      const countMatch = out.match(/(\d+)\s+independent/);
      const count = countMatch ? parseInt(countMatch[1], 10) : 0;
      if (count === 0) return '🔗 No corroborating sources found';
      return `🔗 ${count} corroborating source${count !== 1 ? 's' : ''} found`;
    }
    case 'debate': {
      // "Adjudicator: area_alert · conf=0.81" → humanize
      const adjMatch = out.match(/Adjudicator:\s*(\w+)/);
      const confMatch = out.match(/conf[=:]?\s*([\d.]+)/);
      if (adjMatch) {
        const conf = confMatch ? ` · ${Math.round(parseFloat(confMatch[1]) * 100)}%` : '';
        return `⚔️ Adjudicator ruled ${formatClass(adjMatch[1])}${conf}`;
      }
      return `⚔️ ${out}`;
    }
    case 'review': {
      // "severity=high · scope=continental" → humanize
      const sevMatch = out.match(/severity[=:]?\s*(\w+)/i);
      const scopeMatch = out.match(/scope[=:]?\s*(\w+)/i);
      if (sevMatch) {
        const scope = scopeMatch ? ` · ${scopeMatch[1]}` : '';
        return `⚖️ ${capitalize(sevMatch[1])} severity${scope}`;
      }
      return `⚖️ ${out}`;
    }
    case 'notify': {
      const lower = out.toLowerCase();
      if (lower.includes('silent') || lower.includes('gate failed') || lower.includes('skipped')) {
        return '🔕 Monitoring only — below notification threshold';
      }
      if (lower.includes('email') || lower.includes('telegram')) {
        return '📤 Officers notified';
      }
      return `📤 ${out}`;
    }
    case 'reflect': {
      const lower = out.toLowerCase();
      if (lower.includes('consistent') && !lower.includes('inconsisten')) {
        return '✓ Reasoning consistent with evidence';
      }
      if (lower.includes('inconsisten')) {
        return '✗ Inconsistency detected in reasoning';
      }
      return `✨ ${out}`;
    }
    default:
      return out;
  }
}

function formatClass(raw: string): string {
  return raw
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

/** Step kind → subtle color. Using fewer, muted colors for Apple restraint. */
const KIND_COLOR: Record<AgentStepKind, string> = {
  perceive: 'text-slate-400',
  classify: 'text-violet-400',
  corroborate: 'text-slate-400',
  debate: 'text-amber-400',
  review: 'text-slate-400',
  notify: 'text-emerald-400',
  reflect: 'text-slate-500',
};

export function AgentConsoleLive({ activeCountry, onClearCountry }: AgentConsoleLiveProps) {
  // Hook lives here (not in AgentConsole) so polling only runs when the
  // Live tab is actually mounted — i.e. console expanded AND Live selected.
  const steps = useAgentStream(activeCountry ?? null);

  const header = activeCountry ? (
    <div className="flex shrink-0 items-center justify-between border-b border-white/5 px-2.5 py-1">
      <span className="text-[9px] font-semibold uppercase tracking-widest text-slate-500">
        Live activity
      </span>
      <button
        type="button"
        onClick={onClearCountry}
        title="Click to clear country filter"
        data-testid="agent-live-country-chip"
        className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-400 transition-colors hover:bg-emerald-500/20"
      >
        <MapPin className="h-2.5 w-2.5" />
        {activeCountry}
        <X className="h-2 w-2" />
      </button>
    </div>
  ) : null;

  if (steps.length === 0) {
    return (
      <div className="flex h-full flex-col" data-testid="agent-console-live">
        {header}
        <div className="flex flex-1 flex-col items-center justify-center gap-2 p-4">
          <Zap className="h-4 w-4 text-slate-700" />
          <span className="text-[11px] text-slate-600">
            {activeCountry
              ? `Listening for activity in ${activeCountry}…`
              : 'Listening for agent activity…'}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col" data-testid="agent-console-live">
      {header}
      <ul className="flex-1 space-y-px overflow-y-auto p-1.5" data-testid="agent-console-live-feed">
        {steps.map((step, i) => {
          const color = KIND_COLOR[step.kind] ?? 'text-slate-400';
          const text = humanize(step);

          return (
            <li
              key={`${step.created_at}-${i}`}
              className="flex items-start gap-2 rounded-md px-2 py-1 text-[10px] transition-colors hover:bg-white/[0.03]"
              data-testid="agent-console-live-item"
            >
              <span className="shrink-0 tabular-nums text-slate-600">
                {formatTime(step.created_at)}
              </span>
              <span className={`min-w-0 leading-relaxed ${color}`}>
                {text}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
