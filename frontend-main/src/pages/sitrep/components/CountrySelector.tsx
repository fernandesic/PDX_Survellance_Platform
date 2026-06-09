import React, { useCallback } from 'react';
import { AFRO_MEMBER_STATES, getCountryRisk, RISK_COLORS } from '../constants/checklists';

interface CountrySelectorProps {
    selectedCountry: string;
    onCountryChange: (country: string) => void;
}

/**
 * Section 3 — Country Dropdown with Risk Tag
 * Selects a State Party and shows the risk tier badge
 */
const CountrySelector: React.FC<CountrySelectorProps> = ({ selectedCountry, onCountryChange }) => {
    const riskInfo = selectedCountry ? getCountryRisk(selectedCountry) : null;
    const riskStyle = riskInfo ? RISK_COLORS[riskInfo.risk] : null;

    const handleChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
        onCountryChange(e.target.value);
    }, [onCountryChange]);

    return (
        <div className="px-5 py-5">
            <div className="flex items-center gap-4 mb-4 flex-wrap">
                <label className="text-sm font-semibold text-gray-700">
                    Select State Party / risk tier
                </label>
                {riskInfo && riskStyle && (
                    <span
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider shadow-sm"
                        style={{ backgroundColor: riskStyle.bg, color: riskStyle.text }}
                    >
                        {riskStyle.label} Risk
                    </span>
                )}
            </div>
            <select
                value={selectedCountry}
                onChange={handleChange}
                className="w-full md:w-[480px] px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm text-gray-800 outline-none focus:border-[#4a9fd8] transition-colors cursor-pointer appearance-none"
                style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 12px center',
                    paddingRight: '40px',
                }}
            >
                <option value="">— Choose a country —</option>
                {AFRO_MEMBER_STATES.map((country) => {
                    const info = getCountryRisk(country);
                    return (
                        <option key={country} value={country}>
                            {country} ({info.risk.replace('_', ' ')})
                        </option>
                    );
                })}
            </select>

            {!selectedCountry && (
                <p className="text-gray-400 text-sm italic mt-4 text-center">
                    Choose a country above to load the relevant recommendations checklist.
                </p>
            )}
        </div>
    );
};

export default CountrySelector;
