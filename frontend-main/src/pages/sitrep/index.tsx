/**
 * SITREP Admin Dashboard
 * Accessed via /sitrep (authenticated, role-gated)
 *
 * Features:
 *  - List all SITREP reports with completion %
 *  - Generate new SITREP links (modal)
 *  - Expand/collapse report details
 *  - Copy link, reactivate, delete
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
    Plus, RefreshCcw, Copy, Trash2, ChevronDown, ChevronUp,
    Link2, CheckCircle2, FileText, RotateCcw, X,
    Eye, Download,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ApiConsumer } from '@/lib/api';
import { generateSitrepPdf, type SitrepReport } from './utils/generateSitrepPdf';
import { useTheme } from '@/contexts/ThemeContext';

interface LinkInfo {
    token: string;
    expires_at: string;
    is_expired: boolean;
    is_active: boolean;
}

interface ReportItem {
    id: number;
    sitrep_number: string;
    reporting_period: string;
    selected_country: string;
    created_on: string;
    updated_on: string;
    filled_fields: number;
    total_fields: number;
    completion_pct: number;
    recent_edits: Array<{ field: string; by: string; at: string }>;
    link_info: LinkInfo | null;
}

// ── Generate Link Modal ──────────────────────────────────────────

const GenerateLinkModal: React.FC<{
    onClose: () => void;
    onGenerate: (data: any) => Promise<void>;
}> = ({ onClose, onGenerate }) => {
    const [sitrepNumber, setSitrepNumber] = useState('');
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');
    const [triggeringEvent, setTriggeringEvent] = useState('EVD outbreak declared — Bundibugyo ebolavirus (DRC / Uganda)');
    const [expiryHours, setExpiryHours] = useState(24);
    const [loading, setLoading] = useState(false);

    const formatPeriod = (from: string, to: string) => {
        if (!from && !to) return '';
        const fmt = (d: string) => {
            const date = new Date(d + 'T00:00:00');
            return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
        };
        if (from && to) return `${fmt(from)} – ${fmt(to)}`;
        if (from) return fmt(from);
        return fmt(to);
    };

    const handleGenerate = async () => {
        if (!sitrepNumber.trim()) return;
        setLoading(true);
        try {
            await onGenerate({
                sitrep_number: sitrepNumber.trim(),
                reporting_period: formatPeriod(fromDate, toDate),
                triggering_event: triggeringEvent,
                expires_in_hours: expiryHours,
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-[#1a2744] to-[#2c3e6b]">
                    <h3 className="text-white font-bold text-base flex items-center gap-2">
                        <Link2 className="w-5 h-5" />
                        Generate SITREP Link
                    </h3>
                    <button onClick={onClose} className="text-white/60 hover:text-white transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="p-6 space-y-4">
                    <div>
                        <label className="text-sm font-semibold text-gray-700 mb-1.5 block">SITREP Number *</label>
                        <input
                            type="text"
                            value={sitrepNumber}
                            onChange={(e) => setSitrepNumber(e.target.value)}
                            placeholder="e.g. No. 001"
                            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-[#4a9fd8]"
                        />
                    </div>
                    <div>
                        <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Reporting Period</label>
                        <div className="flex items-center gap-3">
                            <div className="flex-1">
                                <label className="text-xs text-gray-400 mb-1 block">From</label>
                                <input
                                    type="date"
                                    value={fromDate}
                                    onChange={(e) => setFromDate(e.target.value)}
                                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-[#4a9fd8] cursor-pointer"
                                />
                            </div>
                            <span className="text-gray-400 font-bold mt-5">–</span>
                            <div className="flex-1">
                                <label className="text-xs text-gray-400 mb-1 block">To</label>
                                <input
                                    type="date"
                                    value={toDate}
                                    onChange={(e) => setToDate(e.target.value)}
                                    min={fromDate}
                                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-[#4a9fd8] cursor-pointer"
                                />
                            </div>
                        </div>
                        {fromDate && toDate && (
                            <p className="text-xs text-[#4a9fd8] mt-1.5 font-medium">
                                {formatPeriod(fromDate, toDate)}
                            </p>
                        )}
                    </div>
                    <div>
                        <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Triggering Event</label>
                        <input
                            type="text"
                            value={triggeringEvent}
                            onChange={(e) => setTriggeringEvent(e.target.value)}
                            placeholder="EVD outbreak..."
                            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-[#4a9fd8]"
                        />
                    </div>
                    <div>
                        <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Link Expiry</label>
                        <select
                            value={expiryHours}
                            onChange={(e) => setExpiryHours(Number(e.target.value))}
                            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-[#4a9fd8] cursor-pointer"
                        >
                            <option value={1}>1 hour</option>
                            <option value={4}>4 hours</option>
                            <option value={8}>8 hours</option>
                            <option value={24}>24 hours</option>
                            <option value={48}>48 hours</option>
                            <option value={72}>72 hours</option>
                        </select>
                    </div>
                </div>
                <div className="px-6 py-4 bg-gray-50 flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800">
                        Cancel
                    </button>
                    <button
                        onClick={handleGenerate}
                        disabled={!sitrepNumber.trim() || loading}
                        className="px-5 py-2.5 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-all"
                    >
                        {loading ? 'Generating...' : 'Generate & Copy Link'}
                    </button>
                </div>
            </div>
        </div>
    );
};


// ── Report Row ───────────────────────────────────────────────────

const ReportRow: React.FC<{
    report: ReportItem;
    isLight: boolean;
    onDelete: (id: number) => void;
    onReactivate: (id: number) => void;
    onCopyLink: (token: string) => void;
    onView: (id: number) => void;
    onDownloadPdf: (id: number) => Promise<void> | void;
    downloadingId: number | null;
}> = ({ report, isLight, onDelete, onReactivate, onCopyLink, onView, onDownloadPdf, downloadingId }) => {
    const [expanded, setExpanded] = useState(false);
    const isDownloading = downloadingId === report.id;

    const linkStatus = report.link_info
        ? report.link_info.is_expired
            ? 'expired'
            : report.link_info.is_active
                ? 'active'
                : 'inactive'
        : 'none';

    const statusConfig: Record<string, { color: string; bg: string; text: string }> = {
        active: { color: isLight ? 'text-green-700' : 'text-green-400', bg: isLight ? 'bg-green-100' : 'bg-green-500/20', text: 'Active' },
        expired: { color: isLight ? 'text-amber-700' : 'text-amber-400', bg: isLight ? 'bg-amber-100' : 'bg-amber-500/20', text: 'Expired' },
        inactive: { color: isLight ? 'text-gray-500' : 'text-gray-400', bg: isLight ? 'bg-gray-100' : 'bg-white/5', text: 'Inactive' },
        none: { color: isLight ? 'text-gray-400' : 'text-gray-500', bg: isLight ? 'bg-gray-50' : 'bg-white/5', text: 'No Link' },
    };
    const st = statusConfig[linkStatus];

    return (
        <div className={`rounded-2xl border overflow-hidden mb-3 transition-all duration-200
            ${isLight
                ? 'bg-white border-gray-200 shadow-sm hover:shadow-md'
                : 'bg-white/5 border-white/10 hover:bg-white/[0.07]'
            }`}>
            <div className="flex items-center justify-between px-5 py-4 cursor-pointer" onClick={() => setExpanded(!expanded)}>
                <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={`p-2 rounded-xl ${isLight ? 'bg-blue-100' : 'bg-blue-500/20'}`}>
                        <FileText className={`w-4 h-4 ${isLight ? 'text-blue-600' : 'text-blue-400'}`} />
                    </div>
                    <div className="min-w-0">
                        <h4 className={`text-sm font-bold truncate ${isLight ? 'text-gray-900' : 'text-white'}`}>
                            SITREP {report.sitrep_number}
                        </h4>
                        <p className={`text-xs truncate ${isLight ? 'text-gray-500' : 'text-gray-400'}`}>
                            {report.reporting_period || 'No period set'} · {report.selected_country || 'No country'}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="hidden md:flex items-center gap-2">
                        <div className={`w-24 h-2 rounded-full overflow-hidden ${isLight ? 'bg-gray-100' : 'bg-white/10'}`}>
                            <div className="h-full bg-[#4a9fd8] rounded-full transition-all" style={{ width: `${report.completion_pct}%` }} />
                        </div>
                        <span className={`text-xs font-bold w-8 ${isLight ? 'text-gray-500' : 'text-gray-400'}`}>{report.completion_pct}%</span>
                    </div>
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${st.bg} ${st.color}`}>{st.text}</span>
                    <button
                        onClick={(e) => { e.stopPropagation(); onView(report.id); }}
                        title="View report"
                        className={`p-2 rounded-lg transition-colors ${
                            isLight
                                ? 'text-gray-500 hover:text-blue-600 hover:bg-blue-50'
                                : 'text-gray-400 hover:text-blue-400 hover:bg-blue-500/10'
                        }`}
                    >
                        <Eye className="w-4 h-4" />
                    </button>
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); if (!isDownloading) onDownloadPdf(report.id); }}
                        title={isDownloading ? 'Preparing PDF…' : 'Download PDF'}
                        disabled={isDownloading}
                        className={`p-2 rounded-lg transition-colors disabled:opacity-60 ${
                            isLight
                                ? 'text-gray-500 hover:text-emerald-600 hover:bg-emerald-50'
                                : 'text-gray-400 hover:text-emerald-400 hover:bg-emerald-500/10'
                        }`}
                    >
                        {isDownloading
                            ? <RefreshCcw className="w-4 h-4 animate-spin" />
                            : <Download className="w-4 h-4" />}
                    </button>
                    {expanded ? <ChevronUp className={`w-4 h-4 ${isLight ? 'text-gray-400' : 'text-gray-500'}`} /> : <ChevronDown className={`w-4 h-4 ${isLight ? 'text-gray-400' : 'text-gray-500'}`} />}
                </div>
            </div>

            {expanded && (
                <div className={`px-5 pb-4 pt-1 border-t ${isLight ? 'border-gray-100' : 'border-white/5'}`}>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                        {[
                            { label: 'Fields Filled', value: `${report.filled_fields}/${report.total_fields}` },
                            { label: 'Country', value: report.selected_country || '—' },
                            { label: 'Created', value: new Date(report.created_on).toLocaleDateString() },
                            { label: 'Last Update', value: new Date(report.updated_on).toLocaleDateString() },
                        ].map((item, i) => (
                            <div key={i} className={`rounded-xl p-3 ${isLight ? 'bg-gray-50' : 'bg-white/5'}`}>
                                <p className={`text-[10px] font-bold uppercase ${isLight ? 'text-gray-400' : 'text-gray-500'}`}>{item.label}</p>
                                <p className={`text-sm font-bold truncate mt-0.5 ${isLight ? 'text-gray-800' : 'text-white'}`}>{item.value}</p>
                            </div>
                        ))}
                    </div>
                    {report.recent_edits?.length > 0 && (
                        <div className="mb-4">
                            <p className={`text-[10px] font-bold uppercase mb-2 ${isLight ? 'text-gray-400' : 'text-gray-500'}`}>Recent Edits</p>
                            <div className="space-y-1">
                                {report.recent_edits.slice(0, 5).map((edit, i) => (
                                    <div key={i} className={`flex items-center gap-2 text-xs ${isLight ? 'text-gray-500' : 'text-gray-400'}`}>
                                        <span className={`font-medium ${isLight ? 'text-gray-700' : 'text-gray-300'}`}>{edit.field}</span>
                                        <span>by {edit.by}</span>
                                        <span className={isLight ? 'text-gray-300' : 'text-gray-600'}>·</span>
                                        <span>{edit.at}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    <div className="flex items-center gap-2 flex-wrap">
                        <button onClick={() => onView(report.id)} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 text-white text-xs font-bold rounded-lg hover:bg-slate-800 transition-colors">
                            <Eye className="w-3.5 h-3.5" /> View
                        </button>
                        <button
                            type="button"
                            onClick={() => { if (!isDownloading) onDownloadPdf(report.id); }}
                            disabled={isDownloading}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-60"
                        >
                            {isDownloading
                                ? <><RefreshCcw className="w-3.5 h-3.5 animate-spin" /> Preparing…</>
                                : <><Download className="w-3.5 h-3.5" /> Download PDF</>}
                        </button>
                        {report.link_info?.token && (
                            <button onClick={() => onCopyLink(report.link_info!.token)} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition-colors">
                                <Copy className="w-3.5 h-3.5" /> Copy Link
                            </button>
                        )}
                        <button onClick={() => onReactivate(report.id)} className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${isLight ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' : 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30'}`}>
                            <RotateCcw className="w-3.5 h-3.5" /> Reactivate
                        </button>
                        <button onClick={() => { if (confirm('Delete this SITREP report?')) onDelete(report.id); }} className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${isLight ? 'bg-red-50 text-red-500 hover:bg-red-100' : 'bg-red-500/10 text-red-400 hover:bg-red-500/20'}`}>
                            <Trash2 className="w-3.5 h-3.5" /> Delete
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};


// ── Main Dashboard ───────────────────────────────────────────────

const SitrepDashboard: React.FC = () => {
    const { theme } = useTheme();
    const isLight = theme === 'light';
    const navigate = useNavigate();

    const [reports, setReports] = useState<ReportItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [copiedToken, setCopiedToken] = useState('');
    const [downloadingId, setDownloadingId] = useState<number | null>(null);

    const fetchReports = useCallback(async () => {
        setLoading(true);
        try {
            const res = await ApiConsumer.get('/sitrep/reports-list');
            setReports(res?.data || []);
        } catch (err) {
            console.error('Failed to load SITREP reports:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchReports(); }, [fetchReports]);

    const handleGenerate = useCallback(async (data: any) => {
        try {
            const res = await ApiConsumer.post('/sitrep/generate-link', data);
            const token = res?.data?.token;
            if (token) {
                const link = `${window.location.origin}/sitrep-form?token=${token}`;
                navigator.clipboard.writeText(link);
                setCopiedToken(token);
                setTimeout(() => setCopiedToken(''), 3000);
            }
            setShowModal(false);
            fetchReports();
        } catch (err: any) {
            alert(err?.message || 'Failed to generate link');
        }
    }, [fetchReports]);

    const handleDelete = useCallback(async (id: number) => {
        try {
            await ApiConsumer.delete(`/sitrep/report-delete/${id}`);
            fetchReports();
        } catch (err: any) {
            alert(err?.message || 'Failed to delete');
        }
    }, [fetchReports]);

    const handleReactivate = useCallback(async (id: number) => {
        try {
            const res = await ApiConsumer.post(`/sitrep/reactivate-link/${id}`, { expires_in_hours: 24 });
            const token = res?.data?.token;
            if (token) {
                const link = `${window.location.origin}/sitrep-form?token=${token}`;
                navigator.clipboard.writeText(link);
                setCopiedToken(token);
                setTimeout(() => setCopiedToken(''), 3000);
            }
            fetchReports();
        } catch (err: any) {
            alert(err?.message || 'Failed to reactivate');
        }
    }, [fetchReports]);

    const handleCopyLink = useCallback((token: string) => {
        const link = `${window.location.origin}/sitrep-form?token=${token}`;
        navigator.clipboard.writeText(link);
        setCopiedToken(token);
        setTimeout(() => setCopiedToken(''), 3000);
    }, []);

    const handleView = useCallback((id: number) => {
        navigate(`/sitrep/view/${id}`);
    }, [navigate]);

    const handleDownloadPdf = useCallback(async (id: number) => {
        // Build the PDF right here on the dashboard — no new tab, no navigation.
        // The generator is a pure jsPDF native build that doesn't need any DOM.
        setDownloadingId(id);
        try {
            const res = await ApiConsumer.get(`/sitrep/report-detail/${id}`);
            const reportData = res?.data as SitrepReport | undefined;
            if (!reportData) throw new Error('Report not found');
            await generateSitrepPdf(reportData);
        } catch (err: any) {
            console.error('PDF export failed', err);
            alert(err?.message || 'Failed to generate PDF.');
        } finally {
            setDownloadingId(null);
        }
    }, []);

    const totalReports = reports.length;
    const avgCompletion = totalReports ? Math.round(reports.reduce((a, r) => a + r.completion_pct, 0) / totalReports) : 0;
    const activeLinks = reports.filter(r => r.link_info?.is_active && !r.link_info?.is_expired).length;

    return (
        <div className="p-6 md:p-8 max-w-[1100px] mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
                <div>
                    <h1 className={`text-2xl font-black tracking-tight ${isLight ? 'text-gray-900' : 'text-white'}`}>SITREP Reports</h1>
                    <p className={`text-sm mt-1 ${isLight ? 'text-gray-500' : 'text-gray-400'}`}>Ebola Virus Disease — Preparedness &amp; Readiness</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={fetchReports}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200
                            ${isLight
                                ? 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200'
                                : 'bg-white/5 text-gray-400 hover:bg-white/10 border border-white/10'
                            } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                        title="Refresh"
                    >
                        <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                    <button
                        onClick={() => setShowModal(true)}
                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg active:scale-95"
                    >
                        <Plus className="w-4 h-4" />
                        Generate Link
                    </button>
                </div>
            </div>

            {/* Stats cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                {[
                    { label: 'Total Reports', value: totalReports, icon: FileText, color: isLight ? 'text-blue-600 bg-blue-100' : 'text-blue-400 bg-blue-500/20' },
                    { label: 'Avg Completion', value: `${avgCompletion}%`, icon: CheckCircle2, color: isLight ? 'text-green-600 bg-green-100' : 'text-green-400 bg-green-500/20' },
                    { label: 'Active Links', value: activeLinks, icon: Link2, color: isLight ? 'text-purple-600 bg-purple-100' : 'text-purple-400 bg-purple-500/20' },
                ].map((stat, i) => (
                    <div key={i} className={`p-5 rounded-2xl border transition-all duration-200
                        ${isLight
                            ? 'bg-white border-gray-200 shadow-sm hover:shadow-md'
                            : 'bg-white/5 border-white/10 hover:bg-white/[0.07]'
                        }`}>
                        <div className="flex items-center justify-between">
                            <div>
                                <p className={`text-xs font-semibold uppercase tracking-wider ${isLight ? 'text-gray-400' : 'text-gray-500'}`}>
                                    {stat.label}
                                </p>
                                <p className={`text-3xl font-black mt-1 ${isLight ? 'text-gray-900' : 'text-white'}`}>{stat.value}</p>
                            </div>
                            <div className={`p-3 rounded-xl ${stat.color}`}>
                                <stat.icon className="w-5 h-5" />
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Copied toast */}
            {copiedToken && (
                <div className="fixed top-4 right-4 z-50 bg-green-600 text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-xl flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    Link copied to clipboard!
                </div>
            )}

            {/* Report list */}
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <div className="flex flex-col items-center gap-4">
                        <RefreshCcw className={`w-8 h-8 animate-spin ${isLight ? 'text-blue-500' : 'text-blue-400'}`} />
                        <span className={`text-sm ${isLight ? 'text-gray-500' : 'text-gray-400'}`}>Loading reports...</span>
                    </div>
                </div>
            ) : reports.length === 0 ? (
                <div className="flex items-center justify-center py-20">
                    <div className="flex flex-col items-center gap-4 text-center">
                        <div className={`p-4 rounded-full ${isLight ? 'bg-gray-100' : 'bg-white/5'}`}>
                            <FileText className={`w-8 h-8 ${isLight ? 'text-gray-400' : 'text-gray-500'}`} />
                        </div>
                        <div>
                            <p className={`text-lg font-semibold ${isLight ? 'text-gray-700' : 'text-gray-300'}`}>No SITREP reports yet</p>
                            <p className={`text-sm mt-1 ${isLight ? 'text-gray-500' : 'text-gray-400'}`}>
                                Generate a link to create the first one.
                            </p>
                        </div>
                    </div>
                </div>
            ) : (
                <div>
                    {reports.map((report) => (
                        <ReportRow
                            key={report.id}
                            report={report}
                            isLight={isLight}
                            onDelete={handleDelete}
                            onReactivate={handleReactivate}
                            onCopyLink={handleCopyLink}
                            onView={handleView}
                            onDownloadPdf={handleDownloadPdf}
                            downloadingId={downloadingId}
                        />
                    ))}
                </div>
            )}

            {/* Generate modal */}
            {showModal && (
                <GenerateLinkModal
                    onClose={() => setShowModal(false)}
                    onGenerate={handleGenerate}
                />
            )}
        </div>
    );
};

export default SitrepDashboard;
