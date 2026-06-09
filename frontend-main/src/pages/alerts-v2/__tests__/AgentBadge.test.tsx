// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AgentBadge } from '../components/AgentBadge';

describe('AgentBadge', () => {
  it('returns null when no classification and no severity', () => {
    const { container } = render(
      <AgentBadge aiClassification={undefined} aiSeverity={undefined} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders continent_alert with gradient pill', () => {
    render(
      <AgentBadge
        aiClassification="continent_alert"
        aiSeverity="critical"
        confidence={0.91}
      />,
    );
    const badge = screen.getByTestId('agent-badge');
    expect(badge).toHaveTextContent('CONTINENT ALERT');
    expect(badge).toHaveTextContent('CRITICAL');
    // Confidence shown as percentage, not "conf 0.91"
    expect(screen.getByTestId('agent-badge-confidence')).toHaveTextContent('91%');
  });

  it('renders area_alert with gradient pill', () => {
    render(<AgentBadge aiClassification="area_alert" aiSeverity="high" />);
    const badge = screen.getByTestId('agent-badge');
    expect(badge).toHaveTextContent('AREA ALERT');
    expect(badge).toHaveTextContent('HIGH');
  });

  it('renders no_alert in emerald tone', () => {
    render(<AgentBadge aiClassification="no_alert" aiSeverity={undefined} />);
    const badge = screen.getByTestId('agent-badge');
    expect(badge).toHaveTextContent('NO ALERT');
  });

  it('renders uncertain in slate tone', () => {
    render(<AgentBadge aiClassification="uncertain" aiSeverity={undefined} />);
    const badge = screen.getByTestId('agent-badge');
    expect(badge).toHaveTextContent('UNCERTAIN');
  });

  it('renders corroboration count when provided', () => {
    render(
      <AgentBadge
        aiClassification="continent_alert"
        aiSeverity="critical"
        corroborationCount={2}
      />,
    );
    const line = screen.getByTestId('agent-badge-corroboration');
    expect(line).toHaveTextContent('2 sources');
  });

  it('omits corroboration when count is undefined', () => {
    render(
      <AgentBadge
        aiClassification="area_alert"
        aiSeverity="high"
        corroborationCount={undefined}
      />,
    );
    expect(screen.queryByTestId('agent-badge-corroboration')).toBeNull();
  });

  it('sets title attribute from aiReasoning (first 140 chars)', () => {
    const reasoning = 'A'.repeat(200);
    render(
      <AgentBadge
        aiClassification="area_alert"
        aiSeverity="high"
        aiReasoning={reasoning}
      />,
    );
    const badge = screen.getByTestId('agent-badge');
    expect(badge.getAttribute('title')).toBe(reasoning.slice(0, 140));
  });

  it('normalises confidence values above 1 to percentage', () => {
    render(
      <AgentBadge
        aiClassification="area_alert"
        aiSeverity="high"
        confidence={87}
      />,
    );
    // 87 (percentage) → displayed as "87%"
    expect(screen.getByTestId('agent-badge-confidence')).toHaveTextContent('87%');
  });
});
