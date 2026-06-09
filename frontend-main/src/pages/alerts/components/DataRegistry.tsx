// @ts-nocheck
import React, { useState, useMemo } from 'react';
import type { Signal, Incident } from '../types';
import { Search, ChevronRight } from 'lucide-react';

const LANG_LABELS: Record<string, string> = {
    en: 'English (EN)',
    fr: 'French (FR)',
    ha: 'Hausa (HA)',
    pt: 'Portuguese (PT)',
    sw: 'Swahili (SW)',
    ar: 'Arabic (AR)',
    yo: 'Yoruba (YO)',
    am: 'Amharic (AM)',
    ig: 'Igbo (IG)',
    ln: 'Lingala (LN)',
    om: 'Oromo (OM)',
    sn: 'Shona (SN)',
};

interface DataRegistryProps {
    signals: Signal[];
    incidents: Incident[];
    onSignalClick: (signal: Signal) => void;
    onIncidentClick: (incident: Incident) => void;
    activeSignalId?: string | number;
    isLight?: boolean;
}

export const DataRegistry: React.FC<DataRegistryProps> = ({
    signals, incidents, onSignalClick, onIncidentClick, activeSignalId, isLight = false
}) => {
    const [activeTab, setActiveTab] = useState<'alerts' | 'incidents'>('alerts');
    const [searchTerm, setSearchTerm] = useState('');

    const filteredSignals = useMemo(() => signals.filter(s =>
        s.disease_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.location?.country?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.disease_category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.status?.toLowerCase().includes(searchTerm.toLowerCase())
    ), [signals, searchTerm]);

    const filteredIncidents = useMemo(() => incidents.filter(i =>
        i.incident?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        i.country?.country?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        i.ihmref_data?.category?.toLowerCase().includes(searchTerm.toLowerCase())
    ), [incidents, searchTerm]);

    const getPriorityStyle = (level?: string) => {
        switch (level) {
            case 'P1': return 'bg-red-500/10 text-red-400 border-red-500/20';
            case 'P2': return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
            case 'P3': return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
            case 'P4': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
            default: return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
        }
    };

    const getStatusStyle = (s?: string) => {
        switch (s) {
            case 'validated': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
            case 'triaged': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
            case 'dismissed': return 'bg-slate-500/10 text-slate-500 border-slate-500/20';
            default: return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
        }
    };

    const getCategoryColor = (cat?: string) => {
        const c = cat?.toLowerCase() || '';
        if (c.includes('vhf')) return 'text-red-400 bg-red-500/10 border-red-500/20';
        if (c.includes('respiratory')) return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
        if (c.includes('enteric')) return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
        if (c.includes('vector')) return 'text-purple-400 bg-purple-500/10 border-purple-500/20';
        if (c.includes('zoonotic')) return 'text-orange-400 bg-orange-500/10 border-orange-500/20';
        if (c.includes('vaccine')) return 'text-teal-400 bg-teal-500/10 border-teal-500/20';
        return 'text-slate-400 bg-slate-500/10 border-slate-500/20';
    };

    const formatRelativeTime = (signal: Signal) => {
        const dateStr = signal.created_at || signal.publishedAt || signal.source_timestamp;
        if (!dateStr) return '—';

        try {
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) return '—';

            const diff = Date.now() - date.getTime();
            if (diff < 0) return 'Just now'; // Handle future dates from drift

            const h = Math.floor(diff / 3600000);
            if (h < 1) return 'Just now';
            if (h < 24) return `${h}h ago`;
            const d = Math.floor(h / 24);
            if (d < 7) return `${d}d ago`;
            return date.toLocaleDateString();
        } catch (e) {
            return '—';
        }
    };

    // Expected local languages by country for hint/priority
    const COUNTRY_LANG_HINT: Record<string, string> = {
        'KEN': 'sw', 'TZA': 'sw', 'UGA': 'sw',
        'NGA': 'ha', 'NER': 'ha',
        'ETH': 'am', 'ERI': 'am',
        'SEN': 'fr', 'CIV': 'fr', 'MLI': 'fr', 'GIN': 'fr', 'TGO': 'fr', 'BEN': 'fr', 'CMR': 'fr', 'COG': 'fr', 'COD': 'ln',
        'AGO': 'pt', 'MOZ': 'pt', 'GNB': 'pt', 'CPV': 'pt',
        'DZA': 'ar', 'LBY': 'ar', 'TUN': 'ar', 'MAR': 'ar', 'MRT': 'ar', 'SDN': 'ar', 'SSD': 'ar',
    };

    // Dark theme styles
    const bg = 'bg-[#0B1120]';
    const borderColor = 'border-white/5';
    const headerBg = 'bg-[#0B1120]/95';

    return (
        <div className={`${bg} rounded-[2rem] border ${borderColor} shadow-sm h-full flex flex-col overflow-hidden`}>
            {/* Header */}
            <div className="p-5 pb-0">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h3 className="text-base font-black text-white uppercase tracking-tight">Intelligence Registry</h3>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                {activeTab === 'alerts' ? `${filteredSignals.length} signals` : `${filteredIncidents.length} incidents`} · Live
                            </span>
                        </div>
                    </div>
                    <div className="flex gap-1.5 bg-white/5 p-1 rounded-xl border border-white/5">
                        <button
                            onClick={() => setActiveTab('alerts')}
                            className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'alerts' ? 'bg-white/10 text-white border border-white/10' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            Alerts ({signals.length})
                        </button>
                        <button
                            onClick={() => setActiveTab('incidents')}
                            className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'incidents' ? 'bg-white/10 text-white border border-white/10' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            Incidents ({incidents.length})
                        </button>
                    </div>
                </div>

                {/* Search */}
                <div className="relative mb-3">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-600" />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Search..."
                        className="w-full bg-white/5 border border-white/5 rounded-xl py-2.5 pl-10 pr-4 text-sm font-medium text-white placeholder:text-slate-600 focus:ring-1 focus:ring-blue-500/50 focus:bg-white/10 focus:border-blue-500/30 transition-all outline-none"
                    />
                </div>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-auto min-h-0">
                <table className="w-full text-left">
                    <thead className={`sticky top-0 ${headerBg} backdrop-blur-md z-10 border-b border-white/5`}>
                        {activeTab === 'alerts' ? (
                            <tr className="text-[9px] font-black text-slate-600 uppercase tracking-[0.15em]">
                                <th className="px-5 py-2.5">Disease / Type</th>
                                <th className="px-4 py-2.5">Location</th>
                                <th className="px-4 py-2.5">Priority</th>
                                <th className="px-4 py-2.5">Status</th>
                                <th className="px-4 py-2.5">AI</th>
                                <th className="px-4 py-2.5">Lang</th>
                                <th className="px-4 py-2.5">Time</th>
                                <th className="px-3 py-2.5"></th>
                            </tr>
                        ) : (
                            <tr className="text-[9px] font-black text-slate-600 uppercase tracking-[0.15em]">
                                <th className="px-5 py-2.5">Incident</th>
                                <th className="px-4 py-2.5">Country</th>
                                <th className="px-4 py-2.5">Category</th>
                                <th className="px-4 py-2.5">Year</th>
                                <th className="px-4 py-2.5">AFRO / Global</th>
                                <th className="px-4 py-2.5">Duration</th>
                                <th className="px-3 py-2.5"></th>
                            </tr>
                        )}
                    </thead>
                    <tbody className="divide-y divide-white/[0.03]">
                        {activeTab === 'alerts' ? (
                            filteredSignals.map((signal) => {
                                const isSelected = activeSignalId && (signal.id === activeSignalId);
                                return (
                                    <tr
                                        key={signal.id}
                                        onClick={() => onSignalClick(signal)}
                                        className={`transition-colors cursor-pointer group ${isSelected
                                            ? 'bg-blue-500/10 border-l-2 border-l-blue-500'
                                            : 'hover:bg-white/[0.03]'
                                            }`}
                                    >
                                        {/* Disease / Type */}
                                        <td className="px-5 py-3 max-w-[400px]">
                                            <div className="flex flex-col gap-0.5">
                                                {/* Primary label: use headline when disease is generic */}
                                                {(() => {
                                                    const isGeneric = !signal.disease_name || signal.disease_name === 'Health Hazard' || signal.disease_name === 'Health Signal' || signal.disease_name === 'unknown';
                                                    const displayName = isGeneric
                                                        ? (signal.headline && signal.headline.length > 5 ? (signal.headline.length > 65 ? signal.headline.substring(0, 62) + '…' : signal.headline) : 'Health Signal')
                                                        : signal.disease_name;
                                                    const hasSubHeadline = !isGeneric && signal.headline && signal.headline.length > 5 && signal.headline !== signal.disease_name;
                                                    
                                                    return (
                                                        <>
                                                            {/* Non-English original text indicator */}
                                                            {signal.original_language && signal.original_language !== 'en' && signal.original_text && (
                                                                <div className="flex items-center gap-1.5 mb-0.5">
                                                                    <span className="text-[7px] font-black px-1 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 uppercase tracking-tighter">
                                                                        {LANG_LABELS[signal.original_language]?.split(' ')[0] || signal.original_language.toUpperCase()}
                                                                    </span>
                                                                    <span className="text-[10px] font-medium text-blue-400/70 leading-tight truncate max-w-[300px]">
                                                                        {signal.original_text.length > 55 ? signal.original_text.substring(0, 52) + '…' : signal.original_text}
                                                                    </span>
                                                                </div>
                                                            )}

                                                            {/* Main disease/signal name */}
                                                            <div className="flex items-center gap-1.5">
                                                                {signal.original_language && signal.original_language !== 'en' && (
                                                                    <span className="text-[7px] font-black px-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase">EN</span>
                                                                )}
                                                                <span className="text-sm font-bold text-white leading-tight group-hover:text-blue-400 transition-colors truncate max-w-[320px]">
                                                                    {displayName}
                                                                </span>
                                                            </div>

                                                            {/* Sub-headline for specific diseases that also have article text */}
                                                            {hasSubHeadline && (
                                                                <span className="text-[10px] text-slate-500 font-medium truncate max-w-[320px] leading-tight mt-0.5">
                                                                    {signal.headline!.length > 60 ? signal.headline!.substring(0, 57) + '…' : signal.headline}
                                                                </span>
                                                            )}
                                                        </>
                                                    );
                                                })()}
                                            </div>
                                            {/* Tags — only show meaningful ones */}
                                            <div className="flex flex-wrap items-center gap-1 mt-1">
                                                {/* Source Badge */}
                                                {(signal.ingestion_source || (signal.id && String(signal.id).startsWith('NASA-')) || (signal.id && String(signal.id).startsWith('GDELT-'))) && (
                                                    <span className={`text-[7px] font-black px-1.5 py-0.5 rounded border uppercase flex items-center gap-1 ${(signal.ingestion_source === 'NASA' || (signal.id && String(signal.id).startsWith('NASA-')))
                                                        ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                                                        : (signal.ingestion_source === 'GDELT' || (signal.id && String(signal.id).startsWith('GDELT-')))
                                                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                                            : (signal.ingestion_source === 'WHO-DON' || (signal.id && String(signal.id).startsWith('WHO-DON')))
                                                                ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
                                                                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                                        }`}>
                                                        {(signal.id && String(signal.id).startsWith('NASA-')) ? '🛰️ NASA'
                                                         : (signal.id && String(signal.id).startsWith('GDELT-')) ? '🌐 GDELT'
                                                         : (signal.id && String(signal.id).startsWith('WHO-DON')) ? '🏥 WHO-DON'
                                                         : `🏛️ ${signal.ingestion_source || 'SENTINEL'}`}
                                                    </span>
                                                )}
                                                {/* Category — suppress generic "other" and "hazard" */}
                                                {signal.disease_category && signal.disease_category !== 'other' && signal.disease_category !== 'hazard' && (
                                                    <span className={`text-[7px] font-black px-1.5 py-0.5 rounded border uppercase ${getCategoryColor(signal.disease_category)}`}>
                                                        {signal.disease_category.replace(/_/g, ' ')}
                                                    </span>
                                                )}
                                                {/* Signal type — only show for rumor/hazard, not generic "disease" */}
                                                {signal.signal_type && signal.signal_type !== 'disease' && signal.signal_type !== 'hazard' && (
                                                    <span className="text-[7px] font-black px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20 uppercase">
                                                        {signal.signal_type}
                                                    </span>
                                                )}
                                            </div>
                                        </td>

                                        {/* Location */}
                                        <td className="px-4 py-3">
                                            <span className="text-xs font-bold text-slate-300">
                                                {signal.location?.country || '—'}
                                            </span>
                                            {signal.location?.admin1 && (
                                                <span className="text-[10px] text-slate-600 font-medium block">{signal.location.admin1}</span>
                                            )}
                                        </td>

                                        {/* Priority */}
                                        <td className="px-4 py-3">
                                            <span className={`px-2 py-0.5 rounded text-[9px] font-black border uppercase tracking-wider ${getPriorityStyle(signal.priority)}`}>
                                                {signal.priority || 'P4'}
                                            </span>
                                        </td>

                                        {/* Status */}
                                        <td className="px-4 py-3">
                                            <span className={`px-2 py-0.5 rounded text-[9px] font-black border uppercase tracking-wider ${getStatusStyle(signal.status)}`}>
                                                {signal.status || 'new'}
                                            </span>
                                        </td>

                                        {/* AI Classification */}
                                        <td className="px-4 py-3">
                                            {signal.ai_classification ? (
                                                <div className="flex flex-col gap-1">
                                                    <span className={`px-1.5 py-0.5 rounded text-[7px] font-black border uppercase text-center ${
                                                        signal.ai_classification === 'continent_alert' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                                                        signal.ai_classification === 'area_alert' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' :
                                                        signal.ai_classification === 'no_alert' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                                        'bg-slate-500/10 text-slate-500 border-slate-500/20'
                                                    }`}>
                                                        {signal.ai_classification === 'continent_alert' ? '🌍 Cont' :
                                                         signal.ai_classification === 'area_alert' ? '📍 Area' :
                                                         signal.ai_classification === 'no_alert' ? '✓ Clear' : '?'}
                                                    </span>
                                                    {signal.ai_severity && (
                                                        <span className={`text-[7px] font-black uppercase text-center ${
                                                            signal.ai_severity === 'critical' ? 'text-red-400' :
                                                            signal.ai_severity === 'high' ? 'text-orange-400' :
                                                            signal.ai_severity === 'moderate' ? 'text-amber-400' : 'text-slate-600'
                                                        }`}>
                                                            {signal.ai_severity}
                                                        </span>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="text-[8px] text-slate-700">—</span>
                                            )}
                                        </td>

                                        {/* Language */}
                                        <td className="px-4 py-3">
                                            <div className="flex flex-col gap-1">
                                                <span className={`px-1.5 py-0.5 rounded text-[8px] font-black border uppercase text-center ${signal.original_language && signal.original_language !== 'en'
                                                    ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                                                    : 'bg-white/5 text-slate-500 border-white/5'
                                                    }`}>
                                                    {LANG_LABELS[signal.original_language || 'en']?.split(' ')[0] || 'EN'}
                                                </span>
                                                {signal.location?.country_iso && COUNTRY_LANG_HINT[signal.location.country_iso] && COUNTRY_LANG_HINT[signal.location.country_iso] !== signal.original_language && (
                                                    <span className="text-[7px] font-black text-slate-600 uppercase text-center opacity-50">
                                                        Loc: {COUNTRY_LANG_HINT[signal.location.country_iso].toUpperCase()}
                                                    </span>
                                                )}
                                            </div>
                                        </td>

                                        {/* Time */}
                                        <td className="px-4 py-3">
                                            <span className="text-[10px] font-bold text-slate-500">{formatRelativeTime(signal)}</span>
                                        </td>

                                        {/* Arrow */}
                                        <td className="px-3 py-3 text-right">
                                            <ChevronRight className={`w-3.5 h-3.5 transition-colors ${isSelected ? 'text-blue-400' : 'text-slate-700 group-hover:text-blue-400'}`} />
                                        </td>
                                    </tr>
                                );
                            })
                        ) : (
                            filteredIncidents.map((incident) => (
                                <tr
                                    key={incident.id}
                                    onClick={() => onIncidentClick(incident)}
                                    className="hover:bg-white/[0.03] transition-colors cursor-pointer group"
                                >
                                    <td className="px-5 py-3">
                                        <span className="text-sm font-bold text-white leading-tight block group-hover:text-amber-400 transition-colors line-clamp-2 max-w-[250px]">
                                            {incident.incident || 'General Incident'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="text-xs font-bold text-slate-300">{incident.country?.country || '—'}</span>
                                        {incident.country?.state && (
                                            <span className="text-[10px] text-slate-600 font-medium block">{incident.country.state}</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="px-2 py-0.5 rounded text-[7px] font-black bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 uppercase">
                                            {incident.ihmref_data?.category?.replace(/_/g, ' ') || '—'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="text-xs font-bold text-slate-400">{incident.ihmref_data?.year || '—'}</span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="text-xs font-black text-blue-400">{incident.ihmref_data?.afro ?? '—'}</span>
                                        <span className="text-slate-600 text-xs font-bold"> / {incident.ihmref_data?.global_t ?? '—'}</span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="text-[10px] text-slate-500 font-medium">
                                            {incident.start_date ? new Date(incident.start_date).toLocaleDateString() : '—'}
                                        </span>
                                    </td>
                                    <td className="px-3 py-3 text-right">
                                        <ChevronRight className="w-3.5 h-3.5 text-slate-700 group-hover:text-amber-400 transition-colors" />
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>

                {(activeTab === 'alerts' ? filteredSignals : filteredIncidents).length === 0 && (
                    <div className="py-16 text-center">
                        <p className="text-slate-600 text-sm font-bold uppercase tracking-widest">No records found</p>
                    </div>
                )}
            </div>
        </div>
    );
};
