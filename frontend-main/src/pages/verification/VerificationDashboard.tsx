import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  CheckCircle2, XCircle, AlertTriangle, Clock, Activity,
  RefreshCcw, TrendingUp, TrendingDown, Minus, ShieldCheck, Target, AlertOctagon,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  LineChart, Line, CartesianGrid,
} from "recharts";
import { api } from "@/lib/api";
import { useTheme } from "@/contexts/ThemeContext";

const REFRESH_MS = 60_000;

interface VeracityModule {
  source_module: string;
  index_value: number;
  trend_delta: number | null;
  n_predictions_scored: number;
}
interface VeracityResponse {
  platform: { index_value: number; trend_delta: number | null; n_predictions_scored: number } | null;
  modules: VeracityModule[];
}
interface AlertsCoverage {
  total_alerts_tracked: number;
  confirmed_real: number;
  false_alarms: number;
  misses: number;
  unverified_pending: number;
  excluded: number;
  verifiable_pct: number | null;
  false_alarm_rate_pct: number | null;
  by_country: Record<string, { total: number; confirmed: number; false_alarm: number; pending: number }>;
}
interface Verdict {
  id: number;
  verdict: string;
  source_module: string;
  prediction_class: string;
  country_iso: string;
  disease_name: string;
  lead_time_days: number | null;
  created_at: string;
}
interface EbolaLeadTime {
  pheic_declaration: string;
  earliest_lead_time_days: number | null;
  n_signals: number;
}
interface EbolaStats { days: number; total: number; by_kind: Record<string, number>; }

/* ─── PDX palette (matches Overview/KpiCards/Predictions) ──────────── */
const VERDICT_META: Record<string, {
  label: string; text: string; bg: string; border: string; hex: string; icon: typeof CheckCircle2;
}> = {
  HIT:         { label: "Hit",         text: "text-green-400",  bg: "bg-green-500/10",  border: "border-green-500/30",  hex: "#4ade80", icon: CheckCircle2 },
  PARTIAL:     { label: "Partial",     text: "text-amber-400",  bg: "bg-amber-500/10",  border: "border-amber-500/30",  hex: "#fbbf24", icon: AlertTriangle },
  MISS:        { label: "Miss",        text: "text-red-400",    bg: "bg-red-500/10",    border: "border-red-500/30",    hex: "#f87171", icon: XCircle },
  FALSE_ALARM: { label: "False alarm", text: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/30", hex: "#c084fc", icon: AlertOctagon },
  PENDING:     { label: "Pending",     text: "text-slate-400",  bg: "bg-slate-500/10",  border: "border-slate-500/30",  hex: "#94a3b8", icon: Clock },
  EXCLUDED:    { label: "Excluded",    text: "text-slate-500",  bg: "bg-slate-500/10",  border: "border-slate-500/30",  hex: "#64748b", icon: Minus },
};

function indexBand(v: number) {
  if (v >= 75) return { text: "text-green-400", bg: "bg-green-400",  hex: "#4ade80", label: "Strong" };
  if (v >= 50) return { text: "text-amber-400", bg: "bg-amber-400",  hex: "#fbbf24", label: "Fair"   };
  if (v >= 25) return { text: "text-orange-400",bg: "bg-orange-400", hex: "#fb923c", label: "Weak"   };
  return       { text: "text-red-400",   bg: "bg-red-400",    hex: "#f87171", label: "Poor"   };
}

function fmtDelta(d: number | null) {
  if (d === null || d === undefined) return { text: "—", color: "text-slate-400", Icon: Minus };
  if (d > 0) return { text: `+${d.toFixed(1)}`, color: "text-green-400", Icon: TrendingUp };
  if (d < 0) return { text: d.toFixed(1),       color: "text-red-400",   Icon: TrendingDown };
  return       { text: "0.0",                   color: "text-slate-400", Icon: Minus };
}

export default function VerificationDashboard() {
  const { theme } = useTheme();
  const isLight = theme === "light";

  const [veracity, setVeracity] = useState<VeracityResponse | null>(null);
  const [coverage, setCoverage] = useState<AlertsCoverage | null>(null);
  const [verdicts, setVerdicts] = useState<Verdict[]>([]);
  const [ebola, setEbola] = useState<EbolaLeadTime | null>(null);
  const [ebolaStats, setEbolaStats] = useState<EbolaStats | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [v, c, ver, el, es] = await Promise.all([
        api.get("/verification/veracity/current/"),
        api.get("/verification/verdicts/alerts-coverage/"),
        api.get("/verification/verdicts/", { params: { page_size: 25 } }),
        api.get("/verification/verdicts/ebola-lead-time/"),
        api.get("/verification/ebola-events/stats/", { params: { days: 7 } }),
      ]);
      setVeracity(v.data);
      setCoverage(c.data);
      setVerdicts(ver.data?.results ?? ver.data ?? []);
      setEbola(el.data);
      setEbolaStats(es.data);
      setErr(null);
      setLastUpdated(new Date());
    } catch (e: any) {
      setErr(e?.response?.data?.detail || e?.message || "Failed to load verification data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, REFRESH_MS);
    return () => clearInterval(t);
  }, [load]);

  const platformIdx = veracity?.platform?.index_value ?? null;
  const band = platformIdx !== null ? indexBand(platformIdx) : null;
  const delta = fmtDelta(veracity?.platform?.trend_delta ?? null);
  const totalScored = veracity?.platform?.n_predictions_scored ?? 0;

  /* ── Theme tokens ───────────────────────────────────────────────── */
  const pageBg = isLight
    ? "bg-gradient-to-b from-slate-50 to-white text-slate-900"
    : "bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900 text-slate-100";
  const card = isLight
    ? "bg-white border border-slate-200 shadow-sm"
    : "bg-white/[0.03] border border-white/10 backdrop-blur-sm";
  const sub = isLight ? "text-slate-500" : "text-slate-400";
  const muted = isLight ? "text-slate-700" : "text-slate-300";
  const chartAxis = isLight ? "#64748b" : "#94a3b8";
  const chartGrid = isLight ? "#e2e8f0" : "#1e293b";
  const tooltipBg = isLight ? "#ffffff" : "#0f172a";

  return (
    <div className={`min-h-screen ${pageBg} px-4 sm:px-6 lg:px-8 py-6`}>
      {/* ─── Compact header ─── */}
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-wrap items-center justify-between gap-3 mb-5"
      >
        <div className="flex items-center gap-3">
          <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${isLight ? "bg-blue-500/10" : "bg-blue-500/20"} border ${isLight ? "border-blue-500/20" : "border-blue-500/30"}`}>
            <ShieldCheck size={20} className="text-blue-400" />
          </div>
          <div>
            <div className={`text-[10px] font-semibold tracking-[0.18em] uppercase ${sub}`}>
              PDX Intelligence Verification
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight leading-tight">
              Did PDX get it right?
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/10 border border-green-500/30 text-green-400 text-[11px] font-semibold">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-400" />
            </span>
            Live · 60s
          </div>
          <button
            onClick={load}
            disabled={loading}
            className={`text-[11px] ${sub} flex items-center gap-1 px-2 py-1 rounded-md ${isLight ? "hover:bg-slate-100" : "hover:bg-white/5"} disabled:opacity-50 transition`}
            title="Refresh now"
          >
            <RefreshCcw size={11} className={loading ? "animate-spin" : ""} />
            {lastUpdated ? lastUpdated.toLocaleTimeString() : "—"}
          </button>
        </div>
      </motion.div>

      {err && (
        <div className="mb-4 flex items-start gap-2.5 rounded-lg px-3 py-2 bg-red-500/10 border border-red-500/30 text-red-400">
          <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
          <div className="text-xs"><b>Failed to load.</b> {err}</div>
        </div>
      )}

      {/* ═══ HERO STRIP — score + KPIs in one row ═══════════════════════ */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-3 mb-3"
      >
        {/* Veracity score card */}
        <div className={`${card} rounded-xl p-4 flex items-center gap-4`}>
          <div className="flex-shrink-0">
            <div className={`text-[10px] font-semibold tracking-[0.12em] uppercase ${sub}`}>Veracity</div>
            {loading && platformIdx === null ? (
              <div className={`h-12 w-20 mt-1 rounded animate-pulse ${isLight ? "bg-slate-200" : "bg-white/5"}`} />
            ) : (
              <div className="flex items-baseline gap-0.5 mt-0.5">
                <span className={`text-5xl font-bold tabular-nums leading-none ${band?.text ?? sub}`}>
                  {platformIdx !== null ? platformIdx.toFixed(0) : "—"}
                </span>
                <span className={`text-sm ${sub}`}>/100</span>
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            {band && (
              <div className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold ${band.text} ${isLight ? "bg-slate-100" : "bg-white/5"}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${band.bg}`} /> {band.label}
              </div>
            )}
            <div className={`mt-1 text-[11px] flex items-center gap-2 ${muted}`}>
              <span className={`inline-flex items-center gap-0.5 ${delta.color}`}>
                <delta.Icon size={11} /> {delta.text}
              </span>
              <span className={sub}>·</span>
              <span className={sub}>{totalScored.toLocaleString()} scored</span>
            </div>
            <div className={`mt-1.5 text-[10px] leading-snug ${sub}`}>
              Hit rate + precision + calibration + sharpness, weighted.
            </div>
          </div>
        </div>

        {/* KPI grid — 6-up */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          <KpiTile isLight={isLight} loading={loading && !coverage} icon={Activity}    color="blue"   label="Tracked"   value={coverage?.total_alerts_tracked ?? 0} />
          <KpiTile isLight={isLight} loading={loading && !coverage} icon={Target}      color="cyan"   label="Verifiable" value={coverage?.verifiable_pct ?? 0} suffix="%" />
          <KpiTile isLight={isLight} loading={loading && !coverage} icon={CheckCircle2} color="green" label="Confirmed" value={coverage?.confirmed_real ?? 0} />
          <KpiTile isLight={isLight} loading={loading && !coverage} icon={AlertOctagon} color="purple" label="False alarm" value={coverage?.false_alarms ?? 0} />
          <KpiTile isLight={isLight} loading={loading && !coverage} icon={Clock}       color="slate"  label="Pending"   value={coverage?.unverified_pending ?? 0} />
          <KpiTile isLight={isLight} loading={loading && !coverage} icon={XCircle}     color="red"    label="FA rate"   value={coverage?.false_alarm_rate_pct ?? 0} suffix="%" />
        </div>
      </motion.section>

      {/* ═══ MAIN 2-COL GRID — verdicts (LEFT) + breakdown (RIGHT) ═══════ */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_420px] gap-3 mb-3">

        {/* LEFT: Recent verdicts — moved to top, scrollable inside */}
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className={`${card} rounded-xl p-4`}
        >
          <div className="flex items-baseline justify-between mb-3">
            <div>
              <h2 className="text-sm font-semibold">Recent verdicts</h2>
              <p className={`text-[11px] ${sub}`}>Predicted vs. actually happened — newest first</p>
            </div>
            <div className={`text-[11px] ${sub}`}>{verdicts.length} shown</div>
          </div>

          {loading && verdicts.length === 0 ? (
            <div className="space-y-1.5">
              {[0,1,2,3,4,5].map(i => (
                <div key={i} className={`h-9 rounded animate-pulse ${isLight ? "bg-slate-100" : "bg-white/5"}`} />
              ))}
            </div>
          ) : verdicts.length === 0 ? (
            <div className={`text-center py-10 px-4 rounded-lg ${isLight ? "bg-slate-50" : "bg-white/[0.02]"}`}>
              <div className={`inline-flex h-10 w-10 items-center justify-center rounded-full ${isLight ? "bg-slate-100" : "bg-white/5"} mb-2`}>
                <Clock size={18} className={sub} />
              </div>
              <div className={`text-sm font-semibold ${isLight ? "text-slate-700" : "text-slate-200"}`}>No verdicts yet</div>
              <div className={`text-[11px] mt-1 ${sub}`}>Run the verification pipeline to score captured snapshots.</div>
              <code className={`mt-2 inline-block px-2 py-0.5 rounded text-[10px] ${isLight ? "bg-slate-100 text-slate-700" : "bg-white/10 text-slate-200"}`}>
                python manage.py run_verification
              </code>
            </div>
          ) : (
            <div className="max-h-[520px] overflow-y-auto -mx-1 pr-1">
              <table className="w-full text-xs">
                <thead className={`sticky top-0 z-10 ${isLight ? "bg-white" : "bg-slate-950/95"} backdrop-blur`}>
                  <tr className={`text-[10px] uppercase tracking-wider ${sub} text-left`}>
                    <th className="px-2 py-2 font-semibold">Verdict</th>
                    <th className="px-2 py-2 font-semibold">Module</th>
                    <th className="px-2 py-2 font-semibold">Country</th>
                    <th className="px-2 py-2 font-semibold">Disease</th>
                    <th className="px-2 py-2 font-semibold text-right">Lead</th>
                    <th className="px-2 py-2 font-semibold text-right">When</th>
                  </tr>
                </thead>
                <tbody>
                  {verdicts.map(v => {
                    const m = VERDICT_META[v.verdict] ?? VERDICT_META.PENDING;
                    const Icon = m.icon;
                    return (
                      <tr key={v.id} className={`border-t ${isLight ? "border-slate-100 hover:bg-slate-50" : "border-white/5 hover:bg-white/[0.03]"} transition`}>
                        <td className="px-2 py-2">
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold ${m.text} ${m.bg} border ${m.border}`}>
                            <Icon size={10} /> {m.label}
                          </span>
                        </td>
                        <td className={`px-2 py-2 ${muted}`}>{v.source_module}</td>
                        <td className="px-2 py-2 font-mono text-[11px]">{v.country_iso}</td>
                        <td className={`px-2 py-2 ${muted} truncate max-w-[120px]`}>{v.disease_name || "—"}</td>
                        <td className={`px-2 py-2 font-mono text-right ${v.lead_time_days != null && v.lead_time_days < 0 ? "text-green-400" : ""}`}>
                          {v.lead_time_days != null ? v.lead_time_days.toFixed(1) : "—"}
                        </td>
                        <td className={`px-2 py-2 ${sub} text-right whitespace-nowrap`}>
                          {new Date(v.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </motion.section>

        {/* RIGHT: breakdown stack */}
        <div className="flex flex-col gap-3">
          {/* Verifiability bar */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className={`${card} rounded-xl p-4`}
          >
            <div className="text-sm font-semibold">Verdict breakdown</div>
            <p className={`text-[11px] ${sub} mt-0.5`}>All tracked alerts & predictions</p>

            {loading && !coverage ? (
              <div className={`h-7 mt-3 rounded animate-pulse ${isLight ? "bg-slate-100" : "bg-white/5"}`} />
            ) : coverage && coverage.total_alerts_tracked > 0 ? (
              <VerifiabilityBar coverage={coverage} isLight={isLight} />
            ) : (
              <div className={`mt-4 text-center text-[11px] py-3 ${sub}`}>No tracked items yet.</div>
            )}
          </motion.div>

          {/* Module accuracy */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className={`${card} rounded-xl p-4`}
          >
            <div className="flex items-baseline justify-between">
              <div className="text-sm font-semibold">Accuracy by module</div>
              <div className={`text-[10px] ${sub}`}>0–100</div>
            </div>
            {loading && !veracity?.modules?.length ? (
              <div className="space-y-2 mt-3">
                {[0,1,2].map(i => <div key={i} className={`h-6 rounded animate-pulse ${isLight ? "bg-slate-100" : "bg-white/5"}`} />)}
              </div>
            ) : !veracity?.modules?.length ? (
              <div className={`mt-4 text-center text-[11px] py-3 ${sub}`}>No module scores yet.</div>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(140, veracity.modules.length * 38)}>
                <BarChart layout="vertical" data={veracity.modules.map(m => ({ ...m, name: m.source_module }))} margin={{ left: 4, right: 16, top: 4, bottom: 0 }}>
                  <XAxis type="number" domain={[0, 100]} tick={{ fill: chartAxis, fontSize: 10 }} stroke={chartGrid} />
                  <YAxis type="category" dataKey="name" width={78} tick={{ fill: isLight ? "#334155" : "#cbd5e1", fontSize: 11 }} stroke={chartGrid} />
                  <Tooltip
                    cursor={{ fill: isLight ? "#f1f5f9" : "rgba(255,255,255,0.04)" }}
                    contentStyle={{ background: tooltipBg, border: `1px solid ${chartGrid}`, borderRadius: 8, fontSize: 11 }}
                    formatter={(val: any, _n, p: any) => [`${Number(val).toFixed(1)} (Δ ${fmtDelta(p.payload.trend_delta).text})`, "Score"]}
                  />
                  <Bar dataKey="index_value" radius={[0, 4, 4, 0]} barSize={16}>
                    {veracity.modules.map((m, i) => (
                      <Cell key={i} fill={indexBand(m.index_value).hex} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </motion.div>

          {/* By country compact */}
          {coverage && Object.keys(coverage.by_country || {}).length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className={`${card} rounded-xl p-4`}
            >
              <div className="text-sm font-semibold">By country</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 mt-2">
                {Object.entries(coverage.by_country)
                  .sort((a, b) => b[1].total - a[1].total)
                  .slice(0, 9)
                  .map(([iso, b]) => (
                    <div key={iso} className={`rounded-md px-2 py-1.5 ${isLight ? "bg-slate-50 border border-slate-200" : "bg-white/[0.03] border border-white/10"}`}>
                      <div className="font-mono text-xs font-semibold">{iso}</div>
                      <div className={`text-[10px] mt-0.5 flex gap-1.5 ${sub}`}>
                        <span className="text-green-400">{b.confirmed}</span>
                        <span className="text-purple-400">{b.false_alarm}</span>
                        <span>{b.pending}</span>
                      </div>
                    </div>
                  ))}
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* ═══ EBOLA STRIP — compact bottom row ═══════════════════════════ */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-3"
      >
        <div className={`${card} rounded-xl p-4 border-l-2 !border-l-orange-400`}>
          <div className="text-[10px] font-semibold tracking-[0.12em] uppercase text-orange-400">
            Ebola PHEIC · Lead time
          </div>
          {loading && !ebola ? (
            <div className={`h-10 w-20 mt-2 rounded animate-pulse ${isLight ? "bg-slate-200" : "bg-white/5"}`} />
          ) : (
            <div className="text-4xl font-bold text-orange-400 mt-1 tabular-nums leading-none">
              {ebola?.earliest_lead_time_days != null
                ? `${Math.abs(ebola.earliest_lead_time_days).toFixed(0)}d`
                : "—"}
            </div>
          )}
          <div className={`text-[11px] ${muted} mt-1`}>
            {ebola?.earliest_lead_time_days != null && ebola.earliest_lead_time_days < 0
              ? "ahead of declaration"
              : "vs. declaration"}
          </div>
          <div className={`mt-2 text-[10px] ${sub}`}>
            PHEIC <b className={isLight ? "text-slate-900" : "text-slate-100"}>{ebola?.pheic_declaration ?? "2026-05-17"}</b>
            {" · "}{ebola?.n_signals ?? 0} signals
          </div>
        </div>

        <div className={`${card} rounded-xl p-4`}>
          <div className="flex items-baseline justify-between mb-2">
            <div className="text-sm font-semibold">Ebola events · last 7 days</div>
            <div className={`text-[11px] ${sub}`}>{ebolaStats?.total ?? 0} total</div>
          </div>
          {loading && !ebolaStats ? (
            <div className={`h-32 rounded animate-pulse ${isLight ? "bg-slate-100" : "bg-white/5"}`} />
          ) : !ebolaStats || Object.keys(ebolaStats.by_kind ?? {}).length === 0 ? (
            <div className={`text-center text-[11px] py-6 ${sub}`}>No activity.</div>
          ) : (
            <ResponsiveContainer width="100%" height={140}>
              <LineChart data={Object.entries(ebolaStats.by_kind).map(([k, n]) => ({ kind: k, n }))}>
                <CartesianGrid stroke={chartGrid} strokeDasharray="3 3" />
                <XAxis dataKey="kind" tick={{ fill: chartAxis, fontSize: 10 }} stroke={chartGrid} />
                <YAxis tick={{ fill: chartAxis, fontSize: 10 }} stroke={chartGrid} allowDecimals={false} />
                <Tooltip contentStyle={{ background: tooltipBg, border: `1px solid ${chartGrid}`, borderRadius: 8, fontSize: 11 }} />
                <Line type="monotone" dataKey="n" stroke="#fb923c" strokeWidth={2} dot={{ fill: "#fb923c", r: 2.5 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </motion.section>

      <div className={`text-center text-[10px] mt-4 ${sub}`}>
        Counterfactual runs excluded · predictions missing model_version/computed_at flagged
      </div>
    </div>
  );
}

/* ─── Subcomponents ──────────────────────────────────────────────── */

function KpiTile({
  isLight, loading, icon: Icon, color, label, value, suffix = "",
}: {
  isLight: boolean; loading?: boolean; icon: typeof Activity;
  color: "blue" | "cyan" | "green" | "purple" | "slate" | "red" | "amber";
  label: string; value: number; suffix?: string;
}) {
  const palette: Record<string, { text: string; bg: string; border: string }> = {
    blue:   { text: "text-blue-400",   bg: "bg-blue-500/10",   border: "border-blue-500/20" },
    cyan:   { text: "text-cyan-400",   bg: "bg-cyan-500/10",   border: "border-cyan-500/20" },
    green:  { text: "text-green-400",  bg: "bg-green-500/10",  border: "border-green-500/20" },
    purple: { text: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/20" },
    slate:  { text: "text-slate-400",  bg: "bg-slate-500/10",  border: "border-slate-500/20" },
    red:    { text: "text-red-400",    bg: "bg-red-500/10",    border: "border-red-500/20" },
    amber:  { text: "text-amber-400",  bg: "bg-amber-500/10",  border: "border-amber-500/20" },
  };
  const p = palette[color];
  return (
    <div className={`${isLight ? "bg-white border border-slate-200 shadow-sm" : "bg-white/[0.03] border border-white/10 backdrop-blur-sm"} rounded-xl p-3 flex items-start gap-2`}>
      <div className={`h-7 w-7 rounded-lg flex items-center justify-center flex-shrink-0 ${p.bg} border ${p.border}`}>
        <Icon size={14} className={p.text} />
      </div>
      <div className="min-w-0 flex-1">
        <div className={`text-[10px] truncate ${isLight ? "text-slate-500" : "text-slate-400"}`}>{label}</div>
        {loading ? (
          <div className={`mt-1 h-5 w-10 rounded animate-pulse ${isLight ? "bg-slate-200" : "bg-white/10"}`} />
        ) : (
          <div className={`text-base font-bold tabular-nums ${isLight ? "text-slate-900" : "text-white"}`}>
            {typeof value === "number" ? value.toLocaleString() : "—"}{suffix}
          </div>
        )}
      </div>
    </div>
  );
}

function VerifiabilityBar({ coverage, isLight }: { coverage: AlertsCoverage; isLight: boolean }) {
  const total = coverage.total_alerts_tracked || 1;
  const seg = [
    { label: "Confirmed",  n: coverage.confirmed_real,     color: "bg-green-400",   text: "text-green-400"   },
    { label: "False alarm",n: coverage.false_alarms,       color: "bg-purple-400",  text: "text-purple-400"  },
    { label: "Miss",       n: coverage.misses,             color: "bg-red-400",     text: "text-red-400"     },
    { label: "Pending",    n: coverage.unverified_pending, color: "bg-slate-400",   text: "text-slate-400"   },
    { label: "Excluded",   n: coverage.excluded,           color: "bg-slate-600",   text: "text-slate-500"   },
  ].filter(s => s.n > 0);
  return (
    <>
      <div className={`flex h-6 mt-3 rounded-md overflow-hidden ${isLight ? "ring-1 ring-slate-200" : "ring-1 ring-white/10"}`}>
        {seg.map((s, i) => (
          <div
            key={i}
            title={`${s.label}: ${s.n.toLocaleString()}`}
            className={`${s.color} transition-all hover:opacity-80`}
            style={{ width: `${(s.n / total) * 100}%` }}
          />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-y-1.5 gap-x-3 mt-3 text-[11px]">
        {seg.map((s, i) => (
          <div key={i} className="inline-flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-sm ${s.color}`} />
            <span className={s.text}>{s.label}</span>
            <span className={`ml-auto font-mono tabular-nums ${isLight ? "text-slate-700" : "text-slate-300"}`}>
              {s.n.toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </>
  );
}
