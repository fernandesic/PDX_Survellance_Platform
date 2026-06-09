// @ts-nocheck
import React from 'react';
import type { Incident } from '../types';
import { X, MapPin, Calendar, BarChart3, Users, Tag, Building } from 'lucide-react';

interface IncidentModalProps {
    incident: Incident | null;
    onClose: () => void;
}

export const IncidentModal: React.FC<IncidentModalProps> = ({ incident, onClose }) => {
    if (!incident) return null;

    const data = incident.ihmref_data;
    const country = incident.country;
    const contribution = data?.contribution ? parseFloat(data.contribution) : 0;

    // Duration computation
    const startDate = incident.start_date ? new Date(incident.start_date) : null;
    const endDate = incident.end_date ? new Date(incident.end_date) : null;
    const durationDays = startDate && endDate ? Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) : null;

    const Section = ({ icon: Icon, title, children }: { icon: any, title: string, children: React.ReactNode }) => (
        <div>
            <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-widest mb-3 flex items-center gap-2">
                <Icon className="w-4 h-4 text-slate-400" /> {title}
            </h3>
            {children}
        </div>
    );

    const InfoRow = ({ label, value }: { label: string, value: any }) => (
        <div className="flex justify-between items-center py-1.5 border-b border-slate-50 last:border-0">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{label}</span>
            <span className="text-xs font-bold text-slate-700">{value ?? '—'}</span>
        </div>
    );

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-fade-in" onClick={onClose}>
            <div
                className="bg-white rounded-[1.5rem] w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] border border-slate-200"
                onClick={e => e.stopPropagation()}
            >
                {/* ── HEADER ── */}
                <div className="p-6 border-b border-slate-100 flex justify-between items-start bg-slate-50/50">
                    <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                            <span className="bg-amber-500 text-white text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-widest shadow-lg shadow-amber-500/20">
                                IHR Incident
                            </span>
                            {data?.category && (
                                <span className="text-[9px] font-black px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 uppercase">
                                    {data.category.replace(/_/g, ' ')}
                                </span>
                            )}
                            {data?.year && (
                                <span className="text-[9px] font-black px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                                    {data.year}
                                </span>
                            )}
                        </div>
                        <h2 className="text-xl font-black text-slate-900 leading-tight mb-1">
                            {incident.incident || 'General Incident'}
                        </h2>
                        <div className="flex flex-wrap items-center text-slate-400 text-[10px] font-bold uppercase tracking-wider gap-3">
                            <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {country?.country || '—'}</span>
                            {country?.state && <span>· {country.state}</span>}
                            <span className="flex items-center gap-1">ID: {incident.id}</span>
                        </div>
                    </div>
                    <button onClick={onClose} className="bg-white p-2 rounded-full shadow-sm border border-slate-200 text-slate-400 hover:text-slate-900 transition-colors ml-3">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* ── SCROLLABLE BODY ── */}
                <div className="p-6 overflow-y-auto custom-scrollbar space-y-6 flex-1 min-h-0">

                    {/* 1. COUNTRY DETAILS */}
                    <Section icon={Building} title="Country Details">
                        <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 grid grid-cols-2 gap-x-6 gap-y-1">
                            <InfoRow label="Country" value={country?.country} />
                            <InfoRow label="Full Name" value={country?.full_name || '—'} />
                            <InfoRow label="State / Region" value={country?.state || '—'} />
                            <InfoRow label="Country ID" value={country?.id} />
                        </div>
                    </Section>

                    {/* 2. TIMELINE */}
                    <Section icon={Calendar} title="Observation Timeline">
                        <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                            <div className="grid grid-cols-3 gap-3 mb-3">
                                <div className="text-center">
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Start Date</span>
                                    <span className="text-sm font-black text-slate-900">{startDate ? startDate.toLocaleDateString() : '—'}</span>
                                </div>
                                <div className="text-center">
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">End Date</span>
                                    <span className="text-sm font-black text-slate-900">{endDate ? endDate.toLocaleDateString() : 'Ongoing'}</span>
                                </div>
                                <div className="text-center">
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Duration</span>
                                    <span className="text-sm font-black text-blue-600">{durationDays ? `${durationDays} days` : '—'}</span>
                                </div>
                            </div>
                            {startDate && (
                                <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-gradient-to-r from-amber-400 to-amber-600 rounded-full"
                                        style={{ width: endDate ? '100%' : '60%' }}
                                    />
                                </div>
                            )}
                        </div>
                    </Section>

                    {/* 3. IHR IMPACT METRICS */}
                    <Section icon={BarChart3} title="IHR Impact Metrics">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="p-4 rounded-xl bg-blue-50 border border-blue-100 text-center">
                                <span className="text-[9px] font-black text-blue-600 uppercase tracking-widest block mb-1">AFRO Regional</span>
                                <span className="text-3xl font-black text-blue-800">{data?.afro ?? '—'}</span>
                            </div>
                            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center">
                                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1">Global Total</span>
                                <span className="text-3xl font-black text-slate-700">{data?.global_t ?? '—'}</span>
                            </div>
                        </div>

                        {/* Contribution Bar */}
                        <div className="mt-3 p-4 rounded-xl bg-emerald-50 border border-emerald-100">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[9px] font-black text-emerald-700 uppercase tracking-widest">AFRO Contribution to Global</span>
                                <span className="text-lg font-black text-emerald-700">{contribution.toFixed(1)}%</span>
                            </div>
                            <div className="h-3 bg-emerald-100 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full transition-all"
                                    style={{ width: `${Math.min(100, contribution)}%` }}
                                />
                            </div>
                        </div>
                    </Section>

                    {/* 4. AFFECTED COUNTRIES */}
                    <Section icon={Users} title="Affected Countries">
                        <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Number of African Countries</span>
                                <span className="text-lg font-black text-slate-900">{data?.no_of_african_countries ?? '—'}</span>
                            </div>
                            {data?.african_countries_involved && (
                                <div className="flex flex-wrap gap-1.5">
                                    {data.african_countries_involved.split(',').map((c: string, i: number) => (
                                        <span key={i} className="text-[10px] font-bold px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-600 shadow-sm">
                                            {c.trim()}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    </Section>

                    {/* 5. METADATA */}
                    <Section icon={Tag} title="Classification Metadata">
                        <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 grid grid-cols-2 gap-x-6 gap-y-1">
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
};
