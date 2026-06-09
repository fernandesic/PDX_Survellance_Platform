import { useState, useEffect } from 'react';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';
import { Shield, ChevronDown } from 'lucide-react';
import { stardata } from '@/pages/stardata/services/stardata';
import { useTheme } from '@/contexts/ThemeContext';
import { useTenant } from '@/hooks/useTenant';
import { logger } from "@/utils/logger";

interface CandleData {
    date: string;
    month: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    ma5: number | null;
    ma10: number | null;
    prevClose?: number;
}

interface RVFData {
    title: string;
    countries: number;
    date_range: string;
    data: CandleData[];
}

interface Metadata {
    hazards: string[];
    countries: string[];
    years: string[];
}

const TradingCandle = (props: any) => {
    const { x, width, payload, background } = props;
    if (!payload || !background) return null;

    const { open, close, high, low, prevClose } = payload;

    const domainMin = 0;
    const domainMax = 5.5;
    const chartHeight = background.height;
    const chartTop = background.y;

    const yScale = (value: number) => {
        const normalized = (value - domainMin) / (domainMax - domainMin);
        return chartTop + chartHeight - (normalized * chartHeight);
    };

    const yOpen = yScale(open);
    const yClose = yScale(close);
    const yHigh = yScale(high);
    const yLow = yScale(low);


    const isUp = prevClose !== undefined && close > prevClose;
    const color = isUp ? '#ef4444' : '#22c55e';
    const candleWidth = Math.max(width * 0.6, 8);
    const centerX = x + width / 2;

    const bodyTop = Math.min(yOpen, yClose);
    const bodyBottom = Math.max(yOpen, yClose);
    const bodyHeight = Math.max(bodyBottom - bodyTop, 3);

    return (
        <g>
            <line x1={centerX} y1={yHigh} x2={centerX} y2={bodyTop} stroke={color} strokeWidth={2} />
            <line x1={centerX} y1={bodyBottom} x2={centerX} y2={yLow} stroke={color} strokeWidth={2} />
            <rect x={centerX - candleWidth / 2} y={bodyTop} width={candleWidth} height={bodyHeight} fill={color} stroke={color} strokeWidth={0.5} rx={1} />
        </g>
    );
};

const CandleTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.[0]) return null;
    const d = payload[0].payload;
    const isUp = d.prevClose !== undefined && d.close > d.prevClose;

    return (
        <div className="bg-[#1e222d] border border-[#363a45] rounded px-3 py-2 shadow-lg min-w-[180px]">
            <div className="font-semibold text-white mb-1">{d.month}</div>
            <div className="grid grid-cols-2 gap-x-4 text-xs">
                <span className="text-gray-400">Risk Level:</span>
                <span className={`font-medium ${d.close >= 4 ? 'text-red-400' : d.close >= 3 ? 'text-orange-400' : d.close >= 2 ? 'text-yellow-400' : 'text-green-400'}`}>
                    {d.close?.toFixed(1)}
                </span>
                <span className="text-gray-400">Countries:</span>
                <span className="text-white">{d.volume}</span>
                {d.ma5 && (<><span className="text-gray-400">MA-5:</span><span className="text-orange-400">{d.ma5?.toFixed(1)}</span></>)}
                {d.ma10 && (<><span className="text-gray-400">MA-10:</span><span className="text-purple-400">{d.ma10?.toFixed(1)}</span></>)}
            </div>
            <div className={`mt-2 text-xs flex items-center gap-1 ${isUp ? 'text-[#ef4444]' : 'text-[#22c55e]'}`}>
                {isUp ? '▲ Risk Increased' : '▼ Risk Decreased'}
            </div>
        </div>
    );
};

const VolumeBar = (props: any) => {
    const { x, y, width, height, payload } = props;
    if (!payload) return null;
    const isUp = payload.prevClose !== undefined && payload.close > payload.prevClose;
    const color = isUp ? 'rgba(239, 68, 68, 0.6)' : 'rgba(34, 197, 94, 0.6)';
    return <rect x={x} y={y} width={width} height={height} fill={color} rx={1} />;
};

export default function RVFCandlestickChart() {
    const { theme } = useTheme();
    const isLight = theme === 'light';
    const { isSuperAdmin, tenant } = useTenant();
    const [loading, setLoading] = useState(true);
    const [rvfData, setRvfData] = useState<RVFData | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [metadata, setMetadata] = useState<Metadata | null>(null);

    // Country tenants are locked to their own country (RLS handles filtering
    // server-side too — this just makes the UI consistent and removes the
    // misleading "All Countries" option).
    const initialCountry = isSuperAdmin ? 'All Countries' : (tenant?.name || 'All Countries');

    const [selectedHazard, setSelectedHazard] = useState<string>('Rift Valley Fever (RVF)');
    const [selectedCountry, setSelectedCountry] = useState<string>(initialCountry);
    const [selectedYear, setSelectedYear] = useState<string>('All Years');
    const [showHazardDropdown, setShowHazardDropdown] = useState(false);
    const [showCountryDropdown, setShowCountryDropdown] = useState(false);

    useEffect(() => {
        const fetchMetadata = async () => {
            try {
                const result = await stardata.candlestickMetadata();
                if (result.status === 'OK') {
                    setMetadata(result.data);
                }
            } catch (err) {
                logger.error('Failed to load metadata:', err);
            }
        };
        fetchMetadata();
    }, []);

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                const hazard = selectedHazard !== 'All Hazards' ? selectedHazard : undefined;
                const country = selectedCountry !== 'All Countries' ? selectedCountry : undefined;
                const year = selectedYear !== 'All Years' ? selectedYear : undefined;

                const result = await stardata.rvfCandlestick(hazard, country, year);

                if (result.status === 'OK') {
                    const dataWithPrev = result.data.data.map((item: CandleData, index: number) => ({
                        ...item,
                        prevClose: index > 0 ? result.data.data[index - 1].close : undefined
                    }));
                    setRvfData({
                        ...result.data,
                        data: dataWithPrev
                    });
                    setError(null);
                } else {
                    setError(result.message || 'Failed to load data');
                }
            } catch (err: any) {
                setError(err?.message || 'Failed to load candlestick data');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [selectedHazard, selectedCountry, selectedYear]);

    if (loading) {
        return (
            <div className={`${isLight ? 'bg-white border-gray-200' : 'bg-[#131722] border-[#2a2e39]'} rounded-lg border p-8 flex flex-col items-center justify-center min-h-[200px]`}>
                <div style={{ animation: 'skeleton-breathe 2.4s ease-in-out infinite' }}>
                    <Shield className={`w-10 h-10 ${isLight ? 'text-amber-500' : 'text-amber-400/60'}`} />
                </div>
                <style>{`@keyframes skeleton-breathe { 0%, 100% { opacity: 0.25; transform: scale(0.95); } 50% { opacity: 0.7; transform: scale(1.05); } }`}</style>
            </div>
        );
    }

    if (error || !rvfData) {
        return (
            <div className={`${isLight ? 'bg-white border-gray-200' : 'bg-[#131722] border-[#2a2e39]'} rounded-lg border p-8 text-center`}>
                <p className="text-red-400">{error || 'No data available'}</p>
            </div>
        );
    }

    const { title, countries, date_range, data } = rvfData;

    return (
        <div className={`${isLight ? 'bg-white border-gray-200' : 'bg-[#131722] border-[#2a2e39]'} rounded-lg border overflow-hidden`}>
            <div className={`${isLight ? 'bg-gray-50 border-gray-200' : 'bg-[#1e222d] border-[#2a2e39]'} border-b px-4 py-3`}>
                <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <Shield className="w-5 h-5 text-amber-400" />
                            <span className={`${isLight ? 'text-[#1a1a1a]' : 'text-white'} font-semibold`}>STAR Risk Index</span>
                        </div>
                        <div className={`text-xs ${isLight ? 'text-gray-600' : 'text-gray-500'}`}>Candlestick Pattern Analysis</div>
                    </div>

                    <div className="flex items-center gap-3">
                        {isSuperAdmin && (
                            <div className="relative">
                                <button
                                    onClick={() => setShowCountryDropdown(!showCountryDropdown)}
                                    className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm ${isLight ? 'bg-gray-200 hover:bg-gray-300 text-[#1a1a1a]' : 'bg-[#2a2e39] hover:bg-[#363a45] text-white'}`}
                                >
                                    <span className="max-w-[120px] truncate">{selectedCountry}</span>
                                    <ChevronDown className="w-4 h-4" />
                                </button>
                                {showCountryDropdown && metadata && (
                                    <div className={`absolute right-0 top-full mt-1 rounded shadow-xl z-50 max-h-64 overflow-y-auto w-48 ${isLight ? 'bg-white border border-gray-300' : 'bg-[#1e222d] border border-[#2a2e39]'}`}>
                                        <button
                                            onClick={() => { setSelectedCountry('All Countries'); setShowCountryDropdown(false); }}
                                            className={`w-full text-left px-3 py-2 text-sm ${isLight ? (selectedCountry === 'All Countries' ? 'bg-gray-200 text-[#0093D5]' : 'text-gray-700 hover:bg-gray-100') : (selectedCountry === 'All Countries' ? 'bg-[#2a2e39] text-blue-400' : 'text-gray-300 hover:bg-[#2a2e39]')}`}
                                        >
                                            All Countries
                                        </button>
                                        {metadata.countries.map((country, i) => (
                                            <button
                                                key={i}
                                                onClick={() => { setSelectedCountry(country); setShowCountryDropdown(false); }}
                                                className={`w-full text-left px-3 py-2 text-sm ${isLight ? (country === selectedCountry ? 'bg-gray-200 text-[#0093D5]' : 'text-gray-700 hover:bg-gray-100') : (country === selectedCountry ? 'bg-[#2a2e39] text-blue-400' : 'text-gray-300 hover:bg-[#2a2e39]')}`}
                                            >
                                                {country}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="relative">
                            <button
                                onClick={() => setShowHazardDropdown(!showHazardDropdown)}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm ${isLight ? 'bg-gray-200 hover:bg-gray-300 text-[#1a1a1a]' : 'bg-[#2a2e39] hover:bg-[#363a45] text-white'}`}
                            >
                                <span className="max-w-[150px] truncate">{selectedHazard === 'All Hazards' ? 'All Hazards' : selectedHazard}</span>
                                <ChevronDown className="w-4 h-4" />
                            </button>
                            {showHazardDropdown && metadata && (
                                <div className={`absolute right-0 top-full mt-1 rounded shadow-xl z-50 max-h-64 overflow-y-auto w-64 ${isLight ? 'bg-white border border-gray-300' : 'bg-[#1e222d] border border-[#2a2e39]'}`}>
                                    <button
                                        onClick={() => { setSelectedHazard('All Hazards'); setShowHazardDropdown(false); }}
                                        className={`w-full text-left px-3 py-2 text-sm ${isLight ? (selectedHazard === 'All Hazards' ? 'bg-gray-200 text-[#0093D5]' : 'text-gray-700 hover:bg-gray-100') : (selectedHazard === 'All Hazards' ? 'bg-[#2a2e39] text-amber-400' : 'text-gray-300 hover:bg-[#2a2e39]')}`}
                                    >
                                        All Hazards
                                    </button>
                                    {metadata.hazards.map((hazard, i) => (
                                        <button
                                            key={i}
                                            onClick={() => { setSelectedHazard(hazard); setShowHazardDropdown(false); }}
                                            className={`w-full text-left px-3 py-2 text-sm ${isLight ? (hazard === selectedHazard ? 'bg-gray-200 text-[#0093D5]' : 'text-gray-700 hover:bg-gray-100') : (hazard === selectedHazard ? 'bg-[#2a2e39] text-amber-400' : 'text-gray-300 hover:bg-[#2a2e39]')}`}
                                        >
                                            {hazard}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {metadata && metadata.years.length > 0 && (
                            <select
                                value={selectedYear}
                                onChange={(e) => setSelectedYear(e.target.value)}
                                className="bg-[#2a2e39] text-white text-sm px-3 py-1.5 rounded border-none outline-none"
                            >
                                <option value="All Years">All Years</option>
                                {metadata.years.map(year => (
                                    <option key={year} value={year}>{year}</option>
                                ))}
                            </select>
                        )}
                    </div>
                </div>

                <div className={`mt-2 text-xs ${isLight ? 'text-gray-600' : 'text-gray-400'}`}>
                    {countries} Countries • {date_range}
                </div>
            </div>

            <div className="p-4" style={{ height: 400 }}>
                <ResponsiveContainer width="100%" height={290}>
                    <ComposedChart data={data} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#2a2e39" />
                        <XAxis
                            dataKey="month"
                            stroke="#787b86"
                            tick={{ fill: '#787b86', fontSize: 10 }}
                            axisLine={{ stroke: '#2a2e39' }}
                            interval="preserveStartEnd"
                            minTickGap={20}
                        />
                        <YAxis
                            domain={[0, 5.5]}
                            stroke="#787b86"
                            tick={{ fill: '#787b86', fontSize: 11 }}
                            axisLine={{ stroke: '#2a2e39' }}
                            tickFormatter={(v) => v.toFixed(0)}
                            ticks={[1, 2, 3, 4, 5]}
                            label={{
                                value: 'Risk Level',
                                angle: -90,
                                position: 'insideLeft',
                                fill: '#787b86',
                                fontSize: 11
                            }}
                        />
                        <Tooltip content={<CandleTooltip />} />

                        <ReferenceLine
                            y={4}
                            stroke="#ef4444"
                            strokeDasharray="5 5"
                            strokeOpacity={0.3}
                            label={{
                                value: 'Very High Risk',
                                position: 'right',
                                fill: '#ef4444',
                                fontSize: 9,
                                offset: 5
                            }}
                        />
                        <ReferenceLine
                            y={3}
                            stroke="#f97316"
                            strokeDasharray="5 5"
                            strokeOpacity={0.3}
                            label={{
                                value: 'High Risk',
                                position: 'right',
                                fill: '#f97316',
                                fontSize: 9,
                                offset: 5
                            }}
                        />

                        <Bar dataKey="high" shape={<TradingCandle />} isAnimationActive={false}>
                            {data.map((entry, index) => (<Cell key={index} />))}
                        </Bar>

                        <Line
                            type="monotone"
                            dataKey="close"
                            stroke="#22c55e"
                            strokeWidth={2}
                            strokeDasharray="5 5"
                            dot={false}
                            name="Risk Level"
                            connectNulls
                            opacity={0.7}
                        />

                        <Line
                            type="monotone"
                            dataKey="ma5"
                            stroke="#f97316"
                            strokeWidth={2}
                            dot={false}
                            name="MA-5"
                            connectNulls
                        />
                        <Line
                            type="monotone"
                            dataKey="ma10"
                            stroke="#a855f7"
                            strokeWidth={2}
                            dot={false}
                            name="MA-10"
                            connectNulls
                        />
                    </ComposedChart>
                </ResponsiveContainer>

                <ResponsiveContainer width="100%" height={78}>
                    <ComposedChart data={data} margin={{ top: 0, right: 30, left: 10, bottom: 10 }}>
                        <XAxis dataKey="month" stroke="#787b86" tick={{ fill: '#787b86', fontSize: 10 }} axisLine={{ stroke: '#2a2e39' }} interval="preserveStartEnd" minTickGap={20} />
                        <YAxis stroke="#787b86" tick={{ fill: '#787b86', fontSize: 10 }} axisLine={{ stroke: '#2a2e39' }} width={40} label={{ value: 'Volume', angle: -90, position: 'insideLeft', fill: '#787b86', fontSize: 10 }} />
                        <Tooltip contentStyle={{ backgroundColor: "rgba(13, 20, 36, 0.95)", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.1)", padding: "8px 12px" }} labelStyle={{ color: "#fff", fontSize: 11 }} formatter={(value: any) => [value, 'Countries']} />
                        <Bar dataKey="volume" shape={<VolumeBar />} maxBarSize={20} />
                    </ComposedChart>
                </ResponsiveContainer>
            </div>

            <div className="bg-[#1e222d] border-t border-[#2a2e39] px-4 py-2 flex items-center justify-between text-xs">
                <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1 text-gray-400">
                        <Shield className="w-3 h-3 text-blue-400" />
                        Data Source: WHO STAR Database
                    </span>
                    <span className="text-gray-500">|</span>
                    <span className="text-gray-400">Official Risk Assessment</span>
                </div>
                <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-[#ef4444]"></span>
                        <span className="text-gray-400">Risk ↑</span>
                    </span>
                    <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-[#22c55e]"></span>
                        <span className="text-gray-400">Risk ↓</span>
                    </span>
                    <span className="flex items-center gap-1">
                        <span className="w-8 h-0.5 bg-[#22c55e] opacity-70" style={{ borderTop: '2px dashed #22c55e' }}></span>
                        <span className="text-gray-400">Risk Level</span>
                    </span>
                    <span className="flex items-center gap-1">
                        <span className="w-8 h-2 bg-gradient-to-r from-orange-500 to-orange-500"></span>
                        <span className="text-gray-400">MA-5</span>
                    </span>
                    <span className="flex items-center gap-1">
                        <span className="w-8 h-2 bg-gradient-to-r from-purple-500 to-purple-500"></span>
                        <span className="text-gray-400">MA-10</span>
                    </span>
                </div>
            </div>
        </div>
    );
}
