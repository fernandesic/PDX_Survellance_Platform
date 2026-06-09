import React, { useMemo, useState } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { Search } from 'lucide-react';

interface HazardData {
    hazard: string;
    months: {
        jan: number;
        feb: number;
        mar: number;
        apr: number;
        may: number;
        jun: number;
        jul: number;
        aug: number;
        sep: number;
        oct: number;
        nov: number;
        dec: number;
    };
}

interface HazardCalendarTableProps {
    data: HazardData[];
    onMonthClick?: (month: string) => void;
    activeMonth?: string;
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'] as const;

export default function HazardCalendarTable({ data, onMonthClick, activeMonth }: HazardCalendarTableProps) {
    const { theme } = useTheme();
    const isLight = theme === 'light';
    const [searchTerm, setSearchTerm] = useState('');

    const getIntensityColor = (intensity: number) => {
        switch (intensity) {
            case 5: return 'bg-red-600'; // Very High
            case 4: return 'bg-orange-500'; // High
            case 3: return 'bg-yellow-500'; // Moderate
            case 2: // Low
            case 1: return 'bg-green-500'; // Very Low
            default: return 'bg-transparent border border-gray-700/30';
        }
    };

    const tableData = useMemo(() => {
        // Group by hazard and aggregate intensity
        const grouped: Record<string, typeof data[0]['months']> = {};

        data.forEach(item => {
            const hazardName = item.hazard || 'Unknown';
            if (!grouped[hazardName]) {
                grouped[hazardName] = { ...item.months };
            } else {
                // Take the max intensity for that hazard in that month
                MONTHS.forEach(m => {
                    grouped[hazardName][m] = Math.max(grouped[hazardName][m], item.months[m] || 0);
                });
            }
        });

        return Object.entries(grouped)
            .map(([hazard, months]) => ({ hazard, months }))
            .filter(item => item.hazard.toLowerCase().includes(searchTerm.toLowerCase()))
            .sort((a, b) => a.hazard.localeCompare(b.hazard));
    }, [data, searchTerm]);

    return (
        <div className={`rounded-xl overflow-hidden border flex flex-col ${isLight ? 'border-gray-200 bg-white' : 'border-gray-800 bg-[#1B0835]'}`}>
            <div className="p-4 border-b border-gray-800 flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                    <h3 className="font-semibold text-lg">Yearly Hazard Overview</h3>
                    <p className="text-xs text-gray-500 italic">Filter by hazard name or click any month to focus</p>
                </div>

                <div className="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto">
                    {/* Search Input */}
                    <div className="relative w-full md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search hazard..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className={`w-full pl-9 pr-4 py-2 text-sm rounded-lg border focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition-all ${isLight ? 'bg-gray-50 border-gray-200' : 'bg-black/20 border-gray-700 text-white'
                                }`}
                        />
                    </div>

                    <div className="flex gap-4 text-[10px] whitespace-nowrap overflow-x-auto pb-2 md:pb-0">
                        <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-600"></span> Very High</div>
                        <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500"></span> High</div>
                        <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500"></span> Mod</div>
                        <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500"></span> Low</div>
                    </div>
                </div>
            </div>

            <div className="overflow-x-auto max-h-[500px] overflow-y-auto scrollbar-thin scrollbar-thumb-cyan-600 scrollbar-track-gray-800/10">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className={`sticky top-0 z-20 ${isLight ? 'bg-gray-50' : 'bg-[#130722]'}`}>
                            <th className="p-3 text-xs font-bold uppercase tracking-wider border-b border-gray-800 sticky left-0 z-10 bg-inherit min-w-[200px]">Hazard Type</th>
                            {MONTHS.map(m => (
                                <th
                                    key={m}
                                    className={`p-3 text-xs font-bold uppercase tracking-wider border-b border-gray-800 text-center cursor-pointer hover:bg-cyan-500/20 transition-colors ${activeMonth === m ? 'bg-cyan-500/30 text-cyan-400' : ''}`}
                                    onClick={() => onMonthClick?.(m)}
                                >
                                    {m}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {tableData.length === 0 ? (
                            <tr>
                                <td colSpan={13} className="p-8 text-center text-gray-500 italic">
                                    {searchTerm ? `No results found for "${searchTerm}"` : 'No hazard data available for this selection'}
                                </td>
                            </tr>
                        ) : (
                            tableData.map((row, idx) => (
                                <tr key={idx} className={`hover:bg-white/5 transition-colors border-b border-gray-800/50`}>
                                    <td className={`p-3 text-sm font-medium sticky left-0 z-10 border-r border-gray-800/30 ${isLight ? 'bg-white' : 'bg-[#1B0835]'}`}>
                                        {row.hazard}
                                    </td>
                                    {MONTHS.map(m => (
                                        <td key={m} className={`p-1 text-center border-r border-gray-800/10`}>
                                            <div className={`w-full h-8 flex items-center justify-center`}>
                                                <div
                                                    className={`w-6 h-6 rounded-md shadow-inner transition-transform hover:scale-110 ${getIntensityColor(row.months[m])}`}
                                                    title={`${row.hazard} in ${m.toUpperCase()}: Level ${row.months[m]}`}
                                                />
                                            </div>
                                        </td>
                                    ))}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            <div className={`p-2 text-[10px] text-gray-500 text-right ${isLight ? 'bg-gray-50' : 'bg-black/10'}`}>
                Showing {tableData.length} hazards
            </div>
        </div>
    );
}
