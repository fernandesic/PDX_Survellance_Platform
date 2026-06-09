/**
 * TrustBadge — Visual indicator for signal trust level.
 * This is the key differentiator vs the original HDIS RiskBadge.
 */

import type { TrustLevel } from "@/pages/hdis/types";

const trustConfig: Record<TrustLevel, { label: string; className: string; icon: string }> = {
  verified: {
    label: "VERIFIED",
    className: "bg-green-500/15 text-green-400 border-green-500/30",
    icon: "🟢",
  },
  corroborated: {
    label: "CORROBORATED",
    className: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
    icon: "🟡",
  },
  unverified: {
    label: "UNVERIFIED",
    className: "bg-orange-500/15 text-orange-400 border-orange-500/30",
    icon: "🟠",
  },
  unconfirmed: {
    label: "UNCONFIRMED",
    className: "bg-red-500/15 text-red-400 border-red-500/30",
    icon: "🔴",
  },
};

export function TrustBadge({ level, showScore }: { level: TrustLevel; showScore?: number }) {
  const config = trustConfig[level] || trustConfig.unconfirmed;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-xs font-semibold uppercase tracking-wider ${config.className}`}
    >
      <span>{config.icon}</span>
      {config.label}
      {showScore !== undefined && (
        <span className="opacity-70 ml-0.5">{showScore}</span>
      )}
    </span>
  );
}
