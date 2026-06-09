import { useEffect, useRef } from 'react';
import Globe from 'globe.gl';

interface RegionalSignal {
    lat: number;
    lng: number;
    region: string;
    signals: string[];
}

interface Globe3DProps {
    data?: any[];
    onCountryClick?: (country: any) => void;
}

const REGIONAL_SIGNALS: RegionalSignal[] = [
    {
        lat: 9.5,
        lng: -3,
        region: "Western Africa",
        signals: [
            "Cholera risk signals – Western Africa (next 2–3 months)",
            "Flood-related preparedness pressure",
            "Seasonal malaria transmission context"
        ]
    },
    {
        lat: 0,
        lng: 18,
        region: "Central Africa",
        signals: [
            "Flood and displacement-related preparedness signals",
            "Cholera and WASH-related risk context",
            "Health system access constraints"
        ]
    },
    {
        lat: -2,
        lng: 38,
        region: "Eastern Africa",
        signals: [
            "Climate-sensitive health risk signals",
            "Cholera and AWD preparedness context",
            "Nutrition and health service pressure signals"
        ]
    },
    {
        lat: 10,
        lng: 43,
        region: "Horn of Africa",
        signals: [
            "Vector-borne disease seasonality emerging",
            "Climate variability and health risk context",
            "Health system capacity stress signals"
        ]
    },
    {
        lat: -22,
        lng: 25,
        region: "Southern Africa",
        signals: [
            "Cholera preparedness signals",
            "Flood-related operational pressure",
            "Urban service delivery and WASH context"
        ]
    }
];

export default function Globe3D({ data, onCountryClick }: Globe3DProps) {
    const globeContainerRef = useRef<HTMLDivElement>(null);
    const globeInstanceRef = useRef<any>(null);

    useEffect(() => {
        if (!globeContainerRef.current) return;

        let resizeHandler: () => void;
        let isCancelled = false;

        const initTimer = setTimeout(() => {
            if (isCancelled || !globeContainerRef.current) return;

            const globe = new Globe(globeContainerRef.current);

            const regionColors: Record<string, string> = {
                "Western Africa": "#10b981",
                "Central Africa": "#3b82f6",
                "Eastern Africa": "#8b5cf6",
                "Horn of Africa": "#f59e0b",
                "Southern Africa": "#ef4444"
            };

        globe
            .globeImageUrl('//unpkg.com/three-globe/example/img/earth-night.jpg')
            .bumpImageUrl('//unpkg.com/three-globe/example/img/earth-topology.png')
            .backgroundImageUrl('//unpkg.com/three-globe/example/img/night-sky.png')
            .width(globeContainerRef.current.clientWidth)
            .height(globeContainerRef.current.clientHeight)
            .enablePointerInteraction(true)
            .pointsData(REGIONAL_SIGNALS)
            .pointLat((d: any) => d.lat)
            .pointLng((d: any) => d.lng)
            .pointColor((d: any) => regionColors[d.region] || '#10b981')
            .pointAltitude(0.01)
            .pointRadius(0.4)
            .htmlElementsData(REGIONAL_SIGNALS)
            .htmlLat((d: any) => d.lat)
            .htmlLng((d: any) => d.lng)
            .htmlAltitude(0.04)
            .htmlElement((d: any) => {
                const signal = d as RegionalSignal;
                const color = regionColors[signal.region] || "#10b981";

                const el = document.createElement('div');
                el.className = 'globe-region-card';
                el.style.cssText = `
                    pointer-events: auto;
                    cursor: pointer;
                `;
                el.innerHTML = `
                    <div style="display: flex; flex-direction: column; align-items: center;">

                        <div class="card-inner" style="
                            display: flex;
                            align-items: flex-start;
                            gap: 10px;
                            padding: 10px 14px;
                            background: rgba(0, 0, 0, 0.75);
                            backdrop-filter: blur(12px);
                            border: 1px solid ${color}50;
                            border-bottom: 3px solid ${color};
                            border-radius: 8px;
                            max-width: 200px;
                            transition: all 0.2s ease;
                        "
                        onmouseover="this.style.background='rgba(0, 0, 0, 0.9)'; this.style.borderColor='${color}';"
                        onmouseout="this.style.background='rgba(0, 0, 0, 0.75)'; this.style.borderColor='${color}50';">
                            <div style="flex: 1;">

                                <div style="
                                    color: #ffffff;
                                    font-size: 13px;
                                    font-weight: 600;
                                    margin-bottom: 4px;
                                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                                ">${signal.region}</div>

                                <div style="
                                    color: rgba(255, 255, 255, 0.7);
                                    font-size: 11px;
                                    line-height: 1.4;
                                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                                ">${signal.signals[0]}</div>
                            </div>
                        </div>

                        <div style="
                            width: 2px;
                            height: 15px;
                            background: linear-gradient(to bottom, ${color}, transparent);
                        "></div>
                    </div>
                `;
                return el;
            });

        globeInstanceRef.current = globe;

        globe.pointOfView({ lat: 5, lng: -60, altitude: 2.5 }, 0);

        const controls = globe.controls();
        controls.autoRotate = true;
        controls.autoRotateSpeed = 0.8;
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;

        setTimeout(() => {
            controls.autoRotateSpeed = 0.4;
        }, 800);

        setTimeout(() => {
            controls.autoRotateSpeed = 0.15;
        }, 1400);

        setTimeout(() => {
            controls.autoRotateSpeed = 0.02;
            globe.pointOfView({ lat: 0, lng: 20, altitude: 1.5 }, 1200);
        }, 2000);

        const updateCardScales = () => {
            const altitude = globe.pointOfView().altitude;
            const scaleFactor = Math.min(Math.max(altitude / 1.8, 0.7), 1.8);
            document.querySelectorAll('.globe-region-card').forEach((el) => {
                (el as HTMLElement).style.transform = `scale(${scaleFactor})`;
            });
        };

        controls.addEventListener('change', updateCardScales);
        updateCardScales();

        resizeHandler = () => {
            if (globeContainerRef.current && globeInstanceRef.current) {
                globeInstanceRef.current
                    .width(globeContainerRef.current.clientWidth)
                    .height(globeContainerRef.current.clientHeight);
            }
        };

        window.addEventListener('resize', resizeHandler);
        }, 100);

        return () => {
            isCancelled = true;
            clearTimeout(initTimer);
            if (resizeHandler) window.removeEventListener('resize', resizeHandler);
            if (globeInstanceRef.current) {
                globeInstanceRef.current._destructor?.();
                globeInstanceRef.current = null;
            }
        };
    }, []);

    useEffect(() => {
        if (globeInstanceRef.current && data) {
        }
    }, [data]);

    return (
        <>

            <div
                ref={globeContainerRef}
                className="w-full h-full"
                style={{
                    background: '#000011',
                    position: 'relative'
                }}
            />
            <style>{`
                @keyframes pulse {
                    0%, 100% {
                        opacity: 1;
                        transform: scale(1);
                    }
                    50% {
                        opacity: 0.6;
                        transform: scale(1.2);
                    }
                }
                .globe-region-card {
                    transition: transform 0.2s ease-out;
                }
            `}</style>
        </>
    );
}
