/**
 * useScenarioRun — polling hook for scenario execution.
 *
 * Polls every 2s while status is PENDING/RUNNING, stops after SUCCESS/FAILED
 * or after maxPollDuration (5 min). Returns the latest run detail.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { scenariosApi } from './scenariosApi';
import type { ScenarioConfig, ScenarioRunDetail } from './scenariosApi';

const POLL_INTERVAL_MS = 2000;
const MAX_POLL_MS = 5 * 60 * 1000; // 5 minutes

interface UseScenarioRunReturn {
    /** Current run detail (null before first submission) */
    run: ScenarioRunDetail | null;
    /** True while waiting for API responses */
    loading: boolean;
    /** Error message on failure */
    error: string | null;
    /** Submit a new scenario config */
    submit: (config: ScenarioConfig) => Promise<void>;
    /** Clear the current run state */
    reset: () => void;
    /** True while polling is active */
    polling: boolean;
}

export function useScenarioRun(): UseScenarioRunReturn {
    const [run, setRun] = useState<ScenarioRunDetail | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [polling, setPolling] = useState(false);

    const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
    const pollStart = useRef<number>(0);

    const stopPolling = useCallback(() => {
        if (pollTimer.current) {
            clearInterval(pollTimer.current);
            pollTimer.current = null;
        }
        setPolling(false);
    }, []);

    const startPolling = useCallback((runId: number) => {
        stopPolling();
        pollStart.current = Date.now();
        setPolling(true);

        pollTimer.current = setInterval(async () => {
            // Timeout guard
            if (Date.now() - pollStart.current > MAX_POLL_MS) {
                stopPolling();
                setError('Simulation timed out (>5 min). Check run history.');
                return;
            }

            try {
                const detail = await scenariosApi.getRun(runId);
                setRun(detail);

                if (detail.status === 'SUCCESS' || detail.status === 'FAILED') {
                    stopPolling();
                    if (detail.status === 'FAILED') {
                        setError(detail.error_message || 'Simulation failed');
                    }
                }
            } catch (e: any) {
                // Don't stop polling on transient errors
                console.warn('Poll error:', e);
            }
        }, POLL_INTERVAL_MS);
    }, [stopPolling]);

    const submit = useCallback(async (config: ScenarioConfig) => {
        setLoading(true);
        setError(null);
        setRun(null);
        stopPolling();

        try {
            const stub = await scenariosApi.createRun(config);
            // Set initial state from the 202 response
            setRun({
                ...stub,
                summary_stats: null,
                error_message: '',
                has_output: false,
            } as ScenarioRunDetail);

            // Start polling
            startPolling(stub.id);
        } catch (e: any) {
            setError(e?.message || e?.detail || 'Failed to submit scenario');
        } finally {
            setLoading(false);
        }
    }, [startPolling, stopPolling]);

    const reset = useCallback(() => {
        stopPolling();
        setRun(null);
        setError(null);
        setLoading(false);
    }, [stopPolling]);

    // Cleanup on unmount
    useEffect(() => {
        return () => stopPolling();
    }, [stopPolling]);

    return { run, loading, error, submit, reset, polling };
}
