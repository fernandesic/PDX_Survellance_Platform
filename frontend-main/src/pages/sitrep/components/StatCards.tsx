import React, { useState, useEffect, useCallback, useRef } from 'react';
import SavingIndicator from './SavingIndicator';

interface StatCardsProps {
    data: Record<string, string>;
    onSave: (fieldName: string, value: string) => Promise<void>;
}

const STATS = [
    { key: 'population_in_screening', label: 'POE SCREENING' },
    { key: 'high_risk_poe', label: '# HIGH-RISK POINTS OF ENTRY' },
    { key: 'referred', label: 'REFERRED' },
    { key: 'isolated', label: 'ISOLATED' },
    { key: 'suspected', label: 'SUSPECTED' },
];

const StatCard: React.FC<{
    statKey: string;
    label: string;
    value: string;
    onSave: (key: string, val: string) => Promise<void>;
}> = ({ statKey, label, value: initialValue, onSave }) => {
    // Allow empty string — do NOT coerce to '0' or the field appears to
    // "snap back" when the user clears it.
    const [localVal, setLocalVal] = useState<string>(initialValue ?? '');
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const lastSaved = useRef<string>(initialValue ?? '');
    const timerRef = useRef<ReturnType<typeof setTimeout>>();

    useEffect(() => {
        setLocalVal(initialValue ?? '');
        lastSaved.current = initialValue ?? '';
    }, [initialValue]);

    const handleBlur = useCallback(async () => {
        if (localVal === lastSaved.current) return;
        setSaving(true);
        setSaved(false);
        try {
            await onSave(statKey, localVal);
            lastSaved.current = localVal;
            setSaved(true);
            timerRef.current = setTimeout(() => setSaved(false), 2500);
        } catch { } finally {
            setSaving(false);
        }
    }, [statKey, localVal, onSave]);

    useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

    return (
        <div className="flex-1 min-w-[140px] bg-white border border-gray-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-3 leading-tight min-h-[28px]">
                {label}
            </p>
            <input
                type="text"
                inputMode="numeric"
                value={localVal}
                placeholder="0"
                // Select the whole number on focus so users can immediately
                // type a new one over it (no need to Backspace digit-by-digit).
                onFocus={(e) => e.currentTarget.select()}
                onChange={(e) => setLocalVal(e.target.value)}
                onBlur={handleBlur}
                className="w-full text-center text-2xl font-bold text-gray-800 bg-gray-50 border border-gray-200 rounded-lg py-2 outline-none focus:border-[#4a9fd8] focus:bg-white transition-colors"
            />
            <div className="mt-1.5 h-4 flex justify-center">
                <SavingIndicator saving={saving} saved={saved} />
            </div>
        </div>
    );
};

/**
 * Section 1 — Statistics: Population & Case Overview
 * 5 horizontal stat cards with numeric inputs
 */
const StatCards: React.FC<StatCardsProps> = ({ data, onSave }) => (
    <div className="mb-6">
        {/* Section Header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-gradient-to-r from-[#1a2744] to-[#2c3e6b] rounded-t-xl">
            <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                    <span className="text-white text-sm font-bold">1</span>
                </div>
                <h3 className="text-white font-bold text-base">Statistics — Population &amp; Case Overview</h3>
            </div>
            <span className="text-white/60 text-xs italic hidden md:block">update each cycle</span>
        </div>
        {/* Cards */}
        <div className="bg-[#f5f7fa] border border-gray-100 border-t-0 rounded-b-xl p-5 shadow-sm">
            <div className="flex flex-wrap gap-4">
                {STATS.map((stat) => (
                    <StatCard
                        key={stat.key}
                        statKey={stat.key}
                        label={stat.label}
                        value={data[stat.key] ?? ''}
                        onSave={onSave}
                    />
                ))}
            </div>
        </div>
    </div>
);

export default React.memo(StatCards);
