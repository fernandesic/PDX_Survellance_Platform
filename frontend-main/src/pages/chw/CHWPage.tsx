import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "@/contexts/ThemeContext";
import { logger } from "@/utils/logger";
import { chwService } from "@/pages/chw/services/chw";
import { useCHWDataQuery } from "@/hooks/queries/useCHWDataQuery";
import { chatService } from "@/pages/chat/services/chat_service";
import type { CHWCountry, CHWCountryDetail, WorkerTypeByCountry } from "@/pages/chw/types/chw";
import { arcgisService, type ArcGISWebMapLayer } from "@/services/arcgisService";
import { Loading } from "@/components/Loading";
import { ErrorState } from "./components/ChartComponents";
import { useTenant } from "@/hooks/useTenant";
import CHWView from "./CHWView";
/* ─── Utilities ─── */

const NAME_MAP: Record<string, string> = {
    "united republic of tanzania": "tanzania",
    "swaziland": "eswatini",
    "ivory coast": "côte d'ivoire",
    "cote d'ivoire": "côte d'ivoire",
    "democratic republic of the congo": "drc",
    "republic of the congo": "congo",
};
const normalize = (n: string) => {
    const l = n.toLowerCase().trim();
    return NAME_MAP[l] || l;
};

// NOTE: Worker type data is not available in the new 2026 CHW data.
// The CHWWorkerTypes component is commented out in CHWView.tsx.
// When client provides worker type breakdown, re-enable and remove this comment.

const rgbaToHex = (rgba: any) => {
    try {
        if (!rgba) return '#6b7280';

        // Handle array format [r, g, b, a]
        if (Array.isArray(rgba)) {
            const r = rgba[0].toString(16).padStart(2, '0');
            const g = rgba[1].toString(16).padStart(2, '0');
            const b = rgba[2].toString(16).padStart(2, '0');
            return `#${r}${g}${b}`;
        }

        // Handle object format { r, g, b, a }
        if (typeof rgba === 'object' && rgba.r !== undefined) {
            const r = rgba.r.toString(16).padStart(2, '0');
            const g = rgba.g.toString(16).padStart(2, '0');
            const b = rgba.b.toString(16).padStart(2, '0');
            return `#${r}${g}${b}`;
        }

        return '#6b7280';
    } catch (e) {
        return '#6b7280';
    }
};

interface LegendItem {
    label: string;
    bg: string;
    min: number;
    max: number;
}

/* ─── Container Component ─── */

export default function CHWPage() {
    const { theme } = useTheme();
    const isDark = theme === 'dark';
    const navigate = useNavigate();

    /* ── State ── */
    const { data: chwData, isLoading: loading } = useCHWDataQuery();
    const summary = chwData?.sum || null;
    const workerTypes = chwData?.wt || [];
    const globalTopRegions = chwData?.topRegions || [];

    const [selectedCountry, setSelectedCountry] = useState<CHWCountryDetail | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [benchmark, setBenchmark] = useState(23);
    const [compareList, setCompareList] = useState<string[]>([]);
    const [sortCol, setSortCol] = useState<string>("chws_per_10000");
    const [sortAsc, setSortAsc] = useState(false);
    const [coverageFilter, setCoverageFilter] = useState<string>("all");
    const [aiQuery, setAiQuery] = useState("");
    const [aiResponse, setAiResponse] = useState("");
    const [aiLoading, setAiLoading] = useState(false);
    const [dynamicLegend, setDynamicLegend] = useState<LegendItem[]>([]);
    const [legendLoading, setLegendLoading] = useState(true);
    const [countryLoading, setCountryLoading] = useState(false);

    /* ── Auto-Select Tenant Country (first load only) ── */
    const { isSuperAdmin, tenant } = useTenant();
    const autoSelectCountryName = isSuperAdmin ? null : (tenant?.name?.toLowerCase() || null);
    const autoSelectDone = useState(false);

    useEffect(() => {
        if (!summary || autoSelectDone[0]) return;
        autoSelectDone[1](true); // Mark done — never re-fire on subsequent selectedCountry changes

        // Try tenant country first, then fall back to first country in dataset
        const target = autoSelectCountryName
            ? summary.countries.find((c: CHWCountry) => c.country.toLowerCase() === autoSelectCountryName)
            : null;
        const pick = target || summary.countries[0];
        if (pick) {
            chwService.countryDetail(pick.id).then(setSelectedCountry).catch(e => logger.error('Auto-select error:', e));
        }
    }, [summary]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        (async () => {
            try {
                setLegendLoading(true);
                const layers: ArcGISWebMapLayer[] = await arcgisService.getWebMapLayers('chw');
                // Use robust finding for the layer title
                let chwLayer = layers.find(l =>
                    (l.title?.toUpperCase().includes('CHW') || l.title?.toUpperCase().includes('WORKER')) &&
                    l.layerDefinition?.drawingInfo?.renderer
                );

                // Fallback to first layer with a renderer if nothing found
                if (!chwLayer) {
                    chwLayer = layers.find(l => l.layerDefinition?.drawingInfo?.renderer);
                }

                const renderer = chwLayer?.layerDefinition?.drawingInfo?.renderer;

                if (renderer) {
                    let items: LegendItem[] = [];

                    if (renderer.type === 'classBreaks' && renderer.classBreakInfos) {
                        items = renderer.classBreakInfos.map((info, idx, arr) => ({
                            label: info.label,
                            bg: rgbaToHex(info.symbol.color),
                            min: idx === 0 ? 0 : arr[idx - 1].classMaxValue + 1,
                            max: info.classMaxValue
                        }));
                    } else if (renderer.type === 'uniqueValue' && renderer.uniqueValueInfos) {
                        items = renderer.uniqueValueInfos.map(info => ({
                            label: info.label,
                            bg: rgbaToHex(info.symbol.color),
                            min: 0,
                            max: 0
                        }));
                    }

                    if (items.length > 0) {
                        setDynamicLegend(items);
                    }
                }
            } catch (e) {
                logger.error("Discovery error:", e);
            } finally {
                setLegendLoading(false);
            }
        })();
    }, []);

    /* ── Derived State & Handlers ── */
    const getMapColor = useCallback((totalChws: number) => {
        if (!dynamicLegend.length) return { bg: '#6b7280', label: 'Loading...' };
        const tier = [...dynamicLegend].reverse().find(t => totalChws >= t.min);
        return tier || { bg: dynamicLegend[0]?.bg || '#fee5d9', label: dynamicLegend[0]?.label };
    }, [dynamicLegend]);

    const handleCountryClick = useCallback(async (countryName: string) => {
        if (!summary) return;
        const found = summary.countries.find(c => normalize(c.country) === normalize(countryName));
        if (found) {
            try {
                setCountryLoading(true);
                const detail = await chwService.countryDetail(found.id);
                setSelectedCountry(detail);
            } catch (e) {
                logger.error("Country detail error:", e);
                setSelectedCountry(null); // Reset on error — don't show stale data
            } finally {
                setCountryLoading(false);
            }
        } else {
            // Country name didn't match any in summary (normalisation mismatch or
            // country not in 2026 dataset) — reset to global view instead of showing stale data
            setSelectedCountry(null);
        }
    }, [summary]);

    useEffect(() => {
        if (selectedCountry) {
            setAiQuery(`Give me a brief overview of CHW data for ${selectedCountry.country}`);
            setAiResponse('');
        } else {
            setAiResponse('');
            setAiQuery('');
        }
    }, [selectedCountry?.country]);

    const countries = summary?.countries || [];
    const sorted = useMemo(() => [...countries].sort((a, b) => b.chws_per_10000 - a.chws_per_10000), [countries]);

    const filtered = useMemo(() => {
        let list = sorted.filter(c => c.country.toLowerCase().includes(searchTerm.toLowerCase()));
        if (coverageFilter !== "all") {
            const DENSITY_TIERS: Record<string, { min: number; max: number }> = {
                'high': { min: 20, max: Infinity },
                'moderate': { min: 10, max: 20 },
                'low': { min: 1, max: 10 },
                'critical': { min: 0, max: 1 },
            };
            const tier = DENSITY_TIERS[coverageFilter];
            if (tier) {
                list = list.filter(c => {
                    const d = c.chws_per_10000;
                    if (tier.max === Infinity) return d >= tier.min;
                    return d >= tier.min && d < tier.max;
                });
            }
        }
        return list;
    }, [sorted, searchTerm, coverageFilter]);

    const tableSorted = useMemo(() => {
        const arr = [...filtered];
        arr.sort((a, b) => {
            let va: any, vb: any;
            switch (sortCol) {
                case 'country': va = a.country; vb = b.country; break;
                case 'total_chws': va = a.total_chws; vb = b.total_chws; break;
                case 'population_2024': va = a.population_2024; vb = b.population_2024; break;
                case 'chws_per_10000': va = a.chws_per_10000; vb = b.chws_per_10000; break;
                case 'total_regions': va = a.total_regions; vb = b.total_regions; break;
                default: va = a.chws_per_10000; vb = b.chws_per_10000;
            }
            if (typeof va === 'string') return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
            return sortAsc ? va - vb : vb - va;
        });
        return arr;
    }, [filtered, sortCol, sortAsc]);

    const handleSort = (col: string) => {
        if (sortCol === col) setSortAsc(!sortAsc);
        else { setSortCol(col); setSortAsc(false); }
    };

    const totalChws = countries.reduce((s, c) => s + c.total_chws, 0);
    const totalPop = countries.reduce((s, c) => s + c.population_2024, 0);
    const avgPer10k = totalPop > 0 ? Math.round((totalChws / totalPop) * 10000) : 0;

    const gapCountries = useMemo(() => sorted.filter(c => c.chws_per_10000 > 0 && c.chws_per_10000 < 10), [sorted]);
    const criticalCount = gapCountries.length;
    const wellCovered = sorted.filter(c => c.chws_per_10000 >= 20).length;

    const gapCalcData = useMemo(() => {
        return countries
            .filter(c => c.population_2024 > 0)
            .map(c => {
                const targetChws = Math.round((benchmark * c.population_2024) / 10000);
                const currentDensity = Math.round(c.chws_per_10000);
                const gap = targetChws - c.total_chws;
                const pctOfTarget = c.total_chws > 0 ? Math.round((c.total_chws / targetChws) * 100) : 0;
                return {
                    ...c,
                    targetChws,
                    gap: Math.max(gap, 0),
                    surplus: gap < 0 ? Math.abs(gap) : 0,
                    meetsTarget: gap <= 0,
                    pctOfTarget: Math.min(pctOfTarget, 100),
                    currentDensity,
                    severity: gap <= 0 ? 'met' as const : gap > targetChws * 0.7 ? 'critical' as const : gap > targetChws * 0.3 ? 'moderate' as const : 'mild' as const,
                };
            })
            .sort((a, b) => b.gap - a.gap);
    }, [countries, benchmark]);

    const totalGap = gapCalcData.reduce((s, c) => s + c.gap, 0);
    const countriesBelowBenchmark = gapCalcData.filter(c => !c.meetsTarget).length;

    const toggleCompare = (name: string) => {
        setCompareList(prev =>
            prev.includes(name) ? prev.filter(n => n !== name) : prev.length < 3 ? [...prev, name] : prev
        );
    };
    const compareCountries = useMemo(() =>
        compareList.map(name => countries.find(c => c.country === name)).filter(Boolean) as CHWCountry[],
        [compareList, countries]
    );

    const workerTypeAgg = useMemo(() => {
        const map = new Map<string, number>();
        workerTypes.forEach((wt: WorkerTypeByCountry) => {
            map.set(wt.worker_type, (map.get(wt.worker_type) || 0) + wt.total);
        });
        return Array.from(map.entries())
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 10);
    }, [workerTypes]);

    const totalWorkers = workerTypeAgg.reduce((s, w) => s + w.value, 0);

    const bubbleData = useMemo(() =>
        countries
            .filter(c => c.population_2024 > 0 && c.total_chws > 0)
            .map(c => ({
                country: c.country,
                population: c.population_2024,
                density: Math.round(c.chws_per_10000),
                totalChws: c.total_chws,
                z: Math.sqrt(c.total_chws) * 3,
            })),
        [countries]
    );

    const buildCHWContext = useCallback(() => {
        const lines = sorted
            .filter(c => c.total_chws > 0)
            .map(c => `- ${c.country}: ${c.total_chws.toLocaleString()} CHWs, population ${c.population_2024 > 0 ? (c.population_2024 / 1e6).toFixed(1) + 'M' : 'unknown'}, density ${Math.round(c.chws_per_10000)} per 10,000`);
        return `Here is the Community Health Worker (CHW) workforce data for WHO AFRO Region (${countries.length} countries, ${totalChws.toLocaleString()} total CHWs, average density ${avgPer10k} per 10,000 population):\n${lines.join('\n')}`;
    }, [sorted, countries.length, totalChws, avgPer10k]);

    const askWhoAbout = (question: string) => {
        const context = buildCHWContext();
        const prompt = `${context}\n\nBased on ONLY the Community Health Worker workforce data above, ${question}`;
        navigate('/chat', { state: { prefill: prompt, context: 'chw' } });
    };

    const askAiInline = async (question: string) => {
        if (!question.trim() || aiLoading) return;
        const ctx = buildCHWContext();
        const prompt = `${ctx}\n\nBased on ONLY the CHW data above, ${question}`;
        setAiResponse('');
        setAiLoading(true);
        let full = '';
        try {
            await chatService.queryStream(
                prompt, 'chw',
                (chunk: string) => { full += chunk; setAiResponse(full); },
                () => setAiLoading(false),
                () => setAiLoading(false),
                [], 'en'
            );
        } catch { setAiLoading(false); setAiResponse('Failed to get AI response.'); }
    };

    /* ── Loading → show block ── */
    if (loading) return <Loading />;
    if (!summary) return <ErrorState isDark={isDark} />;

    return (
        <CHWView
            isDark={isDark}
            summary={summary}
            selectedCountry={selectedCountry}
            countryLoading={countryLoading}
            dynamicLegend={dynamicLegend}
            legendLoading={legendLoading}
            sorted={sorted}
            tableSorted={tableSorted}
            filtered={filtered}
            totalChws={totalChws}
            avgPer10k={avgPer10k}
            wellCovered={wellCovered}
            criticalCount={criticalCount}
            workerTypeAgg={workerTypeAgg}
            totalWorkers={totalWorkers}
            bubbleData={bubbleData}
            countries={countries}
            totalPop={totalPop}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            coverageFilter={coverageFilter}
            setCoverageFilter={setCoverageFilter}
            sortCol={sortCol}
            sortAsc={sortAsc}
            handleSort={handleSort}
            compareList={compareList}
            toggleCompare={toggleCompare}
            compareCountries={compareCountries}
            gapCalcData={gapCalcData}
            benchmark={benchmark}
            setBenchmark={setBenchmark}
            countriesBelowBenchmark={countriesBelowBenchmark}
            totalGap={totalGap}
            globalTopRegions={globalTopRegions}
            handleCountryClick={handleCountryClick}
            getMapColor={getMapColor}
            aiQuery={aiQuery}
            setAiQuery={setAiQuery}
            aiResponse={aiResponse}
            setAiResponse={setAiResponse}
            aiLoading={aiLoading}
            askAiInline={askAiInline}
            askWhoAbout={askWhoAbout}
        />
    );
}
