import React, { useState, useEffect, useMemo } from 'react';
import {
    ClipboardList, Link2, Copy, Check, ChevronDown, ChevronUp, FileText, RefreshCw,
    CheckCircle2, Clock, X, Loader2, Download, Trash2, RotateCcw, MoreVertical
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthProvider';
import { useToast } from '@/contexts/ToastProvider';
import { useTheme } from '@/contexts/ThemeContext';
import { ApiConsumer } from '@/lib/api';
// import autoTable from 'jspdf-autotable';

interface WeeklyReportEdit {
    field?: string;
    user?: string;
    timestamp?: string;
}

interface WeeklyReportLinkInfo {
    token?: string;
    expires_at?: string;
    is_active?: boolean;
    is_expired?: boolean;
}

/** All known fields of a weekly readiness report row. Unknown extras are
 *  permitted because the form's section payload is dynamic on the server. */
interface WeeklyReport {
    id: number;
    week_range: string;
    completion_pct: number;
    week_start?: string;
    week_end?: string;
    created_at?: string;
    created_on?: string;
    updated_at?: string;
    featured_achievement?: string;
    key_figures?: string;
    filled_fields?: number;
    total_fields?: number;
    recent_edits?: WeeklyReportEdit[];
    link_info?: WeeklyReportLinkInfo;
    [field: string]: unknown;
}

interface WeeklyReportListResponse {
    data: WeeklyReport[];
}

interface GenerateLinkRequest {
    week_range: string;
    expires_in_hours: number;
    featured_achievement?: string;
    key_figures?: string;
}

interface GenerateLinkResponse {
    data: { token: string; expires_at: string; week_range: string };
}

const FIELD_LABELS: Record<string, string> = {
    featured_achievement: 'Featured Achievement',
    key_figures: 'Key Figures in this Week',
    health_security_governance: 'Health Security Governance',
    health_security_financing: 'Health Security Financing',
    threats_risks_management: 'Threats & Risks Management',
    ihrme: 'IHR M&E',
    ipc: 'IPC',
    readiness: 'Readiness',
    naphs: 'NAPHS',
    community_protection: 'Community Protection',
    workforce_training: 'Workforce and Training',
    pandemic_influenza: 'Pandemic Influenza',
    vaccines_research: 'Vaccines and Research',
    diseases_under_elimination: 'Diseases under Elimination',
    one_health: 'One Health',
    innovative_projects: 'Innovative Projects',
    hedrm: 'HEDRM',
    osl: 'Operations Support and Logistics (OSL)',
};

import AiChatPopup from './components/AiChatPopup';
import { generateReportPdf } from './utils/pdfGenerator';

// ── Main Page ──
export default function PreparednessPage() {
    const { user } = useAuth();
    const { showToast } = useToast();
    const { theme } = useTheme();
    const isLight = theme === 'light';

    const [copiedLink, setCopiedLink] = useState<string | null>(null);
    const [generatingLink, setGeneratingLink] = useState(false);
    const [generatedLink, setGeneratedLink] = useState<{ url: string; expiresAt: string; weekRange: string } | null>(null);
    const [aiOpen, setAiOpen] = useState(false);
    const [linkModalOpen, setLinkModalOpen] = useState(false);
    const [weeklyReports, setWeeklyReports] = useState<WeeklyReport[]>([]);
    const [weeklyLoading, setWeeklyLoading] = useState(true);
    const [expandedWeekly, setExpandedWeekly] = useState<number | null>(null);
    const [prefillAchievement, setPrefillAchievement] = useState('');
    const [prefillKeyFigures, setPrefillKeyFigures] = useState('');
    const [deletingId, setDeletingId] = useState<number | null>(null);
    const [reactivatingId, setReactivatingId] = useState<number | null>(null);
    const [openDropdownId, setOpenDropdownId] = useState<number | null>(null);
    const [reactivateModalOpen, setReactivateModalOpen] = useState(false);
    const [reactivateHours, setReactivateHours] = useState(24);
    const [selectedReactivateId, setSelectedReactivateId] = useState<number | null>(null);

    // Helper: get Monday and Friday of current week as ISO strings
    const getCurrentWeekDates = () => {
        const now = new Date();
        const day = now.getDay(); // 0=Sun
        const diffToMon = day === 0 ? -6 : 1 - day;
        const monday = new Date(now);
        monday.setDate(now.getDate() + diffToMon);
        const friday = new Date(monday);
        friday.setDate(monday.getDate() + 4);
        return {
            monday: monday.toISOString().split('T')[0],
            friday: friday.toISOString().split('T')[0],
        };
    };
    const weekDates = getCurrentWeekDates();
    const [linkStartDate, setLinkStartDate] = useState(weekDates.monday);
    const [linkEndDate, setLinkEndDate] = useState(weekDates.friday);
    const [linkExpiryHours, setLinkExpiryHours] = useState(24);

    const formatWeekRange = (start: string, end: string) => {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const s = new Date(start + 'T00:00:00');
        const e = new Date(end + 'T00:00:00');
        const sMonth = months[s.getMonth()];
        const eMonth = months[e.getMonth()];
        if (sMonth === eMonth) return `${sMonth} ${s.getDate()}\u2013${e.getDate()}`;
        return `${sMonth} ${s.getDate()} \u2013 ${eMonth} ${e.getDate()}`;
    };

    const fetchWeeklyReports = async () => {
        setWeeklyLoading(true);
        try {
            const res = await ApiConsumer.get<WeeklyReportListResponse>('/readiness/weekly-reports-list');
            setWeeklyReports(res.data || []);
        } catch {
            setWeeklyReports([]);
        } finally {
            setWeeklyLoading(false);
        }
    };

    useEffect(() => {
        fetchWeeklyReports();
    }, []);

    useEffect(() => {
        const handleClickOutside = () => setOpenDropdownId(null);
        window.addEventListener('click', handleClickOutside);
        return () => window.removeEventListener('click', handleClickOutside);
    }, []);

    const handleGenerateLink = async () => {
        setGeneratingLink(true);
        try {
            const weekRange = formatWeekRange(linkStartDate, linkEndDate);
            const body: GenerateLinkRequest = { week_range: weekRange, expires_in_hours: linkExpiryHours };
            if (prefillAchievement.trim()) body.featured_achievement = prefillAchievement.trim();
            if (prefillKeyFigures.trim()) body.key_figures = prefillKeyFigures.trim();
            const res = await ApiConsumer.post<GenerateLinkResponse>('/readiness/generate-link', body);
            const data = res.data;
            const origin = window.location.origin;
            const url = `${origin}/preparedness-form?token=${data.token}`;
            setGeneratedLink({ url, expiresAt: data.expires_at, weekRange: data.week_range });
            navigator.clipboard.writeText(url);
            setCopiedLink('generated');
            showToast(`Link generated & copied! Valid for ${linkExpiryHours} hours.`, 'success');
            setTimeout(() => setCopiedLink(null), 3000);
            fetchWeeklyReports();
        } catch (err) {
            showToast(err instanceof Error ? err.message : 'Failed to generate link.', 'error');
        } finally {
            setGeneratingLink(false);
        }
    };

    const handleCopyReportLink = (wr: WeeklyReport) => {
        if (!wr.link_info?.token) {
            showToast('No active link found for this report.', 'error');
            return;
        }
        const origin = window.location.origin;
        const url = `${origin}/preparedness-form?token=${wr.link_info.token}`;
        navigator.clipboard.writeText(url);
        showToast('Link copied to clipboard!', 'success');
        setOpenDropdownId(null);
    };

    const handleReactivateLink = async (id: number, hours: number = 24) => {
        setReactivatingId(id);
        try {
            await ApiConsumer.post(`/readiness/reactivate-link/${id}`, { expires_in_hours: hours });
            showToast(`Link reactivated for ${hours} hours!`, 'success');
            fetchWeeklyReports();
        } catch (err) {
            showToast(err instanceof Error ? err.message : 'Failed to reactivate link.', 'error');
        } finally {
            setReactivatingId(null);
            setOpenDropdownId(null);
        }
    };

    const handleDeleteReport = async (id: number) => {
        if (!confirm('Are you sure you want to delete this report? This action can be undone by an administrator.')) return;
        setDeletingId(id);
        try {
            await ApiConsumer.delete(`/readiness/weekly-report-delete/${id}`);
            showToast('Report deleted successfully.', 'success');
            setWeeklyReports(prev => prev.filter(r => r.id !== id));
            if (expandedWeekly === id) setExpandedWeekly(null);
        } catch (err) {
            showToast(err instanceof Error ? err.message : 'Failed to delete report.', 'error');
        } finally {
            setDeletingId(null);
        }
    };

    const stats = useMemo(() => {
        const total = weeklyReports.length;
        const now = new Date();
        const day = now.getDay();
        const diffToMonday = day === 0 ? -6 : 1 - day;
        const monday = new Date(now);
        monday.setDate(now.getDate() + diffToMonday);
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const monMonth = monthNames[monday.getMonth()];
        const sunMonth = monthNames[sunday.getMonth()];
        const monDay = monday.getDate();
        const sunDay = sunday.getDate();
        const currentWeek = monMonth === sunMonth
            ? `${monMonth} ${monDay}\u2013${sunDay}`
            : `${monMonth} ${monDay} \u2013 ${sunMonth} ${sunDay}`;
        const thisWeekReport = weeklyReports.find(r => r.week_range === currentWeek);
        const completion = thisWeekReport ? thisWeekReport.completion_pct : 0;
        const totalEdits = weeklyReports.reduce((sum: number, r: WeeklyReport) => sum + (r.recent_edits?.length || 0), 0);

        return { total, completion, totalEdits };
    }, [weeklyReports]);

    return (
        <div className={`min-h-screen p-6 md:p-8 ${isLight ? 'text-gray-900' : 'text-white'}`}>
            {/* Header */}
            <div className="mb-8">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <div className={`p-2.5 rounded-xl ${isLight ? 'bg-blue-100' : 'bg-blue-500/20'}`}>
                                <ClipboardList className={`w-6 h-6 ${isLight ? 'text-blue-600' : 'text-blue-400'}`} />
                            </div>
                            <h1 className="text-2xl md:text-3xl font-black tracking-tight">Preparedness Reports</h1>
                        </div>
                        <p className={`text-sm ${isLight ? 'text-gray-500' : 'text-gray-400'}`}>
                            Weekly submission reports from your team members
                        </p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <button
                            onClick={() => setAiOpen(true)}
                            className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200
                                ${isLight
                                    ? 'bg-[#1a2332] text-[#6ec1e4] shadow-lg shadow-gray-300 hover:shadow-xl hover:translate-y-[-1px]'
                                    : 'bg-[#1a2332] text-[#6ec1e4] border border-[#2a3a4e] shadow-lg shadow-black/20 hover:shadow-xl hover:translate-y-[-1px]'
                                }`}
                        >
                            <img src="/assets/logo-chat.png" alt="" className="w-6 h-6 object-contain" />
                            Ask WHO
                        </button>

                        <button
                            onClick={() => { setGeneratedLink(null); setLinkModalOpen(true); }}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200
                                    ${isLight
                                    ? 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200'
                                    : 'bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border border-blue-500/20'
                                }`}
                        >
                            <Link2 className="w-4 h-4" />
                            Generate Weekly Link
                        </button>
                        <button
                            onClick={fetchWeeklyReports}
                            disabled={weeklyLoading}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200
                                ${isLight
                                    ? 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200'
                                    : 'bg-white/5 text-gray-400 hover:bg-white/10 border border-white/10'
                                } ${weeklyLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            <RefreshCw className={`w-4 h-4 ${weeklyLoading ? 'animate-spin' : ''}`} />
                            Refresh
                        </button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                {[
                    { label: 'Weekly Reports', value: stats.total, icon: FileText, color: isLight ? 'text-blue-600 bg-blue-100' : 'text-blue-400 bg-blue-500/20' },
                    { label: 'This Week Completion', value: `${stats.completion}%`, icon: CheckCircle2, color: isLight ? 'text-green-600 bg-green-100' : 'text-green-400 bg-green-500/20' },
                    { label: 'Total Edits', value: stats.totalEdits, icon: ClipboardList, color: isLight ? 'text-purple-600 bg-purple-100' : 'text-purple-400 bg-purple-500/20' },
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
                                <p className="text-3xl font-black mt-1">{stat.value}</p>
                            </div>
                            <div className={`p-3 rounded-xl ${stat.color}`}>
                                <stat.icon className="w-5 h-5" />
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div>
                {weeklyLoading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="flex flex-col items-center gap-4">
                            <RefreshCw className={`w-8 h-8 animate-spin ${isLight ? 'text-blue-500' : 'text-blue-400'}`} />
                            <span className={`text-sm ${isLight ? 'text-gray-500' : 'text-gray-400'}`}>Loading weekly reports...</span>
                        </div>
                    </div>
                ) : weeklyReports.length === 0 ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="flex flex-col items-center gap-4 text-center">
                            <div className={`p-4 rounded-full ${isLight ? 'bg-gray-100' : 'bg-white/5'}`}>
                                <ClipboardList className={`w-8 h-8 ${isLight ? 'text-gray-400' : 'text-gray-500'}`} />
                            </div>
                            <div>
                                <p className={`text-lg font-semibold ${isLight ? 'text-gray-700' : 'text-gray-300'}`}>No weekly reports yet</p>
                                <p className={`text-sm mt-1 ${isLight ? 'text-gray-500' : 'text-gray-400'}`}>
                                    Generate a link and share it with your Suppliers to get started.
                                </p>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {weeklyReports.map((wr: WeeklyReport) => {
                            const isExp = expandedWeekly === wr.id;
                            return (
                                <div
                                    key={wr.id}
                                    className={`rounded-2xl border transition-all duration-300
                                            ${isLight
                                            ? 'bg-white border-gray-200 shadow-sm hover:shadow-md'
                                            : 'bg-white/5 border-white/10 hover:bg-white/[0.07]'
                                        } 
                                        ${isExp ? (isLight ? 'ring-2 ring-blue-200' : 'ring-1 ring-blue-500/30') : ''}
                                        ${openDropdownId === wr.id ? 'z-50' : 'z-0'}`}
                                >
                                    <button
                                        onClick={() => setExpandedWeekly(isExp ? null : wr.id)}
                                        className="w-full flex items-center justify-between p-5 text-left"
                                    >
                                        <div className="flex items-center gap-4 min-w-0">
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0
                                                    ${isLight ? 'bg-indigo-100' : 'bg-indigo-500/20'}`}>
                                                <FileText className={`w-5 h-5 ${isLight ? 'text-indigo-600' : 'text-indigo-400'}`} />
                                            </div>
                                            <div className="min-w-0">
                                                <p className={`text-sm font-bold truncate ${isLight ? 'text-gray-900' : 'text-white'}`}>
                                                    Week of {wr.week_range}
                                                </p>
                                                <p className={`text-xs ${isLight ? 'text-gray-500' : 'text-gray-400'}`}>
                                                    Collaborative report · {wr.filled_fields}/{wr.total_fields} fields filled
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3 flex-shrink-0">
                                            {/* Completion badge */}
                                            <div className={`hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold
                                                    ${wr.completion_pct >= 80
                                                    ? (isLight ? 'bg-green-50 text-green-700' : 'bg-green-500/20 text-green-400')
                                                    : wr.completion_pct >= 40
                                                        ? (isLight ? 'bg-amber-50 text-amber-700' : 'bg-amber-500/20 text-amber-400')
                                                        : (isLight ? 'bg-gray-100 text-gray-500' : 'bg-white/5 text-gray-400')
                                                }`}
                                            >
                                                <div className="w-16 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full rounded-full transition-all ${wr.completion_pct >= 80 ? 'bg-green-500'
                                                            : wr.completion_pct >= 40 ? 'bg-amber-500'
                                                                : 'bg-gray-400'
                                                            }`}
                                                        style={{ width: `${wr.completion_pct}%` }}
                                                    />
                                                </div>
                                                {wr.completion_pct}%
                                            </div>
                                            {/* Link status */}
                                            {wr.link_info && (
                                                <div className={`hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
                                                        ${!wr.link_info.is_active
                                                        ? (isLight ? 'bg-gray-100 text-gray-500' : 'bg-white/5 text-gray-400')
                                                        : wr.link_info.is_expired
                                                            ? (isLight ? 'bg-red-50 text-red-600' : 'bg-red-500/20 text-red-400')
                                                            : (isLight ? 'bg-green-50 text-green-700' : 'bg-green-500/20 text-green-400')
                                                    }`}
                                                >
                                                    {!wr.link_info.is_active ? '⚪ Deactivated' : wr.link_info.is_expired ? '⏰ Expired' : '🟢 Active'}
                                                </div>
                                            )}
                                            <div className={`hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs
                                                    ${isLight ? 'text-gray-400' : 'text-gray-500'}`}>
                                                <Clock className="w-3.5 h-3.5" />
                                                {new Date(wr.created_on ?? '').toLocaleDateString()}
                                            </div>
                                            {/* Link Actions */}
                                            <div className="flex items-center gap-1">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleCopyReportLink(wr); }}
                                                    className={`p-1.5 rounded-lg transition-all duration-200
                                                        ${isLight
                                                            ? 'text-gray-400 hover:text-blue-600 hover:bg-blue-50'
                                                            : 'text-gray-500 hover:text-blue-400 hover:bg-blue-500/10'
                                                        }`}
                                                    title="Copy report link"
                                                >
                                                    <Copy className="w-4 h-4" />
                                                </button>

                                                <div className="relative">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); setOpenDropdownId(openDropdownId === wr.id ? null : wr.id); }}
                                                        className={`p-1.5 rounded-lg transition-all duration-200
                                                            ${isLight
                                                                ? 'text-gray-400 hover:text-gray-900 hover:bg-gray-100'
                                                                : 'text-gray-500 hover:text-white hover:bg-white/10'
                                                            }`}
                                                        title="More actions"
                                                    >
                                                        <MoreVertical className="w-4 h-4" />
                                                    </button>

                                                    {openDropdownId === wr.id && (
                                                        <div
                                                            className={`absolute right-0 top-full mt-1 w-48 rounded-xl shadow-2xl z-20 overflow-hidden border animate-in fade-in zoom-in duration-200
                                                            ${isLight ? 'bg-white border-gray-100' : 'bg-[#1a2332] border-white/5'}`}
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handleCopyReportLink(wr); }}
                                                                className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left transition-colors
                                                                    ${isLight ? 'hover:bg-gray-50 text-gray-700' : 'hover:bg-white/5 text-gray-300'}`}
                                                            >
                                                                <Copy size={16} />
                                                                Copy Link
                                                            </button>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setSelectedReactivateId(wr.id);
                                                                    setReactivateModalOpen(true);
                                                                    setOpenDropdownId(null);
                                                                }}
                                                                disabled={reactivatingId === wr.id}
                                                                className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left transition-colors
                                                                    ${isLight ? 'hover:bg-gray-50 text-gray-700' : 'hover:bg-white/5 text-gray-300'}
                                                                    ${reactivatingId === wr.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                            >
                                                                {reactivatingId === wr.id ? <RefreshCw size={16} className="animate-spin" /> : <RotateCcw size={16} />}
                                                                Reactivate Link...
                                                            </button>
                                                            <div className={`h-[1px] my-1 ${isLight ? 'bg-gray-100' : 'bg-white/5'}`} />
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handleDeleteReport(wr.id); }}
                                                                disabled={deletingId === wr.id}
                                                                className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left transition-colors text-red-500
                                                                    ${isLight ? 'hover:bg-red-50' : 'hover:bg-red-500/10'}
                                                                    ${deletingId === wr.id ? 'opacity-50' : ''}`}
                                                            >
                                                                {deletingId === wr.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                                                                Delete Report
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {isExp
                                                ? <ChevronUp className={`w-5 h-5 ${isLight ? 'text-gray-400' : 'text-gray-500'}`} />
                                                : <ChevronDown className={`w-5 h-5 ${isLight ? 'text-gray-400' : 'text-gray-500'}`} />
                                            }
                                        </div>
                                    </button>

                                    {/* Expanded Detail — matches PDF design */}
                                    {isExp && (
                                        <div className={`border-t ${isLight ? 'border-gray-100' : 'border-white/5'}`}>
                                            {/* Blue Header Banner */}
                                            <div className="bg-gradient-to-r from-[#0093d5] to-[#005a8c] px-6 py-5 text-white">
                                                <div className="flex items-start justify-between">
                                                    <div>
                                                        <h3 className="text-xl font-extrabold tracking-tight">PREPAREDNESS THIS WEEK</h3>
                                                        <div className="inline-block mt-1.5 px-3 py-1 bg-white/20 rounded-lg text-sm font-bold">
                                                            {wr.week_range}
                                                        </div>
                                                        <p className="mt-2 text-[11px] text-white/70 max-w-md leading-relaxed">
                                                            The weekly updates of what was achieved by the Health Emergency, Pandemics, and Threats Preparedness (HEP)
                                                        </p>
                                                    </div>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); generateReportPdf(wr, showToast); }}
                                                        className="flex items-center gap-2 px-4 py-2 bg-white/15 hover:bg-white/25 rounded-xl text-sm font-bold transition-all"
                                                    >
                                                        <Download className="w-4 h-4" />
                                                        Download PDF
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="px-6 py-5">
                                                {/* Top row: Featured Achievement + Key Figures */}
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                                                    <div className={`rounded-xl overflow-hidden border ${isLight ? 'border-blue-200' : 'border-blue-500/30'}`}>
                                                        <div className="bg-[#0093d5] px-4 py-2">
                                                            <h4 className="text-white text-xs font-bold uppercase tracking-wider">Featured Achievement</h4>
                                                        </div>
                                                        <div className={`px-4 py-3 max-h-[220px] overflow-y-auto ${isLight ? 'bg-white' : 'bg-white/5'}`}>
                                                            <p className={`text-sm ${isLight ? 'text-gray-700' : 'text-gray-300'}`}>
                                                                {wr.featured_achievement || <span className="italic opacity-50">Not filled</span>}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className={`rounded-xl overflow-hidden border ${isLight ? 'border-blue-200' : 'border-blue-500/30'}`}>
                                                        <div className="bg-[#0093d5] px-4 py-2">
                                                            <h4 className="text-white text-xs font-bold uppercase tracking-wider">Key Figures in this Week</h4>
                                                        </div>
                                                        <div className={`px-4 py-3 max-h-[220px] overflow-y-auto ${isLight ? 'bg-white' : 'bg-white/5'}`}>
                                                            <p className={`text-sm ${isLight ? 'text-gray-700' : 'text-gray-300'}`}>
                                                                {wr.key_figures || <span className="italic opacity-50">Not filled</span>}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* HEP at Glance heading */}
                                                <h3 className="text-lg font-bold mb-4" style={{ color: '#0093d5' }}>HEP at Glance</h3>

                                                {/* Section rows */}
                                                <div className="space-y-1">
                                                    {[
                                                        { label: 'Health Security Governance', key: 'health_security_governance', orange: false },
                                                        { label: 'Health Security Financing', key: 'health_security_financing', orange: false },
                                                        { label: 'Threats & Risks Management', key: 'threats_risks_management', orange: true },
                                                        { label: 'IHR M&E', key: 'ihrme', orange: false },
                                                        { label: 'IPC', key: 'ipc', orange: false },
                                                        { label: 'Readiness', key: 'readiness', orange: true },
                                                        { label: 'NAPHS', key: 'naphs', orange: true },
                                                        { label: 'Community Protection', key: 'community_protection', orange: true },
                                                        { label: 'Workforce and Training', key: 'workforce_training', orange: true },
                                                        { label: 'Pandemic Influenza', key: 'pandemic_influenza', orange: true },
                                                        { label: 'Vaccines and Research', key: 'vaccines_research', orange: false },
                                                        { label: 'Diseases under Elimination', key: 'diseases_under_elimination', orange: false },
                                                        { label: 'One Health', key: 'one_health', orange: false },
                                                        { label: 'Innovative Projects', key: 'innovative_projects', orange: false },
                                                        { label: 'OSL', key: 'osl', orange: false },
                                                        { label: 'HEDRM', key: 'hedrm', orange: false },
                                                    ].map(sec => (
                                                        <div key={sec.key} className="flex border-b last:border-b-0" style={{ borderColor: isLight ? '#e5e7eb' : 'rgba(255,255,255,0.08)' }}>
                                                            <div
                                                                className={`w-48 flex-shrink-0 px-4 py-3 text-xs font-bold uppercase tracking-wider flex items-center
                                                                    ${sec.orange
                                                                        ? 'bg-[#0093d5] text-white'
                                                                        : isLight ? 'bg-gray-100 text-gray-600' : 'bg-white/5 text-gray-400'
                                                                    }`}
                                                            >
                                                                {sec.label}
                                                            </div>
                                                            <div className={`flex-1 px-4 py-3 text-sm ${isLight ? 'text-gray-700' : 'text-gray-300'}`}>
                                                                {(wr[sec.key] as string | number | null | undefined) || <span className="italic opacity-40">—</span>}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* ── Generate Link Modal ── */}
            {linkModalOpen && (
                <>
                    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" onClick={() => setLinkModalOpen(false)} />
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
                        <div
                            className="pointer-events-auto w-full max-w-lg bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden"
                            style={{ boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}
                        >
                            {/* Header */}
                            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center">
                                        <Link2 className="w-5 h-5 text-blue-600" />
                                    </div>
                                    <div>
                                        <span className="text-base font-semibold text-gray-800">Generate Weekly Link</span>
                                    </div>
                                </div>
                                <button onClick={() => setLinkModalOpen(false)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition">
                                    <X size={18} />
                                </button>
                            </div>

                            {/* Body */}
                            <div className="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto">
                                {/* Description */}
                                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                                    <p className="text-sm text-blue-800 leading-relaxed">
                                        This link will allow <strong>workers from all departments</strong> to submit their weekly report for the selected date range.
                                        The link will be automatically destroyed after the expiry time.
                                    </p>
                                </div>

                                {/* Date Range */}
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
                                        Report Period
                                    </label>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-[11px] text-gray-400 mb-1">From</label>
                                            <input
                                                type="date"
                                                value={linkStartDate}
                                                onChange={(e) => setLinkStartDate(e.target.value)}
                                                className="w-full px-3 py-2 rounded-lg text-sm border border-gray-200 bg-gray-50 text-gray-800 outline-none focus:border-blue-400 transition-colors"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[11px] text-gray-400 mb-1">To</label>
                                            <input
                                                type="date"
                                                value={linkEndDate}
                                                onChange={(e) => setLinkEndDate(e.target.value)}
                                                className="w-full px-3 py-2 rounded-lg text-sm border border-gray-200 bg-gray-50 text-gray-800 outline-none focus:border-blue-400 transition-colors"
                                            />
                                        </div>
                                    </div>
                                    <p className="text-[11px] text-gray-400 mt-1.5">
                                        Workers will submit a report for: <strong className="text-gray-600">{formatWeekRange(linkStartDate, linkEndDate)}</strong>
                                    </p>
                                </div>

                                {/* Expiry */}
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
                                        Link Expiry
                                    </label>
                                    <select
                                        value={linkExpiryHours}
                                        onChange={(e) => setLinkExpiryHours(Number(e.target.value))}
                                        className="w-full px-3 py-2.5 rounded-lg text-sm border border-gray-200 bg-gray-50 text-gray-800 outline-none focus:border-blue-400 transition-colors appearance-none cursor-pointer"
                                    >
                                        <option value={1}>1 hour</option>
                                        <option value={2}>2 hours</option>
                                        <option value={4}>4 hours</option>
                                        <option value={8}>8 hours</option>
                                        <option value={12}>12 hours</option>
                                        <option value={24}>24 hours (default)</option>
                                        <option value={48}>48 hours</option>
                                        <option value={72}>72 hours (max)</option>
                                    </select>
                                    <p className="text-[11px] text-gray-400 mt-1.5">
                                        Link will be automatically destroyed after {linkExpiryHours} hour{linkExpiryHours > 1 ? 's' : ''}.
                                    </p>
                                </div>

                                {/* Pre-fill fields */}
                                <div className="space-y-3">
                                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-500">
                                        Pre-fill Fields (optional)
                                    </label>
                                    <div>
                                        <label className="block text-[11px] text-gray-400 mb-1">Featured Achievement</label>
                                        <textarea
                                            value={prefillAchievement}
                                            onChange={(e) => setPrefillAchievement(e.target.value)}
                                            placeholder="e.g. AAR for Marburg Outbreak in Ethiopia"
                                            rows={2}
                                            className="w-full px-3 py-2 rounded-lg text-sm border border-gray-200 bg-gray-50 text-gray-800 placeholder:text-gray-400 outline-none focus:border-blue-400 transition-colors resize-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] text-gray-400 mb-1">Key Figures</label>
                                        <textarea
                                            value={prefillKeyFigures}
                                            onChange={(e) => setPrefillKeyFigures(e.target.value)}
                                            placeholder="Key figures, statistics, and highlights..."
                                            rows={2}
                                            className="w-full px-3 py-2 rounded-lg text-sm border border-gray-200 bg-gray-50 text-gray-800 placeholder:text-gray-400 outline-none focus:border-blue-400 transition-colors resize-none"
                                        />
                                    </div>
                                </div>

                                {/* Generated link result */}
                                {generatedLink && (
                                    <div className="bg-green-50 border border-green-100 rounded-xl p-4">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-xs font-bold uppercase tracking-wider text-green-700">✓ Link Generated</span>
                                            <button
                                                onClick={() => { navigator.clipboard.writeText(generatedLink.url); setCopiedLink('generated'); setTimeout(() => setCopiedLink(null), 2000); showToast('Copied!', 'success'); }}
                                                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all
                                                    ${copiedLink === 'generated' ? 'bg-green-200 text-green-800' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}
                                            >
                                                {copiedLink === 'generated' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                                {copiedLink === 'generated' ? 'Copied!' : 'Copy'}
                                            </button>
                                        </div>
                                        <p className="text-[11px] font-mono break-all text-green-800/70 bg-white/60 rounded-lg px-3 py-2">
                                            {generatedLink.url}
                                        </p>
                                        <div className="flex items-center justify-between mt-2">
                                            <p className="text-[11px] text-green-600">
                                                Week: <strong>{generatedLink.weekRange}</strong>
                                            </p>
                                            <p className="text-[11px] text-green-600">
                                                Expires: {new Date(generatedLink.expiresAt).toLocaleString()}
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Footer */}
                            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50">
                                <button
                                    onClick={handleGenerateLink}
                                    disabled={generatingLink}
                                    className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold transition-all duration-200
                                        ${generatingLink ? 'opacity-60 cursor-not-allowed' : ''}
                                        bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-200`}
                                >
                                    {generatingLink ? (
                                        <><RefreshCw className="w-4 h-4 animate-spin" /> Generating...</>
                                    ) : (
                                        <><Link2 className="w-4 h-4" /> Generate Link</>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* AI Chat Popup */}
            {aiOpen && <AiChatPopup onClose={() => setAiOpen(false)} />}

            {/* Reactivate Link Modal */}
            {reactivateModalOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6">
                    <div
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300"
                        onClick={() => setReactivateModalOpen(false)}
                    />
                    <div className={`relative w-full max-w-md overflow-hidden rounded-3xl shadow-2xl animate-in zoom-in slide-in-from-bottom-8 duration-300
                        ${isLight ? 'bg-white' : 'bg-[#0f172a] border border-white/10'}`}>
                        <div className={`p-6 border-b ${isLight ? 'border-gray-100' : 'border-white/5'}`}>
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-xl ${isLight ? 'bg-blue-50' : 'bg-blue-500/10'}`}>
                                        <RotateCcw className="w-5 h-5 text-blue-500" />
                                    </div>
                                    <h3 className={`text-xl font-bold ${isLight ? 'text-gray-900' : 'text-white'}`}>
                                        Reactivate Link
                                    </h3>
                                </div>
                                <button
                                    onClick={() => setReactivateModalOpen(false)}
                                    className={`p-2 rounded-xl transition-colors ${isLight ? 'hover:bg-gray-100 text-gray-400' : 'hover:bg-white/10 text-gray-500'}`}
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <p className={`text-sm ${isLight ? 'text-gray-500' : 'text-gray-400'}`}>
                                Extend the link expiry to allow collaborators more time to fill the report.
                            </p>
                        </div>

                        <div className="p-6 space-y-6">
                            <div>
                                <div className="flex justify-between items-center mb-3">
                                    <label className={`text-xs font-bold uppercase tracking-wider ${isLight ? 'text-gray-500' : 'text-gray-400'}`}>
                                        Duration (Hours)
                                    </label>
                                    <div className={`px-3 py-1 rounded-lg text-sm font-bold ${isLight ? 'bg-blue-50 text-blue-600' : 'bg-blue-500/10 text-blue-400'}`}>
                                        {reactivateHours}h
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <input
                                        type="range"
                                        min="1"
                                        max="72"
                                        value={reactivateHours}
                                        onChange={(e) => setReactivateHours(parseInt(e.target.value))}
                                        className="w-full accent-blue-500 h-1.5 bg-gray-200 dark:bg-white/10 rounded-lg appearance-none cursor-pointer"
                                    />
                                    <div className="flex justify-between">
                                        {[1, 12, 24, 48, 72].map(h => (
                                            <button
                                                key={h}
                                                onClick={() => setReactivateHours(h)}
                                                className={`text-[10px] font-bold px-2 py-1 rounded-md transition-all
                                                    ${reactivateHours === h
                                                        ? (isLight ? 'bg-blue-600 text-white' : 'bg-blue-500 text-white')
                                                        : (isLight ? 'text-gray-400 hover:text-gray-600' : 'text-gray-500 hover:text-gray-300')
                                                    }`}
                                            >
                                                {h}h
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={() => {
                                    if (selectedReactivateId) {
                                        handleReactivateLink(selectedReactivateId, reactivateHours);
                                        setReactivateModalOpen(false);
                                    }
                                }}
                                disabled={reactivatingId !== null}
                                className={`w-full h-12 rounded-2xl font-bold text-sm shadow-lg transition-all flex items-center justify-center gap-2
                                    ${isLight
                                        ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200'
                                        : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-blue-500/20'
                                    }`}
                            >
                                {reactivatingId !== null ? (
                                    <RefreshCw className="w-4 h-4 animate-spin" />
                                ) : (
                                    <RotateCcw className="w-4 h-4" />
                                )}
                                Reactivate Link
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}