import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ProgressStepperProps {
    sections: any[];
    currentStatus: string;
    statusIndex: (s: string) => number;
}

export const ProgressStepper: React.FC<ProgressStepperProps> = ({ sections, currentStatus, statusIndex }) => {
    // const activeIdx = statusIndex(currentStatus);

    return (
        <div className="bg-white/80 backdrop-blur-md border-b border-slate-100 shadow-[0_1px_2px_rgba(0,0,0,0.02)] sticky top-[104px] z-30">
            <div className="max-w-7xl mx-auto px-6 py-5">
                <div className="flex items-center justify-between gap-4 max-w-4xl mx-auto">
                    {sections.map((sec: any, i: number) => {
                        const isDone = statusIndex(currentStatus) > i || currentStatus === 'COMPLETED';
                        const isActive = currentStatus === sec.status;

                        return (
                            <React.Fragment key={sec.letter}>
                                <div className="flex items-center gap-4 group cursor-default">
                                    <div className="relative">
                                        <AnimatePresence mode="wait">
                                            {isDone ? (
                                                <motion.div
                                                    key="done"
                                                    initial={{ scale: 0.8, opacity: 0 }}
                                                    animate={{ scale: 1, opacity: 1 }}
                                                    exit={{ scale: 0.8, opacity: 0 }}
                                                    style={{ background: sec.color }}
                                                    className="h-10 w-10 rounded-full flex items-center justify-center text-white shadow-lg"
                                                >
                                                    <CheckCircle2 size={18} />
                                                </motion.div>
                                            ) : isActive ? (
                                                <motion.div
                                                    key="active"
                                                    initial={{ scale: 0.8, opacity: 0 }}
                                                    animate={{ scale: 1, opacity: 1 }}
                                                    className="h-10 w-10 rounded-full flex items-center justify-center text-white relative shadow-xl"
                                                    style={{ background: sec.color }}
                                                >
                                                    <motion.div
                                                        animate={{ scale: [1, 1.4, 1], opacity: [0.5, 0, 0.5] }}
                                                        transition={{ repeat: Infinity, duration: 2 }}
                                                        className="absolute inset-0 rounded-full"
                                                        style={{ background: sec.color }}
                                                    />
                                                    <span className="text-xs font-black relative z-10">{sec.letter}</span>
                                                </motion.div>
                                            ) : (
                                                <motion.div
                                                    key="pending"
                                                    className="h-10 w-10 rounded-full flex items-center justify-center bg-slate-50 border-2 border-slate-100 text-slate-300 transition-colors"
                                                >
                                                    <span className="text-xs font-black">{sec.letter}</span>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>

                                    <div className="hidden lg:flex flex-col">
                                        <span className={`text-[9px] font-black uppercase tracking-[0.2em] transition-colors
                                            ${isActive ? 'text-slate-900' : 'text-slate-400'}
                                        `}>
                                            Step 0{i + 1}
                                        </span>
                                        <span className={`text-[11px] font-bold whitespace-nowrap transition-colors
                                            ${isActive ? 'text-slate-900' : isDone ? 'text-slate-600' : 'text-slate-400'}
                                        `}>
                                            {sec.title}
                                        </span>
                                    </div>
                                </div>

                                {i < sections.length - 1 && (
                                    <div className="flex-1 max-w-[60px] h-[2px] rounded-full bg-slate-100 overflow-hidden">
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: isDone ? '100%' : '0%' }}
                                            transition={{ duration: 0.8, ease: "easeInOut" }}
                                            className="h-full rounded-full"
                                            style={{ background: sec.color }}
                                        />
                                    </div>
                                )}
                            </React.Fragment>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};
