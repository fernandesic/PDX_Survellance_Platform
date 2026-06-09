import React from "react";

// ── Chart Card ──
export function ChartCard({ title, subtitle, icon: Icon, isDark, children }: {
    title: string; subtitle?: string; icon: any; isDark: boolean; children: React.ReactNode;
}) {
    return (
        <div className={`rounded-xl border p-5 overflow-hidden min-w-0 ${isDark
            ? 'bg-transparent border-white/[0.6]'
            : 'bg-white border-gray-200 shadow-md'
            }`}>
            <div className="flex items-center gap-2 mb-4">
                <Icon size={16} className={isDark ? 'text-[#22C55E]' : 'text-blue-600'} />
                <div>
                    <h3 className={`text-sm font-semibold ${isDark ? 'text-[#E8F5F1]' : 'text-gray-900'}`}>{title}</h3>
                    {subtitle && <p className={`text-[10px] ${isDark ? 'text-[#6FA39A]' : 'text-gray-400'}`}>{subtitle}</p>}
                </div>
            </div>
            {children}
        </div>
    );
}

// ── Density Tooltip ──
export function DensityTooltip({ active, payload, isDark, getMapColor }: any) {
    if (!active || !payload?.[0]) return null;
    const d = payload[0].payload;
    const color = getMapColor ? getMapColor(d.total_chws).bg : '#6b7280';
    return (
        <div className={`rounded-lg shadow-lg border p-3 text-xs ${isDark ? 'bg-transparent border-white/[0.6] text-[#E8F5F1]' : 'bg-white border-gray-200 text-gray-900'}`}>
            <p className="font-bold mb-1">{d.country}</p>
            <p>CHW/10k: <span className="font-semibold" style={{ color }}>{Math.round(d.chws_per_10000)}</span></p>
            <p>Total CHWs: {d.total_chws?.toLocaleString()}</p>
            <p>Population: {d.population_2024 > 0 ? (d.population_2024 / 1_000_000).toFixed(1) + 'M' : '—'}</p>
        </div>
    );
}

// ── Bubble Tooltip ──
export function BubbleTooltip({ active, payload, isDark, getMapColor }: any) {
    if (!active || !payload?.[0]) return null;
    const d = payload[0].payload;
    const color = getMapColor ? getMapColor(d.totalChws).bg : '#6b7280';
    return (
        <div className={`rounded-lg shadow-lg border p-3 text-xs ${isDark ? 'bg-transparent border-white/[0.6] text-[#E8F5F1]' : 'bg-white border-gray-200 text-gray-900'}`}>
            <p className="font-bold mb-1">{d.country}</p>
            <p>Population: {(d.population / 1_000_000).toFixed(1)}M</p>
            <p>CHW/10k: <span className="font-semibold" style={{ color }}>{d.density}</span></p>
            <p>Total CHWs: {d.totalChws.toLocaleString()}</p>
        </div>
    );
}

// ── Loading State ──
export function LoadingState({ isDark }: { isDark: boolean }) {
    return (
        <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-transparent' : 'bg-gray-50'}`}>
            <div className="flex flex-col items-center gap-4">
                <img
                    src={isDark ? "/assets/logo/dark-pdx-without-text.webp" : "/assets/logo/light-pdx-without-text.webp"}
                    alt="PDX"
                    loading="eager"
                    className="w-24 h-auto object-contain rounded-md"
                    style={{ animation: 'breathe 2s ease-in-out infinite' }}
                />
                <p className={`text-sm ${isDark ? 'text-[#A7C8BE]' : 'text-gray-500'}`}>Loading CHW data…</p>
                <style>{`
                    @keyframes breathe {
                        0%, 100% { transform: scale(1); opacity: 0.6; }
                        50% { transform: scale(1.1); opacity: 1; }
                    }
                `}</style>
            </div>
        </div>
    );
}

// ── Error State ──
import { AlertTriangle } from "lucide-react";

export function ErrorState({ isDark }: { isDark: boolean }) {
    return (
        <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-transparent' : 'bg-gray-50'}`}>
            <div className="text-center">
                <AlertTriangle size={32} className="mx-auto mb-3 text-red-500" />
                <p className={isDark ? 'text-gray-300' : 'text-gray-700'}>Failed to load CHW data</p>
                <button onClick={() => window.location.reload()} className="mt-3 text-sm text-[#22C55E] hover:underline">
                    Retry
                </button>
            </div>
        </div>
    );
}
