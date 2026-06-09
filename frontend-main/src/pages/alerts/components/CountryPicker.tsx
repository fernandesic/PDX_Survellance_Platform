// @ts-nocheck

import React, { useState, useRef, useEffect } from 'react';
import { Globe, Search, ChevronDown, Check } from 'lucide-react';
import { AFRO_COUNTRIES } from '../constants';

interface CountryPickerProps {
    selectedCountry: string;
    onSelectCountry: (name: string) => void;
}

export const CountryPicker: React.FC<CountryPickerProps> = ({ selectedCountry, onSelectCountry }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
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

    const filteredCountries = AFRO_COUNTRIES.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.code.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-3 bg-white border border-slate-200 px-4 py-2.5 rounded-xl hover:border-slate-300 transition-all shadow-sm active:scale-95"
            >
                <div className="bg-slate-900 text-emerald-400 w-6 h-6 rounded-lg flex items-center justify-center">
                    <Globe className="w-3.5 h-3.5" />
                </div>
                <div className="text-left">
                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest leading-none mb-0.5">Location</p>
                    <p className="text-xs font-black text-slate-900 uppercase tracking-tight">{selectedCountry}</p>
                </div>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute top-full mt-2 left-0 w-72 bg-white border border-slate-200 rounded-2xl shadow-2xl z-[100] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="p-3 border-b border-slate-100 bg-slate-50/50">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                            <input
                                autoFocus
                                type="text"
                                placeholder="Search states..."
                                className="w-full bg-white border border-slate-200 rounded-lg py-2 pl-9 pr-4 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="max-h-72 overflow-y-auto custom-scrollbar p-1">
                        <button
                            onClick={() => {
                                onSelectCountry('AFRO Regional Panorama');
                                setIsOpen(false);
                            }}
                            className={`w-full text-left px-4 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-between mb-1 ${selectedCountry === 'AFRO Regional Panorama'
                                    ? 'bg-slate-900 text-white'
                                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                                }`}
                        >
                            <span>Regional Panorama</span>
                            {selectedCountry === 'AFRO Regional Panorama' ? <Check className="w-4 h-4" /> : <Globe className="w-4 h-4 opacity-50" />}
                        </button>

                        <div className="pt-3 pb-1 px-4 text-[9px] font-black text-slate-400 uppercase tracking-widest border-t border-slate-50 mt-1">Member States</div>

                        {filteredCountries.map((country) => (
                            <button
                                key={country.code}
                                onClick={() => {
                                    onSelectCountry(country.name);
                                    setIsOpen(false);
                                }}
                                className={`w-full text-left px-4 py-2.5 rounded-lg text-xs font-bold transition-colors flex items-center justify-between group ${selectedCountry === country.name
                                        ? 'bg-emerald-50 text-emerald-700'
                                        : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                                    }`}
                            >
                                <div className="flex items-center gap-2">
                                    {selectedCountry === country.name && <Check className="w-3.5 h-3.5" />}
                                    <span>{country.name}</span>
                                </div>
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 group-hover:bg-white transition-colors uppercase">{country.code}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

