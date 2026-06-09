import React from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend
} from 'recharts'
import { Shield } from 'lucide-react'
import {
  SectionTitle, LoadingSpinner, ErrorAlert, Card, KPICard, ResponsePill
} from '../components/UI'
import { useTheme } from '@/contexts/ThemeContext'
import { useThemeColors } from '@/contexts/useThemeColors'
import { useAsync } from '../hooks/useAsync'
import { fetchIndicators } from '../utils/api'
import clsx from 'clsx'

const PIE_COLORS = ['#EF4444','#F59E0B','#10B981','#059669','#F97316','#06B6D4']

export default function PreparednessPage() {
  const { theme } = useTheme()
  const colors = useThemeColors()
  const isLight = theme === 'light'
  const primaryBrandHex = isLight ? '#065F46' : '#10B981'

  const pp   = useAsync(() => fetchIndicators('Pandemic preparedness and response'))
  const vacc = useAsync(() => fetchIndicators('Vaccination'))
  const zoo  = useAsync(() => fetchIndicators('Zoonotic Influenza surveillance'))
  const intg = useAsync(() => fetchIndicators('Integration of Influenza surveillance and SARS-CoV-2'))

  const loading = pp.loading || vacc.loading || zoo.loading || intg.loading
  const error   = pp.error || vacc.error || zoo.error || intg.error

  const ppYes  = pp.data?.reduce((s, i) => s + (i.responses['Yes'] ?? 0), 0) ?? 0
  const vaccYes = vacc.data?.find(i => i.indicator.toLowerCase().includes('vaccination policy'))?.responses['Yes'] ?? 0
  const zooYes  = zoo.data?.find(i => i.indicator.toLowerCase().includes('surveillance activities'))?.responses['Yes'] ?? 0
  const intgYes = intg.data?.find(i => i.indicator.toLowerCase().includes('integrated'))?.responses['Yes'] ?? 0

  const ppBarData = pp.data
    ?.filter(i => i.yes_rate !== null)
    .map(i => ({
      name: i.indicator.length > 50 ? i.indicator.slice(0,50) + '…' : i.indicator,
      value: i.yes_rate ?? 0,
    })) ?? []

  const vaccData = vacc.data?.find(i => i.indicator.toLowerCase().includes('risk groups'))
  const vaccPieData = vaccData
    ? Object.entries(vaccData.responses).filter(([,v])=>v>0).map(([n,v])=>({name:n,value:v}))
    : []

  return (
    <div className="space-y-6">
      <div>
        <h1 className={clsx("text-2xl font-bold", colors.text.primary)}>Preparedness & Vaccination</h1>
        <p className={clsx("text-sm mt-1 font-medium", colors.text.secondary)}>Pandemic plans, vaccination policy, zoonotic surveillance, SARS-CoV-2 integration</p>
      </div>

      {loading && <LoadingSpinner />}
      {error && <ErrorAlert message={error} />}

      {!loading && !error && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KPICard title="Countries with Pandemic Plan" value={vaccYes > 0 ? ppYes : '—'} icon={<Shield size={18}/>} color="#EF4444" />
            <KPICard title="Vaccination Policy" value={vaccYes} subtitle="Countries" color="#10B981" />
            <KPICard title="Zoonotic Surveillance" value={zooYes} subtitle="Countries" color="#F97316" />
            <KPICard title="Flu+COVID Integration" value={intgYes} subtitle="Countries" color="#06B6D4" />
          </div>

          {/* Pandemic preparedness bar chart */}
          {ppBarData.length > 0 && (
            <Card>
              <SectionTitle subtitle="Yes-rate for pandemic preparedness indicators">
                Pandemic Preparedness Indicators
              </SectionTitle>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={ppBarData} layout="vertical" margin={{ left: 8, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={isLight ? "#e5e7eb" : "rgba(255,255,255,0.1)"} />
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
                  <Bar dataKey="value" radius={[0,4,4,0]}>
                    {ppBarData.map((entry, i) => (
                      <Cell key={i} fill={entry.value >= 60 ? '#10B981' : entry.value >= 30 ? '#F59E0B' : '#EF4444'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Vaccination risk groups pie */}
            {vaccPieData.length > 0 && (
              <Card>
                <SectionTitle subtitle="Recommended priority groups for influenza vaccine">
                  Vaccination Risk Groups
                </SectionTitle>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie data={vaccPieData} dataKey="value" cx="50%" cy="50%" outerRadius={80}>
                      {vaccPieData.map((_, i) => (
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
              </Card>
            )}

            {/* Zoonotic table */}
            {zoo.data && (
              <Card>
                <SectionTitle subtitle="Human-animal interface surveillance">
                  Zoonotic Influenza Surveillance
                </SectionTitle>
                <div className="space-y-3">
                  {zoo.data.map(ind => (
                    <div key={ind.indicator_id} className={clsx("border-b pb-3", isLight ? "border-gray-50" : "border-white/5")}>
                      <p className={clsx("text-xs font-medium mb-1.5 leading-relaxed", colors.text.primary)}>{ind.indicator}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {Object.entries(ind.responses).filter(([,v])=>v>0).map(([resp, count]) => (
                          <span key={resp} className={clsx("text-[10px] font-bold px-2 py-0.5 rounded-full", isLight ? "bg-gray-100 text-gray-600" : "bg-white/5 text-gray-400")}>
                            {resp}: {count}
                          </span>
                        ))}
                      </div>
                      {ind.yes_rate !== null && (
                        <p className="text-xs text-emerald-500 font-bold mt-1">Yes Rate: {ind.yes_rate}%</p>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>

          {/* Integration table */}
          {intg.data && intg.data.length > 0 && (
            <Card>
              <SectionTitle subtitle="Influenza & SARS-CoV-2 sentinel surveillance integration">
                Influenza / SARS-CoV-2 Integration
              </SectionTitle>
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
                    {intg.data.map(ind => (
                      <tr key={ind.indicator_id} className={isLight ? "" : "border-b border-white/5"}>
                        <td className={clsx("text-xs leading-relaxed max-w-sm", colors.text.secondary)}>{ind.indicator}</td>
                        <td className="text-center text-emerald-500 font-bold">{ind.responses['Yes'] ?? 0}</td>
                        <td className="text-center text-rose-500 font-bold">{ind.responses['No'] ?? 0}</td>
                        <td className={clsx("text-center", colors.text.muted)}>{ind.responses['No response'] ?? 0}</td>
                        <td className="text-center">
                          {ind.yes_rate !== null
                            ? <ResponsePill response={`${ind.yes_rate}%`} />
                            : <span className={clsx("text-xs opacity-30", colors.text.muted)}>—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
