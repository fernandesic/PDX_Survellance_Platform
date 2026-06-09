import React from 'react';

interface SupplierFormPdfProps {
    data: any;
    particulars: any;
    currentStatus?: string;
}

export const SupplierFormPdf: React.FC<SupplierFormPdfProps> = ({ data, particulars, currentStatus }) => {
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
            'Would you deal with the supplier again? If not, explain.',
        ],
        'section_2_data': ['Recommended for Payment'],
        'section_3_data': ['Clearance for Final Payment:', 'Comments / Questions / Reason for Return:'],
        'supervisor_data': ['Review Decision:', 'Comments / Reason for Rejection:']
    };

    const s1Keys = ['sa_q1', 'sa_q2', 'sa_q3', 'sa_q4', 'sa_q6'];
    const s1Questions = [...questions.section_1_data];

    const qKeys: Record<string, string[]> = {
        'section_1_data': s1Keys,
        'section_2_data': ['recommended_action_b'],
        'section_3_data': ['approval_payment_c', 'comments_c'],
        'supervisor_data': ['workflow_decision', 'comments_d']
    };

    const displayQuestions: Record<string, string[]> = {
        ...questions,
        'section_1_data': s1Questions
    };

    // Keys that should render as comment blocks (not yes/no values)
    const COMMENT_KEYS = new Set(['comments_c', 'comments_d']);

    return (
        <div id="supplier-form-pdf" className="bg-white px-8 py-6 w-[800px] mx-auto text-slate-900 font-sans shadow-lg" style={{ minHeight: '1100px' }}>
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
            <div className="mt-4 mb-3 px-2">
                <h2 className="text-[11px] font-bold text-blue-700 border-b border-blue-200 mb-2 pb-1 uppercase tracking-wider">I. CORE PARTICULARS</h2>
                <div className="grid grid-cols-2 gap-x-8 gap-y-0.5">
                    <DetailItem label="Invoice No" value={sanitize(particulars.invoice_no)} />
                    <DetailItem label="Supplier Name" value={sanitize(particulars.supplier_name)} />
                    <DetailItem label="PO Number" value={sanitize(particulars.po_number || particulars.po_no)} />
                    <DetailItem label="Commodity/Service Type" value={sanitize(particulars.commodity_type)} />
                    <DetailItem label="Value" value={`${particulars.contract_value_currency || 'KES'} ${sanitize(particulars.contract_value_amount || 'N/A')}`} />
                    <DetailItem label="Designated Program" value={sanitize(particulars.designated_program)} />
                    <DetailItem label="Report Date" value={sanitize(particulars.report_date)} />
                </div>
            </div>

            {/* Section I Heading */}
            <div className="px-2 mb-2">
                <h3 className="text-[10px] font-bold text-blue-700 uppercase tracking-wide">SECTION I : SUPPLY PERFORMANCE BASED PAYMENT.</h3>
            </div>

            {/* Evaluation Sections */}
            <div className="px-2 space-y-3">
                {sections.map((sec, idx) => {
                    const sectionData = typeof data[sec.dataKey] === 'string'
                        ? JSON.parse(data[sec.dataKey])
                        : data[sec.dataKey] || {};

                    return (
                        <div key={sec.letter} className="break-inside-avoid">
                            <div className="mb-2">
                                <h2 className="text-[11px] font-bold text-blue-700 border-b border-blue-200 mb-1 pb-1 uppercase tracking-wider">
                                    {sec.letter}: {sec.title}
                                </h2>

                                <div className="space-y-2 ml-2">
                                    {qKeys[sec.dataKey]?.map((key, qIdx) => (
                                        <div key={key} className="space-y-0.5">
                                            <p className="text-[9px] font-bold text-slate-800">
                                                {qIdx + 1}. {displayQuestions[sec.dataKey][qIdx]}
                                            </p>

                                            {sec.letter === 'A' && (
                                                <p className="text-[9px] text-slate-500 flex items-center gap-1 pl-4 pt-0.5">
                                                    <span className="font-bold text-slate-400 uppercase text-[8px]">Response:</span>
                                                    <span className="font-medium">{renderValue(sectionData[key])}</span>
                                                </p>
                                            )}
                                            {(sec.letter === 'C' || sec.letter === 'D') && !COMMENT_KEYS.has(key) && (
                                                <p className="text-[9px] font-medium text-slate-500 pt-0.5 border-t border-slate-100 mt-0.5 inline-block pl-4">
                                                    {renderValue(sectionData[key] || sectionData['workflow_decision'])}
                                                </p>
                                            )}
                                            {(sec.letter === 'C' || sec.letter === 'D') && COMMENT_KEYS.has(key) && sectionData[key] && (
                                                <div className="mt-1 ml-4 p-2 bg-amber-50 border border-amber-200 rounded text-[9px] text-slate-700 font-medium leading-relaxed whitespace-pre-wrap">
                                                    {sanitize(sectionData[key])}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>

                                {/* Attachments in this section */}
                                {(() => {
                                    const attachments: {name: string; data: string}[] = Array.isArray(sectionData.attachments) ? sectionData.attachments : [];
                                    if (attachments.length === 0) return null;
                                    return (
                                        <div className="mt-2 ml-2 pl-4 border-l-2 border-blue-100 py-1 space-y-0.5">
                                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Supporting Documents ({attachments.length})</p>
                                            {attachments.map((f, fi) => (
                                                <div key={fi} className="text-[9px] text-slate-600 font-medium flex items-center gap-1">
                                                    <span className="text-slate-400">•</span>
                                                    <span>{f.name}</span>
                                                </div>
                                            ))}
                                        </div>
                                    );
                                })()}

                                {/* Signatory Area */}
                                {(sectionData.signer_name || sectionData.sign_date || (sec.sigKey && data[sec.sigKey])) && (
                                    <div className="mt-2 ml-2 pl-4 border-l-2 border-slate-100 py-0.5 space-y-1">
                                        {sec.letter === 'B' ? (
                                            <p className="text-[9px] font-bold text-slate-800">
                                                Verified by AA: {sectionData.signer_name ? sanitize(sectionData.signer_name) : '................................................'}
                                            </p>
                                        ) : sec.letter === 'D' ? (
                                            <p className="text-[9px] font-bold text-slate-800 pt-2 border-t border-slate-200 mt-1 inline-block w-full max-w-[300px]">
                                                Dr. Chamla- HUB Coordinator Nairobi emergency hub
                                            </p>
                                        ) : sec.letter !== 'C' ? (
                                            <p className="text-[9px] font-bold text-slate-800">
                                                Verified By: {sanitize(sectionData.signer_name) || '—'}
                                            </p>
                                        ) : null}

                                        <p className="text-[9px] text-slate-500 italic mt-1">
                                            Date: {sectionData.sign_date ? sectionData.sign_date : '................................................'}
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
                                <div className="mt-3 mb-2">
                                    <h2 className="text-[11px] font-bold text-blue-700 border-b border-blue-200 mb-1 pb-1 uppercase tracking-wider">
                                        SECTION II: OTHER TYPES OF PAYMENTS
                                    </h2>
                                    <div className="ml-2 space-y-1">
                                        <div className="space-y-0.5">
                                            <p className="text-[9px] font-bold text-slate-800">1. Description of product/service:</p>
                                            <p className="text-[9px] text-slate-500 font-medium pl-4">
                                                {sanitize(sectionData.section2_q1) || <span className="text-slate-300 tracking-[0.2em] block pt-1">.......................................................................</span>}
                                            </p>
                                        </div>
                                        <div className="space-y-0.5">
                                            <p className="text-[9px] font-bold text-slate-800">2. Source of payment:</p>
                                            <p className="text-[9px] font-medium text-slate-500 pl-4">
                                                {sanitize(sectionData.section2_q2) || <span className="text-slate-300 tracking-[0.2em] block pt-1">.......................................................................</span>}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Footer */}
            <div className="mt-4 pt-3 border-t border-slate-200 flex justify-between items-center text-[8px] text-slate-400 font-medium">
                <p>Official Document | Generated on {new Date().toLocaleDateString('en-GB')} | WHO Nairobi Emergency Hub</p>
                <p className="uppercase tracking-widest font-bold">SERIAL NO: {(particulars?.serial_no || 'DOC').toString().toUpperCase()}</p>
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
    const stringVal = String(val);
    const upperVal = stringVal.toUpperCase();
    if (upperVal === 'YES' || upperVal === 'TRUE') return 'YES';
    if (upperVal === 'NO' || upperVal === 'FALSE') return 'NO';

    // Handle document attachments (JSON strings containing {name, data})
    try {
        if (stringVal.startsWith('{') && stringVal.includes('"name"')) {
            const parsed = JSON.parse(stringVal);
            if (parsed.name && parsed.data) {
                return `[Attached Document: ${parsed.name}]`;
            }
        }
    } catch (e) {
        // Fallback to normal string processing
    }

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

    return sanitize(stringVal);
};
