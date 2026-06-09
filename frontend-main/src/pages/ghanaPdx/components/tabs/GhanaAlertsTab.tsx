/**
 * GhanaAlertsTab — Sentinel alerts filtered for Ghana
 */
import { useState } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { useGhanaAlerts } from '../../hooks/useGhanaData';
import { Loader2, Bell, ExternalLink } from 'lucide-react';

export default function GhanaAlertsTab() {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const [priorityFilter, setPriorityFilter] = useState<string | undefined>(undefined);
  const { data, isLoading } = useGhanaAlerts(priorityFilter ? { priority: priorityFilter } : undefined);
  const alerts = data ?? [];

  const priorities = ['P1', 'P2', 'P3', 'P4'];
  const priorityCounts = priorities.reduce((acc, p) => {
    acc[p] = alerts.filter((a: any) => a.priority === p).length;
    return acc;
  }, {} as Record<string, number>);

  const filtered = priorityFilter ? alerts.filter((a: any) => a.priority === priorityFilter) : alerts;

  return (
    <div className="space-y-5">
      {/* Priority summary + filter */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setPriorityFilter(undefined)}
          className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all ${
            !priorityFilter
              ? isLight ? 'bg-[#006B3F] text-white' : 'bg-[#FFD700] text-gray-900'
              : isLight ? 'bg-gray-100 text-gray-600' : 'bg-white/5 text-gray-400'
          }`}
        >
          All ({alerts.length})
        </button>
        {priorities.map(p => (
          <button
            key={p}
            onClick={() => setPriorityFilter(priorityFilter === p ? undefined : p)}
            className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all ${
              priorityFilter === p
                ? p === 'P1' ? 'bg-red-500 text-white'
                : p === 'P2' ? 'bg-orange-500 text-white'
                : p === 'P3' ? 'bg-yellow-500 text-gray-900'
                : 'bg-green-500 text-white'
                : isLight ? 'bg-gray-100 text-gray-600' : 'bg-white/5 text-gray-400'
            }`}
          >
            {p} ({priorityCounts[p]})
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-[300px]">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      ) : filtered.length === 0 ? (
        <div className={`text-center py-16 ${isLight ? 'text-gray-500' : 'text-gray-400'}`}>
          <Bell size={40} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">No alerts matching current filter</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-[600px] overflow-y-auto">
          {filtered.map((alert: any, idx: number) => (
            <div
              key={alert.id ?? idx}
              className={`rounded-xl border p-4 transition-all hover:shadow-md ${
                isLight ? 'bg-white border-gray-100 hover:border-gray-200' : 'bg-white/[0.02] border-white/5 hover:border-white/10'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${
                      alert.priority === 'P1' ? 'bg-red-500' :
                      alert.priority === 'P2' ? 'bg-orange-500' :
                      alert.priority === 'P3' ? 'bg-yellow-500' : 'bg-green-500'
                    }`} />
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      alert.priority === 'P1' ? 'bg-red-500/10 text-red-400' :
                      alert.priority === 'P2' ? 'bg-orange-500/10 text-orange-400' :
                      alert.priority === 'P3' ? 'bg-yellow-500/10 text-yellow-500' :
                      'bg-green-500/10 text-green-400'
                    }`}>
                      {alert.priority}
                    </span>
                    {alert.disease_name && (
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${isLight ? 'bg-blue-50 text-blue-600' : 'bg-blue-500/10 text-blue-400'}`}>
                        {alert.disease_name}
                      </span>
                    )}
                  </div>
                  <p className={`text-sm font-medium ${isLight ? 'text-gray-800' : 'text-gray-200'}`}>
                    {alert.headline || alert.summary?.slice(0, 120) || 'Untitled'}
                  </p>
                  {alert.summary && alert.headline && alert.summary !== alert.headline && (
                    <p className={`text-xs mt-1 line-clamp-2 ${isLight ? 'text-gray-500' : 'text-gray-400'}`}>
                      {alert.summary.slice(0, 200)}
                    </p>
                  )}
                  <div className={`flex items-center gap-3 mt-2 text-xs ${isLight ? 'text-gray-400' : 'text-gray-500'}`}>
                    <span>{alert.human_readable_time || 'Recently'}</span>
                    {alert.source_name && <span>· {alert.source_name}</span>}
                    {alert.location?.country && <span>· {alert.location.country}</span>}
                  </div>
                </div>
                {alert.source_url && (
                  <a
                    href={alert.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`shrink-0 p-2 rounded-lg transition-colors ${
                      isLight ? 'hover:bg-gray-100 text-gray-400' : 'hover:bg-white/5 text-gray-500'
                    }`}
                  >
                    <ExternalLink size={14} />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
