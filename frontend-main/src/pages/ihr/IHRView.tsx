import type { RefObject } from "react";
import {
    Radar,
    RadarChart,
    PolarGrid,
    PolarAngleAxis,
    PolarRadiusAxis,
    Legend,
    ResponsiveContainer,
} from "recharts";
import { Download } from "lucide-react";
import NewsTicker from "@/components/usables/NewsTicker";
import LiveFeedWatchlist from "@/components/usables/LiveFeedWatchlist";
import Dropdown from "@/components/usables/Dropdown";
import { Updating } from "@/components/Updating";
import CountryComparison from './components/CountryComparison';
import { ScoreCard, LegendDot, AllCapacitiesChart, MonthSlider, HumanitarianComparisonChart, AverageOfCapacitiesRegion } from './components/IHRCharts';

interface LegendItem {
    label: string;
    bg: string;
    min: number;
    max: number;
}

interface IHRViewProps {
    isLight: boolean;
    isSuperAdmin: boolean;
    country: string;
    setCountry: (v: string) => void;
    year: string;
    setYear: (v: string) => void;
    summaryData: any;
    loading: boolean;
    dynamicLegend: LegendItem[];
    getMapColor: (score: number) => { bg: string; label?: string };
    handleDownloadRadarPDF: () => void;
    radarChartRef: RefObject<HTMLDivElement | null>;
    scoreCardRef: RefObject<HTMLDivElement | null>;
    capacityScoresRef: RefObject<HTMLDivElement | null>;
    downloadButtonRef: RefObject<HTMLDivElement | null>;
}

export default function IHRView({
    isLight,
    isSuperAdmin,
    country,
    setCountry,
    year,
    setYear,
    summaryData,
    loading,
    dynamicLegend,
    getMapColor,
    handleDownloadRadarPDF,
    radarChartRef,
    scoreCardRef,
    capacityScoresRef,
    downloadButtonRef,
}: IHRViewProps) {
    return (
        <div className={isLight ? 'text-[#1a1a1a]' : 'text-white'}>
            <section className="flex flex-row gap-3 justify-stretch mt-4">
                <section className="grow">
                    <div className="flex flex-row items-center justify-between">

                        <div>
                            <div className="flex flex-row gap-2">
                                <h1 className="text-xl font-bold">IHR Monitoring</h1>
                                {loading && <Updating />}
                            </div>
                            <p className={`text-sm mb-6 ${isLight ? 'text-gray-600' : 'text-gray-200'}`}>
                                International Health Regulations - State Party Self-Assessment Annual
                                Reporting
                            </p>
                        </div>


                        <div ref={downloadButtonRef} className="flex gap-4 mb-6">
                            {isSuperAdmin && (
                                <Dropdown
                                    label="Country"
                                    value={country}
                                    onChange={setCountry}
                                    items={summaryData?.filters.countries ?? []}
                                    allowEmptyDefault={false}
                                    bgColor={isLight ? "#eff6ff" : "#0c7be910"}
                                />
                            )}

                            <Dropdown
                                label="Year"
                                value={year}
                                onChange={setYear}
                                items={summaryData?.filters.years ?? []}
                                bgColor={isLight ? "#eff6ff" : "#0c7be910"}
                            />

                            <button
                                onClick={handleDownloadRadarPDF}
                                className={`flex items-center gap-2 pr-4 py-2 ${isLight ? 'text-[#1a1a1a]' : 'text-white'}`}
                                title="Download Assessment PDF"
                            >
                                <Download className="w-5 h-5" />
                            </button>
                        </div>
                    </div>


                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                        <div ref={radarChartRef} className={`col-span-2 p-6 rounded-xl shadow-lg ${isLight ? 'bg-white border border-gray-200' : 'bg-white/[0.02] backdrop-blur-md border border-white/10'}`}>
                            <h2 className="text-lg font-semibold mb-1">
                                {summaryData?.capacity_summary.length ?? 0} Core Capacities Assessment
                            </h2>

                            <p className={`text-sm mb-6 ${isLight ? 'text-gray-600' : 'text-gray-400'}`}>
                                {country} - {year} Self-Assessment
                            </p>

                            <div className="w-full h-[420px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <RadarChart data={summaryData?.capacity_summary} outerRadius="80%">
                                        <PolarGrid stroke="#6b7280" />
                                        <PolarAngleAxis
                                            dataKey="category"
                                            tick={(props: any) => {
                                                const { x, y, payload } = props;
                                                const label = payload.value.split(' - ')[0] || payload.value;
                                                return (
                                                    <text x={x} y={y} fill="#aebaca" fontSize={12} textAnchor="middle">
                                                        {label}
                                                    </text>
                                                );
                                            }}
                                        />

                                        <PolarRadiusAxis
                                            angle={90}
                                            domain={[0, 100]}
                                            axisLine={false}
                                            tick={({ x, y, payload }) => {
                                                const colorInfo = getMapColor(payload.value);
                                                const fillColor = colorInfo.bg || "#64748b";

                                                return (
                                                    <text
                                                        x={x}
                                                        y={y}
                                                        fill={fillColor}
                                                        textAnchor="middle"
                                                        dominantBaseline="central"
                                                    >
                                                        {payload.value}%
                                                    </text>
                                                );
                                            }}
                                        />

                                        <Radar
                                            name="Capacity Score"
                                            dataKey="value"
                                            stroke="#3b82f6"
                                            fill="#3b82f6"
                                            fillOpacity={0.4}
                                        />


                                        <Legend />
                                    </RadarChart>
                                </ResponsiveContainer>
                            </div>


                            <div className="flex justify-center gap-6 mt-2 text-sm">
                                {dynamicLegend.length > 0 ? (
                                    dynamicLegend.map((item, idx) => (
                                        <LegendDot key={idx} color={item.bg} label={item.label} />
                                    ))
                                ) : (
                                    <>
                                        <LegendDot color="#22c55e" label="Strong (≥80)" />
                                        <LegendDot color="#eab308" label="Moderate (60–79)" />
                                        <LegendDot color="#ef4444" label="Weak (<60)" />
                                    </>
                                )}
                            </div>


                            <MonthSlider
                                years={summaryData?.filters.years ?? []}
                                selectedYear={year}
                                onYearChange={setYear}
                            />
                        </div>


                        <div className="flex flex-col gap-2">
                            <div ref={scoreCardRef}>
                                <ScoreCard score={summaryData?.overall.value ?? 0} change={summaryData?.overall.change ?? 0} prev_year={summaryData?.overall.prev_year ?? 0} capacities={summaryData?.capacity_summary ?? []} />
                            </div>


                            <div ref={capacityScoresRef} className={`p-6 rounded-xl shadow-lg ${isLight ? 'bg-white border border-gray-200' : 'bg-white/[0.02] backdrop-blur-md border border-white/10'}`}>
                                <h3 className="text-lg font-semibold mb-2">Capacity Scores</h3>
                                <p className={`text-xs mb-4 ${isLight ? 'text-gray-600' : 'text-gray-400'}`}>Average scores by core capacity (Percentage)</p>

                                <div className="space-y-2 max-h-[280px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-purple-600 scrollbar-track-transparent">
                                    {summaryData?.capacity_average_named &&
                                        Object.entries(summaryData.capacity_average_named).map(([name, value]) => {
                                            const percentage = Number(value);
                                            const colorInfo = getMapColor(percentage);
                                            const barColor = colorInfo.bg;
                                            const textColor = percentage >= 80 ? 'text-green-400' : percentage >= 60 ? 'text-yellow-400' : 'text-red-400';

                                            return (
                                                <div key={name} className="group">
                                                    <div className="flex justify-between items-start gap-2 mb-1">
                                                        <span className={`text-xs flex-1 leading-tight ${isLight ? 'text-gray-600' : 'text-gray-300'}`} title={name}>
                                                            {name}
                                                        </span>
                                                        <span className={`text-xs font-semibold ${textColor} whitespace-nowrap`}>
                                                            {percentage.toFixed(0)}%
                                                        </span>
                                                    </div>
                                                    <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full rounded-full transition-all duration-500 ease-out group-hover:opacity-80"
                                                            style={{
                                                                width: `${percentage}%`,
                                                                backgroundColor: barColor,
                                                            }}
                                                        />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                </div>


                                <div className="flex justify-center gap-4 mt-4 pt-3 border-t border-gray-700/50 text-xs">
                                    {dynamicLegend.length > 0 ? (
                                        dynamicLegend.map((item, idx) => (
                                            <LegendDot key={idx} color={item.bg} label={item.label} />
                                        ))
                                    ) : (
                                        <>
                                            <LegendDot color="#22c55e" label="Strong (≥80)" />
                                            <LegendDot color="#eab308" label="Moderate (60–79)" />
                                            <LegendDot color="#ef4444" label="Weak (<60)" />
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
                <aside className="w-[300px] flex-shrink-0 hidden xl:block">
                    <LiveFeedWatchlist />
                </aside>
            </section>
            <section className="mt-8">
                <NewsTicker />
            </section>
            <div className="mt-8">
                <AllCapacitiesChart
                    capacities={summaryData?.capacity_summary ?? []}
                    year={year}
                    country={country}
                    countries={summaryData?.filters.countries ?? []}
                    years={summaryData?.filters.years ?? []}
                    onCountryChange={setCountry}
                    onYearChange={setYear}
                />
            </div>


            <div className="mt-8 flex gap-6">

                <div className="w-[55%]">
                    <HumanitarianComparisonChart />
                </div>

                <div className="w-[45%]">
                    <AverageOfCapacitiesRegion
                        year={year}
                        capacities={summaryData?.capacity_summary ?? []}
                    />
                </div>
            </div>

            <div className="mt-8 rounded-lg overflow-hidden">
                <CountryComparison
                    years={summaryData?.filters.years ?? []}
                    countries={summaryData?.filters.countries ?? []}
                    capacity_summary={summaryData?.capacity_summary ?? []}
                />
            </div>
        </div>
    );
}
