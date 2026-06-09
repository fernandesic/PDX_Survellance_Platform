import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ReferenceLine, ResponsiveContainer,
} from 'recharts'
import { ANTIGENS, TREND_YEARS } from '../constants/ocv'
import { useTheme } from '@/contexts/ThemeContext'

interface RegionalTrendProps {
  avgMap: Record<string, Record<number, number>>
  activeAntigen: string
  height?: number
}

export default function RegionalTrend({ avgMap, activeAntigen, height = 200 }: RegionalTrendProps) {
  const { theme } = useTheme()
  const isLight = theme === 'light'

  const data = TREND_YEARS.map(y => {
    const row: Record<string, string | number | null> = { year: y }
    ANTIGENS.forEach(a => {
      row[a.key] = avgMap[a.key]?.[+y] ?? null
    })
    return row
  })

  const tickStyle = { 
    fontSize: 9, 
    fill: isLight ? '#64748b' : 'rgba(255,255,255,0.28)', 
    fontFamily: "'JetBrains Mono', monospace" 
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -22 }}>
        <CartesianGrid 
          stroke={isLight ? "#e2e8f0" : "rgba(255,255,255,0.04)"} 
          strokeDasharray="3 3" 
        />
        <XAxis
          dataKey="year"
          tick={tickStyle}
          tickLine={false} axisLine={false}
        />
        <YAxis
          domain={[60, 105]}
          tick={tickStyle}
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
            color: isLight ? '#1e293b' : '#fff'
          }}
          itemStyle={{ color: isLight ? '#1e293b' : '#fff' }}
        />
        <ReferenceLine
          y={95}
          stroke={isLight ? "#10b981" : "rgba(0,229,160,0.22)"}
          strokeDasharray="4 4"
          label={{
            value: '95%',
            fill: isLight ? "#059669" : "rgba(0,229,160,0.4)",
            fontSize: 8,
            fontFamily: "'JetBrains Mono', monospace",
            position: 'insideBottomRight'
          }}
        />
        {ANTIGENS.map(a => (
          <Line
            key={a.key}
            type="monotone"
            dataKey={a.key}
            stroke={a.color}
            strokeWidth={a.key === activeAntigen ? 2.5 : 1.2}
            opacity={a.key === activeAntigen ? 1 : (isLight ? 0.3 : 0.38)}
            dot={false}
            connectNulls
            name={a.label}
          />
        ))}
        <Legend
          wrapperStyle={{
            fontSize: 9,
            fontFamily: "'JetBrains Mono', monospace",
            paddingTop: 10
          }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
