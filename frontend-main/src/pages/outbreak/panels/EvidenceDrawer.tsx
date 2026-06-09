/**
 * EvidenceDrawer (T-080) — slide-out panel that resolves a citation
 * (evt:N | cap:KEY | path:FIELD) into something readable.
 *
 * Lives at workspace level; widgets call `onCitationClick(c)` and the
 * workspace forwards into here.
 */

import { useMemo } from 'react';
import type { OutbreakEvent, OutbreakCapacity, Outbreak } from '../services/outbreakApi';

interface Props {
  citation: string | null;
  onClose: () => void;
  events: OutbreakEvent[];
  capacity?: OutbreakCapacity;
  outbreak?: Outbreak;
}

export default function EvidenceDrawer({
  citation, onClose, events, capacity, outbreak,
}: Props) {
  const resolved = useMemo(() => {
    if (!citation) return null;
    const [type, key] = citation.split(':');
    if (!type || !key) return { title: 'Unparseable citation', body: citation };
    if (type === 'evt') {
      const evt = events.find((e) => String(e.id) === key);
      if (!evt) return { title: `Event ${key} not in window`, body: 'The event may have aged out of the local cache.' };
      return {
        title: `Event ${evt.id} — ${evt.kind} (${evt.source})`,
        body: JSON.stringify(evt.payload_json, null, 2),
        meta: `${evt.ts} · geo=${evt.geo || '?'} · confidence=${evt.confidence}`,
      };
    }
    if (type === 'cap' && capacity) {
      const bucket = (capacity as unknown as Record<string, unknown>)[key];
      if (!bucket) return { title: `Capacity ${key} unknown`, body: '' };
      return {
        title: `Capacity / ${key}`,
        body: JSON.stringify(bucket, null, 2),
      };
    }
    if (type === 'path' && outbreak) {
      const root = (outbreak.pathogen?.profile_json ?? {}) as Record<string, unknown>;
      const flat: Record<string, unknown> = {
        ...root,
        r0_min: outbreak.pathogen.r0_min,
        r0_max: outbreak.pathogen.r0_max,
        cfr_min: outbreak.pathogen.cfr_min,
        cfr_max: outbreak.pathogen.cfr_max,
        incubation_days_min: outbreak.pathogen.incubation_days_min,
        incubation_days_max: outbreak.pathogen.incubation_days_max,
        transmission_modes: outbreak.pathogen.transmission_modes,
        vaccine_available: outbreak.pathogen.vaccine_available,
        antiviral_available: outbreak.pathogen.antiviral_available,
      };
      // Allow `strains.bundibugyo.vaccine_available` style dotted lookups.
      const parts = key.split('.');
      let cur: unknown = flat;
      for (const p of parts) {
        if (cur && typeof cur === 'object') {
          cur = (cur as Record<string, unknown>)[p];
        } else {
          cur = undefined;
        }
      }
      return {
        title: `Pathogen profile / ${key}`,
        body: cur === undefined ? '(not set)' : JSON.stringify(cur, null, 2),
      };
    }
    return { title: 'Unknown citation', body: citation };
  }, [citation, events, capacity, outbreak]);

  if (!citation || !resolved) return null;

  return (
    <div className="ob-drawer-overlay" onClick={onClose}>
      <aside
        className="ob-drawer"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="ob-drawer-header">
          <span className="ob-drawer-citation">{citation}</span>
          <button type="button" className="ob-drawer-close" onClick={onClose}>
            close
          </button>
        </div>
        <h3 className="ob-drawer-title">{resolved.title}</h3>
        {resolved.meta && <div className="ob-drawer-meta">{resolved.meta}</div>}
        <pre className="ob-drawer-body">{resolved.body}</pre>
      </aside>
    </div>
  );
}
