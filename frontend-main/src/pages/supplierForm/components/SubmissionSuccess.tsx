import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Sparkles, RotateCcw, Download, FileText, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/contexts/ToastProvider';
import { SupplierFormPdf } from './SupplierFormPdf';
import { generateSupplierFormPdf } from '../utils/pdfGenerator';

interface SubmissionSuccessProps {
    mode: 'submit' | 'reverse';
    nextEmail?: string;
    onReset?: () => void;
    reportData?: any;
    particulars?: any;
    submissionResponse?: any;
}

export const SubmissionSuccess: React.FC<SubmissionSuccessProps> = ({
    mode,
    nextEmail,
    reportData,
    particulars,
    submissionResponse
}) => {
    const navigate = useNavigate();
    const { showToast } = useToast();
    const isSubmit = mode === 'submit';
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

    const STATUSES = ['SECTION_A_PENDING', 'SECTION_B_PENDING', 'SECTION_C_PENDING', 'SECTION_D_PENDING', 'COMPLETED'];
    const SECTION_META = [
        { status: 'SECTION_A_PENDING', title: 'CONTRACT COMPLIANCE' },
        { status: 'SECTION_B_PENDING', title: 'PROCUREMENT DIVISION ACTION' },
        { status: 'SECTION_C_PENDING', title: 'OPERATIONS OFFICER RECOMMENDATION' },
        { status: 'SECTION_D_PENDING', title: "HUB lead approval for Final payment" },
    ];

    const getNextSectionName = () => {
        if (!reportData?.status) return 'the next reviewer';
        const curIdx = STATUSES.indexOf(reportData.status);
        if (curIdx >= 0 && curIdx < SECTION_META.length - 1) {
            return SECTION_META[curIdx + 1].title;
        }
        return 'the team';
    };

    const handleDownloadPdf = async () => {
        const record = { ...reportData, ...submissionResponse };
        await generateSupplierFormPdf(
            'supplier-form-pdf',
            record,
            () => setIsGeneratingPdf(true),
            () => {
                setIsGeneratingPdf(false);
                showToast('PDF Record saved successfully!', 'success');
            },
            (error) => {
                setIsGeneratingPdf(false);
                showToast('Failed to generate PDF. Please try again.', 'error');
            }
        );
    };

    return (
        <div className="min-h-[90vh] flex items-center justify-center p-6 relative overflow-hidden bg-slate-50/50">
            {/* Hidden PDF Source - Standardized Isolation */}
            <div className="fixed pointer-events-none -z-50 left-[-9999px] top-0 w-[850px]" style={{ colorScheme: 'light' }}>
                <SupplierFormPdf
                    data={{ ...reportData, ...submissionResponse }}
                    particulars={{ ...particulars, ...submissionResponse }}
                />
            </div>

            {/* Background Decorations */}
            <div className={`absolute top-0 right-0 h-[500px] w-[500px] rounded-full blur-[120px] -mr-64 -mt-64 transition-all duration-1000
                ${isSubmit ? 'bg-emerald-400/10' : 'bg-red-400/10'}
            `} />
            <div className={`absolute bottom-0 left-0 h-[400px] w-[400px] rounded-full blur-[100px] -ml-40 -mb-40 transition-all duration-1000
                ${isSubmit ? 'bg-blue-400/10' : 'bg-amber-400/10'}
            `} />

            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                className="relative z-10 w-full max-w-[480px]"
            >
                <div className="relative bg-white rounded-[32px] p-8 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.08)] border border-slate-100/50 text-center overflow-hidden">
                    {/* Reflective top border */}
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-slate-100 to-transparent" />

                    <div className="relative inline-block mb-6">
                        <motion.div
                            initial={{ scale: 0, rotate: -45 }}
                            animate={{ scale: 1, rotate: 0 }}
                            transition={{ delay: 0.2, type: "spring", stiffness: 200, damping: 15 }}
                            className={`h-10 w-10 rounded-xl flex items-center justify-center text-white shadow-2xl relative z-10
                                ${isSubmit ? 'bg-emerald-500 shadow-emerald-500/30' : 'bg-rose-500 shadow-rose-500/30'}
                            `}
                        >
                            {isSubmit ? <CheckCircle2 size={20} strokeWidth={2.5} /> : <RotateCcw size={20} strokeWidth={2.5} />}
                        </motion.div>

                        {isSubmit && (
                            <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                                className="absolute -inset-3 text-emerald-200"
                            >
                                <Sparkles size={80} className="w-full h-full opacity-20" />
                            </motion.div>
                        )}
                    </div>

                    <div className="space-y-3 mb-8">
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.4 }}
                        >
                            <span className={`text-[10px] font-black uppercase tracking-[0.3em] mb-2 block
                                ${isSubmit ? 'text-emerald-500' : 'text-rose-500'}
                            `}>
                                {isSubmit ? 'Protocol Authorized' : 'Transmission Reverted'}
                            </span>
                            <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                                {isSubmit ? 'Submission Secure' : 'Form Returned'}
                            </h2>
                        </motion.div>

                        <motion.p
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.5 }}
                            className="text-slate-500 text-sm leading-relaxed max-w-sm mx-auto font-medium"
                        >
                            {isSubmit ? (
                                <>
                                    Success! Your documentation has been authenticated and transmitted to 
                                    <span className="text-slate-900 font-bold underline decoration-emerald-500/30 underline-offset-4 mx-1">
                                        {nextEmail || 'the primary reviewer'}
                                    </span>
                                    via the automated notification protocol.
                                </>
                            ) : (
                                <>
                                    Action complete. The protocol has been reverted and an automated notification was sent to 
                                    <span className="text-slate-900 font-bold underline decoration-rose-500/30 underline-offset-4 mx-1">
                                        {nextEmail}
                                    </span>
                                    for immediate correction.
                                </>
                            )}
                        </motion.p>
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                        {isSubmit && (submissionResponse?.status === 'COMPLETED' || reportData?.status === 'COMPLETED') && (
                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={handleDownloadPdf}
                                disabled={isGeneratingPdf}
                                className="h-12 bg-white border border-slate-200 text-indigo-600 rounded-xl font-black text-[11px] uppercase tracking-widest shadow-sm flex items-center justify-center gap-2.5 transition-all hover:bg-slate-50 disabled:opacity-50"
                            >
                                {isGeneratingPdf ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
                                <span>{isGeneratingPdf ? 'Generating Record...' : 'Download PDF Record'}</span>
                                {!isGeneratingPdf && <Download size={14} className="opacity-50" />}
                            </motion.button>
                        )}
                    </div>

                    <div className="mt-12 pt-8 border-t border-slate-50 flex items-center justify-center gap-2">
                        <div className="h-1.5 w-1.5 rounded-full bg-slate-200" />
                        <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">End of Protocol Flow</span>
                        <div className="h-1.5 w-1.5 rounded-full bg-slate-200" />
                    </div>
                </div>
            </motion.div>
        </div>
    );
};
