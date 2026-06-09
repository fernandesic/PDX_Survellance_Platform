import { useState, useMemo } from 'react';
import { TrendingUp, TrendingDown, Calendar, Info } from 'lucide-react';

interface CandleData {
    month: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    change: number;
}

interface CountryCandles {
    country: string;
    code: string;
    candles: CandleData[];
    avgRisk: number;
    trend: 'up' | 'down' | 'stable';
}

interface StarCandlestickChartProps {
    data: any[];
    availableYears?: number[];
}

const generateCandleData = (seasonality: number[] = []): CandleData[] => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    return months.map((month, i) => {
        const baseRisk = seasonality[i] || (Math.random() * 3 + 1);
        const variance = Math.random() * 1.5;
        const open = Math.max(1, Math.min(5, baseRisk - variance / 2));
        const close = Math.max(1, Math.min(5, baseRisk + variance / 2));
        const high = Math.max(open, close) + Math.random() * 0.5;
        const low = Math.min(open, close) - Math.random() * 0.5;

        return {
            month,
            open: Math.round(open * 10) / 10,
            high: Math.min(5, Math.round(high * 10) / 10),
            low: Math.max(1, Math.round(low * 10) / 10),
            close: Math.round(close * 10) / 10,
            volume: Math.floor(Math.random() * 20) + 5,
            change: close - open,
        };
    });
};

const Candlestick = ({
    candle,
    width,
    height,
    maxY = 5
}: {
    candle: CandleData;
    width: number;
    height: number;
    maxY?: number;
}) => {
    const scale = (val: number) => height - (val / maxY) * height;
    const isGreen = candle.close >= candle.open;
    const bodyTop = scale(Math.max(candle.open, candle.close));
    const bodyBottom = scale(Math.min(candle.open, candle.close));
    const bodyHeight = Math.max(2, bodyBottom - bodyTop);
    const wickTop = scale(candle.high);
    const wickBottom = scale(candle.low);
    const centerX = width / 2;
    const bodyWidth = width * 0.6;

    return (
        <g>
            {/* Wick */}
            <line
                x1={centerX}
                y1={wickTop}
                x2={centerX}
                y2={wickBottom}
                stroke={isGreen ? '#10b981' : '#ef4444'}
                strokeWidth={1}
            />
            <rect
                x={centerX - bodyWidth / 2}
                y={bodyTop}
                width={bodyWidth}
                height={bodyHeight}
                fill={isGreen ? '#10b981' : '#ef4444'}
                rx={1}
            />
        </g>
    );
};

const MiniCandleChart = ({
    candles,
    width = 120,
    height = 40
}: {
    candles: CandleData[];
    width?: number;
    height?: number;
}) => {
    const candleWidth = width / 12;

    return (
        <svg width={width} height={height} className="overflow-visible">
            <defs>
                <linearGradient id="chartBg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgba(255,255,255,0.02)" />
                    <stop offset="100%" stopColor="rgba(0,0,0,0.1)" />
                </linearGradient>
            </defs>
            <rect x={0} y={0} width={width} height={height} fill="url(#chartBg)" rx={4} />

            <line x1={0} y1={height * 0.2} x2={width} y2={height * 0.2} stroke="rgba(239,68,68,0.3)" strokeDasharray="2,2" />
            <line x1={0} y1={height * 0.5} x2={width} y2={height * 0.5} stroke="rgba(251,191,36,0.2)" strokeDasharray="2,2" />

            {candles.map((candle, i) => (
                <g key={i} transform={`translate(${i * candleWidth}, 0)`}>
                    <Candlestick candle={candle} width={candleWidth} height={height} />
                </g>
            ))}
        </svg>
    );
};

const VolumeBar = ({ candles, width = 120, height = 16 }: { candles: CandleData[]; width?: number; height?: number }) => {
    const maxVol = Math.max(...candles.map(c => c.volume));
    const barWidth = width / 12;

    return (
        <svg width={width} height={height}>
            {candles.map((candle, i) => {
                const barHeight = (candle.volume / maxVol) * height;
                const isGreen = candle.close >= candle.open;
                return (
                    <rect
                        key={i}
                        x={i * barWidth + barWidth * 0.2}
                        y={height - barHeight}
                        width={barWidth * 0.6}
                        height={barHeight}
                        fill={isGreen ? 'rgba(16,185,129,0.4)' : 'rgba(239,68,68,0.4)'}
                        rx={1}
                    />
                );
            })}
        </svg>
    );
};

export default function StarCandlestickChart({ data, availableYears = [2022, 2023, 2024] }: StarCandlestickChartProps) {
    const [selectedYear, setSelectedYear] = useState(availableYears[availableYears.length - 1] || 2024);
    const [sortBy, setSortBy] = useState<'risk' | 'name' | 'trend'>('risk');
    const [showInfo, setShowInfo] = useState(false);

    const countryCandles: CountryCandles[] = useMemo(() => {
        return data.map(country => {
            const candles = generateCandleData(country.seasonality);
            const avgRisk = candles.reduce((sum, c) => sum + c.close, 0) / candles.length;
            const firstHalf = candles.slice(0, 6).reduce((sum, c) => sum + c.close, 0) / 6;
            const secondHalf = candles.slice(6).reduce((sum, c) => sum + c.close, 0) / 6;
            const trend = secondHalf > firstHalf + 0.3 ? 'up' : secondHalf < firstHalf - 0.3 ? 'down' : 'stable';

            return {
                country: country.country,
                code: country.code,
                candles,
                avgRisk,
                trend,
            };
        });
    }, [data]);

    const sortedCountries = useMemo(() => {
        return [...countryCandles].sort((a, b) => {
            switch (sortBy) {
                case 'risk': return b.avgRisk - a.avgRisk;
                case 'name': return a.country.localeCompare(b.country);
                case 'trend': return a.trend === 'up' ? -1 : b.trend === 'up' ? 1 : 0;
                default: return 0;
            }
        });
    }, [countryCandles, sortBy]);

    return (
        <div className="w-full mb-6">
            <div className="bg-[#0d1424] rounded-t-xl border border-white/5 px-5 py-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></div>
                        <h2 className="text-lg font-semibold text-white">STAR Risk Monitor</h2>
                        <span className="text-xs text-gray-500 bg-white/5 px-2 py-1 rounded">Candlestick View</span>
                        <button onClick={() => setShowInfo(!showInfo)} className="p-1 hover:bg-white/5 rounded">
                            <Info className="w-4 h-4 text-gray-500" />
                        </button>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 bg-[#1a2744] rounded-lg px-3 py-1.5 border border-white/10">
                            <Calendar className="w-4 h-4 text-gray-400" />
                            <select
                                value={selectedYear}
                                onChange={(e) => setSelectedYear(Number(e.target.value))}
                                className="bg-transparent text-sm text-gray-300 focus:outline-none"
                            >
                                {availableYears.map(year => (
                                    <option key={year} value={year}>{year}</option>
                                ))}
                            </select>
                        </div>

                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value as any)}
                            className="bg-[#1a2744] border border-white/10 rounded-lg px-3 py-1.5 text-sm text-gray-300 focus:outline-none"
                        >
                            <option value="risk">Sort: Risk ↓</option>
                            <option value="name">Sort: Name</option>
                            <option value="trend">Sort: Trending</option>
                        </select>
                    </div>
                </div>

                {showInfo && (
                    <div className="mt-4 p-3 bg-white/[0.02] rounded-lg border border-white/5 text-sm text-gray-400">
                        <p className="mb-2">📊 <strong className="text-white">Candlestick Legend:</strong></p>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-4 bg-emerald-500 rounded-sm"></div>
                                <span>Green = Risk decreased (bullish)</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-4 bg-red-500 rounded-sm"></div>
                                <span>Red = Risk increased (bearish)</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-px h-4 bg-gray-400"></div>
                                <span>Wick = High/Low range</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-2 bg-gray-500/40 rounded-sm"></div>
                                <span>Volume = Hazard count</span>
                            </div>
                        </div>
                    </div>
                )}

                <div className="flex justify-end mt-3 pr-4">
                    <div className="flex gap-0 text-[9px] text-gray-600 w-[120px]">
                        {['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'].map((m, i) => (
                            <span key={i} className="w-[10px] text-center">{m}</span>
                        ))}
                    </div>
                </div>
            </div>

            <div className="bg-[#0a0f18] rounded-b-xl border border-white/5 border-t-0 p-4">
                <div className="grid grid-cols-4 gap-3">
                    {sortedCountries.slice(0, 20).map((country) => (
                        <div
                            key={country.country}
                            className="bg-[#0d1424] rounded-xl p-4 border border-white/5 hover:border-cyan-500/30 transition-all group cursor-pointer"
                        >
                            <div className="flex items-center justify-between mb-3">
                                <div>
                                    <div className="text-white font-semibold truncate" title={country.country}>
                                        {country.country}
                                    </div>
                                    <div className="text-gray-500 text-xs">{country.code}</div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xl font-bold text-white">
                                        {country.avgRisk.toFixed(1)}
                                    </span>
                                    {country.trend === 'up' && <TrendingUp className="w-4 h-4 text-red-400" />}
                                    {country.trend === 'down' && <TrendingDown className="w-4 h-4 text-emerald-400" />}
                                </div>
                            </div>

                            <MiniCandleChart candles={country.candles} width={120} height={40} />

                            <div className="mt-1">
                                <VolumeBar candles={country.candles} width={120} height={12} />
                            </div>
                        </div>
                    ))}
                </div>

                <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/5">
                    <div className="text-sm text-gray-500">
                        {sortedCountries.length} countries • Year {selectedYear}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                            <TrendingUp className="w-3 h-3 text-red-400" />
                            Rising: {sortedCountries.filter(c => c.trend === 'up').length}
                        </span>
                        <span className="flex items-center gap-1">
                            <TrendingDown className="w-3 h-3 text-emerald-400" />
                            Falling: {sortedCountries.filter(c => c.trend === 'down').length}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
