import { coverageColor } from '../services/ocv'
import { useTheme } from '@/contexts/ThemeContext'

interface CoverageGaugeProps {
  value: number | null
  size?: number
}

export default function CoverageGauge({ value, size = 80 }: CoverageGaugeProps) {
  const { theme } = useTheme()
  const isLight = theme === 'light'

  const pct = Math.min(value ?? 0, 130)
  const color = coverageColor(value)
  const r = size * 0.42
  const cx = size / 2
  const cy = size * 0.58

  const arcPath = (startDeg: number, endDeg: number, radius: number): string => {
    const s = (startDeg * Math.PI) / 180
    const e = (endDeg * Math.PI) / 180
    const large = endDeg - startDeg > 180 ? 1 : 0
    return `M ${cx + radius * Math.cos(s)} ${cy + radius * Math.sin(s)}
            A ${radius} ${radius} 0 ${large} 1
            ${cx + radius * Math.cos(e)} ${cy + radius * Math.sin(e)}`
  }

  return (
    <svg
      width={size}
      height={size * 0.76}
      viewBox={`0 0 ${size} ${size * 0.76}`}
      className="block"
      aria-label={`Coverage gauge: ${value !== null ? Math.round(value) : 'N/A'}%`}
    >
      {/* Track */}
      <path
        d={arcPath(-225, 45, r)}
        stroke={isLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.07)"}
        strokeWidth={size * 0.065}
        fill="none"
        strokeLinecap="round"
      />
      {/* Fill */}
      {value !== null && (
        <path
          d={arcPath(-225, -225 + (pct / 130) * 270, r)}
          stroke={isLight && (color === '#00d4ff' || color === '#00e5a0') ? (color === '#00d4ff' ? '#0284c7' : '#059669') : color}
          strokeWidth={size * 0.065}
          fill="none"
          strokeLinecap="round"
          opacity="0.9"
        />
      )}
      {/* Value text */}
      <text
        x={cx} y={cy + 2}
        textAnchor="middle"
        fontSize={size * 0.19}
        fontWeight="800"
        fill={isLight && (color === '#00d4ff' || color === '#00e5a0') ? (color === '#00d4ff' ? '#0284c7' : '#059669') : color}
        className="font-grotesk"
      >
        {value !== null ? Math.round(value) : '—'}
      </text>
      <text
        x={cx} y={cy + size * 0.185}
        textAnchor="middle"
        fontSize={size * 0.1}
        fill={isLight ? "rgba(0,0,0,0.3)" : "rgba(255,255,255,0.38)"}
        className="font-mono"
      >
        %
      </text>
    </svg>
  )
}
