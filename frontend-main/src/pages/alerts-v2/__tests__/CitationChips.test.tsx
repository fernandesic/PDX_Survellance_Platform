// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CitationChips } from '../components/CitationChips';
import type { Citation } from '../components/AgentConsole/AgentConsole.types';

function makeCitation(overrides: Partial<Citation> = {}): Citation {
  return {
    source_id: overrides.source_id ?? 1,
    source_name: overrides.source_name ?? 'WHO',
    source_url: 'source_url' in overrides ? (overrides.source_url as string | null) : 'https://who.int/news',
    tier: overrides.tier ?? 1,
    relevance: overrides.relevance ?? 0.9,
    matched_at: overrides.matched_at ?? new Date().toISOString(),
  };
}

describe('CitationChips', () => {
  it('renders nothing when citations array is empty', () => {
    const { container } = render(<CitationChips citations={[]} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing when citations is undefined-like', () => {
    const { container } = render(<CitationChips citations={null as any} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders one chip per citation', () => {
    const citations = [
      makeCitation({ source_name: 'WHO' }),
      makeCitation({ source_name: 'Reuters', tier: 2 }),
      makeCitation({ source_name: 'AllAfrica', tier: 3 }),
    ];
    render(<CitationChips citations={citations} />);
    const chips = screen.getAllByTestId('citation-chip');
    expect(chips).toHaveLength(3);
  });

  it('displays source name on each chip', () => {
    render(
      <CitationChips
        citations={[makeCitation({ source_name: 'WHO Disease Outbreak News' })]}
      />,
    );
    expect(screen.getByText('WHO Disease Outbreak News')).toBeInTheDocument();
  });

  it('shows T1 badge for tier 1 sources', () => {
    render(<CitationChips citations={[makeCitation({ tier: 1 })]} />);
    expect(screen.getByText('T1')).toBeInTheDocument();
  });

  it('shows T2 badge for tier 2 sources', () => {
    render(
      <CitationChips citations={[makeCitation({ tier: 2 })]} />,
    );
    expect(screen.getByText('T2')).toBeInTheDocument();
  });

  it('shows T3 badge for tier 3 sources', () => {
    render(
      <CitationChips citations={[makeCitation({ tier: 3 })]} />,
    );
    expect(screen.getByText('T3')).toBeInTheDocument();
  });

  it('defaults to T3 for unknown tier values', () => {
    render(
      <CitationChips citations={[makeCitation({ tier: 99 as any })]} />,
    );
    expect(screen.getByText('T3')).toBeInTheDocument();
  });

  it('renders a link when source_url is present', () => {
    render(
      <CitationChips
        citations={[makeCitation({ source_url: 'https://who.int/news' })]}
      />,
    );
    const chip = screen.getByTestId('citation-chip');
    expect(chip.tagName).toBe('A');
    expect(chip).toHaveAttribute('href', 'https://who.int/news');
    expect(chip).toHaveAttribute('target', '_blank');
    expect(chip).toHaveAttribute('rel', 'noreferrer');
  });

  it('renders a span (not a link) when source_url is null', () => {
    render(
      <CitationChips
        citations={[makeCitation({ source_url: null })]}
      />,
    );
    const chip = screen.getByTestId('citation-chip');
    expect(chip.tagName).toBe('SPAN');
    expect(chip).not.toHaveAttribute('href');
  });

  it('shows tooltip with source name, tier, and matched time', () => {
    const matchedAt = new Date(Date.now() - 3600_000 * 5).toISOString(); // 5h ago
    render(
      <CitationChips
        citations={[makeCitation({ source_name: 'Reuters', tier: 2, matched_at: matchedAt })]}
      />,
    );
    const chip = screen.getByTestId('citation-chip');
    const title = chip.getAttribute('title') ?? '';
    expect(title).toContain('Reuters');
    expect(title).toContain('Tier 2');
    expect(title).toContain('5h ago');
  });

  it('handles mixed chips — some with URL, some without', () => {
    const citations = [
      makeCitation({ source_name: 'WHO', source_url: 'https://who.int' }),
      makeCitation({ source_name: 'ProMED', source_url: null }),
    ];
    render(<CitationChips citations={citations} />);
    const chips = screen.getAllByTestId('citation-chip');
    expect(chips[0].tagName).toBe('A');
    expect(chips[1].tagName).toBe('SPAN');
  });

  it('handles string tier values via coercion', () => {
    render(
      <CitationChips citations={[makeCitation({ tier: '2' as any })]} />,
    );
    expect(screen.getByText('T2')).toBeInTheDocument();
  });
});
