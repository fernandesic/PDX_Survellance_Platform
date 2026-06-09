// @vitest-environment jsdom
/**
 * Rendered component tests for AlertFeed — covers card rendering, priority
 * grouping, and search-driven filtering.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';

vi.mock('@/lib/api', () => ({
  api: { get: vi.fn().mockResolvedValue({ data: { results: [] } }) },
}));
vi.mock('@/utils/logger', () => ({
  logger: { log: vi.fn(), warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));
// useDebounce stalls search input for 250ms — skip the delay in tests.
vi.mock('@/utils', async () => {
  const actual = await vi.importActual<object>('@/utils');
  return { ...actual, useDebounce: <T,>(v: T) => v };
});

import { AlertFeed } from '../components/AlertFeed';
import type { Signal } from '../types';

function sig(overrides: Partial<Signal> = {}): Signal {
  return {
    id: overrides.id ?? 's-1',
    location: overrides.location ?? {},
    ...overrides,
  } as Signal;
}

describe('AlertFeed — rendering', () => {
  it('renders an empty-state when there are no alerts', () => {
    render(<AlertFeed alerts={[]} selectedAlertId={null} onSelectAlert={() => {}} />);
    expect(screen.getByTestId('alert-feed-empty')).toHaveTextContent('No alerts');
  });

  it('renders a continuous list of cards sorted by priority', () => {
    const alerts: Signal[] = [
      sig({ id: 'p1-a', priority: 'P1', disease_name: 'Ebola', location: { country: 'DRC' } }),
      sig({ id: 'p2-a', priority: 'P2', disease_name: 'Cholera', location: { country: 'Nigeria' } }),
      sig({ id: 'p3-a', priority: 'P3', disease_name: 'Measles', location: { country: 'Kenya' } }),
    ];
    render(<AlertFeed alerts={alerts} selectedAlertId={null} onSelectAlert={() => {}} />);

    const list = screen.getByTestId('alert-feed-list');
    const cards = within(list).getAllByTestId('alert-card');

    expect(cards).toHaveLength(3);
    expect(cards[0]).toHaveTextContent('CRITICAL');
    expect(cards[0]).toHaveTextContent('Ebola');
    expect(cards[1]).toHaveTextContent('HIGH');
    expect(cards[2]).toHaveTextContent('MEDIUM');
  });

  it('shows the skeleton while loading with no alerts yet', () => {
    render(<AlertFeed alerts={[]} selectedAlertId={null} onSelectAlert={() => {}} loading />);
    expect(screen.getByTestId('alert-feed-skeleton')).toBeInTheDocument();
  });
});

describe('AlertFeed — search', () => {
  const alerts: Signal[] = [
    sig({ id: 'a', priority: 'P1', disease_name: 'Cholera', location: { country: 'Nigeria' } }),
    sig({ id: 'b', priority: 'P1', disease_name: 'Measles', location: { country: 'Kenya' } }),
  ];

  it('filters cards by disease name', () => {
    render(<AlertFeed alerts={alerts} selectedAlertId={null} onSelectAlert={() => {}} />);
    fireEvent.change(screen.getByRole('searchbox', { name: /search alerts/i }), {
      target: { value: 'chol' },
    });
    const cards = screen.getAllByTestId('alert-card');
    expect(cards).toHaveLength(1);
    expect(cards[0]).toHaveTextContent('Cholera');
  });

  it('shows the no-match empty state when search excludes everything', () => {
    render(<AlertFeed alerts={alerts} selectedAlertId={null} onSelectAlert={() => {}} />);
    fireEvent.change(screen.getByRole('searchbox', { name: /search alerts/i }), {
      target: { value: 'zzzz' },
    });
    expect(screen.getByTestId('alert-feed-empty')).toHaveTextContent(/no alerts match/i);
  });
});

describe('AlertFeed — selection callback', () => {
  it('fires onSelectAlert with the card id when a card is clicked', () => {
    const onSelect = vi.fn();
    const alerts: Signal[] = [
      sig({ id: 'pick-me', priority: 'P1', disease_name: 'Ebola', location: { country: 'DRC' } }),
    ];
    render(<AlertFeed alerts={alerts} selectedAlertId={null} onSelectAlert={onSelect} />);
    fireEvent.click(screen.getByTestId('alert-card'));
    expect(onSelect).toHaveBeenCalledWith('pick-me');
  });
});
