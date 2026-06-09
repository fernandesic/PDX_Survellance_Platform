
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    Calendar, Shield, Activity, Zap, PieChart, AlertTriangle,
    CheckCircle2, Clock, AlertCircle, Loader2, Save, Globe, Award,
    TrendingUp, Users, Beaker, Bug, Lightbulb, RefreshCcw,
    Upload, ImagePlus, Trash2
} from 'lucide-react';
import { api } from '@/lib/api';
import { useToast } from '@/contexts/ToastProvider';
import { useTheme } from '@/contexts/ThemeContext';
import { logger } from "@/utils/logger";

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api/v1';

/* ───── Types ───── */

interface ReportData {
    id: number;
    featured_achievement: string;
    key_figures: string;
    featured_achievement_image: string | null;
    key_figures_image: string | null;
    health_security_governance: string;
    health_security_financing: string;
    threats_risks_management: string;
    ihrme: string;
    ipc: string;
    readiness: string;
    naphs: string;
    community_protection: string;
    workforce_training: string;
    pandemic_influenza: string;
    vaccines_research: string;
    diseases_under_elimination: string;
    one_health: string;
    innovative_projects: string;
    hedrm: string;
    osl: string;
    [key: string]: string | number | null;
}

type PageState = 'loading' | 'form' | 'expired' | 'invalid';

/* ───── Field definitions matching the PDF ───── */

interface FieldDef {
    key: string;
    label: string;
    type: 'text' | 'textarea';
    maxWords?: number;
    placeholder?: string;
}

interface SectionDef {
    title: string;
    icon: React.ReactNode;
    isHeading?: boolean;
    orangeHighlight?: boolean;
    fields: FieldDef[];
}

const SECTIONS: SectionDef[] = [
    {
        title: 'Featured Achievement',
        icon: <Award className="w-4 h-4" />,
        fields: [
            { key: 'featured_achievement', label: 'Key achievement this week', type: 'textarea', maxWords: 100 },
        ],
    },
    {
        title: 'Key Figures in this Week',
        icon: <PieChart className="w-4 h-4" />,
        fields: [
            { key: 'key_figures', label: 'Key Figures', type: 'textarea', maxWords: 50 },
        ],
    },
    // ── HEP at Glance (heading separator) ──
    {
        title: 'HEP at GLANCE',
        icon: <Globe className="w-4 h-4" />,
        isHeading: true,
        fields: [],
    },
    {
        title: 'One Health',
        icon: <Activity className="w-4 h-4" />,
        fields: [
            { key: 'one_health', label: 'One Health', type: 'textarea', maxWords: 50 },
        ],
    },
    {
        title: 'Health Security Governance',
        icon: <Shield className="w-4 h-4" />,
        fields: [
            { key: 'health_security_governance', label: 'Health Security Governance', type: 'textarea', maxWords: 50 },
        ],
    },
    {
        title: 'Health Security Financing',
        icon: <Zap className="w-4 h-4" />,
        fields: [
            { key: 'health_security_financing', label: 'Health Security Financing', type: 'textarea', maxWords: 50 },
        ],
    },
    {
        title: 'Threats & Risks Management',
        icon: <AlertTriangle className="w-4 h-4" />,
        orangeHighlight: true,
        fields: [
            { key: 'threats_risks_management', label: 'Threats & Risks Management', type: 'textarea', maxWords: 50 },
        ],
    },
    {
        title: 'IHR M&E',
        icon: <Globe className="w-4 h-4" />,
        fields: [
            { key: 'ihrme', label: 'IHR M&E', type: 'textarea', maxWords: 100 },
        ],
    },
    {
        title: 'IPC',
        icon: <Shield className="w-4 h-4" />,
        fields: [
            { key: 'ipc', label: 'IPC', type: 'textarea', maxWords: 50 },
        ],
    },
    {
        title: 'Readiness',
        icon: <CheckCircle2 className="w-4 h-4" />,
        orangeHighlight: true,
        fields: [
            { key: 'readiness', label: 'Readiness', type: 'textarea', maxWords: 50 },
        ],
    },
    {
        title: 'NAPHS',
        icon: <Activity className="w-4 h-4" />,
        orangeHighlight: true,
        fields: [
            { key: 'naphs', label: 'NAPHS', type: 'textarea', maxWords: 50 },
        ],
    },
    {
        title: 'Community Protection',
        icon: <Users className="w-4 h-4" />,
        orangeHighlight: true,
        fields: [
            { key: 'community_protection', label: 'Community Protection', type: 'textarea', maxWords: 50 },
        ],
    },
    {
        title: 'Workforce and Training',
        icon: <TrendingUp className="w-4 h-4" />,
        orangeHighlight: true,
        fields: [
            { key: 'workforce_training', label: 'Workforce and Training', type: 'textarea', maxWords: 50 },
        ],
    },
    {
        title: 'Pandemic Influenza',
        icon: <Bug className="w-4 h-4" />,
        orangeHighlight: true,
        fields: [
            { key: 'pandemic_influenza', label: 'Pandemic Influenza', type: 'textarea', maxWords: 50 },
        ],
    },
    {
        title: 'Vaccines and Research',
        icon: <Beaker className="w-4 h-4" />,
        orangeHighlight: true,
        fields: [
            { key: 'vaccines_research', label: 'Vaccines and Research', type: 'textarea', maxWords: 50 },
        ],
    },
    {
        title: 'Diseases under Elimination',
        icon: <CheckCircle2 className="w-4 h-4" />,
        fields: [
            { key: 'diseases_under_elimination', label: 'Diseases under Elimination', type: 'textarea', maxWords: 100 },
        ],
    },
    {
        title: 'Innovative Projects',
        icon: <Lightbulb className="w-4 h-4" />,
        fields: [
            { key: 'innovative_projects', label: 'Innovative Projects', type: 'textarea', maxWords: 50 },
        ],
    },
    {
        title: 'OSL',
        icon: <Activity className="w-4 h-4" />,
        fields: [
            { key: 'osl', label: 'Operations Support and Logistics (OSL)', type: 'textarea', maxWords: 50 },
        ],
    },
    {
        title: 'HEDRM',
        icon: <Shield className="w-4 h-4" />,
        fields: [
            {
                key: 'hedrm',
                label: 'Health emergency Disaster Risk Management',
                type: 'textarea',
                maxWords: 50,
                placeholder: 'On going support and engagement of WCOs and MOH on their role in collecting and reporting progress in implementing Health EDRM and reporting data that are relevant for the Sendai Framework targets and other related frameworks, such as the Sustainable Development Goals (SDGs)'
            },
        ],
    },
];

/* ───── Reusable UI Components ───── */

const SavingIndicator = ({ saving, saved, isLight }: { saving: boolean; saved: boolean; isLight: boolean }) => {
    if (saving) return (
        <span className={`inline-flex items-center gap-1.5 text-[10px] ${isLight ? 'text-blue-500' : 'text-cyan-400'} font-medium animate-pulse`}>
            <Loader2 className="w-3 h-3 animate-spin" /> Saving...
        </span>
    );
    if (saved) return (
        <span className="inline-flex items-center gap-1.5 text-[10px] text-green-500 font-medium">
            <CheckCircle2 className="w-3 h-3" /> Saved
        </span>
    );
    return null;
};

interface AutoSaveFieldProps {
    fieldKey: string;
    label: string;
    value: string;
    type: 'text' | 'textarea';
    isLight: boolean;
    maxWords?: number;
    placeholder?: string;
    onSave: (key: string, value: string) => Promise<void>;
}

const AutoSaveField: React.FC<AutoSaveFieldProps> = ({
    fieldKey, label, value: initialValue, type, isLight, maxWords, placeholder, onSave,
}) => {
    const [localValue, setLocalValue] = useState(initialValue);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [wordCount, setWordCount] = useState(0);
    const savedTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
    const lastSavedRef = useRef(initialValue);

    const countWords = (text: string) => {
        return text.trim().split(/\s+/).filter(w => w.length > 0).length;
    };

    useEffect(() => {
        setLocalValue(initialValue);
        setWordCount(countWords(initialValue));
        lastSavedRef.current = initialValue;
    }, [initialValue]);

    const handleChange = (val: string) => {
        let finalValue = val;
        let finalCount = countWords(val);

        if (maxWords && finalCount > maxWords) {
            let currentWordCount = 0;
            let lastIndex = 0;
            const regex = /\S+/g;
            let match;
            while ((match = regex.exec(val)) !== null) {
                currentWordCount++;
                if (currentWordCount === maxWords) {
                    lastIndex = match.index + match[0].length;
                    break;
                }
            }
            finalValue = val.substring(0, lastIndex);
            finalCount = maxWords;
        }

        setLocalValue(finalValue);
        setWordCount(finalCount);
    };

    const handleBlur = useCallback(async () => {
        if (localValue === lastSavedRef.current) return;
        setSaving(true);
        setSaved(false);
        try {
            await onSave(fieldKey, localValue);
            lastSavedRef.current = localValue;
            setSaved(true);
            savedTimerRef.current = setTimeout(() => setSaved(false), 2500);
        } catch { } finally {
            setSaving(false);
        }
    }, [fieldKey, localValue, onSave]);

    useEffect(() => () => { if (savedTimerRef.current) clearTimeout(savedTimerRef.current); }, []);

    const inputClasses = `w-full px-4 py-3 border rounded-xl text-sm font-medium transition-all duration-200 shadow-sm focus:outline-none focus:ring-2 ${isLight
        ? 'bg-gray-50/50 border-gray-200 text-gray-800 placeholder:text-gray-400 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white'
        : 'bg-[#0a1128]/50 border-white/10 text-white placeholder:text-gray-500 focus:ring-cyan-500/20 focus:border-cyan-400 focus:bg-[#0a1128]'
        }`;

    return (
        <div className="mb-4 group">
            <div className="flex items-center justify-between mb-1.5 ml-1">
                <label className={`text-[11px] font-bold uppercase tracking-wider transition-colors ${isLight ? 'text-gray-500 group-focus-within:text-blue-500' : 'text-gray-400 group-focus-within:text-cyan-400'
                    }`}>
                    {label}
                </label>
                <div className="flex items-center gap-3">
                    {maxWords && (
                        <span className={`text-[9px] font-bold uppercase tracking-wider ${wordCount >= maxWords
                            ? 'text-red-500 animate-pulse'
                            : wordCount >= maxWords * 0.9
                                ? 'text-amber-500'
                                : (isLight ? 'text-gray-400' : 'text-gray-600')
                            }`}>
                            {wordCount} / {maxWords} WORDS
                        </span>
                    )}
                    <SavingIndicator saving={saving} saved={saved} isLight={isLight} />
                </div>
            </div>
            {type === 'textarea' ? (
                <textarea
                    value={localValue}
                    onChange={(e) => handleChange(e.target.value)}
                    onBlur={handleBlur}
                    rows={3}
                    placeholder={placeholder}
                    className={inputClasses + " resize-y"}
                />
            ) : (
                <input
                    type="text"
                    value={localValue}
                    onChange={(e) => handleChange(e.target.value)}
                    onBlur={handleBlur}
                    placeholder={placeholder}
                    className={inputClasses}
                />
            )}
        </div>
    );
};

/* ───── Image Upload Button ───── */

interface ImageUploadButtonProps {
    fieldKey: string;
    token: string;
    currentImageUrl: string | null;
    isLight: boolean;
    onUploadSuccess: (fieldKey: string, imageUrl: string) => void;
    onDelete: (fieldKey: string) => Promise<void>;
}

const ImageUploadButton: React.FC<ImageUploadButtonProps> = ({
    fieldKey, token, currentImageUrl, isLight, onUploadSuccess, onDelete,
}) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(currentImageUrl);
    const [showDeleteModal, setShowDeleteModal] = useState(false);

    useEffect(() => {
        setPreviewUrl(currentImageUrl);
    }, [currentImageUrl]);

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Show local preview immediately
        const localPreview = URL.createObjectURL(file);
        setPreviewUrl(localPreview);
        setUploading(true);

        try {
            const formData = new FormData();
            formData.append('token', token);
            formData.append('field_name', fieldKey);
            formData.append('image', file);

            const res = await api.post(`${API_BASE}/readiness/upload-report-image`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });

            const imageData = res.data?.data?.image_data;
            if (imageData) {
                onUploadSuccess(fieldKey, imageData);
                // Use the base64 data URL directly
                setPreviewUrl(imageData);
            }
        } catch (err) {
            logger.error('Image upload failed:', err);
            setPreviewUrl(currentImageUrl);
        } finally {
            setUploading(false);
            URL.revokeObjectURL(localPreview);
            // Reset input so same file can be re-selected
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleDeleteClick = () => {
        setShowDeleteModal(true);
    };

    const confirmDelete = async () => {
        setShowDeleteModal(false);
        setUploading(true);
        try {
            await onDelete(fieldKey);
            setPreviewUrl(null);
            onUploadSuccess(fieldKey, '');
        } catch (err) {
            logger.error('Failed to delete image:', err);
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="mb-6">
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
            />

            {previewUrl ? (
                <div className="relative group">
                    <div className={`rounded-xl overflow-hidden border-2 border-dashed transition-all ${isLight ? 'border-blue-200 bg-blue-50/30' : 'border-cyan-500/20 bg-cyan-500/5'
                        }`}>
                        <img
                            src={previewUrl}
                            alt="Uploaded"
                            className="w-full max-h-48 object-contain rounded-lg"
                        />
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploading}
                            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${isLight
                                ? 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                                : 'bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20'
                                } ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            {uploading ? (
                                <><Loader2 className="w-3 h-3 animate-spin" /> Uploading...</>
                            ) : (
                                <><Upload className="w-3 h-3" /> Change Image</>
                            )}
                        </button>
                        <button
                            onClick={handleDeleteClick}
                            disabled={uploading}
                            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${isLight
                                ? 'bg-red-50 text-red-600 hover:bg-red-100'
                                : 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                                } ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                            title="Delete Image"
                        >
                            <Trash2 className="w-3 h-3" /> Delete
                        </button>
                    </div>
                </div>
            ) : (
                <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className={`w-full flex items-center justify-center gap-3 py-4 px-6 rounded-xl border-2 border-dashed transition-all duration-200 ${isLight
                        ? 'border-gray-200 bg-gray-50/50 text-gray-400 hover:border-blue-300 hover:bg-blue-50/50 hover:text-blue-500'
                        : 'border-white/10 bg-white/[0.02] text-gray-500 hover:border-cyan-500/30 hover:bg-cyan-500/5 hover:text-cyan-400'
                        } ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                    {uploading ? (
                        <><Loader2 className="w-5 h-5 animate-spin" /> <span className="text-xs font-bold uppercase tracking-wider">Uploading...</span></>
                    ) : (
                        <><ImagePlus className="w-5 h-5" /> <span className="text-xs font-bold uppercase tracking-wider">Attach Image</span></>
                    )}
                </button>
            )}

            {/* Custom Delete Confirmation Modal */}
            {showDeleteModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-[#0F172A]/80 backdrop-blur-sm">
                    <div className={`w-full max-w-sm rounded-[1.5rem] p-8 shadow-2xl relative ${isLight ? 'bg-white' : 'bg-[#1e293b]'}`}>
                        <div className="flex flex-col items-center text-center">
                            <div className={`h-12 w-12 rounded-2xl flex items-center justify-center mb-6 ${isLight ? 'bg-red-50 text-red-500' : 'bg-red-500/10 text-red-400'}`}>
                                <Trash2 size={20} />
                            </div>
                            <h3 className={`text-xl font-black uppercase tracking-tight mb-2 ${isLight ? 'text-slate-900' : 'text-white'}`}>
                                Remove Image?
                            </h3>
                            <p className={`text-sm font-medium leading-relaxed mb-8 ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                                Are you sure you want to remove this image? This action cannot be undone.
                            </p>
                            <div className="flex gap-4 w-full">
                                <button
                                    onClick={() => setShowDeleteModal(false)}
                                    className={`flex-1 py-3 px-4 rounded-xl font-bold transition-colors ${isLight
                                        ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                        : 'bg-white/10 text-white hover:bg-white/20'
                                        }`}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={confirmDelete}
                                    className="flex-1 py-3 px-4 rounded-xl font-bold bg-red-500 text-white hover:bg-red-600 transition-colors shadow-lg shadow-red-500/30"
                                >
                                    Remove
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

/* ───── Section Header ───── */

const SectionHeader: React.FC<{ title: string; icon: React.ReactNode; isLight: boolean; orangeHighlight?: boolean }> = ({
    title, icon, isLight, orangeHighlight,
}) => (
    <div className={`flex items-center gap-3 mb-5 mt-8 first:mt-0 pb-2 border-b ${orangeHighlight
        ? (isLight ? 'border-[#E8A838]/30' : 'border-[#E8A838]/20')
        : (isLight ? 'border-gray-100' : 'border-white/5')
        }`}>
        <div className={`p-1.5 rounded-lg ${orangeHighlight
            ? 'bg-[#E8A838]/10 text-[#E8A838]'
            : (isLight ? 'bg-blue-500/10 text-blue-500' : 'bg-cyan-500/10 text-cyan-400')
            }`}>
            {icon}
        </div>
        <h3 className={`text-sm font-bold uppercase tracking-widest ${orangeHighlight
            ? 'text-[#E8A838]'
            : (isLight ? 'text-blue-600' : 'text-cyan-400')
            }`}>
            {title}
        </h3>
    </div>
);

/* ───── Left Panel ───── */

const LeftPanel = ({ weekRange, isLight }: { weekRange: string; isLight: boolean }) => (
    <div
        className="w-full md:w-[380px] shrink-0 relative overflow-hidden flex flex-col items-center justify-center py-16 md:py-12"
        style={{
            background: isLight
                ? 'linear-gradient(160deg, #4a9fd8 0%, #2980C4 40%, #1a5a8a 100%)'
                : 'linear-gradient(160deg, #0a1128 0%, #001f3f 40%, #000814 100%)'
        }}
    >
        {/* Decorative elements */}
        <div className="absolute top-[-80px] right-[-80px] w-[300px] h-[300px] rounded-full bg-white/5 blur-3xl animate-pulse" />
        <div className="absolute bottom-[-60px] left-[-60px] w-[220px] h-[220px] rounded-full bg-cyan-500/10 blur-2xl" />
        <div className="absolute top-[30%] left-[-20px] w-32 h-32 rounded-full border border-white/5" />
        <div className="absolute bottom-[20%] right-[-20px] w-48 h-48 rounded-full border border-cyan-500/5" />

        <div className="relative z-10 text-center px-10">

            <img src="/logo.png" alt="WHO Logo" className="w-32 h-auto mx-auto mb-6" />
            <div className={`w-20 h-1.5 mx-auto mb-8 rounded-full ${isLight ? 'bg-[#E8A838]' : 'bg-cyan-400'}`} />

            <h2 className="text-white text-[32px] font-black tracking-tight leading-none uppercase mb-1">
                PREPAREDNESS
            </h2>
            <h3 className={`${isLight ? 'text-[#E8A838]' : 'text-cyan-400'} text-xl font-bold uppercase tracking-wider`}>
                This Week
            </h3>

            {weekRange && (
                <div className="mt-8 inline-flex items-center gap-2.5 px-5 py-2.5 bg-white/10 backdrop-blur-md rounded-2xl border border-white/10 shadow-xl">
                    <Calendar className="w-4 h-4 text-cyan-400" />
                    <span className="text-white text-sm font-bold">{weekRange}</span>
                </div>
            )}

            <p className="text-white/60 text-xs mt-10 leading-relaxed max-w-[240px] mx-auto font-medium">
                Consolidated updates on Health Emergency, Pandemics, and Threats Preparedness (HEP).
            </p>

            <div className="w-12 h-1 bg-white/10 mx-auto mt-10 rounded-full" />

            <div className="mt-8 flex flex-col items-center gap-2 opacity-60">
                <Globe className="w-5 h-5 text-white" />
                <p className="text-white text-[9px] uppercase tracking-[0.3em] font-black">
                    WHO African Region
                </p>
            </div>
        </div>
    </div>
);

/* ───── Expired / Invalid Screens ───── */

const ExpiredScreen = ({ isLight, onRefresh }: { isLight: boolean; onRefresh: () => void }) => (
    <div className={`flex-1 flex items-center justify-center p-8 md:p-12 ${isLight ? 'bg-white' : 'bg-[#0a1128]'}`}>
        <div className="w-full max-w-md text-center">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 ${isLight ? 'bg-amber-100' : 'bg-amber-500/10'}`}>
                <Clock className="w-8 h-8 text-amber-500" />
            </div>
            <h2 className={`text-xl font-bold mb-3 ${isLight ? 'text-gray-900' : 'text-white'}`}>Link Expired</h2>
            <p className={`text-sm leading-relaxed mb-8 ${isLight ? 'text-gray-600' : 'text-gray-400'}`}>
                This link has expired. Links are valid for 24 hours only.<br />
                Please request a new link from your supervisor or try refreshing if it was just reactivated.
            </p>
            <button
                onClick={onRefresh}
                className={`inline-flex items-center gap-2 px-6 py-3 rounded-2xl font-bold text-sm transition-all shadow-lg active:scale-95
                    ${isLight ? 'bg-blue-600 text-white shadow-blue-200 hover:bg-blue-700' : 'bg-cyan-400 text-black shadow-cyan-400/20 hover:bg-cyan-300'}`}
            >
                <RefreshCcw className="w-4 h-4" />
                Refresh Link Status
            </button>
        </div>
    </div>
);

const InvalidScreen = ({ isLight }: { isLight: boolean }) => (
    <div className={`flex-1 flex items-center justify-center p-8 md:p-12 ${isLight ? 'bg-white' : 'bg-[#0a1128]'}`}>
        <div className="w-full max-w-md text-center">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 ${isLight ? 'bg-red-100' : 'bg-red-500/10'}`}>
                <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            <h2 className={`text-xl font-bold mb-3 ${isLight ? 'text-gray-900' : 'text-white'}`}>Invalid Link</h2>
            <p className={`text-sm leading-relaxed ${isLight ? 'text-gray-600' : 'text-gray-400'}`}>
                This link is invalid or has been deactivated.<br />
                Please contact your supervisor for a valid link.
            </p>
        </div>
    </div>
);

const LoadingScreen = ({ isLight }: { isLight: boolean }) => (
    <div className={`flex-1 flex items-center justify-center p-8 md:p-12 ${isLight ? 'bg-white' : 'bg-[#0a1128]'}`}>
        <div className="w-full max-w-md text-center">
            <Loader2 className={`w-10 h-10 animate-spin mx-auto mb-4 ${isLight ? 'text-blue-500' : 'text-cyan-400'}`} />
            <p className={`text-sm font-medium ${isLight ? 'text-gray-500' : 'text-gray-400'}`}>Validating link...</p>
        </div>
    </div>
);

/* ───── Main Component ───── */

const PreparednessForm = () => {
    const { showToast } = useToast();
    const { theme } = useTheme();
    const isLight = theme === 'light';
    const [pageState, setPageState] = useState<PageState>('loading');
    const [token, setToken] = useState('');
    const [weekRange, setWeekRange] = useState('');
    const [expiresAt, setExpiresAt] = useState('');
    const [reportData, setReportData] = useState<ReportData | null>(null);
    const [submitted, setSubmitted] = useState(false);

    const handleImageUploadSuccess = useCallback((fieldKey: string, imageUrl: string) => {
        setReportData(prev => prev ? { ...prev, [fieldKey]: imageUrl } : prev);
    }, []);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const urlToken = params.get('token');
        if (!urlToken) {
            setPageState('invalid');
            return;
        }
        setToken(urlToken);
        validateToken(urlToken);
    }, []);

    const validateToken = async (t: string) => {
        try {
            const res = await api.get(`${API_BASE}/readiness/validate-link/${t}?_=${Date.now()}`);
            const data = res.data.data;
            setWeekRange(data.week_range);
            setExpiresAt(data.expires_at);
            setReportData(data.report);
            setPageState('form');
        } catch (err: any) {
            const httpStatus = err?.response?.status;
            if (httpStatus === 410) setPageState('expired');
            else setPageState('invalid');
        }
    };

    const handleFieldSave = useCallback(async (fieldName: string, value: string) => {
        try {
            await api.patch(`${API_BASE}/readiness/update-field`, {
                token,
                field_name: fieldName,
                value,
            });
        } catch (err: any) {
            const msg = err?.response?.data?.message || 'Failed to save. Please try again.';
            showToast(msg, 'error');
            throw err;
        }
    }, [token, showToast]);

    const [timeLeft, setTimeLeft] = useState('');
    useEffect(() => {
        if (!expiresAt) return;
        const tick = () => {
            const now = new Date().getTime();
            const exp = new Date(expiresAt).getTime();
            const diff = exp - now;
            if (diff <= 0) {
                setTimeLeft('Expired');
                setPageState('expired');
                return;
            }
            const hrs = Math.floor(diff / 3600000);
            const mins = Math.floor((diff % 3600000) / 60000);
            setTimeLeft(`${hrs}h ${mins}m remaining`);
        };
        tick();
        const interval = setInterval(tick, 60000);
        return () => clearInterval(interval);
    }, [expiresAt]);

    const renderForm = () => {
        const isLight = true; // Force white background/light theme for the form section
        if (!reportData) return null;
        const hepStartIdx = 3;

        return (
            <div className={`flex-1 h-auto md:h-full md:overflow-y-auto ${isLight ? 'bg-white' : 'bg-[#0a1128]'}`}>
                <div className="px-6 py-8 md:px-12 md:pt-14 md:pb-24 max-w-4xl mx-auto">

                    {/* Header bar */}
                    <div className={`mb-10 pb-8 border-b flex flex-col md:flex-row md:items-end justify-between gap-6 ${isLight ? 'border-gray-100' : 'border-white/5'}`}>
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                                <span className={`text-[10px] font-black uppercase tracking-[0.2em] px-2 py-0.5 rounded ${isLight ? 'bg-blue-50 text-blue-600' : 'bg-cyan-500/10 text-cyan-400'}`}>
                                    Reporting Portal
                                </span>
                            </div>
                            <h1 className={`text-3xl md:text-4xl font-black tracking-tight ${isLight ? 'text-gray-900' : 'text-white'}`}>
                                Preparedness — <span className={isLight ? 'text-blue-600' : 'text-cyan-400'}>Weekly Update</span>
                            </h1>
                            <div className="flex flex-wrap items-center gap-4 mt-4">
                                <p className={`text-sm font-bold flex items-center gap-2 ${isLight ? 'text-gray-500' : 'text-gray-400'}`}>
                                    <Calendar className={`w-4 h-4 ${isLight ? 'text-blue-500' : 'text-cyan-400'}`} />
                                    Week of {weekRange}
                                </p>
                                {timeLeft && (
                                    <span className={`text-xs font-bold flex items-center gap-2 px-3 py-1 rounded-full border ${isLight ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                        }`}>
                                        <Clock className="w-3.5 h-3.5" /> {timeLeft}
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="flex flex-col items-end gap-2 shrink-0">
                            <div className={`px-4 py-2 text-xs font-black uppercase tracking-wider rounded-xl border flex items-center gap-2.5 shadow-sm ${isLight ? 'bg-green-50 text-green-700 border-green-100' : 'bg-green-500/10 text-green-400 border-green-500/20'
                                }`}>
                                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                Live Collaboration
                            </div>
                        </div>
                    </div>

                    {/* Auto-save hint */}
                    <div className={`mb-10 p-5 rounded-2xl flex items-start gap-4 border transition-all ${isLight
                        ? 'bg-blue-50/40 border-blue-100 text-blue-800'
                        : 'bg-cyan-500/5 border-cyan-500/10 text-cyan-100'
                        }`}>
                        <div className={`p-2 rounded-lg ${isLight ? 'bg-blue-500 text-white' : 'bg-cyan-400 text-black'}`}>
                            <Save className="w-4 h-4" />
                        </div>
                        <div className="flex-1">
                            <h4 className="text-sm font-black uppercase tracking-wider mb-1">Auto-Save Enabled</h4>
                            <p className={`text-xs font-medium opacity-80 leading-relaxed`}>
                                All changes are saved automatically when you move between fields. This is a shared form for all HEP departments.
                            </p>
                        </div>
                    </div>

                    {/* Top Sections */}
                    {SECTIONS.slice(0, hepStartIdx).map((section) => (
                        <div key={section.title} className="mb-12">
                            <SectionHeader
                                title={section.title}
                                icon={section.icon}
                                isLight={isLight}
                                orangeHighlight={section.orangeHighlight}
                            />
                            <div className={section.fields.length > 1 ? 'grid grid-cols-1 md:grid-cols-2 gap-x-8' : ''}>
                                {section.fields.map((field) => (
                                    <AutoSaveField
                                        key={field.key}
                                        fieldKey={field.key}
                                        label={field.label}
                                        value={(reportData[field.key] as string) || ''}

                                        type={field.type}
                                        isLight={isLight}
                                        maxWords={field.maxWords}
                                        placeholder={field.placeholder}
                                        onSave={handleFieldSave}
                                    />
                                ))}
                            </div>
                            {/* Image upload for Featured Achievement & Key Figures */}
                            {section.fields.some(f => f.key === 'featured_achievement') && (
                                <ImageUploadButton
                                    fieldKey="featured_achievement_image"
                                    token={token}
                                    currentImageUrl={reportData.featured_achievement_image}
                                    isLight={isLight}
                                    onUploadSuccess={handleImageUploadSuccess}
                                    onDelete={async (key) => { await handleFieldSave(key, ''); }}
                                />
                            )}
                            {section.fields.some(f => f.key === 'key_figures') && (
                                <ImageUploadButton
                                    fieldKey="key_figures_image"
                                    token={token}
                                    currentImageUrl={reportData.key_figures_image}
                                    isLight={isLight}
                                    onUploadSuccess={handleImageUploadSuccess}
                                    onDelete={async (key) => { await handleFieldSave(key, ''); }}
                                />
                            )}
                        </div>
                    ))}

                    {/* HEP at Glance heading */}
                    <div className="mt-16 mb-12">
                        <div className={`flex items-center gap-4 pb-4 border-b-2 ${isLight ? 'border-blue-600' : 'border-cyan-400'}`}>
                            <div className={`p-2.5 rounded-xl shadow-lg ${isLight ? 'bg-blue-600 text-white' : 'bg-cyan-400 text-black'}`}>
                                <Globe className="w-6 h-6" />
                            </div>
                            <div>
                                <h2 className={`text-2xl font-black uppercase tracking-[0.1em] ${isLight ? 'text-blue-700' : 'text-cyan-400'}`}>
                                    HEP at Glance
                                </h2>
                                <p className={`text-[10px] font-bold uppercase tracking-[0.2em] mt-1 ${isLight ? 'text-gray-400' : 'text-gray-500'}`}>
                                    Strategic Pillars & Monitoring
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* HEP at Glance sections */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12">
                        {SECTIONS.slice(hepStartIdx).map((section) => (
                            <div key={section.title} className="mb-8">
                                <SectionHeader
                                    title={section.title}
                                    icon={section.icon}
                                    isLight={isLight}
                                    orangeHighlight={section.orangeHighlight}
                                />
                                {section.fields.map((field) => (
                                    <AutoSaveField
                                        key={field.key}
                                        fieldKey={field.key}
                                        label={field.label}
                                        value={(reportData[field.key] as string) || ''}

                                        type={field.type}
                                        isLight={isLight}
                                        maxWords={field.maxWords}
                                        placeholder={field.placeholder}
                                        onSave={handleFieldSave}
                                    />
                                ))}
                            </div>
                        ))}
                    </div>

                    {/* Done / Submit Button */}
                    <div className={`mt-16 mb-12 p-8 rounded-3xl border text-center transition-all duration-500 ${submitted
                        ? (isLight ? 'bg-green-50 border-green-100' : 'bg-green-500/5 border-green-500/10')
                        : (isLight ? 'bg-gray-50 border-gray-100' : 'bg-white/5 border-white/5')
                        }`}>
                        {submitted ? (
                            <div className="flex flex-col items-center gap-4 animate-in fade-in zoom-in duration-500">
                                <div className={`w-20 h-20 rounded-full flex items-center justify-center shadow-xl ${isLight ? 'bg-green-500 text-white' : 'bg-green-400 text-black'}`}>
                                    <CheckCircle2 className="w-10 h-10" />
                                </div>
                                <div>
                                    <h4 className={`text-2xl font-black mb-2 ${isLight ? 'text-green-700' : 'text-green-400'}`}>Report Finalized</h4>
                                    <p className={`text-sm font-medium max-w-sm mx-auto ${isLight ? 'text-gray-600' : 'text-gray-400'}`}>
                                        Your updates have been consolidated. You alignment with regional preparedeness goals is appreciated.
                                    </p>
                                </div>
                                <button
                                    onClick={() => setSubmitted(false)}
                                    className={`mt-4 text-xs font-bold uppercase tracking-widest flex items-center gap-2 mx-auto ${isLight ? 'text-blue-600' : 'text-cyan-400'}`}
                                >
                                    <RefreshCcw className="w-3 h-3" /> Edit Fields
                                </button>
                            </div>
                        ) : (
                            <div className="max-w-md mx-auto">
                                <h3 className={`text-xl font-black mb-2 ${isLight ? 'text-gray-900' : 'text-white'}`}>Ready to submit?</h3>
                                <p className={`text-sm font-medium mb-8 ${isLight ? 'text-gray-500' : 'text-gray-400'}`}>
                                    Ensure all pillars have been updated for the current epidemiological week.
                                </p>
                                <button
                                    onClick={() => {
                                        setSubmitted(true);
                                        showToast('Report submitted successfully!', 'success');
                                    }}
                                    className={`w-full py-5 rounded-2xl font-black text-sm uppercase tracking-[0.2em] transition-all duration-300 shadow-xl hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98] ${isLight
                                        ? 'bg-blue-600 text-white shadow-blue-500/20'
                                        : 'bg-cyan-400 text-black shadow-cyan-400/20'
                                        }`}
                                >
                                    Finalize Report
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className={`pt-10 border-t flex flex-col items-center gap-6 ${isLight ? 'border-gray-100' : 'border-white/5'}`}>
                        <p className={`text-[10px] font-black uppercase tracking-[0.3em] ${isLight ? 'text-gray-300' : 'text-gray-600'}`}>
                            WHO AFRICAN REGION · Preparedness Weekly Report
                        </p>
                    </div>

                </div>
            </div>
        );
    };

    const renderContent = () => {
        switch (pageState) {
            case 'loading':
                return <LoadingScreen isLight={isLight} />;
            case 'expired':
                return <ExpiredScreen isLight={isLight} onRefresh={() => validateToken(token)} />;
            case 'invalid':
                return <InvalidScreen isLight={isLight} />;
            case 'form':
                return renderForm();
        }
    };

    return (
        <div
            className={`w-full min-h-screen flex flex-col md:justify-center items-center p-0 md:p-8 font-Fellix transition-colors duration-500 ${isLight ? 'bg-[#f0f9ff]' : 'bg-[#050b1a]'
                }`}
            style={{
                backgroundImage: isLight
                    ? 'radial-gradient(at 0% 0%, #e0f2fe 0%, transparent 50%), radial-gradient(at 100% 100%, #fef3c7 0%, transparent 50%)'
                    : 'radial-gradient(at 0% 0%, #0a1128 0%, transparent 50%), radial-gradient(at 100% 100%, #0c1425 0%, transparent 50%)'
            }}
        >
            <div className={`w-full max-w-[1240px] rounded-none md:rounded-[40px] shadow-none md:shadow-[0_40px_100px_-20px_rgba(0,0,0,0.3)] overflow-hidden flex flex-col md:flex-row min-h-screen md:min-h-[700px] md:h-[90vh] transition-all duration-500 border ${isLight ? 'bg-white border-white/50' : 'bg-[#0a1128] border-white/5'
                }`}>
                <LeftPanel weekRange={weekRange} isLight={isLight} />
                {renderContent()}
            </div>
        </div>
    );
};

export default PreparednessForm;
