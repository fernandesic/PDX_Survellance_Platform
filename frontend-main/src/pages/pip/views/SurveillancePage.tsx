import React, { useState } from 'react'
import {
  PieChart, Pie, Cell, Tooltip,
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts'
import { Activity } from 'lucide-react'
import {
  SectionTitle, LoadingSpinner, ErrorAlert,
  Card, KPICard, ResponsePill
} from '../components/UI'
import { useTheme } from '@/contexts/ThemeContext'
import { useThemeColors } from '@/contexts/useThemeColors'
import { useAsync } from '../hooks/useAsync'
import { fetchIndicators, type IndicatorDetail } from '../utils/api'
import clsx from 'clsx'

const PIE_COLORS = ['#10B981', '#059669', '#047857', '#065F46', '#34D399', '#F97316', '#EF4444', '#06B6D4']

const SURV_CATEGORIES = [
  'Influenza like Illness (ILI) Surveillance',
  'Severe acute respiratory infection (SARI) surveillance',
]

function IndicatorPieCard({ ind }: { ind: IndicatorDetail }) {
  const { theme } = useTheme()
  const colors = useThemeColors()
  const isLight = theme === 'light'

  const pieData = Object.entries(ind.responses)
    .map(([name, value]) => ({ name, value }))
    .filter(d => d.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 8)

  const total = pieData.reduce((s, d) => s + d.value, 0)

  return (
    <Card className="flex flex-col gap-3">
      <div>
        <p className={clsx("text-[10px] font-semibold uppercase tracking-wide", colors.text.muted)}>{ind.category}</p>
        <h3 className={clsx("text-sm font-semibold mt-0.5 leading-snug", colors.text.primary)}>{ind.indicator}</h3>
        {ind.yes_rate !== null && (
          <p className="text-xs font-bold mt-1 text-emerald-500">Yes Rate: {ind.yes_rate}%</p>
        )}
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <PieChart>
          <Pie
            data={pieData}
            cx="50%"
            cy="50%"
            outerRadius={65}
            dataKey="value"
            label={({ name, percent }) => `${(name || '').slice(0, 12)} ${((percent || 0) * 100).toFixed(0)}%`}
            labelLine={false}
            fontSize={9}
          >
            {pieData.map((_, i) => (
              <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip 
            contentStyle={{ 
              backgroundColor: isLight ? '#fff' : '#082E23', 
              borderColor: isLight ? '#e5e7eb' : '#059669',
              color: isLight ? '#1f2937' : '#fff'
            }}
            formatter={(v: number) => [`${v} countries (${Math.round(v/total*100)}%)`, '']} 
          />
        </PieChart>
      </ResponsiveContainer>
      <div className={clsx("text-xs text-center", colors.text.muted)}>{total} responses</div>
    </Card>
  )
}

export default function SurveillancePage() {
  const { theme } = useTheme()
  const colors = useThemeColors()
  const isLight = theme === 'light'
  const primaryBrandHex = isLight ? '#065F46' : '#10B981'

  const [activeCategory, setActiveCategory] = useState(SURV_CATEGORIES[0])

  const { data: allInd, loading, error } = useAsync(
    () => fetchIndicators(activeCategory),
    [activeCategory]
  )

  // Sentinel sites bar chart
  const siteIndicator = allInd?.find(i =>
    i.indicator.toLowerCase().includes('number') && i.indicator.toLowerCase().includes('sites')
  )
  const siteData = siteIndicator
    ? Object.entries(siteIndicator.responses)
        .filter(([, v]) => v > 0)
        .map(([name, count]) => ({ sites: name, countries: count }))
        .sort((a, b) => Number(b.sites) - Number(a.sites))
        .slice(0, 12)
    : []

  const yesRate = allInd
    ? Math.round(
        allInd.filter(i => i.yes_rate !== null).reduce((s, i) => s + (i.yes_rate ?? 0), 0) /
        allInd.filter(i => i.yes_rate !== null).length
      )
    : null

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className={clsx("text-2xl font-bold", colors.text.primary)}>Surveillance Systems</h1>
          <p className={clsx("text-sm mt-1 font-medium", colors.text.secondary)}>ILI & SARI sentinel surveillance capacity across AFRO</p>
        </div>
        <div className="flex gap-2">
          {SURV_CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={clsx(
                "px-3 py-1.5 text-xs font-semibold rounded-full border transition-all",
                activeCategory === cat
                  ? "bg-emerald-600 text-white border-transparent shadow-md"
                  : isLight 
                    ? "border-gray-300 text-gray-600 hover:border-emerald-600 hover:text-emerald-600"
                    : "border-white/10 text-gray-400 hover:border-emerald-400/50 hover:text-emerald-300"
              )}
            >
              {cat.includes('ILI') ? 'ILI' : 'SARI'}
            </button>
          ))}
        </div>
      </div>

      {loading && <LoadingSpinner />}
      {error && <ErrorAlert message={error} />}

      {allInd && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KPICard
              title="Indicators"
              value={allInd.length}
              icon={<Activity size={18} />}
              color={primaryBrandHex}
            />
            <KPICard
              title="Avg Yes Rate"
              value={yesRate !== null ? `${yesRate}%` : '—'}
              color="#10B981"
            />
            <KPICard
              title="Category"
              value={activeCategory.includes('ILI') ? 'ILI' : 'SARI'}
              subtitle={activeCategory.includes('ILI')
                ? 'Influenza-like Illness'
                : 'Severe Acute Respiratory Infection'}
              color="#3B82F6"
            />
            <KPICard
              title="Countries Covered"
              value={47}
              subtitle="AFRO member states"
              color={primaryBrandHex}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {allInd
              .filter(i => i.yes_rate !== null || Object.keys(i.responses).length <= 5)
              .map(ind => (
                <IndicatorPieCard key={ind.indicator_id} ind={ind} />
              ))}
          </div>

          {siteData.length > 0 && (
            <Card>
              <SectionTitle subtitle="Distribution of reported sentinel sites per country">
                Sentinel Site Distribution
              </SectionTitle>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={siteData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isLight ? "#e5e7eb" : "rgba(255,255,255,0.05)"} />
                  <XAxis dataKey="sites" tick={{ fontSize: 11, fill: isLight ? '#6b7280' : '#A8C4BB' }} label={{ value: 'No. of Sites', position: 'insideBottom', offset: -2, fill: isLight ? '#6b7280' : '#A8C4BB', fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11, fill: isLight ? '#6b7280' : '#A8C4BB' }} label={{ value: 'Countries', angle: -90, position: 'insideLeft', fill: isLight ? '#6b7280' : '#A8C4BB', fontSize: 10 }} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: isLight ? '#fff' : '#082E23', 
                      borderColor: isLight ? '#e5e7eb' : '#059669',
                      color: isLight ? '#1f2937' : '#fff'
                    }}
                    formatter={(v: number) => [v, 'Countries']} 
                  />
                  <Bar dataKey="countries" fill={primaryBrandHex} radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          )}

          {/* Full response table */}
          <Card>
            <SectionTitle subtitle="All indicator responses in this category">
              Indicator Response Table
            </SectionTitle>
            <div className="overflow-x-auto">
              <table className="w-full data-table">
                <thead>
                  <tr>
                    <th>Indicator</th>
                    <th className="text-center">Yes Rate</th>
                    <th>Top Response</th>
                    <th className="text-center">Countries (Yes)</th>
                    <th className="text-center">Countries (No)</th>
                    <th className="text-center">No Response</th>
                  </tr>
                </thead>
                <tbody>
                  {allInd.map(ind => {
                    const yes = ind.responses['Yes'] ?? 0
                    const no  = ind.responses['No'] ?? 0
                    const nr  = ind.responses['No response'] ?? 0
                    const top = Object.entries(ind.responses).sort((a,b)=>b[1]-a[1])[0]
                    return (
                      <tr key={ind.indicator_id} className={isLight ? "" : "border-b border-white/5"}>
                        <td className={clsx("max-w-xs text-xs leading-relaxed", colors.text.secondary)}>{ind.indicator}</td>
                        <td className={clsx("text-center font-bold", isLight ? "text-emerald-600" : "text-emerald-400")}>
                          {ind.yes_rate !== null ? `${ind.yes_rate}%` : '—'}
                        </td>
                        <td><ResponsePill response={top?.[0] ?? '—'} /></td>
                        <td className="text-center text-emerald-500 font-semibold">{yes}</td>
                        <td className="text-center text-rose-500 font-semibold">{no}</td>
                        <td className={clsx("text-center", colors.text.muted)}>{nr}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
