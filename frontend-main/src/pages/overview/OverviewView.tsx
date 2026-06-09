import { MapSkeleton, BottomChartsSkeleton } from "@/components/usables/OverviewSkeleton";
import NewsTicker from "@/components/usables/NewsTicker";
import { Suspense, lazy } from "react";
import { LazyRVFChart } from "./components/LazyRVFChart";
import { KpiCards } from "./components/KpiCards";
import { CountrySummaryCharts } from "./components/CountrySummaryCharts";
import ActiveOutbreakBanner from "./components/ActiveOutbreakBanner";

const DashboardMap = lazy(() => import("@/components/usables/DashboardMap"));
const LiveFeedWatchlist = lazy(() => import("@/components/usables/LiveFeedWatchlist"));
const DualBarChart = lazy(() => import("@/components/usables/DualBarChart"));

interface OverviewViewProps {
    overviewData: any;
    isLight: boolean;
}

export default function OverviewView({ overviewData, isLight }: OverviewViewProps) {
    return (
        <div className="mt-4 pb-12">
            <section className="flex flex-row gap-3 justify-stretch relative">
                <section className="grow min-w-0 space-y-6 xl:mr-[292px]">
                    <ActiveOutbreakBanner isLight={isLight} />
                    <div className="w-full">
                        <KpiCards overviewData={overviewData} isLight={isLight} />
                    </div>

                    <div className="flex-1 min-h-0">
                        {!overviewData ? <MapSkeleton /> : (
                            <Suspense fallback={<MapSkeleton />}>
                                <DashboardMap
                                    chw={overviewData.chw}
                                    espar={overviewData.espar}
                                    readiness={overviewData.readiness}
                                    stardata={overviewData.stardata}
                                    chwRates={overviewData.chart.total_chw_and_population_2024}
                                />
                            </Suspense>
                        )}
                    </div>
                </section>
                <section className="w-[280px] flex-shrink-0 hidden xl:block absolute right-0 top-0 bottom-0">
                    <Suspense fallback={<div className="h-full w-full bg-white/[0.03] animate-pulse rounded-xl" />}>
                        <LiveFeedWatchlist overviewData={overviewData} hideCollapse />
                    </Suspense>
                </section>
            </section>

            <section className="mt-8">
                <NewsTicker />
            </section>

            <LazyRVFChart />

            {!overviewData ? <BottomChartsSkeleton /> : (
                <div className="w-full grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-5 gap-6 mt-6 px-4 items-stretch lg:h-[440px]">
                    <div className="xl:col-span-3 h-full">
                        <Suspense fallback={<div className="h-full w-full bg-white/[0.03] animate-pulse rounded-xl" />}>
                            <DualBarChart
                                data={overviewData.chart?.total_chw_and_population_2024 ?? []}
                                totalCHW={overviewData.chw?.total_chw ?? 0}
                            />
                        </Suspense>
                    </div>

                    <CountrySummaryCharts overviewData={overviewData} isLight={isLight} />
                </div>
            )}
        </div>
    );
}
