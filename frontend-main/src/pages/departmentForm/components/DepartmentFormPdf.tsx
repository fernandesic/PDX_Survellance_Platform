import React from 'react';

interface DepartmentFormPdfProps {
    data: any;
    particulars: any;
}

export const DepartmentFormPdf: React.FC<DepartmentFormPdfProps> = ({ data, particulars }) => {
    if (!data) return null;

    // Uses Unicode escape sequences instead of literal characters for production build safety
    const sanitize = (val: any): string => {
        if (typeof val !== 'string') return val;
        return val
            .replace(/[\u2022\u2023\u25E6\u2043\u2219\u00B7]/g, '-')
            .replace(/[\u2013\u2014]/g, '-')
            .replace(/[\u2018\u2019\u201A]/g, "'")
            .replace(/[\u201C\u201D\u201E]/g, '"')
            .replace(/\u2026/g, '...')
            .replace(/\u00A0/g, ' ')
            .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '')
            .replace(/[^\x20-\x7E\n\r\t]/g, '');
    };

    const sections = [
        {
            letter: 'A',
            title: 'CONTRACT COMPLIANCE',
            dataKey: 'section_1_data',
            sigKey: null,
            signatureHeading: 'Procurement Assistant/Programme Officer (Receiver of Goods or Services)'
        },
        {
            letter: 'B',
            title: 'PROCUREMENT DIVISION ACTION',
            dataKey: 'section_2_data',
            sigKey: 'section_2_signature',
            signatureHeading: 'Procurement Division Action'
        },
        {
            letter: 'C',
            title: 'OPERATIONS OFFICER RECOMMENDATION',
            dataKey: 'section_3_data',
            sigKey: 'section_3_signature',
            signatureHeading: 'Operations Officer Recommendation'
        },
        {
            letter: 'D',
            title: "HUB LEAD APPROVAL FOR FINAL PAYMENT",
            dataKey: 'supervisor_data',
            sigKey: 'supervisor_signature',
            signatureHeading: "HUB lead approval for Final payment",
            staticName: 'Dr. Chamla- HUB Coordinator Nairobi emergency hub'
        },
    ];

    const questions: Record<string, string[]> = {
        'section_1_data': [
            'Was delivery made in accordance with the contract?',
            'Did the supplier supply in conformity with specifications?',
            'Were shipping and related documents in conformity with the contract?',
            'Has the supplier performed in accordance with any post delivery service or support arrangements or warranty provisions incorporated in the contract?',
            'Would you deal with the supplier again? If not, explain.'
        ],
        'section_2_data': ['Recommended for Payment'],
        'section_3_data': ['Clearance for Final Payment:'],
        'supervisor_data': ['Review Decision:']
    };

    const qKeys: Record<string, string[]> = {
        'section_1_data': ['sa_q1', 'sa_q2', 'sa_q3', 'sa_q4', 'sa_q6'],
        'section_2_data': ['recommended_action_b'],
        'section_3_data': ['approval_payment_c'],
        'supervisor_data': ['workflow_decision']
    };

    return (
        <div id="department-form-pdf" className="bg-white px-6 py-6 w-[800px] mx-auto text-slate-900 font-sans shadow-lg" style={{ maxHeight: '1110px', overflow: 'hidden' }}>
            {/* Main Header Block */}
            <div className="bg-[#111827] text-white p-5 rounded-sm flex items-center justify-center relative min-h-[90px]">
                <div className="absolute left-6 top-1/2 -translate-y-1/2">
                    {/* Using the white WHO logo */}
                    <div className="w-14 h-14 flex items-center justify-center">
                        <img src="/assets/who-logo-white.svg" alt="WHO Logo" className="w-full h-full object-contain drop-shadow-sm" />
                    </div>
                </div>
                <div className="text-center">
                    <h1 className="text-[22px] font-bold tracking-tight mb-1 uppercase text-white">PAYMENT AUTHORIZATION</h1>
                    <p className="text-[10px] font-medium opacity-80 text-white">Nairobi Emergency Hub | World Health Organization</p>
                </div>
            </div>

            {/* Core Particulars */}
            <div className="mt-4 mb-4 px-2">
                <h2 className="text-[11px] font-bold text-blue-700 border-b border-blue-200 mb-2 pb-1 uppercase tracking-wider">I. CORE PARTICULARS</h2>
                <div className="grid grid-cols-2 gap-x-8 gap-y-1">
                    <DetailItem label="Invoice No" value={sanitize(particulars.invoice_no)} />
                    <DetailItem label="Supplier Name" value={sanitize(particulars.department_name)} />
                    <DetailItem label="PO Number" value={sanitize(particulars.po_number || particulars.po_no)} />
                    <DetailItem label="Commodity/Service Type" value={sanitize(particulars.commodity_type)} />
                    <DetailItem label="Value" value={`${particulars.contract_value_currency || 'USD'} ${sanitize(particulars.contract_value_amount || 'N/A')}`} />
                    <DetailItem label="Designated Program" value={sanitize(particulars.designated_program)} />
                    <DetailItem label="Report Date" value={sanitize(particulars.report_date)} />
                </div>
            </div>

            {/* Section I Heading from Image 1 */}
            <div className="px-2 mb-3">
                <h3 className="text-[10px] font-bold text-blue-700 uppercase tracking-wide">SECTION I : SUPPLY PERFORMANCE BASED PAYMENT.</h3>
            </div>

            {/* Evaluation Sections */}
            <div className="px-2 space-y-4">
                {sections.map((sec, idx) => (
                    <div key={sec.letter} className="break-inside-avoid">
                        <div className="mb-2">
                            <h2 className="text-[11px] font-bold text-blue-700 border-b border-blue-200 mb-2 pb-1 uppercase tracking-wider">
                                {sec.letter}: {sec.title}
                            </h2>

                            <div className="space-y-3 ml-2">
                                {qKeys[sec.dataKey]?.map((key, qIdx) => (
                                    <div key={key} className="space-y-0.5">
                                        <p className="text-[9px] font-bold text-slate-800">
                                            {qIdx + 1}. {questions[sec.dataKey][qIdx]}
                                        </p>

                                        {sec.letter === 'A' && (
                                            <p className="text-[9px] text-slate-500 flex items-center gap-1 pl-4 pt-0.5">
                                                <span className="font-bold text-slate-400 uppercase text-[8px]">Response:</span>
                                                <span className="font-medium">{renderValue(data[sec.dataKey]?.[key])}</span>
                                            </p>
                                        )}
                                        {sec.letter === 'C' && (
                                            <p className="text-[9px] font-medium text-slate-500 pt-1 border-t border-slate-100 mt-1 inline-block pl-4">
                                                {renderValue(data[sec.dataKey]?.[key] || data[sec.dataKey]?.['workflow_decision'])}
                                            </p>
                                        )}
                                        {sec.letter === 'D' && (
                                            <p className="text-[9px] font-medium text-slate-500 pt-1 border-t border-slate-100 mt-1 inline-block pl-4">
                                                {renderValue(data[sec.dataKey]?.[key] || data[sec.dataKey]?.['workflow_decision'])}
                                            </p>
                                        )}
                                    </div>
                                ))}
                            </div>

                            {/* Signatory Area */}
                            {(data[sec.dataKey]?.signer_name || data[sec.dataKey]?.sign_date || (sec.sigKey && data[sec.sigKey])) && (
                                <div className="mt-4 ml-2 pl-4 border-l-2 border-slate-100 py-0.5 space-y-1">
                                    {sec.letter === 'B' ? (
                                        <p className="text-[9px] font-bold text-slate-800">
                                            Verified by AA: {data[sec.dataKey]?.signer_name ? sanitize(data[sec.dataKey]?.signer_name) : '................................................'}
                                        </p>
                                    ) : sec.letter === 'D' ? (
                                        <p className="text-[9px] font-bold text-slate-800 pt-3 border-t border-slate-200 mt-2 inline-block w-full max-w-[300px]">
                                            Dr. Chamla- HUB Coordinator Nairobi emergency hub
                                        </p>
                                    ) : sec.letter !== 'C' ? (
                                        <p className="text-[9px] font-bold text-slate-800">
                                            Verified By: {sanitize(data[sec.dataKey]?.signer_name) || '—'}
                                        </p>
                                    ) : null}

                                    <p className="text-[9px] text-slate-500 italic mt-2">
                                        Date: {data[sec.dataKey]?.sign_date ? data[sec.dataKey]?.sign_date : '................................................'}
                                    </p>

                                    {sec.sigKey && data[sec.sigKey] && (
                                        <div className="pt-1">
                                            <img src={data[sec.sigKey]} alt="Signature" className="h-6 object-contain" style={{ mixBlendMode: 'multiply' }} />
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Special Insert: SECTION II after Section A */}
                        {sec.letter === 'A' && (
                            <div className="mt-4 mb-3">
                                <h2 className="text-[11px] font-bold text-blue-700 border-b border-blue-200 mb-2 pb-1 uppercase tracking-wider">
                                    SECTION II: OTHER TYPES OF PAYMENTS
                                </h2>
                                <div className="ml-2 space-y-2">
                                    <div className="space-y-0.5">
                                        <p className="text-[9px] font-bold text-slate-800">1. Description of product/service:</p>
                                        <p className="text-[9px] text-slate-500 font-medium pl-4">
                                            {sanitize(data[sec.dataKey]?.section2_q1) || <span className="text-slate-300 tracking-[0.2em] block pt-1">.......................................................................</span>}
                                        </p>
                                    </div>
                                    <div className="space-y-0.5">
                                        <p className="text-[9px] font-bold text-slate-800">2. Source of payment:</p>
                                        <p className="text-[9px] font-medium text-slate-500 pl-4">
                                            {sanitize(data[sec.dataKey]?.section2_q2) || <span className="text-slate-300 tracking-[0.2em] block pt-1">.......................................................................</span>}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Footer */}
            <div className="mt-6 pt-3 border-t border-slate-200 flex justify-between items-center text-[8px] text-slate-400 font-medium">
                <p>Official Document | Generated on {new Date().toLocaleDateString('en-GB')} | WHO Nairobi Emergency Hub</p>
                <p className="uppercase tracking-widest font-bold">SYSTEM ID: {(particulars?.serial_no || particulars?.serialNo || 'DOC').toString().toUpperCase()}</p>
            </div>
        </div>
    );
};

const DetailItem = ({ label, value }: { label: string; value: any }) => (
    <div className="flex items-start text-[10px] gap-2 pb-1">
        <span className="font-bold text-slate-500 uppercase text-[8px] tracking-wider w-[140px] shrink-0 pt-[2px]">{label}:</span>
        <span className="text-[10px] text-slate-800 font-semibold flex-1">{value && value !== 'USD N/A' && value !== 'KES N/A' ? value : '.......................................'}</span>
    </div>
);

const renderValue = (val: any) => {
    if (val === undefined || val === null || val === '') return <span className="text-slate-300 tracking-[0.2em]">................................................</span>;
    if (typeof val === 'boolean') return val ? 'YES' : 'NO';
    const stringVal = String(val).toUpperCase();
    if (stringVal === 'YES' || stringVal === 'TRUE') return 'YES';
    if (stringVal === 'NO' || stringVal === 'FALSE') return 'NO';

    // Uses Unicode escape sequences instead of literal characters for production build safety
    const sanitize = (v: string): string => {
        return v
            .replace(/[\u2022\u2023\u25E6\u2043\u2219\u00B7]/g, '-')
            .replace(/[\u2013\u2014]/g, '-')
            .replace(/[\u2018\u2019\u201A]/g, "'")
            .replace(/[\u201C\u201D\u201E]/g, '"')
            .replace(/\u2026/g, '...')
            .replace(/\u00A0/g, ' ')
            .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '')
            .replace(/[^\x20-\x7E\n\r\t]/g, '');
    };

    return sanitize(String(val));
};
