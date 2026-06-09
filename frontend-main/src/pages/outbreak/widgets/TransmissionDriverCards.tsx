/**
 * Transmission-driver widgets (T-102..T-105). All render a clean empty
 * state until their backend adaptor reports healthy and emits events;
 * once events arrive they list them.
 */

import type { OutbreakEvent } from '../services/outbreakApi';
import { countryName, isoWithName } from '../utils/countryNames';

function listEvents(events: OutbreakEvent[], source: string) {
  return events.filter((e) => e.source === source).slice(0, 12);
}

// Animal-surveillance and similar adaptors write headlines containing bare
// iso codes ("in COD"). Rewrite the visible string so officers see "in DR
// Congo" without losing the iso anywhere else. The 3-letter token is only
// replaced when surrounded by spaces / punctuation so we don't damage e.g.
// "PCR" or other unrelated upper-case acronyms.
function humanizeHeadline(headline: string): string {
  if (!headline) return headline;
  return headline.replace(/\b([A-Z]{3})\b/g, (match) => {
    const name = countryName(match);
    return name && name !== match ? name : match;
  });
}

interface Props {
  events: OutbreakEvent[];
  onSelectEvent?: (id: number) => void;
}

function DriverCard({
  title, hint, source, events, onSelectEvent,
  filterEvent,
}: Props & {
  title: string;
  hint: string;
  source: string;
  /** Optional per-card row filter (e.g. drop zero-signal animal events). */
  filterEvent?: (e: OutbreakEvent) => boolean;
}) {
  let matches = listEvents(events, source);
  if (filterEvent) matches = matches.filter(filterEvent);
  return (
    <div className="ob-card">
      <h3 className="ob-card-title">{title}</h3>
      {matches.length === 0 ? (
        <p className="ob-no-data">{hint}</p>
      ) : (
        <div className="ob-event-list">
          {matches.map((e) => {
            const geo = e.geo || '';
            const geoName = countryName(geo);
            const rawHead = (e.payload_json?.headline as string) || `${source} signal`;
            return (
              <button
                key={e.id}
                type="button"
                className="ob-event-row"
                onClick={() => onSelectEvent?.(e.id)}
                title={geo ? isoWithName(geo) : undefined}
              >
                <span className="ob-event-meta">
                  <span className="ob-event-geo">{geo ? geoName : '?'}</span>
                  <span className="ob-event-time">
                    {new Date(e.ts).toLocaleDateString()}
                  </span>
                  <span className="ob-event-id">evt:{e.id}</span>
                </span>
                <span className="ob-event-head">{humanizeHeadline(rawHead)}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export const MobilityCard = (p: Props) => (
  <DriverCard
    {...p}
    title="Cross-border Movement"
    hint="No live mobility data."
    source="mobility"
  />
);

export const DeforestationCard = (p: Props) => (
  <DriverCard
    {...p}
    title="Deforestation Alerts"
    hint="No GFW GLAD alerts."
    source="deforestation"
  />
);

export const AnimalSurveillanceCard = (p: Props) => (
  <DriverCard
    {...p}
    title="Animal Surveillance"
    hint="No animal-mortality reports matching this pathogen in OneHealth."
    source="animal_surveillance"
    // Drop "Sick: 0, Dead: 0" rows — those are surveillance presence-checks
    // from oh_animal_events, not active outbreaks. They clutter the list
    // without telling the officer anything actionable.
    filterEvent={(e) => {
      const sick = Number(e.payload_json?.animals_sick ?? 0) || 0;
      const dead = Number(e.payload_json?.animals_dead ?? 0) || 0;
      return sick > 0 || dead > 0;
    }}
  />
);

export const ClimateCard = (p: Props) => (
  <DriverCard
    {...p}
    title="Climate Anomalies"
    hint="No rainfall/temperature anomalies."
    source="climate"
  />
);

export const SpilloverRiskListCard = (p: Props) => {
  const matches = p.events.filter((e) => e.source === 'spillover_risk').slice(0, 12);
  return (
    <div className="ob-card">
      <h3 className="ob-card-title">Spillover Risk by Country</h3>
      {matches.length === 0 ? (
        <p className="ob-no-data">
          No spillover scores yet. Trigger "Refresh signals" to fetch.
        </p>
      ) : (
        <div className="ob-event-list">
          {matches.map((e) => {
            const score = e.payload_json?.spillover_score as number | undefined;
            const stage = (e.payload_json?.stage_label as string) || (e.payload_json?.stage as string) || '';
            return (
              <button
                key={e.id}
                type="button"
                className="ob-event-row"
                onClick={() => p.onSelectEvent?.(e.id)}
                title={e.geo ? isoWithName(e.geo) : undefined}
              >
                <span className="ob-event-meta">
                  <span className="ob-event-geo">{e.geo ? countryName(e.geo) : '?'}</span>
                  <span className="ob-event-time">{new Date(e.ts).toLocaleDateString()}</span>
                  <span className="ob-event-id">evt:{e.id}</span>
                </span>
                <span className="ob-event-head">
                  Score {score != null ? Math.round(score) : '?'} {stage && `· ${stage}`}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
