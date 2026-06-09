import { ExternalLink } from 'lucide-react';
import type { Citation } from './AgentConsole/AgentConsole.types';

interface CitationChipsProps {
  citations: Citation[];
}

/** Tier → color mapping for chip badges */
const TIER_STYLE: Record<number, { bg: string; text: string; border: string; label: string }> = {
  1: {
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-400',
    border: 'border-emerald-500/20',
    label: 'T1',
  },
  2: {
    bg: 'bg-sky-500/10',
    text: 'text-sky-400',
    border: 'border-sky-500/20',
    label: 'T2',
  },
  3: {
    bg: 'bg-slate-500/10',
    text: 'text-slate-400',
    border: 'border-slate-500/20',
    label: 'T3',
  },
};

function getTierStyle(tier: number | string) {
  const num = typeof tier === 'string' ? parseInt(tier, 10) : tier;
  return TIER_STYLE[num] ?? TIER_STYLE[3];
}

/**
 * Renders a row of clickable citation chips, each showing source name + tier badge.
 * Chips with a source_url open in a new tab.
 * Used in AgentTraceTimeline (under corroborate step) and AlertDetail (next to the timeline).
 */
export function CitationChips({ citations }: CitationChipsProps) {
  if (!citations || citations.length === 0) return null;

  return (
    <div
      className="flex flex-wrap gap-1.5"
      data-testid="citation-chips"
    >
      {citations.map((c, i) => {
        const style = getTierStyle(c.tier);
        const key = `${c.source_name}-${c.tier}-${i}`;

        if (c.source_url) {
          return (
            <a
              key={key}
              href={c.source_url}
              target="_blank"
              rel="noreferrer"
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors hover:brightness-125 ${style.bg} ${style.text} ${style.border}`}
              title={`${c.source_name} — Tier ${c.tier}${c.matched_at ? ` · matched ${formatMatchedAt(c.matched_at)}` : ''}`}
              data-testid="citation-chip"
            >
              <span className="truncate max-w-[120px]">{c.source_name}</span>
              <span className={`shrink-0 rounded-sm px-1 py-px text-[8px] font-bold uppercase ${style.bg}`}>
                {style.label}
              </span>
              <ExternalLink className="h-2.5 w-2.5 shrink-0 opacity-60" />
            </a>
          );
        }

        return (
          <span
            key={key}
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${style.bg} ${style.text} ${style.border}`}
            title={`${c.source_name} — Tier ${c.tier}${c.matched_at ? ` · matched ${formatMatchedAt(c.matched_at)}` : ''}`}
            data-testid="citation-chip"
          >
            <span className="truncate max-w-[120px]">{c.source_name}</span>
            <span className={`shrink-0 rounded-sm px-1 py-px text-[8px] font-bold uppercase ${style.bg}`}>
              {style.label}
            </span>
          </span>
        );
      })}
    </div>
  );
}

/** Format matched_at ISO string to a short relative/display form */
function formatMatchedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const diffMs = Date.now() - d.getTime();
  if (diffMs < 0) return 'just now';
  const diffH = Math.round(diffMs / 3600000);
  if (diffH < 1) return 'just now';
  if (diffH < 24) return `${diffH}h ago`;
  return `${Math.round(diffH / 24)}d ago`;
}
