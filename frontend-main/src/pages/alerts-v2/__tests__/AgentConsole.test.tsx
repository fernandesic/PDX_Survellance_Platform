// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('@/lib/api', () => ({
  api: { get: vi.fn().mockResolvedValue({ data: { results: [] } }) },
}));
vi.mock('@/utils/logger', () => ({
  logger: { log: vi.fn(), warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

// Return empty stream so Live tab works without a real poll
vi.mock('../components/AgentConsole/useAgentStream', () => ({
  useAgentStream: () => [],
}));

// Mock signal service — ALL functions the components use
const mockFetchAgentRuns = vi.fn().mockResolvedValue([]);
const mockFetchAiStats = vi.fn().mockResolvedValue(null);

vi.mock('../services/signalService', async () => {
  const actual = await vi.importActual('../services/signalService') as object;
  return {
    ...actual,
    fetchAgentRuns: (...args: any[]) => mockFetchAgentRuns(...args),
    fetchAiStats: (...args: any[]) => mockFetchAiStats(...args),
  };
});

import { AgentConsole } from '../components/AgentConsole/AgentConsole';
import { AgentConsoleHistory } from '../components/AgentConsole/AgentConsole.history';

// ── Helpers ────────────────────────────────────────────────────────────────

function makeRun(overrides: Record<string, any> = {}) {
  return {
    run_id: overrides.run_id ?? 'run-1',
    signal_id: overrides.signal_id ?? 925,
    status: overrides.status ?? 'completed',
    started_at: overrides.started_at ?? new Date(Date.now() - 120_000).toISOString(),
    finished_at: overrides.finished_at ?? new Date(Date.now() - 115_000).toISOString(),
    confidence: overrides.confidence ?? 0.82,
    corroboration_count: overrides.corroboration_count ?? 2,
    provider: overrides.provider ?? 'openai',
    model_name: overrides.model_name ?? 'gpt-5.5',
    steps: overrides.steps ?? [
      {
        step_number: 1,
        kind: 'perceive',
        agent_name: 'Monitor',
        input_summary: '',
        output_summary: 'Picked up SIG-925 — Diphtheria, Niger',
        reasoning: '',
        citations: [],
        latency_ms: 50,
        tokens_used: null,
        model_name: 'gpt-5.5',
        created_at: new Date().toISOString(),
      },
      {
        step_number: 5,
        kind: 'review',
        agent_name: 'Adjudicator',
        input_summary: '',
        output_summary: 'continent_alert — severity: low, scope: local',
        reasoning: 'Some reasoning',
        citations: [],
        latency_ms: 1200,
        tokens_used: 340,
        model_name: 'gpt-5.5',
        created_at: new Date().toISOString(),
      },
    ],
  };
}

// ── AgentConsole integration tests ────────────────────────────────────────

describe('AgentConsole', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchAgentRuns.mockResolvedValue([]);
    mockFetchAiStats.mockResolvedValue(null);
  });

  it('renders with Live tab active by default', () => {
    render(<AgentConsole />);
    expect(screen.getByTestId('agent-console')).toBeInTheDocument();
    const liveTab = screen.getByTestId('agent-console-tab-live');
    expect(liveTab).toHaveAttribute('aria-selected', 'true');
  });

  it('shows the live panel content by default', () => {
    render(<AgentConsole />);
    expect(screen.getByTestId('agent-console-panel')).toBeInTheDocument();
  });

  it('switches to Stats tab and renders stats panel', () => {
    render(<AgentConsole />);
    fireEvent.click(screen.getByTestId('agent-console-tab-stats'));
    const statsEl = screen.queryByTestId('agent-console-stats')
                 || screen.queryByTestId('agent-console-stats-skeleton');
    expect(statsEl).toBeInTheDocument();
    expect(screen.getByTestId('agent-console-tab-stats')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('agent-console-tab-live')).toHaveAttribute('aria-selected', 'false');
  });

  it('switches to History tab and renders history panel', () => {
    render(<AgentConsole />);
    fireEvent.click(screen.getByTestId('agent-console-tab-history'));
    const historyEl = screen.queryByTestId('agent-console-history')
                   || screen.queryByTestId('agent-console-history-skeleton');
    expect(historyEl).toBeInTheDocument();
  });

  it('collapses when toggle button is clicked', () => {
    render(<AgentConsole />);
    const toggle = screen.getByTestId('agent-console-toggle');
    expect(screen.getByTestId('agent-console-panel')).toBeInTheDocument();

    fireEvent.click(toggle);
    expect(screen.queryByTestId('agent-console-panel')).toBeNull();
    expect(toggle).toHaveAttribute('aria-label', 'expand agent console');
  });

  it('expands again when toggle is clicked a second time', () => {
    render(<AgentConsole />);
    const toggle = screen.getByTestId('agent-console-toggle');
    fireEvent.click(toggle); // collapse
    fireEvent.click(toggle); // expand
    expect(screen.getByTestId('agent-console-panel')).toBeInTheDocument();
  });

  it('hides tabs when collapsed', () => {
    render(<AgentConsole />);
    fireEvent.click(screen.getByTestId('agent-console-toggle'));
    expect(screen.queryByTestId('agent-console-tab-live')).toBeNull();
  });
});

// ── AgentConsoleHistory unit tests ────────────────────────────────────────

describe('AgentConsoleHistory', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.clearAllMocks();
    mockFetchAgentRuns.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows loading skeleton while fetching', async () => {
    mockFetchAgentRuns.mockReturnValue(new Promise(() => {}));
    render(<AgentConsoleHistory />);
    expect(screen.getByTestId('agent-console-history-skeleton')).toBeInTheDocument();
  });

  it('shows empty state when no runs returned', async () => {
    mockFetchAgentRuns.mockResolvedValue([]);
    render(<AgentConsoleHistory />);
    await waitFor(() => {
      expect(screen.getByTestId('agent-console-history')).toBeInTheDocument();
    });
    expect(screen.getByText(/no agent runs yet/i)).toBeInTheDocument();
  });

  it('renders a list of runs when data is available', async () => {
    const runs = [makeRun(), makeRun({ run_id: 'run-2', signal_id: 918 })];
    mockFetchAgentRuns.mockResolvedValue(runs);
    render(<AgentConsoleHistory />);
    await waitFor(() => {
      expect(screen.getByTestId('agent-history-list')).toBeInTheDocument();
    });
    const items = screen.getAllByTestId('agent-history-item');
    expect(items).toHaveLength(2);
  });

  it('displays SIG-ID and classification from steps', async () => {
    mockFetchAgentRuns.mockResolvedValue([makeRun()]);
    render(<AgentConsoleHistory />);
    await waitFor(() => {
      expect(screen.getByText('SIG-925')).toBeInTheDocument();
    });
    expect(screen.getByText('continent alert')).toBeInTheDocument();
  });

  it('displays confidence as a formatted number', async () => {
    mockFetchAgentRuns.mockResolvedValue([makeRun({ confidence: 0.91 })]);
    render(<AgentConsoleHistory />);
    await waitFor(() => {
      expect(screen.getByText('conf 0.91')).toBeInTheDocument();
    });
  });

  it('displays corroboration count (plural)', async () => {
    mockFetchAgentRuns.mockResolvedValue([makeRun({ corroboration_count: 3 })]);
    render(<AgentConsoleHistory />);
    await waitFor(() => {
      expect(screen.getByText('3 srcs')).toBeInTheDocument();
    });
  });

  it('displays singular "src" for corroboration_count of 1', async () => {
    mockFetchAgentRuns.mockResolvedValue([makeRun({ corroboration_count: 1 })]);
    render(<AgentConsoleHistory />);
    await waitFor(() => {
      expect(screen.getByText('1 src')).toBeInTheDocument();
    });
  });

  it('calls onSelectAlert with signal_id when a run is clicked', async () => {
    const onSelectAlert = vi.fn();
    mockFetchAgentRuns.mockResolvedValue([makeRun({ signal_id: 925 })]);
    render(<AgentConsoleHistory onSelectAlert={onSelectAlert} />);
    await waitFor(() => {
      expect(screen.getByTestId('agent-history-item')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('agent-history-item'));
    expect(onSelectAlert).toHaveBeenCalledWith('925');
  });

  it('renders without onSelectAlert (optional prop) — clicking does not throw', async () => {
    mockFetchAgentRuns.mockResolvedValue([makeRun()]);
    render(<AgentConsoleHistory />);
    await waitFor(() => {
      expect(screen.getByTestId('agent-history-item')).toBeInTheDocument();
    });
    // Should not throw when onSelectAlert is not provided
    fireEvent.click(screen.getByTestId('agent-history-item'));
  });

  it('shows status badge for failed runs', async () => {
    mockFetchAgentRuns.mockResolvedValue([makeRun({ status: 'failed', steps: [] })]);
    render(<AgentConsoleHistory />);
    await waitFor(() => {
      expect(screen.getByText('Failed')).toBeInTheDocument();
    });
  });

  it('shows status badge for running runs', async () => {
    mockFetchAgentRuns.mockResolvedValue([
      makeRun({ status: 'running', finished_at: null, steps: [] }),
    ]);
    render(<AgentConsoleHistory />);
    await waitFor(() => {
      expect(screen.getByText('Running')).toBeInTheDocument();
    });
  });

  it('shows refresh button and triggers reload on click', async () => {
    mockFetchAgentRuns.mockResolvedValue([makeRun()]);
    render(<AgentConsoleHistory />);
    await waitFor(() => {
      expect(screen.getByTestId('agent-history-refresh')).toBeInTheDocument();
    });
    mockFetchAgentRuns.mockClear();
    mockFetchAgentRuns.mockResolvedValue([makeRun()]);
    fireEvent.click(screen.getByTestId('agent-history-refresh'));
    await waitFor(() => {
      expect(mockFetchAgentRuns).toHaveBeenCalledTimes(1);
    });
  });

  it('polls every 30 seconds', async () => {
    mockFetchAgentRuns.mockResolvedValue([makeRun()]);
    render(<AgentConsoleHistory />);
    await waitFor(() => {
      expect(mockFetchAgentRuns).toHaveBeenCalledTimes(1);
    });
    await act(async () => {
      vi.advanceTimersByTime(30_000);
    });
    expect(mockFetchAgentRuns).toHaveBeenCalledTimes(2);
  });

  it('handles run with no steps gracefully', async () => {
    mockFetchAgentRuns.mockResolvedValue([makeRun({ steps: [], confidence: 0 })]);
    render(<AgentConsoleHistory />);
    await waitFor(() => {
      expect(screen.getByTestId('agent-history-item')).toBeInTheDocument();
    });
    expect(screen.getByText('SIG-925')).toBeInTheDocument();
  });

  it('derives classification from classify step when no review step', async () => {
    mockFetchAgentRuns.mockResolvedValue([
      makeRun({
        steps: [
          {
            step_number: 2,
            kind: 'classify',
            agent_name: 'Classifier',
            input_summary: '',
            output_summary: 'area_alert — conservative pass',
            reasoning: '',
            citations: [],
            latency_ms: 800,
            tokens_used: null,
            model_name: 'gpt-5.5',
            created_at: new Date().toISOString(),
          },
        ],
      }),
    ]);
    render(<AgentConsoleHistory />);
    await waitFor(() => {
      expect(screen.getByText('area alert')).toBeInTheDocument();
    });
  });

  it('computes latency from started_at/finished_at', async () => {
    const started = new Date(Date.now() - 60_000);
    const finished = new Date(started.getTime() + 5100); // 5.1s
    mockFetchAgentRuns.mockResolvedValue([
      makeRun({
        started_at: started.toISOString(),
        finished_at: finished.toISOString(),
      }),
    ]);
    render(<AgentConsoleHistory />);
    await waitFor(() => {
      expect(screen.getByText('5.1s')).toBeInTheDocument();
    });
  });
});
