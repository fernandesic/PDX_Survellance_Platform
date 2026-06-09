import type { ComponentType, ReactNode } from 'react';
import {
  X,
  MapPin,
  Calendar,
  BarChart3,
  Users,
  Tag,
  Building,
} from 'lucide-react';
import type { Incident } from '../types';

interface IncidentModalProps {
  incident: Incident | null;
  onClose: () => void;
}

export function IncidentModal({ incident, onClose }: IncidentModalProps) {
  if (!incident) return null;

  const data = incident.ihmref_data;
  const country = incident.country;
  const contribution = data?.contribution ? parseFloat(data.contribution) : 0;

  const startDate = incident.start_date ? new Date(incident.start_date) : null;
  const endDate = incident.end_date ? new Date(incident.end_date) : null;
  // Inclusive day count: a single-day incident reads as "1 day", not "0 days".
  const durationDays =
    startDate && endDate
      ? Math.max(
          1,
          Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1,
        )
      : null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      data-testid="incident-modal"
      onClick={onClose}
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/80 p-4 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between border-b border-slate-100 bg-slate-50/50 p-6">
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-amber-500 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-white shadow-lg shadow-amber-500/20">
                IHR Incident
              </span>
              {data?.category ? (
                <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-[9px] font-black uppercase text-indigo-700">
                  {data.category.replace(/_/g, ' ')}
                </span>
              ) : null}
              {data?.year ? (
                <span className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-[9px] font-black text-slate-600">
                  {data.year}
                </span>
              ) : null}
            </div>
            <h2 className="mb-1 text-xl font-black leading-tight text-slate-900">
              {incident.incident || 'General Incident'}
            </h2>
            <div className="flex flex-wrap items-center gap-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" /> {country?.country || '—'}
              </span>
              {country?.state ? <span>· {country.state}</span> : null}
              <span className="flex items-center gap-1">ID: {incident.id}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="close"
            className="ml-3 rounded-full border border-slate-200 bg-white p-2 text-slate-400 shadow-sm transition-colors hover:text-slate-900"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-6">
          <Section icon={Building} title="Country Details">
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 rounded-xl border border-slate-100 bg-slate-50 p-4">
              <InfoRow label="Country" value={country?.country} />
              <InfoRow label="Full Name" value={country?.full_name || '—'} />
              <InfoRow label="State / Region" value={country?.state || '—'} />
              <InfoRow label="Country ID" value={country?.id} />
            </div>
          </Section>

          <Section icon={Calendar} title="Observation Timeline">
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
              <div className="mb-3 grid grid-cols-3 gap-3">
                <Stat label="Start Date" value={startDate ? startDate.toLocaleDateString() : '—'} />
                <Stat label="End Date" value={endDate ? endDate.toLocaleDateString() : 'Ongoing'} />
                <Stat
                  label="Duration"
                  value={durationDays ? `${durationDays} days` : '—'}
                  emphasis
                />
              </div>
            </div>
          </Section>

          <Section icon={BarChart3} title="IHR Impact Metrics">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-center">
                <span className="mb-1 block text-[9px] font-black uppercase tracking-widest text-blue-600">
                  AFRO Regional
                </span>
                <span className="text-3xl font-black text-blue-800">{data?.afro ?? '—'}</span>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center">
                <span className="mb-1 block text-[9px] font-black uppercase tracking-widest text-slate-500">
                  Global Total
                </span>
                <span className="text-3xl font-black text-slate-700">{data?.global_t ?? '—'}</span>
              </div>
            </div>
            <div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50 p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[9px] font-black uppercase tracking-widest text-emerald-700">
                  AFRO Contribution to Global
                </span>
                <span className="text-lg font-black text-emerald-700">
                  {contribution.toFixed(1)}%
                </span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-emerald-100">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600 transition-all"
                  style={{ width: `${Math.min(100, contribution)}%` }}
                />
              </div>
            </div>
          </Section>

          <Section icon={Users} title="Affected Countries">
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                  Number of African Countries
                </span>
                <span className="text-lg font-black text-slate-900">
                  {data?.no_of_african_countries ?? '—'}
                </span>
              </div>
              {data?.african_countries_involved ? (
                <div className="flex flex-wrap gap-1.5">
                  {data.african_countries_involved.split(',').map((c, i) => (
                    <span
                      key={i}
                      className="rounded border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-bold text-slate-600 shadow-sm"
                    >
                      {c.trim()}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </Section>

          <Section icon={Tag} title="Classification Metadata">
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 rounded-xl border border-slate-100 bg-slate-50 p-4">
              <InfoRow label="Incident ID" value={incident.id} />
              <InfoRow label="IHR Data ID" value={data?.id} />
              <InfoRow label="Category" value={data?.category?.replace(/_/g, ' ')} />
              <InfoRow label="Year" value={data?.year} />
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}

interface SectionProps {
  icon: ComponentType<{ className?: string }>;
  title: string;
  children: ReactNode;
}

function Section({ icon: Icon, title, children }: SectionProps) {
  return (
    <div>
      <h3 className="mb-3 flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-900">
        <Icon className="h-4 w-4 text-slate-400" /> {title}
      </h3>
      {children}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-50 py-1.5 last:border-0">
      <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</span>
      <span className="text-xs font-bold text-slate-700">{value != null ? String(value) : '—'}</span>
    </div>
  );
}

function Stat({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className="text-center">
      <span className="mb-1 block text-[9px] font-black uppercase tracking-widest text-slate-400">
        {label}
      </span>
      <span className={`text-sm font-black ${emphasis ? 'text-blue-600' : 'text-slate-900'}`}>
        {value}
      </span>
    </div>
  );
}
