/**
 * AlertDetailDrawer — Rich alert deep-dive panel
 * Opens when user clicks an alert, shows narrative + burden + pathogen + what-to-watch.
 * Ported from TRIAD_React.jsx → TypeScript + CSS variables from one-health.css.
 */
import { useState, useEffect } from "react";
import { apiGet } from "@/lib/api";

interface AlertExplainData {
  alert: Record<string, any>;
  narrative: string;
  what_to_watch: string[];
  pathogen: Record<string, any> | null;
  country: Record<string, any> | null;
  report: Record<string, any> | null;
  human_cases: any[];
  animal_events: any[];
  env_recent: any[];
  ihr_flags: { ihr_notifiable: boolean; woah_listed: boolean };
  summary: {
    human_cases_total: number;
    deaths_total: number;
    animals_affected: number;
    tier: number;
    from_aggregate?: boolean;
  };
  country_aggregate?: {
    alert_count: number;
    cases_sum: number;
    deaths_sum: number;
    first_seen: string | null;
    last_seen: string | null;
  };
}

interface AlertDetailDrawerProps {
  alertId: string | null;
  onClose: () => void;
}

const TIER_COLOR: Record<number, string> = {
  4: "var(--oh-crimson)", 3: "var(--oh-amber)",
  2: "var(--oh-cobalt)", 1: "var(--oh-text3)",
};

export default function AlertDetailDrawer({ alertId, onClose }: AlertDetailDrawerProps) {
  const [data, setData] = useState<AlertExplainData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!alertId) { setData(null); return; }
    let cancelled = false;
    setLoading(true);
    apiGet<AlertExplainData>(`/onehealth/alerts/${alertId}/explain`)
      .then((d) => { if (!cancelled && d) { setData(d); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [alertId]);

  if (!alertId) return null;

  const a = data?.alert || {};
  const tier = a.alert_tier || 1;
  const col = TIER_COLOR[tier] || TIER_COLOR[1];
  const summary = data?.summary || { human_cases_total: 0, deaths_total: 0, animals_affected: 0, tier: 1 };
  const path = data?.pathogen;
  const country = data?.country;

  return (
    <div
      className="oh-glass-card"
      style={{
        position: "fixed", right: 385, top: 58, bottom: 28, width: 360,
        zIndex: 700, display: "flex", flexDirection: "column",
        overflow: "hidden", boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "12px 14px", borderBottom: "1px solid var(--oh-border)",
          display: "flex", justifyContent: "space-between", alignItems: "flex-start",
          background: `linear-gradient(180deg, ${col}0c 0%, transparent 100%)`,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", gap: 7, alignItems: "center", marginBottom: 3 }}>
            <span className={`oh-tier-${tier}`} style={{ fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 4, fontFamily: "'IBM Plex Mono', monospace" }}>
              TIER {tier}
            </span>
            {/* Cast to bool — backend may serialise PG booleans as 0/1, and
                JSX's `value && <Component/>` renders the literal `0` when the
                left side is the number 0, producing a stray "00" badge. */}
            {Boolean(a.ihr_notifiable) && <span className="oh-tag-ihr" style={{ fontSize: 8.5, padding: "1px 4px", borderRadius: 3 }}>IHR</span>}
            {Boolean(a.woah_listed) && <span className="oh-tag-woah" style={{ fontSize: 8.5, padding: "1px 4px", borderRadius: 3 }}>WOAH</span>}
          </div>
          <div style={{ fontSize: 18, color: "var(--oh-text)", lineHeight: 1.2 }}>
            {a.disease_name || "—"}
          </div>
          <div style={{ fontSize: 10.5, color: "var(--oh-text3)", marginTop: 2 }}>
            {(country?.country_name || a.country_iso3 || "")}
            {a.district ? ` · ${a.district}` : ""}
          </div>
        </div>
        <div
          onClick={onClose}
          style={{
            width: 24, height: 24, borderRadius: 6, display: "flex",
            alignItems: "center", justifyContent: "center", cursor: "pointer",
            fontSize: 16, color: "var(--oh-text3)", background: "rgba(255,255,255,0.04)",
          }}
        >×</div>
      </div>

      {/* Body */}
      <div className="oh-scroll" style={{ flex: 1, overflowY: "auto", padding: "12px 14px" }}>
        {loading && (
          <div style={{ textAlign: "center", padding: "30px 0", fontSize: 11, color: "var(--oh-text3)" }}>
            Compiling situational picture…
          </div>
        )}

        {data && !loading && (
          <>
            {/* Narrative */}
            {data.narrative && (
              <div style={{
                background: "var(--oh-ink3)", border: "1px solid var(--oh-border)",
                borderRadius: 8, padding: "10px 12px", marginBottom: 14,
                fontSize: 11.5, lineHeight: 1.55, color: "var(--oh-text)",
              }}>
                {data.narrative}
              </div>
            )}

            {/* Burden KPIs */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 6 }}>
              {[
                { l: "Human Cases", v: summary.human_cases_total, c: "var(--oh-crimson)" },
                { l: "Deaths", v: summary.deaths_total, c: "var(--oh-amber)" },
                { l: "Animals", v: summary.animals_affected, c: "var(--oh-cobalt)" },
              ].map((m) => (
                <div key={m.l} style={{
                  background: "var(--oh-ink3)", border: "1px solid var(--oh-border)",
                  borderRadius: 7, padding: "8px 10px",
                }}>
                  <div className="font-mono" style={{ fontSize: 7.5, color: "var(--oh-text3)", letterSpacing: "0.8px", textTransform: "uppercase", marginBottom: 3 }}>{m.l}</div>
                  <div style={{ fontSize: 18, color: m.c, fontWeight: 700 }}>
                    {Number(m.v).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
            {/* Aggregate indicator — when this single article had no numbers
                but others for the same disease+country did, surface the fact. */}
            {summary.from_aggregate && data.country_aggregate && (
              <div className="font-mono" style={{
                fontSize: 9.5, color: "var(--oh-text3)", marginBottom: 14,
                fontStyle: "italic",
              }}>
                ⓘ Numbers above aggregated across {data.country_aggregate.alert_count}{" "}
                articles for this country+disease (this article alone had no extractable counts)
              </div>
            )}
            {!summary.from_aggregate && <div style={{ marginBottom: 14 }} />}

            {/* Pathogen profile */}
            {path && (
              <>
                <div className="font-mono" style={{ fontSize: 8.5, color: "var(--oh-text3)", letterSpacing: "1px", textTransform: "uppercase", marginBottom: 6 }}>
                  Pathogen profile
                </div>
                <div style={{
                  background: "rgba(255,255,255,0.02)", border: "1px solid var(--oh-border)",
                  borderRadius: 7, padding: "8px 10px", marginBottom: 14, fontSize: 10.5, lineHeight: 1.7, color: "var(--oh-text2)",
                }}>
                  <div><strong style={{ color: "var(--oh-text3)" }}>Class</strong> {path.disease_class || "—"}</div>
                  <div><strong style={{ color: "var(--oh-text3)" }}>R₀</strong> {path.r0_min ?? "?"}–{path.r0_max ?? "?"}</div>
                  <div><strong style={{ color: "var(--oh-text3)" }}>CFR</strong> {path.cfr_pct ?? "?"}%</div>
                  {path.spillover_score != null && (
                    <div>
                      <strong style={{ color: "var(--oh-text3)" }}>Spillover score</strong>{" "}
                      <span style={{
                        color: path.spillover_score >= 80 ? "var(--oh-crimson)" : path.spillover_score >= 65 ? "var(--oh-amber)" : "var(--oh-cobalt)",
                        fontWeight: 600,
                      }}>{path.spillover_score}/100</span>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Linked human cases */}
            {data.human_cases?.length > 0 && (
              <>
                <div className="font-mono" style={{ fontSize: 8.5, color: "var(--oh-text3)", letterSpacing: "1px", textTransform: "uppercase", marginBottom: 6 }}>
                  Linked human cases ({data.human_cases.length})
                </div>
                <div style={{ marginBottom: 14 }}>
                  {data.human_cases.slice(0, 5).map((h: any, i: number) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid var(--oh-border)", fontSize: 10.5 }}>
                      <span style={{ color: "var(--oh-text2)" }}>{h.case_date || h.report_date || "—"}</span>
                      <span style={{ color: "var(--oh-text)" }}>
                        {h.cases_total ?? 0} cases
                        {h.deaths > 0 && <span style={{ color: "var(--oh-crimson)" }}> · {h.deaths}†</span>}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Animal events */}
            {data.animal_events?.length > 0 && (
              <>
                <div className="font-mono" style={{ fontSize: 8.5, color: "var(--oh-text3)", letterSpacing: "1px", textTransform: "uppercase", marginBottom: 6 }}>
                  Animal events ({data.animal_events.length})
                </div>
                <div style={{ marginBottom: 14 }}>
                  {data.animal_events.slice(0, 5).map((ae: any, i: number) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid var(--oh-border)", fontSize: 10.5 }}>
                      <span style={{ color: "var(--oh-text2)" }}>{ae.species || ae.host_species || "—"}</span>
                      <span style={{ color: "var(--oh-text)" }}>
                        {ae.animals_affected ?? 0}
                        {ae.mortality_pct != null && <span style={{ color: "var(--oh-amber)" }}> · {ae.mortality_pct}% mort.</span>}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* What to watch */}
            {data.what_to_watch?.length > 0 && (
              <>
                <div className="font-mono" style={{ fontSize: 8.5, color: "var(--oh-text3)", letterSpacing: "1px", textTransform: "uppercase", marginBottom: 6 }}>
                  What to watch
                </div>
                <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                  {data.what_to_watch.map((w, i) => (
                    <li key={i} style={{ display: "flex", gap: 8, padding: "5px 0", fontSize: 10.5, color: "var(--oh-text2)", lineHeight: 1.5 }}>
                      <span style={{ color: "var(--oh-aqua)", flexShrink: 0 }}>▸</span>
                      <span>{w}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
