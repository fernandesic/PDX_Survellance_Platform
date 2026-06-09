/**
 * OneHealthSpilloverPanel — full One Health spillover view for the
 * outbreak's pathogen.
 *
 * Renders three things the One Health module already computes:
 *   1. Recommended actions — `assess_country().recommended_actions`
 *   2. Signal breakdown — what drove the composite score (animal events,
 *      human contacts, environmental flags, IHR capacity gaps).
 *   3. At-risk peer countries — `get_early_warning()` top-N for this
 *      pathogen so the officer sees the regional picture, not just COD.
 *
 * Everything is sourced from `capacity.spillover` — no extra fetch.
 * If the engine returned no data, the whole panel is hidden (clean
 * empty handling per the "no fake data" rule).
 */

import { Biohazard, AlertTriangle, MapPin } from 'lucide-react';
import type { OutbreakCapacity } from '../services/outbreakApi';
import { countryName } from '../utils/countryNames';

interface Props {
  capacity?: OutbreakCapacity;
  /** Epicenter iso3 — used to highlight the host country in the peer list. */
  epicenterIso: string;
  /** Outbreak's declared neighbours — used as a fallback when the One Health
   *  early-warning engine returns an empty peer list for this pathogen. */
  neighbourIsos?: string[];
}

function tierColor(tier?: number): string {
  if (!tier) return 'var(--ob-text-dim)';
  if (tier >= 3) return '#fca5a5';
  if (tier >= 2) return '#fdba74';
  if (tier >= 1) return '#fde047';
  return 'var(--ob-text-muted)';
}

export default function OneHealthSpilloverPanel({
  capacity, epicenterIso, neighbourIsos = [],
}: Props) {
  const sp = capacity?.spillover;
  if (!sp || !sp.data_available) return null;

  const enginePeers = (sp.peers || []).filter((p) => p && p.iso3);
  const actions = sp.recommended_actions || [];
  const flags = sp.environmental_flags || [];
  const signalBreakdown = sp.signal_breakdown || [];

  // Engine's early-warning list only covers the 6 high-risk countries it
  // scans by default — for most outbreaks it returns nothing. Fall back to
  // the outbreak's declared neighbours so the officer still sees the
  // regional ring, with a clear label that these are "neighbours" not
  // engine-scored peers.
  const usedFallback = enginePeers.length === 0 && neighbourIsos.length > 0;
  const peerList = usedFallback
    ? neighbourIsos
        .filter((iso) => iso && iso.toUpperCase() !== epicenterIso.toUpperCase())
        .map((iso) => ({ iso3: iso.toUpperCase(), country: countryName(iso) }))
    : enginePeers;

  // Always render — even with sparse engine output, the stage ribbon +
  // neighbour ring is useful context. Only skip when absolutely nothing.
  if (!peerList.length && !actions.length && !flags.length && !signalBreakdown.length && !sp.stage_label && !sp.p_spillover_30d) {
    return null;
  }

  return (
    <div className="ob-card">
      <h3 className="ob-card-title">
        <Biohazard size={14} style={{ verticalAlign: 'middle', marginRight: 6, opacity: 0.7 }} />
        One Health spillover — engine assessment
      </h3>

      {/* Stage + alert tier ribbon */}
      <div className="ob-oh-ribbon">
        {sp.stage_label && (
          <span className="ob-oh-stage">{sp.stage_label}</span>
        )}
        {sp.alert_tier != null && (
          <span className="ob-oh-tier" style={{ color: tierColor(sp.alert_tier) }}>
            Tier {sp.alert_tier}
          </span>
        )}
        {sp.p_spillover_30d != null && (
          <span className="ob-oh-p30">
            30-day P(spillover) <strong>{(sp.p_spillover_30d * 100).toFixed(1)}%</strong>
          </span>
        )}
        {sp.seasonality_active && (
          <span className="ob-oh-season">Seasonality active</span>
        )}
      </div>

      {/* Recommended actions */}
      {actions.length > 0 && (
        <div className="ob-oh-block">
          <div className="ob-oh-block__title">
            <AlertTriangle size={12} /> Recommended actions
          </div>
          <ul className="ob-oh-actions">
            {actions.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Live env flags + signal breakdown */}
      {(flags.length > 0 || signalBreakdown.length > 0) && (
        <div className="ob-oh-block">
          <div className="ob-oh-block__title">Signal breakdown</div>
          {flags.length > 0 && (
            <div className="ob-oh-flags">
              {flags.map((f) => (
                <span key={f} className="ob-oh-flag-pill">{f}</span>
              ))}
            </div>
          )}
          {signalBreakdown.length > 0 && (
            <ul className="ob-oh-breakdown">
              {signalBreakdown.slice(0, 6).map((row, i) => (
                <li key={i}>
                  <span className="ob-oh-breakdown__label">{row.label ?? `signal ${i + 1}`}</span>
                  {row.value != null && (
                    <span className="ob-oh-breakdown__value">{Math.round(row.value)}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Peer countries — engine-ranked list, or declared neighbours fallback */}
      {peerList.length > 0 && (
        <div className="ob-oh-block">
          <div className="ob-oh-block__title">
            <MapPin size={12} />
            {usedFallback
              ? 'Neighbours at risk (engine has no scored peers — showing declared neighbours)'
              : 'At-risk countries (One Health early warning)'}
          </div>
          <div className="ob-oh-peers">
            {peerList.map((p) => {
              const isHost = p.iso3.toUpperCase() === epicenterIso.toUpperCase();
              const score = 'score' in p ? p.score : null;
              const stageLabel = 'stage_label' in p ? p.stage_label : undefined;
              const p30 = 'p_spillover_30d' in p ? p.p_spillover_30d : undefined;
              const animalEvents = 'active_animal_events' in p ? p.active_animal_events : 0;
              const humanContacts = 'human_contacts' in p ? p.human_contacts : 0;
              return (
                <div
                  key={p.iso3}
                  className={`ob-oh-peer ${isHost ? 'ob-oh-peer--host' : ''}`}
                  title={
                    score != null
                      ? `Score ${Math.round(score)} · ${stageLabel || 'unknown stage'}`
                      : `${p.country} — declared neighbour`
                  }
                >
                  <div className="ob-oh-peer__head">
                    <span className="ob-oh-peer__iso">{p.iso3}</span>
                    {isHost && <span className="ob-oh-peer__host">epicenter</span>}
                  </div>
                  <div className="ob-oh-peer__name">{p.country || countryName(p.iso3)}</div>
                  <div className="ob-oh-peer__score">
                    {score != null ? Math.round(score) : '—'}
                    <span className="ob-oh-peer__score-suffix">/100</span>
                  </div>
                  <div className="ob-oh-peer__sub">
                    {stageLabel || (usedFallback ? 'not engine-scored' : '')}
                    {p30 != null && (
                      <> · P30 {(p30 * 100).toFixed(0)}%</>
                    )}
                  </div>
                  {(animalEvents ?? 0) > 0 && (
                    <div className="ob-oh-peer__tag">{animalEvents} animal events</div>
                  )}
                  {(humanContacts ?? 0) > 0 && (
                    <div className="ob-oh-peer__tag">{humanContacts} human contacts</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
