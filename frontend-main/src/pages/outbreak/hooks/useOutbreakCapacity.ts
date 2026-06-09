/**
 * useOutbreakCapacity — T-091
 *
 * TanStack Query hook that fetches the combined capacity blob from
 * /outbreak/outbreaks/<id>/capacity/ — readiness, IHR, CHW, STAR,
 * spillover and composite risk in one call.
 *
 * 60s refetch matches the cadence on the rest of the workspace.
 */

import { useQuery } from '@tanstack/react-query';
import {
  fetchOutbreakCapacity,
  type OutbreakCapacity,
} from '../services/outbreakApi';

export function useOutbreakCapacity(outbreakId: number | undefined, viewIso3?: string) {
  return useQuery<OutbreakCapacity>({
    // Include viewIso3 in the key so swapping country triggers a fresh
    // fetch but keeps the previous country's data cached for quick
    // toggle-back.
    queryKey: ['outbreak-capacity', outbreakId, viewIso3 || null],
    queryFn: () => fetchOutbreakCapacity(outbreakId as number, viewIso3),
    enabled: !!outbreakId,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}
