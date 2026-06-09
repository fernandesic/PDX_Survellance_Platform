/**
 * GhanaCHWTab — Community Health Workers for Ghana
 *
 * Enhanced with:
 *  - Population context card with CHW-to-population ratio visual
 *  - Density gauge ring
 *  - WHO benchmark comparison
 *  - Regional breakdown table (when available)
 *  - Worker type breakdown (when available)
 */
import { useTheme } from '@/contexts/ThemeContext';
import { useGhanaCHWSummary, useGhanaCHWDetail, useGhanaCHWWorkerTypes } from '../../hooks/useGhanaData';
import { Loader2, Users, MapPin, Heart, Building2, TrendingUp } from 'lucide-react';

const WHO_BENCHMARK = 23; // WHO recommended minimum CHWs per 10,000 population

export default function GhanaCHWTab() {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const { data: ghanaSummary, isLoading: summaryLoading } = useGhanaCHWSummary();
  const ghana = ghanaSummary as any;
  const ghanaId = ghana?.id;
  const { data: detail, isLoading: detailLoading } = useGhanaCHWDetail(ghanaId);
  const { data: workerTypes, isLoading: wtLoading } = useGhanaCHWWorkerTypes(ghanaId);

  const isLoading = summaryLoading || detailLoading;
  const detailData = detail as any;
  const wtData = (workerTypes ?? []) as any[];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!ghana) {
    return (
      <div className={`text-center py-16 ${isLight ? 'text-gray-500' : 'text-gray-400'}`}>
        <Users size={40} className="mx-auto mb-3 opacity-40" />
        <p className="text-sm">No CHW data available for Ghana</p>
      </div>
    );
  }

  const regions = detailData?.regions ?? [];
  const density = ghana.chws_per_10000 ?? 0;
  const densityPct = Math.min((density / WHO_BENCHMARK) * 100, 100);
  const population = ghana.population_2024 ?? 0;
  const totalCHW = ghana.total_chws ?? 0;
  const totalDistricts = ghana.total_districts ?? 0;
  const totalFacilities = ghana.total_facilities ?? 0;

  const kpis = [
    { label: 'Total CHWs', value: totalCHW.toLocaleString(), icon: Users, color: 'text-sky-400', bg: 'bg-sky-500/10' },
    { label: 'Population', value: population >= 1_000_000 ? `${(population / 1_000_000).toFixed(1)}M` : population.toLocaleString(), icon: Heart, color: 'text-rose-400', bg: 'bg-rose-500/10' },
    { label: 'Regions', value: ghana.total_regions ?? regions.length ?? '—', icon: MapPin, color: 'text-violet-400', bg: 'bg-violet-500/10' },
    { label: 'Districts', value: totalDistricts || '—', icon: Building2, color: 'text-amber-400', bg: 'bg-amber-500/10' },
  ];

  return (
    <div className="flex flex-col h-full gap-4 pb-2">
      {/* Top Row: KPI cards + Density Gauge */}
      <div className="flex flex-col md:flex-row gap-3 shrink-0">
        {/* KPIs */}
        <div className="flex-1 grid grid-cols-2 gap-3">
          {kpis.map((kpi) => {
            const Icon = kpi.icon;
            return (
              <div
                key={kpi.label}
                className={`rounded-xl border p-3 flex items-center gap-3 ${isLight ? 'bg-white border-gray-100' : 'bg-white/[0.02] border-white/5'}`}
              >
                <div className={`w-9 h-9 rounded-lg shrink-0 flex items-center justify-center ${kpi.bg}`}>
                  <Icon size={16} className={kpi.color} />
                </div>
                <div className="min-w-0">
                  <p className={`text-[10px] uppercase tracking-wider font-medium ${isLight ? 'text-gray-500' : 'text-gray-400'}`}>{kpi.label}</p>
                  <p className={`text-xl font-bold ${isLight ? 'text-gray-900' : 'text-white'}`}>{kpi.value}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Density Gauge Card */}
        <div className={`w-full md:w-64 rounded-xl border p-4 flex flex-col items-center justify-center ${isLight ? 'bg-white border-gray-100' : 'bg-white/[0.02] border-white/5'}`}>
          <p className={`text-[10px] uppercase tracking-wider font-medium mb-2 ${isLight ? 'text-gray-500' : 'text-gray-400'}`}>
            CHW Density / 10k
          </p>
          <div className="relative w-24 h-24">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="42" fill="none" stroke={isLight ? '#e5e7eb' : '#1e293b'} strokeWidth="8" />
              <circle
                cx="50" cy="50" r="42" fill="none"
                stroke={densityPct >= 80 ? '#22c55e' : densityPct >= 50 ? '#eab308' : '#ef4444'}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${(densityPct / 100) * 263.9} 263.9`}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`text-xl font-bold ${isLight ? 'text-gray-900' : 'text-white'}`}>{density.toFixed(1)}</span>
            </div>
          </div>
          <div className="mt-2 text-center">
            <p className={`text-[9px] ${isLight ? 'text-gray-400' : 'text-gray-500'}`}>
              WHO Target: {WHO_BENCHMARK}/10k
            </p>
            <div className="flex items-center gap-1 mt-1">
              <TrendingUp size={10} className={densityPct >= 80 ? 'text-green-400' : densityPct >= 50 ? 'text-yellow-400' : 'text-red-400'} />
              <span className={`text-[10px] font-semibold ${densityPct >= 80 ? 'text-green-400' : densityPct >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                {densityPct.toFixed(0)}% of target
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Middle Row: Workforce composition bar (visual infographic) */}
      <div className={`rounded-xl border p-4 shrink-0 ${isLight ? 'bg-white border-gray-100' : 'bg-white/[0.02] border-white/5'}`}>
        <h3 className={`text-xs font-semibold mb-3 ${isLight ? 'text-gray-800' : 'text-white'}`}>Workforce Coverage Breakdown</h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className={`text-[10px] uppercase tracking-wider ${isLight ? 'text-gray-500' : 'text-gray-400'}`}>CHW per Citizen</p>
            <p className={`text-lg font-bold ${isLight ? 'text-gray-900' : 'text-white'}`}>
              1 : {population && totalCHW ? Math.round(population / totalCHW).toLocaleString() : '—'}
            </p>
            <p className={`text-[9px] mt-0.5 ${isLight ? 'text-gray-400' : 'text-gray-500'}`}>One CHW serves this many people</p>
          </div>
          <div>
            <p className={`text-[10px] uppercase tracking-wider ${isLight ? 'text-gray-500' : 'text-gray-400'}`}>CHWs per District</p>
            <p className={`text-lg font-bold ${isLight ? 'text-gray-900' : 'text-white'}`}>
              {totalDistricts && totalCHW ? Math.round(totalCHW / totalDistricts).toLocaleString() : '—'}
            </p>
            <p className={`text-[9px] mt-0.5 ${isLight ? 'text-gray-400' : 'text-gray-500'}`}>Average per administrative district</p>
          </div>
          <div>
            <p className={`text-[10px] uppercase tracking-wider ${isLight ? 'text-gray-500' : 'text-gray-400'}`}>Gap to WHO Target</p>
            <p className={`text-lg font-bold ${density >= WHO_BENCHMARK ? 'text-green-400' : 'text-orange-400'}`}>
              {density >= WHO_BENCHMARK
                ? '✓ Met'
                : `+${Math.round(((WHO_BENCHMARK - density) / 10000) * population).toLocaleString()}`}
            </p>
            <p className={`text-[9px] mt-0.5 ${isLight ? 'text-gray-400' : 'text-gray-500'}`}>
              {density >= WHO_BENCHMARK ? 'Target reached' : 'Additional CHWs needed'}
            </p>
          </div>
        </div>
      </div>

      {/* Bottom: Regions table or Worker types */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {regions.length > 0 && (
          <div className={`rounded-xl border overflow-hidden mb-3 ${isLight ? 'bg-white border-gray-100' : 'bg-white/[0.02] border-white/5'}`}>
            <div className="p-4 border-b border-inherit">
              <h3 className={`text-sm font-semibold ${isLight ? 'text-gray-800' : 'text-white'}`}>Regional Breakdown</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className={isLight ? 'bg-gray-50 text-gray-600' : 'bg-white/[0.03] text-gray-400'}>
                    <th className="text-left px-4 py-2.5 font-medium">Region</th>
                    <th className="text-right px-4 py-2.5 font-medium">CHWs</th>
                    <th className="text-right px-4 py-2.5 font-medium">Density /10k</th>
                    <th className="text-right px-4 py-2.5 font-medium">Districts</th>
                  </tr>
                </thead>
                <tbody>
                  {regions.map((r: any, idx: number) => {
                    const rDensity =
                      r.total_chws && r.total_population
                        ? (r.total_chws / r.total_population) * 10000
                        : null;
                    return (
                      <tr
                        key={r.id ?? idx}
                        className={`border-t transition-colors ${
                          isLight ? 'border-gray-100 hover:bg-gray-50' : 'border-white/5 hover:bg-white/[0.03]'
                        }`}
                      >
                        <td className={`px-4 py-2.5 font-medium ${isLight ? 'text-gray-800' : 'text-gray-200'}`}>{r.region_name}</td>
                        <td className={`px-4 py-2.5 text-right ${isLight ? 'text-gray-600' : 'text-gray-300'}`}>{r.total_chws?.toLocaleString() ?? '—'}</td>
                        <td className={`px-4 py-2.5 text-right ${isLight ? 'text-gray-600' : 'text-gray-300'}`}>{rDensity != null ? rDensity.toFixed(1) : '—'}</td>
                        <td className={`px-4 py-2.5 text-right ${isLight ? 'text-gray-600' : 'text-gray-300'}`}>{r.district_count ?? '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Worker types */}
        {wtData.length > 0 && (
          <div className={`rounded-xl border p-4 ${isLight ? 'bg-white border-gray-100' : 'bg-white/[0.02] border-white/5'}`}>
            <h3 className={`text-sm font-semibold mb-3 ${isLight ? 'text-gray-800' : 'text-white'}`}>Worker Type Breakdown</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {wtData.map((wt: any, idx: number) => {
                const pct = totalCHW ? ((wt.count ?? 0) / totalCHW) * 100 : 0;
                return (
                  <div
                    key={idx}
                    className={`flex items-center justify-between p-3 rounded-lg ${
                      isLight ? 'bg-gray-50' : 'bg-white/[0.03]'
                    }`}
                  >
                    <div className="flex-1 min-w-0 mr-3">
                      <span className={`text-sm truncate block ${isLight ? 'text-gray-700' : 'text-gray-300'}`}>{wt.worker_type || wt.name}</span>
                      <div className={`mt-1 h-1 rounded-full overflow-hidden ${isLight ? 'bg-gray-200' : 'bg-white/10'}`}>
                        <div className="h-full rounded-full bg-sky-500 transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                    <span className={`text-sm font-semibold shrink-0 ${isLight ? 'text-gray-900' : 'text-white'}`}>
                      {(wt.count ?? wt.total)?.toLocaleString() ?? '—'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Empty state when no drill-down data */}
        {regions.length === 0 && wtData.length === 0 && (
          <div className={`rounded-xl border p-6 text-center ${isLight ? 'bg-gray-50 border-gray-100 text-gray-500' : 'bg-white/[0.01] border-white/5 text-gray-400'}`}>
            <MapPin size={28} className="mx-auto mb-2 opacity-30" />
            <p className="text-xs">Regional and worker-type breakdowns will appear once detailed data is imported for Ghana.</p>
          </div>
        )}
      </div>
    </div>
  );
}
