import { useEffect, useState } from "react";
import { Icon } from "@iconify/react";

interface AnimatedCounterProps {
    value: number;
    duration?: number;
}

function AnimatedCounter({ value, duration = 800 }: AnimatedCounterProps) {
    const [count, setCount] = useState(0);

    useEffect(() => {
        let startTimestamp: number | null = null;
        const step = (timestamp: number) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            setCount(Math.floor(progress * value));
            if (progress < 1) {
                window.requestAnimationFrame(step);
            } else {
                setCount(value);
            }
        };
        window.requestAnimationFrame(step);
    }, [value, duration]);

    return <span>{count.toLocaleString()}</span>;
}

interface IntelligenceCardsProps {
    ihrStats: Record<string, number> | null;
    onCardClick?: (key: string) => void;
    isLoading: boolean;
}

interface CardConfig {
    key: string;
    label: string;
    icon: string;
    tone: "red" | "amber" | "green" | "blue" | "teal";
    subText: string;
}

const CARDS_CONFIG: CardConfig[] = [
    {
        key: "outbreak_news",
        label: "Outbreak Alerts",
        icon: "mdi:alert-circle-outline",
        tone: "red",
        subText: "WHO verified alerts",
    },
    {
        key: "airports",
        label: "Airports Monitored",
        icon: "mdi:airplane",
        tone: "teal",
        subText: "IHR designated airports",
    },
    {
        key: "seaports",
        label: "Seaports Monitored",
        icon: "mdi:anchor",
        tone: "blue",
        subText: "Commercial & humanitarian ports",
    },
    {
        key: "border_crossings",
        label: "Border Crossings",
        icon: "mdi:shield-check-outline",
        tone: "green",
        subText: "Official designated points",
    },
    {
        key: "inland_ports",
        label: "Inland Ports",
        icon: "mdi:ferry",
        tone: "amber",
        subText: "River container & lake terminals",
    },
    {
        key: "informal_crossings",
        label: "Informal Crossings",
        icon: "mdi:map-marker-path",
        tone: "amber",
        subText: "OSM unofficial road crossings",
    },
    {
        key: "corridor_hotspots",
        label: "Corridor Hotspots",
        icon: "mdi:fire",
        tone: "red",
        subText: "ACLED border conflicts (10km)",
    },
    {
        key: "anim_movement_flows",
        label: "Movement Flows",
        icon: "mdi:swap-horizontal",
        tone: "blue",
        subText: "Aggregated flow routes",
    },
];

export function IntelligenceCards({ ihrStats, onCardClick, isLoading }: IntelligenceCardsProps) {
    return (
        <div className="poe-kpi-grid">
            {CARDS_CONFIG.map((card) => {
                const countVal = ihrStats ? (ihrStats[card.key] !== undefined ? ihrStats[card.key] : -1) : 0;
                const cardClass = `poe-card poe-card--${card.tone}`;

                return (
                    <div
                        key={card.key}
                        className={cardClass}
                        onClick={() => onCardClick?.(card.key)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                                onCardClick?.(card.key);
                            }
                        }}
                    >
                        <div className="poe-card__head">
                            <span className="poe-card__label">{card.label}</span>
                            <div className="poe-card__icon">
                                <Icon icon={card.icon} />
                            </div>
                        </div>

                        <div>
                            <div className="poe-card__value" style={countVal < 0 ? { fontSize: "1.1rem", color: "var(--poe-text-muted)", letterSpacing: "0.2px" } : {}}>
                                {isLoading || ihrStats === null ? (
                                    <span className="poe-shimmer" style={{ width: "80px", height: "30px", display: "block" }} />
                                ) : countVal < 0 ? (
                                    <span>Unavailable</span>
                                ) : (
                                    <AnimatedCounter value={countVal} />
                                )}
                            </div>
                            <div className="poe-card__sub">{card.subText}</div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
