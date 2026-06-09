import React from 'react'
import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Globe, BarChart2, Activity,
  FlaskConical, Shield, Newspaper, ExternalLink,
  AlertTriangle, CheckCircle, Clock, TrendingUp,
  Loader2
} from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'
import { useThemeColors } from '@/contexts/useThemeColors'
import clsx from 'clsx'

// ─────────────────────────────────────────────────────────────────
// Layout Shell
// ─────────────────────────────────────────────────────────────────
export function AppShell({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme()
  const isLight = theme === 'light'

  return (
    <div className={clsx("flex h-screen overflow-hidden", isLight ? "bg-[#f8fafc]" : "bg-[#060D1A]")}>
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// Header
// ─────────────────────────────────────────────────────────────────
function Header() {
  const { theme } = useTheme()
  const isLight = theme === 'light'

  return (
    <header className={clsx(
      "px-6 py-2.5 flex items-center justify-between z-10 transition-all duration-300 border-b",
      isLight 
        ? "bg-white border-slate-200 text-slate-800 shadow-sm" 
        : "bg-[#060D1A]/80 backdrop-blur-md border-white/5 text-white"
    )}>
      <div className="flex items-center gap-3">
        <div className={clsx(
          "w-7 h-7 rounded-full flex items-center justify-center border transition-all",
          isLight ? "bg-blue-50 border-blue-100" : "bg-white/10 border-white/20"
        )}>
          <span className={clsx("font-black text-[10px]", isLight ? "text-blue-600" : "text-white")}>PIP</span>
        </div>
        <div>
          <h1 className="text-sm font-bold tracking-tight">PIP Intelligence</h1>
          <p className={clsx("text-[10px] leading-none mt-0.5 font-medium font-mono", isLight ? "text-slate-400" : "opacity-60")}>LANDSCAPE MONITOR</p>
        </div>
      </div>
      <div className={clsx("flex items-center gap-4 text-[10px] font-mono tracking-wider", isLight ? "text-slate-500" : "opacity-60")}>
        <span className="hidden sm:inline">AFRO REGION · 47 STATES</span>
        <span className={clsx(
          "px-2 py-0.5 rounded border uppercase", 
          isLight ? "bg-slate-50 border-slate-200" : "bg-white/5 border-white/10"
        )}>2024 Survey</span>
      </div>
    </header>
  )
}

// ─────────────────────────────────────────────────────────────────
// Sidebar
// ─────────────────────────────────────────────────────────────────
const navItems = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/pip-indicators', label: 'PIP Indicators', icon: TrendingUp },
  { to: '/surveillance', label: 'Surveillance', icon: Activity },
  { to: '/countries', label: 'Countries', icon: Globe },
  { to: '/virological', label: 'Virological', icon: FlaskConical },
  { to: '/preparedness', label: 'Preparedness', icon: Shield },
  { to: '/heatmap', label: 'Heatmap Analysis', icon: BarChart2 },
  { to: '/bulletin', label: 'Epi Bulletin', icon: Newspaper },
]

function Sidebar() {
  const { theme } = useTheme()
  const isLight = theme === 'light'

  return (
    <aside className={clsx(
      "w-52 h-full flex flex-col transition-all duration-300 border-r", 
      isLight ? "bg-[#f7f7f7] border-slate-200 text-slate-700" : "bg-[#060D1A] border-white/5 text-white"
    )}>
      <div className={clsx("p-4 border-b", isLight ? "border-slate-200" : "border-white/5")}>
        <p className={clsx("text-[9px] uppercase tracking-[0.2em] font-bold font-mono", isLight ? "text-slate-400" : "text-white/30")}>NAVIGATOR</p>
      </div>
      <nav className="flex-1 overflow-y-auto py-2">
        {navItems.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }: { isActive: boolean }) =>
              clsx(
                'flex items-center gap-3 px-4 py-2.5 text-[13px] transition-all duration-150 border-l-2',
                isActive
                  ? (isLight 
                      ? 'bg-blue-500/10 border-blue-600 text-blue-700 font-semibold' 
                      : 'bg-blue-500/10 border-blue-400 text-white font-semibold')
                  : (isLight
                      ? 'border-transparent text-slate-500 hover:bg-slate-200/50 hover:text-slate-900'
                      : 'border-transparent text-white/40 hover:bg-white/5 hover:text-white')
              )
            }
          >
            <Icon size={14} />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className={clsx("p-4 border-t text-[9px] font-mono tracking-tight uppercase", isLight ? "border-slate-200 text-slate-400" : "border-white/5 text-white/20")}>
        <p>Institutional Watermark</p>
        <p className="mt-1">WHO AFRO © {new Date().getFullYear()}</p>
      </div>
    </aside>
  )
}

// ─────────────────────────────────────────────────────────────────
// KPI Card
// ─────────────────────────────────────────────────────────────────
interface KPICardProps {
  title: string
  value: string | number
  subtitle?: string
  icon?: React.ReactNode
  color?: string
  trend?: string
}
export function KPICard({ title, value, subtitle, icon, color = '#2DD4BF', trend }: KPICardProps) {
  const { theme } = useTheme()
  const colors = useThemeColors()
  const isLight = theme === 'light'

  const effectiveColor = isLight ? (color === '#2DD4BF' ? '#0d9488' : color) : color

  return (
    <Card className="flex flex-col gap-1.5 group transition-all hover:translate-y-[-2px]">
      <div className="flex items-center justify-between">
        <p className={clsx("text-[9px] font-bold uppercase tracking-[0.1em] leading-tight font-mono", colors.text.muted)}>{title}</p>
        {icon && (
          <div className="p-1.5 rounded-md transition-colors" style={{ backgroundColor: `${effectiveColor}12` }}>
            <span style={{ color: effectiveColor }}>{React.cloneElement(icon as React.ReactElement, { size: 14 } as any)}</span>
          </div>
        )}
      </div>
      <div>
        <p className="text-2xl font-black tracking-tight transition-colors font-grotesk" style={{ color: effectiveColor }}>{value}</p>
        {subtitle && <p className={clsx("text-[10px] mt-0.5 font-medium opacity-60", colors.text.secondary)}>{subtitle}</p>}
        {trend && <p className={clsx("text-[10px] font-bold mt-1 flex items-center gap-1 font-mono", isLight ? "text-emerald-600" : "text-teal-400")}>↑ {trend}</p>}
      </div>
    </Card>
  )
}

// ─────────────────────────────────────────────────────────────────
// Section heading
// ─────────────────────────────────────────────────────────────────
export function SectionTitle({ children, subtitle }: { children: React.ReactNode; subtitle?: string }) {
  const colors = useThemeColors()
  
  return (
    <div className="mb-4">
      <h2 className={clsx("text-lg font-bold", colors.text.primary)}>{children}</h2>
      {subtitle && <p className={clsx("text-sm mt-0.5 font-medium", colors.text.secondary)}>{subtitle}</p>}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// Loading / Error states
// ─────────────────────────────────────────────────────────────────
export function LoadingSpinner({ label = 'Loading data…' }: { label?: string }) {
  const colors = useThemeColors()
  
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16">
      <Loader2 size={32} className="animate-spin text-emerald-500" />
      <span className={clsx("text-sm font-medium", colors.text.muted)}>{label}</span>
    </div>
  )
}

export function ErrorAlert({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
      <AlertTriangle size={18} className="flex-shrink-0" />
      <span>{message}</span>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// Status badge
// ─────────────────────────────────────────────────────────────────
const STATUS_MAP: Record<string, { label: string; class: string; icon: React.ReactNode }> = {
  on_track:    { label: 'On Track',    class: 'badge-on-track',    icon: <CheckCircle size={11} /> },
  at_risk:     { label: 'At Risk',     class: 'badge-at-risk',     icon: <AlertTriangle size={11} /> },
  achieved:    { label: 'Achieved',    class: 'badge-achieved',    icon: <CheckCircle size={11} /> },
  not_started: { label: 'Not Started', class: 'badge-not-started', icon: <Clock size={11} /> },
}
export function StatusBadge({ status }: { status: string }) {
  const s = STATUS_MAP[status] ?? STATUS_MAP.not_started
  return (
    <span className={clsx('inline-flex items-center gap-1', s.class)}>
      {s.icon} {s.label}
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────
// Progress bar
// ─────────────────────────────────────────────────────────────────
export function ProgressBar({ value, max, color = '#009ADE' }: { value: number; max: number; color?: string }) {
  const pct = Math.min(100, Math.round((value / max) * 100))
  return (
    <div className="progress-bar">
      <div
        className="progress-fill"
        style={{ width: `${pct}%`, backgroundColor: color }}
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
// External link button
// ─────────────────────────────────────────────────────────────────
export function ExternalLinkButton({ href, children, variant = 'primary' }: { href: string; children: React.ReactNode; variant?: 'primary' | 'secondary' }) {
  const { theme } = useTheme()
  const isLight = theme === 'light'

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={clsx(
        "inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all shadow-sm",
        variant === 'primary' 
          ? "bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-200" 
          : isLight 
            ? "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50" 
            : "bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10"
      )}
    >
      {children}
      <ExternalLink size={14} />
    </a>
  )
}

// ─────────────────────────────────────────────────────────────────
// Yes/No response pill
// ─────────────────────────────────────────────────────────────────
export function ResponsePill({ response }: { response: string }) {
  const r = response.toLowerCase()
  const isYes = r.startsWith('yes')
  const isNo = r === 'no' || r === 'no response' || r === 'n/a'
  const { theme } = useTheme()
  const isLight = theme === 'light'

  return (
    <span
      className={clsx(
        'inline-block text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider transition-all',
        isYes ? (isLight ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/20') :
        isNo  ? (isLight ? 'bg-rose-100 text-rose-700 border border-rose-200' : 'bg-rose-500/20 text-rose-400 border border-rose-500/20') :
                (isLight ? 'bg-amber-100 text-amber-700 border border-amber-200' : 'bg-amber-500/20 text-amber-400 border border-amber-500/20')
      )}
    >
      {response}
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────
// Card wrapper
// ─────────────────────────────────────────────────────────────────
export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  const { theme } = useTheme()
  const isLight = theme === 'light'

  return (
    <div className={clsx(
      'rounded-xl p-4 border transition-all duration-300 relative overflow-hidden',
      isLight 
        ? "bg-white border-slate-200 shadow-[0_4px_12px_rgba(0,0,0,0.03)]" 
        : "bg-white/[0.03] border-white/5 backdrop-blur-sm shadow-xl",
      className
    )}>
      {!isLight && (
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-[40px] pointer-events-none" />
      )}
      {children}
    </div>
  )
}
