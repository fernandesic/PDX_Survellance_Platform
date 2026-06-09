import React, { useState, useEffect, useCallback, useRef } from 'react';
import SavingIndicator from './SavingIndicator';

interface DocumentControlTableProps {
    data: Record<string, string>;
    onSave: (fieldName: string, value: string) => Promise<void>;
}

interface FieldConfig {
    key: string;
    label: string;
    editable: boolean;
    type: 'text' | 'date' | 'datetime-local';
    placeholder: string;
}

const FIELDS: FieldConfig[] = [
    { key: 'sitrep_number', label: 'Sitrep number', editable: false, type: 'text', placeholder: 'No. ____' },
    { key: 'reporting_period', label: 'Reporting period', editable: true, type: 'text', placeholder: 'dd Mon – dd Mon yyyy' },
    { key: 'date_of_issue', label: 'Date of issue', editable: true, type: 'date', placeholder: 'mm/dd/yyyy' },
    { key: 'data_cutoff', label: 'Data cut-off', editable: true, type: 'datetime-local', placeholder: 'Select date and time' },
    { key: 'classification', label: 'Classification', editable: false, type: 'text', placeholder: 'WHO / FOR OFFICIAL USE — INTERNAL COORDINATION' },
    { key: 'geographic_scope', label: 'Geographic scope', editable: false, type: 'text', placeholder: 'WHO African Region — 47 Member States' },
    { key: 'triggering_event', label: 'Triggering event', editable: true, type: 'text', placeholder: 'EVD outbreak declared — Bundibugyo ebolavirus (DRC / Uganda)' },
    { key: 'prepared_by', label: 'Prepared by', editable: true, type: 'text', placeholder: 'Health Emergency Preparedness — Preparedness Data Exchange (PDX)' },
    { key: 'cleared_by', label: 'Cleared by', editable: true, type: 'text', placeholder: 'Name, title' },
    { key: 'next_issue', label: 'Next issue', editable: true, type: 'date', placeholder: 'dd Mon yyyy (weekly / bi-weekly)' },
];

/* Individual auto-save row */
const FieldRow: React.FC<{
    field: FieldConfig;
    value: string;
    onSave: (key: string, val: string) => Promise<void>;
}> = ({ field, value: initialValue, onSave }) => {
    const [localVal, setLocalVal] = useState(initialValue);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const lastSaved = useRef(initialValue);
    const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

    useEffect(() => {
        setLocalVal(initialValue);
        lastSaved.current = initialValue;
    }, [initialValue]);

    const handleBlur = useCallback(async () => {
        if (localVal === lastSaved.current || !field.editable) return;
        setSaving(true);
        setSaved(false);
        try {
            await onSave(field.key, localVal);
            lastSaved.current = localVal;
            setSaved(true);
            timerRef.current = setTimeout(() => setSaved(false), 2500);
        } catch { } finally {
            setSaving(false);
        }
    }, [field.key, field.editable, localVal, onSave]);

    useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

    return (
        <div className="flex border-b border-gray-100 last:border-b-0">
            {/* Label */}
            <div className="w-[180px] md:w-[200px] flex-shrink-0 px-5 py-3.5 bg-gray-50/80 flex items-center">
                <span className="text-sm font-semibold text-gray-700">{field.label}</span>
            </div>
            {/* Input */}
            <div className="flex-1 px-4 py-2.5 flex items-center gap-2">
                {field.editable ? (
                    <>
                        <input
                            type={field.type}
                            value={localVal}
                            onChange={(e) => setLocalVal(e.target.value)}
                            onBlur={handleBlur}
                            placeholder={field.placeholder}
                            className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-800 placeholder:text-gray-400 outline-none focus:border-[#4a9fd8] focus:bg-white transition-colors"
                        />
                        <SavingIndicator saving={saving} saved={saved} />
                    </>
                ) : (
                    <span className="text-sm text-gray-600 px-1">
                        {localVal || field.placeholder}
                    </span>
                )}
            </div>
        </div>
    );
};

/**
 * Section 0 — Document Control Table
 * Matches the design: 2-column table with label + input per row
 */
const DocumentControlTable: React.FC<DocumentControlTableProps> = ({ data, onSave }) => (
    <div className="mb-6">
        {/* Section Header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-gradient-to-r from-[#1a2744] to-[#2c3e6b] rounded-t-xl">
            <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                    <span className="text-white text-sm font-bold">0</span>
                </div>
                <h3 className="text-white font-bold text-base">Document Control</h3>
            </div>
        </div>
        {/* Table body */}
        <div className="bg-white border border-gray-100 border-t-0 rounded-b-xl overflow-hidden shadow-sm">
            {FIELDS.map((field) => (
                <FieldRow
                    key={field.key}
                    field={field}
                    value={data[field.key] || ''}
                    onSave={onSave}
                />
            ))}
        </div>
    </div>
);

export default React.memo(DocumentControlTable);
