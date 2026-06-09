import React from 'react';
import { User, Hash, FileCheck, Tag, Landmark, ShieldCheck, Clock } from 'lucide-react';

interface CoreParticularsSidebarProps {
    data: any;
    onFieldChange: (field: string, value: string) => void;
    isEditable?: boolean;
    errors?: string[];
}

export const CoreParticularsSidebar: React.FC<CoreParticularsSidebarProps> = ({ data, onFieldChange, isEditable = true, errors = [] }) => {
    return (
        <div className={`sticky top-40 bg-white rounded-[32px] p-8 border border-slate-100 shadow-[0_20px_40px_-12px_rgba(0,0,0,0.06)] transition-all duration-500
            ${!isEditable ? 'bg-slate-50/50' : 'bg-white'}
        `}>
            <div className="flex items-center gap-3 mb-8 border-b border-slate-100 pb-4">
                <div className="h-6 w-1.5 rounded-full bg-indigo-600" />
                <span className="text-[13px] font-black text-indigo-700 uppercase tracking-widest">I. CORE PARTICULARS</span>
            </div>

            <div className="space-y-6">
                {/* Serial Number Indicator (Read-only Document ID) */}
                <div className="flex items-center gap-4 group opacity-80">
                    <div className="h-9 w-9 rounded-full bg-slate-50 flex items-center justify-center flex-shrink-0">
                        <Hash size={16} className="text-slate-400" />
                    </div>
                    <div className="flex-1 space-y-1">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Serial No.</span>
                        <div className="w-full h-10 px-4 flex items-center rounded-xl bg-slate-100 text-xs font-black text-slate-500 border border-slate-200">
                            {data.serial_no || 'NOT ASSIGNED'}
                        </div>
                    </div>
                </div>

                <EditableInfoRow
                    icon={Hash} label="INVOICE NO:" value={data.invoice_no}
                    onChange={(v: string) => onFieldChange('invoice_no', v)}
                    readOnly={!isEditable}
                    required
                    isError={errors.includes('invoice_no')}
                />
                <EditableInfoRow
                    icon={User} label="SUPPLIER NAME:" value={data.department_name}
                    onChange={(v: string) => onFieldChange('department_name', v)}
                    readOnly={!isEditable}
                    required
                    isError={errors.includes('department_name')}
                />
                <EditableInfoRow
                    icon={FileCheck} label="PO NUMBER:" value={data.po_number || data.po_no}
                    onChange={(v: string) => onFieldChange('po_number', v)}
                    readOnly={!isEditable}
                    required
                    isError={errors.includes('po_number')}
                />
                <EditableInfoRow
                    icon={Tag} label="COMMODITY/SERVICE TYPE:" value={data.commodity_type}
                    onChange={(v: string) => onFieldChange('commodity_type', v)}
                    readOnly={!isEditable}
                    required
                    isError={errors.includes('commodity_type')}
                />

                {/* Currency & Value Row */}
                <div className="flex items-center gap-4 group">
                    <div className="h-9 w-9 rounded-full bg-slate-50 flex items-center justify-center flex-shrink-0 group-focus-within:bg-indigo-50 transition-colors">
                        <Landmark size={16} className="text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                    </div>
                    <div className="flex-1 space-y-1">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                            VALUE: <span className="text-red-500">*</span>
                        </span>
                        <div className="flex gap-2">
                            <select
                                value={data.contract_value_currency || 'KES'}
                                disabled={!isEditable}
                                onChange={(e) => onFieldChange('contract_value_currency', e.target.value)}
                                className="h-10 px-3 rounded-xl bg-white border border-slate-100 text-[10px] font-black text-slate-600 outline-none focus:ring-2 focus:ring-indigo-600/20 disabled:bg-slate-100/50 transition-all cursor-pointer"
                            >
                                <option value="KES">KES</option>
                                <option value="USD">USD</option>
                                <option value="EUR">EUR</option>
                            </select>
                            <input
                                type="number"
                                value={data.contract_value_amount || ''}
                                readOnly={!isEditable}
                                onChange={(e) => onFieldChange('contract_value_amount', e.target.value)}
                                className={`flex-1 h-10 px-4 rounded-xl bg-slate-50/50 border text-xs font-bold text-slate-700 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-600/20 transition-all read-only:bg-slate-100/50 read-only:text-slate-500
                                    ${errors.includes('contract_value_amount') ? 'border-red-500 !bg-red-50' : 'border-slate-100'}
                                `}
                                placeholder="0.00"
                                step="0.01"
                            />
                        </div>
                    </div>
                </div>

                <EditableInfoRow
                    icon={ShieldCheck} label="DESIGNATED PROGRAM:" value={data.designated_program}
                    onChange={(v: string) => onFieldChange('designated_program', v)}
                    readOnly={!isEditable}
                    required
                    isError={errors.includes('designated_program')}
                />
                <EditableInfoRow
                    icon={Clock} label="REPORT DATE:" value={data.report_date}
                    type="date"
                    onChange={(v: string) => onFieldChange('report_date', v)}
                    readOnly={!isEditable}
                    required
                    isError={errors.includes('report_date')}
                />
            </div>

            {!isEditable && (
                <div className="mt-8 p-4 rounded-2xl bg-indigo-50/50 border border-indigo-100 flex items-center gap-3">
                    <ShieldCheck size={16} className="text-indigo-600" />
                    <p className="text-[10px] font-bold text-indigo-600/80 uppercase tracking-wider">Secure Audit Locked</p>
                </div>
            )}
        </div>
    );
};

const EditableInfoRow = ({ icon: Icon, label, value, onChange, readOnly, type = "text", required, isError }: { icon: any, label: string, value: string, onChange: (v: string) => void, readOnly?: boolean, type?: string, required?: boolean, isError?: boolean }) => (
    <div className="flex items-center gap-4 group">
        <div className="h-9 w-9 rounded-full bg-slate-50 flex items-center justify-center flex-shrink-0 group-focus-within:bg-indigo-50 transition-colors">
            <Icon size={16} className={`transition-colors ${isError ? 'text-red-500' : 'text-slate-400 group-focus-within:text-indigo-600'}`} />
        </div>
        <div className="flex-1 space-y-1">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                {label} {required && <span className="text-red-500">*</span>}
            </span>
            <input
                type={type}
                value={value || ''}
                readOnly={readOnly}
                onChange={(e) => onChange(e.target.value)}
                className={`w-full h-10 px-4 rounded-xl text-xs font-bold text-slate-700 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-600/20 transition-all read-only:bg-slate-100/50 read-only:text-slate-500 bg-slate-50/50 border
                    ${isError ? 'border-red-500 !bg-red-50' : 'border-slate-100'}
                `}
                placeholder="..."
            />
        </div>
    </div>
);
