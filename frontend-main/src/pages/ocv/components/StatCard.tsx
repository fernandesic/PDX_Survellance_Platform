import { useTheme } from '@/contexts/ThemeContext'
import { useThemeColors } from '@/contexts/useThemeColors'
import clsx from 'clsx'

interface StatCardProps {
  label: string
  value: string | number
  sub?: string
  color?: string
  icon?: string
  alert?: boolean
}

export default function StatCard({ label, value, sub, color = '#00d4ff', icon, alert = false }: StatCardProps) {
  const { theme } = useTheme()
  const colors = useThemeColors()
  const isLight = theme === 'light'

  return (
    <div
      className={clsx(
        "rounded-xl py-4 px-5 relative overflow-hidden border transition-all duration-300",
        isLight 
          ? "bg-white border-blue-100/50 shadow-[0_4px_12px_rgba(0,0,0,0.03)]" 
          : "bg-gradient-to-br from-white/[0.04] to-white/[0.01] border-white/[0.08]"
      )}
    >
      {alert && (
        <div className={clsx(
          "absolute top-0 right-0 py-0.5 px-2 text-[9px] font-mono rounded-bl-md tracking-[0.06em]",
          isLight ? "bg-red-50 text-red-600 border-l border-b border-red-100" : "bg-[rgba(255,71,87,0.15)] text-[#ff4757]"
        )}>
          ⚠ ALERT
        </div>
      )}

      <div className={clsx("text-[10px] mb-1.5 font-mono tracking-[0.08em] uppercase", isLight ? "text-slate-500" : "text-white/[0.38]")}>
        {icon && <span className="mr-1.5">{icon}</span>}
        {label}
      </div>

      <div
        className="text-[28px] font-extrabold font-grotesk tracking-tight leading-none"
        style={{ color: isLight ? (color === '#00d4ff' ? '#0093D5' : color) : color }}
      >
        {value}
      </div>

      {sub && (
        <div className={clsx("text-[11px] mt-1 font-mono transition-colors", isLight ? "text-slate-400" : "text-white/35")}>
          {sub}
        </div>
      )}
    </div>
  )
}
