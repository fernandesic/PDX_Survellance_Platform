import { useRef, useState } from "react";
import type { CHWCountry, CHWCountryDetail } from "@/pages/chw/types/chw";
import { Search, ChevronDown } from "lucide-react";

interface CHWHeaderProps {
    isDark: boolean;
    selectedCountry: CHWCountryDetail | null;
    sorted: CHWCountry[];
    handleCountryClick: (name: string) => void;
    getMapColor: (total: number) => { bg: string; label?: string };
}

export function CHWHeader({ isDark, selectedCountry, sorted, handleCountryClick, getMapColor }: CHWHeaderProps) {
    const [topSearchOpen, setTopSearchOpen] = useState(false);
    const [topSearchQuery, setTopSearchQuery] = useState("");
    const topSearchRef = useRef<HTMLDivElement>(null);

    return (
        <div className="flex items-center justify-between">
            <div>
                <h1 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Community Health Workers</h1>
                <p className={`text-sm mt-0.5 ${isDark ? 'text-[#A8C4BB]' : 'text-gray-400'}`}>WHO AFRO Region Workforce Dashboard</p>
            </div>
            <div className="relative" ref={topSearchRef}>
                <button
                    onClick={() => { setTopSearchOpen(!topSearchOpen); setTopSearchQuery(''); }}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm border transition-all ${topSearchOpen
                        ? isDark
                            ? 'bg-[#22C55E]/20 border-[#22C55E]/40 text-[#22C55E]'
                            : 'bg-blue-50 border-blue-300 text-blue-700'
                        : isDark
                            ? 'bg-white/[0.03] backdrop-blur-md border-white/10 text-[#D1E5DE] hover:border-[#22C55E]/30 hover:text-white'
                            : 'bg-white/80 backdrop-blur-md border-gray-100 text-gray-700 hover:border-blue-200 shadow-sm'
                        }`}
                >
                    <Search size={16} />
                    <span className="font-semibold">{selectedCountry ? selectedCountry.country : 'Select Country'}</span>
                    <ChevronDown size={16} className={`transition-transform ${topSearchOpen ? 'rotate-180' : ''}`} />
                </button>
                {topSearchOpen && (
                    <div
                        className={`absolute right-0 top-full mt-2 w-80 rounded-xl border shadow-2xl z-50 overflow-hidden ${isDark
                            ? 'bg-transparent border-white/[0.6]'
                            : 'bg-white/80 backdrop-blur-md border-gray-100'
                            }`}
                    >
                        <div className={`p-2.5 border-b ${isDark ? 'border-white/5' : 'border-gray-100'}`}>
                            <div className="relative">
                                <Search size={13} className={`absolute left-2.5 top-1/2 -translate-y-1/2 ${isDark ? 'text-[#6FA39A]' : 'text-gray-400'}`} />
                                <input
                                    autoFocus
                                    type="text"
                                    placeholder="Search countries…"
                                    value={topSearchQuery}
                                    onChange={e => setTopSearchQuery(e.target.value)}
                                    className={`w-full pl-9 pr-4 py-2.5 rounded-lg text-sm border outline-none transition-colors ${isDark
                                        ? 'bg-white/10 border-white/20 text-white placeholder-[#A8C4BB] focus:border-[#22C55E]/50'
                                        : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400 focus:border-blue-300'
                                        }`}
                                />
                            </div>
                        </div>
                        <div className="max-h-72 overflow-y-auto">
                            {sorted
                                .filter(c => c.country.toLowerCase().includes(topSearchQuery.toLowerCase()))
                                .map(c => {
                                    const isActive = selectedCountry?.country?.toLowerCase() === c.country.toLowerCase();
                                    return (
                                        <button
                                            key={c.id}
                                            onClick={() => {
                                                handleCountryClick(c.country);
                                                setTopSearchOpen(false);
                                                setTopSearchQuery('');
                                            }}
                                            className={`w-full flex items-center justify-between px-3 py-2.5 text-xs transition-all ${isActive
                                                ? isDark
                                                    ? 'bg-[#22C55E]/10 text-[#22C55E]'
                                                    : 'bg-blue-50 text-blue-700'
                                                : isDark
                                                    ? 'text-[#A7C8BE] hover:bg-white/5'
                                                    : 'text-gray-700 hover:bg-gray-50'
                                                }`}
                                        >
                                            <span className={isActive ? 'font-semibold' : ''}>{c.country}</span>
                                            <div className="flex items-center gap-2">
                                                <span className={`text-[10px] ${isDark ? 'text-[#6FA39A]' : 'text-gray-400'}`}>
                                                    {c.total_chws.toLocaleString()} CHWs
                                                </span>
                                                <span className="font-bold" style={{ color: getMapColor(c.total_chws).bg }}>
                                                    {Math.round(c.chws_per_10000)}/10k
                                                </span>
                                            </div>
                                        </button>
                                    );
                                })}
                            {sorted.filter(c => c.country.toLowerCase().includes(topSearchQuery.toLowerCase())).length === 0 && (
                                <div className={`px-4 py-5 text-sm text-center ${isDark ? 'text-[#A8C4BB]' : 'text-gray-400'}`}>
                                    No countries found
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
