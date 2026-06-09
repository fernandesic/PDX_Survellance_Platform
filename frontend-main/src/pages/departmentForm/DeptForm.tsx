import React, { useEffect, useState, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { ApiConsumer } from '@/lib/api';
import { Send, ChevronRight, ShieldCheck } from 'lucide-react';
import { useToast } from '@/contexts/ToastProvider';
import { motion, AnimatePresence } from 'framer-motion';

// Modular Components
import { LoadingScreen, ErrorScreen } from './components/StatusScreens';
import { DepartmentFormHeader } from './components/DepartmentFormHeader';
import { ProgressStepper } from './components/ProgressStepper';
import { CoreParticularsSidebar } from './components/CoreParticularsSidebar';
import { SectionCard } from './components/SectionCard';
import { EmailModal } from './components/EmailModal';
import { SubmissionSuccess } from './components/SubmissionSuccess';
import { ConfirmationModal } from './components/ConfirmationModal';
import { logger } from "@/utils/logger";

/* ───────── status helpers ───────── */
const STATUSES = ['SECTION_A_PENDING', 'SECTION_B_PENDING', 'SECTION_C_PENDING', 'SECTION_D_PENDING', 'COMPLETED'] as const;
const statusIndex = (s: string) => STATUSES.indexOf(s as any);

const SECTION_META = [
    { status: 'SECTION_A_PENDING', letter: 'A', title: 'CONTRACT COMPLIANCE', subtitle: 'Procurement Assistant / Programme Officer (Receiver of Goods or Services)', color: '#3B82F6', dataKey: 'section_1_data', sigKey: 'section_1_signature', showName: true, showDate: true, showSignature: false, signatureHeading: 'Procurement Assistant/Programme Officer (Receiver of Goods or Services)' },
    { status: 'SECTION_B_PENDING', letter: 'B', title: 'PROCUREMENT DIVISION ACTION', subtitle: 'Reviewed by Procurement officer', color: '#8B5CF6', dataKey: 'section_2_data', sigKey: 'section_2_signature', showName: true, nameLabel: 'VERIFIED BY AA', showDate: true, showSignature: false },
    { status: 'SECTION_C_PENDING', letter: 'C', title: 'OPERATIONS OFFICER RECOMMENDATION', subtitle: 'Reviewed by Operations Officer', color: '#F59E0B', dataKey: 'section_3_data', sigKey: 'section_3_signature', showName: false, showDate: true, showSignature: false, signatureHeading: 'Operations Officer Recommendation' },
    { status: 'SECTION_D_PENDING', letter: 'D', title: "HUB LEAD APPROVAL FOR FINAL PAYMENT", subtitle: 'Final Review & Sign-off', color: '#10B981', dataKey: 'supervisor_data', sigKey: 'supervisor_signature', showName: false, showDate: true, showSignature: false, signatureHeading: "Dr. Chamla- HUB Coordinator Nairobi emergency hub", staticName: 'Dr. Chamla- HUB Coordinator Nairobi emergency hub' },
];

const SECTION_QUESTIONS: Record<string, { key: string; text: any; type?: 'choice' | 'text' | 'textarea' | 'static'; value?: string; options?: string[] }[]> = {
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
    ],
    'SECTION_D_PENDING': [
        { key: 'workflow_decision', text: 'Review Decision:', type: 'choice', options: ['Approved', 'Not approved'] }
    ]
};

const DeptForm: React.FC = () => {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');
    const navigate = useNavigate();
    const { showToast } = useToast();

    const [isLoading, setIsLoading] = useState(true);
    const [formData, setFormData] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showEmailModal, setShowEmailModal] = useState(false);
    const [nextEmail, setNextEmail] = useState('');
    const [modalMode, setModalMode] = useState<'submit' | 'reverse'>('submit');
    const [note, setNote] = useState('');
    const [currentSectionData, setCurrentSectionData] = useState<any>({});
    const [uploadedSignature, setUploadedSignature] = useState<string | null>(null);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [submissionResponse, setSubmissionResponse] = useState<any>(null);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [workflowConfig, setWorkflowConfig] = useState<any>(null);
    const [workflowEmails, setWorkflowEmails] = useState<string[]>([]);
    const [isEmailVerified, setIsEmailVerified] = useState(false);
    const [verificationEmail, setVerificationEmail] = useState('');
    const [verificationError, setVerificationError] = useState('');
    const [validationErrors, setValidationErrors] = useState<string[]>([]);

    const sigCanvas = useRef<any>(null);

    // Editable Core Particulars
    const [particulars, setParticulars] = useState<any>({
        serial_no: '',
        invoice_no: '',
        department_name: '',
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
            const res: any = await ApiConsumer.get(`/department/validate-token/${token}/`);
            setFormData(res);

            // Auto-fill report date for Section A if empty
            let reportDate = res.report_date;
            if (res.status === 'SECTION_A_PENDING' && !reportDate) {
                reportDate = new Date().toISOString().split('T')[0];
            }

            setParticulars({
                serial_no: res.serial_no || '{serialNo}',
                invoice_no: res.invoice_no || '',
                department_name: res.department_name || '',
                po_number: res.po_number || '',
                commodity_type: res.commodity_type || '',
                contract_value_currency: res.contract_value_currency || 'KES',
                contract_value_amount: res.contract_value_amount || '',
                report_date: reportDate || '',
                designated_program: res.designated_program || '',
            });

            if (res.status === 'SECTION_A_PENDING') setCurrentSectionData(res.section_1_data || {});
            else if (res.status === 'SECTION_B_PENDING') setCurrentSectionData(res.section_2_data || {});
            else if (res.status === 'SECTION_C_PENDING') setCurrentSectionData(res.section_3_data || {});
            else if (res.status === 'SECTION_D_PENDING') setCurrentSectionData(res.supervisor_data || {});
        } catch (err: any) {
            setError(err?.message || 'Invalid or expired link.');
        } finally { setIsLoading(false); }
    };

    const fetchConfig = async () => {
        try {
            const res: any = await ApiConsumer.get('/department/workflow-config/');
            setWorkflowConfig(res);
            setWorkflowEmails(res.dropdown_emails || []);
        } catch (err) {
            logger.error('Failed to fetch workflow config:', err);
        }
    };

    useEffect(() => {
        fetchFormData();
        fetchConfig();
    }, [token]);

    const handleAnswerChange = (key: string, val: string) => {
        setCurrentSectionData((p: any) => ({ ...p, [key]: val }));
        if (validationErrors.includes(key)) {
            setValidationErrors(prev => prev.filter(k => k !== key));
        }
    };

    const handleParticularChange = (field: string, val: string) => {
        setParticulars((p: any) => ({ ...p, [field]: val }));
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

        // 1. Validate Core Particulars (Sidebar) - Only for Section A (Initiator)
        if (formData.status === 'SECTION_A_PENDING') {
            const requiredParticulars = [
                'department_name', 'invoice_no', 'po_number', 'commodity_type',
                'contract_value_amount', 'report_date', 'designated_program'
            ];

            for (const key of requiredParticulars) {
                if (!particulars[key] || String(particulars[key]).trim() === '') {
                    errors.push(key);
                }
            }
        }

        // 2. Validate Section Questions
        const questions = SECTION_QUESTIONS[formData.status] || [];
        for (const q of questions) {
            if (q.type === 'static') continue;
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
        const activeMode = overrideMode || modalMode;
        if (activeMode === 'submit' && !nextEmail && formData.status !== 'SECTION_D_PENDING') {
            // Re-calculate next email if it was skipped in handleSubmit bypass
            if (formData.status === 'SECTION_B_PENDING') setNextEmail(workflowConfig?.section_c_email || '');
            else if (formData.status === 'SECTION_C_PENDING') setNextEmail(workflowConfig?.section_d_email || '');
            else if (formData.status === 'SECTION_D_PENDING') setNextEmail('[COMPLETED]');
        }

        if (activeMode === 'submit' && !nextEmail && formData.status !== 'SECTION_D_PENDING') {
            // Re-calculate next email if it was skipped in handleSubmit bypass
            if (formData.status === 'SECTION_B_PENDING') setNextEmail(workflowConfig?.section_c_email || '');
            else if (formData.status === 'SECTION_C_PENDING') setNextEmail(workflowConfig?.section_d_email || '');
            else if (formData.status === 'SECTION_D_PENDING') setNextEmail('[COMPLETED]');
        }

        setIsSubmitting(true);

        try {
            let signature = uploadedSignature;
            if (!signature && sigCanvas.current) {
                signature = sigCanvas.current.getCanvas().toDataURL('image/png');
            }

            if (activeMode === 'submit') {

                const res: any = await ApiConsumer.post(`/department/submit-section/${token}/`, {
                    section_data: currentSectionData,
                    signature,
                    next_email: nextEmail || (formData.status === 'SECTION_B_PENDING' ? workflowConfig?.section_c_email : (formData.status === 'SECTION_C_PENDING' ? workflowConfig?.section_d_email : '')),
                    particulars
                });
                setSubmissionResponse(res);

                // UX Improvement: Redirect directly to success screen
                setIsSubmitted(true);
            } else {
                const res: any = await ApiConsumer.post(`/department/submit-section/${token}/`, {
                    section_data: currentSectionData,
                    signature,
                    next_email: nextEmail,
                    particulars
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
        } catch (err: any) {
            showToast(err?.message || 'Action failed', 'error');
        }
        finally { setIsSubmitting(false); }
    };

    const handleReverse = () => {
        setModalMode('reverse');
        setNextEmail('');
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

    if (error) return <ErrorScreen error={error} onBack={() => navigate('/departmentForm')} />;
    if (!formData) return <LoadingScreen text="Retrieving Form Data" />;

    if (!isEmailVerified) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
                <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border border-slate-100 text-center">
                    <div className="h-16 w-16 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-6 font-black">
                        <ShieldCheck size={32} className="text-indigo-600" />
                    </div>
                    <h2 className="text-xl font-black text-slate-900 mb-2">Security Verification</h2>
                    <p className="text-sm text-slate-500 mb-6 font-medium">Please enter the email address assigned to this report to proceed.</p>

                    <form onSubmit={(e) => {
                        e.preventDefault();
                        const enteredEmail = verificationEmail.toLowerCase().trim();
                        const targetEmail = formData?.access_link?.target_email?.toLowerCase().trim();

                        if (enteredEmail === targetEmail) {
                            setIsEmailVerified(true);
                            setVerificationError('');
                        } else {
                            setVerificationError('Email not authorized. Access denied.');
                        }
                    }}>
                        <input
                            type="email"
                            required
                            placeholder="Enter designated email"
                            value={verificationEmail}
                            onChange={(e) => { setVerificationEmail(e.target.value); setVerificationError(''); }}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-600 focus:border-transparent outline-none mb-2 font-medium text-sm text-slate-900"
                        />
                        {verificationError && (
                            <div className="text-left mb-4">
                                <p className="text-xs text-red-500 font-bold mb-1">{verificationError}</p>
                            </div>
                        )}

                        <button type="submit" className="w-full mt-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black tracking-wide uppercase py-3.5 rounded-xl transition-colors text-[11px] shadow-lg shadow-indigo-200">
                            Verify Identity
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    const curIdx = statusIndex(formData.status);

    return (
        <div className="h-screen bg-slate-50/50 flex flex-col overflow-hidden">
            <div className="sticky top-0 z-40 bg-white">
                <DepartmentFormHeader
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
                                                signature={savedSig}
                                                showName={sec.showName}
                                                showDate={sec.showDate}
                                                showSignature={sec.showSignature}
                                                signatureHeading={sec.signatureHeading}
                                                uploadedSig={uploadedSignature}
                                                onUploadSig={(base64) => {
                                                    setUploadedSignature(base64);
                                                    if (validationErrors.includes('signature')) {
                                                        setValidationErrors(prev => prev.filter(k => k !== 'signature'));
                                                    }
                                                }}
                                                onChange={handleAnswerChange}
                                                onClearSig={clearSignature}
                                                sigRef={sigCanvas}
                                                errors={validationErrors}
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
                options={(formData?.status === 'SECTION_A_PENDING') ? workflowEmails : undefined}
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
            />
        </div>
    );
};

export default DeptForm;
