export interface Alert {
  alert_id?: string;
  tier: number;
  disease: string;
  country: string;
  district?: string;
  note: string;
  ihr?: boolean;
  woah?: boolean;
  status?: string;
}

interface AlertFeedProps {
  alerts: Alert[];
  source: "db" | "static" | "loading";
  onOpenDetail?: (alertId: string) => void;
}

const TIER_STYLE: Record<number, string> = {
  4: "oh-tier-4",
  3: "oh-tier-3",
  2: "oh-tier-2",
  1: "oh-tier-1",
};

export default function AlertFeed({ alerts, source, onOpenDetail }: AlertFeedProps) {
  const isDb = source === "db";
  const isLoading = source === "loading";
  const badgeText = isDb ? "LIVE DB" : isLoading ? "Loading…" : "Static";

  return (
    <div className="oh-glass-card flex-shrink-0 overflow-hidden">
      {/* Header */}
      <div className="px-3.5 py-2.5 border-b border-[var(--oh-border)] flex items-center justify-between">
        <div className="text-[11.5px] font-semibold text-[var(--oh-text)] flex items-center gap-2">
          <span>Active Alert Feed</span>
          <span
            className="font-mono text-[8px] px-1.5 py-0.5 rounded tracking-wider uppercase"
            style={{
              background: isDb ? "var(--oh-sage-glow)" : "var(--oh-amber-dim)",
              color: isDb ? "var(--oh-sage)" : "var(--oh-amber)",
              border: `1px solid ${isDb ? "rgba(77,232,160,0.2)" : "rgba(245,185,66,0.25)"}`,
            }}
          >
            {badgeText}
          </span>
        </div>
        <span className="font-mono text-[9px] text-[var(--oh-text3)] cursor-pointer hover:text-[var(--oh-aqua)] tracking-wider transition-colors">
          {alerts.length} alerts →
        </span>
      </div>

      {/* Alert list */}
      <div className="px-2 py-1.5 max-h-[240px] overflow-y-auto oh-scroll">
        {alerts.map((a, i) => (
          <div
            key={a.alert_id || `${a.country}-${a.disease}-${i}`}
            className="flex items-start gap-2 px-1.5 py-2 rounded cursor-pointer transition-colors hover:bg-[rgba(255,255,255,0.03)] border-b border-[var(--oh-border)] last:border-b-0"
            onClick={() => a.alert_id && onOpenDetail?.(a.alert_id)}
            title="Click for details"
          >
            <div
              className={`w-[22px] h-[22px] rounded-md flex items-center justify-center font-serif text-[10px] font-bold shrink-0 mt-0.5 ${
                TIER_STYLE[a.tier] || TIER_STYLE[1]
              }`}
            >
              {a.tier}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[11.5px] font-semibold text-[var(--oh-text)] truncate">
                {a.disease} — {a.country}
              </div>
              <div className="text-[10px] text-[var(--oh-text3)] font-mono flex items-center gap-1.5 flex-wrap">
                <span>{a.note}</span>
                {a.ihr && (
                  <span className="oh-tag-ihr text-[8.5px] px-1 py-px rounded">IHR</span>
                )}
                {a.woah && (
                  <span className="oh-tag-zoonotic text-[8.5px] px-1 py-px rounded">WOAH</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
