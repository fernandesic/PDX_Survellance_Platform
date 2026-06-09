import { useEffect, useState } from "react";
import { Icon } from "@iconify/react";

interface AnimatedCounterProps {
    value: number;
    duration?: number;
    suffix?: string;
}

function AnimatedCounter({ value, duration = 800, suffix = "" }: AnimatedCounterProps) {
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

    return (
        <span>
            {count.toLocaleString()}
            {suffix}
        </span>
    );
}

interface SurveillanceBannerProps {
    totalAirports: number;
    totalSeaports: number;
    totalInlandPorts: number;
    totalOfficialCrossings: number;
    totalInformalCrossings: number;
    donAlerts: number;
    criticalCorridors: number;
    highCorridors: number;
    mediumCorridors: number;
    isLoading: boolean;
}

export function SurveillanceBanner({
    totalAirports,
    totalSeaports,
    totalInlandPorts,
    totalOfficialCrossings,
    totalInformalCrossings,
    donAlerts,
    criticalCorridors,
    highCorridors,
    mediumCorridors,
    isLoading,
}: SurveillanceBannerProps) {
    return (
        <div className="poe-banner">
            <div className="poe-banner__header">
                <div className="poe-banner__title-group">
                    <h1 className="poe-banner__title">
                        <Icon icon="mdi:shield-check-outline" style={{ color: "var(--poe-green)" }} />
                        IHR Points of Entry — AFRO Surveillance
                    </h1>
                    <p className="poe-banner__subtitle">
                        International Health Regulations (2005) · Public Health Intelligence Command Center
                    </p>
                </div>
                <div className="poe-banner__status">
                    <div className="poe-banner__pulse" />
                    <span>Active Surveillance Live</span>
                </div>
            </div>

            <div className="poe-banner__body">
                <div className="poe-banner__counters">
                    <div className="poe-banner__counter">
                        <Icon icon="mdi:airplane" className="poe-banner__counter-icon" style={{ color: "hsl(340, 80%, 65%)" }} />
                        <div className="poe-banner__counter-details">
                            <span className="poe-banner__counter-value">
                                {isLoading ? (
                                    <span className="poe-shimmer" style={{ width: "40px", height: "16px", display: "inline-block" }} />
                                ) : (
                                    <AnimatedCounter value={totalAirports} suffix="+" />
                                )}
                            </span>
                            <span className="poe-banner__counter-label">Airports</span>
                        </div>
                    </div>

                    <div className="poe-banner__counter">
                        <Icon icon="mdi:anchor" className="poe-banner__counter-icon" style={{ color: "var(--poe-blue)" }} />
                        <div className="poe-banner__counter-details">
                            <span className="poe-banner__counter-value">
                                {isLoading ? (
                                    <span className="poe-shimmer" style={{ width: "30px", height: "16px", display: "inline-block" }} />
                                ) : (
                                    <AnimatedCounter value={totalSeaports} />
                                )}
                            </span>
                            <span className="poe-banner__counter-label">Seaports</span>
                        </div>
                    </div>

                    <div className="poe-banner__counter">
                        <Icon icon="mdi:ferry" className="poe-banner__counter-icon" style={{ color: "hsl(270, 70%, 65%)" }} />
                        <div className="poe-banner__counter-details">
                            <span className="poe-banner__counter-value">
                                {isLoading ? (
                                    <span className="poe-shimmer" style={{ width: "30px", height: "16px", display: "inline-block" }} />
                                ) : (
                                    <AnimatedCounter value={totalInlandPorts} />
                                )}
                            </span>
                            <span className="poe-banner__counter-label">Inland Ports</span>
                        </div>
                    </div>

                    <div className="poe-banner__counter">
                        <Icon icon="mdi:office-building-marker" className="poe-banner__counter-icon" style={{ color: "hsl(210, 80%, 55%)" }} />
                        <div className="poe-banner__counter-details">
                            <span className="poe-banner__counter-value">
                                {isLoading ? (
                                    <span className="poe-shimmer" style={{ width: "45px", height: "16px", display: "inline-block" }} />
                                ) : (
                                    <AnimatedCounter value={totalOfficialCrossings} suffix="+" />
                                )}
                            </span>
                            <span className="poe-banner__counter-label">Official Ground</span>
                        </div>
                    </div>

                    <div className="poe-banner__counter">
                        <Icon icon="mdi:walk" className="poe-banner__counter-icon" style={{ color: "var(--poe-teal)" }} />
                        <div className="poe-banner__counter-details">
                            <span className="poe-banner__counter-value">
                                {isLoading ? (
                                    <span className="poe-shimmer" style={{ width: "50px", height: "16px", display: "inline-block" }} />
                                ) : (
                                    <AnimatedCounter value={totalInformalCrossings} suffix="+" />
                                )}
                            </span>
                            <span className="poe-banner__counter-label">Informal Corridors</span>
                        </div>
                    </div>
                </div>

                <div className="poe-banner__alerts-summary">
                    <div className="poe-banner__alert-pill poe-banner__alert-pill--red">
                        <Icon icon="mdi:alert-circle-outline" style={{ fontSize: "1.1rem" }} />
                        <span>
                            {isLoading ? "—" : donAlerts}{" "}
                            DON Alerts Near PoEs
                        </span>
                    </div>

                    <div className="poe-banner__alert-pill poe-banner__alert-pill--amber">
                        <Icon icon="mdi:alert-outline" style={{ fontSize: "1.1rem" }} />
                        <span>
                            {isLoading ? "—" : criticalCorridors} Critical ·{" "}
                            {isLoading ? "—" : highCorridors} High ·{" "}
                            {isLoading ? "—" : mediumCorridors} Medium Risk Corridors
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
