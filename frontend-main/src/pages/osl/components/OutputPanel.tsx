// @ts-nocheck
import React, { useEffect, useState, useRef } from 'react';
import type { FormData, RankedForwarder } from '../services/types';
import { HISTORICAL_DATA } from '../services/constants';
import { calculateForwarderKPIs, rankForwarders } from '../services/logisticsEngine';
import { generateOracleInsight } from '@/services/geminiService';
import RadarAnalysis from './RadarAnalysis';
import { logger } from "@/utils/logger";

interface OutputPanelProps {
    formData: FormData | null;
    isVisible: boolean;
}

const OutputPanel: React.FC<OutputPanelProps> = ({ formData, isVisible }) => {
    const [rankedResults, setRankedResults] = useState<RankedForwarder[]>([]);
    const [oracleText, setOracleText] = useState<string>("");
    const [oracleProvider, setOracleProvider] = useState<string>("—");
    const [loadingOracle, setLoadingOracle] = useState(false);
    const panelRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isVisible && formData) {
            // 1. Logic Calculation
            const filteredHistory = HISTORICAL_DATA.filter(
                d => d.origin === formData.origin && d.destination === formData.destination
            );

            const kpis = calculateForwarderKPIs(filteredHistory, formData.forwarders, formData);
            const rankings = rankForwarders(kpis);
            setRankedResults(rankings);

            // 2. Oracle Call
            setLoadingOracle(true);
            setOracleText("");
            generateOracleInsight(rankings, formData)
                .then(res => {
                    setOracleText(res.text);
                    setOracleProvider(res.provider);
                })
                .catch(err => {
                    logger.error('Oracle insight error', err);
                    setOracleText("Oracle connection severed.");
                    setOracleProvider('—');
                })
                .finally(() => setLoadingOracle(false));

            // Scroll into view
            setTimeout(() => {
                panelRef.current?.scrollIntoView({ behavior: 'smooth' });
            }, 300);
        }
    }, [isVisible, formData]);

    if (!isVisible || !formData) return null;

    return (
        <div className="lg:col-span-2 animate-[fadeIn_0.8s_ease-out]" ref={panelRef}>
            <div className="h-full bg-gradient-to-br from-slate-800/80 to-slate-900/90 border border-purple-500/30 rounded-2xl overflow-hidden shadow-2xl backdrop-blur-sm">

                {/* Header */}
                <div className="bg-gradient-to-r from-deepcal-dark to-deepcal-purple p-5 symbolic-border">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
                        <div className="flex items-center mb-4 md:mb-0">
                            <div className="relative mr-4" aria-hidden="true">
                                <i className="fas fa-scroll text-3xl text-white"></i>
                                <div className="absolute -inset-1 rounded-full bg-white/10 animate-[pulse_2s_infinite]"></div>
                            </div>
                            <div>
                                <h2 className="text-xl font-semibold text-white flex items-center">
                                    <span className="mr-2" aria-hidden="true">🕊️</span>
                                    <span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-200 to-white">
                                        SACRED LOGISTICS TRANSMISSION
                                    </span>
                                </h2>
                                <p className="text-xs text-purple-200 flex items-center tracking-wider mt-1">
                                    <span className="inline-block w-3 h-px bg-purple-400 mr-2"></span>
                                    DeepCAL++ vΩ ORACULAR MANIFESTATION
                                    <span className="inline-block w-3 h-px bg-purple-400 ml-2"></span>
                                </p>
                            </div>
                        </div>
                        <div className="px-4 py-2 bg-black/30 rounded-full text-xs flex items-center border border-purple-400/30 font-mono text-yellow-200/80" role="status">
                            <i className="fas fa-bolt text-yellow-400 mr-2 animate-pulse" aria-hidden="true"></i>
                            <span>ACTIVE TRANSMISSION</span>
                        </div>
                    </div>
                </div>

                {/* Gemini Output Section */}
                <div className="p-6 border-b border-slate-700/50 bg-black/20" aria-live="polite">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-semibold text-deepcal-light flex items-center uppercase tracking-widest">
                            <i className="fas fa-microchip mr-2" aria-hidden="true"></i> Symbolic Interpretation
                        </h3>
                        <span className="text-[10px] px-2 py-1 rounded-full border border-slate-600 text-slate-300 bg-black/30">
                            Model: {oracleProvider}
                        </span>
                    </div>
                    <div className="min-h-[80px] text-slate-300 font-serif italic text-lg leading-relaxed relative">
                        {loadingOracle ? (
                            <div className="flex items-center space-x-2 text-sm text-purple-300">
                                <i className="fas fa-circle-notch fa-spin"></i>
                                <span>Consulting the probability matrices...</span>
                            </div>
                        ) : (
                            <div className="animate-[fadeIn_1s]">
                                "{oracleText}"
                            </div>
                        )}
                    </div>
                </div>

                {/* KPI Table & Charts */}
                <div className="p-6 grid grid-cols-1 xl:grid-cols-2 gap-6">

                    {/* TOPSIS Table */}
                    <div className="bg-slate-900/50 rounded-xl overflow-hidden border border-slate-700/50">
                        <div className="px-5 py-3 bg-gradient-to-r from-slate-800 to-slate-900 flex justify-between items-center border-b border-slate-700">
                            <h3 className="font-semibold text-sm flex items-center text-slate-200">
                                <i className="fas fa-trophy mr-2 text-yellow-500" aria-hidden="true"></i>
                                Ranking Matrix
                            </h3>
                            <span className="text-[10px] bg-purple-900/40 text-purple-300 px-2 py-1 rounded border border-purple-500/20">TOPSIS Algo</span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-800/50 text-slate-300 text-xs uppercase">
                                    <tr>
                                        <th className="px-4 py-3 text-left">Rank</th>
                                        <th className="px-4 py-3 text-left">Forwarder</th>
                                        <th className="px-4 py-3 text-left">Score</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rankedResults.map((f, i) => (
                                        <tr key={f.name} className="border-b border-slate-800 hover:bg-slate-800/40 transition-colors">
                                            <td className="px-4 py-3">
                                                <span className={`font-mono font-bold ${i === 0 ? 'text-yellow-400' : i === 1 ? 'text-slate-300' : 'text-amber-700'}`}>
                                                    #{i + 1}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 font-medium text-slate-200">
                                                {f.name}
                                                <div className="text-[10px] text-slate-400 mt-0.5">
                                                    ${f.avgCost.toLocaleString()} • {f.avgTransitDays}d
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center">
                                                    <span className={`font-bold mr-2 ${i === 0 ? 'text-green-400' : 'text-slate-400'}`}>
                                                        {f.score.toFixed(3)}
                                                    </span>
                                                    {i === 0 && <i className="fas fa-check-circle text-green-500 text-xs" aria-label="Winner"></i>}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Radar Chart */}
                    <div role="region" aria-label="Vector Analysis Chart">
                        <RadarAnalysis data={rankedResults} />
                    </div>

                </div>
            </div>
        </div>
    );
};

export default OutputPanel;

