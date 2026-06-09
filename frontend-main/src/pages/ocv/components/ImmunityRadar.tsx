import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  PolarRadiusAxis, Tooltip, ResponsiveContainer,
} from 'recharts'
import { ANTIGENS } from '../constants/ocv'
import { useTheme } from '@/contexts/ThemeContext'
import clsx from 'clsx'

interface OCVCountry {
  code: string
  name: string
  MCV1: number | null
  MCV2: number | null
  DTP1: number | null
  DTP3: number | null
  YFV: number | null
  [key: string]: unknown
}

interface ImmunityRadarProps {
  country: OCVCountry
}

export default function ImmunityRadar({ country }: ImmunityRadarProps) {
  const { theme } = useTheme()
  const isLight = theme === 'light'

  const data = ANTIGENS
    .filter(a => country[a.key] !== null && country[a.key] !== undefined)
    .map(a => ({
      antigen: a.shortLabel,
      value: Math.min((country[a.key] as number) ?? 0, 100),
      fullMark: 100,
    }))

  if (data.length === 0) {
    return (
      <div className={clsx("h-[200px] flex items-center justify-center text-xs font-mono", isLight ? "text-slate-400" : "text-white/20")}>
        No antigen data
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <RadarChart data={data}>
        <PolarGrid stroke={isLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.09)"} />
        <PolarAngleAxis
          dataKey="antigen"
          tick={{
            fontSize: 9,
            fill: isLight ? '#64748b' : 'rgba(255,255,255,0.48)',
            fontFamily: "'JetBrains Mono', monospace",
          }}
        />
        <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
        <Radar
          name="Coverage"
          dataKey="value"
          stroke={isLight ? '#0284c7' : "#00d4ff"}
          fill={isLight ? '#0ea5e9' : "#00d4ff"}
          fillOpacity={isLight ? 0.08 : 0.14}
          strokeWidth={2}
        />
        <Radar
          name="Target (95)"
          dataKey="fullMark"
          stroke={isLight ? "#059669" : "rgba(0,229,160,0.18)"}
          fill="none"
          strokeDasharray="3 3"
          strokeWidth={1}
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
          formatter={(v: number) => [`${v.toFixed(1)}%`, 'Coverage']}
        />
      </RadarChart>
    </ResponsiveContainer>
  )
}
