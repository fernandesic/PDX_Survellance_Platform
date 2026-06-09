import React, { useEffect, useState, useRef, type ReactNode } from 'react';
import type SignaturePad from 'react-signature-canvas';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { ApiConsumer } from '@/lib/api';
import { Send, ChevronRight, Mail, ChevronDown, RotateCcw } from 'lucide-react';
import { useToast } from '@/contexts/ToastProvider';
import { motion, AnimatePresence } from 'framer-motion';

// Modular Components
import { LoadingScreen, ErrorScreen } from './components/StatusScreens';
import { SupplierFormHeader } from './components/SupplierFormHeader';
import { ProgressStepper } from './components/ProgressStepper';
import { CoreParticularsSidebar } from './components/CoreParticularsSidebar';
import { SectionCard } from './components/SectionCard';
import { EmailModal } from './components/EmailModal';
import { SubmissionSuccess } from './components/SubmissionSuccess';
import { ConfirmationModal } from './components/ConfirmationModal';
import { logger } from "@/utils/logger";

/* ───────── types ───────── */
type SupplierStatus = typeof STATUSES[number];

interface Attachment {
    name: string;
    data: string;
}

interface Particulars {
    serial_no: string;
    invoice_no: string;
    supplier_name: string;
    po_number: string;
    commodity_type: string;
    contract_value_currency: string;
    contract_value_amount: string;
    report_date: string;
    designated_program: string;
}

interface SectionQuestion {
    key: string;
    text: ReactNode;
    type?: 'choice' | 'text' | 'textarea' | 'static' | 'file';
    value?: string;
    options?: string[];
}

/** Server's validate-token response shape. Keys for unknown section payloads
 *  are kept loose because backend stores arbitrary form-field maps there. */
interface SupplierFormData extends Partial<Particulars> {
    status: SupplierStatus;
    status_display?: string;
    section_1_data?: Record<string, unknown> | string | null;
    section_2_data?: Record<string, unknown> | string | null;
    section_3_data?: Record<string, unknown> | string | null;
    supervisor_data?: Record<string, unknown> | string | null;
    section_1_email?: string;
    section_2_email?: string;
    section_3_email?: string;
    initiator_email?: string;
    [extra: string]: unknown;
}

interface WorkflowConfig {
    dropdown_emails?: string[];
    section_b_reviewers?: string[];
    section_c_reviewers?: string[];
    section_d_reviewers?: string[];
    /** Backend uses *_emails for sections C/D; older code reads them. */
    section_c_emails?: string[];
    section_d_emails?: string[];
}

interface SubmissionResponse {
    next_email?: string;
    message?: string;
    [key: string]: unknown;
}

type SectionDataMap = Record<string, unknown>;

/* ───────── status helpers ───────── */
const STATUSES = ['SECTION_A_PENDING', 'SECTION_B_PENDING', 'SECTION_C_PENDING', 'SECTION_D_PENDING', 'COMPLETED'] as const;
const statusIndex = (s: string) => STATUSES.indexOf(s as SupplierStatus);

const SECTION_META = [
    { status: 'SECTION_A_PENDING', letter: 'A', title: 'CONTRACT COMPLIANCE', subtitle: 'Procurement Assistant / Programme Officer (Receiver of Goods or Services)', color: '#3B82F6', dataKey: 'section_1_data', sigKey: 'section_1_signature', showName: true, showDate: true, showSignature: false, signatureHeading: 'Procurement Assistant/Programme Officer (Receiver of Goods or Services)' },
    { status: 'SECTION_B_PENDING', letter: 'B', title: 'PROCUREMENT DIVISION ACTION', subtitle: 'Reviewed by Procurement officer', color: '#8B5CF6', dataKey: 'section_2_data', sigKey: 'section_2_signature', showName: true, nameLabel: 'VERIFIED BY AA', showDate: true, showSignature: false },
    { status: 'SECTION_C_PENDING', letter: 'C', title: 'OPERATIONS OFFICER RECOMMENDATION', subtitle: 'Reviewed by Operations Officer', color: '#F59E0B', dataKey: 'section_3_data', sigKey: 'section_3_signature', showName: false, showDate: true, showSignature: false, signatureHeading: 'Operations Officer Recommendation' },
    { status: 'SECTION_D_PENDING', letter: 'D', title: "HUB LEAD APPROVAL FOR FINAL PAYMENT", subtitle: 'Final Review & Sign-off', color: '#10B981', dataKey: 'supervisor_data', sigKey: 'supervisor_signature', showName: false, showDate: true, showSignature: false, signatureHeading: "Dr. Chamla- HUB Coordinator Nairobi emergency hub", staticName: 'Dr. Chamla- HUB Coordinator Nairobi emergency hub' },
];

const SECTION_QUESTIONS: Record<string, SectionQuestion[]> = {
    'SECTION_A_PENDING': [
        { key: 'sa_q1', text: 'Was delivery made in accordance with the contract?', type: 'choice', options: ['YES', 'NO', 'N/A'] },
        { key: 'sa_q2', text: 'Did the supplier supply in conformity with specifications?', type: 'choice', options: ['YES', 'NO', 'N/A'] },
        { key: 'sa_q3', text: 'Were shipping and related documents in conformity with the contract?', type: 'choice', options: ['YES', 'NO', 'N/A'] },
        { key: 'sa_q4', text: 'Has the supplier performed in accordance with any post delivery service or support arrangements or warranty provisions incorporated in the contract?', type: 'choice', options: ['YES', 'NO', 'N/A'] },
        { key: 'sa_q6', text: 'Would you deal with the supplier again? If not, explain.', type: 'choice', options: ['YES', 'NO'] },
    ],
    'SECTION_B_PENDING': [
        { key: 'recommended_action_b', text: 'Recommended for Payment', type: 'static' },
    ],
    'SECTION_C_PENDING': [
        { key: 'approval_payment_c', text: 'Clearance for Final Payment:', type: 'choice', options: ['Cleared', 'Not cleared'] },
        { key: 'comments_c', text: 'Comments / Questions / Reason for Return:', type: 'textarea' },
    ],
    'SECTION_D_PENDING': [
        { key: 'workflow_decision', text: 'Review Decision:', type: 'choice', options: ['Approved', 'Not approved'] },
        { key: 'comments_d', text: 'Comments / Reason for Rejection:', type: 'textarea' },
    ]
};

const PoForm: React.FC = () => {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');
    const navigate = useNavigate();
    const { showToast } = useToast();

    const [isLoading, setIsLoading] = useState(true);
    const [formData, setFormData] = useState<SupplierFormData | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showEmailModal, setShowEmailModal] = useState(false);
    const [nextEmail, setNextEmail] = useState('');
    const [modalMode, setModalMode] = useState<'submit' | 'reverse'>('submit');
    const [note, setNote] = useState('');
    const [currentSectionData, setCurrentSectionData] = useState<SectionDataMap>({});
    const [uploadedSignature, setUploadedSignature] = useState<string | null>(null);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [submissionResponse, setSubmissionResponse] = useState<SubmissionResponse | null>(null);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [workflowConfig, setWorkflowConfig] = useState<WorkflowConfig | null>(null);
    const [workflowEmails, setWorkflowEmails] = useState<string[]>([]);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [sectionBReviewers, setSectionBReviewers] = useState<string[]>([]);
    const [sectionCReviewers, setSectionCReviewers] = useState<string[]>([]);
    const [sectionDReviewers, setSectionDReviewers] = useState<string[]>([]);
    const [sectionAttachments, setSectionAttachments] = useState<Record<string, {name: string; data: string}[]>>({
        SECTION_A_PENDING: [],
        SECTION_B_PENDING: [],
        SECTION_C_PENDING: [],
        SECTION_D_PENDING: [],
    });

    const [validationErrors, setValidationErrors] = useState<string[]>([]);

    const sigCanvas = useRef<SignaturePad | null>(null);

    // Editable Core Particulars
    const [particulars, setParticulars] = useState<Particulars>({
        serial_no: '',
        invoice_no: '',
        supplier_name: '',
        po_number: '',
        commodity_type: '',
        contract_value_currency: 'KES',
        contract_value_amount: '',
        report_date: '',
        designated_program: ''
    });

    const fetchFormData = async () => {
        if (!token) { setError('Access token is missing.'); setIsLoading(false); return; }
        try {
            const res = await ApiConsumer.get<SupplierFormData>(`/supplier/validate-token/${token}/`);
            setFormData(res);

            // Auto-fill report date for Section A if empty
            let reportDate = res.report_date;
            if (res.status === 'SECTION_A_PENDING' && !reportDate) {
                reportDate = new Date().toISOString().split('T')[0];
            }

            setParticulars({
                serial_no: res.serial_no || '{serialNo}',
                invoice_no: res.invoice_no || '',
                supplier_name: res.supplier_name || '',
                po_number: res.po_number || '',
                commodity_type: res.commodity_type || '',
                contract_value_currency: res.contract_value_currency || 'KES',
                contract_value_amount: res.contract_value_amount || '',
                report_date: reportDate || '',
                designated_program: res.designated_program || '',
            });

            const loadSection = (raw: SupplierFormData['section_1_data']): SectionDataMap => {
                if (!raw) return {};
                return typeof raw === 'string' ? (JSON.parse(raw) as SectionDataMap) : raw;
            };
            if (res.status === 'SECTION_A_PENDING') setCurrentSectionData(loadSection(res.section_1_data));
            else if (res.status === 'SECTION_B_PENDING') setCurrentSectionData(loadSection(res.section_2_data));
            else if (res.status === 'SECTION_C_PENDING') setCurrentSectionData(loadSection(res.section_3_data));
            else if (res.status === 'SECTION_D_PENDING') setCurrentSectionData(loadSection(res.supervisor_data));

            // Pre-load attachments from saved section data
            const getAttachments = (raw: SupplierFormData['section_1_data']): Attachment[] => {
                const d = typeof raw === 'string' ? (JSON.parse(raw) as { attachments?: unknown }) : (raw || {});
                return Array.isArray((d as { attachments?: unknown }).attachments)
                    ? ((d as { attachments: Attachment[] }).attachments)
                    : [];
            };
            setSectionAttachments({
                SECTION_A_PENDING: getAttachments(res.section_1_data),
                SECTION_B_PENDING: getAttachments(res.section_2_data),
                SECTION_C_PENDING: getAttachments(res.section_3_data),
                SECTION_D_PENDING: getAttachments(res.supervisor_data),
            });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Invalid or expired link.');
        } finally { setIsLoading(false); }
    };

    const fetchConfig = async () => {
        try {
            const res = await ApiConsumer.get<WorkflowConfig>('/supplier/workflow-config/');
            setWorkflowConfig(res);
            setWorkflowEmails(res.dropdown_emails || []);
            setSectionBReviewers(res.section_b_reviewers || []);
            setSectionCReviewers(res.section_c_emails || []);
            setSectionDReviewers(res.section_d_emails || []);
        } catch (err) {
            logger.error('Failed to fetch workflow config:', err);
        }
    };

    useEffect(() => {
        fetchFormData();
        fetchConfig();
    }, [token]);

    const handleAnswerChange = (key: string, val: string) => {
        setCurrentSectionData((p) => ({ ...p, [key]: val }));
        if (validationErrors.includes(key)) {
            setValidationErrors(prev => prev.filter(k => k !== key));
        }
    };

    const handleAddAttachment = (file: {name: string; data: string}) => {
        const status = formData?.status;
        if (!status) return;
        setSectionAttachments(prev => ({
            ...prev,
            [status]: [...(prev[status] || []), file]
        }));
    };

    const handleRemoveAttachment = (index: number) => {
        const status = formData?.status;
        if (!status) return;
        setSectionAttachments(prev => ({
            ...prev,
            [status]: (prev[status] || []).filter((_: Attachment, i: number) => i !== index)
        }));
    };

    const handleParticularChange = (field: string, val: string) => {
        setParticulars((p) => ({ ...p, [field]: val } as Particulars));
        if (validationErrors.includes(field)) {
            setValidationErrors(prev => prev.filter(k => k !== field));
        }
    };

    const clearSignature = () => {
        sigCanvas.current?.clear();
        setUploadedSignature(null);
        if (validationErrors.includes('signature')) {
            setValidationErrors(prev => prev.filter(k => k !== 'signature'));
        }
    };

    const validateForm = () => {
        const errors: string[] = [];
        if (!formData) return errors;

        // 1. Validate Core Particulars (Sidebar) - Only for Section A (Initiator)
        if (formData.status === 'SECTION_A_PENDING') {
            const requiredParticulars: (keyof Particulars)[] = [
                'supplier_name', 'invoice_no', 'po_number', 'commodity_type',
                'contract_value_amount', 'report_date', 'designated_program'
            ];

            for (const key of requiredParticulars) {
                if (!particulars[key] || String(particulars[key]).trim() === '') {
                    errors.push(key);
                }
            }
        }

        // 2. Validate Section Questions
        const OPTIONAL_KEYS = ['comments_c', 'comments_d'];
        const questions = SECTION_QUESTIONS[formData.status] || [];
        for (const q of questions) {
            if (q.type === 'static') continue;
            if (OPTIONAL_KEYS.includes(q.key)) continue; // comments are optional
            const val = currentSectionData[q.key];
            if (val === undefined || val === null || String(val).trim() === '') {
                errors.push(q.key);
            }
        }

        // 3. Validate Signer Info
        const meta = SECTION_META.find(m => m.status === formData.status);
        if (meta?.showName && !formData.status.includes('SECTION_D')) { // Section D has static name
            if (!currentSectionData.signer_name || String(currentSectionData.signer_name).trim() === '') {
                errors.push('signer_name');
            }
        }
        if (meta?.showDate) {
            if (!currentSectionData.sign_date || String(currentSectionData.sign_date).trim() === '') {
                errors.push('sign_date');
            }
        }

        // 4. Validate Signature
        if (meta?.showSignature) {
            const hasDrawnSig = sigCanvas.current && !sigCanvas.current.isEmpty();
            const hasSig = !!uploadedSignature || !!hasDrawnSig;
            if (!hasSig) {
                errors.push('signature');
            }
        }

        setValidationErrors(errors);

        if (errors.length > 0) {
            showToast('Please fill all required fields highlighted in red.', 'error');
            return false;
        }

        return true;
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData) return;
        if (!validateForm()) return;

        const decisionKey = formData.status === 'SECTION_B_PENDING' ? 'recommended_action_b' :
            formData.status === 'SECTION_C_PENDING' ? 'approval_payment_c' :
                'workflow_decision';

        const decision = currentSectionData[decisionKey];
        const isBackwards = decision && (decision === 'Payment on hold (Clarification)' || decision === 'Rejected');

        if (isBackwards) {
            setModalMode('reverse');
            // Use ConfirmationModal instead of EmailModal for reverse
            setShowConfirmModal(true);
        } else {
            // Premium custom confirmation
            setModalMode('submit');
            setShowConfirmModal(true);
        }
    };

    const confirmAction = async (overrideMode?: 'submit' | 'reverse') => {
        if (!formData) return;
        const activeMode = overrideMode || modalMode;
        if (activeMode === 'submit' && !nextEmail && formData.status !== 'SECTION_D_PENDING') {
            // SECTION_D_PENDING is excluded by the guard above; the only branches
            // that need a next-email derivation are B and C.
            if (formData.status === 'SECTION_B_PENDING') setNextEmail(sectionCReviewers[0] || '');
            else if (formData.status === 'SECTION_C_PENDING') setNextEmail(sectionDReviewers[0] || '');
        }

        setIsSubmitting(true);

        try {
            let signature = uploadedSignature;
            if (!signature && sigCanvas.current) {
                signature = sigCanvas.current.getCanvas().toDataURL('image/png');
            }

            if (activeMode === 'submit') {

                const attachments = sectionAttachments[formData.status] || [];
                const res = await ApiConsumer.post<SubmissionResponse>(`/supplier/submit-section/${token}/`, {
                    section_data: { ...currentSectionData, attachments },
                    signature,
                    next_email: nextEmail,
                    particulars
                });
                setSubmissionResponse(res);

                // UX Improvement: Redirect directly to success screen
                setIsSubmitted(true);
            } else {
                // REVERSE: Use the dedicated reverse-section endpoint
                // Calculate the previous section's reviewer email
                let prevEmail = '';
                if (formData.status === 'SECTION_B_PENDING') {
                    prevEmail = formData.section_1_email || formData.initiator_email || '';
                } else if (formData.status === 'SECTION_C_PENDING') {
                    prevEmail = formData.section_2_email || '';
                } else if (formData.status === 'SECTION_D_PENDING') {
                    prevEmail = formData.section_3_email || '';
                }

                const res = await ApiConsumer.post<SubmissionResponse>(`/supplier/reverse-section/${token}/`, {
                    next_email: prevEmail,
                    note: note || 'Returned by reviewer via Return Protocol button.'
                });
                setSubmissionResponse(res);
                showToast('Form reverted to previous stage successfully!', 'success');
            }

            setShowEmailModal(false);
            setNote('');
            if (activeMode === 'reverse') {
                setIsSubmitted(true);
            }
            setUploadedSignature(null);
            sigCanvas.current?.clear();
        } catch (err) {
            showToast(err instanceof Error ? err.message : 'Action failed', 'error');
        }
        finally { setIsSubmitting(false); }
    };

    const handleReverse = () => {
        if (!formData) return;
        setModalMode('reverse');
        // Calculate previous reviewer email for display
        let prevEmail = '';
        if (formData.status === 'SECTION_B_PENDING') {
            prevEmail = formData.section_1_email || formData.initiator_email || '';
        } else if (formData.status === 'SECTION_C_PENDING') {
            prevEmail = formData.section_2_email || '';
        } else if (formData.status === 'SECTION_D_PENDING') {
            prevEmail = formData.section_3_email || '';
        }
        setNextEmail(prevEmail);
        setNote('Returned by reviewer via Return Protocol button.');
        setShowConfirmModal(true);
    };

    if (isLoading) return <LoadingScreen text="Authenticating Access" />;

    if (isSubmitted) {
        return (
            <div className="min-h-screen bg-slate-50/50">
                <SubmissionSuccess
                    mode={modalMode}
                    nextEmail={nextEmail}
                    reportData={formData}
                    particulars={particulars}
                    submissionResponse={submissionResponse}
                />
            </div>
        );
    }

    if (error) return <ErrorScreen error={error} onBack={() => navigate('/supplierForm')} />;
    if (!formData) return <LoadingScreen text="Retrieving Form Data" />;



    const curIdx = statusIndex(formData.status);

    return (
        <div className="h-screen bg-slate-50/50 flex flex-col overflow-hidden">
            <div className="sticky top-0 z-40 bg-white">
                <SupplierFormHeader
                    serialNo={particulars.serial_no}
                    status={formData.status}
                    statusDisplay={formData?.status_display}
                    onReverse={handleReverse}
                    showReverse={formData.status !== 'SECTION_A_PENDING'}
                />

                <ProgressStepper
                    sections={SECTION_META}
                    currentStatus={formData.status}
                    statusIndex={statusIndex}
                />
            </div>

            <main className="flex-1 overflow-hidden">
                <div className="max-w-7xl mx-auto h-full w-full px-6 py-8">
                    <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-12 h-full items-stretch">
                        <div className="h-full overflow-y-auto custom-scrollbar pr-4 -mr-4">
                            <motion.div
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ duration: 0.5 }}
                            >
                                <CoreParticularsSidebar
                                    data={particulars}
                                    onFieldChange={handleParticularChange}
                                    isEditable={formData.status === 'SECTION_A_PENDING'}
                                    errors={validationErrors}
                                />
                            </motion.div>
                        </div>

                        <div className="h-full overflow-y-auto custom-scrollbar pr-6 -mr-6 pb-20">
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ staggerChildren: 0.1, delayChildren: 0.2 }}
                                className="space-y-8"
                            >
                                {SECTION_META.map((sec, i) => {
                                    const isDone = statusIndex(formData.status) > i || formData.status === 'COMPLETED';
                                    const isActive = formData.status === sec.status;
                                    const isLocked = !isDone && !isActive;
                                    
                                    const questions = SECTION_QUESTIONS[sec.status] || [];

                                    const savedData = formData[sec.dataKey] || {};
                                    const savedSig = formData[sec.sigKey];
                                    const displayData = isActive ? currentSectionData : savedData;

                                    return (
                                        <motion.div
                                            key={sec.letter}
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ duration: 0.4 }}
                                        >
                                            <SectionCard
                                                meta={sec}
                                                questions={questions}
                                                isActive={isActive}
                                                isDone={isDone}
                                                isLocked={isLocked}
                                                data={displayData}
                                                signature={(typeof savedSig === 'string' ? savedSig : '') as string}
                                                showName={sec.showName}
                                                showDate={sec.showDate}
                                                showSignature={sec.showSignature}
                                                signatureHeading={sec.signatureHeading}
                                                uploadedSig={uploadedSignature}
                                                onUploadSig={(base64: string) => {
                                                    setUploadedSignature(base64);
                                                    if (validationErrors.includes('signature')) {
                                                        setValidationErrors(prev => prev.filter(k => k !== 'signature'));
                                                    }
                                                }}
                                                onChange={handleAnswerChange}
                                                onClearSig={clearSignature}
                                                sigRef={sigCanvas}
                                                errors={validationErrors}
                                                attachments={
                                                    isActive
                                                        ? (sectionAttachments[sec.status] || [])
                                                        : (() => {
                                                            const dd = displayData as { attachments?: unknown } | undefined;
                                                            return Array.isArray(dd?.attachments) ? (dd.attachments as Attachment[]) : [];
                                                        })()
                                                }
                                                onAddAttachment={handleAddAttachment}
                                                onRemoveAttachment={handleRemoveAttachment}
                                            />
                                        </motion.div>
                                    );
                                })}

                                {/* Submission Bar in flow */}
                                <AnimatePresence>
                                    {formData.status !== 'COMPLETED' && (
                                        <motion.div
                                            initial={{ y: 20, opacity: 0 }}
                                            animate={{ y: 0, opacity: 1 }}
                                            exit={{ y: 20, opacity: 0 }}
                                            className="p-5 bg-white border border-slate-200 shadow-[0_10px_40px_rgba(0,0,0,0.04)] rounded-[32px] w-full mt-8"
                                        >
                                            <div className="flex flex-col sm:flex-row items-center justify-between gap-5">
                                                <div className="flex items-center gap-4">
                                                    <div
                                                        className="h-12 w-12 rounded-2xl flex items-center justify-center text-white shadow-lg"
                                                        style={{
                                                            background: SECTION_META[curIdx]?.color,
                                                            boxShadow: `0 8px 16px -4px ${SECTION_META[curIdx]?.color}80`
                                                        }}
                                                    >
                                                        <Send size={20} />
                                                    </div>
                                                    <div>
                                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-0.5">Ready for Review</p>
                                                        <h4 className="text-sm font-black text-slate-900 leading-tight">
                                                            Submit <span style={{ color: SECTION_META[curIdx]?.color }}>Section {SECTION_META[curIdx]?.letter}</span> to Next Stage
                                                        </h4>
                                                    </div>
                                                </div>

                                                <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
                                                    {formData.status !== 'SECTION_A_PENDING' && (
                                                        <motion.button
                                                            whileHover={{ scale: 1.02 }}
                                                            whileTap={{ scale: 0.98 }}
                                                            onClick={handleReverse}
                                                            className="h-12 px-6 rounded-xl bg-white border-2 border-red-500 text-red-600 hover:bg-red-50 font-black text-xs uppercase tracking-widest shadow-md transition-all flex items-center gap-2 w-full sm:w-auto justify-center"
                                                        >
                                                            <RotateCcw size={16} />
                                                            <span>Reject &amp; Return</span>
                                                        </motion.button>
                                                    )}
                                                    <motion.button
                                                        whileHover={{ scale: 1.02 }}
                                                        whileTap={{ scale: 0.98 }}
                                                        onClick={handleSubmit}
                                                        className="h-12 px-8 rounded-xl text-white font-black text-xs uppercase tracking-widest shadow-xl transition-all flex items-center gap-2 w-full sm:w-auto justify-center"
                                                        style={{
                                                            background: SECTION_META[curIdx]?.color,
                                                            boxShadow: `0 12px 24px -8px ${SECTION_META[curIdx]?.color}60`
                                                        }}
                                                    >
                                                        <span>Transmit Protocol</span>
                                                        <ChevronRight size={18} />
                                                    </motion.button>
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </motion.div>
                        </div>
                    </div>
                </div>
            </main>


            <EmailModal
                isOpen={showEmailModal}
                onClose={() => setShowEmailModal(false)}
                email={nextEmail}
                onEmailChange={setNextEmail}
                isSubmitting={isSubmitting}
                onConfirm={confirmAction}
                status={formData.status}
                mode={modalMode}
                note={note}
                onNoteChange={setNote}
                options={(formData?.status === 'SECTION_A_PENDING') ? sectionBReviewers : undefined}
                isReadOnly={['SECTION_B_PENDING', 'SECTION_C_PENDING'].includes(formData?.status) && modalMode === 'submit'}
            />



            <ConfirmationModal
                isOpen={showConfirmModal}
                onClose={() => setShowConfirmModal(false)}
                onConfirm={() => {
                    confirmAction(modalMode);
                }}
                title={modalMode === 'reverse' ? "Revert Protocol" : "Transmit Protocol"}
                message={modalMode === 'reverse'
                    ? "Are you sure you want to authorize and return this section to the previous stage?"
                    : `Are you sure you want to authorize and transmit this section to the ${formData?.status === 'SECTION_A_PENDING' ? 'PROCUREMENT DIVISION ACTION' :
                        formData?.status === 'SECTION_B_PENDING' ? 'OPERATIONS OFFICER RECOMMENDATION' :
                            formData?.status === 'SECTION_C_PENDING' ? "HUB lead approval for Final payment" : 'next stage'
                    }?`}
                confirmText={modalMode === 'reverse' ? "Authorize & Revert" : "Authorize & Transmit"}
                type={modalMode === 'reverse' ? "danger" : "primary"}
                disableConfirm={modalMode === 'submit' && (formData?.status === 'SECTION_A_PENDING' || formData?.status === 'SECTION_B_PENDING' || formData?.status === 'SECTION_C_PENDING') && !nextEmail}
            >
                {modalMode === 'submit' && formData?.status === 'SECTION_A_PENDING' && (
                    <div className="relative w-full">
                        <button
                            type="button"
                            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                            className={`w-full h-12 px-4 rounded-xl bg-slate-50 border flex items-center justify-between transition-all outline-none text-[13px] font-bold mt-2
                                ${!nextEmail ? 'border-amber-300 ring-2 ring-amber-100 text-slate-400' : 'border-slate-200 text-slate-700 hover:border-blue-300'}`}
                        >
                            <div className="flex items-center gap-2 overflow-hidden">
                                <Mail size={16} className={nextEmail ? 'text-blue-500' : 'text-slate-400'} />
                                <span className="truncate">{nextEmail || 'Select Next Reviewer...'}</span>
                            </div>
                            <ChevronDown size={16} className={`transition-transform ${isDropdownOpen ? 'rotate-180 text-blue-500' : 'text-slate-400'}`} />
                        </button>

                        <AnimatePresence>
                            {isDropdownOpen && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                    className="absolute bottom-full mb-2 left-0 right-0 bg-white border border-slate-100 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.1)] overflow-hidden z-[110]"
                                >
                                    <div className="p-1">
                                        {sectionBReviewers.map((opt) => (
                                            <button
                                                key={opt}
                                                type="button"
                                                onClick={() => {
                                                    setNextEmail(opt);
                                                    setIsDropdownOpen(false);
                                                }}
                                                className={`w-full px-4 py-3 text-left text-[13px] font-bold rounded-xl transition-all flex items-center justify-between
                                                    ${nextEmail === opt ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:bg-slate-50 hover:text-blue-500'}
                                                `}
                                            >
                                                <span className="truncate">{opt}</span>
                                                {nextEmail === opt && <div className="h-1.5 w-1.5 rounded-full bg-blue-500 flex-shrink-0" />}
                                            </button>
                                        ))}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                )}

                {modalMode === 'submit' && formData?.status === 'SECTION_B_PENDING' && (
                    <div className="relative w-full">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] mb-1.5">Select Operations Officer</label>
                        <button
                            type="button"
                            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                            className={`w-full h-12 px-4 rounded-xl bg-slate-50 border flex items-center justify-between transition-all outline-none text-[13px] font-bold
                                ${!nextEmail ? 'border-amber-300 ring-2 ring-amber-100 text-slate-400' : 'border-slate-200 text-slate-700 hover:border-violet-300'}`}
                        >
                            <div className="flex items-center gap-2 overflow-hidden">
                                <Mail size={16} className={nextEmail ? 'text-violet-500' : 'text-slate-400'} />
                                <span className="truncate">{nextEmail || 'Select Operations Officer...'}</span>
                            </div>
                            <ChevronDown size={16} className={`transition-transform ${isDropdownOpen ? 'rotate-180 text-violet-500' : 'text-slate-400'}`} />
                        </button>

                        <AnimatePresence>
                            {isDropdownOpen && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                    className="absolute bottom-full mb-2 left-0 right-0 bg-white border border-slate-100 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.1)] overflow-hidden z-[110]"
                                >
                                    <div className="p-1">
                                        {sectionCReviewers.map((opt) => (
                                            <button
                                                key={opt}
                                                type="button"
                                                onClick={() => {
                                                    setNextEmail(opt);
                                                    setIsDropdownOpen(false);
                                                }}
                                                className={`w-full px-4 py-3 text-left text-[13px] font-bold rounded-xl transition-all flex items-center justify-between
                                                    ${nextEmail === opt ? 'bg-violet-50 text-violet-600' : 'text-slate-600 hover:bg-slate-50 hover:text-violet-500'}
                                                `}
                                            >
                                                <span className="truncate">{opt}</span>
                                                {nextEmail === opt && <div className="h-1.5 w-1.5 rounded-full bg-violet-500 flex-shrink-0" />}
                                            </button>
                                        ))}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                )}

                {modalMode === 'submit' && formData?.status === 'SECTION_C_PENDING' && (
                    <div className="relative w-full">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] mb-1.5">Select Hub Coordinator</label>
                        <button
                            type="button"
                            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                            className={`w-full h-12 px-4 rounded-xl bg-slate-50 border flex items-center justify-between transition-all outline-none text-[13px] font-bold
                                ${!nextEmail ? 'border-amber-300 ring-2 ring-amber-100 text-slate-400' : 'border-slate-200 text-slate-700 hover:border-emerald-300'}`}
                        >
                            <div className="flex items-center gap-2 overflow-hidden">
                                <Mail size={16} className={nextEmail ? 'text-emerald-500' : 'text-slate-400'} />
                                <span className="truncate">{nextEmail || 'Select Hub Coordinator...'}</span>
                            </div>
                            <ChevronDown size={16} className={`transition-transform ${isDropdownOpen ? 'rotate-180 text-emerald-500' : 'text-slate-400'}`} />
                        </button>

                        <AnimatePresence>
                            {isDropdownOpen && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                    className="absolute bottom-full mb-2 left-0 right-0 bg-white border border-slate-100 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.1)] overflow-hidden z-[110]"
                                >
                                    <div className="p-1">
                                        {sectionDReviewers.map((opt) => (
                                            <button
                                                key={opt}
                                                type="button"
                                                onClick={() => {
                                                    setNextEmail(opt);
                                                    setIsDropdownOpen(false);
                                                }}
                                                className={`w-full px-4 py-3 text-left text-[13px] font-bold rounded-xl transition-all flex items-center justify-between
                                                    ${nextEmail === opt ? 'bg-emerald-50 text-emerald-600' : 'text-slate-600 hover:bg-slate-50 hover:text-emerald-500'}
                                                `}
                                            >
                                                <span className="truncate">{opt}</span>
                                                {nextEmail === opt && <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 flex-shrink-0" />}
                                            </button>
                                        ))}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                )}
            </ConfirmationModal>
        </div>
    );
};

export default PoForm;
