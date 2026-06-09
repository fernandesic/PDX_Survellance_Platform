/**
 * GhanaIHMREFTab — IHMREF incidents for Ghana
 */
import { useTheme } from '@/contexts/ThemeContext';
import { useGhanaIHMREF, useGhanaIHMREFSummary } from '../../hooks/useGhanaData';
import { CATEGORY_LABELS } from '@/pages/ihmref/types/ihmref';
import { Loader2, FileText, Calendar } from 'lucide-react';

export default function GhanaIHMREFTab() {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const { data: incidents, isLoading } = useGhanaIHMREF();
  const { data: summary } = useGhanaIHMREFSummary();

  const incidentList = (incidents ?? []) as any[];
  const summaryData = (summary ?? []) as any[];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Summary cards
       *  IhmrefDataSummary.category is a flat string (IhmrefCategory key),
       *  not a nested object. Look up the human label via CATEGORY_LABELS.
       */}
      {summaryData.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {summaryData.slice(0, 8).map((s: any, idx: number) => {
            const label =
              CATEGORY_LABELS[s.category] || s.category || `Category ${idx + 1}`;
            const contributionPct =
              typeof s.contribution === 'number'
                ? `${s.contribution.toFixed(1)}%`
                : s.contribution || '—';
            return (
              <div
                key={idx}
                className={`rounded-xl border p-4 ${isLight ? 'bg-white border-gray-100' : 'bg-white/[0.02] border-white/5'}`}
              >
                <p className={`text-[10px] uppercase tracking-wider mb-1 truncate ${isLight ? 'text-gray-500' : 'text-gray-400'}`}>
                  {label}
                </p>
                <div className="flex items-baseline gap-2">
                  <p className={`text-lg font-bold ${isLight ? 'text-gray-900' : 'text-white'}`}>{s.afro ?? '—'}</p>
                  <span className={`text-xs ${isLight ? 'text-gray-400' : 'text-gray-500'}`}>AFRO</span>
                </div>
                {s.global_t != null && (
                  <p className={`text-xs mt-0.5 ${isLight ? 'text-gray-400' : 'text-gray-500'}`}>
                    Global: {s.global_t} · {contributionPct}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Incidents */}
      {incidentList.length === 0 ? (
        <div className={`text-center py-16 ${isLight ? 'text-gray-500' : 'text-gray-400'}`}>
          <FileText size={40} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">No IHMREF incidents found for Ghana</p>
        </div>
      ) : (
        <div className={`rounded-xl border overflow-hidden ${isLight ? 'bg-white border-gray-100' : 'bg-white/[0.02] border-white/5'}`}>
          <div className="p-4 border-b border-inherit">
            <h3 className={`text-sm font-semibold ${isLight ? 'text-gray-800' : 'text-white'}`}>
              Ghana IHMREF Incidents ({incidentList.length})
            </h3>
          </div>
          <div className="divide-y divide-inherit max-h-[500px] overflow-y-auto">
            {incidentList.map((incident: any, idx: number) => {
              // IhmrefCountryIncident shape: { incident, start_date, end_date, ihmref_data: { category } }
              const title = incident.incident || `Incident ${idx + 1}`;
              const categoryKey = incident.ihmref_data?.category;
              const categoryLabel = categoryKey
                ? CATEGORY_LABELS[categoryKey] || categoryKey
                : null;
              const today = new Date().toISOString().slice(0, 10);
              const derivedStatus =
                incident.end_date && incident.end_date < today ? 'Closed' : 'Ongoing';
              return (
                <div
                  key={incident.id ?? idx}
                  className={`px-4 py-3 transition-colors ${isLight ? 'hover:bg-gray-50' : 'hover:bg-white/[0.03]'}`}
                >
                  <div className="flex items-start gap-3">
                    <Calendar size={14} className={`mt-0.5 shrink-0 ${isLight ? 'text-gray-400' : 'text-gray-500'}`} />
                    <div>
                      <p className={`text-sm font-medium ${isLight ? 'text-gray-800' : 'text-gray-200'}`}>
                        {title}
                      </p>
                      <div className={`flex flex-wrap items-center gap-2 mt-1 text-xs ${isLight ? 'text-gray-400' : 'text-gray-500'}`}>
                        {categoryLabel && <span>{categoryLabel}</span>}
                        {incident.start_date && <span>· {incident.start_date}</span>}
                        <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                          derivedStatus === 'Ongoing'
                            ? 'bg-amber-500/10 text-amber-400'
                            : 'bg-green-500/10 text-green-400'
                        }`}>
                          {derivedStatus}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
