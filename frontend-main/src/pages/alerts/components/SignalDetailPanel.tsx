// @ts-nocheck

import React, { useState, useRef, useEffect } from 'react';
import type { Signal } from '../types';
import { ExternalLink, Activity, MapPin,
    CheckCircle2, XCircle, ChevronUp, AlertTriangle,
    Clock, TrendingUp, Languages, Database, Shield
} from 'lucide-react';
import { validateSignal, dismissSignal, triageSignal, classifySignal } from '../services/sentinelService';

interface SignalDetailPanelProps {
    signal: Signal | null;
    onClose: () => void;
    onUpdate?: () => void;
    onPromote?: (signal: Signal) => void;
}

const LANG_LABELS: Record<string, string> = {
    en: 'English', fr: 'Français', ha: 'Hausa', pt: 'Português',
    sw: 'Kiswahili', ar: 'العربية', yo: 'Yorùbá', am: 'አማርኛ',
};

export const SignalDetailPanel: React.FC<SignalDetailPanelProps> = ({ signal, onClose, onUpdate, onPromote }) => {
    const [isProcessing, setIsProcessing] = useState(false);
    const [showPriorityDropdown, setShowPriorityDropdown] = useState(false);
    const [actionMessage, setActionMessage] = useState<string | null>(null);
    const [showOriginalText, setShowOriginalText] = useState(true);
    const panelRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (signal && panelRef.current) {
            panelRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        setActionMessage(null);
        setShowPriorityDropdown(false);
    }, [signal]);

    if (!signal) return null;

    // ── Data accessors ──
    const diseaseName = signal.disease_name || signal.hazard?.name || 'Unknown Event';
    const level = signal.level || signal.priority || 'P3';

    const cases = signal.reported_cases ?? signal.epi?.cases_suspected ?? signal.epidemiology?.suspected_cases ?? null;
    const deaths = signal.reported_deaths ?? signal.epi?.deaths ?? signal.epidemiology?.deaths ?? null;
    const confidence = Math.round(signal.confidence_score ?? (signal.confidence ? signal.confidence * 100 : 0));
    const translationConf = signal.translation_confidence ?? (signal.lingua?.original_language_code === 'en' ? 100 : null);
    const fidelityScore = signal.lingua_fidelity_score ?? (signal.lingua?.original_language_code === 'en' ? 95 : null);
    const publishedDate = signal.source_timestamp || signal.publishedAt || signal.created_at;

    const originalText = signal.original_text || signal.lingua?.original_text || signal.lingua_data?.original_text || '';
    const translatedText = signal.translated_text || signal.lingua?.translation_text || signal.lingua_data?.translated_text || signal.summary || '';
    const originalLang = signal.original_language || signal.lingua?.original_language_name || signal.lingua_data?.original_language || '';
    const langLabel = LANG_LABELS[originalLang] || originalLang || 'Unknown';
    const isMultilingual = originalLang && originalLang !== 'en';

    const primarySource = signal.sources?.[0] || signal.source;
    const srcName = primarySource?.name || signal.source_name || 'Intelligence Feed';
    const srcUrl = primarySource?.url || signal.source_url || '';
    const srcTier = primarySource?.tier || signal.source_tier || 3;
    const srcType = (primarySource as any)?.type || signal.source_type || 'News';

    const tierColor = (t: number) => t === 1 ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' : t === 2 ? 'text-blue-400 bg-blue-500/10 border-blue-500/20' : 'text-slate-500 bg-white/5 border-white/5';
    const tierLabel = (t: number) => t === 1 ? 'Official' : t === 2 ? 'Verified Media' : 'Unverified';

    // ── Computed flags for conditional rendering ──
    const hasEpiData = cases != null || deaths != null;
    const hasRiskFlags = signal.cross_border_risk || signal.seasonal_pattern_match;
    const hasLocationDetail = signal.location?.admin2 || signal.location?.locality;
    const hasCoords = (signal.location?.coordinates && typeof signal.location.coordinates === 'object');
    const isNativeSignal = signal.id && /^\d+$/.test(String(signal.id));

    // Confidence gauge
    const gaugeRadius = 22;
    const gaugeCircumference = 2 * Math.PI * gaugeRadius;
    const gaugeFill = ((confidence || 0) / 100) * gaugeCircumference;
    const gaugeColor = confidence >= 70 ? '#10b981' : confidence >= 40 ? '#f59e0b' : '#ef4444';

    const levelStyle = level === 'P1' ? 'text-red-400 bg-red-500/15 border-red-500/30' :
        level === 'P2' ? 'text-orange-400 bg-orange-500/15 border-orange-500/30' :
        level === 'P3' ? 'text-amber-400 bg-amber-500/15 border-amber-500/30' :
        'text-slate-400 bg-white/5 border-white/5';

    return (
        <div ref={panelRef} className="bg-[#0B1120] rounded-[2rem] border border-white/5 shadow-sm overflow-hidden" style={{ animation: 'fadeInUp 0.25s ease-out' }}>
            {/* ── Header ── */}
            <div className="px-5 py-3.5 border-b border-white/5 flex items-center justify-between bg-gradient-to-r from-white/[0.02] to-transparent">
                <div className="flex items-center gap-3 min-w-0">
                    <span className={`text-[8px] font-black px-2 py-0.5 rounded-md border shrink-0 ${levelStyle}`}>{level}</span>
                    <span className="text-sm font-black text-white truncate">{diseaseName}</span>
                    <span className="text-[9px] font-black text-slate-600 shrink-0">SIG-{signal.id}</span>
                </div>
                <div className="flex items-center gap-2">
                    {signal.location?.country && (
                        <span className="text-[9px] font-bold text-slate-500 flex items-center gap-1">
                            <MapPin className="w-3 h-3" /> {signal.location.country}
                        </span>
                    )}
                    {/* Confidence mini-gauge */}
                    <div className="relative w-9 h-9 shrink-0">
                        <svg className="w-9 h-9 -rotate-90" viewBox="0 0 56 56">
                            <circle cx="28" cy="28" r={gaugeRadius} stroke="rgba(255,255,255,0.05)" strokeWidth="3" fill="none" />
                            <circle cx="28" cy="28" r={gaugeRadius} stroke={gaugeColor} strokeWidth="3" fill="none"
                                strokeDasharray={gaugeCircumference} strokeDashoffset={gaugeCircumference - gaugeFill}
                                strokeLinecap="round" className="transition-all duration-700" />
                        </svg>
                        <span className="absolute inset-0 flex items-center justify-center text-[8px] font-black text-white">{confidence}%</span>
                    </div>
                </div>
            </div>

            {/* ── 2 Column Content ── */}
            <div className="p-5 grid grid-cols-2 gap-5">

                {/* ── LEFT COLUMN: Article + Source ── */}
                <div className="space-y-4">
                    {/* Full Article */}
                    <div>
                        <h4 className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 flex items-center gap-1.5">
                            <Languages className="w-3 h-3 text-slate-600" /> Signal Content
                        </h4>
                        {isMultilingual && (
                            <div className="flex items-center gap-1.5 mb-2">
                                <button
                                    onClick={() => setShowOriginalText(true)}
                                    className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest border transition-all ${showOriginalText
                                        ? 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30'
                                        : 'bg-white/5 text-slate-600 border-white/5 hover:bg-white/10'
                                    }`}
                                >
                                    Original ({langLabel})
                                </button>
                                <button
                                    onClick={() => setShowOriginalText(false)}
                                    className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest border transition-all ${!showOriginalText
                                        ? 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30'
                                        : 'bg-white/5 text-slate-600 border-white/5 hover:bg-white/10'
                                    }`}
                                >
                                    English
                                </button>
                                {translationConf != null && (
                                    <span className="text-[8px] font-bold text-slate-600 ml-auto">Translation {translationConf}%</span>
                                )}
                            </div>
                        )}
                        <div className="bg-white/[0.03] rounded-xl p-4 border border-white/5 min-h-[80px] max-h-[200px] overflow-y-auto">
                            {showOriginalText || !isMultilingual ? (
                                <p className="text-slate-300 italic font-medium leading-relaxed text-[13px]">
                                    {originalText ? `"${originalText}"` : '— No source text —'}
                                </p>
                            ) : (
                                <p className="text-slate-400 font-medium leading-relaxed text-[13px]">
                                    {translatedText || '— No translation —'}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Source Intelligence — compact */}
                    <div>
                        <h4 className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 flex items-center gap-1.5">
                            <Database className="w-3 h-3 text-slate-600" /> Source
                        </h4>
                        <div className="bg-white/[0.03] rounded-xl p-3 border border-white/5">
                            <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                    <span className="text-[11px] font-bold text-slate-300 block truncate">{srcName}</span>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="text-[8px] font-bold text-slate-600">{srcType}</span>
                                        <span className="text-[8px] text-slate-700">·</span>
                                        <span className="text-[8px] font-bold text-slate-600">{signal.ingestion_source || 'DB'}</span>
                                        <span className="text-[8px] text-slate-700">·</span>
                                        <span className="text-[8px] font-bold text-slate-600">{publishedDate ? new Date(publishedDate).toLocaleDateString() : '—'}</span>
                                    </div>
                                </div>
                                <span className={`text-[8px] font-black px-1.5 py-0.5 rounded border shrink-0 ${tierColor(srcTier)}`}>{tierLabel(srcTier)}</span>
                            </div>
                            {srcUrl && (
                                <a href={srcUrl} target="_blank" rel="noreferrer"
                                    className="flex items-center justify-center gap-1.5 p-2 mt-2.5 rounded-lg border border-blue-500/20 bg-blue-500/10 text-blue-400 font-black text-[8px] uppercase tracking-widest hover:bg-blue-500/20 transition-all">
                                    Open Source <ExternalLink className="w-3 h-3" />
                                </a>
                            )}
                        </div>
                    </div>

                    {/* Epi Stats — only show if there's actual data */}
                    {(hasEpiData || hasRiskFlags) && (
                        <div>
                            <h4 className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 flex items-center gap-1.5">
                                <Activity className="w-3 h-3 text-slate-600" /> Epidemiology
                            </h4>
                            <div className="flex gap-2">
                                {cases != null && (
                                    <div className="flex-1 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center">
                                        <span className="text-[7px] font-black text-emerald-400 uppercase block mb-0.5">Cases</span>
                                        <span className="text-lg font-black text-white">{cases.toLocaleString()}</span>
                                    </div>
                                )}
                                {deaths != null && (
                                    <div className="flex-1 p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-center">
                                        <span className="text-[7px] font-black text-red-400 uppercase block mb-0.5">Deaths</span>
                                        <span className="text-lg font-black text-red-400">{deaths.toLocaleString()}</span>
                                    </div>
                                )}
                                {signal.affected_population && (
                                    <div className="flex-1 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center">
                                        <span className="text-[7px] font-black text-amber-400 uppercase block mb-0.5">Population</span>
                                        <span className="text-sm font-black text-white">{signal.affected_population}</span>
                                    </div>
                                )}
                                {signal.cross_border_risk && (
                                    <div className="flex-1 p-2 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center gap-1.5">
                                        <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                                        <span className="text-[8px] font-black text-red-400 uppercase">Cross-Border</span>
                                    </div>
                                )}
                                {signal.seasonal_pattern_match && (
                                    <div className="flex-1 p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center gap-1.5">
                                        <TrendingUp className="w-3.5 h-3.5 text-blue-400" />
                                        <span className="text-[8px] font-black text-blue-400 uppercase">Seasonal</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* ── RIGHT COLUMN: AI + Triage + Actions ── */}
                <div className="space-y-4">
                    {/* AI Agent Intelligence */}
                    <div>
                        <h4 className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 flex items-center gap-1.5">
                            <Activity className="w-3 h-3 text-slate-600" /> AI Intelligence
                        </h4>
                        <div className="bg-white/[0.03] rounded-xl p-3 border border-white/5 space-y-2.5">
                            {signal.ai_classification ? (
                                <>
                                    {/* Classification + Severity + Scope in compact rows */}
                                    {[
                                        {
                                            label: 'Classification',
                                            value: signal.ai_classification === 'continent_alert' ? '🌍 Continent Alert' :
                                                signal.ai_classification === 'area_alert' ? '📍 Area Alert' :
                                                signal.ai_classification === 'no_alert' ? '✓ No Alert' : '? Uncertain',
                                            style: signal.ai_classification === 'continent_alert' ? 'bg-red-500/15 text-red-400 border-red-500/30' :
                                                signal.ai_classification === 'area_alert' ? 'bg-orange-500/15 text-orange-400 border-orange-500/30' :
                                                signal.ai_classification === 'no_alert' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' :
                                                'bg-slate-500/15 text-slate-400 border-slate-500/30'
                                        },
                                        {
                                            label: 'Severity',
                                            value: signal.ai_severity || 'Unknown',
                                            style: signal.ai_severity === 'critical' ? 'bg-red-500/15 text-red-400 border-red-500/30 animate-pulse' :
                                                signal.ai_severity === 'high' ? 'bg-orange-500/15 text-orange-400 border-orange-500/30' :
                                                signal.ai_severity === 'moderate' ? 'bg-amber-500/15 text-amber-400 border-amber-500/30' :
                                                'bg-slate-500/15 text-slate-400 border-slate-500/30'
                                        },
                                        {
                                            label: 'Notify Scope',
                                            value: signal.ai_notification_scope === 'worldwide' ? '🌐 Worldwide' :
                                                signal.ai_notification_scope === 'continental' ? '🌍 Continental' : '📍 Local',
                                            style: signal.ai_notification_scope === 'worldwide' ? 'bg-purple-500/15 text-purple-400 border-purple-500/30' :
                                                signal.ai_notification_scope === 'continental' ? 'bg-blue-500/15 text-blue-400 border-blue-500/30' :
                                                'bg-slate-500/15 text-slate-400 border-slate-500/30'
                                        },
                                    ].map(row => (
                                        <div key={row.label} className="flex items-center justify-between">
                                            <span className="text-[7px] font-black text-slate-600 uppercase tracking-widest">{row.label}</span>
                                            <span className={`text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${row.style}`}>
                                                {row.value}
                                            </span>
                                        </div>
                                    ))}
                                    {/* AI Reasoning */}
                                    {signal.ai_reasoning && (
                                        <div className="mt-1.5 p-2.5 bg-indigo-500/5 rounded-lg border border-indigo-500/10">
                                            <span className="text-[7px] font-black text-indigo-400 uppercase tracking-widest block mb-1">AI Reasoning</span>
                                            <p className="text-[9px] font-medium text-slate-400 leading-relaxed whitespace-pre-line">{signal.ai_reasoning}</p>
                                        </div>
                                    )}
                                    {signal.ai_classified_at && (
                                        <div className="text-[7px] text-slate-600 text-right">
                                            Classified {new Date(signal.ai_classified_at).toLocaleString()}
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="text-center py-3">
                                    {isNativeSignal ? (
                                        <>
                                            <span className="text-[9px] text-slate-600 block mb-2">Not yet classified by AI</span>
                                            <button
                                                onClick={async () => {
                                                    setIsProcessing(true);
                                                    setActionMessage('⏳ Classifying...');
                                                    try {
                                                        const result = await classifySignal(signal.id);
                                                        if (result) {
                                                            setActionMessage('✓ AI Classification Complete');
                                                            onUpdate?.();
                                                        } else {
                                                            setActionMessage('AI Classification Failed — check if Ollama is running');
                                                        }
                                                    } catch (e) { setActionMessage('AI service unavailable'); }
                                                    setIsProcessing(false);
                                                }}
                                                disabled={isProcessing}
                                                className="px-4 py-2 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-400 font-black text-[8px] uppercase tracking-widest rounded-xl transition-all border border-indigo-500/20 disabled:opacity-50"
                                            >
                                                {isProcessing ? '⏳ Processing...' : '⚡ Classify with AI'}
                                            </button>
                                        </>
                                    ) : (
                                        <span className="text-[9px] text-slate-500 bg-white/5 px-3 py-2 rounded-lg block">
                                            💡 AI classification is only available for native Sentinel signals.
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Triage Audit + Location (compact combined) */}
                    <div>
                        <h4 className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 flex items-center gap-1.5">
                            <Clock className="w-3 h-3 text-slate-600" /> Triage Timeline
                        </h4>
                        <div className="bg-white/[0.03] rounded-xl p-3 border border-white/5">
                            <div className="flex items-center gap-3 text-[9px]">
                                {[
                                    { label: 'Created', value: signal.created_at, color: 'bg-slate-500' },
                                    { label: 'Triaged', value: signal.triaged_at, color: signal.triaged_at ? 'bg-blue-500' : 'bg-white/10' },
                                    { label: 'Validated', value: signal.validated_at, color: signal.validated_at ? 'bg-emerald-500' : 'bg-white/10' },
                                ].map((step, i) => (
                                    <React.Fragment key={step.label}>
                                        <div className="flex items-center gap-1.5">
                                            <div className={`w-2 h-2 rounded-full shrink-0 ${step.color}`} />
                                            <div>
                                                <span className="text-[7px] font-black text-slate-600 uppercase tracking-widest block">{step.label}</span>
                                                <span className="text-[9px] font-bold text-slate-400">
                                                    {step.value ? new Date(step.value).toLocaleDateString() : '—'}
                                                </span>
                                            </div>
                                        </div>
                                        {i < 2 && <div className="flex-1 h-[1px] bg-white/5" />}
                                    </React.Fragment>
                                ))}
                            </div>
                        </div>
                    </div>

                    {signal.analyst_notes && (
                        <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                            <span className="text-[7px] font-black text-amber-400 uppercase tracking-widest block mb-0.5">Analyst Notes</span>
                            <p className="text-[10px] font-medium text-slate-300">{signal.analyst_notes}</p>
                        </div>
                    )}

                    {/* Location — only if useful data exists */}
                    {(hasLocationDetail || hasCoords) && (
                        <div>
                            <h4 className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 flex items-center gap-1.5">
                                <MapPin className="w-3 h-3 text-slate-600" /> Location Details
                            </h4>
                            <div className="bg-white/[0.03] rounded-xl p-3 border border-white/5 space-y-1">
                                {signal.location?.admin1 && (
                                    <div className="flex justify-between items-center py-1 border-b border-white/[0.03]">
                                        <span className="text-[8px] font-black text-slate-600 uppercase tracking-wider">Admin 1</span>
                                        <span className="text-[10px] font-bold text-slate-400">{signal.location.admin1}</span>
                                    </div>
                                )}
                                {signal.location?.admin2 && (
                                    <div className="flex justify-between items-center py-1 border-b border-white/[0.03]">
                                        <span className="text-[8px] font-black text-slate-600 uppercase tracking-wider">Admin 2</span>
                                        <span className="text-[10px] font-bold text-slate-400">{signal.location.admin2}</span>
                                    </div>
                                )}
                                {signal.location?.locality && (
                                    <div className="flex justify-between items-center py-1 border-b border-white/[0.03]">
                                        <span className="text-[8px] font-black text-slate-600 uppercase tracking-wider">Locality</span>
                                        <span className="text-[10px] font-bold text-slate-400">{signal.location.locality}</span>
                                    </div>
                                )}
                                {hasCoords && (
                                    <div className="flex justify-between items-center py-1">
                                        <span className="text-[8px] font-black text-slate-600 uppercase tracking-wider">Coords</span>
                                        <span className="text-[10px] font-bold text-slate-400">
                                            {typeof signal.location.coordinates === 'object' && !Array.isArray(signal.location.coordinates)
                                                ? `${signal.location.coordinates.lat?.toFixed(2)}, ${signal.location.coordinates.lng?.toFixed(2)}`
                                                : Array.isArray(signal.location.coordinates) && signal.location.coordinates.length === 2
                                                    ? `${signal.location.coordinates[1]?.toFixed?.(2)}, ${signal.location.coordinates[0]?.toFixed?.(2)}`
                                                    : '—'}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ── Analyst Workflow + Triage Controls ── */}
                    <div>
                        <h4 className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 flex items-center gap-1.5">
                            <Shield className="w-3 h-3 text-slate-600" /> Actions
                        </h4>
                        {actionMessage && (
                            <div className="p-2 mb-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400 text-[9px] font-black uppercase text-center">
                                {actionMessage}
                            </div>
                        )}
                        <div className="space-y-2">
                            <button
                                onClick={() => onPromote?.(signal)}
                                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-[9px] uppercase tracking-[0.15em] rounded-xl transition-all shadow-lg shadow-indigo-900/20 active:scale-95 border border-indigo-400/30"
                            >
                                <TrendingUp className="w-3.5 h-3.5" /> Promote to Incident
                            </button>
                            <div className="flex gap-2">
                                <button
                                    onClick={async () => {
                                        setIsProcessing(true);
                                        try {
                                            await validateSignal(signal.id);
                                            setActionMessage('✓ Validated');
                                            onUpdate?.();
                                        } catch (e) { setActionMessage('Failed'); }
                                        setIsProcessing(false);
                                    }}
                                    disabled={isProcessing}
                                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 font-black text-[8px] uppercase tracking-widest rounded-xl transition-all active:scale-95 disabled:opacity-50 border border-emerald-500/20"
                                >
                                    <CheckCircle2 className="w-3 h-3" /> Validate
                                </button>
                                <button
                                    onClick={async () => {
                                        setIsProcessing(true);
                                        try {
                                            await dismissSignal(signal.id, 'Dismissed');
                                            setActionMessage('✗ Dismissed');
                                            onUpdate?.();
                                        } catch (e) { setActionMessage('Failed'); }
                                        setIsProcessing(false);
                                    }}
                                    disabled={isProcessing}
                                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-white/5 hover:bg-white/10 text-slate-400 font-black text-[8px] uppercase tracking-widest rounded-xl transition-all active:scale-95 disabled:opacity-50 border border-white/5"
                                >
                                    <XCircle className="w-3 h-3" /> Dismiss
                                </button>
                                <div className="relative">
                                    <button
                                        onClick={() => setShowPriorityDropdown(!showPriorityDropdown)}
                                        className="flex items-center gap-1 px-3 py-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 font-black text-[8px] uppercase tracking-widest rounded-xl transition-all border border-blue-500/20"
                                    >
                                        <ChevronUp className={`w-3 h-3 transition-transform ${showPriorityDropdown ? '' : 'rotate-180'}`} />
                                    </button>
                                    {showPriorityDropdown && (
                                        <div className="absolute bottom-full right-0 mb-1 bg-[#111827] rounded-xl shadow-xl border border-white/10 py-1 min-w-[120px] z-10">
                                            {['P1', 'P2', 'P3', 'P4'].map((p) => (
                                                <button key={p} onClick={async () => {
                                                    setIsProcessing(true); setShowPriorityDropdown(false);
                                                    try {
                                                        await triageSignal(signal.id, { priority: p, confidence_score: 80 });
                                                        setActionMessage(`Priority → ${p}`);
                                                        onUpdate?.();
                                                    } catch (e) { setActionMessage('Failed'); }
                                                    setIsProcessing(false);
                                                }}
                                                    className={`w-full text-left px-3 py-1.5 text-xs font-bold hover:bg-white/5 ${p === 'P1' ? 'text-red-400' : p === 'P2' ? 'text-orange-400' : p === 'P3' ? 'text-amber-400' : 'text-slate-400'}`}
                                                >
                                                    {p} — {p === 'P1' ? 'Critical' : p === 'P2' ? 'High' : p === 'P3' ? 'Medium' : 'Low'}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
        </div>
    );
};
