// @ts-nocheck
import React, { useState, useRef, useEffect } from 'react';
import { Loader2, Activity, Zap, Flame, ChevronDown, ChevronUp } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';

interface IntelligenceHeaderProps {
    metrics?: any;
    loading?: boolean;
    timeWindow?: string;
    onTimeWindowChange?: (preset: string) => void;
}

export function IntelligenceHeader({ metrics, loading, timeWindow, onTimeWindowChange }: IntelligenceHeaderProps) {
    const { theme } = useTheme();
    const isLight = theme === 'light';
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const getTimeLabel = (preset?: string) => {
        switch (preset) {
            case 'today': return 'Today';
            case '7days': return '7 Days';
            case '14days': return '14 Days';
            case '30days': return '30 Days';
            case '90days': return '90 Days';
            default: return '14 Days';
        }
    };

    return (
        <header className={`h-[100px] flex items-center justify-between p-6 z-20 border-b backdrop-blur-md sticky top-0 transition-colors duration-300 ${isLight ? 'bg-white/90 border-gray-200' : 'bg-[#050810]/80 border-white/10'}`}>
            <div className="flex items-center gap-8">
                <div className="flex items-center gap-4">
                    <div className="relative group cursor-pointer">
                        <div className="absolute -inset-2 bg-gradient-to-r from-orange-500/20 to-rose-500/20 rounded-full blur-lg opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                        <div className={`relative w-10 h-10 rounded-xl border flex items-center justify-center p-2 shadow-2xl transition-all duration-300 ${isLight ? 'bg-white border-gray-200 ring-gray-200 group-hover:ring-orange-500/20' : 'bg-gradient-to-br from-[#1a1f2e] to-[#0f1219] border-white/10 ring-white/5 group-hover:ring-orange-500/20'}`}>
                            <img src="/assets/climate/flame-logo.png" alt="Logo" className="w-full h-full object-contain drop-shadow-[0_0_8px_rgba(249,115,22,0.3)]" />
                        </div>
                    </div>
                    <div className="flex flex-col justify-center">
                        <h1 className={`text-[18px] font-black tracking-tight leading-none ${isLight ? 'text-gray-900' : 'text-transparent bg-clip-text bg-gradient-to-r from-white via-white/90 to-white/70'}`}>
                            Climate Intelligence
                        </h1>
                        <span className={`text-[10px] font-bold tracking-[2px] uppercase mt-0.5 ${isLight ? 'text-gray-400' : 'text-white/30'}`}>
                            Advanced Analytics
                        </span>
                    </div>
                </div>

                {onTimeWindowChange && (
                    <div className="relative" ref={dropdownRef}>
                        <button
                            onClick={() => setIsOpen(!isOpen)}
                            className={`border rounded-xl px-4 py-2 flex items-center gap-3 transition-all h-[42px] group ${isLight ? 'bg-gray-100 border-gray-200 hover:bg-gray-200' : 'bg-white/5 border-white/5 hover:bg-white/10'}`}
                        >
                            <Activity className={`w-4 h-4 group-hover:scale-110 transition-transform ${isLight ? 'text-cyan-600' : 'text-cyan-400'}`} />
                            <span className={`text-[11px] font-black uppercase tracking-[1.5px] ${isLight ? 'text-gray-700' : 'text-white/80'}`}>
                                {getTimeLabel(timeWindow)}
                            </span>
                            {isOpen ? (
                                <ChevronUp className={`w-3.5 h-3.5 ${isLight ? 'text-gray-400' : 'text-white/20'}`} />
                            ) : (
                                <ChevronDown className={`w-3.5 h-3.5 ${isLight ? 'text-gray-400' : 'text-white/20'}`} />
                            )}
                        </button>

                        {isOpen && (
                            <div className={`absolute top-full mt-2 left-0 border rounded-xl shadow-2xl overflow-hidden min-w-[140px] z-50 py-2 transition-all ${isLight ? 'bg-white border-gray-200' : 'bg-[#0f1219] border-white/10'}`}>
                                {[
                                    { id: 'today', label: 'Today' },
                                    { id: '7days', label: '7 Days' },
                                    { id: '14days', label: '14 Days' },
                                    { id: '30days', label: '30 Days' },
                                    { id: '90days', label: '90 Days' }
                                ].map((t) => (
                                    <button
                                        key={t.id}
                                        onClick={() => {
                                            onTimeWindowChange(t.id);
                                            setIsOpen(false);
                                        }}
                                        className={`w-full text-left text-[10px] font-black py-2.5 px-4 transition-all ${isLight
                                            ? `hover:bg-gray-50 ${timeWindow === t.id ? 'text-cyan-600 bg-cyan-50/50' : 'text-gray-500'}`
                                            : `hover:bg-white/5 ${timeWindow === t.id ? 'text-cyan-400' : 'text-white/40'}`
                                            }`}
                                    >
                                        {t.label.toUpperCase()}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
            {metrics && (
                <div className="flex items-center gap-4">
                    <div className={`border rounded-2xl py-1.5 px-4 flex items-center gap-6 shadow-xl relative overflow-hidden h-[42px] transition-all ${isLight ? 'bg-gray-100 border-gray-200' : 'bg-white/5 border-white/5'}`}>
                        {loading && (
                            <div className={`absolute inset-0 flex items-center justify-center z-10 ${isLight ? 'bg-white/40 backdrop-blur-[1px]' : 'bg-black/20 backdrop-blur-[1px]'}`}>
                                <Loader2 className={`w-4 h-4 animate-spin ${isLight ? 'text-cyan-600' : 'text-cyan-500'}`} />
                            </div>
                        )}
                        <div className={`flex flex-col justify-center gap-0.5 border-r pr-4 ${isLight ? 'border-gray-300' : 'border-white/10'}`}>
                            <span className={`text-[9px] font-black uppercase tracking-widest leading-none ${isLight ? 'text-gray-400' : 'text-white/30'}`}>AFRO INTEL</span>
                            <div className="flex items-center gap-2">
                                <div className={`w-1.5 h-1.5 rounded-full shadow-[0_0_8px_rgba(34,211,238,0.6)] animate-pulse ${isLight ? 'bg-cyan-500' : 'bg-cyan-400'}`} />
                                <span className={`text-[14px] font-black tracking-tighter leading-none ${isLight ? 'text-gray-900' : 'text-white'}`}>{metrics.countriesFlagged}</span>
                                <span className="text-[9px] font-bold text-[#f97316]">{(metrics.countriesFlagged / 47 * 100).toFixed(0)}%</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-5">
                            {/* ADMIN1 block hidden until sub-national level data is supported
                            <div className="flex flex-col justify-center gap-0.5">
                                <div className="flex items-center gap-1.5">
                                    <span className={`text-[14px] font-black tracking-tighter leading-none ${isLight ? 'text-gray-900' : 'text-white'}`}>{metrics.admin1Flagged}</span>
                                    <span className={`text-[9px] font-bold ${isLight ? 'text-gray-400' : 'text-white/40'}`}>ADMIN1</span>
                                </div>
                                <span className={`text-[8px] font-bold uppercase tracking-tight ${isLight ? 'text-gray-400' : 'text-white/20'}`}>Active</span>
                            </div>
                            */}
                        </div>
                    </div>
                    <div className={`h-8 w-px mx-2 ${isLight ? 'bg-gray-200' : 'bg-white/5'}`} />

                    <div className="flex items-center gap-2">
                        {[
                            { label: 'Alerts', value: metrics.newEvents24h, color: 'bg-amber-500', icon: Activity },
                            { label: 'Risks', value: metrics.escalations24h, color: 'bg-orange-500', icon: Zap },
                            { label: 'Convergent', value: metrics.convergenceEvents, color: 'bg-rose-500', icon: Flame }
                        ].map((m, i) => (
                            <div key={i} className={`border rounded-xl px-3 py-1.5 flex items-center gap-3 transition-all cursor-pointer group h-[42px] ${isLight ? 'bg-gray-100 border-gray-200 hover:bg-gray-200 shadow-md hover:shadow-lg' : 'bg-white/5 border-white/5 hover:bg-white/10'}`}>
                                <div className={`w-6 h-6 rounded-lg flex items-center justify-center border group-hover:scale-110 transition-transform ${isLight ? 'bg-white border-gray-200' : 'bg-white/5 border-white/5'} ${m.color}/10`}>
                                    <m.icon className={`w-3.5 h-3.5 ${m.color.replace('bg-', 'text-')}`} />
                                </div>
                                <div className="flex flex-col justify-center">
                                    <span className={`text-[14px] font-black tracking-tighter leading-none ${isLight ? 'text-gray-900' : 'text-white'}`}>{m.value}</span>
                                    <span className={`text-[8px] font-bold uppercase tracking-tight leading-none mt-0.5 ${isLight ? 'text-gray-400' : 'text-white/30'}`}>{m.label}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </header>
    );
}

