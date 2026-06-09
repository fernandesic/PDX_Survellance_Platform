import type { Feature, FeatureCollection } from "geojson";
import Dropdown from "@/components/usables/Dropdown";
import { SimpleArcGISMap } from "@/components/maps/SimpleArcGISMap";
import NewsTicker from "@/components/usables/NewsTicker";
import LiveFeedWatchlist from "@/components/usables/LiveFeedWatchlist";
import AnalyticsDashboard from "./components/AnalyticsDashboard";
import IncidentTimeline from "./components/IncidentTimeline";
import HazardCalendarTable from "./components/HazardCalendarTable";
import { Loading } from "@/components/Loading";
import { Updating } from "@/components/Updating";
import starOfflineData from "@/data/star_offline_data.json";
import type {
  StardataSummaryResponse,
  StardataMapResponse,
  StardataMapCountry,
} from "@/pages/stardata/types/stardata";

interface MapFeatureStyle {
  fillColor: string;
  fillOpacity?: number;
}

interface MarkerStyle {
  color?: string;
  radius?: number;
  fillOpacity?: number;
}

interface StarDataViewProps {
  isLight: boolean;
  hazard: string;
  setHazard: (v: string) => void;
  hazardType: string;
  setHazardType: (v: string) => void;
  severity: string;
  setSeverity: (v: string) => void;
  loading: boolean;
  mapLoading: boolean;
  summaryData: StardataSummaryResponse["data"] | undefined;
  mapData: StardataMapResponse["data"] | undefined;
  geoData: FeatureCollection | null;
  selectedCountry: StardataMapCountry | null;
  setSelectedCountry: (v: StardataMapCountry | null) => void;
  currentMonth: string;
  setCurrentMonth: (v: string) => void;
  isPlaying: boolean;
  setIsPlaying: (v: boolean) => void;
  MONTHS: string[];
  MONTH_NAMES: Record<string, string>;
  getCountryStyle: (feature: Feature) => MapFeatureStyle;
  getMarkerStyle: (feature: Feature) => MarkerStyle;
}

export default function StarDataView({
  isLight,
  hazard,
  setHazard,
  hazardType,
  setHazardType,
  severity,
  setSeverity,
  loading,
  mapLoading,
  summaryData,
  mapData,
  geoData,
  selectedCountry,
  setSelectedCountry,
  currentMonth,
  setCurrentMonth,
  isPlaying,
  setIsPlaying,
  MONTHS,
  MONTH_NAMES,
  getCountryStyle,
  getMarkerStyle
}: StarDataViewProps) {
  if (loading && !summaryData) return <Loading />;

  return (
    <div className={`w-full ${isLight ? 'text-[#1a1a1a]' : 'text-white'}`}>
      <section className="flex flex-row gap-3 justify-stretch mt-4">
        <section className="grow space-y-6">
          <div>
            <div className="flex gap-1 items-center">
              <h1 className="text-2xl font-semibold">STAR Activity Tracker</h1>
              {loading && <Updating />}
            </div>
            <p className={`text-sm ${isLight ? 'text-gray-600' : 'text-gray-400'}`}>
              Situation, Task, Action, Result – Incident Management
            </p>
          </div>

          <div className={`p-4 rounded-md grid grid-cols-1 md:grid-cols-3 gap-4 ${isLight ? 'bg-gray-100' : 'bg-[#1B0835]'}`}>
            <Dropdown
              label="Hazards"
              showLabel={false}
              value={hazard}
              onChange={setHazard}
              items={summaryData?.filters.hazards ?? []}
              bgColor={isLight ? "#eff6ff" : "#130722"}
            />
            <Dropdown
              label="Hazard Type"
              showLabel={false}
              value={hazardType}
              onChange={setHazardType}
              items={summaryData?.filters.hazard_types ?? []}
              bgColor={isLight ? "#eff6ff" : "#130722"}
            />
            <Dropdown
              label="Severity"
              showLabel={false}
              value={severity}
              onChange={setSeverity}
              items={summaryData?.filters.severities ?? []}
              bgColor={isLight ? "#eff6ff" : "#130722"}
            />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label={`Incidents in ${MONTH_NAMES[currentMonth]}`} value={summaryData?.incident.total ?? 0} isLight={isLight} />
            <StatCard label="Active" value={summaryData?.incident.active ?? 0} highlight isLight={isLight} />
            <StatCard label="Affected Countries" value={summaryData?.incident.affected_country ?? 0} isLight={isLight} />
          </div>

          <div>
            <div className="flex gap-2 items-center mb-1">
              <h2 className="text-lg font-semibold">Hazards Map</h2>
              {mapLoading && <Updating />}
            </div>
            <p className={`text-sm mb-3 ${isLight ? 'text-gray-600' : 'text-gray-400'}`}>
              Countries with {severity ? severity : 'all severity'} hazards for {MONTH_NAMES[currentMonth]} • {summaryData?.incident?.affected_country || 0} countries
            </p>

            <div className={`relative h-[500px] rounded-xl overflow-hidden border ${isLight ? 'border-gray-200' : 'border-gray-800'}`}>
              {geoData && mapData && (
                <SimpleArcGISMap
                  key={`${currentMonth}-${hazard}-${hazardType}-${severity}`}
                  geoData={geoData}
                  getCountryStyle={getCountryStyle}
                  getMarkerStyle={getMarkerStyle}
                  onCountryClick={(attrs: { name?: string }) => {
                    const countryData = mapData?.countries?.find((c: StardataMapCountry) => c.country.toLowerCase() === (attrs?.name || "").toLowerCase());
                    if (countryData) setSelectedCountry(countryData);
                  }}
                  isLight={true}
                  mapKey={JSON.stringify((mapData?.countries || []).map((c: StardataMapCountry) => (c.country || '') + (c.severity || '')).sort())}
                />
              )}

              <div className={`absolute bottom-4 left-4 p-4 rounded-lg text-sm ${isLight ? 'bg-white/80 text-gray-900 border border-gray-100 shadow-sm' : 'bg-black/60 text-white backdrop-blur-sm'}`}>
                <p className="font-bold mb-2">Severity</p>
                <LegendItem color="bg-green-500" label="Low" />
                <LegendItem color="bg-yellow-500" label="Moderate" />
                <LegendItem color="bg-orange-500" label="High" />
                <LegendItem color="bg-red-600" label="Very High" />
              </div>

              <div className="absolute top-4 left-4 z-[500] flex flex-col gap-2">
                <div className="bg-gradient-to-r from-blue-600/90 to-cyan-500/90 text-white px-4 py-2 rounded-lg shadow-lg">
                  <p className="text-xs opacity-80">Showing STAR data for</p>
                  <p className="text-xl font-bold">{MONTH_NAMES[currentMonth]}</p>
                </div>
              </div>

              <div className="absolute bottom-16 left-1/2 transform -translate-x-1/2 z-[500] flex gap-1 bg-black/40 p-2 rounded-lg backdrop-blur-sm">
                {MONTHS.map((month) => (
                  <button
                    key={month}
                    onClick={() => { setCurrentMonth(month); setIsPlaying(false); }}
                    className={`px-2 py-1 text-xs rounded transition-all duration-300 ${currentMonth === month
                      ? 'bg-cyan-500 text-white scale-110 shadow-lg font-bold'
                      : 'bg-black/40 text-white/70 hover:bg-black/60'
                      }`}
                  >
                    {month.charAt(0).toUpperCase() + month.slice(1, 3)}
                  </button>
                ))}
              </div>

              {selectedCountry && (
                <div className="absolute bottom-4 right-4 bg-[#0d1b2adc] p-4 rounded-lg text-sm backdrop-blur-sm max-w-[250px] text-white">
                  <div className="flex justify-between items-start mb-2">
                    <p className="font-bold text-lg">{selectedCountry.country}</p>
                    <button
                      onClick={() => setSelectedCountry(null)}
                      className="text-gray-400 hover:text-white"
                    >×</button>
                  </div>
                  <p className="text-sm">
                    <strong>Severity: </strong>
                    <span className={selectedCountry.severity === 'Very High' ? 'text-red-500 font-bold' : 'text-yellow-500 font-semibold'}>
                      {selectedCountry.severity}
                    </span>
                  </p>
                  <p className="text-sm"><strong>Hazards:</strong> {selectedCountry.hazard_count}</p>
                  <p className="text-sm"><strong>Month:</strong> {selectedCountry.month}</p>
                  {selectedCountry.hazards?.length > 0 && (
                    <div className="mt-2 border-t border-white/20 pt-2">
                      <p className="text-xs font-semibold">Active Hazards:</p>
                      <ul className="text-xs list-disc list-inside">
                        {selectedCountry.hazards.slice(0, 3).map((h: { name: string; severity: string }, i: number) => (
                          <li key={i}>{h.name}</li>
                        ))}
                        {selectedCountry.hazards.length > 3 && (
                          <li>+{selectedCountry.hazards.length - 3} more</li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              )}
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
        <AnalyticsDashboard currentMonth={currentMonth} />
      </div>

      <div className="mt-8">
        <IncidentTimeline currentMonth={currentMonth} />
      </div>

      <div className="mt-8 mb-12">
        <HazardCalendarTable
          data={starOfflineData.raw as unknown as Parameters<typeof HazardCalendarTable>[0]["data"]}
          activeMonth={currentMonth}
          onMonthClick={(m: string) => setCurrentMonth(m)}
        />
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  highlight = false,
  isLight,
}: {
  label: string;
  value: string | number;
  highlight?: boolean;
  isLight: boolean;
}) {
  return (
    <div
      className={`p-4 rounded-xl ${isLight ? 'bg-blue-50 border border-blue-200' : 'bg-[#1B0835]'}`}
    >
      <p className={`text-xs ${isLight ? 'text-gray-600' : 'text-gray-400'}`}>{label}</p>
      <h3 className={`text-2xl font-semibold mt-1 ${highlight && 'text-[#EF4343]'}`}>{value}</h3>
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2 mb-1">
      <span className={`w-3 h-3 rounded-full ${color}`} />
      <span className="font-medium">{label}</span>
    </div>
  );
}
