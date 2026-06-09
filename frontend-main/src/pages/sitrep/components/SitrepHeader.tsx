import React from 'react';

interface SitrepHeaderProps {
    sitrepNumber?: string;
    reportingPeriod?: string;
}

/**
 * WHO AFRO branding header — centered at the top of the form.
 * Shows the WHO logo, report title, and key identifiers.
 */
const SitrepHeader: React.FC<SitrepHeaderProps> = ({ sitrepNumber, reportingPeriod }) => (
    <div className="w-full bg-gradient-to-r from-[#1a2744] via-[#1e3a5f] to-[#1a2744] py-10 px-6 text-center mb-0 rounded-t-2xl relative overflow-hidden">
        {/* Decorative background elements */}
        <div className="absolute top-[-60px] right-[-60px] w-[200px] h-[200px] rounded-full bg-white/5 blur-3xl" />
        <div className="absolute bottom-[-40px] left-[-40px] w-[160px] h-[160px] rounded-full bg-blue-500/5 blur-2xl" />

        <div className="relative z-10">
            {/* WHO Logo */}
            <img
                src="/logo.png"
                alt="WHO AFRO Logo"
                className="w-24 h-auto mx-auto mb-4"
                onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                }}
            />

            {/* Organization line */}
            <p className="text-white/60 text-[10px] uppercase tracking-[0.25em] font-semibold mb-3">
                World Health Organization — Regional Office for Africa
            </p>

            {/* Accent bar */}
            <div className="w-16 h-1 mx-auto mb-4 rounded-full bg-[#4a9fd8]" />

            {/* Title */}
            <h1 className="text-white text-2xl md:text-3xl font-black tracking-tight uppercase mb-1">
                Ebola Virus Disease
            </h1>
            <h2 className="text-[#4a9fd8] text-sm md:text-base font-bold uppercase tracking-wider mb-1">
                Preparedness &amp; Readiness Situation Report (SITREP)
            </h2>
            <p className="text-white/50 text-xs font-medium mt-2">
                African Region · Bundibugyo virus disease (BVD)
            </p>

            {/* SITREP identifiers */}
            {(sitrepNumber || reportingPeriod) && (
                <div className="flex items-center justify-center gap-4 mt-5 flex-wrap">
                    {sitrepNumber && (
                        <span className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/10 backdrop-blur-sm rounded-full border border-white/10 text-white text-xs font-bold">
                            SITREP {sitrepNumber}
                        </span>
                    )}
                    {reportingPeriod && (
                        <span className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/10 backdrop-blur-sm rounded-full border border-white/10 text-white text-xs font-bold">
                            {reportingPeriod}
                        </span>
                    )}
                </div>
            )}
        </div>
    </div>
);

export default SitrepHeader;
