import React from 'react';
import { Mail, Loader2, RotateCcw, MessageSquare, ChevronRight, X, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface EmailModalProps {
    isOpen: boolean;
    onClose: () => void;
    email: string;
    onEmailChange: (val: string) => void;
    isSubmitting: boolean;
    onConfirm: () => void;
    status: string;
    mode?: 'submit' | 'reverse';
    note?: string;
    onNoteChange?: (val: string) => void;
    options?: string[]; // New prop for email dropdown
    isReadOnly?: boolean; // New prop for locking fixed emails
}

export const EmailModal: React.FC<EmailModalProps> = ({
    isOpen, onClose, email, onEmailChange, isSubmitting, onConfirm, status, mode = 'submit', note = '', onNoteChange, options, isReadOnly
}) => {
    const [isDropdownOpen, setIsDropdownOpen] = React.useState(false);
    const isReverse = mode === 'reverse';

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
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
                        className="relative w-full max-w-[400px] bg-white rounded-[1.5rem] shadow-[0_32px_80px_-16px_rgba(0,0,0,0.4)] overflow-hidden h-[500px] flex flex-col"
                    >
                        <div className="px-6 py-6 flex-1 flex flex-col">
                            <button
                                onClick={onClose}
                                className="absolute top-6 right-6 h-12 w-12 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-all"
                            >
                                <X size={22} strokeWidth={2} />
                            </button>

                            <div className="text-center mb-6">
                                <motion.div
                                    initial={{ scale: 0.8, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    transition={{ delay: 0.1, type: 'spring' }}
                                    className={`h-10 w-10 rounded-xl flex items-center justify-center text-white mx-auto mb-4 shadow-xl
                                        ${isReverse ? 'bg-rose-500 shadow-rose-500/20' : 'bg-[#5045E4] shadow-[#5045E4]/20'}
                                    `}
                                >
                                    {isReverse ? <RotateCcw size={22} strokeWidth={2} /> : <Mail size={22} strokeWidth={2} />}
                                </motion.div>
                                <motion.h3
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.15 }}
                                    className="text-[18px] font-black text-[#1A1F36] tracking-tight mb-1"
                                >
                                    {isReverse ? 'Revert Protocol' : 'Transmit to Reviewer'}
                                </motion.h3>
                                <motion.p
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.2 }}
                                    className="text-slate-500 text-[13px] font-medium leading-relaxed max-w-[300px] mx-auto"
                                >
                                    {isReverse
                                        ? 'Authorize return of documentation to the previous stage.'
                                        : 'Initiate secure transmission to the next reviewer.'}
                                </motion.p>
                            </div>

                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.25 }}
                                className="space-y-4 mb-6 flex-1 flex flex-col justify-center"
                            >
                                {/* Recipient Identifier */}
                                {(status !== 'SECTION_D_PENDING' || isReverse) && (
                                    <div className="space-y-2.5">
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.1em] ml-1">
                                            {isReverse ? 'Origin Reviewer ID' : 'Target Reviewer ID'}
                                        </label>
                                        <div className="relative group">
                                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#5045E4] transition-colors z-10">
                                                <Mail size={16} strokeWidth={2} />
                                            </div>

                                            {options && options.length > 0 && !isReverse ? (
                                                <div className="relative">
                                                    <button
                                                        type="button"
                                                        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                                        className="w-full h-12 pl-10 pr-4 rounded-xl bg-[#F8FAFC] border border-slate-100 text-[13px] font-bold text-slate-700 outline-none flex items-center justify-between hover:bg-slate-50 transition-all"
                                                    >
                                                        <span className={email ? 'text-slate-700' : 'text-slate-400 font-semibold'}>
                                                            {email || "Select Recipient..."}
                                                        </span>
                                                        <ChevronRight size={16} className={`transition-transform duration-200 ${isDropdownOpen ? '-rotate-90' : 'rotate-90'}`} />
                                                    </button>

                                                    <AnimatePresence>
                                                        {isDropdownOpen && (
                                                            <motion.div
                                                                initial={{ opacity: 0, y: -10, scale: 0.95 }}
                                                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                                                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                                                                className="absolute bottom-full mb-2 left-0 right-0 bg-white border border-slate-100 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] overflow-hidden z-[110]"
                                                            >
                                                                <div className="p-1 max-h-[200px] overflow-y-auto custom-scrollbar">
                                                                    {options.map((opt) => (
                                                                        <button
                                                                            key={opt}
                                                                            type="button"
                                                                            onClick={() => {
                                                                                onEmailChange(opt);
                                                                                setIsDropdownOpen(false);
                                                                            }}
                                                                            className={`w-full px-4 py-3 text-left text-[13px] font-bold rounded-xl transition-all
                                                                                ${email === opt
                                                                                    ? 'bg-[#5045E4] text-white shadow-lg shadow-[#5045E4]/20'
                                                                                    : 'text-slate-600 hover:bg-slate-50 hover:text-[#5045E4]'}
                                                                            `}
                                                                        >
                                                                            {opt}
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            </motion.div>
                                                        )}
                                                    </AnimatePresence>
                                                </div>
                                            ) : (
                                                <input
                                                    type="email"
                                                    value={email}
                                                    onChange={(e) => onEmailChange(e.target.value)}
                                                    placeholder="email.com"
                                                    readOnly={isReadOnly}
                                                    className={`w-full h-12 pl-10 pr-4 rounded-xl border border-slate-100 text-[13px] font-bold outline-none transition-all placeholder:text-slate-400 placeholder:font-semibold
                                                        ${isReadOnly
                                                            ? 'bg-slate-50 text-slate-400 cursor-not-allowed'
                                                            : 'bg-[#F8FAFC] text-slate-700 focus:bg-white focus:ring-2 focus:ring-[#5045E4]/10 focus:border-[#5045E4]/20'}
                                                    `}
                                                />
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Context Note */}
                                <div className="space-y-2.5">
                                    <label className="block text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">
                                        Action Context {isReverse && '(Required)'}
                                    </label>
                                    <div className="relative group">
                                        <div className="absolute left-5 top-6 text-slate-400 group-focus-within:text-[#5045E4] transition-colors">
                                            <MessageSquare size={18} strokeWidth={2} />
                                        </div>
                                        <textarea
                                            value={note}
                                            onChange={(e) => onNoteChange?.(e.target.value)}
                                            placeholder={isReverse ? "Identify dependencies or errors requiring correction..." : "Provide additional context for the secure transmission..."}
                                            rows={3}
                                            className="w-full pl-12 pr-4 py-4 rounded-[1.25rem] bg-[#F8FAFC] border border-slate-100 text-[14px] font-bold text-slate-700 outline-none focus:bg-white focus:ring-4 focus:ring-[#5045E4]/10 focus:border-[#5045E4]/20 transition-all resize-none min-h-[100px] placeholder:text-slate-400 placeholder:font-semibold leading-relaxed"
                                        />
                                    </div>
                                </div>
                            </motion.div>

                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.3 }}
                                className="space-y-4"
                            >
                                <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    disabled={isSubmitting || (status !== 'SECTION_D_PENDING' && !email && !isReverse) || (isReverse && (!email || !note))}
                                    onClick={onConfirm}
                                    className={`h-12 w-full rounded-xl flex items-center justify-center gap-2 text-white font-black text-[12px] uppercase tracking-[0.1em] transition-all disabled:opacity-50 disabled:scale-100
                                        ${isReverse ? 'bg-rose-500 shadow-[0_8px_16px_-6px_rgba(244,63,94,0.3)] hover:bg-rose-600' : 'bg-[#AAA3FA] shadow-[0_8px_16px_-6px_rgba(170,163,250,0.4)] hover:bg-[#9E96F9]'}
                                    `}
                                >
                                    {isSubmitting ? (
                                        <Loader2 className="animate-spin" size={22} />
                                    ) : (
                                        <>
                                            <span>
                                                {isReverse ? 'Confirm Reversal' : (status === 'SECTION_D_PENDING' ? 'Authorize Final Sign-off' : 'Authorize Transmission')}
                                            </span>
                                            <ChevronRight size={16} strokeWidth={3} />
                                        </>
                                    )}
                                </motion.button>

                                <button
                                    onClick={onClose}
                                    className="mt-2 w-full flex items-center justify-center text-[#7C8B9F] hover:text-slate-900 font-black text-[11px] uppercase tracking-[0.15em] transition-colors"
                                >
                                    Abort Action
                                </button>
                            </motion.div>

                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.4 }}
                                className="mt-auto pt-4 flex items-center justify-center gap-2 opacity-70"
                            >
                                <ShieldCheck size={12} className="text-slate-400" />
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.15em]">Secure 256-bit Protocol Transmission</span>
                            </motion.div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};
