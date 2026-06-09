import {
  ComposedChart, Area, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer,
} from 'recharts'
import { ANTIGENS, TREND_YEARS } from '../constants/ocv'
import { useTheme } from '@/contexts/ThemeContext'
import clsx from 'clsx'

interface TrendChartProps {
  countryCode: string
  antigen: string
  trendsMap: Record<string, Record<string, Record<string, number>>>
  avgMap: Record<string, Record<number, number>>
}

export default function TrendChart({ countryCode, antigen, trendsMap, avgMap }: TrendChartProps) {
  const { theme } = useTheme()
  const isLight = theme === 'light'

  const series = trendsMap[countryCode]?.[antigen]
  const afroAvg = avgMap[antigen]
  const ag = ANTIGENS.find(a => a.key === antigen)

  if (!series) {
    return (
      <div className={clsx("h-[180px] flex items-center justify-center text-xs font-mono", isLight ? "text-slate-400" : "text-white/20")}>
        No data available for {antigen}
      </div>
    )
  }

  const data = TREND_YEARS.map(y => ({
    year: y,
    coverage: series[y] !== undefined && series[y] !== null ? +series[y].toFixed(1) : null,
    afro: afroAvg?.[+y] ? +afroAvg[+y].toFixed(1) : null,
  }))

  const effectiveColor = isLight && ag?.color === '#00d4ff' ? '#0284c7' : (ag?.color ?? '#00d4ff')

  return (
    <ResponsiveContainer width="100%" height={180}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -22 }}>
        <defs>
          <linearGradient id={`tgrad_${antigen}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={effectiveColor} stopOpacity={isLight ? 0.15 : 0.28} />
            <stop offset="95%" stopColor={effectiveColor} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={isLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.05)"} strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="year"
          tick={{ fontSize: 9, fill: isLight ? '#94a3b8' : 'rgba(255,255,255,0.32)', fontFamily: "'JetBrains Mono', monospace" }}
          tickLine={false} axisLine={false}
        />
        <YAxis
          domain={[0, 130]}
          tick={{ fontSize: 9, fill: isLight ? '#94a3b8' : 'rgba(255,255,255,0.32)', fontFamily: "'JetBrains Mono', monospace" }}
          tickLine={false} axisLine={false}
        />
        <Tooltip
          contentStyle={{
            background: isLight ? '#fff' : '#0d1f3c',
            border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(0,212,255,0.2)',
            borderRadius: 8,
            fontSize: 11,
            fontFamily: "'JetBrains Mono', monospace",
            boxShadow: isLight ? '0 4px 12px rgba(0,0,0,0.05)' : 'none',
            color: isLight ? '#334155' : '#fff'
          }}
          itemStyle={{ color: isLight ? '#334155' : '#fff' }}
          labelStyle={{ color: isLight ? '#64748b' : '#fff' }}
        />
        <ReferenceLine
          y={95}
          stroke={isLight ? "rgba(5,150,105,0.28)" : "rgba(0,229,160,0.28)"}
          strokeDasharray="4 4"
          label={{
            value: '95% target',
            fill: isLight ? "rgba(5,150,105,0.6)" : "rgba(0,229,160,0.45)",
            fontSize: 8,
            fontFamily: "'JetBrains Mono', monospace",
            position: 'insideBottomRight'
          }}
        />
        <Area
          type="monotone"
          dataKey="coverage"
          stroke={effectiveColor}
          fill={`url(#tgrad_${antigen})`}
          strokeWidth={2}
          dot={false}
          connectNulls
          name={antigen}
        />
        <Line
          type="monotone"
          dataKey="afro"
          stroke={isLight ? "rgba(0,0,0,0.2)" : "rgba(255,255,255,0.22)"}
          strokeWidth={1}
          dot={false}
          strokeDasharray="3 3"
          connectNulls
          name="AFRO Avg"
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
