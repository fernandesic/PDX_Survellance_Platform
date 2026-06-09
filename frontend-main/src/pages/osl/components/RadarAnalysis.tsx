// @ts-nocheck
import React from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import type { RankedForwarder } from './types';

interface Props {
    data: RankedForwarder[];
}

const RadarAnalysis: React.FC<Props> = ({ data }) => {
    // Transform data for the chart - we only take top 3 for clarity
    const chartData = data.slice(0, 3).map(item => ({
        subject: item.name,
        A: item.score * 100, // Normalized Score
        B: item.onTimeRate * 100, // Reliability
        C: Math.min(item.avgTransitDays * 5, 100), // Time Factor (inverted visualization roughly)
        fullMark: 100,
    }));

    return (
        <div className="h-[300px] w-full bg-slate-900/40 rounded-lg p-4 border border-purple-500/20">
            <h4 className="text-sm font-semibold text-deepcal-light mb-2 flex items-center">
                <i className="fas fa-project-diagram mr-2"></i>
                Vector Analysis (Top 3)
            </h4>
            <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="80%" data={chartData}>
                    <PolarGrid stroke="#4b5563" />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: '#e2e8f0', fontSize: 12 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="#94a3b8" />
                    <Radar
                        name="Symbolic Score"
                        dataKey="A"
                        stroke="#a855f7"
                        strokeWidth={2}
                        fill="#7e22ce"
                        fillOpacity={0.6}
                    />
                    <Radar
                        name="Reliability %"
                        dataKey="B"
                        stroke="#10b981"
                        strokeWidth={2}
                        fill="#059669"
                        fillOpacity={0.3}
                    />
                    <Tooltip
                        contentStyle={{ backgroundColor: '#1e293b', borderColor: '#7e22ce', color: '#f8fafc' }}
                        itemStyle={{ color: '#e2e8f0' }}
                    />
                    <Legend />
                </RadarChart>
            </ResponsiveContainer>
        </div>
    );
};

export default RadarAnalysis;
