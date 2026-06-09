import { useState, useEffect } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { stardata } from '@/pages/stardata/services/stardata';
import type { StarDataType } from '@/pages/stardata/types/stardata';
import { logger } from "@/utils/logger";

const MONTHS = [
    { key: 'jan', label: 'Jan' },
    { key: 'feb', label: 'Feb' },
    { key: 'mar', label: 'Mar' },
    { key: 'apr', label: 'Apr' },
    { key: 'may', label: 'May' },
    { key: 'jun', label: 'Jun' },
    { key: 'jul', label: 'Jul' },
    { key: 'aug', label: 'Aug' },
    { key: 'sep', label: 'Sep' },
    { key: 'oct', label: 'Oct' },
    { key: 'nov', label: 'Nov' },
    { key: 'dec', label: 'Dec' },
];

export default function AnnualHazardTable({ country }: { country: string }) {
    const { theme } = useTheme();
    const isLight = theme === 'light';
    const [loading, setLoading] = useState(false);
    const [hazards, setHazards] = useState<StarDataType[]>([]);

    useEffect(() => {
        const fetchHazards = async () => {
            if (!country) return;
            setLoading(true);
            try {
                const response = await stardata.list(1, 100, undefined, country);
                setHazards(response.results || []);
            } catch (error) {
                logger.error('Failed to load annual hazards:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchHazards();
    }, [country]);

    // Risk colors matching values 1-4
    const getRiskBgColor = (val: string | number) => {
        const v = String(val).trim();
        if (v === '1') return '#22c55e'; // Low
        if (v === '2') return '#facc15'; // Moderate
        if (v === '3') return '#f97316'; // High
        if (v === '4') return '#ef4444'; // Very High
        return 'transparent';
    };

    return (
        <div className={`mt-8 p-6 rounded-2xl shadow-lg ${isLight ? 'bg-white border border-gray-200' : 'bg-gradient-to-br from-[#1a1d3e]/80 to-[#1B0835]/90'}`}>
            <h3 className={`text-xl font-bold mb-1 ${isLight ? 'text-[#1a1a1a]' : 'text-white'}`}>Annual Hazards Matrix - {country}</h3>
            <p className={`text-sm mb-4 ${isLight ? 'text-gray-600' : 'text-gray-400'}`}>12-month hazard risk variations</p>

            <div className={`mb-4 flex items-center gap-4 rounded-lg p-3 border ${isLight ? 'bg-gray-100 border-gray-300' : 'bg-gray-800/30 border-gray-700/50'}`}>
                <span className={`text-sm font-medium ${isLight ? 'text-gray-700' : 'text-gray-400'}`}>Risk Level:</span>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                        <div className="w-4 h-4 rounded bg-[#22c55e]"></div>
                        <span className={`text-xs ${isLight ? 'text-gray-700' : 'text-gray-300'}`}>Low (1)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-4 h-4 rounded bg-[#facc15]"></div>
                        <span className={`text-xs ${isLight ? 'text-gray-700' : 'text-gray-300'}`}>Moderate (2)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-4 h-4 rounded bg-[#f97316]"></div>
                        <span className={`text-xs ${isLight ? 'text-gray-700' : 'text-gray-300'}`}>High (3)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-4 h-4 rounded bg-[#ef4444]"></div>
                        <span className={`text-xs ${isLight ? 'text-gray-700' : 'text-gray-300'}`}>Very High (4)</span>
                    </div>
                </div>
            </div>

            <div className="overflow-x-auto overflow-y-auto max-h-[500px] scrollbar-thin scrollbar-thumb-blue-600 scrollbar-track-blue-900/20">
                <table className="w-full text-sm">
                    <thead className={`sticky top-0 ${isLight ? 'bg-blue-50' : 'bg-[#1B0835]'}`}>
                        <tr className={`border-b ${isLight ? 'border-gray-200' : 'border-purple-800/50'}`}>
                            <th className={`text-left py-3 px-3 font-medium ${isLight ? 'text-gray-700' : 'text-gray-300'} w-1/4`}>Hazard</th>
                            <th className={`text-left py-3 px-3 font-medium ${isLight ? 'text-gray-700' : 'text-gray-300'} w-1/4`}>Type</th>
                            {MONTHS.map(m => (
                                <th key={m.key} className={`text-center py-3 px-2 font-medium ${isLight ? 'text-gray-700' : 'text-gray-300'}`}>
                                    {m.label}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={14} className="py-8 text-center text-gray-500">Loading...</td>
                            </tr>
                        ) : hazards.length > 0 ? (
                            hazards.map((hazard, idx) => (
                                <tr key={`${hazard.id}-${idx}`} className={`border-b transition-colors ${isLight ? 'border-gray-200 hover:bg-gray-50' : 'border-purple-800/20 hover:bg-purple-900/20'}`}>
                                    <td className={`py-2 px-3 text-xs font-semibold ${isLight ? 'text-gray-800' : 'text-gray-200'}`}>
                                        {hazard.hazard || '-'}
                                    </td>
                                    <td className={`py-2 px-3 text-xs ${isLight ? 'text-gray-600' : 'text-gray-400'}`}>
                                        {hazard.main_type_of_hazard || '-'}
                                    </td>
                                    {MONTHS.map(m => {
                                        const val = (hazard as any)[m.key];
                                        const bgColor = getRiskBgColor(val);
                                        return (
                                            <td key={m.key} className="py-2 px-1 text-center">
                                                {val && String(val).trim() !== '' ? (
                                                    <div
                                                        className="w-full h-7 rounded flex items-center justify-center font-bold text-[11px] text-white shadow-sm"
                                                        style={{ backgroundColor: bgColor }}
                                                    >
                                                        {val}
                                                    </div>
                                                ) : (
                                                    <span className="text-gray-500/50">-</span>
                                                )}
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={14} className={`py-12 text-center ${isLight ? 'text-gray-500' : 'text-gray-400'}`}>
                                    No hazards found for this country
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
