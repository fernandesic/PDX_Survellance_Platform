import { useEffect, useRef, useState } from "react";
import { Hospital, MapPin, Activity, AlertTriangle, RefreshCw, Loader2, Radio } from "lucide-react";
import { apiGet } from "@/lib/api";
import { logger } from "@/utils/logger";

/* ── Types ─────────────────────────────────────────────────────── */

interface Tier0Signal {
    id: number;
    disease_name?: string;
    location_country?: string;
    location_country_iso?: string;
    location_admin1?: string;
    location_locality?: string;
    priority?: "P1" | "P2" | "P3" | "P4";
    reported_cases?: number;
    reported_deaths?: number;
    source_name?: string;
    source_timestamp?: string;
    created_at?: string;
    ai_severity?: string;
    translated_text?: string;
    original_text?: string;
}

interface Props {
    isDark: boolean;
    /**
     * Fallback polling interval (ms) used only if SSE fails to connect.
     * 0 disables fallback entirely. Default 60s — SSE handles the live case,
     * polling only catches up if the stream dies.
     */
    fallbackPollMs?: number;
}

const DEFAULT_FALLBACK_POLL_MS = 60_000;
// EventSource resolves relative URLs against window.location.origin, so a bare
// "/api/v1/…" would hit the Vite dev server (5173) instead of Django (8000).
// Prefix with the configured API base so the request reaches the backend in
// every environment.
const SSE_URL = `${import.meta.env.VITE_API_BASE_URL ?? ""}/sentinel/signals/stream/tier0/`;
type StreamStatus = "connecting" | "live" | "polling" | "offline";

/* ── Helpers ───────────────────────────────────────────────────── */

function formatRelative(iso?: string): string {
    if (!iso) return "—";
    const ts = Date.parse(iso);
    if (Number.isNaN(ts)) return "—";
    const diff = Date.now() - ts;
    if (diff < 60_000) return "just now";
    const mins = Math.floor(diff / 60_000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(ts).toLocaleDateString();
}

const PRIORITY_STYLE: Record<string, { bg: string; text: string; label: string }> = {
    P1: { bg: "bg-red-500/15 ring-red-500/30", text: "text-red-400", label: "CRITICAL" },
    P2: { bg: "bg-orange-500/15 ring-orange-500/30", text: "text-orange-400", label: "HIGH" },
    P3: { bg: "bg-amber-500/15 ring-amber-500/30", text: "text-amber-400", label: "MEDIUM" },
    P4: { bg: "bg-emerald-500/15 ring-emerald-500/30", text: "text-emerald-400", label: "LOW" },
};

/* ── Component ─────────────────────────────────────────────────── */

export function CHWFieldIntelligence({ isDark, fallbackPollMs = DEFAULT_FALLBACK_POLL_MS }: Props) {
    const [signals, setSignals] = useState<Tier0Signal[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [lastFetched, setLastFetched] = useState<Date | null>(null);
    const [stream, setStream] = useState<StreamStatus>("connecting");
    const sseRef = useRef<EventSource | null>(null);

    const load = async (silent = false) => {
        if (!silent) setLoading(true);
        setError(null);
        try {
            const data = await apiGet<Tier0Signal[] | { results: Tier0Signal[] }>(
                "/sentinel/signals/?source_tier=0&limit=50&all=true&ordering=-source_timestamp",
            );
            const list = Array.isArray(data) ? data : data?.results || [];
            setSignals(list);
            setLastFetched(new Date());
        } catch (err: any) {
            logger.error("[CHW Field Intelligence] fetch failed", err);
            if (!silent) setError("Could not load Tier 0 field signals.");
        } finally {
            if (!silent) setLoading(false);
        }
    };

    // Merge a single incoming signal into state. Dedupe by id so reconnects
    // (which trigger a fresh GET) don't double-render.
    const upsertSignal = (incoming: Tier0Signal) => {
        setSignals((prev) => {
            if (prev.some((s) => s.id === incoming.id)) return prev;
            return [incoming, ...prev].slice(0, 50);
        });
        setLastFetched(new Date());
    };

    useEffect(() => {
        // 1. Initial history fetch.
        load();

        // 2. Open SSE stream for push updates.
        let pollTimer: number | undefined;
        const openStream = () => {
            try {
                const es = new EventSource(SSE_URL, { withCredentials: true });
                sseRef.current = es;
                setStream("connecting");

                es.addEventListener("ready", () => setStream("live"));
                es.addEventListener("signal.created", (evt: MessageEvent) => {
                    try {
                        const data = JSON.parse(evt.data) as Tier0Signal;
                        upsertSignal(data);
                    } catch (err) {
                        logger.warn?.("[CHW SSE] could not parse event", err);
                    }
                });

                es.onerror = () => {
                    // EventSource auto-reconnects. If the browser gave up
                    // (readyState=CLOSED), fall back to polling.
                    if (es.readyState === EventSource.CLOSED) {
                        setStream("polling");
                        if (fallbackPollMs && !pollTimer) {
                            pollTimer = window.setInterval(() => load(true), fallbackPollMs);
                        }
                    }
                };
            } catch (err) {
                logger.error("[CHW SSE] failed to open stream — falling back to polling", err);
                setStream("polling");
                if (fallbackPollMs && !pollTimer) {
                    pollTimer = window.setInterval(() => load(true), fallbackPollMs);
                }
            }
        };
        openStream();

        return () => {
            if (sseRef.current) {
                sseRef.current.close();
                sseRef.current = null;
            }
            if (pollTimer) window.clearInterval(pollTimer);
        };
    }, [fallbackPollMs]);

    const cardBg = isDark
        ? "bg-white/[0.02] backdrop-blur-md border-white/10 shadow-xl"
        : "bg-white border-gray-100 shadow-sm";
    const headerBorder = isDark ? "rgba(255,255,255,0.06)" : "#e5e7eb";

    return (
        <div className={`rounded-xl border overflow-hidden transition-all ${cardBg}`}>
            {/* Header */}
            <div
                className="px-5 py-3 flex items-center justify-between border-b"
                style={{ borderColor: headerBorder }}
            >
                <div className="flex items-center gap-2">
                    <Hospital size={18} className="text-emerald-500" />
                    <h3 className={`text-base font-bold ${isDark ? "text-white" : "text-gray-900"}`}>
                        Live Field Intelligence
                    </h3>
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold tracking-wider text-emerald-400 ring-1 ring-emerald-500/30">
                        🏥 TIER 0 GROUND TRUTH
                    </span>
                    <StreamBadge status={stream} />
                </div>
                <div className="flex items-center gap-3">
                    {lastFetched ? (
                        <span className={`text-[10px] ${isDark ? "text-[#A8C4BB]" : "text-gray-400"}`}>
                            Last update {formatRelative(lastFetched.toISOString())}
                        </span>
                    ) : null}
                    <button
                        type="button"
                        onClick={() => load()}
                        disabled={loading}
                        title="Refresh CHW signals"
                        className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-semibold transition-colors disabled:opacity-50 ${
                            isDark ? "text-[#A8C4BB] hover:text-white" : "text-gray-500 hover:text-gray-800"
                        }`}
                    >
                        {loading ? (
                            <Loader2 size={12} className="animate-spin" />
                        ) : (
                            <RefreshCw size={12} />
                        )}
                        Refresh
                    </button>
                </div>
            </div>

            {/* Body */}
            <div className="p-4">
                {error ? (
                    <div className="flex items-center gap-2 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400 ring-1 ring-red-500/20">
                        <AlertTriangle size={14} />
                        {error}
                    </div>
                ) : loading && signals.length === 0 ? (
                    <ul className="space-y-2">
                        {Array.from({ length: 4 }).map((_, i) => (
                            <li
                                key={i}
                                className={`h-14 animate-pulse rounded-lg ${
                                    isDark ? "bg-white/[0.04]" : "bg-gray-100"
                                }`}
                            />
                        ))}
                    </ul>
                ) : signals.length === 0 ? (
                    <div
                        className={`flex flex-col items-center justify-center py-10 text-center text-sm ${
                            isDark ? "text-[#A8C4BB]" : "text-gray-500"
                        }`}
                    >
                        <Hospital size={28} className="mb-2 text-emerald-500/60" />
                        <p className="font-semibold">No CHW signals yet</p>
                        <p className="text-xs mt-1 max-w-md">
                            Once Community Health Workers submit reports through the KoboToolbox form,
                            they will appear here in real time. Each report becomes a Tier 0 signal that
                            feeds the Outbreak Workspace, PoE Command Center, and SpilloverEngine.
                        </p>
                    </div>
                ) : (
                    <div className="max-h-[420px] overflow-y-auto">
                        <ul className="space-y-2">
                            {signals.map((s) => {
                                const pri = PRIORITY_STYLE[s.priority || "P3"] || PRIORITY_STYLE.P3;
                                const location =
                                    [s.location_locality, s.location_admin1, s.location_country]
                                        .filter(Boolean)
                                        .join(", ") || "Unknown location";
                                const ts = s.source_timestamp || s.created_at;
                                const headline =
                                    s.translated_text ||
                                    s.original_text ||
                                    `${s.disease_name || "Field report"} — ${location}`;

                                return (
                                    <li
                                        key={s.id}
                                        className={`group rounded-lg border px-3 py-2.5 transition-colors ${
                                            isDark
                                                ? "border-white/5 bg-white/[0.02] hover:border-emerald-500/40 hover:bg-emerald-500/[0.04]"
                                                : "border-gray-100 bg-gray-50/60 hover:border-emerald-500/40 hover:bg-emerald-500/5"
                                        }`}
                                        style={{ borderLeft: "3px solid rgb(16, 185, 129)" }}
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <span
                                                className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] font-bold tracking-wider ring-1 ${pri.bg} ${pri.text}`}
                                            >
                                                {pri.label}
                                            </span>
                                            <span
                                                className={`text-[10px] ${
                                                    isDark ? "text-[#6FA39A]" : "text-gray-500"
                                                }`}
                                            >
                                                {formatRelative(ts)}
                                            </span>
                                        </div>

                                        <p
                                            className={`mt-1 text-[13px] font-semibold leading-snug line-clamp-2 ${
                                                isDark ? "text-white" : "text-gray-900"
                                            }`}
                                        >
                                            {s.disease_name || "Unclassified syndrome"}
                                        </p>

                                        {headline && headline !== s.disease_name ? (
                                            <p
                                                className={`text-[11px] mt-0.5 line-clamp-2 ${
                                                    isDark ? "text-[#A8C4BB]" : "text-gray-600"
                                                }`}
                                            >
                                                {headline}
                                            </p>
                                        ) : null}

                                        <div
                                            className={`mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] ${
                                                isDark ? "text-[#6FA39A]" : "text-gray-500"
                                            }`}
                                        >
                                            <span className="inline-flex items-center gap-1">
                                                <MapPin size={10} /> {location}
                                            </span>
                                            {typeof s.reported_cases === "number" && s.reported_cases > 0 ? (
                                                <span className="inline-flex items-center gap-1 text-orange-400">
                                                    <Activity size={10} /> {s.reported_cases} cases
                                                </span>
                                            ) : null}
                                            {typeof s.reported_deaths === "number" && s.reported_deaths > 0 ? (
                                                <span className="inline-flex items-center gap-1 text-red-400">
                                                    ☠ {s.reported_deaths} deaths
                                                </span>
                                            ) : null}
                                            <span className="ml-auto inline-flex items-center gap-1 text-emerald-500/80">
                                                · {s.source_name || "KoboToolbox CHW"}
                                            </span>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                )}
            </div>
        </div>
    );
}

/* ── Live / polling / offline status badge ─────────────────── */

function StreamBadge({ status }: { status: StreamStatus }) {
    if (status === "live") {
        return (
            <span
                title="Live stream connected — new CHW reports arrive in real time"
                className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold tracking-wider text-emerald-400 ring-1 ring-emerald-500/30"
            >
                <Radio size={10} className="animate-pulse" />
                LIVE
            </span>
        );
    }
    if (status === "polling") {
        return (
            <span
                title="Real-time stream unavailable — falling back to periodic refresh"
                className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold tracking-wider text-amber-400 ring-1 ring-amber-500/30"
            >
                <Radio size={10} />
                POLLING
            </span>
        );
    }
    if (status === "offline") {
        return (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-semibold tracking-wider text-red-400 ring-1 ring-red-500/30">
                OFFLINE
            </span>
        );
    }
    // connecting
    return (
        <span className="inline-flex items-center gap-1 rounded-full bg-slate-500/15 px-2 py-0.5 text-[10px] font-semibold tracking-wider text-slate-400 ring-1 ring-slate-500/30">
            <Loader2 size={10} className="animate-spin" />
            CONNECTING
        </span>
    );
}

export default CHWFieldIntelligence;
