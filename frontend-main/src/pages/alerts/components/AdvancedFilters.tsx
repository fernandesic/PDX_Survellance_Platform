// @ts-nocheck

import React, { useState, useEffect, useRef } from 'react';
import {
  Search, Filter, Save, Calendar, BarChart4, Globe, Bug,
  BarChart3, RefreshCw, Download, FileText, FileSpreadsheet, FileCode, Check, AlertCircle, Sparkles, Zap, BrainCircuit
} from 'lucide-react';
import { AlertLevel } from '../types';
import { AFRO_COUNTRIES, AFRO_DISEASES } from '../constants';
import { fetchFastBriefing, askDeepIntelligence } from '../services/azureService';
import type { ActiveFilters } from '../AlertsPage';

interface AdvancedFiltersProps {
  onFilterChange: (filters: ActiveFilters) => void;
  signalCounts: Record<string, number>;
  activeFilters?: ActiveFilters;
}

const SectionHeader: React.FC<any> = ({ icon: Icon, title, rightIcon: RightIcon }) => (
  <div className="flex items-center justify-between mb-4 group">
    <div className="flex items-center gap-2">
      <Icon className="w-5 h-5 text-blue-600" />
      <h3 className="text-[11px] font-black text-blue-600 uppercase tracking-widest">{title}</h3>
    </div>
    {RightIcon && <RightIcon className="w-4 h-4 text-blue-400 cursor-pointer hover:text-blue-600 transition-colors" />}
  </div>
);

const FilterCard: React.FC<{ children: React.ReactNode, active?: boolean }> = ({ children, active }) => (
  <div className={`bg-white rounded-2xl p-4 border transition-all shadow-sm mb-3 ${active ? 'border-blue-500 ring-2 ring-blue-50' : 'border-slate-100 hover:border-slate-300'}`}>
    {children}
  </div>
);

export const AdvancedFilters: React.FC<AdvancedFiltersProps> = ({ onFilterChange, signalCounts, activeFilters }) => {
  const [search, setSearch] = useState(activeFilters?.search || '');
  const [selectedGrades, setSelectedGrades] = useState<string[]>(activeFilters?.priorities || []);
  const [selectedCountries, setSelectedCountries] = useState<string[]>(activeFilters?.countries || []);
  const [selectedDiseases, setSelectedDiseases] = useState<string[]>(activeFilters?.diseases || []);
  const [dateFrom, setDateFrom] = useState(activeFilters?.dateFrom || '');
  const [dateTo, setDateTo] = useState(activeFilters?.dateTo || '');
  const [aiInput, setAiInput] = useState('');
  const [aiOutput, setAiOutput] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const isFirstRender = useRef(true);

  // Emit filter changes to parent whenever any filter state changes
  useEffect(() => {
    // Skip on mount (don't trigger duplicate load)
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    // Debounce to avoid rapid-fire calls during search typing
    const timer = setTimeout(() => {
      onFilterChange({
        priorities: selectedGrades,
        countries: selectedCountries,
        diseases: selectedDiseases,
        search,
        dateFrom,
        dateTo,
      });
    }, 400);
    return () => clearTimeout(timer);
  }, [selectedGrades, selectedCountries, selectedDiseases, search, dateFrom, dateTo]);

  const activeFilterCount = selectedGrades.length + selectedCountries.length + selectedDiseases.length
    + (search ? 1 : 0) + (dateFrom ? 1 : 0) + (dateTo ? 1 : 0);

  const clearAllFilters = () => {
    setSelectedGrades([]);
    setSelectedCountries([]);
    setSelectedDiseases([]);
    setSearch('');
    setDateFrom('');
    setDateTo('');
  };

  const toggleFilter = (list: string[], setList: (l: string[]) => void, item: string) => {
    const newList = list.includes(item) ? list.filter(i => i !== item) : [...list, item];
    setList(newList);
  };

  const handleDeepAnalysis = async () => {
    if (!aiInput) return;
    setIsAiLoading(true);
    setAiOutput(null);
    const result = await askDeepIntelligence(aiInput);
    setAiOutput(result);
    setIsAiLoading(false);
  };

  const handleFastBriefing = async () => {
    setIsAiLoading(true);
    setAiOutput(null);
    const result = await fetchFastBriefing("the current active filters");
    setAiOutput(result);
    setIsAiLoading(false);
  };

  return (
    <div className="flex flex-col h-full bg-slate-50/50 overflow-y-auto custom-scrollbar p-6 space-y-8 pb-24">

      {/* Active Filter Badge + Clear */}
      {activeFilterCount > 0 && (
        <div className="flex items-center justify-between bg-blue-50 rounded-2xl px-4 py-3 border border-blue-100">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-blue-600" />
            <span className="text-[10px] font-black text-blue-700 uppercase tracking-widest">{activeFilterCount} filter{activeFilterCount > 1 ? 's' : ''} active</span>
          </div>
          <button
            onClick={clearAllFilters}
            className="text-[9px] font-black text-red-500 uppercase tracking-widest hover:text-red-700 transition-colors"
          >Clear All</button>
        </div>
      )}

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search events, countries..."
          className="w-full bg-white border border-slate-200 rounded-2xl py-3.5 pl-11 pr-4 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm transition-all"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* AI Tactical Command */}
      <section className="bg-slate-900 rounded-[2rem] p-6 shadow-2xl border border-slate-800">
        <SectionHeader icon={Sparkles} title="AI Tactical Command" />
        <div className="space-y-4">
          <textarea
            value={aiInput}
            onChange={(e) => setAiInput(e.target.value)}
            placeholder="Ask complex disease queries..."
            className="w-full bg-slate-800 border border-slate-700 rounded-xl p-4 text-[11px] text-white font-medium focus:outline-none focus:ring-1 focus:ring-blue-500 min-h-[80px]"
          />
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleDeepAnalysis}
              disabled={isAiLoading || !aiInput}
              className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white py-2.5 rounded-xl transition-all shadow-lg shadow-blue-900/20 group"
            >
              <BrainCircuit className="w-3.5 h-3.5 group-hover:rotate-12 transition-transform" />
              <span className="text-[9px] font-black uppercase tracking-widest">Deep Analyser</span>
            </button>
            <button
              onClick={handleFastBriefing}
              disabled={isAiLoading}
              className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white py-2.5 rounded-xl transition-all shadow-lg shadow-emerald-900/20 group"
            >
              <Zap className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
              <span className="text-[9px] font-black uppercase tracking-widest">Fast Brief</span>
            </button>
          </div>

          {isAiLoading && (
            <div className="flex items-center justify-center py-4 gap-3">
              <RefreshCw className="w-4 h-4 text-blue-400 animate-spin" />
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest animate-pulse">Consulting Gemini Neural Net...</span>
            </div>
          )}

          {aiOutput && (
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 mt-4 max-h-48 overflow-y-auto custom-scrollbar">
              <p className="text-[11px] text-slate-300 leading-relaxed font-medium">
                {aiOutput}
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Filter Presets */}
      <section>
        <SectionHeader icon={Filter} title="Filter Presets" rightIcon={Save} />
        <p className="text-[10px] text-slate-400 font-bold italic px-1">No saved presets found</p>
      </section>

      {/* Date Range */}
      <section>
        <SectionHeader icon={Calendar} title="Date Range" />
        <div className="space-y-4">
          <div>
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 block">From</label>
            <input type="date" className="w-full bg-white border border-slate-200 rounded-xl py-2.5 px-4 text-xs font-bold text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div>
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-1 block">To</label>
            <input type="date" className="w-full bg-white border border-slate-200 rounded-xl py-2.5 px-4 text-xs font-bold text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
        </div>
      </section>

      {/* Grade Filter */}
      <section>
        <SectionHeader icon={BarChart4} title="Grade Filter" />
        {[
          { id: AlertLevel.CRITICAL, label: 'Grade 3 (Critical)' },
          { id: AlertLevel.HIGH, label: 'Grade 2 (High)' },
          { id: AlertLevel.MEDIUM, label: 'Grade 1 (Moderate)' },
          { id: AlertLevel.LOW, label: 'Ungraded (Baseline)' },
        ].map((grade) => (
          <FilterCard key={grade.id}>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                checked={selectedGrades.includes(grade.id)}
                onChange={() => toggleFilter(selectedGrades, setSelectedGrades, grade.id)}
              />
              <span className="text-xs font-bold text-slate-700">{grade.label}</span>
            </label>
          </FilterCard>
        ))}
      </section>

      {/* Country Filter */}
      <section>
        <SectionHeader icon={Globe} title="Country Filter" />
        <div className="max-h-60 overflow-y-auto custom-scrollbar pr-2 space-y-1">
          {AFRO_COUNTRIES.map((c) => (
            <FilterCard key={c.code} active={selectedCountries.includes(c.code)}>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  checked={selectedCountries.includes(c.code)}
                  onChange={() => toggleFilter(selectedCountries, setSelectedCountries, c.code)}
                />
                <span className="text-xs font-bold text-slate-700">{c.name}</span>
                <span className="text-[8px] font-bold text-slate-400 ml-auto">{c.code}</span>
              </label>
            </FilterCard>
          ))}
        </div>
      </section>

      {/* Disease Filter */}
      <section>
        <SectionHeader icon={Bug} title="Disease Filter" />
        <div className="max-h-60 overflow-y-auto custom-scrollbar pr-2 space-y-1">
          {AFRO_DISEASES.map((d) => (
            <FilterCard key={d.code}>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  checked={selectedDiseases.includes(d.name)}
                  onChange={() => toggleFilter(selectedDiseases, setSelectedDiseases, d.name)}
                />
                <span className="text-xs font-bold text-slate-700">{d.name}</span>
              </label>
            </FilterCard>
          ))}
        </div>
      </section>

      {/* Grade Summary */}
      <section>
        <SectionHeader icon={BarChart3} title="Grade Summary" />
        <div className="space-y-2">
          {[
            { label: 'Grade 3', val: signalCounts[AlertLevel.CRITICAL] || 0, color: 'text-red-600' },
            { label: 'Grade 2', val: signalCounts[AlertLevel.HIGH] || 0, color: 'text-orange-600' },
            { label: 'Grade 1', val: signalCounts[AlertLevel.MEDIUM] || 0, color: 'text-amber-600' },
            { label: 'Ungraded', val: signalCounts[AlertLevel.LOW] || 0, color: 'text-slate-600' },
          ].map((item, i) => (
            <div key={i} className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
              <span className="text-xs font-bold text-slate-500">{item.label}</span>
              <span className={`text-xl font-black ${item.color}`}>{item.val}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Data Sources Status */}
      <section className="bg-blue-50/50 p-6 rounded-[2rem] border border-blue-100/50">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-blue-600" />
            <h3 className="text-[11px] font-black text-blue-600 uppercase tracking-widest">Data Sources</h3>
          </div>
          <RefreshCw className="w-4 h-4 text-blue-400 cursor-pointer animate-spin-slow" />
        </div>
        <div className="flex justify-between items-end mb-2">
          <span className="text-[10px] font-black text-slate-400 uppercase">Status</span>
          <span className="text-[10px] font-black text-blue-600 uppercase">5/7 Online</span>
        </div>
        <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden mb-6">
          <div className="h-full bg-emerald-500 w-[72%] rounded-full shadow-sm"></div>
        </div>
        <div className="space-y-4">
          {[
            { name: 'Geographic Event Map', status: 'OK' },
            { name: 'WHO EIOS Monitor', status: 'CRITICAL', color: 'text-red-500' },
            { name: 'AFRO Outbreak Node', status: 'OK' },
            { name: 'Sway Reporting', status: 'OK' }
          ].map((node, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className={`mt-1 rounded-full p-0.5 border ${node.status === 'CRITICAL' ? 'border-red-200 text-red-500' : 'border-emerald-200 text-emerald-500'}`}>
                {node.status === 'CRITICAL' ? <AlertCircle className="w-3 h-3" /> : <Check className="w-3 h-3" />}
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-700 leading-tight">{node.name}</p>
                {node.status === 'CRITICAL' && <p className="text-[9px] font-black text-red-500 uppercase tracking-widest">Critical Alert</p>}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Export Data */}
      <section className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
        <div className="flex items-center gap-2 mb-6">
          <Download className="w-5 h-5 text-blue-600" />
          <h3 className="text-[11px] font-black text-blue-600 uppercase tracking-widest">Export Data</h3>
        </div>
        <div className="space-y-4">
          {[
            { icon: FileText, title: 'PDF Report', sub: 'Executive summary' },
            { icon: FileSpreadsheet, title: 'Excel Workbook', sub: 'Full signal dataset' },
            { icon: FileCode, title: 'CSV File', sub: 'Machine readable format' }
          ].map((exp, i) => (
            <button key={i} className="w-full flex items-center gap-4 p-3 rounded-xl hover:bg-slate-50 transition-all border border-transparent hover:border-slate-100 group">
              <div className="bg-slate-50 p-2 rounded-lg text-slate-500 group-hover:text-blue-600 transition-colors">
                <exp.icon className="w-5 h-5" />
              </div>
              <div className="text-left">
                <p className="text-xs font-black text-slate-800 uppercase tracking-tight">{exp.title}</p>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{exp.sub}</p>
              </div>
            </button>
          ))}
        </div>
      </section>

    </div>
  );
};

