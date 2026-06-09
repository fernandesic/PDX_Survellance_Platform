/**
 * GhanaOverviewTab — Dashboard overview with KPI cards, ArcGIS map + recent alerts
 *
 * All metrics are composed from Ghana-only queries:
 *   CHW Workforce  → useGhanaCHWSummary (chwfolder/countries → Ghana row)
 *   IHR Score      → useGhanaIHR        (espar/summary?country=Ghana)
 *   Active Alerts  → useGhanaAlerts      (sentinel/signals?country=GHA)
 *   Readiness      → useGhanaReadinessOverall (readiness/summary per-hazard, country=Ghana)
 *
 * No global overview endpoint is used. If a Ghana-specific query returns nothing,
 * the metric shows "—" rather than silently falling back to continental numbers.
 */
import { useState, lazy, Suspense } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { useGhanaAlerts, useGhanaCHWSummary, useGhanaIHR, useGhanaReadinessOverall } from '../../hooks/useGhanaData';
import { Activity, Users, Shield, Bell, MapPin, AlertTriangle } from 'lucide-react';

// Lazy-load the ArcGIS map so the heavy SDK doesn't inflate the initial bundle
const GhanaMap = lazy(() => import('../GhanaMap'));

export default function GhanaOverviewTab() {
  const { theme } = useTheme();
  const isLight = theme === 'light';

  // ── Ghana-only data sources — no global overview fallback ──
  const alerts = useGhanaAlerts();
  const chwSummary = useGhanaCHWSummary();
  const ghanaIHR = useGhanaIHR('2024');
  const readinessOverall = useGhanaReadinessOverall();

  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);

  const ghanaAlerts = Array.isArray(alerts.data) ? alerts.data : [];
  const ghana = chwSummary.data as any;
  const ihrData = ghanaIHR.data as any;
  const readiness = readinessOverall.data as any;

  const metrics = [
    { icon: Users, label: 'CHW Workforce', value: ghana?.total_chws?.toLocaleString() ?? '—', color: 'text-sky-400', bg: 'bg-sky-500/10' },
    { icon: Shield, label: 'IHR Score', value: ihrData?.overall?.value != null ? `${Math.round(ihrData.overall.value)}%` : '—', color: 'text-amber-400', bg: 'bg-amber-500/10' },
    { icon: Bell, label: 'Active Alerts', value: ghanaAlerts.length, color: 'text-rose-400', bg: 'bg-rose-500/10' },
    { icon: Activity, label: 'Readiness', value: readiness?.overall_completion != null ? `${readiness.overall_completion}%` : '—', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { icon: MapPin, label: 'Regions', value: ghana?.total_regions ?? '—', color: 'text-violet-400', bg: 'bg-violet-500/10' },
    { icon: AlertTriangle, label: 'High Priority', value: ghanaAlerts.filter((a: any) => a.priority === 'P1' || a.priority === 'P2').length, color: 'text-orange-400', bg: 'bg-orange-500/10' },
  ];

  const handleAlertSelect = (id: string | null) => {
    setSelectedAlertId(id);
    // Scroll the matching alert card into view if it exists
    if (id) {
      const el = document.getElementById(`ghana-alert-${id}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  };

  return (
    <div className="space-y-6">
      {/* KPI grid — Compact Horizontal Layout */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 shrink-0">
        {metrics.map((m) => {
          const Icon = m.icon;
          return (
            <div
              key={m.label}
              className={`rounded-xl border p-3 flex items-center gap-3 transition-all hover:scale-[1.02] ${
                isLight
                  ? 'bg-white border-gray-100 shadow-sm hover:shadow-md'
                  : 'bg-white/[0.02] border-white/5 hover:border-white/10'
              }`}
            >
              <div className={`w-10 h-10 rounded-lg shrink-0 flex items-center justify-center ${m.bg}`}>
                <Icon size={18} className={m.color} />
              </div>
              <div className="min-w-0">
                <p className={`text-[10px] uppercase tracking-wider font-semibold truncate ${isLight ? 'text-gray-500' : 'text-gray-400'}`}>
                  {m.label}
                </p>
                <p className={`text-lg font-bold truncate ${isLight ? 'text-gray-900' : 'text-white'}`}>
                  {m.value}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Map + Alerts — side by side on desktop, filling remaining height */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 h-[calc(100vh-350px)] min-h-[400px]">
        {/* ── ArcGIS Map — takes 3/5 on desktop ── */}
        <div
          className={`lg:col-span-3 rounded-xl border overflow-hidden relative h-full ${
            isLight ? 'border-gray-100' : 'border-white/5'
          }`}
        >
          <Suspense
            fallback={
              <div
                className={`w-full h-full flex items-center justify-center ${
                  isLight ? 'bg-gray-50' : 'bg-slate-900'
                }`}
              >
                <div className="flex flex-col items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin"
                    style={{ borderColor: isLight ? '#006B3F' : '#FFD700', borderTopColor: 'transparent' }}
                  />
                  <span className={`text-xs ${isLight ? 'text-gray-500' : 'text-gray-400'}`}>
                    Loading Ghana Map…
                  </span>
                </div>
              </div>
            }
          >
            <GhanaMap
              signals={ghanaAlerts}
              selectedAlertId={selectedAlertId}
              onSelectAlert={handleAlertSelect}
              isLight={isLight}
            />
          </Suspense>
        </div>

        {/* ── Recent Alerts feed — takes 2/5 on desktop ── */}
        <div
          className={`lg:col-span-2 rounded-xl border p-5 flex flex-col h-full overflow-hidden ${
            isLight ? 'bg-white border-gray-100' : 'bg-white/[0.02] border-white/5'
          }`}
        >
          <h3 className={`text-sm font-semibold mb-4 shrink-0 ${isLight ? 'text-gray-800' : 'text-white'}`}>
            Recent Ghana Alerts
          </h3>
          {alerts.isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className={`h-16 rounded-lg animate-pulse shrink-0 ${isLight ? 'bg-gray-100' : 'bg-white/5'}`} />
              ))}
            </div>
          ) : ghanaAlerts.length === 0 ? (
            <p className={`text-sm ${isLight ? 'text-gray-400' : 'text-gray-500'}`}>
              No active alerts for Ghana
            </p>
          ) : (
            <div className="space-y-2 overflow-y-auto flex-1 pr-1 custom-scrollbar">
              {ghanaAlerts.map((alert: any, idx: number) => {
                const isSelected = String(alert.id) === selectedAlertId;
                return (
                  <div
                    key={alert.id ?? idx}
                    id={`ghana-alert-${alert.id}`}
                    onClick={() => handleAlertSelect(String(alert.id))}
                    className={`flex items-start gap-3 p-3 rounded-lg transition-all cursor-pointer shrink-0 ${
                      isSelected
                        ? isLight
                          ? 'bg-emerald-50 border border-emerald-200'
                          : 'bg-emerald-500/10 border border-emerald-500/30'
                        : isLight
                          ? 'hover:bg-gray-50 border border-transparent'
                          : 'hover:bg-white/5 border border-transparent'
                    }`}
                  >
                    <span
                      className={`mt-1 w-2 h-2 rounded-full shrink-0 ${
                        alert.priority === 'P1'
                          ? 'bg-red-500'
                          : alert.priority === 'P2'
                            ? 'bg-orange-500'
                            : alert.priority === 'P3'
                              ? 'bg-yellow-500'
                              : 'bg-green-500'
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-medium ${!isSelected ? 'truncate' : ''} ${isLight ? 'text-gray-800' : 'text-gray-200'}`}>
                        {/* Signal type uses `headline` (mapped from original_text); old `title` was always undefined. */}
                        {alert.headline || alert.title || alert.summary?.slice(0, 80) || 'Untitled alert'}
                      </p>
                      <p className={`text-xs mt-0.5 flex items-center gap-1.5 ${isLight ? 'text-gray-400' : 'text-gray-500'}`}>
                        <span>{alert.disease_name || alert.disease || 'General'}</span>
                        <span>·</span>
                        <span>{alert.human_readable_time || 'Recently'}</span>
                        {alert.source_name && (
                          <>
                            <span>·</span>
                            <span className="truncate max-w-[100px]">{alert.source_name}</span>
                          </>
                        )}
                      </p>

                      {isSelected && (
                        <div className={`mt-3 pt-3 text-xs leading-relaxed border-t ${isLight ? 'border-emerald-200 text-gray-700' : 'border-emerald-500/20 text-gray-300'}`}>
                          {alert.translated_text ? (
                            <div className="mb-2">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-500 mb-1 block">Translated</span>
                              {alert.translated_text}
                            </div>
                          ) : null}
                          <div className={alert.translated_text ? 'opacity-70' : ''}>
                            {alert.translated_text && <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1 block">Original ({alert.original_language || 'Text'})</span>}
                            {alert.summary || alert.original_text || 'No additional details available for this alert.'}
                          </div>
                          
                          {(alert.url || alert.source_url) && (
                            <a
                              href={alert.url || alert.source_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`mt-3 inline-flex items-center gap-1 font-medium ${isLight ? 'text-emerald-600 hover:text-emerald-700' : 'text-emerald-400 hover:text-emerald-300'}`}
                              onClick={(e) => e.stopPropagation()}
                            >
                              Read Full Article ↗
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${
                        alert.priority === 'P1'
                          ? 'bg-red-500/10 text-red-400'
                          : alert.priority === 'P2'
                            ? 'bg-orange-500/10 text-orange-400'
                            : 'bg-gray-500/10 text-gray-400'
                      }`}
                    >
                      {alert.priority}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Disease Distribution + Readiness-by-Hazard strip */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 shrink-0">
        {/* Alert disease distribution */}
        {ghanaAlerts.length > 0 && (() => {
          const diseaseMap: Record<string, number> = {};
          ghanaAlerts.forEach((a: any) => {
            const d = a.disease_name || a.disease || 'General';
            diseaseMap[d] = (diseaseMap[d] || 0) + 1;
          });
          const sorted = Object.entries(diseaseMap).sort(([,a],[,b]) => b - a);
          const colors = ['#06b6d4', '#8b5cf6', '#f97316', '#22c55e', '#ec4899', '#eab308', '#6366f1'];
          return (
            <div className={`rounded-xl border p-3 ${isLight ? 'bg-white border-gray-100' : 'bg-white/[0.02] border-white/5'}`}>
              <p className={`text-[10px] uppercase tracking-wider font-semibold mb-2 ${isLight ? 'text-gray-500' : 'text-gray-400'}`}>
                Alert Distribution by Disease
              </p>
              <div className="flex h-3 rounded-full overflow-hidden mb-2">
                {sorted.map(([name, count], i) => (
                  <div
                    key={name}
                    title={`${name}: ${count}`}
                    style={{ width: `${(count / ghanaAlerts.length) * 100}%`, backgroundColor: colors[i % colors.length] }}
                    className="transition-all hover:opacity-80"
                  />
                ))}
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                {sorted.slice(0, 5).map(([name, count], i) => (
                  <div key={name} className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: colors[i % colors.length] }} />
                    <span className={`text-[10px] ${isLight ? 'text-gray-600' : 'text-gray-400'}`}>{name}</span>
                    <span className={`text-[10px] font-bold ${isLight ? 'text-gray-800' : 'text-gray-200'}`}>{count}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* Readiness by hazard type */}
        {readiness?.by_category?.length > 0 && (
          <div className={`rounded-xl border p-3 ${isLight ? 'bg-white border-gray-100' : 'bg-white/[0.02] border-white/5'}`}>
            <p className={`text-[10px] uppercase tracking-wider font-semibold mb-2 ${isLight ? 'text-gray-500' : 'text-gray-400'}`}>
              Readiness by Hazard ({readiness.overall_completion}% overall)
            </p>
            <div className="space-y-1.5">
              {readiness.by_category.map((c: any) => (
                <div key={c.category} className="flex items-center gap-2 text-[11px]">
                  <span className={`w-20 truncate ${isLight ? 'text-gray-600' : 'text-gray-400'}`}>{c.category}</span>
                  <div className={`flex-1 h-2 rounded-full overflow-hidden ${isLight ? 'bg-gray-100' : 'bg-white/10'}`}>
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${c.avg}%`,
                        backgroundColor: c.avg >= 70 ? '#22c55e' : c.avg >= 40 ? '#eab308' : '#ef4444',
                      }}
                    />
                  </div>
                  <span className={`w-8 text-right font-bold ${isLight ? 'text-gray-700' : 'text-gray-300'}`}>{c.avg}%</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
