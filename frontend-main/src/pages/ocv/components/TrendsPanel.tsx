import {
  AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { ANTIGENS, TREND_YEARS } from '../constants/ocv'
import { fmt } from '../services/ocv'
import { useTheme } from '@/contexts/ThemeContext'
import clsx from 'clsx'
import RegionalTrend from './RegionalTrend'

interface AntigenSparklineProps {
  antigen: string
  avgMap: Record<string, Record<number, number>>
}

function AntigenSparkline({ antigen, avgMap }: AntigenSparklineProps) {
  const { theme } = useTheme()
  const isLight = theme === 'light'
  
  const ag = ANTIGENS.find(a => a.key === antigen)
  const data = TREND_YEARS.map(y => ({
    year: y,
    avg: avgMap[antigen]?.[+y] ?? null,
  }))

  const avg2020 = avgMap[antigen]?.[2020]
  const avg2024 = avgMap[antigen]?.[2024]

  return (
    <div className={clsx(
      "border rounded-xl p-4 transition-all duration-300",
      isLight ? "bg-white border-slate-200 shadow-sm" : "bg-white/[0.02] border-white/[0.06]"
    )}>
      {/* Header */}
      <div className="flex justify-between items-center mb-2">
        <div className="text-[11px] font-semibold font-mono" style={{ color: isLight ? (antigen === 'MCV1' ? '#0284c7' : ag?.color) : ag?.color }}>
          {ag?.label}
        </div>
        <div className={clsx("text-[10px] font-mono", isLight ? "text-slate-500" : "text-white/[0.38]")}>
          AFRO Avg 2024:&nbsp;
          <span className="font-bold" style={{ color: isLight ? (antigen === 'MCV1' ? '#0369a1' : ag?.color) : ag?.color }}>{fmt(avg2024)}</span>
        </div>
      </div>

      {/* Sparkline */}
      <ResponsiveContainer width="100%" height={120}>
        <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -30 }}>
          <defs>
            <linearGradient id={`spark_${antigen}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={ag?.color} stopOpacity={isLight ? 0.2 : 0.28} />
              <stop offset="95%" stopColor={ag?.color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid 
            stroke={isLight ? "#f1f5f9" : "rgba(255,255,255,0.04)"} 
            strokeDasharray="3 3" 
          />
          <XAxis
            dataKey="year"
            tick={{ fontSize: 8, fill: isLight ? '#94a3b8' : 'rgba(255,255,255,0.28)', fontFamily: "'JetBrains Mono', monospace" }}
            tickLine={false} axisLine={false}
          />
          <YAxis
            domain={[55, 110]}
            tick={{ fontSize: 8, fill: isLight ? '#94a3b8' : 'rgba(255,255,255,0.28)', fontFamily: "'JetBrains Mono', monospace" }}
            tickLine={false} axisLine={false}
          />
          <Tooltip
            contentStyle={{ 
              background: isLight ? '#fff' : '#0d1f3c', 
              border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(0,212,255,0.2)', 
              borderRadius: 8, 
              fontSize: 10, 
              fontFamily: "'JetBrains Mono', monospace",
              boxShadow: isLight ? '0 4px 12px rgba(0,0,0,0.05)' : 'none',
              color: isLight ? '#334155' : '#fff'
            }}
            itemStyle={{ color: isLight ? '#334155' : '#fff' }}
            formatter={(v: any) => {
              const val = typeof v === 'number' ? v : parseFloat(v)
              return !isNaN(val) ? [`${val.toFixed(1)}%`, 'AFRO Avg'] : ['N/A', 'AFRO Avg']
            }}
          />
          <Area
            type="monotone"
            dataKey="avg"
            stroke={ag?.color}
            fill={`url(#spark_${antigen})`}
            strokeWidth={2}
            dot={false}
            connectNulls
          />
        </AreaChart>
      </ResponsiveContainer>

      {/* COVID annotation */}
      <div className={clsx("text-[9px] font-mono mt-1.5", isLight ? "text-slate-400" : "text-white/20")}>
        ↳ COVID dip 2020: {fmt(avg2020)} → Recovery 2024: {fmt(avg2024)}
      </div>
    </div>
  )
}

interface TrendsPanelProps {
  avgMap: Record<string, Record<number, number>>
  activeAntigen: string
}

export default function TrendsPanel({ avgMap, activeAntigen }: TrendsPanelProps) {
  const { theme } = useTheme()
  const isLight = theme === 'light'

  return (
    <div>
      {/* Main multi-antigen regional chart */}
      <div className={clsx(
        "border rounded-xl p-4 mb-4 transition-all duration-300",
        isLight ? "bg-white border-slate-200 shadow-sm" : "bg-white/[0.02] border-white/[0.06]"
      )}>
        <div className={clsx("text-xs font-semibold font-mono mb-1", isLight ? "text-slate-600" : "text-white/70")}>
          AFRO Regional Immunisation Trends · All Antigens · 2015–2024
        </div>
        <div className={clsx("text-[10px] font-mono mb-3.5", isLight ? "text-slate-400" : "text-white/[0.28]")}>
          COVID-19 disruption visible 2020–2021 across all antigens · Recovery trajectory 2022–2024 · Dashed line = 95% WHO target
        </div>
        <RegionalTrend avgMap={avgMap} activeAntigen={activeAntigen} height={220} />
      </div>

      {/* Per-antigen sparkline grid */}
      <div className="grid grid-cols-2 gap-3.5">
        {ANTIGENS.map(a => (
          <AntigenSparkline key={a.key} antigen={a.key} avgMap={avgMap} />
        ))}

        {/* Key insights panel */}
        <div className={clsx(
          "rounded-xl p-4 flex flex-col justify-center border transition-all duration-300",
          isLight ? "bg-blue-50/50 border-blue-100 shadow-sm" : "bg-[rgba(0,212,255,0.04)] border-[rgba(0,212,255,0.12)]"
        )}>
          <div className={clsx("text-xs font-semibold font-mono mb-3", isLight ? "text-blue-700" : "text-[#00d4ff]")}>
            📊 AFRO Trend Key Insights
          </div>
          {[
            { label: 'MCV1 AFRO avg 2024', value: fmt(avgMap.MCV1?.[2024]), color: isLight ? '#0284c7' : '#00d4ff' },
            { label: 'DTP3 AFRO avg 2024', value: fmt(avgMap.DTP3?.[2024]), color: '#ff6b6b' },
            { label: 'YFV AFRO avg 2024', value: fmt(avgMap.YFV?.[2024]), color: isLight ? '#d97706' : '#ffb800' },
            { label: 'COVID dip (MCV1 2020)', value: fmt(avgMap.MCV1?.[2020]), color: '#ff4757' },
            { label: 'MCV1 recovery delta', value: avgMap.MCV1?.[2024] && avgMap.MCV1?.[2020] ? `+${(avgMap.MCV1[2024] - avgMap.MCV1[2020]).toFixed(1)}pp` : 'N/A', color: isLight ? '#059669' : '#00e5a0' },
          ].map((row, i) => (
            <div key={i} className={clsx("flex justify-between mb-2 pb-2 border-b", isLight ? "border-blue-100/50" : "border-white/[0.04]")}>
              <span className={clsx("text-[10px] font-mono", isLight ? "text-slate-500" : "text-white/[0.42]")}>{row.label}</span>
              <span className="text-[11px] font-bold font-mono" style={{ color: row.color }}>{row.value}</span>
            </div>
          ))}
          <div className={clsx("text-[10px] font-mono mt-1 leading-normal", isLight ? "text-slate-400" : "text-white/[0.32]")}>
            Source: WHO/UNICEF WUENIC · Administrative coverage · 47 AFRO Member States
          </div>
        </div>
      </div>
    </div>
  )
}
