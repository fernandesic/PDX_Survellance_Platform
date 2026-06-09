// @ts-nocheck
import { ChevronRight, AlertTriangle, MapPin } from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import type { RegionClimateProfile, Hazard, DiseaseRisk } from '@/pages/climate/types/climate';
import {
    getHazardIcon,
    getDiseaseIcon
} from './ClimateDesign';

interface ActiveAlertsProps {
    regionProfiles: Map<string, RegionClimateProfile>;
    onAlertClick: (regionId: string) => void;
}

export function ActiveAlerts({ regionProfiles, onAlertClick }: ActiveAlertsProps) {
    const [showAlerts, setShowAlerts] = useState(true);
    const [isMinimized, setIsMinimized] = useState(false);
    const [isPageLoaded, setIsPageLoaded] = useState(false);

    const alerts = Array.from(regionProfiles.values()).flatMap(profile => [
        ...profile.activeHazards.map(h => ({ ...h, regionId: profile.region.id, regionName: profile.region.name, type: 'hazard' as const })),
        ...profile.diseaseRisks.filter(r => r.riskLevel !== 'LOW').map(r => ({ ...r, regionId: profile.region.id, regionName: profile.region.name, type: 'disease' as const }))
    ]);

    const sortedAlerts = useMemo(() => {
        const getHash = (str: string) => {
            let hash = 0;
            for (let i = 0; i < str.length; i++) {
                hash = str.charCodeAt(i) + ((hash << 5) - hash);
            }
            return Math.abs(hash);
        };

        return [...alerts].sort((a, b) => {
            const priority = { HIGH: 0, MEDIUM: 1, LOW: 2 };
            const isAhazard = a.type === 'hazard';
            const isBhazard = b.type === 'hazard';

            const sevA = isAhazard ? (a as Hazard).severity : (a as DiseaseRisk).riskLevel;
            const sevB = isBhazard ? (b as Hazard).severity : (b as DiseaseRisk).riskLevel;

            if (priority[sevA] !== priority[sevB]) {
                return priority[sevA] - priority[sevB];
            }

            const confA = isAhazard ? (a as Hazard).confidence : (a as DiseaseRisk).confidence;
            const confB = isBhazard ? (b as Hazard).confidence : (b as DiseaseRisk).confidence;

            if (confA !== confB) {
                return (confB || 0) - (confA || 0);
            }

            const day = new Date().getDate();
            const stringA = a.regionName + (isAhazard ? (a as Hazard).type : (a as DiseaseRisk).disease);
            const stringB = b.regionName + (isBhazard ? (b as Hazard).type : (b as DiseaseRisk).disease);

            return getHash(stringA + day) - getHash(stringB + day);
        });
    }, [alerts]);

    const highAlerts = sortedAlerts.filter(a => (a.type === 'hazard' ? (a as Hazard).severity : (a as DiseaseRisk).riskLevel) === 'HIGH');

    useEffect(() => {
        const timer = setTimeout(() => {
            setIsPageLoaded(true);
        }, 2000);

        return () => clearTimeout(timer);
    }, []);

    const getSeverityColor = (severity: string) => {
        switch (severity) {
            case 'HIGH': return 'bg-red-600 text-white';
            case 'MEDIUM': return 'bg-orange-600 text-white';
            case 'LOW': return 'bg-yellow-600 text-white';
            default: return 'bg-gray-600 text-white';
        }
    };

    const getHazardTypeColor = (hazardType: string) => {
        switch (hazardType) {
            case 'flood': return 'border-blue-500/50 bg-[#050810]';
            case 'drought': return 'border-amber-500/50 bg-[#050810]';
            case 'heatwave': return 'border-orange-500/50 bg-[#050810]';
            case 'fire': return 'border-red-500/50 bg-[#050810]';
            case 'cold': return 'border-cyan-500/50 bg-[#050810]';
            case 'wind': return 'border-gray-500/50 bg-[#050810]';
            case 'storm': return 'border-purple-500/50 bg-[#050810]';
            default: return 'border-gray-500/50 bg-[#050810]';
        }
    };

    const getDiseaseTypeColor = (diseaseType: string) => {
        switch (diseaseType) {
            case 'cholera': return 'border-cyan-500/50 bg-[#050810]';
            case 'malaria': return 'border-emerald-500/50 bg-[#050810]';
            case 'meningitis': return 'border-purple-500/50 bg-[#050810]';
            case 'malnutrition': return 'border-yellow-500/50 bg-[#050810]';
            default: return 'border-gray-500/50 bg-[#050810]';
        }
    };

    const getSeverityBg = (severity: string, hazardType?: string, diseaseType?: string) => {
        const baseBg = 'bg-black hover:bg-[#050810]';
        const typeBorder = hazardType ? getHazardTypeColor(hazardType) : diseaseType ? getDiseaseTypeColor(diseaseType) : 'border-gray-500/30';
        const severityBorder = severity === 'HIGH' ? 'border-red-500/30' : severity === 'MEDIUM' ? 'border-orange-500/30' : 'border-yellow-500/30';

        return `${baseBg} ${typeBorder} ${severityBorder}`;
    };

    if (!showAlerts || alerts.length === 0 || !isPageLoaded) {
        return null;
    }

    const toggleMinimize = () => {
        setIsMinimized(!isMinimized);
    };

    return (
        <div className={`relative transition-all duration-500 ease-in-out ${isMinimized ? 'mb-0' : 'mb-2'}`}>
            <div className="flex justify-between items-center">
                <div className="text-white/60 text-xs font-medium">
                    {alerts.length} Alert{alerts.length > 1 ? 's' : ''} • {highAlerts.length} Critical
                </div>
                <div className="flex gap-1">
                    <button
                        onClick={toggleMinimize}
                        className="bg-[#050810] border border-white/20 rounded-full p-1.5 hover:bg-[#0a0a15] transition-all duration-300 transform hover:scale-110"
                        title={isMinimized ? "Show Alerts" : "Hide Alerts"}
                    >
                        <svg
                            className={`w-3 h-3 text-white/70 transition-transform duration-300 ${isMinimized ? 'rotate-180' : ''}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>
                    {/* <button
                        onClick={() => setShowAlerts(false)}
                        className="bg-[#050810] border border-white/20 rounded-full p-1.5 hover:bg-[#0a0a15] transition-colors"
                        title="Close All Alerts"
                    >
                        <X className="w-3 h-3 text-white/70 hover:text-white" />
                    </button> */}
                </div>
            </div>

            <div
                className={`transition-all duration-500 ease-in-out transform ${isMinimized
                    ? 'max-h-0 opacity-0 scale-95 -translate-y-2 overflow-hidden'
                    : 'max-h-[500px] opacity-100 scale-100 translate-y-0 overflow-y-auto'
                    }`}
            >
                {highAlerts.length > 0 && (
                    <div className="bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg p-3 shadow-lg border border-red-400/30">
                        <div className="flex items-center gap-2">
                            <div className="bg-white/20 rounded-full p-1.5">
                                <AlertTriangle className="w-4 h-4 text-white animate-pulse" />
                            </div>
                            <div className="flex-1">
                                <h3 className="text-sm font-bold">{highAlerts.length} Critical Alert{highAlerts.length > 1 ? 's' : ''}</h3>
                                <p className="text-red-100 text-xs mt-0.5">
                                    {highAlerts[0].regionName}{highAlerts.length > 1 ? ` +${highAlerts.length - 1}` : ''}
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                <div className="space-y-2">
                    {sortedAlerts.map((alert, idx) => {
                        const isHazard = alert.type === 'hazard';
                        const severity = isHazard ? (alert as Hazard).severity : (alert as DiseaseRisk).riskLevel;
                        const hazardType = isHazard ? (alert as Hazard).type : undefined;
                        const diseaseType = !isHazard ? (alert as DiseaseRisk).disease : undefined;
                        const Icon = isHazard ? getHazardIcon((alert as Hazard).type) : getDiseaseIcon((alert as DiseaseRisk).disease);

                        return (
                            <button
                                key={`${alert.regionId}-${idx}`}
                                onClick={() => onAlertClick(alert.regionId)}
                                className={`w-full border rounded-lg p-3 transition-all hover:shadow-md text-left min-h-[80px] ${getSeverityBg(severity, hazardType, diseaseType)}`}
                            >
                                <div className="flex items-center gap-2">
                                    <div className={`rounded-lg p-1.5 ${getSeverityColor(severity)}`}>
                                        <Icon className="w-4 h-4" />
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${getSeverityColor(severity)}`}>
                                                {severity}
                                            </span>
                                            <div className="flex items-center gap-1 text-gray-400">
                                                <MapPin className="w-2.5 h-2.5" />
                                                <span className="text-[10px] font-medium">{alert.regionName}</span>
                                            </div>
                                        </div>

                                        <h4 className="text-xs font-bold text-white mb-0.5">
                                            {isHazard ? (alert as Hazard).type.replace('_', ' ').toUpperCase() : (alert as DiseaseRisk).disease.toUpperCase()}
                                        </h4>

                                        <p className="text-[10px] text-gray-300 whitespace-normal leading-relaxed">
                                            {isHazard ? (alert as Hazard).description : (alert as DiseaseRisk).explanation}
                                        </p>
                                    </div>

                                    <ChevronRight className="w-3.5 h-3.5 text-gray-400 group-hover:text-white transition-colors flex-shrink-0" />
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
