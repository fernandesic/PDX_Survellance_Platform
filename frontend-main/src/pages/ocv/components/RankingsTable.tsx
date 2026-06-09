import { useMemo } from 'react'
import { coverageColor, fmt } from '../services/ocv'
import { useTheme } from '@/contexts/ThemeContext'
import clsx from 'clsx'

interface OCVCountry {
  code: string
  name: string
  [key: string]: unknown
}

interface RankingsTableProps {
  countries: OCVCountry[]
  antigen: string
  selected: string | null
  onSelect: (code: string | null) => void
}

export default function RankingsTable({ countries, antigen, selected, onSelect }: RankingsTableProps) {
  const { theme } = useTheme()
  const isLight = theme === 'light'

  const sorted = useMemo(() =>
    [...countries]
      .filter(c => c[antigen] !== null && c[antigen] !== undefined)
      .sort((a, b) => ((a[antigen] as number) ?? 0) - ((b[antigen] as number) ?? 0)),
    [countries, antigen])

  return (
    <div className="h-[290px] overflow-y-auto pr-1">
      {sorted.map((c, i) => {
        const val = c[antigen] as number
        const color = coverageColor(val)
        const pct = Math.min(val, 130)
        const isSel = c.code === selected

        return (
          <div
            key={c.code}
            role="button"
            tabIndex={0}
            aria-label={`${c.name}: ${fmt(val)}`}
            onClick={() => onSelect(isSel ? null : c.code)}
            onKeyDown={e => e.key === 'Enter' && onSelect(isSel ? null : c.code)}
            className={clsx(
              "flex items-center py-[5.5px] px-2.5 cursor-pointer rounded-lg mb-0.5 border transition-all duration-150",
              isSel
                ? (isLight ? "bg-blue-50 border-blue-200 shadow-sm" : "bg-[rgba(0,212,255,0.08)] border-[rgba(0,212,255,0.2)]")
                : (isLight ? "bg-transparent border-transparent hover:bg-slate-100/70" : "bg-transparent border-transparent hover:bg-white/[0.04]")
            )}
          >
            {/* Rank */}
            <span className={clsx("w-[22px] text-[10px] font-mono shrink-0", isLight ? "text-slate-400" : "text-white/[0.22]")}>
              {i + 1}
            </span>

            {/* Country name */}
            <span className={clsx("flex-1 text-[11.5px] font-mono overflow-hidden text-ellipsis whitespace-nowrap", isLight ? "text-slate-700" : "text-white/[0.72]")}>
              {c.name}
            </span>

            {/* Mini bar */}
            <div className={clsx("w-[82px] rounded-full h-1 mr-2 shrink-0 overflow-hidden", isLight ? "bg-slate-200" : "bg-white/[0.05]")}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${(pct / 130) * 100}%`,
                  background: isLight && color === '#ff4757' ? '#ef4444' : color,
                }}
              />
            </div>

            {/* Value */}
            <span
              className="w-[44px] text-right text-[11px] font-bold font-mono shrink-0"
              style={{ color: isLight && color === '#00d4ff' ? '#0284c7' : color }}
            >
              {fmt(val, 0)}
            </span>
          </div>
        )
      })}
    </div>
  )
}
