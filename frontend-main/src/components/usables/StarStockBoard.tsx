import { useState, useEffect } from 'react';
import { Info, AlertTriangle } from 'lucide-react';
import type { StarCountryData, StarTickerAlert } from '@/types';
import { stardata } from '@/pages/stardata/services/stardata';
import { logger } from "@/utils/logger";

interface StarStockBoardProps {
    countries: StarCountryData[];
    tickerAlerts: StarTickerAlert[];
}

const getRiskInfo = (avgRisk: number) => {
    if (avgRisk >= 4) return { label: 'Very High', dot: 'bg-red-400' };
    if (avgRisk >= 3) return { label: 'High', dot: 'bg-orange-400' };
    if (avgRisk >= 2) return { label: 'Moderate', dot: 'bg-amber-300' };
    return { label: 'Low', dot: 'bg-emerald-400' };
};

type SortOption = 'risk-high' | 'risk-low' | 'name' | 'hazards';

const MONTHS = [
    { value: '', label: 'All Months', short: 'All' },
    { value: 'jan', label: 'January', short: 'Jan' },
    { value: 'feb', label: 'February', short: 'Feb' },
    { value: 'mar', label: 'March', short: 'Mar' },
    { value: 'apr', label: 'April', short: 'Apr' },
    { value: 'may', label: 'May', short: 'May' },
    { value: 'jun', label: 'June', short: 'Jun' },
    { value: 'jul', label: 'July', short: 'Jul' },
    { value: 'aug', label: 'August', short: 'Aug' },
    { value: 'sep', label: 'September', short: 'Sep' },
    { value: 'oct', label: 'October', short: 'Oct' },
    { value: 'nov', label: 'November', short: 'Nov' },
    { value: 'dec', label: 'December', short: 'Dec' },
];


const SkeletonCard = () => (
    <div className="bg-[#0d1424] rounded-xl p-5 border border-white/5 animate-pulse">
        <div className="h-5 bg-white/10 rounded w-3/4 mb-2"></div>
        <div className="h-3 bg-white/5 rounded w-1/2 mb-4"></div>
        <div className="h-10 bg-white/10 rounded w-1/3 mb-2"></div>
        <div className="h-3 bg-white/5 rounded w-1/2"></div>
    </div>
);

export default function StarStockBoard({ countries: initialCountries, tickerAlerts }: StarStockBoardProps) {
    const [sortBy, setSortBy] = useState<SortOption>('risk-high');
    const [showInfo, setShowInfo] = useState(false);
    const [selectedMonth, setSelectedMonth] = useState<string>('');
    const [isLoading, setIsLoading] = useState(false);
    const [mapData, setMapData] = useState<any[]>([]);
    const [useApiData, setUseApiData] = useState(false);


    useEffect(() => {
        if (selectedMonth === '') {
            setUseApiData(false);
            return;
        }

        const fetchMonthData = async () => {
            setIsLoading(true);
            try {
                const response = await stardata.map(undefined, selectedMonth);
                if (response.data?.countries) {
                    const converted = response.data.countries.map((c: any) => ({
                        country: c.country,
                        code: c.country?.substring(0, 2).toUpperCase() || 'XX',
                        total: c.hazard_count || 0,
                        very_high: c.severity === 'Very High' ? c.hazard_count : 0,
                        high: c.severity === 'High' ? c.hazard_count : 0,
                        moderate: c.severity === 'Moderate' ? c.hazard_count : 0,
                        low: c.severity === 'Low' ? c.hazard_count : 0,
                        very_low: 0,
                        risk_score: c.severity === 'Very High' ? 5 : c.severity === 'High' ? 4 : c.severity === 'Moderate' ? 3 : 2,
                        avg_risk: c.severity === 'Very High' ? 4.5 : c.severity === 'High' ? 3.5 : c.severity === 'Moderate' ? 2.5 : 1.5,
                        seasonality: [],
                    }));
                    setMapData(converted);
                    setUseApiData(true);
                }
            } catch (error) {
                logger.error('Failed to fetch month data:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchMonthData();
    }, [selectedMonth]);

    const countries = useApiData ? mapData : initialCountries;

    const sortedCountries = [...countries].sort((a, b) => {
        switch (sortBy) {
            case 'risk-high': return b.avg_risk - a.avg_risk;
            case 'risk-low': return a.avg_risk - b.avg_risk;
            case 'name': return a.country.localeCompare(b.country);
            case 'hazards': return b.total - a.total;
            default: return 0;
        }
    });

    return (
        <div className="w-full mb-4">
            <div className="bg-[#0d1424] rounded-t-xl border border-white/5">
                <div className="flex items-center justify-between px-5 py-3">
                    <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></div>
                        <h2 className="text-base font-semibold text-white">STAR Risk Index</h2>
                        <button
                            onClick={() => setShowInfo(!showInfo)}
                            className="p-1 hover:bg-white/5 rounded"
                        >
                            <Info className="w-4 h-4 text-gray-500" />
                        </button>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="flex gap-1 bg-black/30 p-1 rounded-lg">
                            {MONTHS.map((m) => (
                                <button
                                    key={m.value}
                                    onClick={() => setSelectedMonth(m.value)}
                                    className={`px-2 py-1 text-xs rounded transition-all ${selectedMonth === m.value
                                        ? 'bg-cyan-500 text-white font-bold'
                                        : 'text-gray-400 hover:bg-white/10'
                                        }`}
                                >
                                    {m.short}
                                </button>
                            ))}
                        </div>

                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value as SortOption)}
                            className="bg-[#1a2744] border border-white/10 rounded-lg px-3 py-1.5 text-sm text-gray-300 focus:outline-none"
                        >
                            <option value="risk-high">Risk ↓</option>
                            <option value="risk-low">Risk ↑</option>
                            <option value="name">Name</option>
                            <option value="hazards">Hazards</option>
                        </select>
                    </div>
                </div>

                {showInfo && (
                    <div className="px-5 py-3 bg-white/[0.02] border-t border-white/5 text-sm text-gray-400 space-y-2">
                        <p><strong className="text-white">STAR</strong> = Strategic Tool for Assessing Risks (WHO)</p>
                        <p><strong className="text-white">Month Filter</strong> = Fetches countries with active hazards in selected month</p>
                        <div className="flex items-center gap-5 pt-1">
                            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-400"></span> Very High</span>
                            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-orange-400"></span> High</span>
                            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-300"></span> Moderate</span>
                            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span> Low</span>
                        </div>
                    </div>
                )}

                <div className="overflow-hidden py-2 bg-[#080c14] border-t border-white/5">
                    <div className="flex animate-marquee-star whitespace-nowrap text-sm">
                        {[...tickerAlerts, ...tickerAlerts].map((alert, idx) => (
                            <span key={idx} className="inline-flex items-center gap-2 mx-5">
                                <AlertTriangle className="w-3 h-3 text-amber-400" />
                                <span className="text-white font-medium">{alert.country}</span>
                                <span className="text-gray-600">•</span>
                                <span className="text-gray-400">{alert.hazard}</span>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${alert.risk_level?.toLowerCase().includes('very')
                                    ? 'bg-red-500/20 text-red-400'
                                    : 'bg-orange-500/20 text-orange-400'
                                    }`}>
                                    {alert.risk_level}
                                </span>
                            </span>
                        ))}
                    </div>
                </div>
            </div>

            <div className="bg-[#0a0f18] rounded-b-xl border border-white/5 border-t-0 p-4">
                {isLoading ? (
                    <div className="grid grid-cols-4 gap-3">
                        {[...Array(8)].map((_, i) => <SkeletonCard key={i} />)}
                    </div>
                ) : sortedCountries.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                        No countries with active hazards in {MONTHS.find(m => m.value === selectedMonth)?.label || 'selected period'}
                    </div>
                ) : (
                    <div className="grid grid-cols-4 gap-3">
                        {sortedCountries.slice(0, 16).map((country) => {
                            const riskInfo = getRiskInfo(country.avg_risk);

                            return (
                                <div
                                    key={country.country}
                                    className="bg-[#0d1424] rounded-xl p-4 border border-white/5 hover:border-white/10 transition-all"
                                >
                                    <div className="text-white text-lg font-semibold truncate" title={country.country}>
                                        {country.country}
                                    </div>
                                    <div className="text-gray-500 text-sm mt-0.5">
                                        {country.code} • {country.total} hazards
                                    </div>
                                    <div className="flex items-center gap-3 mt-3">
                                        <span className="text-3xl font-bold text-white">
                                            {country.avg_risk.toFixed(1)}
                                        </span>
                                        <div className={`w-3 h-3 rounded-full ${riskInfo.dot}`}></div>
                                    </div>
                                    <div className="text-sm text-gray-500 mt-1">
                                        {riskInfo.label} Risk
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/5">
                    <div className="text-sm text-gray-500">
                        {sortedCountries.length} countries {selectedMonth && `• ${MONTHS.find(m => m.value === selectedMonth)?.label}`}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-red-400"></span>
                            VH: {sortedCountries.filter(c => c.avg_risk >= 4).length}
                        </span>
                        <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-orange-400"></span>
                            H: {sortedCountries.filter(c => c.avg_risk >= 3 && c.avg_risk < 4).length}
                        </span>
                        <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-amber-300"></span>
                            M: {sortedCountries.filter(c => c.avg_risk >= 2 && c.avg_risk < 3).length}
                        </span>
                        <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                            L: {sortedCountries.filter(c => c.avg_risk < 2).length}
                        </span>
                    </div>
                </div>
            </div>

            <style>{`
        @keyframes marquee-star {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee-star {
          animation: marquee-star 35s linear infinite;
        }
        .animate-marquee-star:hover {
          animation-play-state: paused;
        }
      `}</style>
        </div>
    );
}
