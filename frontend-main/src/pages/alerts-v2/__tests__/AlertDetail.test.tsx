// @vitest-environment jsdom
/**
 * Rendered component tests for AlertDetail — covers the redesigned
 * "intelligence brief" layout: verdict card, source block, actions bar.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('@/lib/api', () => ({
  api: { get: vi.fn().mockResolvedValue({ data: null }) },
}));
vi.mock('@/utils/logger', () => ({
  logger: { log: vi.fn(), warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));
vi.mock('file-saver', () => ({ saveAs: vi.fn() }));
vi.mock('../services/signalService', () => ({
  fetchAlertById: vi.fn().mockResolvedValue(null),
  fetchAgentRuns: vi.fn().mockResolvedValue([]),
}));

import { AlertDetail } from '../components/AlertDetail';
import type { Signal } from '../types';

function sig(overrides: Partial<Signal> = {}): Signal {
  return {
    id: overrides.id ?? 's-1',
    location: overrides.location ?? {},
    ...overrides,
  } as Signal;
}

describe('AlertDetail — verdict card rendering', () => {
  it('renders disease headline, verdict card with epi stats, and timeline', async () => {
    const signal = sig({
      id: '42',
      disease_name: 'Cholera',
      reported_cases: 120,
      reported_deaths: 3,
      location: { country: 'Nigeria', iso3: 'NGA' },
      source: { name: 'WHO AFRO', tier: 1 },
      ai_classification: 'area_alert',
      ai_severity: 'critical',
      ai_reasoning: 'Rapid case doubling over 48h.',
    });
    render(<AlertDetail signal={signal} allSignals={[signal]} onClose={() => {}} />);

    expect(screen.getByTestId('alert-detail')).toBeInTheDocument();
    // Disease is the headline
    expect(screen.getByText('Cholera')).toBeInTheDocument();
    // Epi stats in verdict card
    const situation = screen.getByTestId('alert-detail-situation');
    expect(situation).toHaveTextContent('120');
    expect(situation).toHaveTextContent('2.5%');
    // Classification pills
    const verdict = screen.getByTestId('alert-detail-verdict');
    expect(verdict).toHaveTextContent(/area alert/i);
    expect(verdict).toHaveTextContent(/critical/i);
    // Timeline as single line
    expect(screen.getByTestId('alert-detail-timeline')).toBeInTheDocument();
  });
});

describe('AlertDetail — missing-data fallbacks', () => {
  it('renders em-dash when epi counts are absent', () => {
    const signal = sig({ id: '1', location: { country: 'Unknown' } });
    render(<AlertDetail signal={signal} allSignals={[signal]} onClose={() => {}} />);
    const situation = screen.getByTestId('alert-detail-situation');
    // New design uses "—" for missing data instead of "Not reported"
    expect(situation).toHaveTextContent('—');
  });

  it('shows "Not yet classified" when AI has not classified', async () => {
    const signal = sig({ id: '1', location: { country: 'Unknown' } });
    render(<AlertDetail signal={signal} allSignals={[signal]} onClose={() => {}} />);
    await waitFor(() =>
      expect(screen.getByText(/not yet classified/i)).toBeInTheDocument(),
    );
  });
});

describe('AlertDetail — close button', () => {
  it('calls onClose when the close button is clicked', () => {
    const onClose = vi.fn();
    const signal = sig({ id: '1', location: { country: 'Unknown' } });
    render(<AlertDetail signal={signal} allSignals={[signal]} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /close detail/i }));
    expect(onClose).toHaveBeenCalled();
  });
});

describe('AlertDetail — action bar', () => {
  it('renders SitRep and Run AI buttons', () => {
    const signal = sig({ id: '1', location: { country: 'Niger' } });
    render(<AlertDetail signal={signal} allSignals={[signal]} onClose={() => {}} />);
    expect(screen.getByTestId('alert-detail-sitrep')).toBeInTheDocument();
    expect(screen.getByTestId('alert-detail-classify')).toBeInTheDocument();
  });
});
