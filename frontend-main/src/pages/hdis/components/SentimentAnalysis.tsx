import { useMemo } from "react";
import { useDashboardContext } from "@/pages/hdis/context/DashboardContext";
import { SectionHeader } from "@/pages/hdis/components/shared/SectionHeader";
import { TrendingDown, TrendingUp, ShieldCheck, ShieldAlert } from "lucide-react";

const MISTRUST_KW = ["mistrust", "distrust", "protest", "strike", "corruption", "misinformation", "refusal", "rumors", "suspicion", "hostility"];
const TRUST_KW = ["support", "trust", "collaboration", "uptake", "acceptance", "partnership", "integrated", "community-led"];
const CORRIDOR_KW = ["ceasefire", "truce", "humanitarian pause", "peace corridor", "negotiation", "access granted", "unobstructed", "safe zone"];

export function SentimentAnalysis() {
    const { records } = useDashboardContext();

    /* ── Trust score + per-country breakdown ── */
    const { trustScore, countryBreakdown, topDrivers } = useMemo(() => {
        const countryMap: Record<string, { pos: number; neg: number; total: number; name: string }> = {};
        let globalPos = 0, globalNeg = 0, globalTotal = 0;
        const drivers: { id: number; text: string; type: string; country: string }[] = [];

        (records ?? []).forEach(r => {
            const txt = (r.headline + " " + (r.analyst_notes || "")).toLowerCase();
            const isPos = TRUST_KW.some(k => txt.includes(k));
            const isNeg = MISTRUST_KW.some(k => txt.includes(k));
            if (!isPos && !isNeg) return;

            const iso = r.location_country_iso || "UNK";
            const name = r.location_country || iso;
            if (!countryMap[iso]) countryMap[iso] = { pos: 0, neg: 0, total: 0, name };

            if (isPos) { countryMap[iso].pos++; globalPos++; }
            if (isNeg) { countryMap[iso].neg++; globalNeg++; }
            countryMap[iso].total++;
            globalTotal++;

            if (drivers.length < 4) {
                drivers.push({ id: r.id, text: r.headline, type: isNeg ? "neg" : "pos", country: iso });
            }
        });

        const score = globalTotal > 0
            ? Math.round(Math.min(100, Math.max(0, 50 + ((globalPos - globalNeg) / globalTotal) * 50)))
            : 50;

        const breakdown = Object.entries(countryMap)
            .sort(([, a], [, b]) => b.total - a.total)
            .slice(0, 6)
            .map(([iso, d]) => ({
                iso, name: d.name.slice(0, 10),
                pos: d.pos, neg: d.neg, total: d.total,
                ratio: Math.round((d.pos / Math.max(d.total, 1)) * 100),
            }));

        return { trustScore: score, countryBreakdown: breakdown, topDrivers: drivers };
    }, [records]);

    /* ── Corridors ── */
    const corridors = useMemo(() => {
        return (records ?? [])
            .filter(r => r.pillar === "conflict" && CORRIDOR_KW.some(k => (r.headline + " " + (r.analyst_notes || "")).toLowerCase().includes(k)))
            .slice(0, 2);
    }, [records]);

    const scoreColor = trustScore >= 65 ? "#22c55e" : trustScore >= 45 ? "#f59e0b" : "#ef4444";
    const scoreLabel = trustScore >= 65 ? "Positive" : trustScore >= 45 ? "Neutral" : "Negative";

    return (
        <div>
            <SectionHeader title="SENTIMENT ANALYSIS" />

            <div className="grid grid-cols-1 xl:grid-cols-[1fr_1.2fr_0.8fr] gap-2">

                {/* ── Col 1: Trust Gauge ── */}
                <div className="rounded-xl border border-border/30 bg-card p-4">
                    <div className="flex items-center gap-2 mb-3">
                        {trustScore >= 50 ? <ShieldCheck size={13} className="text-emerald-400" /> : <ShieldAlert size={13} className="text-red-400" />}
                        <h4 className="text-foreground font-bold text-sm">Public Trust Index</h4>
                    </div>

                    {/* Score circle */}
                    <div className="flex justify-center mb-3">
                        <svg width="80" height="80" viewBox="0 0 80 80">
                            <circle cx="40" cy="40" r="32" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="4" />
                            <circle cx="40" cy="40" r="32" fill="none" stroke={scoreColor} strokeWidth="4" strokeLinecap="round"
                                strokeDasharray={`${(trustScore / 100) * 201} 201`}
                                transform="rotate(-90 40 40)" opacity="0.7" />
                            <text x="40" y="37" textAnchor="middle" dominantBaseline="middle"
                                className="fill-foreground font-mono font-bold" style={{ fontSize: 18 }}>{trustScore}</text>
                            <text x="40" y="50" textAnchor="middle"
                                className="font-mono" style={{ fontSize: 10, fill: scoreColor }}>{scoreLabel}</text>
                        </svg>
                    </div>

                    {/* Trust vs Distrust bar */}
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-[11px] text-muted-foreground font-mono w-10">Distrust</span>
                        <div className="flex-1 h-[4px] bg-muted/50 rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-700"
                                style={{ width: `${trustScore}%`, background: `linear-gradient(90deg, #ef4444, #f59e0b, #22c55e)` }} />
                        </div>
                        <span className="text-[11px] text-muted-foreground font-mono w-6 text-right">Trust</span>
                    </div>
                </div>

                {/* ── Col 2: Country Breakdown ── */}
                <div className="rounded-xl border border-border/30 bg-card p-4">
                    <h4 className="text-muted-foreground/80 text-xs font-mono uppercase tracking-widest mb-3">
                        Sentiment by Country
                    </h4>

                    {countryBreakdown.length === 0 ? (
                        <p className="text-muted-foreground/60 text-[13px] italic">No sentiment signals detected</p>
                    ) : (
                        <div className="space-y-2">
                            {countryBreakdown.map(c => (
                                <div key={c.iso}>
                                    <div className="flex items-center justify-between mb-0.5">
                                        <span className="text-[13px] text-muted-foreground font-medium">{c.name}</span>
                                        <div className="flex items-center gap-2">
                                            <span className="text-emerald-400/60 text-[11px] font-mono">+{c.pos}</span>
                                            <span className="text-red-400/60 text-[11px] font-mono">-{c.neg}</span>
                                        </div>
                                    </div>
                                    {/* Stacked pos/neg bar */}
                                    <div className="h-[3px] bg-muted/50 rounded-full overflow-hidden flex">
                                        <div className="h-full bg-emerald-500/50 transition-all duration-500"
                                            style={{ width: `${c.ratio}%` }} />
                                        <div className="h-full bg-red-500/40 transition-all duration-500"
                                            style={{ width: `${100 - c.ratio}%` }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* ── Col 3: Latest Drivers + Corridors ── */}
                <div className="rounded-xl border border-border/30 bg-card p-4 flex flex-col">
                    <h4 className="text-muted-foreground/80 text-xs font-mono uppercase tracking-widest mb-2">
                        Sentiment Drivers
                    </h4>

                    <div className="space-y-1.5 mb-3 flex-1">
                        {topDrivers.length > 0 ? topDrivers.map(d => (
                            <div key={d.id} className="flex items-start gap-1.5">
                                {d.type === "neg"
                                    ? <TrendingDown size={8} className="text-red-400/50 mt-0.5 shrink-0" />
                                    : <TrendingUp size={8} className="text-emerald-400/50 mt-0.5 shrink-0" />}
                                <p className="text-xs text-muted-foreground/80 leading-snug line-clamp-2">
                                    <span className="text-muted-foreground/60 font-bold">[{d.country}]</span> {d.text}
                                </p>
                            </div>
                        )) : (
                            <p className="text-xs text-muted-foreground/60 italic">No signals</p>
                        )}
                    </div>

                    {/* Health Corridors */}
                    {corridors.length > 0 && (
                        <div className="pt-2 border-t border-border/10">
                            <p className="text-emerald-400/40 text-[11px] font-mono uppercase tracking-widest mb-1.5">
                                Health Corridors
                            </p>
                            {corridors.map(c => (
                                <div key={c.id} className="mb-1.5">
                                    <span className="text-[11px] font-mono text-emerald-400/40 bg-emerald-400/5 border border-emerald-400/10 px-1 py-0.5 rounded">
                                        {c.location_country}
                                    </span>
                                    <p className="text-xs text-muted-foreground/80 line-clamp-1 mt-0.5">{c.headline}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}
