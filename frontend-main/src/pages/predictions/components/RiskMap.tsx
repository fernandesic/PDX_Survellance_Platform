import { useEffect, useState, useMemo, useCallback } from 'react';
import { Map as MapIcon } from 'lucide-react';
import type { CountryRiskData } from '@/pages/predictions/types/predictions';
import { RISK_LEVEL_CONFIG } from '@/pages/predictions/types/predictions';
import { SimpleArcGISMap } from '@/components/maps/SimpleArcGISMap';
import { logger } from "@/utils/logger";

const GEO_URL = "https://raw.githubusercontent.com/johan/world.geo.json/master/countries.geo.json";

const AFRO_COUNTRIES = [
    "Angola", "Benin", "Botswana", "Burkina Faso", "Burundi",
    "Cameroon", "Cape Verde", "Central African Republic", "Chad", "Comoros",
    "Democratic Republic of the Congo", "Republic of the Congo", "Djibouti",
    "Equatorial Guinea", "Eritrea", "Ethiopia", "Gabon", "Gambia",
    "Ghana", "Guinea", "Guinea-Bissau", "Ivory Coast", "Kenya", "Lesotho",
    "Liberia", "Madagascar", "Malawi", "Mali", "Mauritania", "Mauritius",
    "Mozambique", "Namibia", "Niger", "Nigeria", "Rwanda",
    "Sao Tome and Principe", "Senegal", "Seychelles", "Sierra Leone", "Somalia",
    "South Africa", "South Sudan", "Sudan", "Swaziland", "Tanzania",
    "Togo", "Uganda", "Zambia", "Zimbabwe",
    "United Republic of Tanzania", "Somaliland", "Côte d'Ivoire", "eSwatini"
];

interface Props {
    data: CountryRiskData[];
    timeHorizon: '30' | '60' | '90';
    onHorizonChange: (h: '30' | '60' | '90') => void;
    onCountryClick?: (iso: string) => void;
    selectedCountry: string | null;
}

export default function RiskMap({ data, timeHorizon, onHorizonChange, onCountryClick, selectedCountry }: Props) {
    const [geoData, setGeoData] = useState<any>(null);

    useEffect(() => {
        const loadGeoData = async () => {
            try {
                const response = await fetch(GEO_URL);
                const jsonData = await response.json();
                const ALL_AFRICAN_COUNTRIES = [
                    ...AFRO_COUNTRIES,
                    "Egypt", "Libya", "Tunisia", "Algeria", "Morocco"
                ];
                const africaData = {
                    ...jsonData,
                    features: jsonData.features.filter((feature: any) =>
                        ALL_AFRICAN_COUNTRIES.some((name: string) =>
                            feature.properties?.name?.toLowerCase().includes(name.toLowerCase()) ||
                            name.toLowerCase().includes(feature.properties?.name?.toLowerCase() || '')
                        )
                    )
                };
                setGeoData(africaData);
            } catch (error) {
                logger.error("Error loading GeoJSON:", error);
            }
        };
        loadGeoData();
    }, []);

    const countryDataMap = useMemo(() => {
        const map: Record<string, CountryRiskData> = {};
        data.forEach(d => {
            if (d.country_iso) map[d.country_iso] = d;
            if (d.country_name) map[d.country_name.toLowerCase()] = d;
        });
        return map;
    }, [data]);

    const getCountryData = useCallback((feature: any) => {
        const iso = feature?.id || feature?.properties?.iso_a3 || "";
        const name = feature?.properties?.name?.toLowerCase() || "";
        return countryDataMap[iso] || countryDataMap[name] || null;
    }, [countryDataMap]);

    const getCountryStyle = useCallback((feature: any) => {
        const NON_AFRO_COUNTRIES = ['egypt', 'libya', 'tunisia', 'algeria', 'morocco'];
        const name = feature?.properties?.name?.toLowerCase() || "";
        const isNonAFRO = NON_AFRO_COUNTRIES.some(n => name.includes(n));

        if (isNonAFRO) {
            return { fillColor: "transparent", fillOpacity: 0, weight: 0, opacity: 0, color: "transparent" };
        }

        const countryData = getCountryData(feature);
        
        const isSelected = selectedCountry && countryData && (
            selectedCountry === countryData.country_iso ||
            selectedCountry.toLowerCase() === countryData.country_name.toLowerCase()
        );

        return {
            fillColor: isSelected ? "#3b82f6" : "transparent",
            fillOpacity: isSelected ? 0.2 : 0,
            color: "#94a3b8", // darker border so the countries are visible
            weight: isSelected ? 1.5 : 0.8,
            opacity: 0.8,
        };
    }, [getCountryData, selectedCountry]);

    const getMarkerStyle = useCallback((feature: any) => {
        const countryData = getCountryData(feature);
        if (!countryData) return { color: "transparent" };

        const config = RISK_LEVEL_CONFIG[countryData.risk_level];
        // Dynamic dot size
        const size = 12 + (countryData.score / 100) * 12;

        return {
            color: config?.color || "#5c8bd6",
            size: `${size}px`
        };
    }, [getCountryData]);

    return (
        <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 overflow-hidden h-[500px] flex flex-col relative w-full">
            {/* Header */}
            <div className="px-4 py-3 flex items-center gap-2 flex-wrap z-10 bg-[#0d1b2a]">
                <MapIcon size={16} className="text-blue-400" />
                <h3 className="text-sm font-semibold text-white">Risk Map</h3>

                <div className="ml-auto flex gap-1 bg-[#1a2c42] p-1 rounded-md shadow-inner border border-white/5">
                    {(['30', '60', '90'] as const).map(h => (
                        <button
                            key={h}
                            onClick={() => onHorizonChange(h)}
                            className={`px-3 py-1 rounded text-xs font-semibold transition-all ${timeHorizon === h
                                    ? 'bg-blue-500 text-white shadow-md'
                                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                                }`}
                        >
                            {h}d
                        </button>
                    ))}
                </div>
            </div>

            {/* Map Container */}
            <div className="relative flex-1 p-0 overflow-hidden w-full h-[450px]">
                {geoData ? (
                    <SimpleArcGISMap
                        geoData={geoData}
                        getCountryStyle={getCountryStyle}
                        getMarkerStyle={getMarkerStyle}
                        onCountryClick={(attrs: any) => {
                            const feature = geoData.features.find((f: any) => f.properties?.name === attrs?.name);
                            if (feature) {
                                const cData = getCountryData(feature);
                                if (cData && onCountryClick) {
                                    onCountryClick(cData.country_iso);
                                }
                            }
                        }}
                        isLight={true}
                    />
                ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-xs text-slate-400 font-bold uppercase tracking-widest animate-pulse">Initializing Geospatial Data...</span>
                    </div>
                )}
            </div>

            {/* Floating Legend */}
             <div className="absolute bottom-4 left-4 flex gap-3 bg-white/90 p-2.5 rounded-xl shadow-lg border border-slate-200 z-10 backdrop-blur-md">
                {Object.entries(RISK_LEVEL_CONFIG).map(([level, config]) => (
                    <div key={level} className="flex items-center gap-2">
                        <span
                            className="w-3 h-3 rounded-full shadow-inner"
                            style={{ backgroundColor: config.color }}
                        />
                        <span className="text-[11px] text-slate-700 font-bold tracking-wide uppercase">{config.label}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
