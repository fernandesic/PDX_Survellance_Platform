import { useTheme } from '@/contexts/ThemeContext'
import { useThemeColors } from '@/contexts/useThemeColors'
import clsx from 'clsx'
import StatCard from './components/StatCard'
import AfricaMap from './components/AfricaMap'
import RankingsTable from './components/RankingsTable'
import RegionalTrend from './components/RegionalTrend'
import CountryIntelPanel from './components/CountryIntelPanel'
import CampaignTracker from './components/CampaignTracker'
import EquityPanel from './components/EquityPanel'
import TrendsPanel from './components/TrendsPanel'
import { ANTIGENS } from './constants/ocv'
import { fmtDoses } from './services/ocv'

// ─── Tab config ───────────────────────────────────────────────────────────────
const TABS = [
  { key: 'overview', label: 'Overview', icon: '◉' },
  { key: 'country', label: 'Country Intel', icon: '⬡' },
  { key: 'campaigns', label: 'OCV Campaigns', icon: '💉' },
  { key: 'equity', label: 'Equity & Dropout', icon: '◈' },
  { key: 'trends', label: 'AFRO Trends', icon: '∿' },
]

// ─── Antigen selector pill ────────────────────────────────────────────────────

interface AntigenSelectorProps {
  active: string
  onChange: (key: string) => void
}

function AntigenSelector({ active, onChange }: AntigenSelectorProps) {
  const { theme } = useTheme()
  const isLight = theme === 'light'

  return (
    <div className={clsx("flex gap-1 rounded-lg p-1 transition-colors", isLight ? "bg-slate-100" : "bg-white/[0.04]")}>
      {ANTIGENS.map(a => (
        <button
          key={a.key}
          onClick={() => onChange(a.key)}
          className="py-[5px] px-2.5 rounded-md border-none cursor-pointer text-[10px] font-bold font-mono transition-all duration-150 tracking-[0.04em]"
          style={{
            background: active === a.key ? a.color : 'transparent',
            color: active === a.key ? (isLight ? '#fff' : '#060d1a') : (isLight ? '#64748b' : 'rgba(255,255,255,0.38)'),
          }}
        >
          {a.key}
        </button>
      ))}
    </div>
  )
}

// ─── PDX footer cross-links ───────────────────────────────────────────────────
const FOOTER_LINKS = ['TRIAD', 'HSSPM', 'Risk Sentinel', 'Decision WHO']

interface OcvViewProps {
  activeAntigen: string;
  setActiveAntigen: (key: string) => void;
  selectedCountry: string;
  setSelectedCountry: (code: string) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  data: any;
}

export default function OcvView({
  activeAntigen,
  setActiveAntigen,
  selectedCountry,
  setSelectedCountry,
  activeTab,
  setActiveTab,
  data
}: OcvViewProps) {
  const { theme } = useTheme()
  const colors = useThemeColors()
  const isLight = theme === 'light'

  const { countries, trendsMap, avgMap, kpis, metadata } = data;
  const ag = ANTIGENS.find(a => a.key === activeAntigen)

  // Navigate to country detail from other tabs
  function goToCountry(code: string) {
    setSelectedCountry(code)
    setActiveTab('country')
  }

  return (
    <div
      className={clsx(
        "min-h-screen font-grotesk transition-colors duration-500",
        isLight ? "text-slate-900 bg-gradient-to-br from-cyan-50 via-blue-50 to-white" : "text-[#e8f0ff]"
      )}
      style={!isLight ? { background: 'linear-gradient(145deg, #060d1a 0%, #0a1628 50%, #060d1a 100%)' } : {}}
    >

      {/* ── HEADER ── */}
      <header className={clsx(
        "backdrop-blur-[20px] border-b py-3 px-6 sticky top-0 z-[100] flex items-center justify-between gap-4 transition-all duration-300",
        isLight ? "bg-white/80 border-slate-200 shadow-sm" : "bg-[rgba(6,13,26,0.96)] border-[rgba(0,212,255,0.1)]"
      )}>
        {/* Brand */}
        <div className="flex items-center gap-3.5">
          <div>
            <div
              className="font-extrabold text-base tracking-tight font-grotesk"
            >
              OCV Intelligence Platform
            </div>
            <div className={clsx("text-[9px] font-mono tracking-[0.1em]", isLight ? "text-slate-400" : "text-white/[0.32]")}>
              PDX · WHO AFRO · 47 MEMBER STATES · 2015–2024
            </div>
          </div>
        </div>

        {/* Antigen selector */}
        <AntigenSelector active={activeAntigen} onChange={setActiveAntigen} />

        {/* Live badge */}
        <div className="flex items-center gap-2">
          <div className={clsx("w-[7px] h-[7px] rounded-full", isLight ? "bg-emerald-500 shadow-[0_0_8px_#10b981]" : "bg-[#00e5a0] shadow-[0_0_8px_#00e5a0]")} />
          <span className={clsx("text-[10px] font-mono", isLight ? "text-slate-400" : "text-white/[0.38]")}>
            LIVE · Apr 2026
          </span>
        </div>
      </header>

      {/* ── TAB BAR ── */}
      <nav className={clsx(
        "flex px-6 border-b transition-all duration-300",
        isLight ? "bg-slate-50/50 border-slate-200" : "border-white/[0.06] bg-[rgba(6,13,26,0.72)]"
      )}>
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`
              py-2.5 px-[18px] border-none bg-transparent cursor-pointer
              text-[11px] font-mono tracking-[0.06em] whitespace-nowrap
              -mb-px transition-all duration-150 border-b-2
              ${activeTab === t.key
                ? (isLight ? 'text-blue-600 border-b-blue-600' : 'text-[#00d4ff] border-b-[#00d4ff]')
                : (isLight ? 'text-slate-400 border-b-transparent' : 'text-white/[0.32] border-b-transparent')
              }
            `}
          >
            <span className="mr-1.5">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </nav>

      {/* ── TAB CONTENT ── */}
      <main className="py-5 px-6 tab-panel">

        {/* ── OVERVIEW ── */}
        {activeTab === 'overview' && (
          <>
            {/* KPI row */}
            <div className="grid grid-cols-4 gap-3 mb-5">
              <StatCard
                label="AFRO MCV1 Avg 2024"
                value={`${kpis.mcv1Avg}%`}
                sub="vs 95% WHO target"
                color="#00d4ff"
                icon="◉"
              />
              <StatCard
                label="Below 95% Target"
                value={kpis.below95}
                sub={`countries · ${activeAntigen}`}
                color="#ffb800"
                icon="⚠"
                alert={kpis.below95 > 25}
              />
              <StatCard
                label="Critical (<80%)"
                value={kpis.critical}
                sub={`countries · ${activeAntigen}`}
                color="#ff4757"
                icon="🔴"
                alert={kpis.critical > 5}
              />
              <StatCard
                label="Total MCV1 Doses"
                value={fmtDoses(kpis.totalDoses)}
                sub="administered 2024"
                color="#00e5a0"
                icon="💉"
              />
            </div>

            {/* Map + Rankings */}
            <div className="grid grid-cols-[1.4fr_0.6fr] gap-4 mb-4">
              <div className={clsx(
                "border rounded-xl p-4 transition-all duration-300",
                isLight ? "bg-white border-slate-200 shadow-sm" : "bg-white/[0.02] border-white/[0.06]"
              )}>
                <div className="flex justify-between items-center mb-3">
                  <span className={clsx("text-xs font-semibold font-mono", isLight ? "text-slate-600" : "text-white/70")}>
                    {ag?.label} Coverage · 2024
                  </span>
                  <span className={clsx("text-[10px] font-mono", isLight ? "text-slate-400" : "text-white/[0.22]")}>
                    Dot size ∝ coverage · Click to explore
                  </span>
                </div>
                <AfricaMap
                  countries={countries}
                  antigen={activeAntigen}
                  selected={selectedCountry}
                  onSelect={(code: string | null) => { setSelectedCountry(code ?? 'NGA'); if (code) setActiveTab('country') }}
                />
              </div>

              <div className={clsx(
                "border rounded-xl p-4 transition-all duration-300",
                isLight ? "bg-white border-slate-200 shadow-sm" : "bg-white/[0.02] border-white/[0.06]"
              )}>
                <div className={clsx("text-xs font-semibold font-mono mb-3", isLight ? "text-slate-600" : "text-white/70")}>
                  Rankings · {ag?.label}
                </div>
                <RankingsTable
                  countries={countries}
                  antigen={activeAntigen}
                  selected={selectedCountry}
                  onSelect={(code: string | null) => { if (code) goToCountry(code) }}
                />
              </div>
            </div>

            {/* Regional trend */}
            <div className={clsx(
              "border rounded-xl p-4 transition-all duration-300",
              isLight ? "bg-white border-slate-200 shadow-sm" : "bg-white/[0.02] border-white/[0.06]"
            )}>
              <div className={clsx("text-xs font-semibold font-mono mb-1", isLight ? "text-slate-600" : "text-white/70")}>
                AFRO Regional Averages · All Antigens · 2015–2024
              </div>
              <div className={clsx("text-[10px] font-mono mb-3", isLight ? "text-slate-400" : "text-white/[0.28]")}>
                COVID-19 disruption 2020–2021 clearly visible · Bold line = active antigen
              </div>
              <RegionalTrend avgMap={avgMap} activeAntigen={activeAntigen} />
            </div>
          </>
        )}

        {/* ── COUNTRY INTEL ── */}
        {activeTab === 'country' && (
          <CountryIntelPanel
            countries={countries}
            selected={selectedCountry}
            onSelect={setSelectedCountry}
            activeAntigen={activeAntigen}
            onSetAntigen={setActiveAntigen}
            trendsMap={trendsMap}
            avgMap={avgMap}
          />
        )}

        {/* ── OCV CAMPAIGNS ── */}
        {activeTab === 'campaigns' && (
          <CampaignTracker countries={countries} />
        )}

        {/* ── EQUITY & DROPOUT ── */}
        {activeTab === 'equity' && (
          <EquityPanel
            countries={countries}
            antigen={activeAntigen}
            onSelectCountry={goToCountry}
          />
        )}

        {/* ── AFRO TRENDS ── */}
        {activeTab === 'trends' && (
          <TrendsPanel avgMap={avgMap} activeAntigen={activeAntigen} />
        )}

      </main>

      {/* ── FOOTER ── */}
      <footer className={clsx(
        "py-3 px-6 border-t flex justify-between items-center flex-wrap gap-2 transition-all duration-300",
        isLight ? "bg-slate-50/80 border-slate-200" : "border-white/[0.05]"
      )}>
        <span className={clsx("text-[9px] font-mono", isLight ? "text-slate-400" : "text-white/20")}>
          PDX OCV Intelligence · WHO AFRO Health Emergency Preparedness ·
          Data: WHO/UNICEF WUENIC {metadata?.generated?.slice(0, 4) ?? '2024'}
        </span>
        <div className="flex gap-1.5">
          {FOOTER_LINKS.map(s => (
            <span
              key={s}
              className={clsx(
                "py-0.5 px-2 border rounded text-[9px] font-mono cursor-pointer transition-all [transition-duration:130ms]",
                isLight
                  ? "bg-blue-50 border-blue-100 text-blue-600 hover:bg-blue-100"
                  : "bg-[rgba(0,212,255,0.06)] border border-[rgba(0,212,255,0.1)] text-[rgba(0,212,255,0.4)] hover:text-[#00d4ff] hover:bg-[rgba(0,212,255,0.12)]"
              )}
            >
              → {s}
            </span>
          ))}
        </div>
      </footer>
    </div>
  )
}
