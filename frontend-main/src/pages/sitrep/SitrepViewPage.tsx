/**
 * SITREP Read-Only View Page
 * Route: /sitrep/view/:id
 *   - Fetches the full report from /api/v1/sitrep/report-detail/<id>
 *   - Renders all 6 sections as a printable, read-only layout
 *   - "Download PDF" button generates a multi-page PDF of the layout
 *   - Add ?autodownload=1 to trigger the download as soon as the page loads
 *     (used by the dashboard's "Download PDF" action)
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, FileText, Loader2 } from 'lucide-react';

import { ApiConsumer } from '@/lib/api';
import { useTheme } from '@/contexts/ThemeContext';
import { getCountryRisk, getChecklist, RISK_COLORS } from './constants/checklists';
import { generateSitrepPdf, type SitrepReport } from './utils/generateSitrepPdf';

type ReportData = SitrepReport;

const DOC_CONTROL_FIELDS: Array<{ key: keyof ReportData; label: string }> = [
    { key: 'sitrep_number', label: 'Sitrep number' },
    { key: 'reporting_period', label: 'Reporting period' },
    { key: 'date_of_issue', label: 'Date of issue' },
    { key: 'data_cutoff', label: 'Data cut-off' },
    { key: 'classification', label: 'Classification' },
    { key: 'geographic_scope', label: 'Geographic scope' },
    { key: 'triggering_event', label: 'Triggering event' },
    { key: 'prepared_by', label: 'Prepared by' },
    { key: 'cleared_by', label: 'Cleared by' },
    { key: 'next_issue', label: 'Next issue' },
];

const STAT_FIELDS: Array<{ key: keyof ReportData; label: string }> = [
    { key: 'population_in_screening', label: 'PoE Screening' },
    { key: 'high_risk_poe', label: '# High-risk points of entry' },
    { key: 'referred', label: 'Referred' },
    { key: 'isolated', label: 'Isolated' },
    { key: 'suspected', label: 'Suspected' },
];

const SectionHeader: React.FC<{ n: number | string; title: string }> = ({ n, title }) => (
    <div className="flex items-center gap-3 px-5 py-3.5 bg-gradient-to-r from-[#1a2744] to-[#2c3e6b] rounded-t-xl">
        <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white text-sm font-bold">
            {n}
        </div>
        <h3 className="text-white font-bold text-base">{title}</h3>
    </div>
);

const Body: React.FC<{ children: React.ReactNode; pad?: boolean }> = ({ children, pad = true }) => (
    <div className={`bg-white border border-gray-100 border-t-0 rounded-b-xl shadow-sm ${pad ? 'p-5' : ''}`}>
        {children}
    </div>
);

const SitrepViewPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { theme } = useTheme();
    const isLight = theme === 'light';
    const autodownload = searchParams.get('autodownload') === '1';

    const [report, setReport] = useState<ReportData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string>('');
    const [downloading, setDownloading] = useState(false);
    const printableRef = useRef<HTMLDivElement>(null);
    const autoTriggered = useRef(false);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await ApiConsumer.get(`/sitrep/report-detail/${id}`);
                if (!cancelled) setReport(res?.data || null);
            } catch (err: any) {
                if (!cancelled) setError(err?.message || 'Failed to load report');
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [id]);

    const downloadPdf = useCallback(async () => {
        if (!report) return;
        setDownloading(true);
        try {
            await generateSitrepPdf(report);
        } catch (err) {
            console.error('PDF export failed', err);
        } finally {
            setDownloading(false);
        }
    }, [report]);

    // Auto-trigger download once after report renders, if ?autodownload=1
    useEffect(() => {
        if (autodownload && !autoTriggered.current && report && !loading) {
            autoTriggered.current = true;
            // Run on the next tick once `report` is set; no DOM dependency.
            const t = setTimeout(() => { downloadPdf(); }, 50);
            return () => clearTimeout(t);
        }
    }, [autodownload, downloadPdf, loading, report]);

    const riskInfo = useMemo(
        () => (report?.selected_country ? getCountryRisk(report.selected_country) : null),
        [report?.selected_country],
    );
    const riskStyle = riskInfo ? RISK_COLORS[riskInfo.risk] : null;
    const checklist = useMemo(
        () => (riskInfo ? getChecklist(riskInfo.checklist) : []),
        [riskInfo],
    );

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className={`w-8 h-8 animate-spin ${isLight ? 'text-blue-500' : 'text-blue-400'}`} />
            </div>
        );
    }

    if (error || !report) {
        return (
            <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
                <FileText className={`w-12 h-12 mb-3 ${isLight ? 'text-gray-400' : 'text-gray-500'}`} />
                <p className={`text-lg font-semibold mb-1 ${isLight ? 'text-gray-700' : 'text-gray-200'}`}>Report not found</p>
                <p className={`text-sm mb-6 ${isLight ? 'text-gray-500' : 'text-gray-400'}`}>
                    {error || 'The requested SITREP report could not be loaded.'}
                </p>
                <button
                    onClick={() => navigate('/sitrep')}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700"
                >
                    <ArrowLeft className="w-4 h-4" /> Back to dashboard
                </button>
            </div>
        );
    }

    return (
        <div className="p-6 md:p-8 max-w-[1100px] mx-auto">
            {/* Toolbar (excluded from PDF capture by ref boundary) */}
            <div className={`flex items-center justify-between gap-3 flex-wrap mb-6 p-4 rounded-2xl border ${
                isLight
                    ? 'bg-white border-gray-200 shadow-sm'
                    : 'bg-white/5 border-white/10'
            }`}>
                <button
                    onClick={() => navigate('/sitrep')}
                    className={`inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold rounded-lg transition-colors ${
                        isLight
                            ? 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                            : 'text-gray-300 hover:text-white hover:bg-white/10'
                    }`}
                >
                    <ArrowLeft className="w-4 h-4" /> Back
                </button>
                <div className="flex-1 min-w-0">
                    <p className={`text-sm font-bold truncate ${isLight ? 'text-gray-900' : 'text-white'}`}>
                        SITREP {report.sitrep_number}
                        {report.reporting_period ? ` · ${report.reporting_period}` : ''}
                    </p>
                    <p className={`text-xs ${isLight ? 'text-gray-500' : 'text-gray-400'}`}>Read-only view</p>
                </div>
                <button
                    onClick={downloadPdf}
                    disabled={downloading}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 disabled:opacity-60 shadow-sm"
                >
                    {downloading ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</>
                    ) : (
                        <><Download className="w-4 h-4" /> Download PDF</>
                    )}
                </button>
            </div>

            {/* Printable area — always light so PDF output stays consistent regardless of dashboard theme */}
            <div ref={printableRef} className="bg-[#f0f2f5] rounded-2xl overflow-hidden">
                    {/* WHO header */}
                    <div data-pdf-chunk className="w-full bg-gradient-to-r from-[#1a2744] via-[#1e3a5f] to-[#1a2744] py-10 px-6 text-center rounded-2xl">
                        <img
                            src="/logo.png"
                            alt="WHO AFRO Logo"
                            className="w-24 h-auto mx-auto mb-4"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                        <p className="text-white/60 text-[10px] uppercase tracking-[0.25em] font-semibold mb-3">
                            World Health Organization — Regional Office for Africa
                        </p>
                        <div className="w-16 h-1 mx-auto mb-4 rounded-full bg-[#4a9fd8]" />
                        <h1 className="text-white text-2xl md:text-3xl font-black tracking-tight uppercase mb-1">
                            Ebola Virus Disease
                        </h1>
                        <h2 className="text-[#4a9fd8] text-sm md:text-base font-bold uppercase tracking-wider mb-1">
                            Preparedness &amp; Readiness Situation Report (SITREP)
                        </h2>
                        <p className="text-white/50 text-xs font-medium mt-2">
                            African Region · Bundibugyo virus disease (BVD)
                        </p>
                        <div className="flex items-center justify-center gap-4 mt-5 flex-wrap">
                            <span className="px-4 py-1.5 bg-white/10 backdrop-blur-sm rounded-full border border-white/10 text-white text-xs font-bold">
                                SITREP {report.sitrep_number}
                            </span>
                            {report.reporting_period && (
                                <span className="px-4 py-1.5 bg-white/10 backdrop-blur-sm rounded-full border border-white/10 text-white text-xs font-bold">
                                    {report.reporting_period}
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="pt-6 space-y-6">
                        {/* Section 0 — Document Control */}
                        <div data-pdf-chunk>
                            <SectionHeader n={0} title="Document Control" />
                            <Body pad={false}>
                                {DOC_CONTROL_FIELDS.map((f) => (
                                    <div key={f.key} className="flex border-b border-gray-100 last:border-b-0">
                                        <div className="w-[180px] md:w-[220px] flex-shrink-0 px-5 py-3 bg-gray-50/80 flex items-center">
                                            <span className="text-sm font-semibold text-gray-700">{f.label}</span>
                                        </div>
                                        <div className="flex-1 px-4 py-3 text-sm text-gray-800">
                                            {(report[f.key] as string) || <span className="text-gray-400 italic">—</span>}
                                        </div>
                                    </div>
                                ))}
                            </Body>
                        </div>

                        {/* Section 1 — Statistics */}
                        <div data-pdf-chunk>
                            <SectionHeader n={1} title="Statistics — Population & Case Overview" />
                            <Body>
                                <div className="flex flex-wrap gap-4">
                                    {STAT_FIELDS.map((s) => (
                                        <div key={s.key} className="flex-1 min-w-[140px] bg-gray-50 border border-gray-200 rounded-xl p-4">
                                            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-3 leading-tight min-h-[28px]">
                                                {s.label}
                                            </p>
                                            <p className="text-center text-2xl font-bold text-gray-800">
                                                {(report[s.key] as string) || '0'}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </Body>
                        </div>

                        {/* Section 2 — Readiness Capacities (placeholders, per spec) */}
                        <div data-pdf-chunk>
                            <SectionHeader n={2} title="Readiness Capacities" />
                            <Body>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="h-40 bg-gray-50 border border-dashed border-gray-300 rounded-xl flex items-center justify-center text-sm text-gray-400">
                                        Readiness Assessment Graph
                                    </div>
                                    <div className="h-40 bg-gray-50 border border-dashed border-gray-300 rounded-xl flex items-center justify-center text-sm text-gray-400">
                                        Regional Risk Map
                                    </div>
                                </div>
                            </Body>
                        </div>

                        {/* Section 3 — Recommendations */}
                        <div data-pdf-chunk>
                            <SectionHeader n={3} title="Temporary Recommendations — Implementation Status" />
                            <Body>
                                <div className="flex items-center gap-4 mb-5 flex-wrap">
                                    <span className="text-sm font-semibold text-gray-700">State Party:</span>
                                    <span className="text-sm text-gray-900 font-bold">
                                        {report.selected_country || <span className="text-gray-400 italic">No country selected</span>}
                                    </span>
                                    {riskStyle && (
                                        <span
                                            className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider shadow-sm"
                                            style={{ backgroundColor: riskStyle.bg, color: riskStyle.text }}
                                        >
                                            {riskStyle.label} Risk · Checklist {riskInfo!.checklist}
                                        </span>
                                    )}
                                </div>
                                {checklist.length > 0 ? (
                                    checklist.map((cat) => (
                                        <div key={cat.category} className="mb-5 last:mb-0">
                                            <h4 className="text-xs font-bold text-[#1a2744] uppercase tracking-wider mb-2.5 px-1">
                                                {cat.category}
                                            </h4>
                                            <div className="space-y-1.5">
                                                {cat.items.map((item) => {
                                                    const ans = report.checklist_responses?.[item.key];
                                                    const isYes = ans === 'YES';
                                                    const isNo = ans === 'NO';
                                                    const isNa = ans === 'NA';
                                                    return (
                                                        <div
                                                            key={item.key}
                                                            className={`flex items-start gap-3 px-4 py-2.5 rounded-lg border ${
                                                                isYes
                                                                    ? 'bg-green-50/50 border-green-200'
                                                                    : isNo
                                                                    ? 'bg-red-50/30 border-red-200'
                                                                    : isNa
                                                                    ? 'bg-slate-50 border-slate-200'
                                                                    : 'bg-white border-gray-100'
                                                            }`}
                                                        >
                                                            <p className="flex-1 text-sm text-gray-700 leading-relaxed">{item.text}</p>
                                                            <span
                                                                className={`px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider flex-shrink-0 ${
                                                                    isYes
                                                                        ? 'bg-green-500 text-white'
                                                                        : isNo
                                                                        ? 'bg-red-500 text-white'
                                                                        : isNa
                                                                        ? 'bg-slate-500 text-white'
                                                                        : 'bg-gray-100 text-gray-400'
                                                                }`}
                                                            >
                                                                {isNa ? 'N/A' : (ans || '—')}
                                                            </span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-sm text-gray-400 italic">No country selected — no checklist to display.</p>
                                )}
                            </Body>
                        </div>

                        {/* Section 4 — Action Points */}
                        <div data-pdf-chunk>
                            <SectionHeader n={4} title="Action Points" />
                            <Body>
                                {(report.action_points || []).filter(p => p?.action?.trim()).length === 0 ? (
                                    <p className="text-sm text-gray-400 italic">No action points recorded.</p>
                                ) : (
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="text-left text-xs uppercase tracking-wider text-gray-500 border-b border-gray-200">
                                                <th className="py-2 pr-4 font-bold">Action implemented</th>
                                                <th className="py-2 pl-4 font-bold w-[180px]">Response pillar</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(report.action_points || [])
                                                .filter(p => p?.action?.trim())
                                                .map((p, i) => (
                                                    <tr key={i} className="border-b border-gray-100 last:border-b-0">
                                                        <td className="py-2.5 pr-4 text-gray-800">{p.action}</td>
                                                        <td className="py-2.5 pl-4 text-gray-600">{p.pillar}</td>
                                                    </tr>
                                                ))}
                                        </tbody>
                                    </table>
                                )}
                            </Body>
                        </div>

                        {/* Section 5 — Planned Actions */}
                        <div data-pdf-chunk>
                            <SectionHeader n={5} title="Planned Actions & Deployments" />
                            <Body>
                                <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                                    {report.planned_actions || <span className="text-gray-400 italic">—</span>}
                                </p>
                            </Body>
                        </div>

                        {/* Section 5b — Weekly Highlight */}
                        {(report.weekly_highlights && report.weekly_highlights.length > 0) && (() => {
                            const items = report.weekly_highlights!;
                            const star = items.find((h) => h.is_highlight) || items[0];
                            const others = items.filter((h) => h.id !== star.id);
                            return (
                                <div data-pdf-chunk>
                                    <SectionHeader n="5b" title="Weekly Highlight — Photos" />
                                    <Body>
                                        <div className="space-y-4">
                                            {/* Featured */}
                                            <div className="relative rounded-xl overflow-hidden border border-amber-200">
                                                <span className="absolute top-3 left-3 z-10 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500 text-white text-[10px] font-black uppercase tracking-wider shadow">
                                                    Highlight of the Week
                                                </span>
                                                <img
                                                    src={star.image_data}
                                                    alt={star.caption || 'Highlight'}
                                                    className="w-full max-h-[420px] object-cover bg-gray-100"
                                                />
                                                <div className="px-4 py-3 bg-white flex items-start justify-between gap-3">
                                                    <p className="text-sm font-semibold text-gray-800">
                                                        {star.caption || <span className="text-gray-400 italic">No caption</span>}
                                                    </p>
                                                    {star.date && (
                                                        <span className="text-xs text-gray-500 whitespace-nowrap">{star.date}</span>
                                                    )}
                                                </div>
                                            </div>
                                            {/* Thumbnails */}
                                            {others.length > 0 && (
                                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                                    {others.map((it) => (
                                                        <div key={it.id} className="rounded-lg overflow-hidden border border-gray-200">
                                                            <img
                                                                src={it.image_data}
                                                                alt={it.caption || 'Highlight photo'}
                                                                className="w-full h-32 object-cover bg-gray-100"
                                                            />
                                                            <div className="px-3 py-2 bg-white">
                                                                <p className="text-xs font-medium text-gray-700 truncate">
                                                                    {it.caption || '—'}
                                                                </p>
                                                                {it.date && (
                                                                    <p className="text-[10px] text-gray-400 mt-0.5">{it.date}</p>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </Body>
                                </div>
                            );
                        })()}

                        {/* Section 6 — Key Challenges */}
                        <div data-pdf-chunk>
                            <SectionHeader n={6} title="Key Challenges" />
                            <Body>
                                <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                                    {report.key_challenges || <span className="text-gray-400 italic">—</span>}
                                </p>
                            </Body>
                        </div>
                    </div>
                </div>
            </div>
        );
};

export default SitrepViewPage;
