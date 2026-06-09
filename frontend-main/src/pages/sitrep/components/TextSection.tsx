import React, { useState, useEffect, useCallback, useRef } from 'react';
import SavingIndicator from './SavingIndicator';

interface TextSectionProps {
    sectionNumber: number;
    title: string;
    hint: string;
    label: string;
    placeholder: string;
    fieldName: string;
    value: string;
    onSave: (fieldName: string, value: string) => Promise<void>;
}

/**
 * Generic textarea section with auto-save on blur.
 * Used for Section 5 (Planned Actions) and Section 6 (Key Challenges).
 */
const TextSection: React.FC<TextSectionProps> = ({
    sectionNumber, title, hint, label, placeholder, fieldName, value: initialValue, onSave,
}) => {
    const [localVal, setLocalVal] = useState(initialValue || '');
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const lastSaved = useRef(initialValue || '');
    const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

    useEffect(() => {
        setLocalVal(initialValue || '');
        lastSaved.current = initialValue || '';
    }, [initialValue]);

    const handleBlur = useCallback(async () => {
        if (localVal === lastSaved.current) return;
        setSaving(true);
        setSaved(false);
        try {
            await onSave(fieldName, localVal);
            lastSaved.current = localVal;
            setSaved(true);
            timerRef.current = setTimeout(() => setSaved(false), 2500);
        } catch { } finally {
            setSaving(false);
        }
    }, [fieldName, localVal, onSave]);

    useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

    return (
        <div className="mb-6">
            {/* Section Header */}
            <div className="flex items-center justify-between px-5 py-3.5 bg-gradient-to-r from-[#1a2744] to-[#2c3e6b] rounded-t-xl">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                        <span className="text-white text-sm font-bold">{sectionNumber}</span>
                    </div>
                    <h3 className="text-white font-bold text-base">{title}</h3>
                </div>
                <div className="flex items-center gap-3">
                    <SavingIndicator saving={saving} saved={saved} />
                    <span className="text-white/60 text-xs italic hidden md:block">{hint}</span>
                </div>
            </div>
            {/* Body */}
            <div className="bg-white border border-gray-100 border-t-0 rounded-b-xl p-5 shadow-sm">
                <p className="text-sm font-semibold text-gray-700 mb-3">{label}</p>
                <textarea
                    value={localVal}
                    onChange={(e) => setLocalVal(e.target.value)}
                    onBlur={handleBlur}
                    placeholder={placeholder}
                    rows={6}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-800 placeholder:text-gray-400 outline-none focus:border-[#4a9fd8] focus:bg-white transition-colors resize-y min-h-[120px]"
                />
            </div>
        </div>
    );
};

export default React.memo(TextSection);
