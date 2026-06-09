import type { Signal } from '../types';
import type { Signal as V1Signal } from '@/pages/alerts/types';

/**
 * Map a v2 Signal to the v1 Signal shape consumed by `useOutbreakDetection`.
 *
 * Mapped fields (everything the hook reads, plus `id` for React keys):
 *   - `id`
 *   - `disease_name`
 *   - `publishedAt`
 *   - `created_at`
 *   - `location.iso3 | country_iso | country`
 *
 * `hazard.name` is intentionally NOT mapped — the v2 Signal type has no
 * `hazard` field, so the hook falls through to `disease_name` (its existing
 * fallback). Mapping is deliberately narrow so divergence between the two
 * Signal shapes stays a compile-time error instead of a runtime surprise.
 */
export function adaptSignalsForOutbreakDetection(signals: Signal[]): V1Signal[] {
  return signals.map((s) => {
    const adapted: Partial<V1Signal> = {
      id: s.id,
      disease_name: s.disease_name,
      publishedAt: s.publishedAt,
      created_at: s.created_at,
      location: s.location
        ? {
            iso3: s.location.iso3,
            country_iso: s.location.country_iso,
            country: s.location.country,
          }
        : undefined,
    } as Partial<V1Signal>;
    return adapted as V1Signal;
  });
}
