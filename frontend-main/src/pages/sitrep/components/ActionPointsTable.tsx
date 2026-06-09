import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { PILLAR_OPTIONS } from '../constants/checklists';
import SavingIndicator from './SavingIndicator';

interface ActionPoint {
    action: string;
    pillar: string;
}

interface ActionPointsTableProps {
    actionPoints: ActionPoint[];
    onSave: (points: ActionPoint[]) => Promise<void>;
}

/**
 * Section 4 — Action Points
 * Repeatable rows: text input + pillar dropdown + remove button
 * Auto-saves the entire array on any change
 */
const ActionPointsTable: React.FC<ActionPointsTableProps> = ({ actionPoints, onSave }) => {
    const [rows, setRows] = useState<ActionPoint[]>(
        actionPoints?.length ? actionPoints : [{ action: '', pillar: 'Surveillance' }]
    );
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
    const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

    useEffect(() => {
        if (actionPoints?.length) setRows(actionPoints);
    }, [actionPoints]);

    const triggerSave = useCallback((newRows: ActionPoint[]) => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(async () => {
            setSaving(true);
            setSaved(false);
            try {
                await onSave(newRows);
                setSaved(true);
                timerRef.current = setTimeout(() => setSaved(false), 2500);
            } catch { } finally {
                setSaving(false);
            }
        }, 800);
    }, [onSave]);

    const updateRow = useCallback((idx: number, field: 'action' | 'pillar', val: string) => {
        setRows(prev => {
            const next = [...prev];
            next[idx] = { ...next[idx], [field]: val };
            triggerSave(next);
            return next;
        });
    }, [triggerSave]);

    const addRow = useCallback(() => {
        setRows(prev => {
            const next = [...prev, { action: '', pillar: 'Surveillance' }];
            triggerSave(next);
            return next;
        });
    }, [triggerSave]);

    const removeRow = useCallback((idx: number) => {
        setRows(prev => {
            if (prev.length <= 1) return prev;
            const next = prev.filter((_, i) => i !== idx);
            triggerSave(next);
            return next;
        });
    }, [triggerSave]);

    useEffect(() => () => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        if (timerRef.current) clearTimeout(timerRef.current);
    }, []);

    return (
        <div className="mb-6">
            {/* Section Header */}
            <div className="flex items-center justify-between px-5 py-3.5 bg-gradient-to-r from-[#1a2744] to-[#2c3e6b] rounded-t-xl">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                        <span className="text-white text-sm font-bold">4</span>
                    </div>
                    <h3 className="text-white font-bold text-base">Action Points</h3>
                </div>
                <div className="flex items-center gap-3">
                    <SavingIndicator saving={saving} saved={saved} />
                </div>
            </div>
            {/* Body */}
            <div className="bg-white border border-gray-100 border-t-0 rounded-b-xl p-5 shadow-sm">
                <p className="text-sm font-semibold text-gray-700 mb-4">
                    Implemented actions this reporting period
                </p>
                <div className="space-y-3">
                    {rows.map((row, idx) => (
                        <div key={idx} className="flex items-center gap-3">
                            <input
                                type="text"
                                value={row.action}
                                onChange={(e) => updateRow(idx, 'action', e.target.value)}
                                placeholder="Action implemented..."
                                className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-800 placeholder:text-gray-400 outline-none focus:border-[#4a9fd8] focus:bg-white transition-colors"
                            />
                            <select
                                value={row.pillar}
                                onChange={(e) => updateRow(idx, 'pillar', e.target.value)}
                                className="w-[160px] px-3 py-2.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 outline-none focus:border-[#4a9fd8] cursor-pointer"
                            >
                                {PILLAR_OPTIONS.map((p) => (
                                    <option key={p} value={p}>{p}</option>
                                ))}
                            </select>
                            {rows.length > 1 && (
                                <button
                                    type="button"
                                    onClick={() => removeRow(idx)}
                                    className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                                    title="Remove row"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    ))}
                </div>
                <button
                    type="button"
                    onClick={addRow}
                    className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-[#1a2744] text-white text-sm font-bold rounded-lg hover:bg-[#253557] transition-colors active:scale-95"
                >
                    <Plus className="w-4 h-4" />
                    Add action
                </button>
            </div>
        </div>
    );
};

export default React.memo(ActionPointsTable);
