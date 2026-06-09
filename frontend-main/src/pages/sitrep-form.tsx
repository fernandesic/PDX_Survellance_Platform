/**
 * SITREP Form — Public Form Page
 * Accessed via /sitrep-form?token=<uuid>
 * No authentication required — token-only access.
 *
 * Flow:
 *   1. Read token from URL
 *   2. Validate via GET /api/v1/sitrep/validate-link/<token>
 *   3. Render form with auto-save on every field blur/change
 *   4. Each field saves via PATCH /api/v1/sitrep/update-field
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Clock, Send } from 'lucide-react';
import axios from 'axios';

import SitrepHeader from './sitrep/components/SitrepHeader';
import DocumentControlTable from './sitrep/components/DocumentControlTable';
import StatCards from './sitrep/components/StatCards';
import ReadinessPlaceholders from './sitrep/components/ReadinessPlaceholders';
import CountrySelector from './sitrep/components/CountrySelector';
import ChecklistSection from './sitrep/components/ChecklistSection';
import ActionPointsTable from './sitrep/components/ActionPointsTable';
import TextSection from './sitrep/components/TextSection';
import WeeklyHighlightSection, { type HighlightItem } from './sitrep/components/WeeklyHighlightSection';
import { LoadingScreen, ExpiredScreen, InvalidScreen } from './sitrep/components/StatusScreens';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

type FormState = 'loading' | 'form' | 'expired' | 'invalid';

interface ReportData {
    id: number;
    sitrep_number: string;
    reporting_period: string;
    date_of_issue: string;
    data_cutoff: string;
    classification: string;
    geographic_scope: string;
    triggering_event: string;
    prepared_by: string;
    cleared_by: string;
    next_issue: string;
    population_in_screening: string;
    high_risk_poe: string;
    referred: string;
    isolated: string;
    suspected: string;
    selected_country: string;
    checklist_responses: Record<string, string>;
    action_points: Array<{ action: string; pillar: string }>;
    planned_actions: string;
    key_challenges: string;
    weekly_highlights: HighlightItem[];
    [key: string]: any;
}

/**
 * Self-contained countdown badge.
 * Owns its own per-second state so the parent SitrepForm doesn't re-render
 * every second — that was causing visible flicker across all sections.
 */
const CountdownBadge: React.FC<{ expiresAt: string }> = React.memo(({ expiresAt }) => {
    const [label, setLabel] = useState('');
    useEffect(() => {
        if (!expiresAt) { setLabel(''); return; }
        const tick = () => {
            const diff = new Date(expiresAt).getTime() - Date.now();
            if (diff <= 0) { setLabel('Expired'); return; }
            const h = Math.floor(diff / 3600000);
            const m = Math.floor((diff % 3600000) / 60000);
            const s = Math.floor((diff % 60000) / 1000);
            setLabel(`${h}h ${m}m ${s}s`);
        };
        tick();
        const id = setInterval(tick, 1000);
        return () => clearInterval(id);
    }, [expiresAt]);

    if (!label || label === 'Expired') return null;
    return (
        <span className="inline-flex items-center gap-1.5 text-amber-600 font-semibold">
            <Clock className="w-3.5 h-3.5" />
            {label} remaining
        </span>
    );
});
CountdownBadge.displayName = 'CountdownBadge';

const SitrepForm: React.FC = () => {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token') || '';

    const [formState, setFormState] = useState<FormState>('loading');
    const [report, setReport] = useState<ReportData | null>(null);
    const [expiresAt, setExpiresAt] = useState<string>('');
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const mountedRef = useRef(true);

    useEffect(() => () => { mountedRef.current = false; }, []);

    // ── Validate token on mount ────────────────────────────────
    const validateToken = useCallback(async () => {
        if (!token) { setFormState('invalid'); return; }
        try {
            const res = await axios.get(`${API_BASE}/sitrep/validate-link/${token}`);
            const d = res.data?.data || res.data;
            if (d?.valid) {
                setReport(d.report);
                setExpiresAt(d.expires_at);
                setFormState('form');
            } else {
                setFormState('invalid');
            }
        } catch (err: any) {
            if (err?.response?.status === 410) setFormState('expired');
            else setFormState('invalid');
        }
    }, [token]);

    useEffect(() => { validateToken(); }, [validateToken]);

    // ── Watchdog: if the link expires while the form is open, flip ─
    //    to the expired screen. Cheap (re-runs once on expiry, no
    //    per-second re-render of the whole form).
    useEffect(() => {
        if (!expiresAt) return;
        const ms = new Date(expiresAt).getTime() - Date.now();
        if (ms <= 0) { setFormState('expired'); return; }
        const id = setTimeout(() => setFormState('expired'), ms);
        return () => clearTimeout(id);
    }, [expiresAt]);

    // ── Auto-save: single field ────────────────────────────────
    // NOTE: we deliberately do NOT call setReport on success.
    // Every caller that needs a UI update already does an optimistic
    // setReport BEFORE awaiting saveField. Setting `report` again after
    // the PATCH resolves causes a race when the user clicks several
    // items quickly — a late-arriving response overwrites a newer
    // optimistic state and the just-picked option appears to "flash off"
    // for a beat. Local state in each field/section is the source of
    // truth between full reloads.
    const saveField = useCallback(async (fieldName: string, value: any) => {
        try {
            await axios.patch(`${API_BASE}/sitrep/update-field`, {
                token, field_name: fieldName, value, edited_by: 'Form User',
            });
            if (mountedRef.current) {
                setReport(prev => prev ? { ...prev, [fieldName]: value } : prev);
            }
        } catch (err: any) {
            console.error(`Failed to save field '${fieldName}':`, err);
            // Re-throw so child components (StatCards, TextSection, etc.)
            // can catch it in their own try/catch and avoid marking as "saved".
            throw err;
        }
    }, [token]);

    // ── Country change handler ─────────────────────────────────
    const handleCountryChange = useCallback(async (country: string) => {
        setReport(prev => prev ? { ...prev, selected_country: country } : prev);
        await saveField('selected_country', country);
    }, [saveField]);

    // ── Checklist toggle handler ───────────────────────────────
    const handleChecklistToggle = useCallback(async (itemKey: string, value: 'YES' | 'NO' | 'NA') => {
        const updated = { ...(report?.checklist_responses || {}), [itemKey]: value };
        setReport(prev => prev ? { ...prev, checklist_responses: updated } : prev);
        await saveField('checklist_responses', updated);
    }, [report?.checklist_responses, saveField]);

    // ── Action points save ─────────────────────────────────────
    const handleActionPointsSave = useCallback(async (points: Array<{ action: string; pillar: string }>) => {
        await saveField('action_points', points);
    }, [saveField]);

    // ── Weekly highlights save (caption / date / star toggles) ─
    const handleHighlightsSave = useCallback(async (items: HighlightItem[]) => {
        await saveField('weekly_highlights', items);
    }, [saveField]);

    // ── Submit handler ─────────────────────────────────────────
    const handleSubmit = useCallback(async () => {
        setSubmitting(true);
        try {
            // Just a visual confirmation — all data is already auto-saved
            await new Promise<void>((resolve) => {
                const t = setTimeout(resolve, 800);
                // If component unmounts, clean up the timer
                if (!mountedRef.current) { clearTimeout(t); resolve(); }
            });
            if (mountedRef.current) {
                setSubmitted(true);
            }
        } finally {
            if (mountedRef.current) {
                setSubmitting(false);
            }
        }
    }, []);

    // ── State screens ──────────────────────────────────────────
    if (formState === 'loading') return <LoadingScreen />;
    if (formState === 'expired') return <ExpiredScreen onRefresh={validateToken} />;
    if (formState === 'invalid') return <InvalidScreen />;
    if (!report) return <InvalidScreen />;

    if (submitted) {
        return (
            <div className="min-h-screen bg-[#f0f2f5] flex items-center justify-center p-6">
                <div className="w-full max-w-md text-center">
                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 bg-green-100">
                        <Send className="w-8 h-8 text-green-600" />
                    </div>
                    <h2 className="text-xl font-bold mb-3 text-gray-900">SITREP Submitted</h2>
                    <p className="text-sm text-gray-600">
                        Thank you. All your responses have been saved.<br />
                        SITREP <strong>{report.sitrep_number}</strong> is now complete.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#f0f2f5]">
            <div className="max-w-7xl mx-auto px-4 py-6 md:py-10">
                {/* WHO Branding Header (centered) */}
                <SitrepHeader
                    sitrepNumber={report.sitrep_number}
                    reportingPeriod={report.reporting_period}
                />

                {/* Countdown + auto-save banner */}
                <div className="flex items-center justify-between px-5 py-2.5 bg-white border-x border-b border-gray-100 text-xs">
                    <span className="text-gray-500">
                        All fields <strong>auto-save</strong> when you leave them. No need to press Save.
                    </span>
                    <CountdownBadge expiresAt={expiresAt} />
                </div>

                {/* ── Form Content ─────────────────────────────── */}
                <div className="bg-[#f0f2f5] pt-6 space-y-0">
                    {/* Section 0: Document Control */}
                    <DocumentControlTable
                        data={report}
                        onSave={saveField}
                    />

                    {/* Section 1: Statistics */}
                    <StatCards
                        data={report}
                        onSave={saveField}
                    />

                    {/* Section 2: Readiness Capacities */}
                    <ReadinessPlaceholders />

                    {/* Section 3: Temporary Recommendations */}
                    <div className="mb-6">
                        <div className="flex items-center justify-between px-5 py-3.5 bg-gradient-to-r from-[#1a2744] to-[#2c3e6b] rounded-t-xl">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                                    <span className="text-white text-sm font-bold">3</span>
                                </div>
                                <h3 className="text-white font-bold text-base">
                                    Temporary Recommendations — Implementation Status
                                </h3>
                            </div>
                            <span className="text-white/60 text-xs italic hidden md:block">
                                select country → tick Yes / No
                            </span>
                        </div>
                        <div className="bg-white border border-gray-100 border-t-0 rounded-b-xl shadow-sm">
                            <CountrySelector
                                selectedCountry={report.selected_country || ''}
                                onCountryChange={handleCountryChange}
                            />
                            <ChecklistSection
                                selectedCountry={report.selected_country || ''}
                                responses={report.checklist_responses || {}}
                                onToggle={handleChecklistToggle}
                            />
                        </div>
                    </div>

                    {/* Section 4: Action Points */}
                    <ActionPointsTable
                        actionPoints={report.action_points || []}
                        onSave={handleActionPointsSave}
                    />

                    {/* Section 5: Planned Actions & Deployments */}
                    <TextSection
                        sectionNumber={5}
                        title="Planned Actions & Deployments"
                        hint="open field"
                        label="Planned actions, staff/asset deployments, timelines"
                        placeholder="Describe planned actions, partner deployments, surge staff, logistics movements, target dates..."
                        fieldName="planned_actions"
                        value={report.planned_actions || ''}
                        onSave={saveField}
                    />

                    {/* Section 5b: Weekly Highlight — Photos */}
                    <WeeklyHighlightSection
                        token={token}
                        highlights={report.weekly_highlights || []}
                        onSave={handleHighlightsSave}
                    />

                    {/* Section 6: Key Challenges */}
                    <TextSection
                        sectionNumber={6}
                        title="Key Challenges"
                        hint=""
                        label="Operational, security, funding and access challenges"
                        placeholder="Describe key challenges, gaps, and bottlenecks affecting the response..."
                        fieldName="key_challenges"
                        value={report.key_challenges || ''}
                        onSave={saveField}
                    />

                    {/* Submit Button */}
                    <div className="flex justify-end pb-10 pt-2">
                        <button
                            type="button"
                            onClick={handleSubmit}
                            disabled={submitting}
                            className="inline-flex items-center gap-2 px-8 py-3 bg-[#1a2744] text-white font-bold text-sm rounded-xl hover:bg-[#253557] transition-all shadow-lg active:scale-95 disabled:opacity-60"
                        >
                            {submitting ? (
                                <>Submitting...</>
                            ) : (
                                <>Submit SITREP</>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SitrepForm;
