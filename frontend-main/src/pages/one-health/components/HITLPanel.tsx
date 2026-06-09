import type { OHHITLAction } from "../services/oneHealth";

interface HITLPanelProps {
  items: OHHITLAction[];
  source: "db" | "loading" | "fallback";
  onApprove?: (actionId: string) => void;
  onDismiss?: (actionId: string) => void;
  onAcknowledge?: (actionId: string) => void;
}

export default function HITLPanel({
  items, source, onApprove, onDismiss, onAcknowledge,
}: HITLPanelProps) {
  const pendingCount = items.length;

  return (
    <div className="oh-glass-card flex-shrink-0 overflow-hidden" style={{ animationDelay: "0.3s" }}>
      {/* Header */}
      <div className="px-3.5 py-2.5 border-b border-[var(--oh-border)] flex items-center justify-between">
        <div className="text-[11.5px] font-semibold text-[var(--oh-text)] flex items-center gap-2">
          <span>Human-in-the-Loop</span>
          <span className="font-mono text-[8px] px-1.5 py-0.5 rounded bg-[var(--oh-amber-glow)] text-[var(--oh-amber)] border border-[rgba(255,179,71,0.25)] tracking-wider uppercase">
            {pendingCount} pending
          </span>
          {source === "loading" && (
            <span className="font-mono text-[8px] text-[var(--oh-text3)]">Loading…</span>
          )}
        </div>
      </div>

      {/* HITL items */}
      <div className="p-2 space-y-1.5">
        {pendingCount === 0 && source !== "loading" && (
          <div className="px-2.5 py-3 text-[10px] text-[var(--oh-text3)] text-center">
            No pending actions — queue is clear.
          </div>
        )}
        {items.map((item) => {
          const isApprove = item.kind === "approve" || item.kind === "review";
          const isAmber = isApprove;
          return (
            <div
              key={item.action_id}
              className="rounded p-2.5 border"
              style={{
                background: isAmber ? "rgba(255,179,71,0.04)" : "rgba(79,142,247,0.03)",
                borderColor: isAmber ? "rgba(255,179,71,0.18)" : "rgba(79,142,247,0.18)",
              }}
            >
              <div
                className="text-[11px] font-semibold mb-1 flex items-center gap-1.5"
                style={{ color: isAmber ? "var(--oh-amber)" : "var(--oh-cobalt)" }}
              >
                {item.title}
              </div>
              <div className="text-[10px] text-[var(--oh-text2)] leading-snug mb-2">
                {item.description}
              </div>
              <div className="flex gap-1.5">
                {isApprove ? (
                  <>
                    <button
                      onClick={() => onApprove?.(item.action_id)}
                      className="flex-1 py-1.5 rounded text-[10px] font-semibold bg-[rgba(77,232,160,0.12)] text-[var(--oh-sage)] border border-[rgba(77,232,160,0.22)] hover:bg-[rgba(77,232,160,0.2)] transition-colors cursor-pointer"
                    >
                      ✓ Approve
                    </button>
                    <button
                      onClick={() => onDismiss?.(item.action_id)}
                      className="flex-1 py-1.5 rounded text-[10px] font-semibold bg-[rgba(255,255,255,0.04)] text-[var(--oh-text2)] border border-[var(--oh-border2)] hover:border-[var(--oh-aqua)] hover:text-[var(--oh-aqua)] transition-colors cursor-pointer"
                    >
                      Dismiss
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => onAcknowledge?.(item.action_id)}
                      className="flex-1 py-1.5 rounded text-[10px] font-semibold bg-[rgba(79,142,247,0.1)] text-[var(--oh-cobalt)] border border-[rgba(79,142,247,0.2)] hover:bg-[rgba(79,142,247,0.2)] transition-colors cursor-pointer"
                    >
                      Acknowledge
                    </button>
                    <button
                      onClick={() => onDismiss?.(item.action_id)}
                      className="flex-1 py-1.5 rounded text-[10px] font-semibold bg-[rgba(255,255,255,0.04)] text-[var(--oh-text2)] border border-[var(--oh-border2)] hover:border-[var(--oh-aqua)] hover:text-[var(--oh-aqua)] transition-colors cursor-pointer"
                    >
                      Dismiss
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
