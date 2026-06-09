import React, { useEffect, useState } from 'react';
import { readiness } from '@/pages/readiness/services/readiness';
import { useTheme } from '@/contexts/ThemeContext';
import { ShieldAlert, Activity, TrendingUp, ChevronRight, MapPin } from 'lucide-react';
import { Loading } from '@/components/Loading';
import { logger } from "@/utils/logger";

interface Hazard {
    country: string;
    hazard: string;
    severity: string;
    likelihood: string;
    risk_level: string;
}

interface RegionalRisk {
    country: string;
    total_alerts: number;
    high_risk_count: number;
    medium_risk_count: number;
    low_risk_count: number;
}

interface MonitorData {
    top_hazards: Hazard[];
    regional_risk: RegionalRisk[];
    summary: {
        total_alerts: number;
        high_priority_countries: number;
    };
}

interface Props {
    country?: string;
}

const HazardMonitor: React.FC<Props> = ({ country }) => {
    const { theme } = useTheme();
    const isLight = theme === 'light';
    const [data, setData] = useState<MonitorData | null>(null);
    const [loading, setLoading] = useState(true);

    const isContinental = !country || country.toLowerCase() === 'africa';

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                const response = await readiness.hazardMonitor(isContinental ? undefined : country);
                setData(response);
            } catch (err) {
                logger.error("Failed to fetch hazard monitor data:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [country, isContinental]);

    if (loading) return <div className="py-20 flex justify-center"><Loading /></div>;

    if (!data || (data.top_hazards.length === 0 && data.regional_risk.length === 0)) {
        return (
            <div className={`rounded-2xl p-10 text-center ${isLight ? 'bg-white border border-gray-200' : 'bg-[#1C1607] border border-white/10'}`}>
                <Activity size={48} className="mx-auto mb-4 opacity-20" />
                <h3 className="text-lg font-bold opacity-60">No Active Hazards Detected</h3>
                <p className="text-sm opacity-40">Regional risk monitoring is active but no critical threats are currently reported.</p>
            </div>
        );
    }

    return (
        <div className={`rounded-2xl overflow-hidden ${isLight ? 'bg-white border border-gray-200 shadow-sm' : 'bg-[#1C1607] border border-white/10 shadow-xl'}`}>
            {/* Header section */}
            <div className={`px-6 py-5 border-b ${isLight ? 'border-gray-100 bg-gray-50/50' : 'border-white/5 bg-black/20'}`}>
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className={`text-xl font-bold flex items-center gap-2 ${isLight ? 'text-gray-900' : 'text-white'}`}>
                            <ShieldAlert className="text-red-500" size={24} />
                            Hazard Intelligence Monitor
                        </h2>
                        <p className={`text-sm mt-1 ${isLight ? 'text-gray-500' : 'text-neutral-400'}`}>
                            Real-time risk tracking and regional vulnerability analysis
                        </p>
                    </div>
                    <div className="flex gap-4">
                        <div className="text-right">
                            <p className="text-[10px] uppercase tracking-wider opacity-60 font-bold">Total Alerts</p>
                            <p className={`text-xl font-black ${isLight ? 'text-blue-600' : 'text-yellow-500'}`}>{data.summary.total_alerts}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-[10px] uppercase tracking-wider opacity-60 font-bold">Priority Refs</p>
                            <p className={`text-xl font-black ${isLight ? 'text-red-600' : 'text-red-400'}`}>{data.summary.high_priority_countries}</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-0">
                {/* Left Panel: Top Hazards Feed */}
                <div className={`lg:col-span-7 p-6 ${isLight ? 'border-r border-gray-100' : 'border-r border-white/5'}`}>
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-sm font-bold uppercase tracking-widest opacity-70">Active Hazard Feed</h3>
                        <span className="text-[10px] px-2 py-1 rounded bg-red-500/10 text-red-500 font-bold italic">LIVE UPDATES</span>
                    </div>

                    <div className="space-y-4">
                        {data.top_hazards.map((hazard, idx) => (
                            <div
                                key={idx}
                                className={`group p-4 rounded-xl transition-all duration-300 ${isLight ? 'bg-gray-50 hover:bg-white hover:shadow-md border border-transparent hover:border-blue-100' : 'bg-white/5 hover:bg-white/10 border border-transparent hover:border-white/10'}`}
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isLight ? 'bg-white text-blue-600' : 'bg-black/40 text-yellow-500'}`}>
                                            <Activity size={18} />
                                        </div>
                                        <div>
                                            <p className={`text-sm font-bold truncate max-w-[200px] ${isLight ? 'text-gray-900' : 'text-white'}`}>{hazard.hazard}</p>
                                            <p className="text-[10px] opacity-60 flex items-center gap-1">
                                                <MapPin size={10} /> {hazard.country}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end">
                                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${hazard.severity.toLowerCase().includes('high') || hazard.severity.toLowerCase().includes('critical')
                                            ? 'bg-red-500/10 text-red-500'
                                            : 'bg-yellow-500/10 text-yellow-500'
                                            }`}>
                                            {hazard.severity}
                                        </span>
                                        <p className="text-[9px] mt-1 opacity-50 uppercase tracking-tighter">Prob: {hazard.likelihood}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Right Panel: Regional Risk Distribution */}
                <div className="lg:col-span-5 p-6 flex flex-col">
                    <h3 className="text-sm font-bold uppercase tracking-widest opacity-70 mb-6">Regional Vulnerability Matrix</h3>

                    <div className="flex-1 space-y-6">
                        {data.regional_risk.map((region, idx) => (
                            <div key={idx} className="relative">
                                <div className="flex justify-between items-center mb-1.5">
                                    <span className="text-xs font-bold truncate max-w-[120px]">{region.country}</span>
                                    <span className="text-[10px] font-mono opacity-60">High: {region.high_risk_count} | Mid: {region.medium_risk_count}</span>
                                </div>
                                <div className={`h-1.5 w-full rounded-full overflow-hidden flex ${isLight ? 'bg-gray-100' : 'bg-black/30'}`}>
                                    <div
                                        className="h-full bg-red-500 transition-all duration-1000 ease-out"
                                        style={{ width: `${(region.high_risk_count / region.total_alerts) * 100}%` }}
                                    />
                                    <div
                                        className="h-full bg-yellow-500 transition-all duration-1000 ease-out"
                                        style={{ width: `${(region.medium_risk_count / region.total_alerts) * 100}%` }}
                                    />
                                    <div
                                        className="h-full bg-blue-500 transition-all duration-1000 ease-out"
                                        style={{ width: `${(region.low_risk_count / region.total_alerts) * 100}%` }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className={`mt-8 p-4 rounded-xl flex items-center justify-between ${isLight ? 'bg-blue-50 text-blue-900 border border-blue-100' : 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20'}`}>
                        <div className="flex items-center gap-3">
                            <TrendingUp size={20} />
                            <div>
                                <p className="text-xs font-black uppercase italic">Assessment Priority</p>
                                <p className="text-[10px] opacity-80">Countries requiring immediate readiness review</p>
                            </div>
                        </div>
                        <ChevronRight size={20} className="opacity-50" />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default HazardMonitor;
