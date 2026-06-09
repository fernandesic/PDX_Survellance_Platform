import { OCV_CAMPAIGNS, STATUS_COLORS } from '../constants/ocv'
import { coverageColor, fmt } from '../services/ocv'
import { useTheme } from '@/contexts/ThemeContext'
import clsx from 'clsx'

const PIPELINE_STEPS = [
  { step: '01', label: 'Country Requests OCV', detail: 'ICG submission · eligibility criteria met', color: '#7b61ff', icon: '📋' },
  { step: '02', label: 'ICG Review & Approval', detail: 'Risk assessment · stockpile availability check', color: '#00d4ff', icon: '⚖️' },
  { step: '03', label: 'UNICEF Procurement', detail: 'EUBiologics production · cold chain planning', color: '#ffb800', icon: '🏭' },
  { step: '04', label: 'In-Country Delivery', detail: 'Last-mile logistics · campaign microplanning', color: '#00e5a0', icon: '🚚' },
  { step: '05', label: 'Campaign Execution', detail: 'Mass vaccination · tally sheets · coverage tracking', color: '#00e5a0', icon: '💉' },
  { step: '06', label: 'Post-Campaign Review', detail: 'Coverage survey · HITL validation → PDX update', color: '#00d4ff', icon: '📊' },
]

function CampaignTable() {
  const { theme } = useTheme()
  const isLight = theme === 'light'

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-y-1">
        <thead>
          <tr>
            {['Country', 'Type', 'Status', 'Doses', 'Date', 'Risk'].map(h => (
              <th key={h} className={clsx(
                "text-left text-[9px] font-mono p-1 px-2 uppercase tracking-[0.08em] font-semibold",
                isLight ? "text-slate-400" : "text-white/30"
              )}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {OCV_CAMPAIGNS.map((c, i) => (
            <tr key={i} className={clsx(
              "transition-colors",
              isLight ? "bg-slate-50 hover:bg-slate-100" : "bg-white/[0.02] hover:bg-white/[0.04]"
            )}>
              <td className={clsx(
                "p-2 px-2 text-[11px] font-mono rounded-l-md",
                isLight ? "text-slate-700" : "text-white/75"
              )}>
                {c.country}
              </td>
              <td className="p-2 px-2 text-[10px]">
                <span className={clsx(
                  "p-0.5 px-1.5 rounded text-[9px] font-mono",
                  c.type === 'Reactive' 
                    ? (isLight ? "bg-rose-100 text-rose-600" : "bg-rgba(255,107,107,0.12) text-[#ff6b6b]") 
                    : (isLight ? "bg-indigo-100 text-indigo-600" : "bg-rgba(123,97,255,0.12) text-[#7b61ff]")
                )}>
                  {c.type}
                </span>
              </td>
              <td className="p-2 px-2">
                <span className={clsx("text-[9px] p-0.5 px-1.5 rounded font-mono", isLight ? "bg-slate-100 text-slate-600" : "bg-white/5 text-white/60")} style={{ color: STATUS_COLORS[c.status], backgroundColor: isLight ? undefined : `${STATUS_COLORS[c.status]}18` }}>
                  {c.status}
                </span>
              </td>
              <td className={clsx(
                "p-2 px-2 text-[11px] font-bold font-mono",
                isLight ? "text-blue-700" : "text-[#00d4ff]"
              )}>
                {c.doses}
              </td>
              <td className={clsx(
                "p-2 px-2 text-[10px] font-mono",
                isLight ? "text-slate-400" : "text-white/38"
              )}>
                {c.date}
              </td>
              <td className="p-2 px-2 rounded-r-md">
                <span className={clsx(
                  "text-[9px] p-0.5 px-1.5 rounded font-mono",
                  c.risk === 'High' 
                    ? (isLight ? "bg-rose-100 text-rose-600" : "bg-rgba(255,71,87,0.14) text-[#ff4757]") 
                    : (isLight ? "bg-amber-100 text-amber-600" : "bg-rgba(255,184,0,0.12) text-[#ffb800]")
                )}>
                  {c.risk}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function PipelineFlow() {
  const { theme } = useTheme()
  const isLight = theme === 'light'

  return (
    <div>
      {PIPELINE_STEPS.map((s, i) => (
        <div key={i} className="flex gap-3 mb-3 items-start">
          <div className={clsx(
            "w-7 h-7 rounded-full flex items-center justify-center text-[8px] font-mono font-bold shrink-0 border transition-all duration-300",
            isLight ? "bg-white shadow-sm border-slate-100" : "bg-white/5 border-white/5"
          )} style={{ color: isLight ? (s.color === '#00d4ff' ? '#0284c7' : s.color) : s.color, borderColor: isLight ? undefined : `${s.color}33` }}>
            {s.step}
          </div>
          <div>
            <div className={clsx(
              "text-[11px] font-mono font-semibold mb-0.5",
              isLight ? "text-slate-700" : "text-white/80"
            )}>
              {s.icon} {s.label}
            </div>
            <div className={clsx(
              "text-[10px] font-mono",
              isLight ? "text-slate-400" : "text-white/32"
            )}>
              {s.detail}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function StockpilePanel() {
  const { theme } = useTheme()
  const isLight = theme === 'light'

  return (
    <div className={clsx(
      "mt-4 p-3 rounded-lg border transition-all duration-300",
      isLight ? "bg-blue-50/50 border-blue-100 shadow-sm" : "bg-[rgba(0,212,255,0.04)] border-[rgba(0,212,255,0.1)]"
    )}>
      <div className={clsx(
        "text-[9px] font-mono mb-2 uppercase tracking-[0.08em] font-bold",
        isLight ? "text-blue-600" : "text-white/32"
      )}>
        Global OCV Stockpile Status · 2026
      </div>
      <div className="flex gap-4 mb-2">
        {[
          { value: '~70M', label: 'supply p.a.', color: isLight ? '#0284c7' : '#00d4ff' },
          { value: '1-dose', label: 'ICG strategy', color: '#059669' },
          { value: '18', label: 'AFRO active', color: isLight ? '#b45309' : '#ffb800' },
        ].map((s, i) => (
          <div key={i}>
            <div className="text-lg font-extrabold font-grotesk tracking-tight leading-tight" style={{ color: s.color }}>{s.value}</div>
            <div className={clsx("text-[9px] font-mono", isLight ? "text-slate-400" : "text-white/32")}>{s.label}</div>
          </div>
        ))}
      </div>
      <div className={clsx("text-[10px] font-mono leading-relaxed", isLight ? "text-slate-500" : "text-white/42")}>
        ⚡ Preventive campaigns resumed Feb 2026 after global OCV supply
        doubled from 35M to 70M doses/year. EUBiologics sole manufacturer.
        One-dose strategy remains standard for response.
      </div>
    </div>
  )
}

interface OCVCountry {
  code: string
  country: string
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

interface CampaignTrackerProps {
  countries: OCVCountry[]
}

export default function CampaignTracker({ countries }: CampaignTrackerProps) {
  const { theme } = useTheme()
  const isLight = theme === 'light'

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Left: table + stockpile */}
      <div className={clsx(
        "rounded-xl p-4 border transition-all duration-300",
        isLight ? "bg-white border-slate-200 shadow-sm" : "bg-white/[0.02] border-white/[0.06]"
      )}>
        <div className={clsx(
          "text-xs font-semibold font-mono mb-1",
          isLight ? "text-slate-700" : "text-white/70"
        )}>
          OCV Campaign Tracker · AFRO 2025–2026
        </div>
        <div className={clsx(
          "text-[10px] font-mono mb-3.5",
          isLight ? "text-slate-400" : "text-white/28"
        )}>
          Reactive &amp; preventive OCV campaigns · ICG stockpile requests · Source: WHO AFRO / GTFCC
        </div>
        <CampaignTable />
        <StockpilePanel />
      </div>

      {/* Right: pipeline + country snapshots */}
      <div className="flex flex-col gap-4">
        <div className={clsx(
          "rounded-xl p-4 border transition-all duration-300",
          isLight ? "bg-white border-slate-200 shadow-sm" : "bg-white/[0.02] border-white/[0.06]"
        )}>
          <div className={clsx(
            "text-xs font-semibold font-mono mb-3.5",
            isLight ? "text-slate-700" : "text-white/70"
          )}>
            OCV Request → Delivery Pipeline
          </div>
          <PipelineFlow />
        </div>

        <div className={clsx(
          "rounded-xl p-4 border transition-all duration-300",
          isLight ? "bg-white border-slate-200 shadow-sm" : "bg-white/[0.02] border-white/[0.06]"
        )}>
          <div className={clsx(
            "text-xs font-semibold font-mono mb-3",
            isLight ? "text-slate-700" : "text-white/70"
          )}>
            Campaign Country Snapshots
          </div>
          {OCV_CAMPAIGNS.slice(0, 5).map(camp => {
            const c = countries.find(x => x.code === camp.code)
            if (!c) return null
            return (
              <div key={camp.code} className={clsx(
                "flex items-center gap-3 py-2 border-b last:border-0",
                isLight ? "border-slate-100" : "border-white/[0.04]"
              )}>
                <div className="flex-1">
                  <div className={clsx("text-[11px] font-mono", isLight ? "text-slate-700" : "text-white/[0.72]")}>{camp.country}</div>
                  <div className={clsx("text-[9px] font-mono", isLight ? "text-slate-400" : "text-white/28")}>{camp.doses} doses · {camp.date}</div>
                </div>
                {([['MCV1', c.MCV1] as const, ['DTP3', c.DTP3] as const]).map(([ag, val]) => (
                  <div key={ag} className="text-center min-w-[36px]">
                    <div className={clsx("text-[9px] font-mono", isLight ? "text-slate-400" : "text-white/28")}>{ag}</div>
                    <div className="text-[13px] font-bold font-grotesk tracking-tight" style={{ color: coverageColor(val) }}>{fmt(val, 0)}</div>
                  </div>
                ))}
                <span className={clsx("text-[9px] p-0.5 px-1.5 rounded font-mono", isLight ? "bg-slate-100 text-slate-600" : "bg-white/5 text-white/60")} style={{ color: STATUS_COLORS[camp.status], backgroundColor: isLight ? undefined : `${STATUS_COLORS[camp.status]}18` }}>
                  {camp.status}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
