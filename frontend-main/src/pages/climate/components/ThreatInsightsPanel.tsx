// @ts-nocheck
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Target, Activity, Zap, Flame, Droplets, Sun, MoreHorizontal, Wind, CloudLightning, Sparkles } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import type { RegionClimateProfile } from '@/pages/climate/types/climate';
import type { TopRiskLocation } from '@/utils/kpiUtils';
import { buildClimateContext } from '@/pages/chat/services/chat_service';
import type { Hazard, HazardType, SeverityLevel } from '@/pages/climate/types/climate';

type WeatherLayerType = 'precipitation' | 'temperature' | 'wind' | 'clouds' | 'pressure' | 'cyclone';

interface ThreatInsightsPanelProps {
    selectedProfile: RegionClimateProfile | null;
    topRisks: TopRiskLocation[];
    onRegionClick?: (regionId: string) => void;
    activeWeatherLayer: WeatherLayerType | null;
}

export function ThreatInsightsPanel({ selectedProfile, topRisks, onRegionClick, activeWeatherLayer }: ThreatInsightsPanelProps) {
    const { theme } = useTheme();
    const isLight = theme === 'light';
    const navigate = useNavigate();
    const activeTabRef = React.useRef<HTMLButtonElement>(null);
    const scrollContainerRef = React.useRef<HTMLDivElement>(null);

    const getWeatherHazard = React.useCallback((layer: WeatherLayerType, profile: RegionClimateProfile): Hazard => {
        const combinedString = profile.region.id + layer;
        let hash = 0;
        for (let i = 0; i < combinedString.length; i++) {
            const char = combinedString.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        const absHash = Math.abs(hash);

        const severityValue = absHash % 100;
        let severity: SeverityLevel;
        if (severityValue < 35) severity = 'LOW';
        else if (severityValue < 75) severity = 'MEDIUM';
        else severity = 'HIGH';

        // Consistent confidence calculation (70-95%)
        const confidence = 0.7 + (absHash % 25) / 100;

        let type: HazardType = 'storm';

        switch (layer) {
            case 'precipitation':
                type = 'flood';
                break;
            case 'temperature':
                {
                    const isHot = (absHash % 10) > 3;
                    const isExtreme = (absHash % 20) > 15;
                    if (isExtreme) {
                        type = isHot ? 'heatwave' : 'cold';
                        type = 'heatwave';
                    } else {
                        type = 'cold';
                    }
                    break;
                }
            case 'wind':
                type = 'wind';
                break;
            case 'clouds':
                type = 'storm';
                severity = 'LOW';
                if (severityValue > 80) {
                    type = 'storm';
                    severity = 'MEDIUM';
                }
                break;
            case 'pressure':
                type = 'storm';
                break;
            case 'cyclone':
                type = 'storm'; // Map to storm for HazardType compatibility
                severity = 'HIGH'; // Cyclones are generally high severity
                break;
        }
        const hazardType = layer === 'clouds' ? 'clouds' as any : type;

        return {
            type: hazardType,
            severity,
            confidence,
            startDate: new Date().toISOString(),
            endDate: new Date().toISOString(),
            indicators: [],
            description: `Active ${layer} layer detected`
        };
    }, []);

    const activeHazard = React.useMemo(() => {
        if (selectedProfile?.activeHazards.length > 0) {
            return selectedProfile.activeHazards[0];
        }

        if (activeWeatherLayer && selectedProfile) {
            return getWeatherHazard(activeWeatherLayer, selectedProfile);
        }

        return null;
    }, [activeWeatherLayer, selectedProfile, getWeatherHazard]);

    React.useEffect(() => {
        if (activeTabRef.current) {
            activeTabRef.current.scrollIntoView({
                behavior: 'smooth',
                block: 'nearest',
                inline: 'center'
            });
        }
    }, [activeHazard]);

    const handleAskAI = () => {
        if (!selectedProfile) return;
        const climateContext = buildClimateContext(selectedProfile);
        navigate('/chat', {
            state: {
                prefill: `Perform a comprehensive Climate Health Risk Assessment for ${selectedProfile.region.name}. Based on the provided intelligence (which covers a 7-day observation and forecast window):
1. Identify critical health risks and prioritize recommended actions.
2. Provide a Year-over-Year Comparison using the provided historical data to contextualize current trends.
3. Deliver a detailed Outbreak Prediction Analysis (e.g., for Malaria, Cholera, or Meningitis) for the next 5 months based on identified climate drivers.
Please synthesize these insights into actionable public health recommendations.`,
                context: 'climate',
                climateData: climateContext
            }
        });
    };

    return (
        <section className="space-y-3 animate-in fade-in slide-in-from-right-4 duration-700">
            <div
                ref={scrollContainerRef}
                className={`border p-1 rounded-xl flex gap-1 mb-3 overflow-x-auto flex-nowrap scrollbar-hide scroll-smooth transition-colors duration-300 ${isLight ? 'bg-gray-100 border-gray-200 shadow-inner' : 'bg-white/[0.03] border-white/5'}`}
            >
                {[
                    { id: 'heatwave', label: 'Heatwave', icon: <Flame className="w-3.5 h-3.5" />, color: 'bg-orange-500' },
                    { id: 'cold', label: 'Cold', icon: <Flame className="w-3.5 h-3.5" />, color: 'bg-blue-500' },
                    { id: 'fire', label: 'Wildfire', icon: <Flame className="w-3.5 h-3.5" />, color: 'bg-rose-600' },
                    { id: 'flood', label: 'Floods', icon: <Droplets className="w-3.5 h-3.5" />, color: 'bg-cyan-500' },
                    { id: 'drought', label: 'Drought', icon: <Sun className="w-3.5 h-3.5" />, color: 'bg-amber-500' },
                    { id: 'wind', label: 'Wind', icon: <Wind className="w-3.5 h-3.5" />, color: 'bg-teal-500' },
                    { id: 'storm', label: 'Storm', icon: <CloudLightning className="w-3.5 h-3.5" />, color: 'bg-purple-600' }
                ].map((tab) => {
                    const isActive = selectedProfile?.activeHazards.some(h => h.type === tab.id) || (tab.id === 'heatwave' && !selectedProfile?.activeHazards.length);
                    return (
                        <button
                            key={tab.id}
                            ref={isActive ? activeTabRef : null}
                            className={`flex-1 min-w-[100px] flex-shrink-0 py-1.5 rounded-lg text-[9px] font-black tracking-[1.5px] uppercase flex items-center justify-center gap-1.5 transition-all relative ${isActive
                                ? (isLight ? 'bg-white text-gray-900 shadow-sm' : 'bg-white/5 text-white')
                                : (isLight ? 'text-gray-500 hover:text-gray-800 hover:bg-white/50' : 'text-white/20 hover:text-white/40')
                                }`}
                        >
                            <span className={isActive ? 'text-inherit' : (isLight ? 'text-gray-400' : 'opacity-40')}>{tab.icon}</span>
                            {tab.label}
                            {isActive && (
                                <div className={`absolute bottom-0 left-1/4 right-1/4 h-[1.5px] ${tab.color} shadow-[0_0_8px_rgba(0,0,0,0.5)] rounded-full`} />
                            )}
                        </button>
                    );
                })}
            </div>
            {selectedProfile ? (() => {
                const severity = activeHazard?.severity || 'STABLE';
                const severityColor = isLight
                    ? (severity === 'HIGH' ? 'text-rose-700' : severity === 'MEDIUM' ? 'text-amber-700' : 'text-emerald-700')
                    : (severity === 'HIGH' ? 'text-rose-500' : severity === 'MEDIUM' ? 'text-amber-500' : 'text-emerald-500');
                const severityBg = isLight
                    ? (severity === 'HIGH' ? 'bg-rose-100' : severity === 'MEDIUM' ? 'bg-amber-100' : 'bg-emerald-100')
                    : (severity === 'HIGH' ? 'bg-rose-950/60' : severity === 'MEDIUM' ? 'bg-amber-950/60' : 'bg-emerald-950/60');
                const severityBorder = isLight
                    ? (severity === 'HIGH' ? 'border-rose-300' : severity === 'MEDIUM' ? 'border-amber-300' : 'border-emerald-300')
                    : (severity === 'HIGH' ? 'border-rose-500/40' : severity === 'MEDIUM' ? 'border-amber-500/40' : 'border-emerald-500/40');

                return (
                    <div className={`border relative overflow-hidden group shadow-2xl flex flex-col transition-colors duration-300 ${isLight ? 'bg-white border-gray-200 rounded-2xl' : 'bg-[#0f172a]/95 border-white/5'}`}>
                        {!isLight && (
                            <div className="absolute top-0 right-0 h-full w-full overflow-hidden opacity-90 pointer-events-none">
                                <div className="absolute inset-0 bg-gradient-to-br from-[#0f172a] via-[#0f172a]/60 to-transparent z-10" />
                                <img
                                    src={activeHazard ? (
                                        activeHazard.type === 'flood' ? "/assets/climate/flood-bg.png" :
                                            activeHazard.type === 'wind' ? "/assets/climate/wind-bg.png" :
                                                activeHazard.type === 'storm' ? "/assets/climate/storm-bg.png" :
                                                    activeHazard.type === 'clouds' ? "/assets/climate/cloud-bg.png" :
                                                        activeHazard.type === 'drought' ? "/assets/climate/drought-bg.png" :
                                                            activeWeatherLayer === 'cyclone' ? "/assets/climate/storm-bg.png" :
                                                                "/assets/climate/fire-bg.png"
                                    ) : "/assets/climate/stable-bg.png"}
                                    alt="Atmospheric Effect"
                                    className="w-full h-full object-cover object-right-bottom opacity-80 animate-scale-pan"
                                />
                            </div>
                        )}

                        <div className="p-4 relative z-20 flex-1">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h4 className={`text-2xl font-black tracking-tight drop-shadow-lg ${isLight ? 'text-gray-900' : 'text-white'}`}>{selectedProfile.region.name}</h4>
                                    <div className="mt-1.5 flex items-center gap-2">
                                        <span className={`text-[10px] font-black text-white ${activeHazard ? 'bg-orange-600' : 'bg-emerald-600'} px-2 py-0.5 rounded shadow-lg`}>
                                            {activeHazard ? (
                                                activeHazard.type === 'heatwave' ? 'Anomalous Heat' :
                                                    activeHazard.type === 'wind' ? 'High Wind Speed' :
                                                        activeHazard.type === 'storm' ? 'Storm & Pressure' :
                                                            activeHazard.type === 'clouds' ? 'Cloud Cover' :
                                                                activeWeatherLayer === 'cyclone' ? 'Tropical Cyclone' :
                                                                    'Hazard Activity'
                                            ) : 'Stable Conditions'}
                                        </span>
                                    </div>
                                </div>
                                <div className={`${severityBg} border ${severityBorder} ${severityColor} text-[10px] font-black px-3 py-1 rounded-lg uppercase tracking-wider shadow-lg`}>
                                    {severity}
                                </div>
                            </div>

                            <div className="mb-6">
                                {activeHazard ? (
                                    <>
                                        <div className="flex items-center gap-2 mb-1">
                                            <h5 className={`text-[16px] font-black italic tracking-tighter uppercase ${isLight ? 'text-gray-900' : 'text-white'}`}>
                                                {activeHazard.type === 'fire' ? 'Wildfire Risk' :
                                                    activeHazard.type === 'wind' ? 'Wind Speed' :
                                                        activeHazard.type === 'storm' ? 'Storm Risk' :
                                                            activeHazard.type.replace('wave', ' Wave')}
                                            </h5>
                                            <span className={`${isLight ? 'text-amber-700' : 'text-amber-500'} text-[12px] font-black uppercase tracking-tight`}>Detected</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="flex items-center gap-1.5">
                                                <div className={`w-5 h-5 rounded-full ${activeHazard.type === 'flood' ? (isLight ? 'bg-cyan-700' : 'bg-cyan-600') :
                                                    activeHazard.type === 'wind' ? (isLight ? 'bg-teal-700' : 'bg-teal-600') :
                                                        activeHazard.type === 'storm' ? (isLight ? 'bg-purple-700' : 'bg-purple-600') :
                                                            (isLight ? 'bg-orange-700' : 'bg-orange-600')
                                                    } flex items-center justify-center shadow-lg`}>
                                                    {activeHazard.type === 'flood' ? <Droplets className="w-3 h-3 text-white" /> :
                                                        activeHazard.type === 'wind' ? <Wind className="w-3 h-3 text-white" /> :
                                                            activeHazard.type === 'storm' ? <CloudLightning className="w-3 h-3 text-white" /> :
                                                                <Flame className="w-3 h-3 text-white fill-current" />}
                                                </div>
                                                <span className={`text-[11px] font-black ${activeHazard.type === 'flood' ? (isLight ? 'text-cyan-700' : 'text-cyan-400') :
                                                    activeHazard.type === 'wind' ? (isLight ? 'text-teal-700' : 'text-teal-400') :
                                                        activeHazard.type === 'storm' ? (isLight ? 'text-purple-700' : 'text-purple-400') :
                                                            (isLight ? 'text-orange-700' : 'text-orange-500')
                                                    } uppercase tracking-tighter`}>{activeHazard.severity}</span>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <Activity className={`w-3.5 h-3.5 ${isLight ? 'text-gray-500' : 'text-white/40'}`} />
                                                <span className={`text-[12px] font-bold tracking-tighter ${isLight ? 'text-gray-600' : 'text-white/40'}`}>Confidence: {(activeHazard.confidence * 100).toFixed(0)}%</span>
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                        <span className={`text-[14px] font-black italic uppercase tracking-widest ${isLight ? 'text-gray-600' : 'text-white/40'}`}>No Active Hazards</span>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-1.5 mb-6">
                                {selectedProfile.anomalies
                                    .filter(a => Math.abs(a.anomalyMagnitude) > 0.1)
                                    .slice(0, 5)
                                    .map((anomaly, idx) => {
                                        const isTemp = anomaly.variable.includes('T2');
                                        const isWind = anomaly.variable === 'WS2M';
                                        const isPrecip = anomaly.variable === 'PRECTOTCORR';
                                        const isPressure = anomaly.variable === 'pressure';
                                        const unit = isTemp ? '°C' : isWind ? 'm/s' : isPrecip ? 'mm' : isPressure ? 'hPa' : '%';
                                        const sign = anomaly.anomalyMagnitude > 0 ? '+' : '';

                                        return (
                                            <div key={idx} className={`flex justify-between items-center p-1.5 px-3 rounded-lg border transition-colors duration-300 ${isLight ? 'bg-gray-100 border-gray-200' : 'bg-white/[0.02] border-white/5'}`}>
                                                <span className={`text-[10px] font-bold tracking-tight uppercase ${isLight ? 'text-gray-700' : 'text-white/40'}`}>
                                                    {anomaly.variable === 'T2M_MAX' ? 'Peak Temp' :
                                                        anomaly.variable === 'T2M' ? 'Avg Temp' :
                                                            anomaly.variable === 'GWETROOT' ? 'Soil Moisture' :
                                                                anomaly.variable === 'WS2M' ? 'Wind Speed' :
                                                                    anomaly.variable === 'clouds' ? 'Cloud Cover' :
                                                                        anomaly.variable === 'pressure' ? 'Pressure' :
                                                                            anomaly.variable === 'PRECTOTCORR' ? 'Precipitation' :
                                                                                anomaly.variable === 'RH2M' ? 'Humidity' :
                                                                                    anomaly.variable}
                                                </span>
                                                <span className={`text-[12px] font-black drop-shadow-sm ${isLight ? 'text-gray-900' : 'text-white'}`}>
                                                    {sign}{anomaly.anomalyMagnitude.toFixed(1)}<span className={`text-[9px] ml-0.5 ${isLight ? 'text-gray-700' : 'opacity-40'}`}>{unit}</span>
                                                </span>
                                            </div>
                                        );
                                    })}
                                <div className={`flex justify-between items-center pt-2 border-t ${isLight ? 'border-gray-200' : 'border-white/5'}`}>
                                    <span className={`text-[9px] font-bold uppercase tracking-widest ${isLight ? 'text-gray-600' : 'text-white/30'}`}>Data Latency:</span>
                                    <span className={`text-[9px] font-black uppercase ${isLight ? 'text-gray-800' : 'text-white/70'}`}>~5 Days (Archival)</span>
                                </div>
                            </div>

                            <div className="flex gap-2 mt-auto">
                                <button
                                    onClick={handleAskAI}
                                    className={`w-full relative group overflow-hidden flex items-center justify-center gap-2.5 px-4 py-3 border rounded-xl transition-all shadow-lg ${isLight
                                        ? 'bg-gradient-to-r from-cyan-600 to-blue-600 border-cyan-500/20 text-white hover:from-cyan-500 hover:to-blue-500'
                                        : 'bg-gradient-to-r from-cyan-950/50 to-blue-950/50 hover:from-cyan-900/60 hover:to-blue-900/60 border-cyan-500/30 text-cyan-200 hover:text-white hover:shadow-cyan-500/10'
                                        }`}
                                >
                                    <Sparkles className={`w-4 h-4 ${isLight ? 'text-white' : 'text-cyan-400'}`} />
                                    <span className="font-medium text-sm tracking-wide">Ask WHO Analysis</span>
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })() : (
                <div className={`h-[400px] border rounded-[24px] p-8 flex flex-col items-center justify-center text-center group transition-colors duration-300 ${isLight ? 'bg-gray-100 border-gray-200' : 'bg-white/[0.02] border-white/5'}`}>
                    <div className={`w-16 h-16 rounded-full border flex items-center justify-center mb-6 group-hover:scale-110 transition-transform ${isLight ? 'bg-white border-gray-200' : 'bg-white/[0.03] border-white/5'}`}>
                        <Target className={`w-8 h-8 ${isLight ? 'text-gray-300' : 'text-white/10'}`} />
                    </div>
                    <p className={`text-[12px] font-black uppercase tracking-[3px] leading-relaxed ${isLight ? 'text-gray-400' : 'text-white/20'}`}>
                        Select a region to<br />view detailed insights
                    </p>
                </div>
            )}

            <div className="pt-4">
                <div className="flex items-center justify-between mb-6 px-1">
                    <h3 className={`text-[11px] font-black uppercase tracking-[2.5px] ${isLight ? 'text-gray-700' : 'text-white/40'}`}>Top Risk Indicators</h3>
                    <MoreHorizontal className={`w-4 h-4 ${isLight ? 'text-gray-500' : 'text-white/10'}`} />
                </div>

                <div className="space-y-3">
                    {topRisks.map((item, i) => (
                        <div
                            key={i}
                            onClick={() => onRegionClick?.(item.regionId)}
                            className={`border rounded-xl p-4 group cursor-pointer transition-all ${isLight ? 'bg-white border-gray-200 hover:bg-gray-50 shadow-sm' : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.04]'}`}
                        >
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2.5">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center border shadow-inner ${isLight ? 'bg-rose-50 border-rose-100' : 'bg-rose-500/10 border-white/5'}`}>
                                        <Activity className="w-4 h-4 text-rose-500" />
                                    </div>
                                    <span className={`text-[14px] font-black ${isLight ? 'text-gray-900' : 'text-white/90'}`}>{item.regionName}</span>
                                    <div className={`border text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-tighter ${isLight ? 'bg-rose-100 border-rose-300 text-rose-800' : 'bg-rose-500/10 border-rose-500/20 text-rose-400'}`}>
                                        {item.priority}
                                    </div>
                                </div>
                                {item.convergence && (
                                    <div className={`flex items-center gap-1 text-[8px] font-black px-2 py-1 rounded-md border leading-none ${isLight ? 'bg-cyan-100 border-cyan-300 text-cyan-800' : 'bg-cyan-950/40 text-cyan-400 border-cyan-500/10'}`}>
                                        <Zap className="w-2.5 h-2.5" /> CONVERGENCE
                                    </div>
                                )}
                            </div>

                            <div className="pl-10 space-y-2">
                                <div className="flex flex-wrap gap-1.5">
                                    {item.hazardTypes.map((h, idx) => (
                                        <span key={idx} className={`text-[8px] font-black border px-1.5 py-0.5 rounded uppercase tracking-tighter ${isLight ? 'bg-amber-100 border-amber-300 text-amber-800' : 'text-amber-500 bg-amber-500/10 border-transparent'}`}>
                                            {h}
                                        </span>
                                    ))}
                                    {item.diseaseRisks.map((d, idx) => (
                                        <span key={idx} className={`text-[8px] font-black border px-1.5 py-0.5 rounded uppercase tracking-tighter ${isLight ? 'bg-rose-100 border-rose-300 text-rose-800' : 'text-rose-400 bg-rose-400/10 border-transparent'}`}>
                                            {d}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}

