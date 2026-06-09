import React from 'react';
import { RotateCcw, ShieldCheck } from 'lucide-react';
import { motion } from 'framer-motion';

interface DepartmentFormHeaderProps {
    serialNo: string;
    status: string;
    statusDisplay?: string;
    onReverse: () => void;
    showReverse: boolean;
}

export const DepartmentFormHeader: React.FC<DepartmentFormHeaderProps> = ({ status, statusDisplay, onReverse, showReverse }) => {
    return (
        <header className="bg-[#0F172A] border-b border-white/5 relative overflow-hidden">
            {/* Decorative mesh background for header */}
            <div className="absolute top-0 right-0 h-64 w-64 bg-indigo-600/10 rounded-full blur-[80px] -mr-32 -mt-32" />
            <div className="absolute top-0 left-0 h-40 w-40 bg-blue-600/10 rounded-full blur-[60px] -ml-20 -mt-20" />

            <div className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-between relative z-10">
                <div className="flex items-center gap-6">
                    <motion.div
                        whileHover={{ scale: 1.05 }}
                        className="h-14 w-14 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-[0_8px_20px_-4px_rgba(79,70,229,0.4)]"
                    >
                        <ShieldCheck size={28} className="text-white" />
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.1 }}
                    >
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em]">Nairobi Emergency Hub | World Health Organization</span>
                        </div>
                        <h1 className="text-3xl font-black text-white tracking-tight mb-2">
                            PAYMENT <span className="text-indigo-400">AUTHORIZATION</span>
                        </h1>
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black text-white/60 uppercase tracking-widest">Strictly Confidential </span>
                            <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Not For Release Outside WHO</span>
                        </div>
                    </motion.div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="hidden md:flex flex-col items-end mr-2">
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1">Protocol Status</span>
                        <div className={`flex items-center gap-2 px-3 py-1 rounded-full border text-[10px] font-black uppercase tracking-widest
                            ${status === 'COMPLETED'
                                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                                : 'bg-amber-500/10 border-amber-500/20 text-amber-400'}
                        `}>
                            <div className={`h-1.5 w-1.5 rounded-full ${status === 'COMPLETED' ? 'bg-emerald-400' : 'bg-amber-400'} animate-pulse`} />
                            {statusDisplay || status.replace(/_/g, ' ')}
                        </div>
                    </div>

                    {showReverse && (
                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={onReverse}
                            className="h-12 px-6 flex items-center gap-3 rounded-2xl bg-white/5 border border-white/5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/20 transition-all font-black text-xs uppercase tracking-widest"
                        >
                            <RotateCcw size={16} />
                            <span>Return Protocol</span>
                        </motion.button>
                    )}
                </div>
            </div>
        </header>
    );
};
