import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, X, ChevronRight, CornerDownRight } from 'lucide-react';

interface ConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title?: string;
    message?: string;
    confirmText?: string;
    cancelText?: string;
    type?: 'primary' | 'danger';
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    title = 'Confirm Action',
    message = 'Are you sure you want to proceed?',
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    type = 'primary'
}) => {
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
                        initial={{ scale: 0.95, opacity: 0, y: 30 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.95, opacity: 0, y: 30 }}
                        className="relative w-full max-w-[400px] bg-white rounded-[2rem] shadow-[0_40px_100px_-20px_rgba(0,0,0,0.3)] overflow-hidden"
                    >
                        <div className="p-8">
                            <button
                                onClick={onClose}
                                className="absolute top-6 right-6 h-10 w-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:text-slate-900 transition-all"
                            >
                                <X size={20} />
                            </button>

                            <div className="flex flex-col items-center text-center">
                                <div className={`h-14 w-14 rounded-2xl flex items-center justify-center mb-6 shadow-xl
                                    ${type === 'danger' ? 'bg-rose-50 text-rose-500 shadow-rose-500/10' : 'bg-indigo-50 text-indigo-600 shadow-indigo-600/10'}
                                `}>
                                    <AlertCircle size={28} />
                                </div>

                                <h3 className="text-xl font-black text-slate-900 mb-2">{title}</h3>
                                <p className="text-slate-500 text-[13px] font-medium leading-relaxed mb-8">
                                    {message}
                                </p>

                                <div className="space-y-3 w-full">
                                    <button
                                        onClick={() => {
                                            onConfirm();
                                            onClose();
                                        }}
                                        className={`h-12 w-full rounded-xl flex items-center justify-center gap-2 text-white font-black text-[12px] uppercase tracking-[0.1em] transition-all
                                            ${type === 'danger' ? 'bg-rose-500 hover:bg-rose-600 shadow-rose-500/20' : 'bg-[#5045E4] hover:bg-[#4338CA] shadow-indigo-500/20'}
                                            shadow-lg
                                        `}
                                    >
                                        <span>{confirmText}</span>
                                        <ChevronRight size={16} strokeWidth={3} />
                                    </button>

                                    <button
                                        onClick={onClose}
                                        className="h-12 w-full rounded-xl flex items-center justify-center gap-2 text-slate-400 hover:text-slate-900 hover:bg-slate-50 font-black text-[11px] uppercase tracking-[0.1em] transition-all"
                                    >
                                        <span>{cancelText}</span>
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="bg-slate-50/80 p-4 border-t border-slate-100 flex items-center justify-center gap-2">
                            <CornerDownRight size={12} className="text-slate-300" />
                            <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Awaiting User Authentication</span>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};
