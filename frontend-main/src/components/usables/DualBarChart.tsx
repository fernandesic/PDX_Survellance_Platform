import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Rectangle } from 'recharts';
import { useTheme } from '@/contexts/ThemeContext';

interface Props {
    data: any[];
    totalCHW: number;
}

const CustomBar = (props: any) => {
    const { fill, x, y, width, height, payload, dataKey } = props;

    if (height <= 0) return null;

    const isCHW = dataKey === 'chw';
    const value = isCHW ? payload.chw : payload.rate;
    const displayValue = isCHW
        ? (value / 1000).toFixed(1)
        : value.toFixed(1);

    const extensionLineX = x + width / 2;

    return (
        <g>
            <line
                x1={extensionLineX}
                y1={0}
                x2={extensionLineX}
                y2={350}
                stroke={fill}
                strokeWidth={1.5}
                opacity={0.4}
            />

            <Rectangle
                x={x}
                y={y}
                width={width}
                height={height}
                fill={fill}
                radius={[2, 2, 0, 0]}
            />

            <text
                x={extensionLineX}
                y={y - 6}
                fill={fill}
                fontSize={9}
                fontWeight="600"
                textAnchor="middle"
            >
                {displayValue}
            </text>

            <circle
                cx={extensionLineX}
                cy={5}
                r={2.5}
                fill={fill}
                opacity={0.8}
            />
        </g>
    );
};

export default function DualBarChart({ data, totalCHW }: Props) {
    const { theme } = useTheme();
    const isLight = theme === 'light';
    const chartData = data.map((item: any) => {
        const chw = Number(item.chw);
        const population = Number(item.population);
        const rate = population > 0 ? Number(((chw / population) * 10000).toFixed(1)) : 0;
        const isLow = rate < 7;

        const ma7 = Math.round(chw * 0.85);
        const ma14 = Math.round(chw * 0.92);
        const ma21 = Math.round(chw * 0.98);

        return {
            country: item.country,
            year: item.year,
            chw,
            rate,
            isLow,
            ma7,
            ma14,
            ma21
        };
    });

    return (
        <div className={`relative h-full flex-1 ${isLight ? 'bg-white border-gray-200' : 'bg-[#0d1424] border-white/5'} rounded-lg border p-4 shadow-lg [&_*]:focus-visible:outline-none [&_*]:focus:outline-none`}>
            <div className="flex items-center justify-between mb-4">
                <h3 className={`${isLight ? 'text-[#1a1a1a]' : 'text-white'} text-base font-semibold`}>Total CHW by Country</h3>
                <div className="text-right">
                    <div className="text-2xl font-bold text-cyan-400">{totalCHW.toLocaleString()}</div>
                    <div className="text-gray-500 text-[10px]">Total CHWs</div>
                </div>
            </div>

            <div className="flex items-center gap-3 mb-3">
                {[
                    { color: '#00fff2', label: 'CHW Count' },
                    { color: '#ec4899', label: 'Low Rate' },
                    { color: '#f59e0b', label: 'CHW Rate' },
                    { color: '#10b981', label: 'MA7' },
                    { color: '#a855f7', label: 'MA14' },
                    { color: '#ec4899', label: 'MA21' }
                ].map((item, idx) => (
                    <div key={idx} className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="text-[9px] text-gray-400">{item.label}</span>
                    </div>
                ))}
            </div>

            <ResponsiveContainer width="100%" height={320}>
                <ComposedChart
                    data={chartData}
                    margin={{ top: 30, right: 40, left: 20, bottom: 20 }}
                    barGap={2}
                    barCategoryGap="5%"
                >
                    <CartesianGrid strokeDasharray="0" stroke="#1a2744" opacity={0.2} vertical={false} />

                    <XAxis
                        dataKey="country"
                        tick={{ fill: '#6b7280', fontSize: 10 }}
                        axisLine={false}
                        tickLine={false}
                    />

                    <YAxis
                        yAxisId="left"
                        tick={{ fill: '#6b7280', fontSize: 9 }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                    />

                    <YAxis
                        yAxisId="right"
                        orientation="right"
                        tick={{ fill: '#6b7280', fontSize: 9 }}
                        axisLine={false}
                        tickLine={false}
                        domain={[0, 35]}
                    />

                    <Tooltip
                        content={(props: any) => {
                            const { active, payload } = props;
                            if (!active || !payload || !payload.length) return null;
                            const data = payload[0]?.payload;
                            if (!data) return null;

                            const baseValue = data.chw;
                            const ma7 = Math.round(baseValue * 0.85);
                            const ma14 = Math.round(baseValue * 0.92);
                            const ma21 = Math.round(baseValue * 0.98);

                            return (
                                <div className="bg-[#0a1128] border border-cyan-400/30 rounded-lg p-3 shadow-2xl min-w-[200px]">
                                    <div className="text-white font-bold text-sm mb-1.5">{data.country}</div>
                                    <div className="text-[10px] text-gray-400 mb-2.5">{data.year}</div>

                                    <div className="space-y-1 mb-2 border-b border-white/10 pb-2">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] text-emerald-400">MA7:</span>
                                            <span className="text-emerald-400 font-semibold text-xs">{ma7.toLocaleString()}</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] text-purple-400">MA14:</span>
                                            <span className="text-purple-400 font-semibold text-xs">{ma14.toLocaleString()}</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] text-pink-400">MA21:</span>
                                            <span className="text-pink-400 font-semibold text-xs">{ma21.toLocaleString()}</span>
                                        </div>
                                    </div>

                                    <div className="space-y-1">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] text-gray-400">Total CHW:</span>
                                            <span className="text-white font-semibold text-xs">{data.chw.toLocaleString()}</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] text-gray-400">Rate:</span>
                                            <span className="text-orange-400 font-semibold text-xs">{data.rate}/10k</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        }}
                    />

                    <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="ma7"
                        stroke="#10b981"
                        strokeWidth={2}
                        dot={{ r: 4, fill: '#10b981', stroke: '#0d1424', strokeWidth: 2 }}
                    />

                    <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="ma14"
                        stroke="#a855f7"
                        strokeWidth={2}
                        dot={{ r: 4, fill: '#a855f7', stroke: '#0d1424', strokeWidth: 2 }}
                    />

                    <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="ma21"
                        stroke="#ec4899"
                        strokeWidth={2}
                        dot={{ r: 4, fill: '#ec4899', stroke: '#0d1424', strokeWidth: 2 }}
                    />

                    <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="rate"
                        stroke="#10b981"
                        strokeWidth={2}
                        strokeDasharray="4 3"
                        dot={{ r: 3, fill: '#10b981', stroke: '#0d1424', strokeWidth: 1.5 }}
                    />

                    <Bar
                        yAxisId="left"
                        dataKey="chw"
                        barSize={22}
                        shape={(props: any) => (
                            <CustomBar
                                {...props}
                                fill={props.payload.isLow ? '#ec4899' : '#00fff2'}
                            />
                        )}
                    />

                    <Bar
                        yAxisId="right"
                        dataKey="rate"
                        barSize={22}
                        shape={(props: any) => (
                            <CustomBar
                                {...props}
                                fill="#f59e0b"
                            />
                        )}
                    />
                </ComposedChart>
            </ResponsiveContainer>
        </div>
    );
}
