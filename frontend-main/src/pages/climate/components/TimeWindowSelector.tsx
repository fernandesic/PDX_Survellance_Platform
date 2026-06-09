// @ts-nocheck
import { Calendar, Zap, Database } from 'lucide-react';
import type { TimeWindowPreset } from '@/pages/climate/types/climate';
import { useTheme } from '@/contexts/ThemeContext';

interface TimeWindowSelectorProps {
    selectedWindow: TimeWindowPreset;
    onChange: (window: TimeWindowPreset) => void;
}

const TIME_WINDOWS: { value: TimeWindowPreset; label: string; isLive?: boolean }[] = [
    { value: 'today', label: 'Today', isLive: true },
    { value: '7days', label: '7 Days' },
    { value: '14days', label: '14 Days' },
    { value: '30days', label: '30 Days' },
    { value: '90days', label: '90 Days' },
];

export function TimeWindowSelector({ selectedWindow, onChange }: TimeWindowSelectorProps) {
    const { theme } = useTheme();
    const isLight = theme === 'light';
    const isLiveMode = selectedWindow === 'today';

    return (
        <div>
            <div className="flex items-center gap-2 mb-3">
                <Calendar className="w-5 h-5 text-cyan-400" />
                <h3 className={`text-sm font-semibold ${isLight ? 'text-gray-900' : 'text-white'}`}>Time Window</h3>
            </div>

            <div className="flex flex-wrap gap-2 mb-3">
                {TIME_WINDOWS.map((window) => (
                    <button
                        key={window.value}
                        onClick={() => onChange(window.value)}
                        className={`flex-1 min-w-[70px] px-3 py-2 rounded-md text-xs font-medium transition ${selectedWindow === window.value
                            ? window.isLive
                                ? 'bg-emerald-600 text-white'
                                : 'bg-cyan-600 text-white'
                            : isLight
                                ? 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-900 border border-gray-200'
                                : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-300'
                            }`}
                    >
                        <span className="flex items-center justify-center gap-1">
                            {window.isLive && <Zap className="w-3 h-3" />}
                            {window.label}
                        </span>
                    </button>
                ))}
            </div>

            <div className={`flex items-center gap-2 px-3 py-2 rounded-md text-xs ${isLiveMode
                ? isLight ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' : 'bg-emerald-900/30 border border-emerald-700/50 text-emerald-300'
                : isLight ? 'bg-blue-50 border border-blue-200 text-blue-700' : 'bg-blue-900/30 border border-blue-700/50 text-blue-300'
                }`}>
                {isLiveMode ? (
                    <>
                        <Zap className="w-4 h-4" />
                        <span><strong>Live Data</strong> from Open-Meteo (real-time weather)</span>
                    </>
                ) : (
                    <>
                        <Database className="w-4 h-4" />
                        <span><strong>Historical Data</strong> from NASA POWER (5-day delay)</span>
                    </>
                )}
            </div>
        </div>
    );
}

