/**
 * GhanaHeader — Hero banner for the Ghana PDX dashboard.
 *
 * Shows Ghana identity (flag, name, ISO), a KPI ribbon, and a gradient
 * banner. Theme-aware (dark/light).  No country dropdown.
 */

import { useTheme } from '@/contexts/ThemeContext';
import { Users, Shield, Bell, TrendingUp } from 'lucide-react';

interface KPI {
  label: string;
  value: string | number;
  icon: React.ElementType;
  accent: string;    // dark mode accent
  accentLight: string; // light mode accent
}

interface GhanaHeaderProps {
  /** Overview stats to populate KPI ribbon (optional — skeleton if missing) */
  stats?: {
    population?: string;
    totalCHWs?: number;
    ihrScore?: number;
    alertCount?: number;
    readinessScore?: number;
  };
}

export default function GhanaHeader({ stats }: GhanaHeaderProps) {
  const { theme } = useTheme();
  const isLight = theme === 'light';

  const kpis: KPI[] = [
    {
      label: 'Population',
      value: stats?.population ?? '—',
      icon: TrendingUp,
      accent: 'from-emerald-500/20 to-emerald-500/5 border-emerald-500/20 text-emerald-400',
      accentLight: 'from-emerald-50 to-white border-emerald-200 text-emerald-700',
    },
    {
      label: 'CHW Workforce',
      value: stats?.totalCHWs != null ? stats.totalCHWs.toLocaleString() : '—',
      icon: Users,
      accent: 'from-sky-500/20 to-sky-500/5 border-sky-500/20 text-sky-400',
      accentLight: 'from-sky-50 to-white border-sky-200 text-sky-700',
    },
    {
      label: 'IHR Score',
      value: stats?.ihrScore != null ? `${stats.ihrScore}%` : '—',
      icon: Shield,
      accent: 'from-amber-500/20 to-amber-500/5 border-amber-500/20 text-amber-400',
      accentLight: 'from-amber-50 to-white border-amber-200 text-amber-700',
    },
    {
      label: 'Active Alerts',
      value: stats?.alertCount ?? '—',
      icon: Bell,
      accent: 'from-rose-500/20 to-rose-500/5 border-rose-500/20 text-rose-400',
      accentLight: 'from-rose-50 to-white border-rose-200 text-rose-700',
    },
  ];

  return (
    <div className="relative overflow-hidden rounded-2xl">
      {/* ── Gradient background ── */}
      <div
        className={`absolute inset-0 ${
          isLight
            ? 'bg-gradient-to-br from-[#006B3F]/8 via-white to-[#FFD700]/8'
            : 'bg-gradient-to-br from-[#006B3F]/20 via-[#0a1128] to-[#FFD700]/10'
        }`}
      />

      {/* Decorative arcs */}
      <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full bg-[#006B3F]/5 blur-3xl" />
      <div className="absolute -bottom-10 -left-10 w-40 h-40 rounded-full bg-[#FFD700]/5 blur-3xl" />

      {/* ── Content ── */}
      <div className="relative z-10 p-3 md:p-4">
        {/* Title row */}
        <div className="flex items-center gap-3 mb-3">
          {/* Flag & name */}
          <div
            className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl shadow-sm
              ${isLight
                ? 'bg-white border border-gray-100'
                : 'bg-white/10 backdrop-blur-sm border border-white/10'
              }`}
          >
            🇬🇭
          </div>
          <div>
            <h1
              className={`text-lg md:text-xl font-bold tracking-tight leading-tight ${
                isLight ? 'text-gray-900' : 'text-white'
              }`}
            >
              Ghana
              <span
                className={`ml-2 text-xs font-medium px-1.5 py-0.5 rounded-md ${
                  isLight
                    ? 'bg-[#006B3F]/10 text-[#006B3F]'
                    : 'bg-[#FFD700]/15 text-[#FFD700]'
                }`}
              >
                GHA
              </span>
            </h1>
            <p
              className={`text-[11px] mt-0.5 ${
                isLight ? 'text-gray-500' : 'text-gray-400'
              }`}
            >
              Preparedness Data Exchange · Country Dashboard
            </p>
          </div>

          {/* Status pill */}
          <div className="ml-auto hidden sm:flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>
            <span
              className={`text-xs font-medium ${
                isLight ? 'text-emerald-700' : 'text-emerald-400'
              }`}
            >
              Live
            </span>
          </div>
        </div>

        {/* ── KPI Ribbon ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {kpis.map((kpi) => {
            const Icon = kpi.icon;
            return (
              <div
                key={kpi.label}
                className={`relative overflow-hidden rounded-lg border py-2.5 px-3 bg-gradient-to-br transition-all duration-300 hover:scale-[1.02] hover:shadow-md
                  ${isLight ? kpi.accentLight : kpi.accent}`}
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${
                      isLight ? 'bg-white/80 shadow-sm' : 'bg-white/10'
                    }`}
                  >
                    <Icon size={14} />
                  </div>
                  <div>
                    <p
                      className={`text-[9px] uppercase tracking-wider font-semibold ${
                        isLight ? 'text-gray-500' : 'text-gray-400'
                      }`}
                    >
                      {kpi.label}
                    </p>
                    <p className="text-base font-bold leading-none mt-0.5">{kpi.value}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
