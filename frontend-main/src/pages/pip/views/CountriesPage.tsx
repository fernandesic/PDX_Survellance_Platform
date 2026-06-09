import React, { useState, useMemo } from 'react'
import { Search, CheckCircle, XCircle } from 'lucide-react'
import { LoadingSpinner, ErrorAlert,
  Card, ProgressBar, ResponsePill
} from '../components/UI'
import { useAsync } from '../hooks/useAsync'
import {
  fetchCountries, fetchCountryDetail,
  type CountrySummary
} from '../utils/api'
import { useTheme } from '@/contexts/ThemeContext'
import { useThemeColors } from '@/contexts/useThemeColors'
import clsx from 'clsx'

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 70 ? '#10B981' : score >= 45 ? '#F59E0B' : '#EF4444'
  const label = score >= 70 ? 'High' : score >= 45 ? 'Medium' : 'Low'
  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full text-white shadow-sm"
      style={{ backgroundColor: color }}
    >
      {score}% · {label}
    </span>
  )
}

function BoolIcon({ v }: { v: boolean }) {
  return v
    ? <CheckCircle size={16} className="text-emerald-500 mx-auto" />
    : <XCircle size={16} className="text-rose-400 mx-auto" />
}

function CountryDrawer({ country, onClose }: { country: string; onClose: () => void }) {
  const { theme } = useTheme()
  const colors = useThemeColors()
  const isLight = theme === 'light'

  const { data, loading, error } = useAsync(
    () => fetchCountryDetail(country),
    [country]
  )

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className={clsx("w-full max-w-xl shadow-2xl flex flex-col overflow-hidden", isLight ? "bg-white" : colors.bg.primary)}>
        <div className={clsx("flex items-center justify-between p-5 border-b", isLight ? "bg-[#065F46] border-[#047857] text-white" : "bg-emerald-500/10 border-white/10 text-white")}>
          <div>
            <h2 className="text-lg font-bold">{country}</h2>
            {data && <p className="text-sm opacity-70 font-medium">Readiness Score: {data.readiness_score}%</p>}
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white text-2xl leading-none transition-colors">&times;</button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {loading && <LoadingSpinner />}
          {error && <ErrorAlert message={error} />}
          {data && Object.entries(data.categories).map(([cat, catData]) => (
            <div key={cat} className={isLight ? "" : "border-b border-white/5 pb-4 last:border-0"}>
              <div className="flex items-center justify-between mb-2">
                <h3 className={clsx("text-sm font-semibold", colors.text.primary)}>{cat}</h3>
                <span className="text-xs text-emerald-500 font-bold">{catData.yes_rate}%</span>
              </div>
              <ProgressBar value={catData.yes_rate} max={100} color="#10B981" />
              <div className="mt-2 space-y-1">
                {catData.indicators.map((ind) => (
                  <div key={ind.indicator_id} className={clsx("flex items-start justify-between gap-2 text-[11px] py-1.5 border-b", isLight ? "border-gray-50" : "border-white/5")}>
                    <span className={clsx("leading-relaxed flex-1", colors.text.secondary)}>{ind.indicator}</span>
                    <ResponsePill response={ind.response} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function CountriesPage() {
  const { theme } = useTheme()
  const colors = useThemeColors()
  const isLight = theme === 'light'

  const { data, loading, error } = useAsync(fetchCountries)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<keyof CountrySummary>('readiness_score')

  const filtered = useMemo(() => {
    if (!data) return []
    return data
      .filter(c => c.country.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => {
        const av = a[sortBy], bv = b[sortBy]
        if (typeof av === 'boolean' && typeof bv === 'boolean') return Number(bv) - Number(av)
        if (typeof av === 'number' && typeof bv === 'number') return bv - av
        return String(av).localeCompare(String(bv))
      })
  }, [data, search, sortBy])

  const columns: { key: keyof CountrySummary; label: string }[] = [
    { key: 'country', label: 'Country' },
    { key: 'readiness_score', label: 'Readiness' },
    { key: 'has_nic', label: 'NIC' },
    { key: 'has_pcr', label: 'RT-PCR' },
    { key: 'has_vaccination_policy', label: 'Vaccination' },
    { key: 'has_pandemic_plan', label: 'Pandemic Plan' },
    { key: 'reports_fluid', label: 'FluID' },
    { key: 'reports_flunet', label: 'FluNet' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className={clsx("text-2xl font-bold", colors.text.primary)}>Country Profiles</h1>
        <p className={clsx("text-sm mt-1 font-medium", colors.text.secondary)}>47 Member States — 2024 Landscape Survey readiness overview</p>
      </div>

      <Card>
        <div className="flex items-center gap-4 mb-4">
          <div className="relative flex-1 max-w-xs">
            <Search size={15} className={clsx("absolute left-3 top-1/2 -translate-y-1/2", colors.text.muted)} />
            <input
              className={clsx(
                "w-full pl-9 pr-3 py-2 text-sm border rounded-lg focus:outline-none transition-all",
                isLight
                  ? "border-gray-200 focus:border-emerald-600 bg-white"
                  : "border-white/10 focus:border-emerald-400 bg-white/5 text-white placeholder-white/20"
              )}
              placeholder="Search country…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className={clsx("text-xs font-medium", colors.text.muted)}>
            Showing {filtered.length} of {data?.length ?? 0} countries
          </div>
        </div>

        {loading && <LoadingSpinner />}
        {error && <ErrorAlert message={error} />}

        {filtered.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full data-table">
              <thead>
                <tr>
                  {columns.map(col => (
                    <th
                      key={col.key}
                      className={clsx(
                        "cursor-pointer select-none transition-colors text-center px-4 py-3",
                        isLight ? "hover:bg-gray-100" : "hover:bg-white/5"
                      )}
                      onClick={() => setSortBy(col.key)}
                    >
                      <span className={clsx("text-[10px] font-bold uppercase tracking-wider", colors.text.muted)}>
                        {col.label}
                        {sortBy === col.key && <span className="ml-1 text-emerald-500">↓</span>}
                      </span>
                    </th>
                  ))}
                  <th className={clsx("text-[10px] font-bold uppercase tracking-wider px-4 py-3", colors.text.muted)}>Detail</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <tr key={c.country} className={clsx("group cursor-pointer transition-colors border-b", isLight ? "hover:bg-emerald-50/30 border-gray-50" : "hover:bg-white/5 border-white/5")} onClick={() => setSelected(c.country)}>
                    <td className={clsx("font-semibold px-4 py-3", colors.text.primary)}>{c.country}</td>
                    <td className="text-center px-4 py-3"><ScoreBadge score={c.readiness_score} /></td>
                    <td className="text-center px-4 py-3"><BoolIcon v={c.has_nic} /></td>
                    <td className="text-center px-4 py-3"><BoolIcon v={c.has_pcr} /></td>
                    <td className="text-center px-4 py-3"><BoolIcon v={c.has_vaccination_policy} /></td>
                    <td className="text-center px-4 py-3"><BoolIcon v={c.has_pandemic_plan} /></td>
                    <td className="text-center px-4 py-3"><BoolIcon v={c.reports_fluid} /></td>
                    <td className="text-center px-4 py-3"><BoolIcon v={c.reports_flunet} /></td>
                    <td className="text-center px-4 py-3">
                      <button className="text-[10px] font-bold text-emerald-500 group-hover:underline uppercase tracking-tighter">View →</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {selected && (
        <CountryDrawer country={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  )
}
