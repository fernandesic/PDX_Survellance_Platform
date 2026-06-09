import { motion } from 'framer-motion';
import {
    Loader2, AlertCircle, RefreshCcw, Brain,
    Shield, TrendingUp, Flag
} from 'lucide-react';
import DisclaimerBanner from './components/DisclaimerBanner';
import TopRiskAlerts from './components/TopRiskAlerts';
import TrendCharts from './components/TrendCharts';
import ModelConfidence from './components/ModelConfidence';
import SourceAttribution from './components/SourceAttribution';
import RiskMap from './components/RiskMap';
import CountryForecastCharts from './components/CountryForecastCharts';
import InterventionPlanChart from './components/InterventionPlanChart';
import ScenariosSection from './scenarios/ScenariosSection';
import { useTenant } from '@/hooks/useTenant';

function KPICard({
    icon: Icon, label, value, subtext, color,
}: {
    icon: typeof Shield;
    label: string;
    value: string | number;
    subtext?: string;
    color: string;
}) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-4 flex items-start gap-3"
        >
            <div
                className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: `${color}15` }}
            >
                <Icon size={18} style={{ color }} />
            </div>
            <div className="min-w-0">
                <p className="text-xs text-gray-400">{label}</p>
                <p className="text-xl font-bold text-white mt-0.5">{value}</p>
                {subtext && <p className="text-[11px] text-gray-500 mt-0.5">{subtext}</p>}
            </div>
        </motion.div>
    );
}

export function PredictionsView({
    summary,
    topRisks,
    riskMapData,
    trendData,
    predictionModels,
    loading,
    error,
    selectedCountry,
    selectedDisease,
    timeHorizon,
    setSelectedCountry,
    setSelectedDisease,
    setTimeHorizon,
    refresh,
}: any) {
    const { isSuperAdmin, isoCode } = useTenant();

    // Determine which country forecasts to show.
    // Super admins (or continental): show all available (COD + MOZ).
    // Country tenants: show only their own country if forecast data exists.
    const FORECAST_COUNTRIES = [
        { iso: 'COD', name: 'DR Congo' },
        { iso: 'MOZ', name: 'Mozambique' },
    ];
    const forecastsToShow = isSuperAdmin
        ? FORECAST_COUNTRIES
        : FORECAST_COUNTRIES.filter(c => c.iso === isoCode);
    if (loading && !summary) {
        return (
            <div className="flex items-center justify-center h-[60vh] text-gray-400">
                <Loader2 className="animate-spin mr-2" size={20} />
                Loading predictions…
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] text-gray-400">
                <AlertCircle size={32} className="text-red-400 mb-2" />
                <p className="text-sm">{error}</p>
                <button
                    onClick={refresh}
                    className="mt-3 px-4 py-1.5 rounded-lg bg-blue-500/20 text-blue-400 text-xs hover:bg-blue-500/30 transition-colors"
                >
                    Retry
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-4 p-4 max-w-[1600px] mx-auto">
            {/* Page Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 border border-purple-500/30 flex items-center justify-center">
                        <Brain size={20} className="text-purple-400" />
                    </div>
                    <div>
                        <h1 className="text-lg font-bold text-white">
                            Outbreak Risk Predictions
                        </h1>
                        <p className="text-xs text-gray-400">
                            AI/ML Composite Risk Intelligence · {summary?.total_predictions || 0} predictions
                        </p>
                    </div>
                </div>

                <button
                    onClick={refresh}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-gray-300 text-xs hover:bg-white/10 transition-colors"
                >
                    <RefreshCcw size={12} />
                    Refresh
                </button>
            </div>

            {/* Disclaimer */}
            <DisclaimerBanner />

            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KPICard
                    icon={Flag}
                    label="Countries at Risk"
                    value={summary?.countries_at_risk || 0}
                    subtext="HIGH or CRITICAL"
                    color="#ef4444"
                />
                <KPICard
                    icon={AlertCircle}
                    label="Critical Alerts"
                    value={summary?.critical_count || 0}
                    subtext={`+ ${summary?.high_count || 0} high`}
                    color="#f97316"
                />
                <KPICard
                    icon={Shield}
                    label="Avg. Confidence"
                    value={`${(summary?.avg_confidence || 0).toFixed(0)}%`}
                    subtext="Across all models"
                    color="#8b5cf6"
                />
                <KPICard
                    icon={TrendingUp}
                    label="Highest Risk"
                    value={summary?.highest_risk?.score?.toFixed(0) || '—'}
                    subtext={
                        summary?.highest_risk
                            ? `${summary.highest_risk.country} · ${summary.highest_risk.disease}`
                            : undefined
                    }
                    color="#ef4444"
                />
            </div>

            {/* Risk Map + Top Alerts */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                <div className="lg:col-span-3">
                    <RiskMap
                        data={riskMapData}
                        timeHorizon={timeHorizon}
                        onHorizonChange={setTimeHorizon}
                        onCountryClick={setSelectedCountry}
                        selectedCountry={selectedCountry}
                    />
                </div>
                <div className="lg:col-span-2">
                    <TopRiskAlerts
                        predictions={topRisks}
                        onRowClick={setSelectedCountry}
                    />
                </div>
            </div>

            {/* ── Scenario & Response Simulator ──────────────── */}
            <div className="border-t border-white/5 pt-6 mt-2">
                <ScenariosSection />
            </div>

            {/* Forecast Trends */}
            <TrendCharts
                data={trendData}
                selectedDisease={selectedDisease}
                onDiseaseChange={setSelectedDisease}
            />

            {/* Real ML Cholera Forecasts — tenant-aware */}
            {forecastsToShow.length > 0 && (
                <div className={`grid grid-cols-1 ${forecastsToShow.length > 1 ? 'md:grid-cols-2' : ''} gap-4`}>
                    {forecastsToShow.map(c => (
                        <CountryForecastCharts key={c.iso} countryIso={c.iso} countryName={c.name} />
                    ))}
                </div>
            )}

            {/* Executive Intervention Plans — tenant-aware */}
            {forecastsToShow.length > 0 && (
                <div className={`grid grid-cols-1 ${forecastsToShow.length > 1 ? 'md:grid-cols-2' : ''} gap-4`}>
                    {forecastsToShow.map(c => (
                        <InterventionPlanChart key={c.iso} countryIso={c.iso} countryName={c.name} />
                    ))}
                </div>
            )}

            {/* Confidence + Sources */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <ModelConfidence summary={summary} topRisks={topRisks} />
                <SourceAttribution models={predictionModels} />
            </div>

            {/* Footer */}
            <div className="text-center text-[11px] text-gray-600 pb-4">
                Last computed: {summary?.last_computed
                    ? new Date(summary.last_computed).toLocaleString()
                    : 'N/A'
                }
                {' · '}
                Data sources: STAR Tracker · Sentinel · IHR · Readiness
            </div>
        </div>
    );
}
