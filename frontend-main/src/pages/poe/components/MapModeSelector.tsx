import { Icon } from "@iconify/react";

export type MapMode = "threat" | "flow" | "capacity" | "corridors" | "all";

interface MapModeSelectorProps {
    currentMode: MapMode;
    onModeChange: (mode: MapMode) => void;
}

interface ModeOption {
    mode: MapMode;
    label: string;
    icon: string;
}

const MODE_OPTIONS: ModeOption[] = [
    {
        mode: "threat",
        label: "Threat",
        icon: "mdi:shield-alert-outline",
    },
    {
        mode: "flow",
        label: "Flow",
        icon: "mdi:transit-connection-variant",
    },
    {
        mode: "capacity",
        label: "Capacity",
        icon: "mdi:hospital-building",
    },
    {
        mode: "corridors",
        label: "Corridors",
        icon: "mdi:map-marker-path",
    },
    {
        mode: "all",
        label: "All Layers",
        icon: "mdi:globe-model",
    },
];

export function MapModeSelector({ currentMode, onModeChange }: MapModeSelectorProps) {
    return (
        <div className="poe-map-modes">
            {MODE_OPTIONS.map((opt) => {
                const isActive = currentMode === opt.mode;
                const btnClass = `poe-map-modes__btn ${isActive ? "poe-map-modes__btn--active" : ""}`;

                return (
                    <button
                        key={opt.mode}
                        className={btnClass}
                        data-mode={opt.mode}
                        onClick={() => onModeChange(opt.mode)}
                        title={`Switch view to ${opt.label} mode`}
                    >
                        <Icon icon={opt.icon} style={{ fontSize: "1.1rem" }} />
                        <span>{opt.label}</span>
                    </button>
                );
            })}
        </div>
    );
}
