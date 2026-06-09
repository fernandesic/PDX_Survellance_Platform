import React, { useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell
} from 'recharts'
import { TrendingUp } from 'lucide-react'
import {
  SectionTitle, LoadingSpinner, ErrorAlert,
  Card, StatusBadge, ProgressBar, KPICard
} from '../components/UI'
import { useTheme } from '@/contexts/ThemeContext'
import { useThemeColors } from '@/contexts/useThemeColors'
import { useAsync } from '../hooks/useAsync'
import { fetchPIPIndicators, type PIPIndicator } from '../utils/api'
import clsx from 'clsx'

const OUTPUT_COLORS: Record<string, string> = {
  'Output 1': '#059669', // Teal 600
  'Output 2': '#F97316', // Orange 500
}

function PIPCard({ ind }: { ind: PIPIndicator }) {
  const { theme } = useTheme()
  const colors = useThemeColors()
  const isLight = theme === 'light'
  
  const pct = Math.min(100, Math.round((ind.current_value / ind.target_2025) * 100))
  const barColor = ind.status === 'on_track' ? '#10B981'
    : ind.status === 'achieved' ? '#059669'
    : ind.status === 'at_risk' ? '#F59E0B' : '#6B7280'

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded text-white"
              style={{ backgroundColor: OUTPUT_COLORS[ind.output] ?? '#6D6E71' }}
            >
              {ind.output} · {ind.indicator_id}
            </span>
            <StatusBadge status={ind.status} />
          </div>
          <h3 className={clsx("text-sm font-semibold leading-snug", colors.text.primary)}>{ind.indicator_name}</h3>
          <p className={clsx("text-xs mt-1 leading-relaxed", colors.text.secondary)}>{ind.description}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 text-center">
        <div className={clsx("rounded-lg p-2", isLight ? "bg-gray-50" : "bg-white/5")}>
          <p className={clsx("text-[10px] font-medium", colors.text.muted)}>Baseline 2024</p>
          <p className={clsx("text-lg font-bold", colors.text.primary)}>{ind.baseline_2024}</p>
          <p className={clsx("text-[10px]", colors.text.muted)}>{ind.unit}</p>
        </div>
        <div className={clsx("rounded-lg p-2", isLight ? "bg-emerald-50" : "bg-emerald-500/10")}>
          <p className={clsx("text-[10px] font-medium", isLight ? "text-emerald-400" : "text-emerald-300")}>Current</p>
          <p className={clsx("text-lg font-bold", isLight ? "text-emerald-700" : "text-emerald-200")}>{ind.current_value}</p>
          <p className={clsx("text-[10px]", isLight ? "text-emerald-400" : "text-emerald-400/60")}>{ind.unit}</p>
        </div>
        <div className={clsx("rounded-lg p-2", isLight ? "bg-emerald-50" : "bg-emerald-500/10")}>
          <p className={clsx("text-[10px] font-medium", isLight ? "text-emerald-400" : "text-emerald-300")}>Target 2025</p>
          <p className={clsx("text-lg font-bold", isLight ? "text-emerald-700" : "text-emerald-200")}>{ind.target_2025}</p>
          <p className={clsx("text-[10px]", isLight ? "text-emerald-400" : "text-emerald-400/60")}>{ind.unit}</p>
        </div>
      </div>

      <div>
        <div className={clsx("flex justify-between text-xs mb-1", colors.text.secondary)}>
          <span>Progress to target</span>
          <span className="font-semibold">{pct}%</span>
        </div>
        <ProgressBar value={ind.current_value} max={ind.target_2025} color={barColor} />
      </div>
    </Card>
  )
}

export default function PIPIndicatorsPage() {
  const { theme } = useTheme()
  const colors = useThemeColors()
  const isLight = theme === 'light'
  const primaryBrandHex = isLight ? '#065F46' : '#10B981'
  
  const [activeOutput, setActiveOutput] = useState<string | undefined>(undefined)
  const { data, loading, error } = useAsync(
    () => fetchPIPIndicators(activeOutput),
    [activeOutput]
  )

  const output1 = data?.filter(d => d.output === 'Output 1') ?? []
  const output2 = data?.filter(d => d.output === 'Output 2') ?? []
  const onTrack = data?.filter(d => d.status === 'on_track').length ?? 0
  const atRisk  = data?.filter(d => d.status === 'at_risk').length ?? 0

  // Chart data
  const chartData = data?.map(ind => ({
    name: ind.indicator_id,
    baseline: ind.baseline_2024,
    current: ind.current_value,
    target: ind.target_2025,
    output: ind.output,
  })) ?? []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">PIP Indicators</h1>
          <p className="text-sm text-gray-500 mt-1">Output 1 & Output 2 — Progress tracking (2024–2025)</p>
        </div>
        <div className="flex gap-2">
          {(['Output 1', 'Output 2'] as const).map(o => (
            <button
              key={o}
              onClick={() => setActiveOutput(activeOutput === o ? undefined : o)}
              className={clsx(
                "px-4 py-1.5 text-sm font-semibold rounded-full border transition-all",
                activeOutput === o
                  ? "text-white border-transparent shadow-md"
                  : isLight 
                    ? "text-gray-600 border-gray-300 hover:border-indigo-600 hover:text-indigo-600"
                    : "text-gray-400 border-white/10 hover:border-indigo-400/50 hover:text-indigo-300"
              )}
              style={activeOutput === o ? { backgroundColor: OUTPUT_COLORS[o] } : {}}
            >
              {o}
            </button>
          ))}
        </div>
      </div>

      {/* Summary KPIs */}
      {data && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KPICard title="Total Indicators" value={data.length} icon={<TrendingUp size={18}/>} color={primaryBrandHex} />
          <KPICard title="On Track" value={onTrack} color="#10B981" />
          <KPICard title="At Risk" value={atRisk} color="#F59E0B" />
          <KPICard title="Output 1 / Output 2" value={`${output1.length} / ${output2.length}`} color={primaryBrandHex} />
        </div>
      )}

      {/* Progress bar chart */}
      {data && (
        <Card>
          <SectionTitle subtitle="Baseline → Current → Target comparison by indicator">
            Progress Overview
          </SectionTitle>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isLight ? "#e5e7eb" : "rgba(255,255,255,0.05)"} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: isLight ? '#6b7280' : '#A8C4BB' }} />
              <YAxis tick={{ fontSize: 11, fill: isLight ? '#6b7280' : '#A8C4BB' }} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: isLight ? '#fff' : '#082E23', 
                  borderColor: isLight ? '#e5e7eb' : '#059669',
                  color: isLight ? '#1f2937' : '#fff'
                }}
              />
              <Bar dataKey="baseline" name="Baseline 2024" fill={isLight ? "#D1D5DB" : "rgba(255,255,255,0.1)"} radius={[3,3,0,0]} />
              <Bar dataKey="current" name="Current" radius={[3,3,0,0]}>
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={OUTPUT_COLORS[entry.output] ?? primaryBrandHex} />
                ))}
              </Bar>
              <Bar dataKey="target" name="Target 2025" fill={isLight ? "#DCFCE7" : "rgba(16,185,129,0.1)"} stroke="#10B981" strokeWidth={1} radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className={clsx("flex items-center gap-6 mt-4 text-[10px] font-medium justify-center", colors.text.secondary)}>
            <span className="flex items-center gap-1.5"><span className={clsx("w-3 h-3 rounded", isLight ? "bg-gray-300" : "bg-white/10")}/> Baseline 2024</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-[#059669]"/> Output 1 Current</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-[#F97316]"/> Output 2 Current</span>
            <span className="flex items-center gap-1.5"><span className={clsx("w-3 h-3 rounded border border-emerald-400", isLight ? "bg-green-50" : "bg-emerald-500/10")}/> Target 2025</span>
          </div>
        </Card>
      )}

      {loading && <LoadingSpinner />}
      {error && <ErrorAlert message={error} />}

      {/* Output 1 */}
      {(!activeOutput || activeOutput === 'Output 1') && output1.length > 0 && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <span className="w-1.5 h-8 rounded-full bg-emerald-600" />
            <div>
              <h2 className={clsx("text-base font-bold", colors.text.primary)}>Output 1 — Strengthened Surveillance</h2>
              <p className={clsx("text-xs", colors.text.secondary)}>ILI/SARI sentinel surveillance, virological capacity, data reporting</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {output1.map(ind => <PIPCard key={ind.indicator_id} ind={ind} />)}
          </div>
        </div>
      )}

      {/* Output 2 */}
      {(!activeOutput || activeOutput === 'Output 2') && output2.length > 0 && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <span className="w-1.5 h-8 rounded-full bg-orange-500" />
            <div>
              <h2 className={clsx("text-base font-bold", colors.text.primary)}>Output 2 — Preparedness & Response</h2>
              <p className={clsx("text-xs", colors.text.secondary)}>Vaccination policy, pandemic plans, integration, simulation exercises</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {output2.map(ind => <PIPCard key={ind.indicator_id} ind={ind} />)}
          </div>
        </div>
      )}
    </div>
  )
}
