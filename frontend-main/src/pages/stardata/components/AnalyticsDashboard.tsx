import { useToast } from "@/contexts/ToastProvider";
import { stardata } from "@/pages/stardata/services/stardata";
import type { StardataChartResponse, UpcomingHazardsResponse, ActiveHazardsResponse } from "@/pages/stardata/types/stardata";
import { useEffect, useState, useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import Dropdown from "@/components/usables/Dropdown";
import { Updating } from "@/components/Updating";
import { useTheme } from "@/contexts/ThemeContext";

const AFRO_COUNTRIES = [
  "Algeria", "Angola", "Benin", "Botswana", "Burkina Faso", "Burundi",
  "Cameroon", "Cape Verde", "Central African Republic", "Chad", "Comoros",
  "Congo", "Côte d'Ivoire", "Democratic Republic of the Congo", "Djibouti",
  "Egypt", "Equatorial Guinea", "Eritrea", "Ethiopia", "Gabon", "Gambia",
  "Ghana", "Guinea", "Guinea-Bissau", "Kenya", "Lesotho",
  "Liberia", "Libya", "Madagascar", "Malawi", "Mali", "Mauritania", "Mauritius",
  "Morocco", "Mozambique", "Namibia", "Niger", "Nigeria", "Rwanda",
  "Sao Tome and Principe", "Senegal", "Seychelles", "Sierra Leone", "Somalia",
  "South Africa", "South Sudan", "Sudan", "Swaziland", "Tanzania",
  "Togo", "Tunisia", "Uganda", "Zambia", "Zimbabwe", "eSwatini"
];

export default function AnalyticsDashboard({ currentMonth }: { currentMonth: string }) {
  const { showToast } = useToast();
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const [loading, setLoading] = useState(false)
  const [starChart, setStarChart] = useState<StardataChartResponse['data']>()
  const [upcomingHazards, setUpcomingHazards] = useState<UpcomingHazardsResponse['data']>()
  const [activeHazards, setActiveHazards] = useState<ActiveHazardsResponse['data']>()
  const [country, setCountry] = useState("Zambia"); const [selectedHazard, setSelectedHazard] = useState<any>(null);

  const sanitizeValue = (value: any) => {
    if (value === null || value === undefined || value === 'nan' || value === 'NaN' || isNaN(value)) {
      return 0;
    }
    return value;
  };

  useEffect(() => {
    const loadStarDataChart = async () => {
      try {
        setLoading(true)
        const [chartsResponse, hazardsResponse, activeResponse] = await Promise.all([
          stardata.charts(country, currentMonth),
          stardata.upcomingHazards(country, currentMonth),
          stardata.activeHazards(country, currentMonth)
        ]);
        setStarChart(chartsResponse.data)
        setUpcomingHazards(hazardsResponse.data)
        setActiveHazards(activeResponse.data)
      } catch (error: any) {
        showToast(error?.message || "An Error Ocurred while retrieving data", "error", 5000);
      } finally {
        setLoading(false)
      }
    }
    loadStarDataChart()
  }, [country, currentMonth])

  const frequencyCount = starChart?.hazard_frequency.reduce((acc, item) => {
    acc[item.value] = (acc[item.value] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const frequencychartData = Object.entries(frequencyCount || {}).map(
    ([name, value]) => ({
      name,
      value,
    })
  );

  const afroCountries = useMemo(() => {
    if (!starChart?.filters.countries) return [];
    return starChart.filters.countries.filter((country: string) =>
      AFRO_COUNTRIES.some(afroCountry =>
        country.toLowerCase().includes(afroCountry.toLowerCase()) ||
        afroCountry.toLowerCase().includes(country.toLowerCase())
      )
    );
  }, [starChart?.filters.countries]);

  return (
    <div>
      <div className="trading-header relative mb-6 mr-6 flex items-center gap-6 bg-transparent from-[#1e1f3e]/90 via-[#1f2147]/90 to-[#1e1f3e]/90 px-10 py-2 rounded-tl-full rounded-br-full
         border border-blue-500/20 shadow-[0_10px_40px_-10px_rgba(59,130,246,0.35)]">
        <div className="absolute inset-0 pointer-events-none" />
        <div className="flex items-center ml-6">
          <span className={`text-sm font-medium whitespace-nowrap ${isLight ? 'text-gray-700' : 'text-gray-300'}`}>Country</span>
        </div>
        <div className="relative min-w-[250px]">
          <div className="relative px-8">
            <Dropdown
              label="Country"
              showLabel={false}
              value={country}
              onChange={setCountry}
              items={afroCountries}
              bgColor={isLight ? "#eff6ff" : "transparent"}
              flat={false}
            />
            <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-60 blur-[1px]"></div>
            <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-blue-400 to-transparent"></div>
          </div>
        </div>

        {loading && <Updating />}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-white">
        <div className={`relative p-6 rounded-2xl shadow-lg ${isLight ? 'bg-white border border-gray-200' : 'bg-gradient-to-br from-[#1a1d3e]/80 to-[#1B0835]/90'}`}>
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/5 via-transparent to-transparent pointer-events-none"></div>
          {!isLight && (
            <>
              <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-gradient-to-b from-transparent via-[#00d4ff] to-transparent opacity-80 rounded-l-2xl"></div>
              <div className="absolute left-0 top-0 bottom-0 w-[6px] bg-gradient-to-b from-transparent via-[#00d4ff]/30 to-transparent blur-sm rounded-l-2xl"></div>
              <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#00d4ff] to-transparent opacity-80 rounded-b-2xl"></div>
              <div className="absolute bottom-0 left-0 right-0 h-[6px] bg-gradient-to-r from-transparent via-[#00d4ff]/30 to-transparent blur-sm rounded-b-2xl"></div>
            </>
          )}
          <h3 className={`text-xl font-bold mb-1 ${isLight ? 'text-[#1a1a1a]' : 'text-white'}`}>Hazard Frequency</h3>
          <p className={`text-sm mb-4 ${isLight ? 'text-gray-600' : 'text-gray-400'}`}>Distribution of incidents by hazard type</p>

          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={frequencychartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
              <XAxis
                dataKey="name"
                tick={{ fill: isLight ? "#4b5563" : "#9ca3af", fontSize: 13 }}
                axisLine={{ stroke: isLight ? "#d1d5db" : '#374151' }}
                tickLine={{ stroke: isLight ? "#d1d5db" : '#374151' }}
              />
              <YAxis
                tick={{ fill: isLight ? "#4b5563" : "#9ca3af", fontSize: 13 }}
                axisLine={{ stroke: isLight ? "#d1d5db" : '#374151' }}
                tickLine={{ stroke: isLight ? "#d1d5db" : '#374151' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: isLight ? '#ffffff' : '#1e293b',
                  border: isLight ? '1px solid #e5e7eb' : '1px solid #3b82f6',
                  borderRadius: '8px',
                  color: isLight ? '#1a1a1a' : '#fff'
                }}
              />
              <Bar
                dataKey="value"
                fill="url(#blueGradient)"
                radius={[6, 6, 0, 0]}
                maxBarSize={80}
              />
              <defs>
                <linearGradient id="blueGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#60a5fa" stopOpacity={1} />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.8} />
                </linearGradient>
              </defs>
            </BarChart>
          </ResponsiveContainer>

          <div className="flex items-center gap-4 mt-4 flex-wrap">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-sm bg-gradient-to-b from-[#60a5fa] to-[#3b82f6]"></div>
              <span className={`text-xs ${isLight ? 'text-gray-600' : 'text-gray-400'}`}>Perennial</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-sm bg-gradient-to-b from-[#60a5fa] to-[#3b82f6]"></div>
              <span className={`text-xs ${isLight ? 'text-gray-600' : 'text-gray-400'}`}>Random</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-sm bg-gradient-to-b from-[#60a5fa] to-[#3b82f6]"></div>
              <span className={`text-xs ${isLight ? 'text-gray-600' : 'text-gray-400'}`}>Frequent</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-sm bg-gradient-to-b from-[#60a5fa] to-[#3b82f6]"></div>
              <span className={`text-xs ${isLight ? 'text-gray-600' : 'text-gray-400'}`}>Rare</span>
            </div>
          </div>
        </div>

        <Card
          title="Upcoming High-Risk Hazards"
          subtitle={`High-risk hazards for ${upcomingHazards?.month1 || 'This Month'} & ${upcomingHazards?.month2 || 'Next Month'}`}
          isLight={isLight}
        >
          <div className="overflow-auto max-h-[250px] scrollbar-thin scrollbar-thumb-purple-600 scrollbar-track-purple-900/20">
            <table className="w-full text-sm">
              <thead className={`sticky top-0 ${isLight ? 'bg-blue-50' : 'bg-[#1B0835]'}`}>
                <tr className={`border-b ${isLight ? 'border-gray-200' : 'border-purple-800/50'}`}>
                  <th className={`text-left py-2 px-2 font-medium ${isLight ? 'text-gray-700' : 'text-gray-300'}`}>Hazard Type</th>
                  <th className={`text-center py-2 px-2 font-medium w-16 ${isLight ? 'text-gray-700' : 'text-gray-300'}`}>
                    {upcomingHazards?.month1_field?.slice(0, 3) || 'M1'}
                  </th>
                  <th className={`text-center py-2 px-2 font-medium w-16 ${isLight ? 'text-gray-700' : 'text-gray-300'}`}>
                    {upcomingHazards?.month2_field?.slice(0, 3) || 'M2'}
                  </th>
                </tr>
              </thead>
              <tbody>
                {upcomingHazards?.hazards && upcomingHazards.hazards.length > 0 ? (
                  upcomingHazards.hazards.map((hazard, index) => (
                    <tr
                      key={`${hazard.hazard}-${index}`}
                      className={`border-b transition-colors ${isLight ? 'border-gray-200 hover:bg-gray-50' : 'border-purple-800/20 hover:bg-purple-900/20'}`}
                    >
                      <td className={`py-2 px-2 text-xs ${isLight ? 'text-gray-800' : 'text-gray-200'}`}>
                        {hazard.hazard}
                        <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-300">
                          {hazard.severity}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-center">
                        {hazard.month1_value ? (
                          <span
                            className="inline-block w-8 h-6 rounded text-xs font-bold flex items-center justify-center"
                            style={{ backgroundColor: hazard.month1_color, color: '#fff' }}
                          >
                            {hazard.month1_value}
                          </span>
                        ) : (
                          <span className="text-gray-500">-</span>
                        )}
                      </td>
                      <td className="py-2 px-2 text-center">
                        {hazard.month2_value ? (
                          <span
                            className="inline-block w-8 h-6 rounded text-xs font-bold flex items-center justify-center"
                            style={{ backgroundColor: hazard.month2_color, color: '#fff' }}
                          >
                            {hazard.month2_value}
                          </span>
                        ) : (
                          <span className="text-gray-500">-</span>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className={`py-8 text-center ${isLight ? 'text-gray-500' : 'text-gray-400'}`}>
                      No high-risk hazards found for the upcoming months
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {upcomingHazards?.total_hazards && upcomingHazards.total_hazards > 0 && (
            <div className="mt-3 pt-2 border-t border-purple-800/30 flex items-center justify-between text-xs text-gray-400">
              <span>Total: {upcomingHazards.total_hazards} high-risk hazards</span>
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded" style={{ backgroundColor: '#22c55e' }}></span>
                  1
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded" style={{ backgroundColor: '#eab308' }}></span>
                  2
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded" style={{ backgroundColor: '#f97316' }}></span>
                  3
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded" style={{ backgroundColor: '#dc2626' }}></span>
                  4
                </span>
              </div>
            </div>
          )}
        </Card>
      </div>

      <div className={`relative p-6 rounded-2x1 shadow-lg mt-6 ${isLight ? 'bg-white border border-gray-200' : 'bg-gradient-to-br from-[#1a1d3e]/80 to-[#1B0835]/90'}`}>
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/5 via-transparent to-transparent pointer-events-none"></div>

        {!isLight && (
          <>
            <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-gradient-to-b from-transparent via-[#00d4ff] to-transparent opacity-80 rounded-l-2xl"></div>
            <div className="absolute left-0 top-0 bottom-0 w-[6px] bg-gradient-to-b from-transparent via-[#00d4ff]/30 to-transparent blur-sm rounded-l-2xl"></div>
            <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#ff006e] to-transparent opacity-80 rounded-b-2xl"></div>
            <div className="absolute bottom-0 left-0 right-0 h-[6px] bg-gradient-to-r from-transparent via-[#ff006e]/30 to-transparent blur-sm rounded-b-2xl"></div>
          </>
        )}

        <h3 className={`text-xl font-bold mb-1 ${isLight ? 'text-[#1a1a1a]' : 'text-white'}`}>{`Active Hazards - ${activeHazards?.current_month || 'December'}`}</h3>
        <p className={`text-sm mb-4 ${isLight ? 'text-gray-600' : 'text-gray-400'}`}>{`Currently active hazards in ${country}`}</p>

        {activeHazards?.hazards && activeHazards.hazards.length > 0 ? (
          <>
            <div className={`mb-4 flex items-center justify-between rounded-lg p-3 border ${isLight ? 'bg-gray-100 border-gray-300' : 'bg-gray-800/30 border-gray-700/50'}`}>
              <div className="flex items-center gap-4">
                <span className={`text-sm font-medium ${isLight ? 'text-gray-700' : 'text-gray-400'}`}>Legend:</span>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <div className="w-4 h-4 rounded-full bg-green-500"></div>
                    <span className={`text-xs ${isLight ? 'text-gray-700' : 'text-gray-300'}`}>Low (1)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-4 h-4 rounded-full bg-yellow-500"></div>
                    <span className={`text-xs ${isLight ? 'text-gray-700' : 'text-gray-300'}`}>Moderate (2)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-4 h-4 rounded-full bg-orange-500"></div>
                    <span className={`text-xs ${isLight ? 'text-gray-700' : 'text-gray-300'}`}>High (3)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-4 h-4 rounded-full bg-red-600"></div>
                    <span className={`text-xs ${isLight ? 'text-gray-700' : 'text-gray-300'}`}>Very High (4)</span>
                  </div>
                </div>
              </div>
              <div className={`text-xs italic ${isLight ? 'text-gray-600' : 'text-gray-400'}`}>
                💡 Click on cells for details
              </div>
            </div>

            <div className="grid grid-cols-12 gap-1.5 max-h-[400px] overflow-y-auto overflow-x-visible scrollbar-thin scrollbar-thumb-blue-600 scrollbar-track-blue-900/20 p-2">
              {activeHazards.hazards.map((hazard, index) => (
                <div
                  key={`heatmap-${index}`}
                  onClick={() => setSelectedHazard(hazard)}
                  className="group relative aspect-square rounded-md p-1.5 flex items-center justify-center text-center transition-all hover:scale-110 hover:z-10 cursor-pointer hover:ring-2 hover:ring-blue-400"
                  style={{ backgroundColor: hazard.severity_color + '25', border: `1.5px solid ${hazard.severity_color}60` }}
                >
                  <div
                    className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center text-white font-bold text-[9px]"
                    style={{ backgroundColor: hazard.severity_color }}
                  >
                    {sanitizeValue(hazard.month_value)}
                  </div>

                  <p className={`text-[8px] font-medium leading-tight px-0.5 ${isLight ? 'text-gray-900' : 'text-gray-200'}`}>
                    {hazard.hazard_type}
                  </p>
                </div>
              ))}
            </div>

            {activeHazards?.severity_counts && Object.keys(activeHazards.severity_counts).length > 0 && (
              <div className={`mt-5 pt-4 flex items-center justify-between ${isLight ? 'border-t border-gray-300' : 'border-t border-blue-800/30'}`}>
                <span className={`text-sm ${isLight ? 'text-gray-600' : 'text-gray-400'}`}>
                  Total: <span className={`font-semibold text-base ${isLight ? 'text-[#1a1a1a]' : 'text-white'}`}>{activeHazards.total_hazards}</span> hazards
                </span>
                <div className="flex items-center gap-3">
                  {Object.entries(activeHazards.severity_counts).map(([severity, count]) => (
                    <span
                      key={severity}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium"
                      style={{
                        backgroundColor: getSeverityColor(severity) + '30',
                        color: getSeverityColor(severity),
                        border: `1px solid ${getSeverityColor(severity)}50`
                      }}
                    >
                      <span className="font-bold">{count}</span> {severity}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className={`py-12 text-center ${isLight ? 'text-gray-500' : 'text-gray-400'}`}>
            No active hazards found for this month
          </div>
        )}
      </div>

      {selectedHazard && (
        <div className={`fixed inset-0 flex items-center justify-center z-50 ${isLight ? 'bg-black/40' : 'bg-black/70'}`} onClick={() => setSelectedHazard(null)}>
          <div className={`rounded-xl p-6 shadow-2xl max-w-md w-full mx-4 relative ${isLight ? 'bg-white border border-gray-300' : 'bg-[#1e293b] border-2 border-blue-500/40'}`} onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setSelectedHazard(null)}
              className={`absolute top-4 right-4 transition-colors ${isLight ? 'text-gray-600 hover:text-gray-900' : 'text-gray-400 hover:text-white'}`}
            >
              ✕
            </button>

            <h3 className={`font-bold text-xl mb-4 pr-8 ${isLight ? 'text-[#1a1a1a]' : 'text-white'}`}>{selectedHazard.hazard}</h3>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className={isLight ? 'text-gray-600' : 'text-gray-400'}>Risk Score:</span>
                <span className="font-bold text-2xl" style={{ color: selectedHazard.severity_color }}>
                  {sanitizeValue(selectedHazard.month_value)}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-gray-400">Severity:</span>
                <span className="font-semibold text-lg" style={{ color: selectedHazard.severity_color }}>
                  {selectedHazard.severity}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className={isLight ? 'text-gray-600' : 'text-gray-400'}>Type:</span>
                <span className={`font-medium ${isLight ? 'text-gray-900' : 'text-white'}`}>{selectedHazard.hazard_type}</span>
              </div>

              {selectedHazard.geographical_area && (
                <div className={`pt-3 ${isLight ? 'border-t border-gray-300' : 'border-t border-gray-700'}`}>
                  <span className={`block mb-2 ${isLight ? 'text-gray-600' : 'text-gray-400'}`}>📍 Location:</span>
                  <span className={`break-words ${isLight ? 'text-gray-900' : 'text-white'}`}>{selectedHazard.geographical_area}</span>
                </div>
              )}

              {selectedHazard.is_active && (
                <div className="pt-3">
                  <span className="inline-block bg-red-500/20 text-red-400 font-semibold uppercase text-sm px-3 py-1 rounded-full">
                    ● ACTIVE NOW
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

function getSeverityColor(severity: string): string {
  const colors: Record<string, string> = {
    'Low': '#22c55e',
    'Moderate': '#eab308',
    'High': '#f97316',
    'Very High': '#dc2626',
    'Very Low': '#22c55e',
    'Baixa': '#22c55e',
    'Moderada': '#eab308',
    'Elevada': '#f97316',
    'Muito elevada': '#dc2626',
  };
  return colors[severity] || '#94a3b8';
}

interface Prop {
  title: string;
  subtitle: string;
  children: any;
  isLight: boolean;
}
function Card({ title, subtitle, children, isLight }: Prop) {
  return (
    <div className={`p-4 rounded-xl shadow-md ${isLight ? 'bg-blue-50 border border-blue-200' : 'bg-[#1B0835]'}`}>
      <h3 className={`text-lg font-semibold mb-1 ${isLight ? 'text-[#1a1a1a]' : 'text-white'}`}>{title}</h3>
      <p className={`text-sm mb-4 ${isLight ? 'text-gray-600' : 'text-gray-400'}`}>{subtitle}</p>
      {children}
    </div>
  );
}
