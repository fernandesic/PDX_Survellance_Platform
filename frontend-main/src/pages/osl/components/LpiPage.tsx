// @ts-nocheck

import React, { useState, useEffect, useRef } from 'react';
import type { LpiScenario, LpiResult } from '../services/types';
import { generateLpiPlanWithAzure, refineLpiPlanWithAzure } from '@/pages/chat/services/azureChatService';
import type { ChatMessage } from '@/pages/chat/services/azureChatService';
import { useTheme } from '@/contexts/ThemeContext';
import { logger } from "@/utils/logger";

const LpiPage: React.FC = () => {
    const { theme } = useTheme();
    const isLight = theme === 'light';
    const [scenario, setScenario] = useState<LpiScenario>({
        country: 'South Sudan',
        region: 'Juba',
        disease: 'Ebola',
        severity: 'High',
        population: 10000,
        vulnerabilityGroup: 'General Population',
        season: 'Dry Season',
        infrastructure: 'Accessible (Paved)',
        localCapacity: 'Minimal (Level 1)'
    });
    const [loading, setLoading] = useState(false);
    const [loadingStage, setLoadingStage] = useState<string>('');
    const [results, setResults] = useState<LpiResult | null>(null);
    const [error, setError] = useState('');
    const [activeTab, setActiveTab] = useState('summary');

    const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
    const [modelMessages, setModelMessages] = useState<ChatMessage[]>([]);
    const [currentUserMessage, setCurrentUserMessage] = useState('');
    const [isResponding, setIsResponding] = useState(false);
    const chatHistoryRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (chatHistoryRef.current) {
            chatHistoryRef.current.scrollTop = chatHistoryRef.current.scrollHeight;
        }
    }, [chatHistory, isResponding, results, activeTab]);

    const handleInputChange = (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
        const { name, value } = e.target;
        setScenario(prev => ({ ...prev, [name]: value }));
    };

    const handleInitialGeneration = async () => {
        setLoading(true);
        setLoadingStage('Initializing parameters...');
        setError('');
        setResults(null);
        setChatHistory([]);
        setActiveTab('summary');

        try {
            const initialUserMessage = `Generating plan for: ${scenario.severity} ${scenario.disease} in ${scenario.country} (${scenario.region}). Context: ${scenario.season}, ${scenario.infrastructure}, ${scenario.localCapacity}.`;
            setChatHistory([{ role: 'user', content: initialUserMessage } as ChatMessage]);

            setLoadingStage('Calling Azure orchestrator...');
            const { result, messages } = await generateLpiPlanWithAzure(scenario);

            setLoadingStage('Calculating supply chain metrics...');
            setResults(result);
            setModelMessages(messages);
            setChatHistory([
                { role: 'user', content: initialUserMessage },
                { role: 'assistant', content: result?.changeSummary || 'Plan generated.' } as ChatMessage,
            ]);
        } catch (err) {
            logger.error('AI Error:', err);
            setError(err instanceof Error ? err.message : 'Simulation failed. Please check your connection and try again.');
        } finally {
            setLoadingStage('');
            setLoading(false);
        }
    };

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentUserMessage.trim()) return;

        const messageToSend = currentUserMessage;
        setChatHistory(prev => [...prev, { role: 'user', content: messageToSend } as ChatMessage]);
        setCurrentUserMessage('');
        setIsResponding(true);
        setError('');

        try {
            const { result, messages } = await refineLpiPlanWithAzure(scenario, messageToSend, modelMessages);
            setResults(result);
            setModelMessages(messages);
            if (result && 'changeSummary' in result && result.changeSummary) {
                setChatHistory(prev => [...prev, { role: 'assistant', content: result.changeSummary } as ChatMessage]);
            }

        } catch (err) {
            logger.error("Chat Error:", err);
            setError(err instanceof Error ? err.message : 'Failed to get a response.');
        } finally {
            setIsResponding(false);
        }
    };

    return (
        <div className="w-full px-6 lg:px-10 pb-12 animate-[fadeIn_0.5s_ease-out] max-w-full">

            <div className={`border rounded-2xl p-8 shadow-2xl backdrop-blur-sm mb-8 ${isLight ? 'bg-white border-gray-200' : 'bg-gradient-to-br from-slate-800/90 to-slate-900/90 border-purple-500/30'}`}>
                <div className="text-center mb-8">
                    <h2 className={`text-3xl font-bold mb-2 flex justify-center items-center ${isLight ? 'text-[#1a1a1a]' : 'text-white'}`}>
                        <i className="fas fa-network-wired text-deepcal-light mr-3" aria-hidden="true"></i>
                        Logistic Prepositioning Index (LPI)
                    </h2>
                    <p className={`max-w-2xl mx-auto font-light ${isLight ? 'text-gray-600' : 'text-purple-200/80'}`}>
                        AI-driven outbreak simulation using granular risk vectors (Seasonality, Infrastructure, Capacity).
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">

                    <div>
                        <label htmlFor="country" className={`block text-xs font-mono mb-2 uppercase tracking-wider ${isLight ? 'text-gray-600' : 'text-purple-300'}`}>Country</label>
                        <select id="country" name="country" value={scenario.country} onChange={handleInputChange} className={`w-full rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-deepcal-light focus:border-deepcal-light ${isLight ? 'bg-gray-100 border-gray-300 text-gray-900' : 'bg-slate-900 border-slate-600 text-white'}`}>
                            {['South Sudan', 'DR Congo', 'Nigeria', 'Zambia'].map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="region" className={`block text-xs font-mono mb-2 uppercase tracking-wider ${isLight ? 'text-gray-600' : 'text-purple-300'}`}>Region / District</label>
                        <input id="region" type="text" name="region" value={scenario.region} onChange={handleInputChange} className={`w-full rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-deepcal-light ${isLight ? 'bg-gray-100 border-gray-300 text-gray-900 placeholder-gray-400' : 'bg-slate-900 border-slate-600 text-white placeholder-slate-500'}`} />
                    </div>
                    <div>
                        <label htmlFor="population" className={`block text-xs font-mono mb-2 uppercase tracking-wider ${isLight ? 'text-gray-600' : 'text-purple-300'}`}>Population at Risk</label>
                        <input id="population" type="number" name="population" value={scenario.population} onChange={handleInputChange} step="1000" className={`w-full rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-deepcal-light ${isLight ? 'bg-gray-100 border-gray-300 text-gray-900' : 'bg-slate-900 border-slate-600 text-white'}`} />
                    </div>


                    <div>
                        <label htmlFor="disease" className={`block text-xs font-mono mb-2 uppercase tracking-wider ${isLight ? 'text-gray-600' : 'text-purple-300'}`}>Disease</label>
                        <select id="disease" name="disease" value={scenario.disease} onChange={handleInputChange} className={`w-full rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-deepcal-light focus:border-deepcal-light ${isLight ? 'bg-gray-100 border-gray-300 text-gray-900' : 'bg-slate-900 border-slate-600 text-white'}`}>
                            {['Ebola', 'Cholera', 'Measles', 'Marburg', 'Mpox'].map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="severity" className={`block text-xs font-mono mb-2 uppercase tracking-wider ${isLight ? 'text-gray-600' : 'text-purple-300'}`}>Severity</label>
                        <select id="severity" name="severity" value={scenario.severity} onChange={handleInputChange} className={`w-full rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-deepcal-light focus:border-deepcal-light ${isLight ? 'bg-gray-100 border-gray-300 text-gray-900' : 'bg-slate-900 border-slate-600 text-white'}`}>
                            {['Moderate', 'High', 'Critical'].map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="vulnerabilityGroup" className={`block text-xs font-mono mb-2 uppercase tracking-wider ${isLight ? 'text-gray-600' : 'text-purple-300'}`}>Vulnerability Group</label>
                        <select id="vulnerabilityGroup" name="vulnerabilityGroup" value={scenario.vulnerabilityGroup} onChange={handleInputChange} className={`w-full rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-deepcal-light focus:border-deepcal-light ${isLight ? 'bg-gray-100 border-gray-300 text-gray-900' : 'bg-slate-900 border-slate-600 text-white'}`}>
                            {['General Population', 'Children <5', 'Elderly', 'Displaced Persons (IDPs)', 'Pregnant Women'].map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                    </div>


                    <div>
                        <label htmlFor="season" className={`block text-xs font-mono mb-2 uppercase tracking-wider ${isLight ? 'text-orange-600' : 'text-amber-300'}`}>Seasonality</label>
                        <select id="season" name="season" value={scenario.season} onChange={handleInputChange} className={`w-full rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-amber-500 ${isLight ? 'bg-gray-100 border-gray-300 text-gray-900' : 'bg-slate-900 border-slate-600 text-white'}`}>
                            {['Dry Season', 'Rainy Season', 'Harmattan', 'Winter'].map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="infrastructure" className={`block text-xs font-mono mb-2 uppercase tracking-wider ${isLight ? 'text-orange-600' : 'text-amber-300'}`}>Infrastructure</label>
                        <select id="infrastructure" name="infrastructure" value={scenario.infrastructure} onChange={handleInputChange} className={`w-full rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-amber-500 ${isLight ? 'bg-gray-100 border-gray-300 text-gray-900' : 'bg-slate-900 border-slate-600 text-white'}`}>
                            {['Accessible (Paved)', 'Remote (Unpaved)', 'Conflict Zone (Secure Escort)', 'Island/Coastal'].map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="localCapacity" className={`block text-xs font-mono mb-2 uppercase tracking-wider ${isLight ? 'text-orange-600' : 'text-amber-300'}`}>Local Capacity</label>
                        <select id="localCapacity" name="localCapacity" value={scenario.localCapacity} onChange={handleInputChange} className={`w-full rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-amber-500 ${isLight ? 'bg-gray-100 border-gray-300 text-gray-900' : 'bg-slate-900 border-slate-600 text-white'}`}>
                            {['Minimal (Level 1)', 'Partial (Level 2)', 'Robust (Level 3)'].map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                    </div>
                </div>

                <div className="flex justify-center">
                    <button
                        onClick={handleInitialGeneration}
                        disabled={loading}
                        className={`
                            px-8 py-3 rounded-lg font-bold text-white shadow-lg transition-all transform hover:scale-105 flex items-center min-w-[240px] justify-center focus:outline-none focus:ring-4 focus:ring-purple-500/50
                            ${loading ? (isLight ? 'bg-gray-400 cursor-wait' : 'bg-slate-700 cursor-wait') : 'bg-gradient-to-r from-deepcal-purple to-deepcal-light hover:shadow-purple-500/30'}
                        `}
                    >
                        {loading ? (
                            <>
                                <i className="fas fa-microchip fa-spin mr-2" aria-hidden="true"></i>
                                {loadingStage}
                            </>
                        ) : (
                            <>
                                <i className="fas fa-play mr-2" aria-hidden="true"></i> Run Advanced Simulation
                            </>
                        )}
                    </button>
                </div>
            </div>


            <div aria-live="polite">
                {error && (
                    <div className={`mb-8 p-4 border rounded-lg text-center animate-pulse ${isLight ? 'bg-red-50 border-red-200 text-red-700' : 'bg-red-900/30 border-red-500/50 text-red-200'}`} role="alert">
                        <i className="fas fa-exclamation-triangle mr-2" aria-hidden="true"></i> {error}
                    </div>
                )}
            </div>


            {results && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-[fadeIn_0.5s_ease-out]">


                    <div className="lg:col-span-2 space-y-6">

                        <div className={`border rounded-xl p-5 flex flex-col md:flex-row gap-6 ${isLight ? 'bg-white border-gray-200 shadow-sm' : 'bg-slate-900/50 border-purple-500/20'}`}>
                            <div className="flex-1">
                                <h3 className={`text-xs uppercase mb-2 font-bold tracking-wider ${isLight ? 'text-gray-500' : 'text-slate-400'}`}>Risk Assessment</h3>
                                <div className="flex items-center gap-4">
                                    <div className={`text-3xl font-bold ${isLight ? 'text-red-700' : 'text-red-400'}`}>{results.riskAssessment?.riskLevel}</div>
                                    <div className={`text-sm ${isLight ? 'text-gray-600' : 'text-slate-400'}`}>
                                        <div className="flex items-center"><i className="fas fa-virus mr-2 text-deepcal-light" aria-hidden="true"></i> R0: {results.riskAssessment?.reproductionNumberR0}</div>
                                        <div className="flex items-center"><i className="fas fa-circle-nodes mr-2 text-deepcal-light" aria-hidden="true"></i> Radius: {results.riskAssessment?.projectedSpreadRadiusKm}km</div>
                                    </div>
                                </div>
                            </div>
                            <div className={`flex-1 border-l md:pl-6 ${isLight ? 'border-gray-200' : 'border-slate-700/50'}`}>
                                <h3 className={`text-xs uppercase mb-2 font-bold tracking-wider ${isLight ? 'text-gray-500' : 'text-slate-400'}`}>Logistics Constraints</h3>
                                <div className="flex flex-wrap gap-2">
                                    {results.logisticsConstraints?.map((c, i) => (
                                        <span key={i} className={`px-2 py-1 text-xs rounded border ${isLight ? 'bg-amber-100 text-amber-800 border-amber-200' : 'bg-amber-900/30 text-amber-200 border-amber-500/30'}`}>
                                            {c}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>


                        {results.planningAssumptions && results.planningAssumptions.length > 0 && (
                            <div className={`border rounded-xl p-5 ${isLight ? 'bg-blue-50 border-blue-200' : 'bg-blue-900/20 border-blue-500/20'}`}>
                                <h3 className={`text-xs uppercase mb-2 font-bold tracking-wider flex items-center ${isLight ? 'text-blue-700' : 'text-blue-300'}`}>
                                    <i className="fas fa-brain mr-2" aria-hidden="true"></i> AI Planning Logic
                                </h3>
                                <ul className="space-y-1">
                                    {results.planningAssumptions.map((assumption, i) => (
                                        <li key={i} className={`text-sm flex items-start ${isLight ? 'text-gray-700' : 'text-slate-300'}`}>
                                            <i className="fas fa-check text-blue-500 mt-1 mr-2 text-xs" aria-hidden="true"></i>
                                            {assumption}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}


                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className={`p-4 rounded-xl border ${isLight ? 'bg-white border-gray-200 shadow-sm' : 'bg-slate-800/60 border-purple-500/20'}`}>
                                <div className={`text-xs uppercase mb-1 ${isLight ? 'text-gray-500' : 'text-slate-400'}`}>Total Cost</div>
                                <div className={`text-xl font-bold ${isLight ? 'text-green-700' : 'text-green-400'}`}>
                                    ${results.budgetAnalysis?.totalCostUSD?.toLocaleString()}
                                </div>
                            </div>
                            <div className={`p-4 rounded-xl border ${isLight ? 'bg-white border-gray-200 shadow-sm' : 'bg-slate-800/60 border-purple-500/20'}`}>
                                <div className={`text-xs uppercase mb-1 ${isLight ? 'text-gray-500' : 'text-slate-400'}`}>Total Weight</div>
                                <div className={`text-xl font-bold ${isLight ? 'text-blue-700' : 'text-blue-400'}`}>
                                    {results.logisticsPlan?.totalWeightKg?.toLocaleString()} <span className={isLight ? 'text-xs text-gray-500' : 'text-xs text-slate-500'}>kg</span>
                                </div>
                            </div>
                            <div className={`p-4 rounded-xl border ${isLight ? 'bg-white border-gray-200 shadow-sm' : 'bg-slate-800/60 border-purple-500/20'}`}>
                                <div className={`text-xs uppercase mb-1 ${isLight ? 'text-gray-500' : 'text-slate-400'}`}>Transport Mode</div>
                                <div className={`text-lg font-bold flex items-center ${isLight ? 'text-purple-700' : 'text-purple-400'}`}>
                                    <i className={`fas ${results.logisticsPlan?.transportMode?.toLowerCase().includes('air') ? 'fa-plane' : 'fa-truck'} mr-2`} aria-hidden="true"></i>
                                    {results.logisticsPlan?.transportMode}
                                </div>
                            </div>
                            <div className={`p-4 rounded-xl border ${isLight ? 'bg-white border-gray-200 shadow-sm' : 'bg-slate-800/60 border-purple-500/20'}`}>
                                <div className={`text-xs uppercase mb-1 ${isLight ? 'text-gray-500' : 'text-slate-400'}`}>Est. Lead Time</div>
                                <div className={`text-xl font-bold ${isLight ? 'text-amber-700' : 'text-amber-400'}`}>
                                    {results.logisticsPlan?.estimatedLeadTimeDays} <span className={isLight ? 'text-xs text-gray-500' : 'text-xs text-slate-500'}>days</span>
                                </div>
                            </div>
                        </div>


                        <div className={`border-b flex overflow-x-auto ${isLight ? 'bg-gray-50 border-gray-200' : 'bg-slate-900/50 border-purple-500/20'}`} role="tablist">
                            {['summary', 'commodities', 'budget'].map(tab => (
                                <button
                                    key={tab}
                                    role="tab"
                                    id={`tab-${tab}`}
                                    aria-selected={activeTab === tab ? "true" : "false"}
                                    aria-controls={`panel-${tab}`}
                                    tabIndex={activeTab === tab ? 0 : -1}
                                    onClick={() => setActiveTab(tab)}
                                    className={`px-6 py-3 text-sm font-medium transition-colors border-b-2 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-deepcal-light ${activeTab === tab
                                        ? (isLight ? 'border-deepcal-light text-deepcal-purple bg-white' : 'border-deepcal-light text-white bg-white/5')
                                        : (isLight ? 'border-transparent text-gray-500 hover:text-gray-900 hover:bg-gray-100' : 'border-transparent text-slate-400 hover:text-white hover:bg-white/5')
                                        }`}
                                >
                                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                                </button>
                            ))}
                        </div>


                        <div className={`border rounded-b-xl p-6 min-h-[400px] ${isLight ? 'bg-white border-gray-200' : 'bg-slate-800/40 border-purple-500/10'}`} role="tabpanel" id={`panel-${activeTab}`} aria-labelledby={`tab-${activeTab}`}>
                            {activeTab === 'summary' && (
                                <div className="space-y-6 animate-[fadeIn_0.3s]">
                                    <div>
                                        <h3 className={`text-lg font-semibold mb-2 ${isLight ? 'text-gray-900' : 'text-white'}`}>Executive Summary</h3>
                                        <p className={`leading-relaxed text-sm ${isLight ? 'text-gray-700' : 'text-slate-300'}`}>
                                            {results.executiveSummary}
                                        </p>
                                    </div>
                                    <div>
                                        <h3 className={`text-lg font-semibold mb-2 ${isLight ? 'text-gray-900' : 'text-white'}`}>Key Strategic Interventions</h3>
                                        <ul className="space-y-2">
                                            {results.keyInterventions?.map((item: string, i: number) => (
                                                <li key={i} className={`flex items-start text-sm ${isLight ? 'text-gray-700' : 'text-slate-300'}`}>
                                                    <span className="mr-2 text-deepcal-light" aria-hidden="true">•</span> {item}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'commodities' && (
                                <div className="space-y-6 animate-[fadeIn_0.3s]">
                                    {results.commodityStockpile?.map((cat, idx) => (
                                        <div key={idx} className={`rounded-lg overflow-hidden border ${isLight ? 'bg-gray-50 border-gray-200' : 'bg-slate-900/50 border-slate-700/50'}`}>
                                            <div className={`px-4 py-2 text-xs font-bold uppercase tracking-wider ${isLight ? 'bg-gray-200 text-purple-700' : 'bg-slate-800/80 text-purple-300'}`}>
                                                {cat.category}
                                            </div>
                                            <table className={`w-full text-sm text-left ${isLight ? 'text-gray-700' : 'text-slate-300'}`}>
                                                <caption className="sr-only">List of {cat.category} commodities</caption>
                                                <thead className={`text-xs uppercase ${isLight ? 'bg-gray-100 text-gray-600' : 'text-slate-400 bg-slate-900/50'}`}>
                                                    <tr>
                                                        <th scope="col" className="px-4 py-2">Item</th>
                                                        <th scope="col" className="px-4 py-2 text-right">Qty</th>
                                                        <th scope="col" className="px-4 py-2">Unit</th>
                                                    </tr>
                                                </thead>
                                                <tbody className={`divide-y ${isLight ? 'divide-gray-200' : 'divide-slate-700/30'}`}>
                                                    {cat.items?.map((item, i) => (
                                                        <tr key={i} className={`transition-colors ${isLight ? 'hover:bg-gray-100' : 'hover:bg-white/5'}`}>
                                                            <td className="px-4 py-2">{item.commodityName}</td>
                                                            <td className="px-4 py-2 text-right font-mono text-deepcal-light font-bold">
                                                                {item.quantity?.toLocaleString()}
                                                            </td>
                                                            <td className={`px-4 py-2 text-xs ${isLight ? 'text-gray-500' : 'text-slate-500'}`}>{item.unit}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {activeTab === 'budget' && (
                                <div className="space-y-4 animate-[fadeIn_0.3s]">
                                    <h3 className={`text-lg font-semibold ${isLight ? 'text-gray-900' : 'text-white'}`}>Estimated Budget Breakdown</h3>
                                    <div className="space-y-3">
                                        {results.budgetAnalysis?.breakdown?.map((pillar, i) => (
                                            <div key={i} className={`p-3 rounded-lg flex justify-between items-center border transition-colors ${isLight ? 'bg-gray-50 border-gray-200 hover:border-deepcal-light/50' : 'bg-slate-900/50 border-slate-700/50 hover:border-deepcal-light/30'}`}>
                                                <span className={`text-sm ${isLight ? 'text-gray-700' : 'text-slate-300'}`}>{pillar.pillar}</span>
                                                <span className={`font-mono font-bold ${isLight ? 'text-green-700' : 'text-green-400'}`}>
                                                    ${pillar.estimatedCostUSD?.toLocaleString()}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                    <div className={`mt-6 pt-4 border-t flex justify-between items-center ${isLight ? 'border-gray-200' : 'border-slate-700'}`}>
                                        <span className={`font-semibold ${isLight ? 'text-gray-900' : 'text-white'}`}>Total Estimated Cost</span>
                                        <span className={`text-xl font-bold ${isLight ? 'text-green-700' : 'text-green-400'}`}>
                                            ${results.budgetAnalysis?.totalCostUSD?.toLocaleString()}
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>


                    <div className={`border rounded-xl flex flex-col h-[600px] shadow-lg backdrop-blur-sm overflow-hidden ${isLight ? 'bg-white border-gray-200' : 'bg-slate-800/60 border-purple-500/20'}`}>
                        <div className={`p-4 border-b ${isLight ? 'bg-gray-50 border-gray-200' : 'bg-slate-900/50 border-purple-500/20'}`}>
                            <h3 className={`text-sm font-bold flex items-center ${isLight ? 'text-gray-900' : 'text-white'}`}>
                                <i className="fas fa-robot mr-2 text-deepcal-light" aria-hidden="true"></i>
                                LPI Planner Assistant
                            </h3>
                            <p className={`text-xs mt-1 ${isLight ? 'text-gray-500' : 'text-slate-400'}`}>Refine the plan with natural language.</p>
                        </div>

                        <div ref={chatHistoryRef} className={`flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar aria-live="polite" ${isLight ? 'bg-gray-50/50' : 'bg-slate-900/30'}`}>
                            {chatHistory.length === 0 && (
                                <div className={`text-center text-sm mt-10 italic ${isLight ? 'text-gray-400' : 'text-slate-500'}`}>
                                    Generate a plan to start the conversation...
                                </div>
                            )}
                            {chatHistory.map((msg, idx) => (
                                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`
                                        max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-md
                                        ${msg.role === 'user'
                                            ? 'bg-deepcal-purple text-white rounded-br-none'
                                            : isLight
                                                ? 'bg-white text-gray-800 border border-gray-200 rounded-bl-none'
                                                : 'bg-slate-700 text-slate-200 rounded-bl-none'}
                                    `}>
                                        {msg.content}
                                    </div>
                                </div>
                            ))}
                            {isResponding && (
                                <div className="flex justify-start">
                                    <div className={`rounded-2xl rounded-bl-none px-4 py-3 text-sm flex items-center shadow-md ${isLight ? 'bg-white border border-gray-200 text-gray-400' : 'bg-slate-700 text-slate-400'}`}>
                                        <span className={`w-2 h-2 rounded-full animate-bounce mr-1 ${isLight ? 'bg-gray-300' : 'bg-slate-400'}`}></span>
                                        <span className={`w-2 h-2 rounded-full animate-bounce mr-1 delay-75 ${isLight ? 'bg-gray-300' : 'bg-slate-400'}`}></span>
                                        <span className={`w-2 h-2 rounded-full animate-bounce delay-150 ${isLight ? 'bg-gray-300' : 'bg-slate-400'}`}></span>
                                        <span className="sr-only">Typing...</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        <form onSubmit={handleSendMessage} className={`p-4 border-t ${isLight ? 'bg-white border-gray-200' : 'bg-slate-900/50 border-purple-500/20'}`}>
                            <div className="relative">
                                <label htmlFor="chatInput" className="sr-only">Refine plan with AI</label>
                                <input
                                    id="chatInput"
                                    type="text"
                                    value={currentUserMessage}
                                    onChange={(e) => setCurrentUserMessage(e.target.value)}
                                    placeholder="E.g., Increase population to 20k..."
                                    className={`w-full border rounded-full pl-4 pr-12 py-3 text-sm focus:outline-none focus:border-deepcal-light focus:ring-1 focus:ring-deepcal-light ${isLight ? 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-400' : 'bg-slate-800 border-slate-600 text-white placeholder-slate-500'}`}
                                    disabled={!results || isResponding}
                                />
                                <button
                                    type="submit"
                                    aria-label="Send message"
                                    disabled={!results || isResponding || !currentUserMessage.trim()}
                                    className="absolute right-2 top-1.5 p-1.5 bg-deepcal-light text-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-deepcal-purple disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-deepcal-light"
                                >
                                    <i className="fas fa-paper-plane text-xs" aria-hidden="true"></i>
                                </button>
                            </div>
                        </form>
                    </div>

                </div>
            )}
        </div>
    );
};

export default LpiPage;


