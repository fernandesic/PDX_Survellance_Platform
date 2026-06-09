import { useMemo } from 'react'
import { ANTIGENS } from '../constants/ocv'
import { coverageColor, fmt } from '../services/ocv'
import { useTheme } from '@/contexts/ThemeContext'
import clsx from 'clsx'
import CoverageGauge from './CoverageGauge'
import ImmunityRadar from './ImmunityRadar'
import TrendChart from './TrendChart'
import PDXBridgePanel from './PDXBridgePanel'

/* ── Types ──────────────────────────────────────────────────────────────────── */

interface OCVCountry {
  code: string
  name: string
  MCV1: number | null
  MCV2: number | null
  DTP1: number | null
  DTP3: number | null
  YFV: number | null
  MCV1_doses: number | null
  dropout: number | null
  riskScore: number | null
  band: { label: string; color: string }
  [key: string]: unknown
}

interface CountrySelectorProps {
  countries: OCVCountry[]
  selected: string
  onSelect: (code: string) => void
}

interface CountryIntelPanelProps {
  countries: OCVCountry[]
  selected: string
  onSelect: (code: string) => void
  activeAntigen: string
  onSetAntigen: (key: string) => void
  trendsMap: Record<string, Record<string, Record<string, number>>>
  avgMap: Record<string, Record<number, number>>
}

/* ── Country Selector ───────────────────────────────────────────────────────── */

function CountrySelector({ countries, selected, onSelect }: CountrySelectorProps) {
  const { theme } = useTheme()
  const isLight = theme === 'light'

  const sorted = useMemo(
    () => [...countries].sort((a, b) => a.name.localeCompare(b.name)),
    [countries],
  )

  return (
    <div className={clsx(
      "border rounded-xl p-4 transition-all duration-300",
      isLight ? "bg-white border-slate-200 shadow-sm" : "bg-white/[0.02] border-white/[0.06]"
    )}>
      <div className={clsx("text-[10px] mb-2.5 font-mono uppercase tracking-[0.08em]", isLight ? "text-slate-400" : "text-white/35")}>
        Select Country
      </div>
      <div className="h-[510px] overflow-y-auto pr-1">
        {sorted.map(c => (
          <div
            key={c.code}
            role="button"
            tabIndex={0}
            onClick={() => onSelect(c.code)}
            onKeyDown={e => e.key === 'Enter' && onSelect(c.code)}
            className={clsx(
              "py-1.5 px-2.5 cursor-pointer rounded-md mb-0.5 flex items-center justify-between transition-all duration-[120ms]",
              c.code === selected
                ? (isLight ? "bg-blue-50 border border-blue-200" : "bg-[rgba(0,212,255,0.1)] border border-[rgba(0,212,255,0.22)]")
                : (isLight ? "bg-transparent border border-transparent hover:bg-slate-50" : "bg-transparent border border-transparent hover:bg-white/[0.04]")
            )}
          >
            <span className={clsx("text-[11px] font-mono", isLight ? "text-slate-700" : "text-white/70")}>
              {c.name}
            </span>
            <span
              className="text-[10px] font-bold font-mono"
              style={{ color: isLight && coverageColor(c.MCV1) === '#00d4ff' ? '#0284c7' : coverageColor(c.MCV1) }}
            >
              {fmt(c.MCV1, 0)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Main Panel ─────────────────────────────────────────────────────────────── */

export default function CountryIntelPanel({
  countries,
  selected,
  onSelect,
  activeAntigen,
  onSetAntigen,
  trendsMap,
  avgMap,
}: CountryIntelPanelProps) {
  const { theme } = useTheme()
  const isLight = theme === 'light'

  const country = useMemo(
    () => countries.find(c => c.code === selected) ?? countries[0],
    [countries, selected],
  )

  return (
    <div className="grid grid-cols-[0.34fr_1fr] gap-4">
      {/* Selector */}
      <CountrySelector countries={countries} selected={selected} onSelect={onSelect} />

      {/* Detail pane */}
      <div className="flex flex-col gap-3">

        {/* Country header + gauges */}
        <div className={clsx(
          "border rounded-xl p-4 transition-all duration-300",
          isLight ? "bg-white border-slate-200 shadow-sm" : "bg-white/[0.02] border-white/[0.06]"
        )}>
          <div className="flex justify-between items-start mb-3">
            <div>
              <div className={clsx("text-xl font-extrabold tracking-tight mb-1 font-grotesk", isLight ? "text-slate-900" : "text-white")}>
                {country.name}
              </div>
              <div className={clsx("text-[10px] font-mono", isLight ? "text-slate-400" : "text-white/[0.32]")}>
                ISO: {country.code} · WHO AFRO Member State · Data: 2024
              </div>
            </div>

            {/* Immunity gap badge */}
            {country.riskScore !== null && (
              <div
                className="py-[7px] px-3.5 rounded-lg text-center border shadow-sm"
                style={{
                  background: isLight 
                    ? (country.riskScore > 15 ? '#fff1f2' : country.riskScore > 5 ? '#fffbeb' : '#f0fdf4')
                    : (country.riskScore > 15 ? 'rgba(255,71,87,0.1)' : country.riskScore > 5 ? 'rgba(255,184,0,0.1)' : 'rgba(0,229,160,0.1)'),
                  borderColor: country.riskScore > 15 ? 'rgba(255,71,87,0.3)' : country.riskScore > 5 ? 'rgba(255,184,0,0.3)' : 'rgba(0,229,160,0.3)',
                }}
              >
                <div className={clsx("text-[9px] font-mono mb-0.5", isLight ? "text-slate-500" : "text-white/[0.32]")}>IMMUNITY GAP</div>
                <div
                  className="text-[22px] font-extrabold font-grotesk leading-none"
                  style={{ color: country.riskScore > 15 ? '#ff4757' : country.riskScore > 5 ? (isLight ? '#d97706' : '#ffb800') : (isLight ? '#059669' : '#00e5a0') }}
                >
                  {country.riskScore}
                </div>
              </div>
            )}
          </div>

          {/* Antigen gauges row */}
          <div className="flex gap-3.5 flex-wrap items-end">
            {ANTIGENS.map(a => (
              country[a.key] !== null && country[a.key] !== undefined && (
                <div key={a.key} className="text-center">
                  <CoverageGauge value={country[a.key] as number} size={80} />
                  <div
                    className="text-[9px] font-mono mt-0.5 font-bold"
                    style={{ color: isLight && a.color === '#00d4ff' ? '#0284c7' : a.color }}
                  >
                    {a.shortLabel}
                  </div>
                </div>
              )
            ))}

            {/* DTP dropout chip */}
            {country.dropout !== null && (
              <div className={clsx(
                "py-2.5 px-3.5 rounded-lg border self-center transition-all duration-300",
                isLight ? "bg-slate-50 border-slate-100" : "bg-white/[0.03] border-white/[0.06]"
              )}>
                <div className={clsx("text-[9px] font-mono", isLight ? "text-slate-500" : "text-white/[0.38]")}>DTP DROPOUT</div>
                <div
                  className="text-2xl font-extrabold font-grotesk tracking-tight"
                  style={{ color: country.dropout > 10 ? '#ff4757' : (isLight ? '#d97706' : '#ffb800') }}
                >
                  {country.dropout}%
                </div>
                <div className={clsx("text-[9px] font-mono opacity-50", isLight ? "text-slate-400" : "text-white/28")}>DTP1→DTP3</div>
              </div>
            )}
          </div>
        </div>

        {/* Radar + Bridge side by side */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className={clsx(
            "border rounded-xl p-4 transition-all duration-300",
            isLight ? "bg-white border-slate-200 shadow-sm" : "bg-white/[0.02] border-white/[0.06]"
          )}>
            <div className={clsx("text-[11px] font-mono mb-2 uppercase tracking-[0.07em]", isLight ? "text-slate-500" : "text-white/[0.45]")}>
              Immunity Profile Radar
            </div>
            <ImmunityRadar country={country} />
          </div>
          <div className={clsx(
            "border rounded-xl p-4 flex flex-col justify-center transition-all duration-300",
            isLight ? "bg-white border-slate-200 shadow-sm" : "bg-white/[0.02] border-white/[0.06]"
          )}>
            <PDXBridgePanel country={country} />
          </div>
        </div>

        {/* Trend chart with antigen selector */}
        <div className={clsx(
          "border rounded-xl p-4 transition-all duration-300",
          isLight ? "bg-white border-slate-200 shadow-sm" : "bg-white/[0.02] border-white/[0.06]"
        )}>
          <div className="flex justify-between items-center mb-2.5">
            <div className={clsx("text-[11px] font-mono uppercase tracking-[0.07em]", isLight ? "text-slate-500" : "text-white/50")}>
              10-Year Trend · {country.name}
            </div>
            <div className="flex gap-1">
              {ANTIGENS.filter(a => country[a.key] !== null && country[a.key] !== undefined).map(a => (
                <button
                  key={a.key}
                  onClick={() => onSetAntigen(a.key)}
                  className={clsx(
                    "py-[3px] px-2 rounded border transition-all [transition-duration:130ms] text-[9px] font-mono font-bold cursor-pointer",
                    activeAntigen === a.key 
                      ? (isLight ? "bg-slate-800 text-white border-slate-800" : "bg-white text-[#060d1a] border-white")
                      : (isLight ? "bg-slate-50 text-slate-500 border-slate-100 hover:bg-slate-100" : "bg-white/[0.06] text-white/40 border-transparent hover:bg-white/10")
                  )}
                  style={{
                    backgroundColor: activeAntigen === a.key ? (isLight ? '#1e293b' : a.color) : undefined,
                    color: activeAntigen === a.key ? (isLight ? '#fff' : '#060d1a') : undefined,
                  }}
                >
                  {a.key}
                </button>
              ))}
            </div>
          </div>
          <TrendChart
            countryCode={selected}
            antigen={activeAntigen}
            trendsMap={trendsMap}
            avgMap={avgMap}
          />
        </div>
      </div>
    </div>
  )
}
