import React from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend
} from 'recharts';

interface ChartData {
    [key: string]: string | number;
}

interface ChatChartProps {
    data: ChartData[];
    title?: string;
}

const COLORS = ['#6366F1', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#3B82F6', '#EF4444', '#06B6D4'];

export const ChatChart: React.FC<ChatChartProps> = ({ data, title }) => {
    if (!data || data.length === 0) {
        return (
            <div className="p-4 bg-gray-50 rounded-xl text-center text-gray-500">
                No chart data available
            </div>
        );
    }

    const keys = Object.keys(data[0]);
    const numericKeys = keys.filter(k => typeof data[0][k] === 'number');
    const labelKey = keys.find(k => typeof data[0][k] === 'string') || keys[0];

    const useBarChart = data.length > 1 || numericKeys.length > 1;

    if (useBarChart) {
        return (
            <div className="w-full">
                {title && (
                    <h4 className="text-sm font-semibold text-gray-700 mb-3">{title}</h4>
                )}
                <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                            data={data}
                            margin={{ top: 10, right: 10, left: 0, bottom: 20 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                            <XAxis
                                dataKey={labelKey}
                                tick={{ fontSize: 11, fill: '#6B7280' }}
                                angle={-45}
                                textAnchor="end"
                                height={60}
                            />
                            <YAxis tick={{ fontSize: 11, fill: '#6B7280' }} />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: 'white',
                                    border: '1px solid #E5E7EB',
                                    borderRadius: '8px',
                                    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'
                                }}
                            />
                            {numericKeys.map((key, index) => (
                                <Bar
                                    key={key}
                                    dataKey={key}
                                    fill={COLORS[index % COLORS.length]}
                                    radius={[4, 4, 0, 0]}
                                />
                            ))}
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full">
            {title && (
                <h4 className="text-sm font-semibold text-gray-700 mb-3">{title}</h4>
            )}
            <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={numericKeys.map((key, index) => ({
                                name: key,
                                value: data[0][key] as number
                            }))}
                            cx="50%"
                            cy="50%"
                            innerRadius={40}
                            outerRadius={70}
                            paddingAngle={3}
                            dataKey="value"
                            label={({ name, value }) => `${name}: ${value}`}
                            labelLine={false}
                        >
                            {numericKeys.map((_, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                    </PieChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export const parseChartData = (tableData: any[] | null): ChartData[] => {
    if (!tableData || tableData.length === 0) return [];

    return tableData.map(item => {
        const parsed: ChartData = {};
        Object.entries(item).forEach(([key, value]) => {
            if (typeof value === 'string' && !isNaN(Number(value))) {
                parsed[key] = Number(value);
            } else {
                parsed[key] = value as string | number;
            }
        });
        return parsed;
    });
};
