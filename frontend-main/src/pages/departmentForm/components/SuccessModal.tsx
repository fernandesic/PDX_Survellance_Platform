import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Clipboard, X, ExternalLink, Sparkles } from 'lucide-react';

interface SuccessModalProps {
    isOpen: boolean;
    onClose: () => void;
    link: string;
    nextDept: string;
}

export const SuccessModal: React.FC<SuccessModalProps> = ({ isOpen, onClose, link, nextDept }) => {
    const handleCopy = () => {
        navigator.clipboard.writeText(link);
        alert('Link copied to clipboard!');
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                    />

                    <motion.div
                        initial={{ scale: 0.9, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.9, opacity: 0, y: 20 }}
                        className="relative w-full max-w-[440px] bg-white rounded-[2rem] shadow-[0_40px_100px_-20px_rgba(0,0,0,0.3)] overflow-hidden"
                    >
                        <div className="p-8 flex flex-col items-center">
                            <button
                                onClick={onClose}
                                className="absolute top-6 right-6 h-10 w-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:text-slate-900 transition-all"
                            >
                                <X size={20} />
                            </button>

                            <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ type: 'spring', delay: 0.2 }}
                                className="h-16 w-16 bg-emerald-500 rounded-2xl flex items-center justify-center text-white shadow-2xl shadow-emerald-500/30 mb-6"
                            >
                                <CheckCircle2 size={32} strokeWidth={2.5} />
                            </motion.div>

                            <h3 className="text-2xl font-black text-slate-900 mb-2">Submission Successful!</h3>
                            <p className="text-slate-500 text-sm font-medium text-center mb-8 max-w-[300px]">
                                Your section is authenticated. Please provide the link below to the <span className="text-slate-900 font-bold underline decoration-emerald-500/30">{nextDept}</span> to proceed.
                            </p>

                            <div className="w-full bg-slate-50 rounded-2xl p-4 border border-slate-100 mb-6 relative group">
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Next Stage Link</span>
                                <div className="flex items-center justify-between gap-3">
                                    <p className="text-[12px] font-bold text-slate-600 truncate flex-1">
                                        {link}
                                    </p>
                                    <button
                                        onClick={handleCopy}
                                        className="h-10 px-4 bg-white border border-slate-200 rounded-xl text-indigo-600 font-black text-[10px] uppercase tracking-wider shadow-sm hover:shadow-md transition-all flex items-center gap-2 whitespace-nowrap"
                                    >
                                        <Clipboard size={14} />
                                        Copy
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3 w-full">
                                <button
                                    onClick={onClose}
                                    className="h-12 bg-slate-900 text-white rounded-xl font-black text-[11px] uppercase tracking-widest shadow-xl shadow-slate-200 hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
                                >
                                    <span>Continue</span>
                                    <ExternalLink size={14} />
                                </button>
                                <button
                                    onClick={handleCopy}
                                    className="h-12 bg-emerald-50 text-emerald-600 rounded-xl font-black text-[11px] uppercase tracking-widest hover:bg-emerald-100 transition-all flex items-center justify-center gap-2 border border-emerald-100"
                                >
                                    <span>Copy Link</span>
                                    <Sparkles size={14} />
                                </button>
                            </div>
                        </div>

                        <div className="bg-slate-50 p-4 border-t border-slate-100 flex items-center justify-center gap-2">
                            <div className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Protocol Authentication Complete</span>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};
