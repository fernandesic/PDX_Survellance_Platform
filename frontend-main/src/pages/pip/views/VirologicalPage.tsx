import React from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts'
import { FlaskConical } from 'lucide-react'
import {
  SectionTitle, LoadingSpinner, ErrorAlert, Card, KPICard, ResponsePill
} from '../components/UI'
import { useTheme } from '@/contexts/ThemeContext'
import { useThemeColors } from '@/contexts/useThemeColors'
import { useAsync } from '../hooks/useAsync'
import { fetchIndicators } from '../utils/api'
import clsx from 'clsx'

const PIE_COLORS = ['#10B981', '#059669', '#047857', '#065F46', '#34D399', '#F97316', '#EF4444']

export default function VirologicalPage() {
  const { theme } = useTheme()
  const colors = useThemeColors()
  const isLight = theme === 'light'
  const primaryBrandHex = isLight ? '#065F46' : '#10B981'

  const { data, loading, error } = useAsync(() => fetchIndicators('Virological surveillance'))

  const yesRateData = data?.filter(i => i.yes_rate !== null).map(i => ({
    name: i.indicator.length > 45 ? i.indicator.slice(0, 45) + '…' : i.indicator,
    value: i.yes_rate ?? 0,
  })) ?? []

  const nicInd = data?.find(i => i.indicator.toLowerCase().includes('national influenza centre'))
  const pcrInd = data?.find(i => i.indicator.toLowerCase().includes('rt-pcr capacity'))
  const seqInd = data?.find(i => i.indicator.toLowerCase().includes('genomic sequencing'))
  const eqapInd = data?.find(i => i.indicator.toLowerCase().includes('eqap'))

  const countYes = (ind: typeof nicInd) => ind?.responses?.['Yes'] ?? 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className={clsx("text-2xl font-bold", colors.text.primary)}>Virological Surveillance</h1>
        <p className={clsx("text-sm mt-1 font-medium", colors.text.secondary)}>Laboratory capacity, NIC status, sequencing & reporting</p>
      </div>

      {loading && <LoadingSpinner />}
      {error && <ErrorAlert message={error} />}

      {data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KPICard title="Countries with NIC"     value={countYes(nicInd)}  subtitle="WHO-recognised NIC" icon={<FlaskConical size={18}/>} color={primaryBrandHex} />
            <KPICard title="Countries with RT-PCR"  value={countYes(pcrInd)}  subtitle="In-country capacity" color="#10B981" />
            <KPICard title="Genomic Sequencing"     value={countYes(seqInd)}  subtitle="Countries" color="#F97316" />
            <KPICard title="EQAP Participation"     value={countYes(eqapInd)} subtitle="Countries" color="#06B6D4" />
          </div>

          {/* Yes-rate bar chart */}
          <Card>
            <SectionTitle subtitle="Proportion of Yes responses per virological indicator">
              Virological Capacity Yes-Rates
            </SectionTitle>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={yesRateData} layout="vertical" margin={{ left: 8, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={isLight ? "#e5e7eb" : "rgba(255,255,255,0.05)"} />
                <XAxis type="number" domain={[0,100]} tickFormatter={v=>`${v}%`} tick={{ fontSize: 11, fill: isLight ? '#6b7280' : '#A8C4BB' }} />
                <YAxis type="category" dataKey="name" width={220} tick={{ fontSize: 10, fill: isLight ? '#6b7280' : '#A8C4BB' }} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: isLight ? '#fff' : '#082E23', 
                    borderColor: isLight ? '#e5e7eb' : '#059669',
                    color: isLight ? '#1f2937' : '#fff'
                  }}
                  formatter={(v: number) => [`${v}%`, 'Yes Rate']} 
                />
                <Bar dataKey="value" fill={primaryBrandHex} radius={[0,4,4,0]}>
                  {yesRateData.map((entry, i) => (
                    <Cell key={i} fill={entry.value >= 70 ? '#10B981' : entry.value >= 40 ? '#F59E0B' : '#EF4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>

          {/* Pie charts for categorical indicators */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data
              .filter(i => Object.keys(i.responses).length >= 2 && Object.keys(i.responses).length <= 6)
              .map(ind => {
                const pieData = Object.entries(ind.responses)
                  .filter(([, v]) => v > 0)
                  .map(([name, value]) => ({ name, value }))
                return (
                  <Card key={ind.indicator_id} className="flex flex-col gap-2">
                    <p className={clsx("text-xs font-semibold leading-snug", colors.text.primary)}>{ind.indicator}</p>
                    <ResponsiveContainer width="100%" height={160}>
                      <PieChart>
                        <Pie data={pieData} dataKey="value" cx="50%" cy="50%" outerRadius={55}>
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
                          formatter={(v: number) => [v, 'Countries']} 
                        />
                        <Legend iconSize={10} wrapperStyle={{ fontSize: 10, color: isLight ? '#6b7280' : '#A8C4BB' }} />
                      </PieChart>
                    </ResponsiveContainer>
                    {ind.yes_rate !== null && (
                      <p className="text-center text-xs font-bold text-emerald-500">Yes Rate: {ind.yes_rate}%</p>
                    )}
                  </Card>
                )
              })}
          </div>

          {/* Full detail table */}
          <Card>
            <SectionTitle>Full Indicator Detail</SectionTitle>
            <div className="overflow-x-auto">
              <table className="w-full data-table">
                <thead>
                  <tr>
                    <th>Indicator</th>
                    <th className="text-center">Yes</th>
                    <th className="text-center">No</th>
                    <th className="text-center">No Response</th>
                    <th className="text-center">Yes Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map(ind => (
                    <tr key={ind.indicator_id} className={isLight ? "" : "border-b border-white/5"}>
                      <td className={clsx("text-xs leading-relaxed max-w-sm", colors.text.secondary)}>{ind.indicator}</td>
                      <td className="text-center text-emerald-500 font-bold">{ind.responses['Yes'] ?? 0}</td>
                      <td className="text-center text-rose-500 font-bold">{ind.responses['No'] ?? 0}</td>
                      <td className={clsx("text-center", colors.text.muted)}>{ind.responses['No response'] ?? 0}</td>
                      <td className="text-center">
                        {ind.yes_rate !== null
                          ? <ResponsePill response={`${ind.yes_rate}%`} />
                          : <span className={clsx("text-xs opacity-30", colors.text.muted)}>—</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
