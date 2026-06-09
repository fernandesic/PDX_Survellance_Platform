import React, { useMemo, useEffect, useState } from 'react';
import type { BaseReadiness } from '@/pages/readiness/types/readiness';
import { useTheme } from '@/contexts/ThemeContext';
import { AlertCircle, ShieldAlert } from 'lucide-react';

interface Props {
  data: BaseReadiness[];
  summary: {
    answered_questions: number;
    completion_pct: number;
    total_questions: number;
  };
  country: string;
  activeTab?: string;
}

const CircularProgress = ({ value, label, size = 60, strokeWidth = 5, className = '', colorClass = 'text-green-500', isLight }: any) => {
  const [animatedValue, setAnimatedValue] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setAnimatedValue(value), 100);
    return () => clearTimeout(timer);
  }, [value]);

  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (animatedValue / 100) * circumference;

  return (
    <div className={`relative flex items-center justify-center ${className} shrink-0`} style={{ width: size, height: size }}>
      <svg className="transform -rotate-90" width={size} height={size}>
        <circle
          className={isLight ? "text-gray-200" : "text-white/10"}
          strokeWidth={strokeWidth}
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
        <circle
          className={`${colorClass} transition-all duration-1000 ease-out`}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {label}
      </div>
    </div>
  );
};

export default function IntelligenceSummary({ data, summary, country, activeTab }: Props) {
  const { theme } = useTheme();
  const isLight = theme === 'light';

  const insights = useMemo(() => {
    if (!data || data.length === 0) return null;

    const ALL_AFRICAN_COUNTRIES_SET = new Set([
      "Angola", "Benin", "Botswana", "Burkina Faso", "Burundi",
      "Cameroon", "Cape Verde", "Cabo Verde", "Central African Republic", "CAR", "Chad", "Comoros",
      "Democratic Republic of the Congo", "Republic of the Congo", "Congo", "Djibouti",
      "Equatorial Guinea", "Eritrea", "Ethiopia", "Gabon", "Gambia",
      "Ghana", "Guinea", "Guinea-Bissau", "Ivory Coast", "Cote d'Ivoire", "Côte d'Ivoire", "Kenya", "Lesotho",
      "Liberia", "Madagascar", "Malawi", "Mali", "Mauritania", "Mauritius",
      "Mozambique", "Namibia", "Niger", "Nigeria", "Rwanda",
      "Sao Tome and Principe", "Senegal", "Seychelles", "Sierra Leone", "Somalia",
      "South Africa", "South Sudan", "Sudan", "Swaziland", "eSwatini", "Tanzania",
      "Togo", "Uganda", "Zambia", "Zimbabwe",
      "United Republic of Tanzania", "Somaliland",
      "Egypt", "Libya", "Tunisia", "Algeria", "Morocco"
    ].map(n => n.toLowerCase()));

    // If no country is selected, show country-level averages from the data
    if (!country || country.toLowerCase() === 'africa') {
      const countryMap = data.reduce((acc, item) => {
        const c = item.country || 'Unknown';
        if (!acc[c]) acc[c] = { scores: [], hasPoE: false };
        // @ts-ignore
        const scoreVal = Number(item.category_percent_geo_pct || item.category_percent_country_pct || item.weighted_score || 0);
        acc[c].scores.push(scoreVal);
        return acc;
      }, {} as Record<string, { scores: number[]; hasPoE: boolean }>);

      const regionalAverages = Object.entries(countryMap).map(([name, info]) => {
        const avg = info.scores.length > 0 ? info.scores.reduce((a, b) => a + b, 0) / info.scores.length : 0;
        return { name, avg, hasPoE: info.hasPoE };
      }).sort((a, b) => b.avg - a.avg).slice(0, 3); // Just top 3 for the cards

      return { regionalAverages };
    }

    const districts = data.reduce((acc, item) => {
      // @ts-ignore
      const region = item.district || item.admin_level_name || 'National';
      const rLower = region.toLowerCase();

      // Stop dummy data like other countries showing up as a district of this country
      if (rLower === 'national' || rLower === country.toLowerCase() || ALL_AFRICAN_COUNTRIES_SET.has(rLower)) {
        return acc;
      }

      if (!acc[region]) {
        acc[region] = {
          scores: [],
          // @ts-ignore
          hasPoE: item.has_international_poe === 1 || !!item.poe_name,
        };
      }
      // @ts-ignore
      const scoreVal = Number(item.category_percent_geo_pct || item.category_percent_country_pct || item.weighted_score || 0);
      acc[region].scores.push(scoreVal);
      return acc;
    }, {} as Record<string, { scores: number[]; hasPoE: boolean }>);

    const regionalAverages = Object.entries(districts).map(([name, info]) => {
      const avg = info.scores.length > 0 ? info.scores.reduce((a, b) => a + b, 0) / info.scores.length : 0;
      return { name, avg, hasPoE: info.hasPoE };
    }).sort((a, b) => b.avg - a.avg);

    return {
      regionalAverages,
    };
  }, [data, country]);

  const questionsPercentage = summary.total_questions > 0
    ? (summary.answered_questions / summary.total_questions) * 100
    : 0;

  return (
    <div className="w-full flex gap-4 mb-8">

      {/* Card 1: Overall Readiness */}
      <div className={`p-4 rounded-xl flex items-center justify-between gap-4 flex-1 border ${isLight ? 'bg-white border-gray-200 shadow-sm' : 'bg-[#0a0a0a] border-white/5'}`}>
        <div className="flex flex-col gap-1 min-w-0">
          <h2 className={`text-xs flex items-center gap-2 font-bold tracking-wide truncate ${isLight ? 'text-gray-900' : 'text-white'}`}>
            <ShieldAlert size={18} className={`shrink-0 ${isLight ? "text-amber-500" : "text-[#F59F0A]"}`} />
            <span className="truncate">{activeTab || "Readiness"}</span>
          </h2>
          <p className={`text-sm tracking-wide truncate ${isLight ? 'text-gray-600' : 'text-gray-400'}`}>Overall readiness</p>
        </div>
        <CircularProgress
          isLight={isLight}
          value={Number(summary.completion_pct ?? 0)}
          size={56}
          strokeWidth={5}
          colorClass={isLight ? "text-amber-500" : "text-[#F59F0A]"}
          label={<span className={`text-sm font-bold ${isLight ? "text-gray-900" : "text-white"}`}>{Number(summary.completion_pct ?? 0).toFixed(0)}%</span>}
        />
      </div>

      {/* Card 2: Questions Answered */}
      <div className={`p-4 rounded-xl flex items-center justify-between gap-4 flex-1 border ${isLight ? 'bg-white border-gray-200 shadow-sm' : 'bg-[#0a0a0a] border-white/5'}`}>
        <div className="flex flex-col gap-1 min-w-0">
          <h2 className={`text-xs font-bold tracking-wide truncate ${isLight ? 'text-gray-900' : 'text-white'}`}>
            Questions Answered
          </h2>
          <p className={`text-sm tracking-wide truncate ${isLight ? 'text-gray-600' : 'text-gray-400'}`}>
            {summary.answered_questions} out of {summary.total_questions} variables
          </p>
        </div>
        <CircularProgress
          isLight={isLight}
          value={questionsPercentage}
          size={56}
          strokeWidth={5}
          colorClass="text-[#3b82f6]"
          label={<span className={`text-sm font-bold ${isLight ? "text-gray-900" : "text-white"}`}>{summary.answered_questions}</span>}
        />
      </div>

      {/* Card 3+: Regions */}
      {insights && insights.regionalAverages.length > 0 ? (
        insights.regionalAverages.map((region, idx) => {
          const isHigh = region.avg >= 80;
          const isLow = region.avg < 40;
          const scoreColor = isHigh ? 'text-[#10b981]' : isLow ? 'text-[#ef4444]' : 'text-[#f59e0b]';

          return (
            <div key={idx} className={`p-4 rounded-xl flex items-center justify-between gap-4 flex-1 border ${isLight ? 'bg-white border-gray-200 shadow-sm' : 'bg-[#0a0a0a] border-white/5'}`}>
              <div className="flex flex-col gap-1 min-w-0 pr-2">
                <div className="flex items-center gap-2">
                  <h2 className={`text-xs font-bold tracking-widest truncate ${isLight ? 'text-gray-900' : 'text-white'}`} title={region.name}>
                    {region.name}
                  </h2>
                  {region.hasPoE && (
                    <span title="Has International PoE" className="shrink-0">
                      <AlertCircle size={12} className="text-[#3b82f6]" />
                    </span>
                  )}
                </div>
                <p className={`text-sm tracking-wide font-semibold truncate ${isLight ? 'text-gray-500' : 'text-gray-400'}`}>
                  Readiness Score
                </p>
              </div>
              <CircularProgress
                isLight={isLight}
                value={region.avg}
                size={56}
                strokeWidth={5}
                colorClass={scoreColor}
                label={<span className={`text-sm font-bold ${scoreColor}`}>{region.avg.toFixed(0)}%</span>}
              />
            </div>
          );
        })
      ) : (
        <div className={`p-4 rounded-xl flex items-center justify-center flex-1 border ${isLight ? 'bg-white border-gray-200 shadow-sm' : 'bg-[#0a0a0a] border-white/5'}`}>
          <p className={`text-sm italic ${isLight ? 'text-gray-500' : 'text-gray-400'}`}>No regional breakdown available</p>
        </div>
      )}

    </div>
  );
}
