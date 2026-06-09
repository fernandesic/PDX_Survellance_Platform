import type { AgentStep } from './AgentConsole/AgentConsole.types';
import type { AiClassification, AiSeverity } from '../types';

/**
 * Synthesize the 7-step agent pipeline into ONE human-readable sentence.
 * This is the "Claude speaks like a colleague" moment.
 */
export function synthesizeVerdict(steps: AgentStep[]): string {
  if (steps.length === 0) return '';

  const classifySteps = steps.filter((s) => s.kind === 'classify');
  const debateStep = steps.find((s) => s.kind === 'debate');
  const notifyStep = steps.find((s) => s.kind === 'notify');
  const reviewStep = steps.find((s) => s.kind === 'review');

  const parts: string[] = [];

  // Classification narrative
  if (debateStep) {
    // Disagreement path
    parts.push('AI agents disagreed — adjudicator ruled after adversarial review');
  } else if (classifySteps.length >= 2) {
    parts.push('Both AI analyses agreed on classification');
  } else if (classifySteps.length === 1) {
    parts.push('AI classified this signal');
  }

  // Notification outcome
  if (notifyStep) {
    const out = notifyStep.output_summary.toLowerCase();
    if (out.includes('silent') || out.includes('gate failed') || out.includes('skipped')) {
      parts.push('monitoring only');
    } else if (out.includes('email') || out.includes('telegram')) {
      parts.push('officers notified');
    }
  }

  return parts.join(' · ');
}

/**
 * Derive a notification status line from the notify step.
 */
export function notifyStatusLine(steps: AgentStep[]): {
  sent: boolean;
  text: string;
} {
  const notifyStep = steps.find((s) => s.kind === 'notify');
  if (!notifyStep) return { sent: false, text: '' };

  const out = notifyStep.output_summary.toLowerCase();
  if (out.includes('silent') || out.includes('gate failed') || out.includes('skipped')) {
    // Extract reason
    const confMatch = out.match(/conf[=:]?([\d.]+)/);
    if (confMatch) {
      return {
        sent: false,
        text: `Notification skipped — confidence ${Math.round(parseFloat(confMatch[1]) * 100)}% below 70% threshold`,
      };
    }
    return { sent: false, text: 'Notification skipped — below threshold' };
  }

  const channels: string[] = [];
  if (out.includes('email')) channels.push('email');
  if (out.includes('telegram')) channels.push('Telegram');
  return {
    sent: true,
    text: channels.length > 0
      ? `Notified via ${channels.join(' + ')}`
      : 'Officers notified',
  };
}

/**
 * Confidence level label + color.
 */
export function confidenceLevel(score: number | undefined): {
  label: string;
  color: string;
} {
  if (score === undefined || score === null) return { label: 'Unknown', color: 'text-slate-400' };
  const pct = score > 1 ? score : score * 100;
  if (pct >= 90) return { label: 'Very high', color: 'text-sky-400' };
  if (pct >= 70) return { label: 'High', color: 'text-emerald-400' };
  if (pct >= 50) return { label: 'Moderate', color: 'text-amber-400' };
  if (pct >= 30) return { label: 'Uncertain', color: 'text-orange-400' };
  return { label: 'Low', color: 'text-slate-400' };
}

/**
 * Classification accent colors for the verdict card.
 */
export function classificationAccent(c?: AiClassification): {
  gradient: string;
  bg: string;
  text: string;
  border: string;
  barFill: string;
  label: string;
} {
  switch (c) {
    case 'continent_alert':
      return {
        gradient: 'from-red-500 to-rose-600',
        bg: 'bg-red-500/10',
        text: 'text-red-400',
        border: 'border-red-500/20',
        barFill: 'bg-gradient-to-r from-red-500 to-rose-500',
        label: 'Continent Alert',
      };
    case 'area_alert':
      return {
        gradient: 'from-orange-500 to-amber-600',
        bg: 'bg-orange-500/10',
        text: 'text-orange-400',
        border: 'border-orange-500/20',
        barFill: 'bg-gradient-to-r from-orange-500 to-amber-500',
        label: 'Area Alert',
      };
    case 'no_alert':
      return {
        gradient: 'from-emerald-500 to-teal-600',
        bg: 'bg-emerald-500/10',
        text: 'text-emerald-400',
        border: 'border-emerald-500/20',
        barFill: 'bg-gradient-to-r from-emerald-500 to-teal-500',
        label: 'No Alert',
      };
    default:
      return {
        gradient: 'from-slate-500 to-slate-600',
        bg: 'bg-slate-500/10',
        text: 'text-slate-400',
        border: 'border-slate-500/20',
        barFill: 'bg-gradient-to-r from-slate-500 to-slate-600',
        label: c === 'uncertain' ? 'Uncertain' : 'Not Classified',
      };
  }
}

export function severityLabel(s?: AiSeverity): string {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Relative time formatting — "12h ago", "3d ago", "just now"
 */
export function relativeTime(iso?: string): string {
  if (!iso) return '—';
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return '—';
  const diffMs = Date.now() - ts;
  if (diffMs < 0) return 'just now';
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/**
 * Total pipeline latency from agent steps.
 */
export function totalLatency(steps: AgentStep[]): string {
  const totalMs = steps.reduce((sum, s) => sum + (s.latency_ms || 0), 0);
  if (totalMs <= 0) return '';
  return totalMs >= 1000 ? `${(totalMs / 1000).toFixed(1)}s` : `${totalMs}ms`;
}
