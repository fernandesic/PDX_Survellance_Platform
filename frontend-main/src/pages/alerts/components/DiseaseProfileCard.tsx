// @ts-nocheck
import React, { useMemo } from 'react';
import type { Signal } from '../types';
import { Dna, AlertTriangle, Activity, Thermometer, Route, MapPin } from 'lucide-react';

interface DiseaseProfileCardProps {
    signal: Signal | null;
    diseases: Array<any>;
}

const CATEGORY_COLORS: Record<string, string> = {
    vhf: 'text-red-400 bg-red-500/10 border-red-500/20',
    respiratory: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    enteric: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    vector_borne: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
    zoonotic: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
    vaccine_preventable: 'text-teal-400 bg-teal-500/10 border-teal-500/20',
    environmental: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
    unknown: 'text-slate-400 bg-white/5 border-white/5',
    other: 'text-slate-400 bg-white/5 border-white/5',
};

// Keyword aliases to match headlines to DB disease names
// e.g. "anti-HIV jab" → search for "HIV" in diseases DB
const KEYWORD_TO_DISEASE: Record<string, string[]> = {
    'hiv': ['HIV', 'HIV/AIDS'], 'aids': ['HIV', 'HIV/AIDS'], 'anti-hiv': ['HIV', 'HIV/AIDS'],
    'tb': ['Tuberculosis'], 'tuberculosis': ['Tuberculosis'],
    'flu': ['Influenza'], 'h1n1': ['Influenza'], 'h3n2': ['Influenza'],
    'h5n1': ['Avian Influenza'], 'bird flu': ['Avian Influenza'],
    'monkeypox': ['Mpox'], 'mpox': ['Mpox'],
    'marburg': ['Marburg'], 'ebola': ['Ebola'],
    'cholera': ['Cholera'], 'malaria': ['Malaria'],
    'measles': ['Measles'], 'polio': ['Polio'],
    'dengue': ['Dengue'], 'lassa': ['Lassa Fever'],
    'yellow fever': ['Yellow Fever'], 'meningitis': ['Meningococcal Disease'],
    'plague': ['Plague'], 'anthrax': ['Anthrax'],
    'rabies': ['Rabies'], 'rift valley': ['Rift Valley Fever'],
    'typhoid': ['Typhoid Fever'], 'diphtheria': ['Diphtheria'],
    'chikungunya': ['Chikungunya'], 'covid': ['COVID-19'], 'coronavirus': ['COVID-19'],
};

export const DiseaseProfileCard: React.FC<DiseaseProfileCardProps> = ({ signal, diseases }) => {
    const profile = useMemo(() => {
        if (!signal) return null;

        // Resolve disease name from multiple possible sources
        const name = (
            signal.disease_name ||
            signal.disease?.name ||
            signal.headline ||
            ''
        ).toLowerCase().trim();

        if (!name) return null;

        if (name === 'unknown' || name === 'health signal' || name === 'unknown event') {
            return null; // Don't show profile for unidentified signals
        }

        if (!diseases?.length) return null; // No DB data available

        // 1. Try exact match on disease_name
        const exactMatch = diseases.find(d =>
            d.disease_name?.toLowerCase().trim() === name
        );
        if (exactMatch) return exactMatch;

        // 2. Try substring match (e.g. "lassa fever surge" contains "lassa fever")
        const substringMatch = diseases.find(d => {
            const dbName = d.disease_name?.toLowerCase().trim();
            return dbName && (name.includes(dbName) || dbName.includes(name));
        });
        if (substringMatch) return substringMatch;

        // 3. Try keyword alias matching (e.g. "anti-HIV jab" → find HIV in DB)
        for (const [keyword, diseaseNames] of Object.entries(KEYWORD_TO_DISEASE)) {
            if (name.includes(keyword)) {
                const aliasMatch = diseases.find(d =>
                    diseaseNames.some(dn => d.disease_name?.toLowerCase() === dn.toLowerCase())
                );
                if (aliasMatch) return aliasMatch;
            }
        }

        return null; // No match found — don't show Disease Intelligence
    }, [signal, diseases]);

    if (!signal) {
        return (
            <div className="bg-[#0B1120] rounded-[2rem] border border-white/5 shadow-sm p-5">
                <h3 className="text-base font-black text-white uppercase tracking-tight flex items-center gap-2">
                    <Dna className="w-4 h-4 text-indigo-400" /> Disease Intelligence
                </h3>
                <p className="text-slate-600 text-xs mt-3 font-bold">Select a signal to view disease profile</p>
            </div>
        );
    }

    if (!profile) {
        return (
            <div className="bg-[#0B1120] rounded-[2rem] border border-white/5 shadow-sm p-5">
                <h3 className="text-base font-black text-white uppercase tracking-tight flex items-center gap-2">
                    <Dna className="w-4 h-4 text-indigo-400" /> Disease Intelligence
                </h3>
                <p className="text-slate-500 text-xs mt-3 font-bold">
                    No profile available for <span className="text-white">{signal.disease_name || 'this signal'}</span>
                </p>
            </div>
        );
    }

    const cfr = profile.case_fatality_rate != null ? parseFloat(profile.case_fatality_rate) : null;
    const fatalityColor = (cfr ?? 0) >= 10 ? 'text-red-400' : (cfr ?? 0) >= 2 ? 'text-amber-400' : 'text-emerald-400';
    const fatBg = (cfr ?? 0) >= 10 ? 'bg-red-500/10 border-red-500/20' : (cfr ?? 0) >= 2 ? 'bg-amber-500/10 border-amber-500/20' : 'bg-emerald-500/10 border-emerald-500/20';
    const catStyle = CATEGORY_COLORS[profile.category] || CATEGORY_COLORS.unknown;

    return (
        <div className="bg-[#0B1120] rounded-[2rem] border border-white/5 shadow-sm p-5">
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
                <div>
                    <h3 className="text-base font-black text-white uppercase tracking-tight flex items-center gap-2">
                        <Dna className="w-4 h-4 text-indigo-400" /> Disease Intelligence
                    </h3>
                    <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">
                        Profile: {profile.disease_name}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <span className={`text-[8px] font-black px-2 py-0.5 rounded border uppercase ${catStyle}`}>
                        {(profile.category || '').replace(/_/g, ' ')}
                    </span>
                    <span className={`text-[8px] font-black px-2 py-0.5 rounded border uppercase ${profile.default_priority === 'P1' ? 'text-red-400 bg-red-500/10 border-red-500/20' :
                        profile.default_priority === 'P2' ? 'text-orange-400 bg-orange-500/10 border-orange-500/20' :
                            'text-amber-400 bg-amber-500/10 border-amber-500/20'
                        }`}>
                        Default {profile.default_priority}
                    </span>
                </div>
            </div>

            {/* Content — 2 row layout */}
            <div className="grid grid-cols-5 gap-3 mb-3">
                {/* CFR */}
                <div className={`rounded-xl p-3 border text-center ${fatBg}`}>
                    <Thermometer className={`w-4 h-4 mx-auto mb-1 ${fatalityColor}`} />
                    <span className="text-[7px] font-black text-slate-500 uppercase block">Fatality Rate</span>
                    <span className={`text-xl font-black ${fatalityColor}`}>
                        {cfr != null ? `${cfr}%` : '—'}
                    </span>
                </div>

                {/* Incubation */}
                <div className="bg-white/[0.03] rounded-xl p-3 border border-white/5 text-center">
                    <Activity className="w-4 h-4 mx-auto mb-1 text-blue-400" />
                    <span className="text-[7px] font-black text-slate-500 uppercase block">Incubation</span>
                    <span className="text-xl font-black text-white">
                        {profile.incubation_days_min != null ? `${profile.incubation_days_min}-${profile.incubation_days_max}` : '—'}
                    </span>
                    <span className="text-[8px] font-bold text-slate-600 block">days</span>
                </div>

                {/* Symptoms */}
                <div className="col-span-3 bg-white/[0.03] rounded-xl p-3 border border-white/5">
                    <h4 className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> Symptom Cluster
                    </h4>
                    <div className="flex flex-wrap gap-1">
                        {(profile.symptoms_cluster || []).map((s: string, i: number) => (
                            <span key={i} className="text-[9px] font-bold px-2 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">
                                {s}
                            </span>
                        ))}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
                {/* Transmission */}
                <div className="bg-white/[0.03] rounded-xl p-3 border border-white/5">
                    <h4 className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                        <Route className="w-3 h-3" /> Transmission Routes
                    </h4>
                    <div className="flex flex-wrap gap-1">
                        {(profile.transmission_routes || []).map((t: string, i: number) => (
                            <span key={i} className="text-[9px] font-bold px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">
                                {t}
                            </span>
                        ))}
                    </div>
                </div>

                {/* Endemic Regions */}
                <div className="bg-white/[0.03] rounded-xl p-3 border border-white/5">
                    <h4 className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> Endemic Regions
                    </h4>
                    <div className="flex flex-wrap gap-1">
                        {(profile.endemic_regions || []).map((r: string, i: number) => (
                            <span key={i} className="text-[9px] font-bold px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                {r}
                            </span>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};
