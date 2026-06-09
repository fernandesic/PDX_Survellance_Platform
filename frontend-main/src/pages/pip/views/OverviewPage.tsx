import React from 'react'
import {
  RadarChart, PolarGrid, PolarAngleAxis, Radar,
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  Tooltip, CartesianGrid, Cell
} from 'recharts'
import {
  Globe, Activity, FlaskConical, Shield,
  Newspaper, TrendingUp, ExternalLink
} from 'lucide-react'
import clsx from 'clsx'
import {
  KPICard, SectionTitle, LoadingSpinner, ErrorAlert,
  Card, ExternalLinkButton
} from '../components/UI'
import { useTheme } from '@/contexts/ThemeContext'
import { useThemeColors } from '@/contexts/useThemeColors'
import { useAsync } from '../hooks/useAsync'
import {
  fetchSummary, fetchRegionalComparison,
  fetchBulletin, fetchCategories
} from '../utils/api'

const BAR_COLORS = ['#2DD4BF', '#0D9488', '#0F766E', '#115E59', '#14B8A6', '#5EEAD4', '#99F6E4', '#CCFBF1', '#2DD4BF', '#0D9488']

export default function OverviewPage() {
  const { theme } = useTheme()
  const colors = useThemeColors()
  const isLight = theme === 'light'
  
  const summary  = useAsync(fetchSummary)
  const radar    = useAsync(fetchRegionalComparison)
  const bulletin = useAsync(fetchBulletin)
  const cats     = useAsync(fetchCategories)
  
  const primaryBrand = isLight ? '#0D9488' : '#2DD4BF'

  const radarData = React.useMemo(() => {
    if (!radar.data) return []
    return Object.entries(radar.data)
      .map(([cat, val]) => ({
        subject: cat.replace(/\(.*?\)/g, '').trim().replace('Influenza like Illness', 'ILI')
                     .replace('Severe acute respiratory infection', 'SARI')
                     .replace('Pandemic preparedness and response', 'Pandemic')
                     .replace('Integration of Influenza surveillance and SARS-CoV-2', 'Integration')
                     .replace('Zoonotic Influenza surveillance', 'Zoonotic'),
        value: val,
      }))
  }, [radar.data])

  const barData = React.useMemo(() => {
    if (!cats.data) return []
    return cats.data.map(c => ({
      name: c.category.replace(/\(.*?\)/g, '').trim()
                 .replace('Influenza like Illness', 'ILI')
                 .replace('Severe acute respiratory infection', 'SARI')
                 .replace('Pandemic preparedness and response', 'Pandemic')
                 .replace('Integration of Influenza surveillance and SARS-CoV-2', 'Integration')
                 .replace('Virological surveillance', 'Virological')
                 .replace('Zoonotic Influenza surveillance', 'Zoonotic')
                 .replace('Data reporting & use', 'Data/Reporting')
                 .replace('Population and Economy', 'Population')
                 .replace('Mortality per 100 000 population', 'Mortality/100k')
                 .replace('Mortality per 1000 live births', 'Mortality/1k births'),
      yes_rate: c.yes_rate,
    }))
  }, [cats.data])

  return (
    <div className="space-y-6">
      {/* ── Page title ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-2xl font-bold ${isLight ? 'text-gray-900' : 'text-white'}`}>PIP Intelligence Dashboard</h1>
          <p className={`text-sm mt-1 font-medium ${colors.text.secondary}`}>
            WHO AFRO · Pandemic Influenza Preparedness · 2024 Landscape Survey · 47 Member States
          </p>
        </div>
        <div className="flex gap-2">
          <ExternalLinkButton href="https://af-pip-landscape-survey-g0bgdjekhzewdqah.westeurope-01.azurewebsites.net/pip-landscape-survey/">
            Landscape Survey
          </ExternalLinkButton>
        </div>
      </div>

      {/* ── KPIs ── */}
      {summary.loading && <LoadingSpinner label="Loading summary…" />}
      {summary.error && <ErrorAlert message={summary.error} />}
      {summary.data && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <KPICard
            title="Member States"
            value={summary.data.total_countries}
            subtitle="AFRO Region"
            icon={<Globe />}
            color={primaryBrand}
          />
          <KPICard
            title="Overall Yes Rate"
            value={`${summary.data.overall_yes_rate}%`}
            subtitle="All indicators"
            icon={<TrendingUp />}
            color="#2DD4BF"
          />
          <KPICard
            title="Countries with NIC"
            value={summary.data.countries_with_nic}
            subtitle="WHO-recognized"
            icon={<FlaskConical />}
            color="#0EA5E9"
          />
          <KPICard
            title="Countries with PCR"
            value={summary.data.countries_with_pcr}
            subtitle="RT-PCR capacity"
            icon={<Activity />}
            color="#38BDF8"
          />
          <KPICard
            title="Pandemic Plans"
            value={summary.data.countries_with_pandemic_plan}
            subtitle="PRET framework"
            icon={<Shield />}
            color="#818CF8"
          />
        </div>
      )}

      {/* ── Secondary KPIs ── */}
      {summary.data && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KPICard
            title="Vaccination Policy"
            value={summary.data.countries_with_vaccination_policy}
            subtitle="Countries"
            color="#FBBF24"
          />
          <KPICard
            title="FluID Reporters"
            value={summary.data.countries_reporting_fluid}
            subtitle="Countries"
            color={primaryBrand}
          />
          <KPICard
            title="FluNet Reporters"
            value={summary.data.countries_reporting_flunet}
            subtitle="Countries"
            color="#6366F1"
          />
          <KPICard
            title="Total Indicators"
            value={summary.data.total_indicators}
            subtitle={`${summary.data.total_categories} categories`}
            color="#94A3B8"
          />
        </div>
      )}

      {/* ── Charts row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Radar */}
        <Card>
          <SectionTitle subtitle="Yes-rate by surveillance domain">
            Regional Radar — Domain Coverage
          </SectionTitle>
          {radar.loading ? <LoadingSpinner /> : radar.error ? <ErrorAlert message={radar.error} /> : (
            <ResponsiveContainer width="100%" height={320}>
              <RadarChart data={radarData} cx="50%" cy="50%" outerRadius={110}>
                <PolarGrid stroke={isLight ? "#e5e7eb" : "rgba(255,255,255,0.1)"} />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: isLight ? '#6b7280' : '#A8C4BB' }} />
                <Radar 
                  dataKey="value" 
                  stroke={primaryBrand} 
                  fill={primaryBrand} 
                  fillOpacity={isLight ? 0.25 : 0.4} 
                  strokeWidth={2} 
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: isLight ? '#fff' : '#1e1b4b', 
                    borderColor: isLight ? '#e5e7eb' : '#4338CA',
                    color: isLight ? '#1f2937' : '#fff'
                  }}
                  itemStyle={{ color: isLight ? '#1f2937' : '#fff' }}
                  formatter={(v: number) => [`${v}%`, 'Yes Rate']} 
                />
              </RadarChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Bar */}
        <Card>
          <SectionTitle subtitle="Proportion of 'Yes' responses per category">
            Category Yes-Rates
          </SectionTitle>
          {cats.loading ? <LoadingSpinner /> : cats.error ? <ErrorAlert message={cats.error} /> : (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={barData} layout="vertical" margin={{ left: 8, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis 
                  type="number" 
                  domain={[0, 100]} 
                  tickFormatter={v => `${v}%`} 
                  tick={{ fontSize: 11, fill: isLight ? '#6b7280' : '#A8C4BB' }} 
                />
                <YAxis 
                  type="category" 
                  dataKey="name" 
                  width={110} 
                  tick={{ fontSize: 10, fill: isLight ? '#6b7280' : '#A8C4BB' }} 
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: isLight ? '#fff' : '#1e1b4b', 
                    borderColor: isLight ? '#e5e7eb' : '#4338CA',
                    color: isLight ? '#1f2937' : '#fff'
                  }}
                  itemStyle={{ color: isLight ? '#1f2937' : '#fff' }}
                  formatter={(v: number) => [`${v}%`, 'Yes Rate']} 
                />
                <Bar dataKey="yes_rate" radius={[0, 4, 4, 0]}>
                  {barData.map((_, i) => (
                    <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      {/* ── Epi Bulletin ── */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Newspaper size={18} className={colors.pipBrand.primary} />
          <SectionTitle>Weekly Epidemiological Bulletin</SectionTitle>
        </div>
        {bulletin.loading ? <LoadingSpinner label="Fetching latest bulletin…" /> :
         bulletin.error ? <ErrorAlert message={bulletin.error} /> : bulletin.data && (
          <div className="bulletin-card pl-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <span className={clsx(
                    "text-xs font-bold px-3 py-1 rounded-full",
                    isLight ? "bg-emerald-600 text-white" : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                  )}>
                    {bulletin.data.epi_week}
                  </span>
                  <span className={`text-xs ${colors.text.secondary}`}>{bulletin.data.publication_date}</span>
                  <span className={`text-xs ${colors.text.secondary}`}>· {bulletin.data.source}</span>
                </div>
                <h3 className={`font-semibold mb-3 ${colors.text.primary}`}>{bulletin.data.headline}</h3>
                <ul className="space-y-1.5">
                  {bulletin.data.key_findings.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span className={clsx("mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0", isLight ? "bg-emerald-600" : "bg-emerald-400")} />
                      <span className={colors.text.secondary}>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <a
                href={bulletin.data.bulletin_url}
                target="_blank"
                rel="noopener noreferrer"
                className={clsx(
                  "flex-shrink-0 flex items-center gap-2 px-4 py-2 border text-sm font-medium rounded-lg transition-all",
                  isLight 
                    ? "border-emerald-600 text-emerald-600 hover:bg-emerald-600 hover:text-white" 
                    : "border-emerald-400/50 text-emerald-400 hover:bg-emerald-400/10"
                )}
              >
                View Full Bulletin <ExternalLink size={13} />
              </a>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
