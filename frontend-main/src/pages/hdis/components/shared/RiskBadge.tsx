import { RISK_COLORS } from "@/pages/hdis/constants";

const badgeStyles: Record<string, string> = {
    critical: "bg-red-500/15 text-red-400 border-red-500/20",
    high: "bg-orange-500/15 text-orange-400 border-orange-500/20",
    medium: "bg-yellow-500/15 text-yellow-400 border-yellow-500/20",
    low: "bg-green-500/15 text-green-400 border-green-500/20",
};

export function RiskBadge({ level, className = "" }: { level: string, className?: string }) {
    return (
        <span className={`inline-flex items-center rounded border px-1.5 py-0.5 font-mono text-[11px] font-bold uppercase tracking-wide opacity-80 ${badgeStyles[level] ?? badgeStyles.low} ${className}`}>
            {level}
        </span>
    );
}

export function RiskDot({ level, size = 10, className = "" }: { level: string; size?: number; className?: string }) {
    const color = RISK_COLORS[level] ?? RISK_COLORS.low;
    const pulse = level === "critical" || level === "high";
    return (
        <span className={`relative inline-flex items-center justify-center shrink-0 ${className}`} style={{ width: size + 4, height: size + 4 }}>
            {/* Outer ring */}
            <span className="absolute inset-0 rounded-full bg-black/40 border border-white/[0.05]" />
            {/* Glow/Pulse */}
            {pulse && <span className="absolute inset-0 rounded-full animate-ping opacity-10" style={{ backgroundColor: color }} />}
            {/* Inner dot */}
            <span className="relative block rounded-full shadow-[0_0_4px_rgba(0,0,0,0.5)]" style={{ width: size - 4, height: size - 4, backgroundColor: color }} />
        </span>
    );
}
