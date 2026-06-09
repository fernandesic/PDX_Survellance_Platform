import { useState, useEffect, useMemo, useRef } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { chwService } from "@/pages/chw/services/chw";
import type { CHWFieldReport } from "@/pages/chw/types/chw";
import { logger } from "@/utils/logger";
import {
    AlertTriangle, MapPin, Users, CheckCircle2,
    Loader2, RefreshCcw, Activity, FileText,
} from "lucide-react";

const SEVERITY_META: Record<string, { label: string; color: string; bg: string; border: string; barColor: string }> = {
    "1": { label: "Mild", color: "text-green-700", bg: "bg-green-50", border: "border-green-200", barColor: "bg-green-500" },
    "2": { label: "Moderate", color: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200", barColor: "bg-amber-500" },
    "3": { label: "Severe", color: "text-orange-700", bg: "bg-orange-50", border: "border-orange-300", barColor: "bg-orange-500" },
    "4": { label: "Critical", color: "text-red-700", bg: "bg-red-50", border: "border-red-300", barColor: "bg-red-600" },
};

const SEVERITY_META_DARK: Record<string, { label: string; color: string; bg: string; border: string; barColor: string }> = {
    "1": { label: "Mild", color: "text-green-400", bg: "bg-green-500/10", border: "border-green-500/20", barColor: "bg-green-500" },
    "2": { label: "Moderate", color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20", barColor: "bg-amber-500" },
    "3": { label: "Severe", color: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/20", barColor: "bg-orange-500" },
    "4": { label: "Critical", color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20", barColor: "bg-red-600" },
};

const parseSeverity = (raw: string) => {
    const match = raw?.match(/^(\d+)/);
    const level = match ? parseInt(match[1], 10) : 0;
    return { level, raw };
};

const humanizeEventTypes = (raw: string): string[] => {
    if (!raw) return [];
    return raw.split(/\s+/).map(token =>
        token.split("_").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" / ")
    );
};

const humanizeAgeGroup = (raw: string): string => {
    if (!raw) return "Unknown";
    if (raw.toLowerCase() === "under5") return "Under 5";
    if (raw.toLowerCase() === "all_ages") return "All ages";
    const match = raw.match(/^(\d+)_(\d+)$/);
    if (match) return `${match[1]}–${match[2]} years`;
    return raw.split("_").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
};


const formatDateTime = (iso: string): string => {
    try {
        const d = new Date(iso);
        const date = d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
        const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
        return `${date}, ${time}`;
    } catch { return ""; }
};

const getInitials = (name: string): string => {
    if (!name) return "?";
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return parts[0].substring(0, 2).toUpperCase();
};

const severityDescription = (level: number, caseCount: number): string => {
    if (level >= 4) return "rapidly spreading, deaths reported";
    if (level >= 3) return "hospitalisations reported";
    if (level >= 2) return "localised cases, monitoring needed";
    return "isolated cases, low risk";
};

/* ─── Avatar color from name hash ─── */
const AVATAR_COLORS = [
    { bg: "bg-rose-100", text: "text-rose-700", darkBg: "bg-rose-500/15", darkText: "text-rose-400" },
    { bg: "bg-blue-100", text: "text-blue-700", darkBg: "bg-blue-500/15", darkText: "text-blue-400" },
    { bg: "bg-emerald-100", text: "text-emerald-700", darkBg: "bg-emerald-500/15", darkText: "text-emerald-400" },
    { bg: "bg-purple-100", text: "text-purple-700", darkBg: "bg-purple-500/15", darkText: "text-purple-400" },
    { bg: "bg-amber-100", text: "text-amber-700", darkBg: "bg-amber-500/15", darkText: "text-amber-400" },
    { bg: "bg-cyan-100", text: "text-cyan-700", darkBg: "bg-cyan-500/15", darkText: "text-cyan-400" },
];
const getAvatarColor = (name: string) => {
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};


/* ═══════════════════════════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════════════════════════ */

export default function CHWFieldReports() {
    const { theme } = useTheme();
    const isDark = theme === "dark";

    const [reports, setReports] = useState<CHWFieldReport[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [severityFilter, setSeverityFilter] = useState<string>("all");
    const hasFetched = useRef(false);

    useEffect(() => {
        if (hasFetched.current) return;
        hasFetched.current = true;
        fetchReports();
    }, []);

    const fetchReports = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await chwService.getFieldReports();
            setReports(data);
        } catch (err: any) {
            logger.error("Field reports fetch error:", err);
            setError("Failed to load field reports.");
        } finally {
            setLoading(false);
        }
    };

    const severityLevels = useMemo(() => {
        const levels = new Set<number>();
        reports.forEach(r => {
            const { level } = parseSeverity(r.q4_severity);
            if (level > 0) levels.add(level);
        });
        return Array.from(levels).sort((a, b) => b - a);
    }, [reports]);

    const filtered = useMemo(() => {
        if (severityFilter === "all") return reports;
        return reports.filter(r => {
            const { level } = parseSeverity(r.q4_severity);
            return level.toString() === severityFilter;
        });
    }, [reports, severityFilter]);

    const sorted = filtered;

    const kpis = useMemo(() => {
        const today = new Date().toISOString().split("T")[0];
        const todayReports = reports.filter(r => r.today === today);
        const totalCases = reports.reduce((sum, r) => sum + (Number(r.q2_case_count) || 0), 0);
        const highSeverity = reports.filter(r => parseSeverity(r.q4_severity).level >= 3);
        const locations = new Set(reports.map(r => r.chw_location?.toLowerCase()));
        return {
            total: reports.length,
            todayCount: todayReports.length,
            pendingReview: highSeverity.length,
            totalCases,
            communities: locations.size,
        };
    }, [reports]);

    const maxSeverity = useMemo(() => {
        return Math.max(...severityLevels, 4);
    }, [severityLevels]);

    const sevMeta = isDark ? SEVERITY_META_DARK : SEVERITY_META;

    if (loading) {
        return (
            <div className={`rounded-2xl border h-[700px] flex flex-col items-center justify-center ${isDark ? "bg-transparent border-white/10" : "bg-white border-gray-200"
                }`}>
                <Loader2 size={28} className={`animate-spin mb-3 ${isDark ? "text-cyan-400" : "text-blue-500"}`} />
                <p className={`text-sm ${isDark ? "text-gray-400" : "text-gray-500"}`}>Loading field reports…</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className={`rounded-2xl border h-[700px] flex flex-col items-center justify-center ${isDark ? "bg-transparent border-white/10" : "bg-white border-gray-200"
                }`}>
                <AlertTriangle size={28} className={`mb-3 ${isDark ? "text-red-400" : "text-red-500"}`} />
                <p className={`text-sm font-medium mb-1 ${isDark ? "text-white" : "text-gray-900"}`}>Failed to load</p>
                <p className={`text-xs mb-4 ${isDark ? "text-gray-500" : "text-gray-400"}`}>{error}</p>
                <button
                    onClick={() => { hasFetched.current = false; fetchReports(); }}
                    className={`px-4 py-2 rounded-lg text-xs font-medium transition-all ${isDark
                        ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/20"
                        : "bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100"
                        }`}
                >
                    Retry
                </button>
            </div>
        );
    }

    return (
        <div className={`rounded-2xl border overflow-hidden h-[700px] flex flex-col ${isDark ? "bg-white/5 border-white/20 shadow-xl shadow-blue-900/10" : "bg-white border-gray-200 shadow-lg"
            }`}>
            {/* ── Header ── */}
            <div className={`px-6 py-5 border-b flex items-center justify-between flex-shrink-0 ${isDark ? "border-white/20" : "border-gray-100"
                }`}>
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${isDark ? "bg-cyan-500/10" : "bg-blue-50"}`}>
                        <FileText size={18} className={isDark ? "text-cyan-400" : "text-blue-600"} />
                    </div>
                    <div>
                        <h3 className={`text-lg font-bold ${isDark ? "text-white" : "text-gray-900"}`}>
                            CHW Field Reports
                        </h3>
                        <p className={`text-sm mt-0.5 ${isDark ? "text-[#A8C4BB]" : "text-gray-400"}`}>
                            Community surveillance submissions
                        </p>
                    </div>
                    {reports.length > 0 && (
                        <span className={`ml-3 px-3 py-1 rounded-full text-xs font-black ${isDark ? "bg-[#22C55E]/20 text-[#22C55E]" : "bg-blue-100 text-blue-700"
                            }`}>
                            {reports.length} {reports.length === 1 ? "report" : "reports"}
                        </span>
                    )}
                </div>
                <button
                    onClick={() => { hasFetched.current = false; fetchReports(); }}
                    className={`p-2 rounded-lg transition-all ${isDark
                        ? "text-gray-500 hover:text-cyan-400 hover:bg-white/5"
                        : "text-gray-400 hover:text-blue-600 hover:bg-gray-50"
                        }`}
                    title="Refresh reports"
                >
                    <RefreshCcw size={14} />
                </button>
            </div>

            {/* ── KPI Row ── */}
            <div className={`grid grid-cols-2 md:grid-cols-4 gap-4 px-6 py-5 border-b flex-shrink-0 ${isDark ? "border-white/20 bg-black/20" : "border-gray-100 bg-gray-50/50"
                }`}>
                {[
                    { label: "Reports today", value: kpis.todayCount, sub: `+${kpis.todayCount} since 00:00`, icon: FileText, color: "blue" },
                    { label: "Needs attention", value: kpis.pendingReview, sub: "High severity", icon: AlertTriangle, color: "red" },
                    { label: "Cases reported", value: kpis.totalCases, sub: `Across ${kpis.communities} communities`, icon: Users, color: "amber" },
                    { label: "Total reports", value: kpis.total, sub: "All time", icon: CheckCircle2, color: "green" },
                ].map((kpi, i) => {
                    const KpiIcon = kpi.icon;
                    return (
                        <div key={i} className={`rounded-xl p-4 border ${isDark ? "bg-white/5 border-white/20 shadow-lg" : "bg-white border-gray-100"
                            }`}>
                            <div className="flex items-center justify-between mb-1.5">
                                <span className={`text-sm font-bold ${isDark ? "text-[#D1E5DE]" : "text-gray-400"}`}>
                                    {kpi.label}
                                </span>
                                <KpiIcon size={16} className={isDark ? "text-[#22C55E]/50" : "text-gray-300"} />
                            </div>
                            <div className={`text-2xl font-black ${isDark ? "text-white" : "text-gray-900"}`}>{kpi.value}</div>
                            <div className={`text-xs mt-1 font-medium ${isDark ? "text-[#A8C4BB]" : "text-gray-400"}`}>{kpi.sub}</div>
                        </div>
                    );
                })}
            </div>

            {/* ── Severity Filter Tabs ── */}
            <div className={`px-6 py-3.5 border-b flex items-center gap-2.5 flex-shrink-0 ${isDark ? "border-white/20" : "border-gray-100"
                }`}>
                <button
                    onClick={() => setSeverityFilter("all")}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${severityFilter === "all"
                        ? isDark ? "bg-white/10 text-white" : "bg-gray-900 text-white"
                        : isDark ? "text-[#A8C4BB] hover:text-white hover:bg-white/10" : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                        }`}
                >
                    All
                </button>
                {severityLevels.map(level => {
                    const meta = sevMeta[level.toString()];
                    if (!meta) return null;
                    const count = reports.filter(r => parseSeverity(r.q4_severity).level === level).length;
                    return (
                        <button
                            key={level}
                            onClick={() => setSeverityFilter(level.toString())}
                            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${severityFilter === level.toString()
                                ? `${meta.bg} ${meta.color} ${meta.border} border-2`
                                : isDark ? "text-[#A8C4BB] hover:text-white hover:bg-white/10" : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                                }`}
                        >
                            {meta.label}
                            <span className={`text-xs ml-0.5 ${severityFilter === level.toString() ? "" : isDark ? "text-gray-600" : "text-gray-400"}`}>
                                {count}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* ── Report Cards (scrollable area) ── */}
            <div className={`flex-1 overflow-y-auto divide-y ${isDark ? "divide-white/[0.04]" : "divide-gray-100"}`}>
                {sorted.length === 0 ? (
                    <div className="py-16 text-center">
                        <Activity size={24} className={`mx-auto mb-3 ${isDark ? "text-gray-700" : "text-gray-300"}`} />
                        <p className={`text-sm font-medium ${isDark ? "text-gray-500" : "text-gray-400"}`}>
                            No reports match the current filter
                        </p>
                    </div>
                ) : sorted.map(report => (
                    <ReportCard
                        key={report._id}
                        report={report}
                        isDark={isDark}
                        sevMeta={sevMeta}
                        maxSeverity={maxSeverity}
                    />
                ))}
            </div>
        </div>
    );
}


/* ═══════════════════════════════════════════════════════════════
   Report Card Sub-Component
   ═══════════════════════════════════════════════════════════════ */

function ReportCard({ report, isDark, sevMeta, maxSeverity }: {
    report: CHWFieldReport;
    isDark: boolean;
    sevMeta: Record<string, { label: string; color: string; bg: string; border: string; barColor: string }>;
    maxSeverity: number;
}) {
    const [expanded, setExpanded] = useState(false);
    const { level } = parseSeverity(report.q4_severity);
    const meta = sevMeta[level.toString()] || sevMeta["1"];
    const eventTypes = humanizeEventTypes(report.q1_event_type);
    const ageGroup = humanizeAgeGroup(report.q3_age_group);
    const dateTime = formatDateTime(report._submission_time);
    const initials = getInitials(report.chw_name);
    const avatarColor = getAvatarColor(report.chw_name);
    const caseCount = Number(report.q2_case_count) || 0;
    const barWidth = maxSeverity > 0 ? (level / maxSeverity) * 100 : 0;

    // Build the left border color based on severity
    const borderLeftColor = level >= 4 ? "border-l-red-500" :
        level >= 3 ? "border-l-orange-400" :
            level >= 2 ? "border-l-amber-400" :
                "border-l-green-400";

    return (
        <div
            className={`px-6 py-5 border-l-[3px] transition-all hover:${isDark ? "bg-white/[0.02]" : "bg-gray-50/60"} ${borderLeftColor}`}
        >
            {/* ── Top Row: Avatar + Name + Severity + Time ── */}
            <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold ${isDark ? avatarColor.darkBg + " " + avatarColor.darkText : avatarColor.bg + " " + avatarColor.text
                        }`}>
                        {initials}
                    </div>
                    <div>
                        <h4 className={`text-base font-bold ${isDark ? "text-white" : "text-gray-900"}`}>
                            {report.chw_name}
                        </h4>
                        <p className={`text-sm flex items-center gap-1.5 ${isDark ? "text-[#A8C4BB]" : "text-gray-400"}`}>
                            <MapPin size={13} />
                            {report.chw_location}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <span className={`px-3 py-1.5 rounded-md text-xs font-black ${meta.bg} ${meta.color} ${meta.border} border-2`}>
                        {level} — {meta.label}
                    </span>
                    <span className={`text-sm font-medium ${isDark ? "text-[#8BB7AE]" : "text-gray-400"}`}>
                        {dateTime}
                    </span>
                </div>
            </div>

            {/* ── Tags: Event Types + Age Group ── */}
            <div className="flex flex-wrap items-center gap-2.5 mb-4">
                {eventTypes.map((tag, i) => (
                    <span key={i} className={`px-3 py-1.5 rounded-md text-sm font-bold border ${isDark ? "bg-white/5 border-white/10 text-[#D1E5DE]" : "bg-gray-50 border-gray-200 text-gray-600"
                        }`}>
                        {tag}
                    </span>
                ))}
                <span className={`px-3 py-1.5 rounded-md text-sm font-black border ${isDark ? "bg-[#2EC4B6]/10 border-[#2EC4B6]/20 text-[#2EC4B6]" : "bg-blue-50 border-blue-200 text-blue-600"
                    }`}>
                    {ageGroup}
                </span>
            </div>

            {/* ── Description ── */}
            {report.q5_description && (
                <div className={`rounded-lg p-3.5 mb-3 ${isDark ? "bg-white/[0.02] border border-white/[0.05]" : "bg-gray-50 border border-gray-100"
                    }`}>
                    <p className={`text-sm leading-relaxed italic ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                        "{report.q5_description}"
                    </p>
                </div>
            )}

            {/* ── Severity Bar ── */}
            <div className="mb-4">
                <div className="flex items-center justify-between mb-1.5">
                    <span className={`text-sm font-bold ${isDark ? "text-[#A8C4BB]" : "text-gray-400"}`}>
                        Severity
                    </span>
                    <span className={`text-sm font-medium ${isDark ? "text-[#D1E5DE]" : "text-gray-500"}`}>
                        {level} / {maxSeverity} — {severityDescription(level, caseCount)}
                    </span>
                </div>
                <div className={`h-2 rounded-full overflow-hidden ${isDark ? "bg-white/10" : "bg-gray-100"}`}>
                    <div
                        className={`h-full rounded-full transition-all duration-500 ${meta.barColor}`}
                        style={{ width: `${barWidth}%` }}
                    />
                </div>
            </div>

            {/* ── Stats Row: Affected, Age Group, GPS ── */}
            <div className={`grid grid-cols-3 gap-4`}>
                <div className={`rounded-lg p-3 ${isDark ? "bg-white/5 border border-white/10" : "bg-gray-50 border border-gray-100"}`}>
                    <span className={`text-xs font-bold uppercase tracking-wider block mb-1.5 ${isDark ? "text-[#A8C4BB]" : "text-gray-400"}`}>
                        Affected
                    </span>
                    <span className={`text-base font-black ${isDark ? "text-white" : "text-gray-900"}`}>
                        {caseCount}+ cases
                    </span>
                </div>
                <div className={`rounded-lg p-3 ${isDark ? "bg-white/5 border border-white/10" : "bg-gray-50 border border-gray-100"}`}>
                    <span className={`text-xs font-bold uppercase tracking-wider block mb-1.5 ${isDark ? "text-[#A8C4BB]" : "text-gray-400"}`}>
                        Age Group
                    </span>
                    <span className={`text-base font-black ${isDark ? "text-white" : "text-gray-900"}`}>
                        {ageGroup}
                    </span>
                </div>
                <div className={`rounded-lg p-3 ${isDark ? "bg-white/5 border border-white/10" : "bg-gray-50 border border-gray-100"}`}>
                    <span className={`text-xs font-bold uppercase tracking-wider block mb-1.5 ${isDark ? "text-[#A8C4BB]" : "text-gray-400"}`}>
                        Location Name
                    </span>
                    <span className={`text-sm font-black ${isDark ? "text-white" : "text-gray-900"}`}>
                        {report.chw_location || "—"}
                    </span>
                </div>
            </div>

            {/* ── Action Buttons ── */}
            <div className="flex items-center gap-3 mt-5">
                <button className={`px-4 py-2.5 rounded-lg text-sm font-black border transition-all ${isDark
                    ? "border-red-500/30 text-red-400 bg-red-500/10 hover:bg-red-500/20 shadow-lg shadow-red-500/10"
                    : "border-red-200 text-red-600 bg-red-50 hover:bg-red-100"
                    }`}>
                    Alert team
                </button>
                <button className={`px-4 py-2.5 rounded-lg text-sm font-black border transition-all ${isDark
                    ? "border-blue-500/30 text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 shadow-lg shadow-blue-500/10"
                    : "border-blue-200 text-blue-600 bg-blue-50 hover:bg-blue-100"
                    }`}>
                    Assign focal point
                </button>
                <button className={`px-4 py-2.5 rounded-lg text-sm font-black border transition-all ${isDark
                    ? "border-[#22C55E]/30 text-[#22C55E] bg-[#22C55E]/10 hover:bg-[#22C55E]/20 shadow-lg shadow-[#22C55E]/10"
                    : "border-green-200 text-green-600 bg-green-50 hover:bg-green-100"
                    }`}>
                    Mark verified
                </button>
                <div className="flex-1" />
                <button className={`px-4 py-2.5 rounded-lg text-sm font-bold border transition-all ${isDark
                    ? "border-white/10 text-[#A8C4BB] hover:text-white hover:bg-white/10"
                    : "border-gray-200 text-gray-400 hover:text-gray-600 hover:bg-gray-50"
                    }`}>
                    Dismiss
                </button>
            </div>
        </div>
    );
}
