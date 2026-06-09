import { useMemo } from "react";
import { useDashboardContext } from "@/pages/hdis/context/DashboardContext";
import {
    REGIONAL_BLOCS,
    DIPLOMATIC_PILLARS,
} from "@/pages/hdis/constants";
import { SectionHeader } from "@/pages/hdis/components/shared/SectionHeader";
import { Syringe, DollarSign, Handshake, AlertTriangle, Shield } from "lucide-react";

const pct = (n: number, d: number) => (d === 0 ? 0 : Math.round((n / d) * 100));
const clamp = (v: number, min = 0, max = 100) => Math.min(max, Math.max(min, v));

const strengthLabel = (score: number) => {
    if (score >= 75) return { text: "Strong", statusColor: "#22c55e" };
    if (score >= 50) return { text: "Moderate", statusColor: "#3b82f6" };
    if (score >= 25) return { text: "Developing", statusColor: "#f59e0b" };
    return { text: "Weak", statusColor: "#ef4444" };
};

export function DiplomaticImpact() {
    const { records, countries } = useDashboardContext();

    /* ── 1. VACCINE DIPLOMACY ── */
    const vaccineDiplomacy = useMemo(() => {
        const countryMap: Record<string, { count: number; confidence: number; country: string }> = {};
        records?.forEach((r: any) => {
            const p = (r.pillar || "").toLowerCase();
            if (!DIPLOMATIC_PILLARS.vaccine_diplomacy.includes(p as any)) return;
            const iso = r.location_country_iso || "UNK";
            const name = r.location_country || iso;
            if (!countryMap[iso]) countryMap[iso] = { count: 0, confidence: 0, country: name };
            countryMap[iso].count++;
            countryMap[iso].confidence += r.confidence_score || 0;
        });
        return Object.entries(countryMap)
            .map(([iso, d]) => ({
                iso,
                country: d.country,
                signals: d.count,
                avgConfidence: Math.round(d.confidence / d.count),
            }))
            .sort((a, b) => b.signals - a.signals)
            .slice(0, 5);
    }, [records]);

    /* ── 2. RESOURCE ALLOCATION ── */
    const resourceAllocation = useMemo(() => {
        const fundingByCountry: Record<string, number> = {};
        const conflictByCountry: Record<string, number> = {};
        records?.forEach((r: any) => {
            const p = (r.pillar || "").toLowerCase();
            const iso = r.location_country_iso || "UNK";
            if (DIPLOMATIC_PILLARS.resource_allocation.includes(p as any)) {
                fundingByCountry[iso] = (fundingByCountry[iso] || 0) + 1;
            }
            if (DIPLOMATIC_PILLARS.instability.includes(p as any)) {
                conflictByCountry[iso] = (conflictByCountry[iso] || 0) + 1;
            }
        });

        const allIsos = new Set([...Object.keys(fundingByCountry), ...Object.keys(conflictByCountry)]);
        let fundingToUnstable = 0;
        let fundingToStable = 0;
        let totalFunding = 0;

        allIsos.forEach((iso) => {
            const f = fundingByCountry[iso] || 0;
            const c = conflictByCountry[iso] || 0;
            totalFunding += f;
            if (c > 0) fundingToUnstable += f;
            else fundingToStable += f;
        });

        // Top 4 conflict countries receiving funding
        const targeted = Object.entries(conflictByCountry)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 4)
            .map(([iso]) => {
                const cData = countries?.find((c) => c.country_iso === iso);
                return {
                    iso,
                    country: cData?.country_name || iso,
                    funding: fundingByCountry[iso] || 0,
                    conflict: conflictByCountry[iso] || 0,
                    riskLevel: cData?.risk_level || "low",
                };
            });

        return {
            totalFunding,
            fundingToUnstable,
            fundingToStable,
            alignmentPct: pct(fundingToUnstable, totalFunding),
            targeted,
        };
    }, [records, countries]);

    /* ── 3. PARTNERSHIP STRENGTH ── */
    const partnerships = useMemo(() => {
        return Object.entries(REGIONAL_BLOCS).map(([key, bloc]) => {
            let agreementSignals = 0;
            let crossBorderSignals = 0;
            let totalSignals = 0;

            records?.forEach((r: any) => {
                const iso = r.location_country_iso || "";
                if (!bloc.members.includes(iso)) return;
                totalSignals++;
                const p = (r.pillar || "").toLowerCase();
                if (DIPLOMATIC_PILLARS.partnership.includes(p as any)) agreementSignals++;
                if (r.cross_border_risk) crossBorderSignals++;
            });

            const agreementRatio = pct(agreementSignals, totalSignals);
            const crossBorderRatio = pct(crossBorderSignals, totalSignals);
            const score = clamp(Math.round(agreementRatio * 0.6 + crossBorderRatio * 0.4));

            return {
                key,
                name: key,
                label: bloc.label,
                color: bloc.color,
                agreementSignals,
                crossBorderSignals,
                totalSignals,
                score,
                ...strengthLabel(score),
            };
        });
    }, [records]);

    /* ── Overall Diplomatic Score ── */
    const overallScore = useMemo(() => {
        const vaccineScore = vaccineDiplomacy.length > 0 ? clamp(vaccineDiplomacy.reduce((s, v) => s + v.avgConfidence, 0) / vaccineDiplomacy.length) : 0;
        const resourceScore = clamp(resourceAllocation.alignmentPct);
        const partnershipAvg = partnerships.length > 0 ? partnerships.reduce((s, p) => s + p.score, 0) / partnerships.length : 0;
        return Math.round(vaccineScore * 0.3 + resourceScore * 0.3 + partnershipAvg * 0.4);
    }, [vaccineDiplomacy, resourceAllocation, partnerships]);

    const maxVaccine = Math.max(...vaccineDiplomacy.map((v) => v.signals), 1);

    return (
        <div>
            <SectionHeader title="DIPLOMATIC IMPACT SCORE" />

            <div className="rounded-xl border border-border/30 bg-card p-4 mb-2">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                            <Shield size={20} className="text-cyan-400" />
                        </div>
                        <div>
                            <h3 className="text-foreground font-bold text-sm">Diplomatic Influence Index</h3>
                            <p className="text-muted-foreground text-[13px] font-mono uppercase tracking-wider">Composite soft power score</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <span className="text-3xl font-bold text-cyan-400 font-mono">{overallScore}</span>
                        <span className="text-muted-foreground/60 text-sm font-mono">/100</span>
                    </div>
                </div>
                {/* Score bar */}
                <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                        className="h-full rounded-full transition-all duration-1000"
                        style={{
                            width: `${overallScore}%`,
                            background: `linear-gradient(90deg, #06b6d4, #3b82f6, #8b5cf6)`,
                        }}
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-2">

                {/* ── 1. VACCINE DIPLOMACY ── */}
                <div className="rounded-xl border border-border/30 bg-card p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <Syringe size={14} className="text-blue-400" />
                        <h4 className="text-foreground font-bold text-sm">Vaccine Diplomacy</h4>
                    </div>
                    <p className="text-muted-foreground text-xs font-mono uppercase tracking-wider mb-3">
                        Countries with highest vaccine-related signal activity
                    </p>
                    {vaccineDiplomacy.length === 0 ? (
                        <p className="text-muted-foreground text-sm italic">No vaccine signals detected</p>
                    ) : (
                        <div className="space-y-2.5">
                            {vaccineDiplomacy.map((v) => (
                                <div key={v.iso}>
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-muted-foreground font-medium text-sm">{v.country}</span>
                                        <span className="text-blue-400 text-sm font-mono font-bold">{v.signals}</span>
                                    </div>
                                    <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                                        <div
                                            className="h-full rounded-full bg-blue-500 transition-all duration-700"
                                            style={{
                                                width: `${pct(v.signals, maxVaccine)}%`,
                                                opacity: clamp(v.avgConfidence, 40, 100) / 100,
                                            }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* ── 2. RESOURCE ALLOCATION ── */}
                <div className="rounded-xl border border-border/30 bg-card p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <DollarSign size={14} className="text-emerald-400" />
                        <h4 className="text-foreground font-bold text-sm">Resource Allocation</h4>
                    </div>
                    <p className="text-muted-foreground text-xs font-mono uppercase tracking-wider mb-3">
                        Funding signals in unstable vs stable areas
                    </p>

                    <div className="flex gap-2 mb-3">
                        <div className="flex-1 rounded-lg bg-red-500/5 border border-red-500/10 p-2 text-center">
                            <p className="text-red-400/60 text-[11px] font-mono uppercase">Unstable Areas</p>
                            <p className="text-red-400 text-lg font-bold font-mono">{resourceAllocation.fundingToUnstable}</p>
                        </div>
                        <div className="flex-1 rounded-lg bg-emerald-500/5 border border-emerald-500/10 p-2 text-center">
                            <p className="text-emerald-400/60 text-[11px] font-mono uppercase">Stable Areas</p>
                            <p className="text-emerald-400 text-lg font-bold font-mono">{resourceAllocation.fundingToStable}</p>
                        </div>
                    </div>
                    <p className="text-muted-foreground text-[11px] font-mono uppercase tracking-wider mb-2">
                        Top conflict zones receiving funding
                    </p>
                    {resourceAllocation.targeted.length === 0 ? (
                        <p className="text-muted-foreground text-sm italic">No targeted funding detected</p>
                    ) : (
                        <div className="space-y-1.5">
                            {resourceAllocation.targeted.map((t) => (
                                <div key={t.iso} className="flex items-center justify-between text-sm">
                                    <div className="flex items-center gap-1.5">
                                        <AlertTriangle size={8} className="text-amber-400/60" />
                                        <span className="text-muted-foreground">{t.country}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-emerald-400/80 font-mono text-xs">{t.funding}f</span>
                                        <span className="text-red-400/60 font-mono text-xs">{t.conflict}c</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* ── 3. PARTNERSHIP STRENGTH ── */}
                <div className="rounded-xl border border-border/30 bg-card p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <Handshake size={14} className="text-purple-400" />
                        <h4 className="text-foreground font-bold text-sm">Partnership Strength</h4>
                    </div>
                    <p className="text-muted-foreground text-xs font-mono uppercase tracking-wider mb-3">
                        Regional bloc coordination level
                    </p>
                    <div className="space-y-3">
                        {partnerships.map((p) => (
                            <div key={p.key}>
                                <div className="flex items-center justify-between mb-1">
                                    <div className="flex items-center gap-1.5">
                                        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: p.color }} />
                                        <span className="text-foreground text-sm font-bold">{p.name}</span>
                                    </div>
                                    <span
                                        className="text-xs font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border"
                                        style={{
                                            color: p.statusColor,
                                            borderColor: `${p.statusColor}30`,
                                            backgroundColor: `${p.statusColor}10`,
                                        }}
                                    >
                                        {p.text}
                                    </span>
                                </div>
                                <div className="w-full h-1 bg-muted rounded-full overflow-hidden">
                                    <div
                                        className="h-full rounded-full transition-all duration-700"
                                        style={{ width: `${p.score}%`, backgroundColor: p.color }}
                                    />
                                </div>
                                <div className="flex items-center justify-between mt-0.5">
                                    <span className="text-muted-foreground text-[11px] font-mono">
                                        {p.agreementSignals} agreements · {p.crossBorderSignals} cross-border
                                    </span>
                                    <span className="text-muted-foreground/80 text-xs font-mono font-bold">{p.score}%</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

            </div>
        </div>
    );
}
