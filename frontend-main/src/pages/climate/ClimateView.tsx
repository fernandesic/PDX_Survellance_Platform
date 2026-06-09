// @ts-nocheck
import { useRef, useState, useEffect } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { Loader2, PanelRightClose, PanelRightOpen } from 'lucide-react';
import { ArcGISClimateMap } from '@/pages/climate/components/ArcGISClimateMap';
import { useClimateIntelligence } from '@/pages/climate/hooks/useClimateIntelligence';
import { IntelligenceHeader } from '@/pages/climate/components/IntelligenceHeader';
import { ThreatInsightsPanel } from '@/pages/climate/components/ThreatInsightsPanel';
import { DeepAnalysisPanel } from '@/pages/climate/components/DeepAnalysisPanel';
import { ActiveAlerts } from '@/pages/climate/components/ActiveAlerts';
import { logger } from "@/utils/logger";

export default function Climate() {
    const { theme } = useTheme();
    const isLight = theme === 'light';

    const [activeLayers] = useState<any>(['hazard', 'health-risk']);
    const [rightCollapsed, setRightCollapsed] = useState(false);

    const {
        regions,
        selectedRegion,
        loading,
        handleRegionClick,
        regionProfiles,
        filteredProfiles,
        kpiMetrics,
        timeWindow,
        setTimeWindow
    } = useClimateIntelligence();

    const deepAnalysisRef = useRef<HTMLDivElement>(null);

    const [activeWeatherLayer, setActiveWeatherLayer] = useState<any>(null);
    const [is3DView, setIs3DView] = useState(false);

    useEffect(() => {
        logger.log('Climate2 page - regionProfiles size:', regionProfiles.size);
        logger.log('Climate2 page - regions count:', regions.length);
        
        let totalAlerts = 0;
        regionProfiles.forEach(profile => {
            totalAlerts += profile.activeHazards.length;
            totalAlerts += profile.diseaseRisks.filter(r => r.riskLevel !== 'LOW').length;
        });
        logger.log('Climate2 page - total alerts:', totalAlerts);
    }, [regionProfiles, regions]);

    const flyToLocation = (lng: number, lat: number) => {
        const region = regions.find(r => 
            Math.abs(r.centroid.lng - lng) < 0.1 && 
            Math.abs(r.centroid.lat - lat) < 0.1
        );
        
        if (region) {
            handleRegionClick(region);
            
            if (is3DView) {
                setIs3DView(false);
                window.dispatchEvent(new CustomEvent('trigger2DView', {
                    detail: { lng: region.centroid.lng, lat: region.centroid.lat, regionName: region.name, zoom: 3.5, pitch: 0, bearing: 0 }
                }));
            } else {
                setIs3DView(true);
                window.dispatchEvent(new CustomEvent('trigger3DView', {
                    detail: { lng: region.centroid.lng, lat: region.centroid.lat, regionName: region.name, zoom: 12, pitch: 60, bearing: 0 }
                }));
            }
        }
    };

    const isInitialLoading = loading && regionProfiles.size === 0;

    if (isInitialLoading) {
        return (
            <div className="h-screen w-full flex items-center justify-center bg-[#050810]">
                <Loader2 className="w-8 h-8 text-cyan-500 animate-spin" />
            </div>
        );
    }

    return (
        <div
            className={`relative min-h-screen w-full overflow-y-auto custom-sidebar-scrollbar flex flex-col ${isLight ? 'bg-gray-50' : 'bg-[#050810] text-white'}`}
        >
            <IntelligenceHeader
                metrics={kpiMetrics}
                loading={loading}
                timeWindow={timeWindow}
                onTimeWindowChange={(t) => setTimeWindow(t as any)}
            />

            <div className="flex h-[calc(100vh-128px)] shrink-0 overflow-hidden relative">
                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-30 max-w-md pointer-events-auto">
                    {regionProfiles.size > 0 ? (
                        <ActiveAlerts 
                            regionProfiles={regionProfiles}
                            onAlertClick={(regionId) => {
                                const region = regions.find(r => r.id === regionId);
                                if (region) handleRegionClick(region);
                            }}
                        />
                    ) : (
                        <div className="bg-[#050810]/90 backdrop-blur-md border border-white/20 rounded-xl p-4">
                            <p className="text-white/70 text-sm">Loading alerts...</p>
                        </div>
                    )}
                </div>

                <main className="flex-1 h-full relative flex flex-col min-w-0 bg-[#050810]">
                    <div className="flex-1 relative overflow-hidden border border-white/10 shadow-[0_40px_100px_rgba(0,0,0,0.7)] z-10 bg-[#000]">
                        <ArcGISClimateMap
                            regions={regions}
                            selectedRegion={selectedRegion}
                            onRegionClick={handleRegionClick}
                            activeLayers={activeLayers}
                            regionProfiles={regionProfiles}
                            activeWeatherLayer={activeWeatherLayer}
                            onWeatherLayerChange={setActiveWeatherLayer}
                        />
                    </div>
                </main>

                <aside className={`h-full flex flex-col border-l z-30 transition-all duration-300 relative ${rightCollapsed ? 'w-0' : 'w-[300px]'} ${isLight ? 'bg-white/80 backdrop-blur-md border-gray-100' : 'bg-[#050810] border-white/5'}`}>
                    <div className={`flex-1 flex flex-col overflow-hidden transition-opacity duration-300 ${rightCollapsed ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                        <div className="flex-1 overflow-y-auto p-3 pt-4 space-y-3 no-scrollbar scroll-smooth">
                            <div className="flex justify-between items-center mb-1 px-1">
                                <h3 className={`text-[13px] font-black uppercase tracking-[1.5px] ${isLight ? 'text-gray-500' : 'text-white/30'}`}>Threat Insights</h3>
                                <button
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        if (selectedRegion) {
                                            flyToLocation(selectedRegion.centroid.lng, selectedRegion.centroid.lat);
                                        }
                                    }}
                                    className={`px-3 py-1.5 text-[11px] font-medium rounded-md transition-all flex items-center gap-2 ${
                                        selectedRegion 
                                            ? (isLight 
                                                ? 'bg-blue-500 hover:bg-blue-600 text-white shadow-md hover:shadow-lg cursor-pointer' 
                                                : 'bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg cursor-pointer')
                                            : (isLight 
                                                ? 'bg-gray-200 text-gray-400 cursor-not-allowed' 
                                                : 'bg-gray-700 text-gray-500 cursor-not-allowed')
                                    }`}
                                    disabled={!selectedRegion}
                                >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <circle cx="12" cy="12" r="10"></circle>
                                        <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1 4-10z"></path>
                                    </svg>
                                    {is3DView ? 'Back to 2D' : 'Explore in 3D'}
                                </button>
                            </div>
                            <ThreatInsightsPanel
                                selectedProfile={selectedRegion ? regionProfiles.get(selectedRegion.id) || null : null}
                                topRisks={kpiMetrics.topRiskLocations}
                                activeWeatherLayer={activeWeatherLayer}
                            />
                        </div>
                    </div>

                    <button
                        onClick={() => setRightCollapsed(!rightCollapsed)}
                        className={`absolute top-4 -left-3 w-6 h-6 rounded-md border flex items-center justify-center z-50 transition-all shadow-xl group ${isLight ? 'bg-white/80 backdrop-blur-md border-gray-100 hover:bg-gray-50' : 'bg-[#1a202c] border-white/10 hover:bg-[#2d3748]'}`}
                    >
                        {rightCollapsed ? (
                            <PanelRightOpen className={`w-3.5 h-3.5 group-hover:text-cyan-500 ${isLight ? 'text-gray-400' : 'text-white/40'}`} />
                        ) : (
                            <PanelRightClose className={`w-3.5 h-3.5 group-hover:text-cyan-500 ${isLight ? 'text-gray-400' : 'text-white/40'}`} />
                        )}
                    </button>
                </aside>
            </div>

            <div ref={deepAnalysisRef} className="flex-shrink-0 border-t border-white/5 bg-[#050810] max-h-[400px] overflow-y-auto no-scrollbar">
                <DeepAnalysisPanel selectedProfile={selectedRegion ? filteredProfiles.get(selectedRegion.id) || null : null} />
            </div>
        </div>
    );
}
