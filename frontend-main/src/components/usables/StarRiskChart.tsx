import { useState, useMemo } from 'react';
import { ComposedChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';
import { TrendingUp, TrendingDown, AlertTriangle, ChevronDown, Shield } from 'lucide-react';

interface HazardMonthlyData {
    month: string;
    month_index: number;
    risk_level: number;
    count: number;
}

interface HazardTypeRisk {
    hazard_type: string;
    monthly_data: HazardMonthlyData[];
    total_events: number;
}

interface StarRiskChartProps {
    data: any[];
    availableYears?: number[];
    hazardTypeMonthlyRisk?: HazardTypeRisk[];
    availableHazardTypes?: string[];
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const TradingViewCandle = (props: any) => {
    const { x, width, payload, background } = props;
    if (!payload || !background) return null;

    const { open, close, high, low, isUp } = payload;

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

    const color = isUp ? '#ef5350' : '#26a69a';
    const candleWidth = Math.max(width * 0.6, 14);
    const centerX = x + width / 2;

    const bodyTop = Math.min(yOpen, yClose);
    const bodyBottom = Math.max(yOpen, yClose);
    const bodyHeight = Math.max(bodyBottom - bodyTop, 4);

    return (
        <g>
            <line
                x1={centerX}
                y1={yHigh}
                x2={centerX}
                y2={bodyTop}
                stroke={color}
                strokeWidth={1.5}
            />
            <line
                x1={centerX}
                y1={bodyBottom}
                x2={centerX}
                y2={yLow}
                stroke={color}
                strokeWidth={1.5}
            />
            <rect
                x={centerX - candleWidth / 2}
                y={bodyTop}
                width={candleWidth}
                height={bodyHeight}
                fill={color}
                stroke={color}
                strokeWidth={0.5}
                rx={2}
            />
        </g>
    );
};

const CandleTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.[0]) return null;
    const d = payload[0].payload;
    const isUp = d.close > d.open;

    const getRiskLabel = (level: number) => {
        if (level >= 4.5) return 'Very High';
        if (level >= 3.5) return 'High';
        if (level >= 2.5) return 'Moderate';
        if (level >= 1.5) return 'Low';
        return 'Very Low';
    };

    return (
        <div className="bg-[#1e222d] border border-[#363a45] rounded px-3 py-2 shadow-lg min-w-[180px]">
            <div className="font-semibold text-white mb-1">{d.month}</div>
            {d.hazardType && (
                <div className="text-amber-400 text-xs mb-2">{d.hazardType}</div>
            )}
            <div className="grid grid-cols-2 gap-x-4 text-xs">
                <span className="text-gray-400">Risk Level:</span>
                <span className={`font-medium ${d.close >= 4 ? 'text-red-400' :
                        d.close >= 3 ? 'text-orange-400' :
                            d.close >= 2 ? 'text-yellow-400' : 'text-green-400'
                    }`}>
                    {d.close?.toFixed(1)} ({getRiskLabel(d.close)})
                </span>
                <span className="text-gray-400">Events:</span>
                <span className="text-white">{d.volume}</span>
                <span className="text-gray-400">Prev Month:</span>
                <span className="text-white">{d.open?.toFixed(1)}</span>
            </div>
            <div className={`mt-2 text-xs flex items-center gap-1 ${isUp ? 'text-[#ef5350]' : 'text-[#26a69a]'}`}>
                {isUp ? '▲ Risk Increased' : '▼ Risk Decreased'}
            </div>
        </div>
    );
};

export default function StarRiskChart({
    data,
    availableYears = [2022, 2023, 2024],
    hazardTypeMonthlyRisk = [],
    availableHazardTypes = []
}: StarRiskChartProps) {
    const [selectedYear, setSelectedYear] = useState(availableYears[availableYears.length - 1] || 2024);
    const [selectedHazardType, setSelectedHazardType] = useState<string | null>(null);
    const [showHazardDropdown, setShowHazardDropdown] = useState(false);

    const hazardTypes = useMemo(() => {
        if (hazardTypeMonthlyRisk.length > 0) {
            return hazardTypeMonthlyRisk.map(h => h.hazard_type).filter(Boolean);
        }
        return availableHazardTypes;
    }, [hazardTypeMonthlyRisk, availableHazardTypes]);

    const chartData = useMemo(() => {
        if (hazardTypeMonthlyRisk.length > 0) {
            const hazardData = selectedHazardType
                ? hazardTypeMonthlyRisk.find(h => h.hazard_type === selectedHazardType)
                : hazardTypeMonthlyRisk[0];

            if (!hazardData) return [];

            const monthlyData = hazardData.monthly_data || [];

            return monthlyData.map((m, i) => {
                const prevRisk = i > 0 ? monthlyData[i - 1].risk_level : m.risk_level;
                const currentRisk = m.risk_level;

                return {
                    month: m.month,
                    monthIndex: m.month_index,
                    open: prevRisk,
                    close: currentRisk,
                    high: Math.max(prevRisk, currentRisk),
                    low: Math.min(prevRisk, currentRisk),
                    volume: m.count,
                    isUp: currentRisk > prevRisk,
                    hazardType: hazardData.hazard_type,
                };
            });
        }

        return MONTHS.map((month, i) => ({
            month,
            monthIndex: i,
            open: 2,
            close: 2,
            high: 2,
            low: 2,
            volume: 0,
            isUp: false,
        }));
    }, [hazardTypeMonthlyRisk, selectedHazardType]);

    const ytdChange = useMemo(() => {
        if (chartData.length < 2) return '0.0';
        const first = chartData[0].open || 1;
        const last = chartData[chartData.length - 1].close || 1;
        return ((last - first) / first * 100).toFixed(1);
    }, [chartData]);

    const isRiskUp = parseFloat(ytdChange) > 0;
    const currentHazard = selectedHazardType || hazardTypes[0] || 'All Hazards';

    return (
        <div className="bg-[#131722] rounded-lg border border-[#2a2e39] overflow-hidden">
            <div className="bg-[#1e222d] border-b border-[#2a2e39] px-4 py-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <Shield className="w-5 h-5 text-amber-400" />
                            <span className="text-white font-semibold">STAR Risk Index</span>
                        </div>
                        <div className={`flex items-center gap-1 ${isRiskUp ? 'text-[#ef5350]' : 'text-[#26a69a]'}`}>
                            {isRiskUp ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                            <span className="text-sm font-medium">{ytdChange}% YTD</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <button
                                onClick={() => setShowHazardDropdown(!showHazardDropdown)}
                                className="flex items-center gap-2 bg-[#2a2e39] hover:bg-[#363a45] text-white px-3 py-1.5 rounded text-sm"
                            >
                                <AlertTriangle className="w-4 h-4 text-amber-400" />
                                <span className="max-w-[150px] truncate">{currentHazard}</span>
                                <ChevronDown className="w-4 h-4" />
                            </button>

                            {showHazardDropdown && (
                                <div className="absolute right-0 top-full mt-1 bg-[#1e222d] border border-[#2a2e39] rounded shadow-xl z-50 max-h-64 overflow-y-auto w-56">
                                    {hazardTypes.map((type, i) => (
                                        <button
                                            key={i}
                                            onClick={() => {
                                                setSelectedHazardType(type);
                                                setShowHazardDropdown(false);
                                            }}
                                            className={`w-full text-left px-3 py-2 text-sm hover:bg-[#2a2e39] ${type === selectedHazardType ? 'bg-[#2a2e39] text-amber-400' : 'text-gray-300'
                                                }`}
                                        >
                                            {type}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <select
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(Number(e.target.value))}
                            className="bg-[#2a2e39] text-white text-sm px-3 py-1.5 rounded border-none outline-none"
                        >
                            {availableYears.map(y => (
                                <option key={y} value={y}>{y}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            <div className="p-4" style={{ height: 380 }}>
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#2a2e39" />
                        <XAxis
                            dataKey="month"
                            stroke="#787b86"
                            tick={{ fill: '#787b86', fontSize: 11 }}
                            axisLine={{ stroke: '#2a2e39' }}
                        />
                        <YAxis
                            domain={[0, 5.5]}
                            stroke="#787b86"
                            tick={{ fill: '#787b86', fontSize: 11 }}
                            axisLine={{ stroke: '#2a2e39' }}
                            tickFormatter={(v) => v.toFixed(0)}
                            ticks={[1, 2, 3, 4, 5]}
                            label={{ value: 'Risk Level', angle: -90, position: 'insideLeft', fill: '#787b86', fontSize: 11 }}
                        />
                        <Tooltip content={<CandleTooltip />} />

                        <ReferenceLine y={5} stroke="#ef4444" strokeDasharray="3 3" strokeOpacity={0.4} label={{ value: 'Very High', fill: '#ef4444', fontSize: 9, position: 'right' }} />
                        <ReferenceLine y={4} stroke="#f97316" strokeDasharray="3 3" strokeOpacity={0.3} />
                        <ReferenceLine y={3} stroke="#eab308" strokeDasharray="3 3" strokeOpacity={0.3} />
                        <ReferenceLine y={2} stroke="#22c55e" strokeDasharray="3 3" strokeOpacity={0.3} />

                        <Bar
                            dataKey="high"
                            shape={<TradingViewCandle />}
                            isAnimationActive={false}
                        >
                            {chartData.map((entry, index) => (
                                <Cell key={index} />
                            ))}
                        </Bar>
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
                        <span className="w-2 h-2 rounded-full bg-[#ef5350]"></span>
                        <span className="text-gray-400">Risk ↑</span>
                    </span>
                    <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-[#26a69a]"></span>
                        <span className="text-gray-400">Risk ↓</span>
                    </span>
                </div>
            </div>
        </div>
    );
}
