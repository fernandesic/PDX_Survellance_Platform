import React from 'react';
import { Loader2, CheckCircle2 } from 'lucide-react';

interface SavingIndicatorProps {
    saving: boolean;
    saved: boolean;
}

const SavingIndicator: React.FC<SavingIndicatorProps> = ({ saving, saved }) => {
    if (saving) return (
        <span className="inline-flex items-center gap-1.5 text-[10px] text-blue-500 font-medium animate-pulse">
            <Loader2 className="w-3 h-3 animate-spin" /> Saving...
        </span>
    );
    if (saved) return (
        <span className="inline-flex items-center gap-1.5 text-[10px] text-green-500 font-medium">
            <CheckCircle2 className="w-3 h-3" /> Saved
        </span>
    );
    return null;
};

export default SavingIndicator;
