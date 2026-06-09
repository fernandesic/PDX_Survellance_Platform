// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AgentTraceTimeline } from '../components/AgentTraceTimeline';
import type { AgentStep } from '../components/AgentConsole/AgentConsole.types';

function makeStep(overrides: Partial<AgentStep> = {}): AgentStep {
  return {
    step_number: overrides.step_number ?? 1,
    kind: overrides.kind ?? 'perceive',
    agent_name: overrides.agent_name ?? 'Monitor',
    input_summary: overrides.input_summary ?? 'input',
    output_summary: overrides.output_summary ?? 'output summary',
    reasoning: overrides.reasoning ?? 'Detailed reasoning text',
    citations: [],
    latency_ms: overrides.latency_ms ?? 0,
    tokens_used: null,
    model_name: overrides.model_name ?? '—',
    created_at: '2026-04-25T20:00:00Z',
  };
}

const FIVE_STEPS: AgentStep[] = [
  makeStep({ step_number: 1, kind: 'perceive', output_summary: 'Picked up SIG-42' }),
  makeStep({ step_number: 2, kind: 'classify', output_summary: 'continent_alert · critical' }),
  makeStep({ step_number: 3, kind: 'corroborate', output_summary: '3 sources found' }),
  makeStep({ step_number: 4, kind: 'review', output_summary: 'CRITICAL · continental' }),
  makeStep({ step_number: 5, kind: 'notify', output_summary: 'Gate passed · notification sent' }),
];

describe('AgentTraceTimeline', () => {
  it('renders loading skeleton when loading=true', () => {
    render(<AgentTraceTimeline steps={[]} loading={true} />);
    expect(screen.getByTestId('agent-trace-skeleton')).toBeInTheDocument();
  });

  it('renders empty state when steps is empty and not loading', () => {
    render(<AgentTraceTimeline steps={[]} loading={false} />);
    expect(screen.getByTestId('agent-trace-empty')).toHaveTextContent(/not yet classified/i);
  });

  it('renders all five steps', () => {
    render(<AgentTraceTimeline steps={FIVE_STEPS} />);
    expect(screen.getByTestId('agent-trace-step-perceive')).toBeInTheDocument();
    expect(screen.getByTestId('agent-trace-step-classify')).toBeInTheDocument();
    expect(screen.getByTestId('agent-trace-step-corroborate')).toBeInTheDocument();
    expect(screen.getByTestId('agent-trace-step-review')).toBeInTheDocument();
    expect(screen.getByTestId('agent-trace-step-notify')).toBeInTheDocument();
  });

  it('shows output_summary in collapsed row', () => {
    render(<AgentTraceTimeline steps={[makeStep({ output_summary: 'Picked up SIG-99' })]} />);
    expect(screen.getByTestId('agent-trace-step-perceive')).toHaveTextContent('Picked up SIG-99');
  });

  it('expands a step on click and shows reasoning', () => {
    render(
      <AgentTraceTimeline
        steps={[makeStep({ step_number: 2, kind: 'classify', reasoning: 'Two-pass agreement found' })]}
      />,
    );
    const step = screen.getByTestId('agent-trace-step-classify');
    expect(screen.queryByTestId('agent-trace-step-classify-expanded')).toBeNull();

    fireEvent.click(step.querySelector('button')!);
    expect(screen.getByTestId('agent-trace-step-classify-expanded')).toHaveTextContent(
      'Two-pass agreement found',
    );
  });

  it('collapses a step on second click', () => {
    render(<AgentTraceTimeline steps={[makeStep({ step_number: 1, kind: 'perceive' })]} />);
    const btn = screen.getByTestId('agent-trace-step-perceive').querySelector('button')!;
    fireEvent.click(btn);
    expect(screen.getByTestId('agent-trace-step-perceive-expanded')).toBeInTheDocument();
    fireEvent.click(btn);
    expect(screen.queryByTestId('agent-trace-step-perceive-expanded')).toBeNull();
  });

  it('shows model_name and latency_ms when expanded and non-zero', () => {
    render(
      <AgentTraceTimeline
        steps={[
          makeStep({
            step_number: 2,
            kind: 'classify',
            model_name: 'o4-mini',
            latency_ms: 1240,
          }),
        ]}
      />,
    );
    const btn = screen.getByTestId('agent-trace-step-classify').querySelector('button')!;
    fireEvent.click(btn);
    const expanded = screen.getByTestId('agent-trace-step-classify-expanded');
    expect(expanded).toHaveTextContent('o4-mini');
    expect(expanded).toHaveTextContent('1240ms');
  });
});
