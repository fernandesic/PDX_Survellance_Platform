import React from 'react';
import { CheckCircle2, XCircle, MinusCircle } from 'lucide-react';
import { getCountryRisk, getChecklist } from '../constants/checklists';

export type ChecklistAnswer = 'YES' | 'NO' | 'NA';

interface ChecklistSectionProps {
    selectedCountry: string;
    responses: Record<string, string>;
    onToggle: (itemKey: string, value: ChecklistAnswer) => void;
}

/**
 * Section 3 — Conditional Checklist
 * Renders the correct checklist (1 or 2) based on selected country.
 * Each item has a Yes / No / N/A toggle.
 */
const ChecklistSection: React.FC<ChecklistSectionProps> = ({
    selectedCountry,
    responses,
    onToggle,
}) => {
    if (!selectedCountry) return null;

    const riskInfo = getCountryRisk(selectedCountry);
    const checklist = getChecklist(riskInfo.checklist);

    const isAnswered = (v: string | undefined) => v === 'YES' || v === 'NO' || v === 'NA';

    // Count totals
    const totalItems = checklist.reduce((acc, cat) => acc + cat.items.length, 0);
    const answeredItems = checklist.reduce((acc, cat) =>
        acc + cat.items.filter((item) => isAnswered(responses[item.key])).length, 0
    );
    const yesCount = checklist.reduce((acc, cat) =>
        acc + cat.items.filter((item) => responses[item.key] === 'YES').length, 0
    );
    const naCount = checklist.reduce((acc, cat) =>
        acc + cat.items.filter((item) => responses[item.key] === 'NA').length, 0
    );

    return (
        <div className="px-5 pb-5">
            {/* Summary bar */}
            <div className="flex items-center gap-4 mb-5 flex-wrap">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Checklist {riskInfo.checklist}
                </span>
                <span className="text-xs text-gray-400">
                    {answeredItems}/{totalItems} answered · {yesCount} Yes{naCount ? ` · ${naCount} N/A` : ''}
                </span>
                <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden max-w-xs">
                    <div
                        className="h-full bg-[#4a9fd8] rounded-full transition-all duration-500"
                        style={{ width: `${totalItems ? (answeredItems / totalItems) * 100 : 0}%` }}
                    />
                </div>
            </div>

            {/* Categories */}
            {checklist.map((category, catIdx) => (
                <div key={catIdx} className="mb-5 last:mb-0">
                    <h4 className="text-xs font-bold text-[#1a2744] uppercase tracking-wider mb-2.5 px-1">
                        {category.category}
                    </h4>
                    <div className="space-y-1.5">
                        {category.items.map((item) => {
                            const current = responses[item.key] || '';
                            return (
                                <div
                                    key={item.key}
                                    className={`flex items-start gap-3 px-4 py-3 rounded-lg border transition-colors ${
                                        current === 'YES'
                                            ? 'bg-green-50/50 border-green-200'
                                            : current === 'NO'
                                            ? 'bg-red-50/30 border-red-200'
                                            : current === 'NA'
                                            ? 'bg-slate-50 border-slate-200'
                                            : 'bg-white border-gray-100'
                                    }`}
                                >
                                    {/* Item text */}
                                    <p className="flex-1 text-sm text-gray-700 leading-relaxed">
                                        {item.text}
                                    </p>
                                    {/* Yes / No / N/A toggles */}
                                    <div className="flex items-center gap-1.5 flex-shrink-0">
                                        <button
                                            type="button"
                                            onClick={(e) => { e.preventDefault(); onToggle(item.key, 'YES'); }}
                                            className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                                current === 'YES'
                                                    ? 'bg-green-500 text-white shadow-sm'
                                                    : 'bg-gray-100 text-gray-500 hover:bg-green-100 hover:text-green-700'
                                            }`}
                                        >
                                            <CheckCircle2 className="w-3.5 h-3.5" />
                                            Yes
                                        </button>
                                        <button
                                            type="button"
                                            onClick={(e) => { e.preventDefault(); onToggle(item.key, 'NO'); }}
                                            className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                                current === 'NO'
                                                    ? 'bg-red-500 text-white shadow-sm'
                                                    : 'bg-gray-100 text-gray-500 hover:bg-red-100 hover:text-red-700'
                                            }`}
                                        >
                                            <XCircle className="w-3.5 h-3.5" />
                                            No
                                        </button>
                                        <button
                                            type="button"
                                            onClick={(e) => { e.preventDefault(); onToggle(item.key, 'NA'); }}
                                            title="Not Applicable"
                                            className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                                current === 'NA'
                                                    ? 'bg-slate-500 text-white shadow-sm'
                                                    : 'bg-gray-100 text-gray-500 hover:bg-slate-200 hover:text-slate-700'
                                            }`}
                                        >
                                            <MinusCircle className="w-3.5 h-3.5" />
                                            N/A
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            ))}
        </div>
    );
};

// Memoized to skip re-renders caused by parent state changes that don't
// touch this section's props (e.g. countdown ticks before the refactor,
// or unrelated optimistic updates).
export default React.memo(ChecklistSection);
