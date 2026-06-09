import React from 'react';
import { BarChart3, Map } from 'lucide-react';

/**
 * Section 2 — Readiness Capacities
 * Two placeholder panels side-by-side (for data team to wire up later)
 */
const ReadinessPlaceholders: React.FC = () => (
    <div className="mb-6">
        {/* Section Header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-gradient-to-r from-[#1a2744] to-[#2c3e6b] rounded-t-xl">
            <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                    <span className="text-white text-sm font-bold">2</span>
                </div>
                <h3 className="text-white font-bold text-base">Readiness Capacities</h3>
            </div>
            <span className="text-white/60 text-xs italic hidden md:block">assessment scale + map</span>
        </div>
        {/* Placeholder panels */}
        <div className="bg-[#f5f7fa] border border-gray-100 border-t-0 rounded-b-xl p-5 shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Readiness Assessment Graph */}
                <div
                    className="rounded-xl border-2 border-dashed border-[#4a9fd8]/40 bg-[#4a9fd8]/5 py-12 px-6 flex flex-col items-center justify-center text-center"
                    style={{
                        backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(74,159,216,0.03) 10px, rgba(74,159,216,0.03) 20px)',
                    }}
                >
                    <BarChart3 className="w-10 h-10 text-[#4a9fd8]/60 mb-3" />
                    <h4 className="text-[#1a2744] font-bold text-sm mb-1">Readiness Assessment Graph</h4>
                    <p className="text-gray-500 text-xs">Bar / radar chart of capacity scores per pillar (0–100%)</p>
                </div>
                {/* Regional Risk Map */}
                <div
                    className="rounded-xl border-2 border-dashed border-[#4a9fd8]/40 bg-[#4a9fd8]/5 py-12 px-6 flex flex-col items-center justify-center text-center"
                    style={{
                        backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(74,159,216,0.03) 10px, rgba(74,159,216,0.03) 20px)',
                    }}
                >
                    <Map className="w-10 h-10 text-[#4a9fd8]/60 mb-3" />
                    <h4 className="text-[#1a2744] font-bold text-sm mb-1">Regional Risk Map</h4>
                    <p className="text-gray-500 text-xs">Member-state choropleth — risk level &amp; readiness status</p>
                </div>
            </div>
        </div>
    </div>
);

export default ReadinessPlaceholders;
