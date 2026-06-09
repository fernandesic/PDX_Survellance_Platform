import React, { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { ImagePlus, Loader2, Star, Trash2 } from 'lucide-react';
import SavingIndicator from './SavingIndicator';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

export interface HighlightItem {
    id: string;
    image_data: string;
    caption: string;
    date: string;
    is_highlight: boolean;
}

interface WeeklyHighlightSectionProps {
    token: string;
    highlights: HighlightItem[];
    /** Persist the entire highlights array (caption/date/star edits, deletions). */
    onSave: (highlights: HighlightItem[]) => Promise<void>;
}

/**
 * Section 5b — Weekly Highlights
 * Form fillers upload N pictures; each has a caption + date input;
 * exactly one is marked as the "highlight of the week" via a star toggle.
 */
const WeeklyHighlightSection: React.FC<WeeklyHighlightSectionProps> = ({
    token, highlights, onSave,
}) => {
    const [rows, setRows] = useState<HighlightItem[]>(highlights || []);
    const [uploading, setUploading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const debounceRef = useRef<ReturnType<typeof setTimeout>>();
    const savedTimerRef = useRef<ReturnType<typeof setTimeout>>();
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Sync from the parent on initial load and when server data legitimately
    // changes. Do NOT replace a non-empty local list with an empty incoming
    // one — that path means the parent simply lost the reference (e.g. an
    // unrelated render created a fresh `|| []`) and would wipe out a freshly-
    // uploaded photo for a brief moment.
    useEffect(() => {
        if (!highlights || highlights.length === 0) return;
        setRows(highlights);
    }, [highlights]);

    const triggerSave = useCallback((next: HighlightItem[]) => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(async () => {
            setSaving(true);
            setSaved(false);
            try {
                await onSave(next);
                setSaved(true);
                savedTimerRef.current = setTimeout(() => setSaved(false), 2500);
            } catch { /* swallow — autosave is best-effort */ }
            finally { setSaving(false); }
        }, 600);
    }, [onSave]);

    useEffect(() => () => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    }, []);

    const handleSelectFile = useCallback(() => fileInputRef.current?.click(), []);

    const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = ''; // reset so the same file can be re-picked
        if (!file) return;
        if (!file.type.startsWith('image/')) { alert('Please choose an image file.'); return; }
        if (file.size > 6 * 1024 * 1024) { alert('Image is larger than 6 MB.'); return; }

        setUploading(true);
        try {
            const form = new FormData();
            form.append('token', token);
            form.append('image', file);
            form.append('caption', '');
            form.append('date', new Date().toISOString().split('T')[0]);
            const res = await axios.post(`${API_BASE}/sitrep/upload-highlight`, form, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            const next = (res.data?.data?.weekly_highlights || res.data?.weekly_highlights) as HighlightItem[] | undefined;
            if (next) setRows(next);
        } catch (err: any) {
            alert(err?.response?.data?.message || err?.message || 'Upload failed.');
        } finally {
            setUploading(false);
        }
    }, [token]);

    const updateField = useCallback((id: string, key: 'caption' | 'date', val: string) => {
        setRows((prev) => {
            const next = prev.map((r) => (r.id === id ? { ...r, [key]: val } : r));
            triggerSave(next);
            return next;
        });
    }, [triggerSave]);

    const setHighlight = useCallback((id: string) => {
        setRows((prev) => {
            const next = prev.map((r) => ({ ...r, is_highlight: r.id === id }));
            triggerSave(next);
            return next;
        });
    }, [triggerSave]);

    const removeItem = useCallback((id: string) => {
        setRows((prev) => {
            let next = prev.filter((r) => r.id !== id);
            // If we just removed the highlight, promote the first remaining item.
            if (next.length > 0 && !next.some((r) => r.is_highlight)) {
                next = next.map((r, i) => ({ ...r, is_highlight: i === 0 }));
            }
            triggerSave(next);
            return next;
        });
    }, [triggerSave]);

    return (
        <div className="mb-6">
            {/* Section Header (matches sibling sections) */}
            <div className="flex items-center justify-between px-5 py-3.5 bg-gradient-to-r from-[#1a2744] to-[#2c3e6b] rounded-t-xl">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                        <Star className="w-4 h-4 text-white" fill="currentColor" />
                    </div>
                    <h3 className="text-white font-bold text-base">Weekly Highlight — Photos</h3>
                </div>
                <div className="flex items-center gap-3">
                    <SavingIndicator saving={saving} saved={saved} />
                </div>
            </div>

            {/* Body */}
            <div className="bg-white border border-gray-100 border-t-0 rounded-b-xl p-5 shadow-sm">
                <p className="text-sm text-gray-600 mb-4">
                    Upload high-quality photos from the field this week. Add a short caption and date for each.
                    Click the star to pick the one that should be the <strong>Highlight of the Week</strong>.
                </p>

                {rows.length === 0 ? (
                    <div className="rounded-xl border-2 border-dashed border-gray-200 p-8 text-center text-sm text-gray-400">
                        No photos uploaded yet.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {rows.map((item) => (
                            <div
                                key={item.id}
                                className={`relative rounded-xl border overflow-hidden transition-all ${
                                    item.is_highlight
                                        ? 'border-amber-400 ring-2 ring-amber-200 shadow-sm'
                                        : 'border-gray-200'
                                }`}
                            >
                                {item.is_highlight && (
                                    <div className="absolute top-2 left-2 z-10 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-black uppercase tracking-wider shadow">
                                        <Star className="w-3 h-3" fill="currentColor" /> Highlight
                                    </div>
                                )}
                                <button
                                    type="button"
                                    onClick={() => removeItem(item.id)}
                                    title="Remove photo"
                                    className="absolute top-2 right-2 z-10 p-1.5 rounded-md bg-white/90 text-gray-500 hover:text-red-500 hover:bg-white shadow-sm"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                                <img
                                    src={item.image_data}
                                    alt={item.caption || 'Weekly highlight photo'}
                                    className="w-full h-44 object-cover bg-gray-100"
                                />
                                <div className="p-3 space-y-2">
                                    <input
                                        type="text"
                                        value={item.caption}
                                        onChange={(e) => updateField(item.id, 'caption', e.target.value)}
                                        placeholder="Caption…"
                                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-800 placeholder:text-gray-400 outline-none focus:border-[#4a9fd8] focus:bg-white transition-colors"
                                    />
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="date"
                                            value={item.date || ''}
                                            onChange={(e) => updateField(item.id, 'date', e.target.value)}
                                            className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 outline-none focus:border-[#4a9fd8] focus:bg-white cursor-pointer"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setHighlight(item.id)}
                                            disabled={item.is_highlight}
                                            className={`inline-flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                                                item.is_highlight
                                                    ? 'bg-amber-100 text-amber-700 cursor-default'
                                                    : 'bg-gray-100 text-gray-500 hover:bg-amber-100 hover:text-amber-700'
                                            }`}
                                            title="Mark as highlight of the week"
                                        >
                                            <Star className="w-3.5 h-3.5" fill={item.is_highlight ? 'currentColor' : 'none'} />
                                            {item.is_highlight ? 'Highlight' : 'Pick'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Upload control */}
                <div className="mt-4 flex items-center gap-3">
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleFileChange}
                        className="hidden"
                    />
                    <button
                        type="button"
                        onClick={handleSelectFile}
                        disabled={uploading}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-[#1a2744] text-white text-sm font-bold rounded-lg hover:bg-[#253557] transition-colors active:scale-95 disabled:opacity-60"
                    >
                        {uploading
                            ? <><Loader2 className="w-4 h-4 animate-spin" /> Uploading…</>
                            : <><ImagePlus className="w-4 h-4" /> Add photo</>}
                    </button>
                    <span className="text-xs text-gray-400">JPEG / PNG, up to 6 MB</span>
                </div>
            </div>
        </div>
    );
};

export default React.memo(WeeklyHighlightSection);
