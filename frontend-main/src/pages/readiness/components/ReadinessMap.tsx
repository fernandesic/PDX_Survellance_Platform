// @ts-nocheck
import { SimpleArcGISMap } from "@/components/maps/SimpleArcGISMap";
import { useState, useEffect, useMemo } from "react";
import type { RegionScore, BaseReadiness } from "@/pages/readiness/types/readiness";
import { AlertCircle, ShieldAlert } from 'lucide-react';
import localAfricaGeoJson from '@/data/africa.geo.json';

const AFRICAN_COUNTRIES_FOR_MAP = [
    "Angola", "Benin", "Botswana", "Burkina Faso", "Burundi",
    "Cameroon", "Cape Verde", "Central African Republic", "Chad", "Comoros",
    "Democratic Republic of the Congo", "Republic of the Congo", "Djibouti",
    "Equatorial Guinea", "Eritrea", "Ethiopia", "Gabon", "Gambia",
    "Ghana", "Guinea", "Guinea-Bissau", "Ivory Coast", "Kenya", "Lesotho",
    "Liberia", "Madagascar", "Malawi", "Mali", "Mauritania", "Mauritius",
    "Mozambique", "Namibia", "Niger", "Nigeria", "Rwanda",
    "Sao Tome and Principe", "Senegal", "Seychelles", "Sierra Leone", "Somalia",
    "South Africa", "South Sudan", "Sudan", "Swaziland", "Tanzania",
    "Togo", "Uganda", "Zambia", "Zimbabwe",
    "United Republic of Tanzania", "Somaliland", "Côte d'Ivoire", "eSwatini"
];

const getColor = (value: number): string => {
    if (value >= 70) return "#22c55e";
    if (value >= 40) return "#f59e0b";
    if (value > 0) return "#ef4444";
    return "transparent";
};

interface Prop {
    title: string;
    data: RegionScore[];
    overallCompletion: number;
    totalHazards: number;
    countriesAssessed: number;
    country?: string;
    selectedCountryData?: BaseReadiness[];
    onlyMap?: boolean;
    isOverview?: boolean;
    isLight?: boolean;
}

export default function ReadinessMap({ title, data, overallCompletion, totalHazards, countriesAssessed, country, selectedCountryData, shadow = true, onlyMap = false, isOverview = false, isLight = false }: Prop) {
    const [africaGeoJson, setAfricaGeoJson] = useState<GeoJSON.FeatureCollection | null>(null);

    // Use bundled Africa GeoJSON — no network fetch required
    useEffect(() => {
        setAfricaGeoJson(localAfricaGeoJson as any);
    }, []);

    const normalizeCountryName = (name: string): string => {
        const normalized = name.toLowerCase().trim();
        const mappings: Record<string, string> = {
            'united republic of tanzania': 'tanzania',
            'democratic republic of the congo': 'drc',
            'congo (democratic republic of the)': 'drc',
            'dr congo': 'drc',
            'republic of the congo': 'congo',
            'republic of congo': 'congo',
            'ivory coast': 'côte d\'ivoire',
            'cote d\'ivoire': 'côte d\'ivoire',
            'cote d’ivoire': 'côte d\'ivoire',
            'guinea bissau': 'guinea-bissau',
            'somaliland': 'somalia',
            'swaziland': 'eswatini',
            'the gambia': 'gambia',
            'cabo verde': 'cape verde',
        };
        return mappings[normalized] || normalized;
    };

    const getCountryData = useMemo(() => {
        const dataMap: Record<string, { value: number; label: string }> = {};
        data.forEach((item) => {
            const normName = normalizeCountryName(item.region);
            dataMap[normName] = {
                value: item.score,
                label: `${item.score}%`
            };
        });
        return dataMap;
    }, [data]);

    const getFeatureStyle = (feature: any) => {
        const countryName = feature.properties?.name || '';
        const normName = normalizeCountryName(countryName);

        const countryInfo = getCountryData[normName];
        const value = countryInfo?.value || 0;
        const color = getColor(value);

        return {
            fillColor: color,
            fillOpacity: value > 0 ? 0.8 : 0.2
        };
    };

    const highPerforming = data.filter(d => d.score >= 70).sort((a, b) => b.score - a.score);
    const critical = data.filter(d => d.score > 0 && d.score < 40).sort((a, b) => b.score - a.score);

    const countryAnalytics = useMemo(() => {
        if (!selectedCountryData || selectedCountryData.length === 0 || !country || country.toLowerCase() === 'africa') return null;

        const catMap: Record<string, { scores: number[]; qCount: number; aCount: number }> = {};
        const districtMap: Record<string, { scores: number[] }> = {};

        selectedCountryData.forEach(item => {
            const cat = item.category || 'General';
            if (!catMap[cat]) catMap[cat] = { scores: [], qCount: 0, aCount: 0 };
            catMap[cat].qCount += 1;
            if (item.question_score > 0) {
                catMap[cat].aCount += 1;
            }

            const dist = item.district || item.admin_level_name || 'National';
            if (!districtMap[dist]) districtMap[dist] = { scores: [] };

            const distScore = Number(item.category_percent_geo_pct || item.category_percent_country_pct || item.weighted_score || 0);
            districtMap[dist].scores.push(distScore);
        });

        const categories = Object.entries(catMap).map(([name, info]) => {
            const pct = info.qCount > 0 ? (info.aCount / info.qCount) * 100 : 0;
            return { name, pct, answered: info.aCount, total: info.qCount };
        }).sort((a, b) => b.pct - a.pct);

        const districts = Object.entries(districtMap).map(([name, info]) => {
            const avg = info.scores.length > 0 ? (info.scores.reduce((a, b) => a + b, 0) / info.scores.length) : 0;
            return { name, avg };
        }).filter(d => d.name.toLowerCase() !== 'national' && d.name.toLowerCase() !== country.toLowerCase()).sort((a, b) => b.avg - a.avg);

        const topRegions = districts.slice(0, 3);
        const bottomRegions = districts.filter(d => d.avg < 70).reverse().slice(0, 3);

        const criticalGaps = selectedCountryData
            .filter(item => Number(item.question_score || 0) <= 0 && item.question && item.category?.toLowerCase() !== 'comment')
            .slice(0, 2)
            .map(item => ({ category: item.category || 'General', question: item.question }));

        let totalItems = 0;
        let evidenceItems = 0;
        selectedCountryData.forEach(item => {
            if (item.category?.toLowerCase() === 'comment') return;
            totalItems++;
            if (item.file_name || (item.comments && item.comments.trim().length > 0)) evidenceItems++;
        });

        const trustScore = totalItems > 0 ? (evidenceItems / totalItems) * 100 : 0;

        return {
            categories,
            topRegions,
            bottomRegions,
            criticalGaps,
            trustScore,
            evidenceCount: evidenceItems,
            totalCount: totalItems,
            hasDistricts: districts.length > 0
        };
    }, [selectedCountryData, country]);

    const isCountryView = country && country.toLowerCase() !== 'africa';

    if (onlyMap) {
        return (
            <div className="w-full h-full rounded-lg overflow-hidden relative">
                {africaGeoJson && (
                    <SimpleArcGISMap
                        geoData={africaGeoJson}
                        getCountryStyle={getFeatureStyle}
                        mapKey={JSON.stringify(getCountryData)}
                        selectedCountryName={country && country.toLowerCase() !== 'africa' ? country : ''}
                        isLight={isLight}
                    />
                )}
            </div>
        );
    }

    return (
        <div className={`w-full grid grid-cols-1 ${isOverview ? 'xl:grid-cols-2' : 'lg:grid-cols-3'} gap-4`}>
            <div className={`lg:col-span-2 ${isLight ? 'bg-white border-gray-200' : 'bg-[#0d1424] border-blue-500/20'} rounded-xl relative shadow-lg border`}>
                <div className="w-full h-[680px] rounded-lg overflow-hidden relative">
                    {africaGeoJson && (
                        <SimpleArcGISMap
                            geoData={africaGeoJson}
                            getCountryStyle={getFeatureStyle}
                            mapKey={JSON.stringify(getCountryData)}
                            selectedCountryName={country && country.toLowerCase() !== 'africa' ? country : ''}
                            isLight={true}
                        />
                    )}
                </div>
                <div className={`absolute bottom-3 left-3 px-3 py-2 rounded-lg text-sm z-[400] bg-white/80 text-gray-800 backdrop-blur-sm shadow-sm border border-gray-200`}>
                    <div className="font-bold mb-1.5">{title} Readiness</div>
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1">
                            <span className="w-3 h-3 rounded-sm bg-[#22c55e]" />
                            <span className="text-[10px]">High</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <span className="w-3 h-3 rounded-sm bg-[#f59e0b]" />
                            <span className="text-[10px]">Moderate</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <span className="w-3 h-3 rounded-sm bg-[#ef4444]" />
                            <span className="text-[10px]">Critical</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className={`${isLight ? 'bg-white border-gray-200' : 'bg-[#0d1424] border-white/5'} rounded-xl p-5 border flex flex-col h-[680px] shadow-lg overflow-y-auto scrollbar-hide`}>
                {isCountryView ? (
                    <div className="space-y-6">
                        <div className={`border-b ${isLight ? 'border-gray-100' : 'border-white/5'} pb-4`}>
                            <div className="flex justify-between items-start">
                                <h2 className={`${isLight ? 'text-gray-800' : 'text-white'} font-bold text-lg capitalize`}>{country} Analysis</h2>
                                {countryAnalytics && (
                                    <div className="bg-blue-500/10 border border-blue-500/20 px-2 py-1 rounded">
                                        <span className="text-[10px] text-blue-300 font-bold uppercase mr-1">Trust</span>
                                        <span className="text-xs font-bold text-blue-400">{Math.round(countryAnalytics.trustScore)}%</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {countryAnalytics ? (
                            <>
                                <div className="space-y-4">
                                    <h3 className="text-gray-300 text-sm font-semibold">Category Breakdown</h3>
                                    {countryAnalytics.categories.map((cat, i) => (
                                        <div key={i}>
                                            <div className="flex justify-between text-xs mb-1">
                                                <span className="text-gray-200">{cat.name}</span>
                                                <span className="text-blue-400 font-bold">{Math.round(cat.pct)}%</span>
                                            </div>
                                            <div className="w-full bg-gray-800 h-1.5 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full ${cat.pct >= 70 ? 'bg-green-500' : cat.pct >= 40 ? 'bg-amber-500' : 'bg-red-500'}`}
                                                    style={{ width: `${cat.pct}%` }}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="space-y-4 pt-2">
                                    <h3 className="text-gray-300 text-sm font-semibold flex items-center gap-2">
                                        <AlertCircle size={14} className="text-red-400" />
                                        Critical Action Points
                                    </h3>
                                    {countryAnalytics.criticalGaps.length > 0 ? (
                                        <div className="space-y-2">
                                            {countryAnalytics.criticalGaps.map((gap, i) => (
                                                <div key={i} className="bg-red-500/10 border border-red-500/20 p-2.5 rounded-lg">
                                                    <p className="text-[10px] text-red-300 font-bold uppercase mb-0.5">{gap.category}</p>
                                                    <p className="text-xs text-gray-200">{gap.question}</p>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-xs text-gray-500">No critical gaps identified.</p>
                                    )}
                                </div>

                                {countryAnalytics.hasDistricts && (
                                    <div className="space-y-4 pt-2">
                                        <h3 className="text-gray-300 text-sm font-semibold">Top Regional Performers</h3>
                                        <div className="space-y-2">
                                            {countryAnalytics.topRegions.map((dist, i) => (
                                                <div key={i} className="flex justify-between items-center bg-white/5 p-2 rounded">
                                                    <span className="text-xs text-gray-200">{dist.name}</span>
                                                    <span className="text-green-400 font-bold">{dist.avg.toFixed(1)}%</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-20 text-center">
                                <ShieldAlert size={32} className="text-gray-600 mb-2" />
                                <p className="text-gray-400 text-sm">No data recorded for this category.</p>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="space-y-5">
                        <h2 className={`${isLight ? 'text-gray-800' : 'text-white'} font-bold text-lg`}>Continental Overview</h2>
                        <div className={`${isLight ? 'bg-gray-50 border-gray-100' : 'bg-white/5 border-white/5'} p-4 rounded-xl border`}>
                            <div className="flex justify-between items-end mb-2">
                                <span className={`${isLight ? 'text-gray-600' : 'text-gray-300'} text-sm`}>Average Score</span>
                                <span className={`${isLight ? 'text-gray-900' : 'text-white'} font-bold text-2xl`}>{overallCompletion.toFixed(1)}%</span>
                            </div>
                            <div className="w-full bg-gray-800 h-2 rounded-full overflow-hidden">
                                <div className="bg-blue-500 h-full" style={{ width: `${overallCompletion}%` }} />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-green-500/10 p-3 rounded-lg text-center">
                                <div className="text-green-400 font-bold text-lg">{highPerforming.length}</div>
                                <div className="text-[10px] text-gray-400 uppercase">Prepared</div>
                            </div>
                            <div className="bg-red-500/10 p-3 rounded-lg text-center">
                                <div className="text-red-400 font-bold text-lg">{critical.length}</div>
                                <div className="text-[10px] text-gray-400 uppercase">Critical</div>
                            </div>
                        </div>

                        <div className="space-y-4 pt-2">
                            <h3 className="text-gray-400 text-xs font-bold uppercase">Top Performers</h3>
                            <div className="space-y-2">
                                {highPerforming.slice(0, 3).map((country, idx) => (
                                    <div key={idx} className="flex justify-between text-xs bg-white/5 p-2 rounded">
                                        <span className="text-gray-300">{country.region}</span>
                                        <span className="text-green-400 font-bold">{country.score}%</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
