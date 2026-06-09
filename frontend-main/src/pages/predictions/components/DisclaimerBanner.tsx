import { AlertTriangle, X } from 'lucide-react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function DisclaimerBanner() {
    const [dismissed, setDismissed] = useState(false);

    return (
        <AnimatePresence>
            {!dismissed && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, height: 0 }}
                    className="relative flex items-center gap-3 px-4 py-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-200 text-sm"
                >
                    <AlertTriangle size={16} className="text-amber-400 flex-shrink-0" />
                    <span>
                        <strong>Composite risk intelligence</strong> — Predictive estimates derived from STAR, Climate, Sentinel, IHR &amp; Readiness data.
                        Not official WHO guidance.
                    </span>
                    <button
                        onClick={() => setDismissed(true)}
                        className="ml-auto flex-shrink-0 p-1 rounded hover:bg-amber-500/20 transition-colors"
                    >
                        <X size={14} />
                    </button>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
