import { getPDXAlerts } from '../services/ocv'
import { useTheme } from '@/contexts/ThemeContext'
import clsx from 'clsx'

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

interface PDXBridgePanelProps {
  country: OCVCountry
}

const BTN_LINKS = ['Open in TRIAD', 'Flag in Risk Sentinel', 'HSSPM Input', 'Decision WHO']

export default function PDXBridgePanel({ country }: PDXBridgePanelProps) {
  const { theme } = useTheme()
  const isLight = theme === 'light'
  
  const alerts = getPDXAlerts(country)

  return (
    <div className={clsx(
      "border rounded-[10px] p-3.5 transition-all duration-300",
      isLight ? "bg-blue-50/50 border-blue-100 shadow-sm" : "bg-[rgba(0,212,255,0.04)] border-[rgba(0,212,255,0.12)]"
    )}>
      <div className={clsx(
        "text-[10px] font-mono tracking-[0.1em] mb-2.5 uppercase font-bold",
        isLight ? "text-blue-700" : "text-[#00d4ff]"
      )}>
        ⚡ PDX Cross-Dashboard Intelligence
      </div>

      {alerts.length === 0 ? (
        <div className={clsx(
          "text-[11px] font-mono leading-normal",
          isLight ? "text-emerald-700" : "text-[rgba(0,229,160,0.7)]"
        )}>
          ✓ No active cross-dashboard flags for {country.name}
        </div>
      ) : (
        alerts.map((a, i) => (
          <div key={i} className="flex items-start gap-2 mb-2">
            <span
              className={clsx(
                "text-[9px] py-0.5 px-1.5 rounded whitespace-nowrap mt-px shrink-0 font-mono tracking-[0.04em] font-bold border",
                isLight ? "bg-white border-slate-100 shadow-sm" : "border-transparent"
              )}
              style={{ 
                backgroundColor: isLight ? undefined : `${a.color}20`, 
                color: isLight && (a.color === '#00d4ff' || a.color === '#00e5a0') ? (a.color === '#00d4ff' ? '#0369a1' : '#059669') : a.color 
              }}
            >
              → {a.type}
            </span>
            <span className={clsx(
              "text-[11px] font-mono leading-[1.45]",
              isLight ? "text-slate-600" : "text-white/[0.58]"
            )}>
              {a.msg}
            </span>
          </div>
        ))
      )}

      {/* Action buttons */}
      <div className="flex gap-1.5 mt-3 flex-wrap">
        {BTN_LINKS.map((btn, i) => (
          <button
            key={i}
            className={clsx(
              "text-[9px] py-1 px-2.5 rounded border cursor-pointer font-mono tracking-[0.05em] transition-all duration-150",
              isLight 
                ? "bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 shadow-sm" 
                : "bg-[rgba(0,212,255,0.08)] border-[rgba(0,212,255,0.2)] text-[#00d4ff] hover:bg-[rgba(0,212,255,0.18)]"
            )}
          >
            {btn}
          </button>
        ))}
      </div>
    </div>
  )
}
