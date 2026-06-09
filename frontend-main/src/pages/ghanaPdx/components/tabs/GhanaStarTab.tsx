/**
 * GhanaStarTab — STAR Tracker hazards for Ghana
 */
import { useState } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { useGhanaActiveHazards, useGhanaUpcomingHazards } from '../../hooks/useGhanaData';
import { Loader2, AlertTriangle, TrendingUp } from 'lucide-react';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export default function GhanaStarTab() {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const currentYear = new Date().getFullYear();
  const [month, setMonth] = useState(MONTHS[new Date().getMonth()].toLowerCase());
  const { data: activeData, isLoading: activeLoading } = useGhanaActiveHazards(month);
  const { data: upcomingData } = useGhanaUpcomingHazards(month);
  const active = (activeData as any)?.data;
  const upcoming = (upcomingData as any)?.data;

  const severityColors: Record<string, string> = {
    'Very High': 'bg-red-500', 'High': 'bg-orange-500', 'Moderate': 'bg-yellow-500', 'Low': 'bg-green-500', 'Very Low': 'bg-green-400',
  };

  return (
    <div className="space-y-5">
      {/* Month selector */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {MONTHS.map(m => (
          <button
            key={m}
            onClick={() => setMonth(m.toLowerCase())}
            className={`px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-all ${
              month === m.toLowerCase()
                ? isLight ? 'bg-[#006B3F] text-white' : 'bg-[#FFD700] text-gray-900'
                : isLight ? 'bg-gray-100 text-gray-500 hover:bg-gray-200' : 'bg-white/5 text-gray-400 hover:bg-white/10'
            }`}
          >
            {m} {currentYear}
          </button>
        ))}
      </div>

      {activeLoading ? (
        <div className="flex items-center justify-center h-[300px]">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      ) : (
        <>
          {/* Summary */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className={`rounded-xl border p-4 ${isLight ? 'bg-white border-gray-100' : 'bg-white/[0.02] border-white/5'}`}>
              <p className={`text-[10px] uppercase tracking-wider mb-1 ${isLight ? 'text-gray-500' : 'text-gray-400'}`}>Active Hazards</p>
              <p className={`text-2xl font-bold ${isLight ? 'text-gray-900' : 'text-white'}`}>{active?.total_hazards ?? 0}</p>
            </div>
            {active?.severity_counts && Object.entries(active.severity_counts).map(([sev, count]) => (
              <div key={sev} className={`rounded-xl border p-4 ${isLight ? 'bg-white border-gray-100' : 'bg-white/[0.02] border-white/5'}`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`w-2 h-2 rounded-full ${severityColors[sev] || 'bg-gray-400'}`} />
                  <p className={`text-[10px] uppercase tracking-wider ${isLight ? 'text-gray-500' : 'text-gray-400'}`}>{sev}</p>
                </div>
                <p className={`text-xl font-bold ${isLight ? 'text-gray-900' : 'text-white'}`}>{count as number}</p>
              </div>
            ))}
          </div>

          {/* Hazard list */}
          {active?.hazards?.length > 0 && (
            <div className={`rounded-xl border overflow-hidden ${isLight ? 'bg-white border-gray-100' : 'bg-white/[0.02] border-white/5'}`}>
              <div className="p-4 border-b border-inherit">
                <h3 className={`text-sm font-semibold ${isLight ? 'text-gray-800' : 'text-white'}`}>Active Hazards — Ghana ({month.charAt(0).toUpperCase() + month.slice(1)} {currentYear})</h3>
              </div>
              <div className="divide-y divide-inherit max-h-[400px] overflow-y-auto">
                {active.hazards.map((h: any, idx: number) => (
                  <div key={idx} className={`flex items-center justify-between px-4 py-3 ${isLight ? 'hover:bg-gray-50' : 'hover:bg-white/[0.03]'} transition-colors`}>
                    <div className="flex items-center gap-3">
                      <AlertTriangle size={14} className={h.is_active ? 'text-orange-400' : 'text-gray-400'} />
                      <div>
                        <p className={`text-sm font-medium ${isLight ? 'text-gray-800' : 'text-gray-200'}`}>{h.hazard}</p>
                        <p className={`text-xs ${isLight ? 'text-gray-400' : 'text-gray-500'}`}>{h.hazard_type}</p>
                      </div>
                    </div>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                      h.severity === 'Very High' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                      h.severity === 'High' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' :
                      h.severity === 'Moderate' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' :
                      'bg-green-500/10 text-green-400 border-green-500/20'
                    }`}>
                      {h.severity}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Upcoming hazards */}
          {upcoming?.hazards?.length > 0 && (
            <div className={`rounded-xl border p-5 ${isLight ? 'bg-white border-gray-100' : 'bg-white/[0.02] border-white/5'}`}>
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp size={14} className="text-amber-400" />
                <h3 className={`text-sm font-semibold ${isLight ? 'text-gray-800' : 'text-white'}`}>Upcoming High-Risk Hazards</h3>
              </div>
              <div className="space-y-2">
                {upcoming.hazards.slice(0, 5).map((h: any, idx: number) => (
                  <div key={idx} className={`flex items-center justify-between p-3 rounded-lg ${isLight ? 'bg-gray-50' : 'bg-white/[0.03]'}`}>
                    <span className={`text-sm ${isLight ? 'text-gray-700' : 'text-gray-300'}`}>{h.hazard}</span>
                    <span className={`text-xs font-medium ${h.severity === 'Very High' ? 'text-red-400' : 'text-orange-400'}`}>{h.severity}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
