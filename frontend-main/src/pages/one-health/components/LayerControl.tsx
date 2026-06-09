interface Props {
  layers: Record<string, boolean>;
  onToggle: (layer: string) => void;
}

const LAYER_CONFIG = [
  { key: "spillover", label: "Spillover Risk", icon: "⬡", bg: "rgba(255,61,90,0.15)", fg: "var(--oh-crimson)" },
  { key: "alerts", label: "Active Alerts", icon: "⚡", bg: "rgba(255,179,71,0.12)", fg: "var(--oh-amber)" },
  { key: "animals", label: "Animal Events", icon: "🐾", bg: "rgba(79,142,247,0.1)", fg: "var(--oh-cobalt)" },
  { key: "environment", label: "Environment", icon: "🌿", bg: "rgba(77,232,160,0.08)", fg: "var(--oh-sage)" },
  { key: "epilinks", label: "Epi-Links", icon: "⟷", bg: "var(--oh-aqua-glow)", fg: "var(--oh-aqua)" },
  { key: "spar", label: "IHR SPAR Layer", icon: "◎", bg: "rgba(79,142,247,0.1)", fg: "var(--oh-cobalt)" },
];

export default function LayerControl({ layers, onToggle }: Props) {
  return (
    <div className="absolute top-12 left-3 z-[500] flex flex-col gap-1.5">
      {LAYER_CONFIG.map((cfg) => {
        const isOn = layers[cfg.key] === true;
        return (
          <button
            key={cfg.key}
            onClick={() => onToggle(cfg.key)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg backdrop-blur-2xl w-[180px] transition-all duration-150 border shadow-sm ${isOn
              ? "border-[var(--oh-aqua2)] bg-teal-500/20"
              : "border-[var(--oh-border2)] bg-[var(--oh-glass)] hover:border-[var(--oh-aqua)] hover:bg-[var(--oh-aqua-faint)]"
              }`}
          >
            <div
              className="w-5 h-5 rounded flex items-center justify-center text-[11px] shrink-0 shadow-inner"
              style={{ background: cfg.bg, color: cfg.fg }}
            >
              {cfg.icon}
            </div>
            <span
              className={`flex-1 text-left text-[11.5px] font-bold ${isOn ? "text-[#004d40]" : "text-[var(--oh-text2)]"
                }`}
            >
              {cfg.label}
            </span>
            <div
              className={`w-[26px] h-[14px] rounded-full relative transition-colors duration-200 shrink-0 ${isOn ? "bg-[var(--oh-aqua)]" : "bg-[var(--oh-ink4)]"
                }`}
            >
              <div
                className={`absolute w-[10px] h-[10px] rounded-full bg-white top-[2px] transition-all duration-200 ${isOn ? "left-[14px]" : "left-[2px]"
                  }`}
              />
            </div>
          </button>
        );
      })}
    </div>
  );
}
