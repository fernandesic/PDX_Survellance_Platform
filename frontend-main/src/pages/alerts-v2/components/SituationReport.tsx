import { useMemo, useRef, useState } from 'react';
import { saveAs } from 'file-saver';
import {
  X,
  FileText,
  FileSpreadsheet,
  TrendingUp,
  AlertTriangle,
  ShieldCheck,
  Zap,
  Download,
  Loader2,
} from 'lucide-react';
import type { Signal } from '../types';
import { useOutbreakDetection } from '@/hooks/useOutbreakDetection';
import { adaptSignalsForOutbreakDetection } from './signalAdapter';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { logger } from '@/utils/logger';
import { buildSignalsCsv, buildSignalsCsvFilename } from './alertDetailUtils';

interface SituationReportProps {
  country: string;
  iso3: string;
  signals: Signal[];
  onClose: () => void;
}

export function SituationReport({ country, iso3, signals, onClose }: SituationReportProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  const countrySignals = useMemo(
    () =>
      signals.filter(
        (s) =>
          (s.location?.iso3 || s.location?.country_iso) === iso3 ||
          s.location?.country === country,
      ),
    [signals, iso3, country],
  );

  const adaptedCountrySignals = useMemo(
    () => adaptSignalsForOutbreakDetection(countrySignals),
    [countrySignals],
  );
  const clusters = useOutbreakDetection(adaptedCountrySignals);
  const p1Count = countrySignals.filter(
    (s) => s.priority === 'P1' || s.level === 'P1',
  ).length;

  const summaryText = useMemo(() => {
    if (countrySignals.length === 0) return 'No active signals detected for this region.';
    let text = `Current surveillance for ${country} identifies ${countrySignals.length} active signals. `;
    if (p1Count > 0) {
      text += `A critical concentration of ${p1Count} Priority 1 alerts requires immediate verification. `;
    }
    if (clusters.length > 0) {
      text += `Automated intelligence has flagged ${clusters.length} potential outbreak clusters, primarily involving ${clusters
        .map((c) => c.disease)
        .join(', ')}. `;
    } else {
      text += 'No formal outbreak clusters detected in the last 7 days, though baseline monitoring continues. ';
    }
    return text;
  }, [country, countrySignals, p1Count, clusters]);

  const handleExportCsv = () => {
    const csv = buildSignalsCsv(countrySignals);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    saveAs(blob, buildSignalsCsvFilename(country, iso3));
  };

  const handleExportPDF = async () => {
    if (!reportRef.current) return;
    setIsExporting(true);
    setExportError(null);
    try {
      const canvas = await html2canvas(reportRef.current, {
        backgroundColor: '#050A18',
        scale: 2,
        useCORS: true,
        // Strip the interactive controls (close X, footer buttons) from the
        // snapshot so the PDF only shows the report body.
        onclone: (_doc, clonedRef) => {
          // Remove excluded elements entirely so they don't leave blank space
          clonedRef
            .querySelectorAll<HTMLElement>('[data-pdf-exclude="true"]')
            .forEach((el) => el.remove());
          // Let the container shrink-wrap to its remaining content
          clonedRef.style.maxHeight = 'none';
          clonedRef.style.height = 'auto';
          clonedRef.style.overflow = 'visible';
        },
      });
      const imgData = canvas.toDataURL('image/png');
      const imgProps = { width: canvas.width, height: canvas.height };
      const pxToMm = 25.4 / 96 / 2;
      const pdfWidth = imgProps.width * pxToMm;
      const pdfHeight = imgProps.height * pxToMm;
      const pdf = new jsPDF({
        orientation: pdfHeight > pdfWidth ? 'p' : 'l',
        unit: 'mm',
        format: [pdfWidth, pdfHeight],
      });
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      // Sanitize country name — strips diacritics, apostrophes, slashes that
      // break filesystems on Windows/macOS (e.g. "Côte d'Ivoire" → "Cote_d_Ivoire").
      const sanitizedCountry = country.normalize('NFD').replace(/[^a-zA-Z0-9_-]/g, '_');
      pdf.save(`SitRep_${sanitizedCountry}_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (error) {
      logger.error('PDF Export Error:', error);
      setExportError('Could not generate PDF — try again or use CSV export.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      data-testid="situation-report"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        ref={reportRef}
        onClick={(e) => e.stopPropagation()}
        className="relative flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#050A18] shadow-[0_0_100px_rgba(0,0,0,0.5)]"
      >
        <div className="absolute left-0 right-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />
        <div className="relative flex items-center justify-between p-6 pb-4">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-cyan-500/20 bg-cyan-500/10 text-cyan-400">
              <FileText className="h-6 w-6" />
            </div>
            <div>
              <div className="mb-0.5 flex items-center gap-1.5">
                <span className="rounded border border-cyan-500/20 bg-cyan-500/10 px-1.5 py-0.5 text-[7px] font-black uppercase tracking-widest text-cyan-500">
                  Confidential
                </span>
                <span className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-500">
                  Surveillance Output
                </span>
              </div>
              <h2 className="flex items-baseline gap-2 text-xl font-black uppercase tracking-tight text-white">
                SitRep <span className="text-cyan-500 opacity-50">/</span> {country}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="close"
            data-pdf-exclude="true"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/5 bg-white/5 text-slate-400 transition-all hover:bg-white/10 hover:text-white active:scale-95"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-6 pb-6">
          <div className="relative p-5">
            <div className="space-y-2.5 rounded-2xl border border-white/5 bg-white/[0.02] p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5 text-cyan-400">
                  <Zap className="h-4 w-4" />
                  <span className="text-[8px] font-black uppercase tracking-[0.2em]">Intelligence Briefing</span>
                </div>
                <div className="text-[7px] font-bold uppercase tracking-widest text-slate-600">
                  {new Date().toLocaleTimeString()}
                </div>
              </div>
              <p className="text-base font-medium leading-[1.5] text-slate-200">“{summaryText}”</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Critical Pathogens', val: p1Count, Icon: AlertTriangle, color: 'text-red-500', bg: 'bg-red-500/10' },
              { label: 'Active Signals', val: countrySignals.length, Icon: TrendingUp, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
              { label: 'Detection Units', val: clusters.length, Icon: ShieldCheck, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
            ].map((m) => (
              <div
                key={m.label}
                className="rounded-2xl border border-white/5 bg-white/[0.01] p-4 transition-colors hover:bg-white/[0.03]"
              >
                <div className={`mb-2.5 flex h-8 w-8 items-center justify-center rounded-lg ${m.bg} ${m.color}`}>
                  <m.Icon className="h-4 w-4" />
                </div>
                <div className="mb-0.5 text-2xl font-black text-white">{m.val}</div>
                <div className="text-[7.5px] font-black uppercase leading-none tracking-widest text-slate-500">
                  {m.label}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div
          data-pdf-exclude="true"
          className="flex items-center justify-between p-6 pt-0"
        >
          <p className="text-[8px] font-bold uppercase tracking-[0.2em] text-slate-600">
            {countrySignals.length} Records Analyzed
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={countrySignals.length === 0}
              data-testid="sitrep-export-csv"
              className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-[10px] font-black uppercase tracking-widest text-slate-200 transition-all hover:bg-white/10 active:scale-95 disabled:opacity-50"
            >
              <FileSpreadsheet className="h-4 w-4" /> CSV
            </button>
            <button
              type="button"
              onClick={handleExportPDF}
              disabled={isExporting}
              data-testid="sitrep-export-pdf"
              className="flex items-center gap-2 rounded-xl bg-cyan-600 px-8 py-3 text-[10px] font-black uppercase tracking-widest text-white shadow-lg transition-all hover:bg-cyan-500 active:scale-95 disabled:opacity-50"
            >
              {isExporting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Generating...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" /> PDF Briefing
                </>
              )}
            </button>
          </div>
          {exportError ? (
            <p
              className="mt-2 text-right text-[10px] font-semibold uppercase tracking-widest text-red-400"
              role="alert"
              data-testid="sitrep-export-error"
            >
              {exportError}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
