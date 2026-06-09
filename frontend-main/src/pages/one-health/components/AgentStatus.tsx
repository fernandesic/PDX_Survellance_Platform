import type { OHAgent } from "../services/oneHealth";

interface AgentStatusProps {
  agents: OHAgent[];
  source: "db" | "loading" | "fallback";
}

const STATUS_ICON_STYLE: Record<string, string> = {
  running: "bg-[var(--oh-aqua-glow)] border-[var(--oh-border3)]",
  alert: "bg-[var(--oh-crimson-glow)] border-[rgba(255,61,90,0.3)]",
  idle: "bg-[rgba(255,255,255,0.03)] border-[var(--oh-border)]",
  pending: "bg-[var(--oh-amber-glow)] border-[rgba(255,179,71,0.25)]",
};

const STATUS_BADGE_STYLE: Record<string, string> = {
  running: "oh-ast-running",
  alert: "oh-ast-alert",
  idle: "oh-ast-idle",
  pending: "oh-ast-pending",
};

export default function AgentStatus({ agents, source }: AgentStatusProps) {
  // Phase derived from any agent (fall back to "Phase III" for parity if no phase set)
  const phase = agents.find((a) => a.phase)?.phase || "Phase III";

  return (
    <div className="oh-glass-card flex-shrink-0 overflow-hidden" style={{ animationDelay: "0.2s" }}>
      {/* Header */}
      <div className="px-3.5 py-2.5 border-b border-[var(--oh-border)] flex items-center justify-between">
        <div className="text-[11.5px] font-semibold text-[var(--oh-text)] flex items-center gap-2">
          <span>AI Agent Status</span>
          <span className="font-mono text-[8px] px-1.5 py-0.5 rounded bg-[var(--oh-aqua-glow)] text-[var(--oh-aqua)] border border-[var(--oh-border3)] tracking-wider uppercase">
            {phase}
          </span>
          {source === "loading" && (
            <span className="font-mono text-[8px] text-[var(--oh-text3)]">Loading…</span>
          )}
          {source === "fallback" && (
            <span className="font-mono text-[8px] text-[var(--oh-amber)]">Static</span>
          )}
        </div>
        <span className="font-mono text-[9px] text-[var(--oh-text3)] cursor-pointer hover:text-[var(--oh-aqua)] tracking-wider transition-colors">
          Manage →
        </span>
      </div>

      {/* Agent list */}
      <div className="px-2 py-1.5">
        {agents.map((a) => (
          <div
            key={a.agent_id}
            className="flex items-start gap-2 px-1.5 py-2 rounded cursor-pointer transition-colors hover:bg-[rgba(255,255,255,0.03)] border-b border-[var(--oh-border)] last:border-b-0 mb-px"
          >
            <div
              className={`w-7 h-7 rounded-lg flex items-center justify-center text-[13px] shrink-0 border ${
                STATUS_ICON_STYLE[a.status] || STATUS_ICON_STYLE.idle
              }`}
            >
              {a.icon || "•"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-semibold text-[var(--oh-text)] flex items-center gap-1.5 mb-0.5">
                {a.name}
                <span
                  className={`font-mono text-[8px] px-1.5 py-px rounded ${
                    STATUS_BADGE_STYLE[a.status] || STATUS_BADGE_STYLE.idle
                  }`}
                >
                  {a.status_label}
                </span>
              </div>
              <div className="text-[10px] text-[var(--oh-text3)] leading-snug">
                {a.description || ""}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
