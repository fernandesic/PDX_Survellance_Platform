import React, { useMemo, useRef, useState } from 'react';
import { X, FileText, TrendingUp, AlertTriangle, ShieldCheck, Zap, Download, Loader2 } from 'lucide-react';
import type { Signal } from '../types';
import { useOutbreakDetection } from '@/hooks/useOutbreakDetection';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { logger } from "@/utils/logger";

interface SituationReportProps {
    country: string;
    iso3: string;
    signals: Signal[];
    onClose: () => void;
}

export const SituationReport: React.FC<SituationReportProps> = ({ country, iso3, signals, onClose }) => {
    const [isExporting, setIsExporting] = useState(false);
    const reportRef = useRef<HTMLDivElement>(null);

    const countrySignals = useMemo(() =>
        signals.filter(s => (s.location?.iso3 || s.location?.country_iso) === iso3 || s.location?.country === country),
        [signals, iso3, country]);

    const clusters = useOutbreakDetection(countrySignals);
    const p1Count = countrySignals.filter(s => s.priority === 'P1' || s.level === 'P1').length;

    const summaryText = useMemo(() => {
        if (countrySignals.length === 0) return "No active signals detected for this region.";

        let text = `Current surveillance for ${country} identifies ${countrySignals.length} active signals. `;

        if (p1Count > 0) {
            text += `A critical concentration of ${p1Count} Priority 1 alerts requires immediate verification. `;
        }

        if (clusters.length > 0) {
            text += `Automated intelligence has flagged ${clusters.length} potential outbreak clusters, primarily involving ${clusters.map(c => c.disease).join(', ')}. `;
        } else {
            text += `No formal outbreak clusters detected in the last 7 days, though baseline monitoring continues. `;
        }

        return text;
    }, [country, countrySignals, p1Count, clusters]);

    const handleExportPDF = async () => {
        if (!reportRef.current) return;
        setIsExporting(true);
        try {
            const canvas = await html2canvas(reportRef.current, {
                backgroundColor: '#050A18',
                scale: 2,
                useCORS: true
            });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const imgProps = pdf.getImageProperties(imgData);
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            pdf.save(`SitRep_${country}_${new Date().toISOString().split('T')[0]}.pdf`);
        } catch (error) {
            logger.error('PDF Export Error:', error);
        }
        setIsExporting(false);
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-300">
            <div ref={reportRef} className="bg-[#050A18] border border-white/10 w-full max-w-2xl rounded-[1.5rem] overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.5)] flex flex-col max-h-[85vh] relative">
                <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />

                {/* Header */}
                <div className="p-6 pb-4 flex items-center justify-between relative">
                    <div className="flex items-center gap-4">
                        <div className="relative">
                            <div className="w-12 h-12 rounded-xl bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20 text-cyan-400">
                                <FileText className="w-6 h-6" />
                            </div>
                            <div className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-red-500 rounded-full border-2 border-[#050A18] animate-pulse" />
                        </div>
                        <div>
                            <div className="flex items-center gap-1.5 mb-0.5">
                                <span className="px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-500 border border-cyan-500/20 text-[7px] font-black uppercase tracking-widest">Confidential</span>
                                <span className="text-[8px] font-black text-slate-500 uppercase tracking-[0.2em]">Surveillance Output</span>
                            </div>
                            <h2 className="text-xl font-black uppercase text-white tracking-tight flex items-baseline gap-2">
                                SitRep <span className="text-cyan-500 opacity-50">/</span> {country}
                            </h2>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-10 h-10 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-xl transition-all text-slate-400 hover:text-white border border-white/5 active:scale-95">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-6 custom-scrollbar">
                    {/* Executive Summary Card */}
                    <div className="relative group">
                        <div className="relative p-5 bg-white/[0.02] border border-white/5 rounded-2xl space-y-2.5">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2.5 text-cyan-400">
                                    <Zap className="w-4 h-4" />
                                    <span className="text-[8px] font-black uppercase tracking-[0.2em]">Intelligence Briefing</span>
                                </div>
                                <div className="text-[7px] font-bold text-slate-600 uppercase tracking-widest">{new Date().toLocaleTimeString()}</div>
                            </div>
                            <p className="text-base font-medium leading-[1.5] text-slate-200">
                                "{summaryText}"
                            </p>
                        </div>
                    </div>

                    {/* Key Metrics Grid */}
                    <div className="grid grid-cols-3 gap-4">
                        {[
                            { label: 'Critical Pathogens', val: p1Count, icon: AlertTriangle, color: 'text-red-500', bg: 'bg-red-500/10' },
                            { label: 'Active Signals', val: countrySignals.length, icon: TrendingUp, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
                            { label: 'Detection Units', val: clusters.length, icon: ShieldCheck, color: 'text-emerald-400', bg: 'bg-emerald-500/10' }
                        ].map((m, i) => (
                            <div key={i} className="p-4 rounded-2xl bg-white/[0.01] border border-white/5 hover:bg-white/[0.03] transition-colors group">
                                <div className={`w-8 h-8 rounded-lg ${m.bg} ${m.color} flex items-center justify-center mb-2.5 transition-transform group-hover:scale-105`}>
                                    <m.icon className="w-4 h-4" />
                                </div>
                                <div className="text-2xl font-black text-white mb-0.5">{m.val}</div>
                                <div className="text-[7.5px] font-black text-slate-500 uppercase tracking-widest leading-none">{m.label}</div>
                            </div>
                        ))}
                    </div>

                    {/* Clusters Section */}
                    {clusters.length > 0 && (
                        <div className="space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="h-[2px] w-8 bg-orange-500/30"></div>
                                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-orange-400">Identified Risk Zones</span>
                                <div className="flex-1 h-[1px] bg-white/5"></div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                {clusters.map((c, i) => (
                                    <div key={i} className="p-3.5 rounded-xl bg-orange-500/5 border border-orange-500/10 flex items-center justify-between group hover:border-orange-500/30 transition-all">
                                        <div className="space-y-0.5">
                                            <div className="text-xs font-black text-white uppercase tracking-tight">{c.disease}</div>
                                            <div className="text-[9px] text-orange-400/60 font-black uppercase tracking-widest">{c.count} Clusters</div>
                                        </div>
                                        <div className="px-3 py-1 rounded-md bg-orange-500 text-white text-[9px] font-black uppercase tracking-tighter">Critical</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                </div>

                {/* Footer Actions */}
                <div className="p-6 pt-0 flex items-center justify-between">
                    <p className="text-[8px] font-bold text-slate-600 uppercase tracking-[0.2em]">
                        {countrySignals.length} Records Analyzed
                    </p>
                    <div className="flex items-center gap-3">
                        <button className="flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-white/5">
                            <Download className="w-3.5 h-3.5" /> Raw Data
                        </button>
                        <button
                            onClick={handleExportPDF}
                            disabled={isExporting}
                            className="flex items-center gap-2 px-8 py-3 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg active:scale-95 group disabled:opacity-50"
                        >
                            {isExporting ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" /> Generating...
                                </>
                            ) : (
                                <>
                                    <FileText className="w-4 h-4 group-hover:rotate-12 transition-transform" /> PDF Briefing
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
