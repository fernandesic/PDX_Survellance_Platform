import React from 'react';
import { Loader2, Clock, AlertCircle, RefreshCcw } from 'lucide-react';

export const LoadingScreen = () => (
    <div className="flex-1 flex items-center justify-center p-8 md:p-12 bg-[#f0f2f5] min-h-screen">
        <div className="w-full max-w-md text-center">
            <Loader2 className="w-10 h-10 animate-spin mx-auto mb-4 text-[#1a2744]" />
            <p className="text-sm font-medium text-gray-500">Validating link...</p>
        </div>
    </div>
);

export const ExpiredScreen = ({ onRefresh }: { onRefresh: () => void }) => (
    <div className="flex-1 flex items-center justify-center p-8 md:p-12 bg-[#f0f2f5] min-h-screen">
        <div className="w-full max-w-md text-center">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 bg-amber-100">
                <Clock className="w-8 h-8 text-amber-500" />
            </div>
            <h2 className="text-xl font-bold mb-3 text-gray-900">Link Expired</h2>
            <p className="text-sm leading-relaxed mb-8 text-gray-600">
                This link has expired. Links are valid for a limited time only.<br />
                Please request a new link from your supervisor or try refreshing if it was just reactivated.
            </p>
            <button
                onClick={onRefresh}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl font-bold text-sm transition-all shadow-lg active:scale-95 bg-[#1a2744] text-white hover:bg-[#253557]"
            >
                <RefreshCcw className="w-4 h-4" />
                Refresh Link Status
            </button>
        </div>
    </div>
);

export const InvalidScreen = () => (
    <div className="flex-1 flex items-center justify-center p-8 md:p-12 bg-[#f0f2f5] min-h-screen">
        <div className="w-full max-w-md text-center">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 bg-red-100">
                <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            <h2 className="text-xl font-bold mb-3 text-gray-900">Invalid Link</h2>
            <p className="text-sm leading-relaxed text-gray-600">
                This link is invalid or has been deactivated.<br />
                Please contact your supervisor for a valid link.
            </p>
        </div>
    </div>
);
