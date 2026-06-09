export default function MapLegend() {
  return (
    <div
      className="absolute left-3 z-[500] oh-glass-card px-3 py-2.5 w-[200px]"
      style={{ bottom: "260px" }}
    >
      {/* Title */}
      <div className="font-mono text-[8.5px] text-white tracking-widest uppercase mb-2">
        Spillover Risk Index
      </div>

      {/* Gradient bar */}
      <div
        className="h-2 rounded mb-1.5"
        style={{
          background: "linear-gradient(90deg, #0d1a27, #1a4a6b, #0fa896, #f5c842, #ff3d5a)",
        }}
      />
      <div className="flex justify-between font-mono text-[8px] text-white mb-2">
        <span>Low (0)</span>
        <span>Moderate</span>
        <span>High (10)</span>
      </div>

      <hr className="border-[var(--oh-border)] my-1.5" />

      {/* Legend items */}
      <div className="space-y-1">
        <div className="flex items-center gap-1.5 text-[10px] text-[var(--oh-text2)]">
          <div className="w-3.5 h-3.5 rounded-full border-[1.5px] border-[var(--oh-crimson)] shrink-0" />
          <span>Tier 4 Alert — Active</span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-[var(--oh-text2)]">
          <div className="w-2.5 h-2.5 rounded-full border-[1.5px] border-[var(--oh-amber)] shrink-0" />
          <span>Tier 3 Alert — Active</span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-[var(--oh-text2)]">
          <div className="w-2.5 h-2.5 rounded-full border-[1.5px] border-[var(--oh-cobalt)] shrink-0" />
          <span>Tier 2 Alert — Monitoring</span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-[var(--oh-text2)]">
          <div className="w-2 h-2 rounded-full bg-[var(--oh-aqua)] shrink-0" />
          <span>Epi-link established</span>
        </div>
      </div>
    </div>
  );
}
