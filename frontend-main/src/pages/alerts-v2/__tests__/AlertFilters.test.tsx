// @vitest-environment jsdom
/**
 * Rendered component tests for AlertFilters — covers that filter changes fire
 * onChange with the expected payload and the reset button clears active facets.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';

import { AlertFilters } from '../components/AlertFilters';
import { EMPTY_FILTERS } from '../types';

/** Open the CustomSelect identified by `testId` and return its option panel. */
function openSelect(testId: string): HTMLElement {
  fireEvent.click(screen.getByTestId(testId));
  // Panel is the sibling popup that contains the option buttons. We grab it
  // by walking up to the CustomSelect wrapper and finding the nested popup.
  const trigger = screen.getByTestId(testId);
  const wrapper = trigger.parentElement!;
  const panel = wrapper.querySelector<HTMLElement>(':scope > div');
  if (!panel) throw new Error(`No options panel after opening ${testId}`);
  return panel;
}

describe('AlertFilters — controlled change callbacks', () => {
  it('fires onChange with the toggled priority when a severity button is clicked', () => {
    const onChange = vi.fn();
    render(<AlertFilters filters={EMPTY_FILTERS} onChange={onChange} />);
    fireEvent.click(screen.getByTestId('alert-filters-severity-P1'));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0].priorities).toEqual(['P1']);
  });

  it('fires onChange with the selected date range', () => {
    const onChange = vi.fn();
    render(<AlertFilters filters={EMPTY_FILTERS} onChange={onChange} />);
    const panel = openSelect('alert-filters-daterange');
    fireEvent.click(within(panel).getByText('Last 7 days'));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ dateRange: '7d' }));
  });

  it('fires onChange with the selected country iso3', () => {
    const onChange = vi.fn();
    render(<AlertFilters filters={EMPTY_FILTERS} onChange={onChange} />);
    const panel = openSelect('alert-filters-country');
    fireEvent.click(within(panel).getByText('Nigeria'));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ countries: ['NGA'] }),
    );
  });
});

describe('AlertFilters — active count badge', () => {
  it('hides the badge when no filters are active', () => {
    render(<AlertFilters filters={EMPTY_FILTERS} onChange={() => {}} />);
    expect(screen.queryByTestId('alert-filters-active-count')).not.toBeInTheDocument();
  });

  it('shows the count when filters are active', () => {
    render(
      <AlertFilters
        filters={{ ...EMPTY_FILTERS, priorities: ['P1'], countries: ['NGA'] }}
        onChange={() => {}}
      />,
    );
    expect(screen.getByTestId('alert-filters-active-count')).toHaveTextContent('2');
  });
});

describe('AlertFilters — reset', () => {
  it('is disabled with no active filters', () => {
    render(<AlertFilters filters={EMPTY_FILTERS} onChange={() => {}} />);
    expect(screen.getByTestId('alert-filters-reset')).toBeDisabled();
  });

  it('fires onChange with the empty filter preset when clicked', () => {
    const onChange = vi.fn();
    render(
      <AlertFilters
        filters={{ ...EMPTY_FILTERS, priorities: ['P1'] }}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByTestId('alert-filters-reset'));
    expect(onChange).toHaveBeenCalledWith(EMPTY_FILTERS);
  });
});

describe('AlertFilters — disease-scoped country list', () => {
  it('limits country options to the supplied iso3 set', () => {
    render(
      <AlertFilters
        filters={EMPTY_FILTERS}
        onChange={() => {}}
        availableCountryIso3s={['NGA', 'KEN']}
      />,
    );
    const panel = openSelect('alert-filters-country');
    expect(within(panel).getByText('Kenya')).toBeInTheDocument();
    expect(within(panel).getByText('Nigeria')).toBeInTheDocument();
    expect(within(panel).queryByText('South Africa')).not.toBeInTheDocument();
  });

  it('shows the full country list when the scope is null', () => {
    render(
      <AlertFilters
        filters={EMPTY_FILTERS}
        onChange={() => {}}
        availableCountryIso3s={null}
      />,
    );
    const panel = openSelect('alert-filters-country');
    expect(within(panel).getByText('Kenya')).toBeInTheDocument();
    expect(within(panel).getByText('Nigeria')).toBeInTheDocument();
    expect(within(panel).getByText('South Africa')).toBeInTheDocument();
  });

  it('clears the selected country when it falls outside the new scope', () => {
    const onChange = vi.fn();
    render(
      <AlertFilters
        filters={{ ...EMPTY_FILTERS, countries: ['ZAF'] }}
        onChange={onChange}
        availableCountryIso3s={['NGA', 'KEN']}
      />,
    );
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ countries: [] }),
    );
  });

  it('does not clear the selected country when it stays in scope', () => {
    const onChange = vi.fn();
    render(
      <AlertFilters
        filters={{ ...EMPTY_FILTERS, countries: ['NGA'] }}
        onChange={onChange}
        availableCountryIso3s={['NGA', 'KEN']}
      />,
    );
    expect(onChange).not.toHaveBeenCalled();
  });
});
