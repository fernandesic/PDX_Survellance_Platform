/**
 * GhanaIHRTab — IHR / ESPAR capacities for Ghana
 */
import { useState } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { useGhanaIHR } from '../../hooks/useGhanaData';
import { Loader2, TrendingUp } from 'lucide-react';
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer,
} from 'recharts';

export default function GhanaIHRTab() {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const [year, setYear] = useState('2024');
  const years = ['2022', '2023', '2024'];
  const { data, isLoading } = useGhanaIHR(year);
  const ihrData = data as any;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  const capacities = ihrData?.capacity_summary ?? [];
  const overallScore = ihrData?.overall?.value ?? 0;
  const change = ihrData?.overall?.change ?? 0;

  const radarData = capacities.map((c: any, i: number) => ({
    subject: `C${i + 1}`,
    fullName: c.category,
    value: Number(c.value) || 0,
  }));

  const barData = capacities.map((c: any, i: number) => ({
    name: `C${i + 1}`,
    fullName: c.category,
    value: Number(c.value) || 0,
  }));

  const getBarColor = (val: number) =>
    val >= 80 ? '#22c55e' : val >= 60 ? '#eab308' : val >= 40 ? '#f97316' : '#ef4444';

  return (
    <div className="flex flex-col h-full gap-3 pb-2">
      {/* Top Row: Year selector + score card & Radar chart */}
      <div className="flex flex-col md:flex-row gap-3 h-[45%] min-h-[200px]">
        {/* Score card */}
        <div className={`flex-1 rounded-xl border p-4 flex flex-col justify-center ${isLight ? 'bg-white border-gray-100' : 'bg-white/[0.02] border-white/5'}`}>
          <div className="flex items-center justify-between mb-2">
            <h3 className={`text-base font-semibold ${isLight ? 'text-gray-800' : 'text-white'}`}>
              Ghana IHR Score
            </h3>
            <div className="flex gap-1">
              {years.map(y => (
                <button
                  key={y}
                  onClick={() => setYear(y)}
                  className={`px-2 py-0.5 text-[10px] font-semibold rounded-md transition-all ${
                    year === y
                      ? isLight ? 'bg-[#006B3F] text-white' : 'bg-[#FFD700] text-gray-900'
                      : isLight ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' : 'bg-white/5 text-gray-400 hover:bg-white/10'
                  }`}
                >
                  {y}
                </button>
              ))}
            </div>
          </div>
          <p className={`text-4xl font-bold mt-1 ${isLight ? 'text-gray-900' : 'text-white'}`}>
            {overallScore}%
          </p>
          {change !== 0 && (
            <div className="flex items-center gap-1 mt-2">
              <TrendingUp className={`w-4 h-4 ${change > 0 ? 'text-green-500' : 'text-red-500'}`} />
              <span className={`text-xs font-medium ${change > 0 ? 'text-green-500' : 'text-red-500'}`}>
                {change > 0 ? '+' : ''}{change.toFixed(1)}% from {Number(year) - 1}
              </span>
            </div>
          )}
          <div className={`mt-auto grid grid-cols-2 gap-2 text-xs pt-4 ${isLight ? 'text-gray-600' : 'text-gray-400'}`}>
            <p>Capacities ≥80%: <br/><span className="text-green-500 font-bold text-sm">{capacities.filter((c: any) => Number(c.value) >= 80).length}</span></p>
            <p>Capacities &lt;60%: <br/><span className="text-orange-500 font-bold text-sm">{capacities.filter((c: any) => Number(c.value) < 60).length}</span></p>
          </div>
        </div>

        {/* Radar chart */}
        <div className={`flex-[1.5] rounded-xl border p-2 flex flex-col justify-center ${isLight ? 'bg-white border-gray-100' : 'bg-white/[0.02] border-white/5'}`}>
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="75%">
              <PolarGrid stroke={isLight ? '#e5e7eb' : '#334155'} />
              <PolarAngleAxis dataKey="subject" tick={{ fill: isLight ? '#6b7280' : '#94a3b8', fontSize: 10 }} />
              <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
              <Radar name="Ghana" dataKey="value" stroke={isLight ? '#006B3F' : '#FFD700'} fill={isLight ? '#006B3F' : '#FFD700'} fillOpacity={0.25} strokeWidth={2} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bottom Row: Detailed Capacity List (Acts as Legend) */}
      <div className={`flex-1 rounded-xl border p-4 flex flex-col min-h-[180px] overflow-hidden ${isLight ? 'bg-white border-gray-100' : 'bg-white/[0.02] border-white/5'}`}>
        <h3 className={`text-xs font-semibold mb-3 shrink-0 ${isLight ? 'text-gray-800' : 'text-white'}`}>
          Capacity Breakdown & Legend — Ghana {year}
        </h3>
        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
            {capacities.map((c: any, i: number) => {
              const val = Number(c.value) || 0;
              return (
                <div key={i} className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-1.5 truncate pr-2">
                      <span className={`font-mono font-bold shrink-0 ${isLight ? 'text-[#006B3F]' : 'text-[#FFD700]'}`}>
                        C{i + 1}
                      </span>
                      <span className={`truncate ${isLight ? 'text-gray-700' : 'text-gray-300'}`} title={c.category}>
                        {c.category}
                      </span>
                    </div>
                    <span className={`font-bold shrink-0 ${isLight ? 'text-gray-900' : 'text-white'}`}>
                      {val}%
                    </span>
                  </div>
                  <div className={`h-1.5 w-full rounded-full overflow-hidden ${isLight ? 'bg-gray-100' : 'bg-white/10'}`}>
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${val}%`, backgroundColor: getBarColor(val) }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
