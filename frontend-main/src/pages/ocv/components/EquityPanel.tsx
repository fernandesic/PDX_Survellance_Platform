import {
  BarChart, Bar, Cell, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
  ResponsiveContainer,
} from 'recharts'
import { useMemo } from 'react'
import { ANTIGENS } from '../constants/ocv'
import { coverageColor, fmt } from '../services/ocv'
import { useTheme } from '@/contexts/ThemeContext'
import clsx from 'clsx'

/* ── Shared types ───────────────────────────────────────────────────────────── */

interface OCVCountry {
  code: string
  name: string
  MCV1: number | null
  MCV2: number | null
  DTP1: number | null
  DTP3: number | null
  YFV: number | null
  dropout: number | null
  riskScore: number | null
  [key: string]: unknown
}

/* ── DTP Dropout bar chart ── */

interface DropoutChartProps {
  countries: OCVCountry[]
}

function DropoutChart({ countries }: DropoutChartProps) {
  const { theme } = useTheme()
  const isLight = theme === 'light'

  const data = useMemo(() =>
    [...countries]
      .filter(c => c.dropout !== null && c.dropout! > 0)
      .sort((a, b) => b.dropout! - a.dropout!)
      .slice(0, 16)
      .map(c => ({
        name: c.code,
        value: c.dropout,
        fill: c.dropout! > 10 ? '#ff4757' : c.dropout! > 5 ? (isLight ? '#d97706' : '#ffb800') : (isLight ? '#059669' : '#00e5a0'),
      })),
    [countries, isLight])

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -22 }}>
        <CartesianGrid stroke={isLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.04)"} strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 8, fill: isLight ? '#94a3b8' : 'rgba(255,255,255,0.32)', fontFamily: "'JetBrains Mono', monospace" }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fontSize: 9, fill: isLight ? '#94a3b8' : 'rgba(255,255,255,0.32)', fontFamily: "'JetBrains Mono', monospace" }} tickLine={false} axisLine={false} />
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
          formatter={(v: number) => [`${v}%`, 'DTP1→DTP3 Dropout']}
        />
        <ReferenceLine y={10} stroke={isLight ? "rgba(225,29,72,0.4)" : "rgba(255,71,87,0.35)"} strokeDasharray="3 3"
          label={{ value: '10% threshold', fill: isLight ? "rgba(225,29,72,0.6)" : 'rgba(255,71,87,0.45)', fontSize: 8, fontFamily: "'JetBrains Mono', monospace", position: 'insideBottomRight' }} />
        <Bar dataKey="value" radius={[3, 3, 0, 0]}>
          {data.map((d, i) => <Cell key={i} fill={d.fill} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

/* ── MCV1 vs DTP3 scatter ── */

interface CoverageScatterProps {
  countries: OCVCountry[]
}

function CoverageScatter({ countries }: CoverageScatterProps) {
  const { theme } = useTheme()
  const isLight = theme === 'light'

  const scatterData = useMemo(() =>
    countries
      .filter(c => c.MCV1 !== null && c.DTP3 !== null)
      .map(c => ({ x: c.MCV1!, y: c.DTP3!, name: c.name, code: c.code, critical: c.MCV1! < 80 || c.DTP3! < 80 })),
    [countries])

  return (
    <ResponsiveContainer width="100%" height={220}>
      <ScatterChart margin={{ top: 8, right: 8, bottom: 8, left: -22 }}>
        <CartesianGrid stroke={isLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.04)"} strokeDasharray="3 3" />
        <XAxis dataKey="x" name="MCV1" type="number" domain={[40, 130]}
          tick={{ fontSize: 9, fill: isLight ? '#64748b' : 'rgba(255,255,255,0.28)', fontFamily: "'JetBrains Mono', monospace" }}
          tickLine={false} axisLine={false}
          label={{ value: 'MCV1 %', position: 'insideBottom', offset: -4, fill: isLight ? '#64748b' : 'rgba(255,255,255,0.28)', fontSize: 9 }} />
        <YAxis dataKey="y" name="DTP3" type="number" domain={[40, 120]}
          tick={{ fontSize: 9, fill: isLight ? '#64748b' : 'rgba(255,255,255,0.28)', fontFamily: "'JetBrains Mono', monospace" }}
          tickLine={false} axisLine={false}
          label={{ value: 'DTP3 %', angle: -90, position: 'insideLeft', fill: isLight ? '#64748b' : 'rgba(255,255,255,0.28)', fontSize: 9 }} />
        <Tooltip
          cursor={{ strokeDasharray: '3 3', stroke: isLight ? 'rgba(0,0,0,0.2)' : 'rgba(0,212,255,0.3)' }}
          content={({ payload }) => {
            if (!payload?.length) return null
            const d = payload[0].payload
            return (
              <div className={clsx(
                "border rounded-lg py-2 px-3 font-mono text-[11px] shadow-lg",
                isLight ? "bg-white border-slate-200" : "bg-[#0d1f3c] border-[rgba(0,212,255,0.2)]"
              )}>
                <div className={clsx("font-bold mb-1", isLight ? "text-slate-800" : "text-white")}>{d.name}</div>
                <div className={isLight ? "text-blue-700" : "text-[#00d4ff]"}>MCV1: {fmt(d.x)}</div>
                <div className={isLight ? "text-rose-600" : "text-[#ff6b6b]"}>DTP3: {fmt(d.y)}</div>
              </div>
            )
          }}
        />
        <Scatter data={scatterData} fillOpacity={0.75}>
          {scatterData.map((d, i) => (
            <Cell key={i} fill={d.critical ? '#ff4757' : (isLight ? '#0284c7' : '#00d4ff')} />
          ))}
        </Scatter>
      </ScatterChart>
    </ResponsiveContainer>
  )
}

/* ── Coverage distribution bar chart ── */

interface DistributionChartProps {
  countries: OCVCountry[]
  antigen: string
}

function DistributionChart({ countries, antigen }: DistributionChartProps) {
  const { theme } = useTheme()
  const isLight = theme === 'light'

  const sorted = useMemo(() =>
    [...countries]
      .filter(c => c[antigen] !== null && c[antigen] !== undefined)
      .sort((a, b) => ((b[antigen] as number) ?? 0) - ((a[antigen] as number) ?? 0))
      .map(c => {
        let fill = coverageColor(c[antigen] as number)
        if (isLight && fill === '#00d4ff') fill = '#0284c7'
        if (isLight && fill === '#00e5a0') fill = '#059669'
        return { name: c.code, val: +Math.min((c[antigen] as number) ?? 0, 130).toFixed(1), fill }
      }),
    [countries, antigen, isLight])

  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={sorted} margin={{ top: 4, right: 4, bottom: 0, left: -26 }}>
        <CartesianGrid stroke={isLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.04)"} strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 8, fill: isLight ? '#94a3b8' : 'rgba(255,255,255,0.22)', fontFamily: "'JetBrains Mono', monospace" }} tickLine={false} axisLine={false} />
        <YAxis domain={[0, 130]} tick={{ fontSize: 9, fill: isLight ? '#94a3b8' : 'rgba(255,255,255,0.22)', fontFamily: "'JetBrains Mono', monospace" }} tickLine={false} axisLine={false} />
        <ReferenceLine y={95} stroke={isLight ? "rgba(5,150,105,0.4)" : "rgba(0,229,160,0.28)"} strokeDasharray="4 4" />
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
          formatter={(v: number) => [`${v}%`, antigen]}
        />
        <Bar dataKey="val" radius={[2, 2, 0, 0]}>
          {sorted.map((d, i) => <Cell key={i} fill={d.fill} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

/* ── Critical watchlist ── */

interface WatchlistProps {
  countries: OCVCountry[]
  antigen: string
  onSelectCountry?: (code: string) => void
}

function Watchlist({ countries, antigen, onSelectCountry }: WatchlistProps) {
  const { theme } = useTheme()
  const isLight = theme === 'light'

  const critical = useMemo(() =>
    [...countries]
      .filter(c => c[antigen] !== null && c[antigen] !== undefined && (c[antigen] as number) < 80)
      .sort((a, b) => ((a[antigen] as number) ?? 0) - ((b[antigen] as number) ?? 0)),
    [countries, antigen])

  return (
    <div className={clsx(
      "border rounded-xl p-4 transition-all duration-300",
      isLight ? "bg-rose-50/50 border-rose-100 shadow-sm" : "bg-[rgba(255,71,87,0.04)] border-[rgba(255,71,87,0.15)]"
    )}>
      <div className={clsx("text-xs font-bold font-mono mb-3", isLight ? "text-rose-700" : "text-[#ff4757]")}>
        ⚠ Priority Watchlist · {antigen} &lt;80%
      </div>
      {critical.length === 0 ? (
        <div className={clsx("text-[11px] font-mono", isLight ? "text-emerald-700" : "text-[rgba(0,229,160,0.65)]")}>
          ✓ All reporting countries ≥80% for {antigen}
        </div>
      ) : (
        <div className="max-h-[300px] overflow-y-auto pr-1">
          {critical.map(c => (
            <div
              key={c.code}
              onClick={() => onSelectCountry?.(c.code)}
              className={clsx(
                "flex justify-between items-center py-[7px] px-2 border-b cursor-pointer transition-colors rounded",
                isLight ? "border-rose-100/50 hover:bg-rose-100/50" : "border-white/[0.04] hover:bg-white/[0.04]"
              )}
            >
              <span className={clsx("text-[11px] font-mono", isLight ? "text-slate-700" : "text-white/70")}>{c.name}</span>
              <div className="flex gap-2.5 items-center">
                {c.riskScore !== null && c.riskScore > 10 && (
                  <span className={clsx("text-[9px] font-mono", isLight ? "text-rose-600" : "text-[rgba(255,71,87,0.7)]")}>
                    Gap: {c.riskScore}
                  </span>
                )}
                <span
                  className="text-sm font-extrabold font-grotesk"
                  style={{ color: '#ff4757' }}
                >
                  {fmt(c[antigen] as number, 1)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── Band summary chips ── */

interface BandSummaryProps {
  countries: OCVCountry[]
  antigen: string
}

function BandSummary({ countries, antigen }: BandSummaryProps) {
  const { theme } = useTheme()
  const isLight = theme === 'light'

  const bands = useMemo(() => [
    { label: '≥95% Target', color: isLight ? '#059669' : '#00e5a0', count: countries.filter(c => c[antigen] !== null && (c[antigen] as number) >= 95).length },
    { label: '80–94%', color: isLight ? '#d97706' : '#ffb800', count: countries.filter(c => c[antigen] !== null && (c[antigen] as number) >= 80 && (c[antigen] as number) < 95).length },
    { label: '<80% Critical', color: '#ff4757', count: countries.filter(c => c[antigen] !== null && (c[antigen] as number) < 80).length },
  ], [countries, antigen, isLight])

  return (
    <div className="grid grid-cols-3 gap-2 mb-3.5">
      {bands.map((b, i) => (
        <div
          key={i}
          className={clsx(
            "p-2.5 rounded-lg text-center border transition-all duration-300 shadow-sm",
            isLight ? "bg-white" : "bg-white/[0.02]"
          )}
          style={{
            borderColor: isLight ? undefined : `${b.color}28`,
            borderLeft: isLight ? `3px solid ${b.color}` : undefined
          }}
        >
          <div className="text-[22px] font-extrabold font-grotesk leading-none" style={{ color: b.color }}>{b.count}</div>
          <div className={clsx("text-[9px] font-mono mt-1", isLight ? "text-slate-500" : "text-white/[0.38]")}>{b.label}</div>
        </div>
      ))}
    </div>
  )
}

/* ── Main export ── */

interface EquityPanelProps {
  countries: OCVCountry[]
  antigen: string
  onSelectCountry: (code: string) => void
}

export default function EquityPanel({ countries, antigen, onSelectCountry }: EquityPanelProps) {
  const { theme } = useTheme()
  const isLight = theme === 'light'
  const ag = ANTIGENS.find(a => a.key === antigen)

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Left column */}
      <div>
        <div className={clsx(
          "border rounded-xl p-4 mb-4 transition-all duration-300",
          isLight ? "bg-white border-slate-200 shadow-sm" : "bg-white/[0.02] border-white/[0.06]"
        )}>
          <div className={clsx("text-xs font-semibold font-mono mb-1", isLight ? "text-slate-700" : "text-white/70")}>
            DTP Dropout Rate (DTP1→DTP3)
          </div>
          <div className={clsx("text-[10px] font-mono mb-3", isLight ? "text-slate-400" : "text-white/28")}>
            High dropout = health system access failure · feeds HSSPM
          </div>
          <DropoutChart countries={countries} />
        </div>

        <div className={clsx(
          "border rounded-xl p-4 transition-all duration-300",
          isLight ? "bg-white border-slate-200 shadow-sm" : "bg-white/[0.02] border-white/[0.06]"
        )}>
          <div className={clsx("text-xs font-semibold font-mono mb-1", isLight ? "text-slate-700" : "text-white/70")}>
            MCV1 vs DTP3 Correlation
          </div>
          <div className={clsx("text-[10px] font-mono mb-2.5", isLight ? "text-slate-400" : "text-white/28")}>
            Red dots = either antigen &lt;80% · Countries below diagonal = stronger DTP programme
          </div>
          <CoverageScatter countries={countries} />
        </div>
      </div>

      {/* Right column */}
      <div>
        <div className={clsx(
          "border rounded-xl p-4 mb-4 transition-all duration-300",
          isLight ? "bg-white border-slate-200 shadow-sm" : "bg-white/[0.02] border-white/[0.06]"
        )}>
          <div className={clsx("text-xs font-semibold font-mono mb-3", isLight ? "text-slate-700" : "text-white/70")}>
            Coverage Distribution · {ag?.label} 2024
          </div>
          <BandSummary countries={countries} antigen={antigen} />
          <DistributionChart countries={countries} antigen={antigen} />
        </div>

        <Watchlist countries={countries} antigen={antigen} onSelectCountry={onSelectCountry} />
      </div>
    </div>
  )
}
