import { ArrowRight } from "lucide-react";
import type { CHWCountry } from "@/pages/chw/types/chw";

interface CoverageTierProps {
    label: string;
    desc: string;
    countries: CHWCountry[];
    color: string;
    isDark: boolean;
    onSelectCountry: (name: string) => void;
    defaultOpen?: boolean;
    selectedCountry?: string;
}

export function CoverageTier({ label, desc, countries, color, isDark, onSelectCountry, defaultOpen = false, selectedCountry }: CoverageTierProps) {
    if (countries.length === 0) return null;
    return (
        <div className={`rounded-lg border ${isDark ? 'border-white/20 bg-white/5' : 'border-gray-100'}`}>
            <div className={`flex items-center justify-between px-4 py-3 rounded-t-lg`}>
                <div className="flex items-center gap-2.5">
                    <span className="w-3.5 h-3.5 rounded-sm" style={{ backgroundColor: color }} />
                    <span className={`text-sm font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{label}</span>
                    <span className={`text-xs ${isDark ? 'text-[#A8C4BB]' : 'text-gray-400'}`}>{desc}</span>
                </div>
                <span className="text-sm font-bold" style={{ color }}>{countries.length}</span>
            </div>
            <div className="px-3 pb-2 space-y-1">
                {countries.map(c => {
                    const isActive = selectedCountry && c.country.toLowerCase() === selectedCountry.toLowerCase();
                    return (
                        <button
                            key={c.id}
                            onClick={() => onSelectCountry(c.country)}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-all cursor-pointer ${isActive
                                ? isDark
                                    ? 'bg-[#22C55E]/20 text-[#22C55E] border border-[#22C55E]/40'
                                    : 'bg-blue-50 text-blue-700 border border-blue-200'
                                : isDark
                                    ? 'hover:bg-white/10 text-[#D1E5DE] border border-transparent'
                                    : 'hover:bg-gray-50 text-gray-600 border border-transparent'
                                }`}
                        >
                            <span className={isActive ? 'font-semibold' : ''}>{c.country}</span>
                            <div className="flex items-center gap-2">
                                <span className="font-bold" style={{ color: isActive ? (isDark ? '#22C55E' : '#2563eb') : color }}>
                                    {c.chws_per_10000 > 0 ? Math.round(c.chws_per_10000) : '—'}
                                </span>
                                <ArrowRight size={12} className={isActive ? (isDark ? 'text-[#22C55E]' : 'text-blue-500') : 'text-[#6FA39A]'} />
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
