import React, { useState } from 'react'
import { LoadingSpinner, ErrorAlert, Card } from '../components/UI'
import { useTheme } from '@/contexts/ThemeContext'
import { useThemeColors } from '@/contexts/useThemeColors'
import { useAsync } from '../hooks/useAsync'
import { fetchHeatmap } from '../utils/api'
import clsx from 'clsx'

const CATEGORIES = [
  'Virological surveillance',
  'Influenza like Illness (ILI) Surveillance',
  'Severe acute respiratory infection (SARI) surveillance',
  'Pandemic preparedness and response',
  'Vaccination',
  'Data reporting & use',
  'Zoonotic Influenza surveillance',
  'Integration of Influenza surveillance and SARS-CoV-2',
]

const CELL_COLORS_LIGHT = ['#F3F4F6', '#FEE2E2', '#DCFCE7'] // Neutral, Red, Green
const CELL_COLORS_DARK  = ['rgba(255,255,255,0.05)', 'rgba(239,68,68,0.15)', 'rgba(16,185,129,0.15)']
const CELL_LABELS = ['No response / N/A', 'No / In progress', 'Yes']
const CELL_TEXT_LIGHT   = ['#9CA3AF', '#EF4444', '#16A34A']
const CELL_TEXT_DARK    = ['#6B7280', '#F87171', '#34D399']

export default function HeatmapPage() {
  const { theme } = useTheme()
  const colors = useThemeColors()
  const isLight = theme === 'light'
  
  const cellColors = isLight ? CELL_COLORS_LIGHT : CELL_COLORS_DARK
  const cellText   = isLight ? CELL_TEXT_LIGHT : CELL_TEXT_DARK

  const [category, setCategory] = useState(CATEGORIES[0])
  const { data, loading, error } = useAsync(() => fetchHeatmap(category), [category])

  return (
      <div className="space-y-6">
        <div>
          <h1 className={clsx("text-2xl font-bold", colors.text.primary)}>Heatmap Analysis</h1>
          <p className={clsx("text-sm mt-1 font-medium", colors.text.secondary)}>Country × Indicator response matrix — visual gap analysis</p>
        </div>

      <Card>
        <div className="mb-4">
          <label className={clsx("text-xs font-semibold uppercase tracking-wide block mb-2", colors.text.muted)}>
            Select Category
          </label>
          <select
            className={clsx(
              "w-full max-w-lg text-sm border rounded-lg px-3 py-2.5 focus:outline-none transition-all font-medium",
              isLight 
                ? "border-gray-200 focus:border-emerald-600 bg-white" 
                : "border-white/10 focus:border-emerald-400 bg-white/5 text-white"
            )}
            value={category}
            onChange={e => setCategory(e.target.value)}
          >
            {CATEGORIES.map(c => (
              <option key={c} value={c} className={isLight ? "" : "bg-[#082E23]"}>{c}</option>
            ))}
          </select>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mb-4">
          {CELL_LABELS.map((label, i) => (
            <div key={i} className={clsx("flex items-center gap-1.5 text-xs font-medium", colors.text.secondary)}>
              <span
                className={clsx("w-4 h-4 rounded border", isLight ? "border-gray-200" : "border-white/10")}
                style={{ backgroundColor: cellColors[i] }}
              />
              {label}
            </div>
          ))}
        </div>

        {loading && <LoadingSpinner />}
        {error && <ErrorAlert message={error} />}

        {data && (
          <div className="overflow-auto max-h-[70vh] border rounded-lg scrollbar-thin">
            <table className="text-[10px] border-collapse w-full">
              <thead className="sticky top-0 z-10">
                <tr>
                  <th className={clsx(
                    "text-left p-2 font-bold border sticky left-0 z-20 min-w-[160px] uppercase tracking-wider",
                    isLight ? "bg-gray-100 border-gray-200 text-gray-600" : "bg-[#082E23] border-white/10 text-gray-400"
                  )}>
                    Country
                  </th>
                  {data.indicators.map((ind, i) => (
                    <th
                      key={i}
                      className={clsx(
                        "p-1 font-bold border min-w-[90px] uppercase tracking-tighter",
                        isLight ? "bg-gray-50 border-gray-200 text-gray-500 font-medium" : "bg-[#065F46]/40 border-white/10 text-gray-400"
                      )}
                      style={{ writingMode: 'vertical-lr', transform: 'rotate(180deg)', height: '140px' }}
                      title={ind}
                    >
                      <span className="block truncate max-w-[110px]">
                        {ind}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.countries.map((country, ri) => (
                  <tr key={country} className={clsx("transition-colors", isLight ? "hover:bg-emerald-50/30" : "hover:bg-white/5")}>
                    <td className={clsx(
                      "p-2 font-semibold border sticky left-0 whitespace-nowrap z-10",
                      isLight ? "bg-white border-gray-200 text-gray-700" : "bg-[#00130d] border-white/10 text-gray-300"
                    )}>
                      {country}
                    </td>
                    {data.matrix[ri].map((val, ci) => (
                      <td
                        key={ci}
                        className={clsx("border text-center transition-all", isLight ? "border-gray-200" : "border-white/10")}
                        style={{ backgroundColor: cellColors[val] }}
                        title={`${country} — ${data.indicators[ci]}: ${CELL_LABELS[val]}`}
                      >
                        <span style={{ color: cellText[val], fontSize: 10, fontWeight: 'bold' }}>
                          {val === 2 ? '✓' : val === 1 ? '✗' : '·'}
                        </span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {data && (
        <div className="grid grid-cols-3 gap-4">
          {CELL_LABELS.map((label, i) => {
            const count = data.matrix.flat().filter(v => v === i).length
            const total = data.matrix.flat().length
            const pct = total > 0 ? Math.round(count / total * 100) : 0
            return (
              <Card key={i} className="text-center">
                <div
                  className="text-2xl font-bold mb-1"
                  style={{ color: cellText[i] }}
                >
                  {pct}%
                </div>
                <div className={clsx("text-[10px] font-bold uppercase tracking-wider", colors.text.secondary)}>{label}</div>
                <div className={clsx("text-xs mt-0.5", colors.text.muted)}>{count} indicators</div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
