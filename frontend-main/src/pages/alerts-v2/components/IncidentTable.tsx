import { useMemo, useState } from 'react';
import { ChevronRight, Search } from 'lucide-react';
import type { Incident } from '../types';
import { filterIncidents, toIncidentRow } from './incidentTableUtils';

interface IncidentTableProps {
  incidents: Incident[];
  onIncidentClick: (incident: Incident) => void;
}

export function IncidentTable({ incidents, onIncidentClick }: IncidentTableProps) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => filterIncidents(incidents, search), [incidents, search]);
  const rows = useMemo(() => filtered.map(toIncidentRow), [filtered]);

  return (
    <div
      className="flex h-full flex-col overflow-hidden rounded-2xl border border-white/5 bg-[#0B1120]"
      data-testid="incident-table"
    >
      <div className="border-b border-white/5 p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search incidents…"
            aria-label="search incidents"
            className="w-full rounded-lg border border-white/10 bg-[#0E1628] py-2 pl-9 pr-3 text-sm text-white placeholder:text-slate-500 focus:border-sky-500 focus:outline-none"
          />
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {rows.length === 0 ? (
          <div
            className="flex h-full min-h-[200px] items-center justify-center p-8 text-center text-sm text-slate-400"
            data-testid="incident-table-empty"
          >
            {incidents.length === 0 ? 'No incidents' : 'No incidents match your search'}
          </div>
        ) : (
          <table className="w-full text-left">
            <thead className="sticky top-0 z-10 bg-[#0B1120]/95 backdrop-blur">
              <tr className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-500">
                <th className="px-3 py-2">Incident</th>
                <th className="px-3 py-2">Country</th>
                <th className="px-3 py-2">Category</th>
                <th className="px-3 py-2">Year</th>
                <th className="px-3 py-2">AFRO / Global</th>
                <th className="px-3 py-2">Duration</th>
                <th className="px-2 py-2" aria-hidden="true"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filtered.map((incident) => {
                const row = toIncidentRow(incident);
                return (
                  <tr
                    key={row.id}
                    tabIndex={0}
                    role="button"
                    aria-label={`Open incident ${row.incidentName}`}
                    onClick={() => onIncidentClick(incident)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onIncidentClick(incident);
                      }
                    }}
                    data-testid="incident-row"
                    data-incident-id={row.id}
                    className="group cursor-pointer transition-colors hover:bg-white/[0.03] focus:outline-none focus:ring-2 focus:ring-sky-500/40"
                  >
                    <td className="max-w-[220px] px-3 py-2.5">
                      <span className="block truncate text-sm font-bold text-white transition-colors group-hover:text-amber-400">
                        {row.incidentName}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="block text-xs font-bold text-slate-300">
                        {row.countryName}
                      </span>
                      {row.state ? (
                        <span className="block text-[10px] text-slate-500">{row.state}</span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="rounded border border-indigo-500/30 bg-indigo-500/10 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-indigo-300">
                        {row.category}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-xs font-bold text-slate-300">{row.year}</td>
                    <td className="px-3 py-2.5 text-xs">
                      <span className="font-black text-sky-400">{row.afro}</span>
                      <span className="text-slate-500"> / {row.global}</span>
                    </td>
                    <td className="px-3 py-2.5 text-[10px] font-medium text-slate-400">
                      {row.durationLabel}
                    </td>
                    <td className="px-2 py-2.5 text-right">
                      <ChevronRight className="h-3.5 w-3.5 text-slate-600 transition-colors group-hover:text-amber-400" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
