import { CountryIHRPage } from "@/pages/ihmref/components/CountryIHRPage";
import { Loading } from "@/components/Loading";
import { Updating } from "@/components/Updating";
import Dropdown from "@/components/usables/Dropdown";
import { useToast } from "@/contexts/ToastProvider";
import { ihmref } from "@/pages/ihmref/services/ihmref";
import {
  type IhmrefCountryIncident,
  type IhmrefCategory,
  type IhmrefData,
  type IhmrefDataSummary,
  CATEGORY_LABELS,
} from "@/pages/ihmref/types/ihmref";
import { useEffect, useMemo, useState } from "react";
import { useTenant } from "@/hooks/useTenant";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useTheme } from "@/contexts/ThemeContext";

export default function IhmRef() {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const { showToast } = useToast();
  const [categories, setCategories] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState<IhmrefCategory>(
    "simulation_exercise",
  );
  const [years, setYears] = useState<string[]>(["2016"]);
  const [year, setYear] = useState<string>("2016");
  const [data, setData] = useState<IhmrefData[]>([]);
  const [dataForChart, setDataForChart] = useState<IhmrefData[]>([]);
  const [totalSummary, setTotalSummaryData] = useState<IhmrefDataSummary[]>([]);
  const [summary, setSummaryData] = useState<IhmrefDataSummary>();

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const category_res = await ihmref.categories();
        setCategories(category_res.data.category);
        const summary_res = await ihmref.summary();
        setTotalSummaryData(summary_res);
      } catch (error: any) {
        // showToast(error?.message || "An Error ocurred while pipeline data", "error", 5000);
      } finally {
        // setLoading(false)
      }
    };
    load();
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const summary_res = await ihmref.category_summary(activeCategory);
        setSummaryData(summary_res.data.data);
        setYears(summary_res.data.years);
        const data_res = await ihmref.data(activeCategory, year);
        setData(data_res);
        // showToast(response.message, "success", 5000);
      } catch (error: any) {
        showToast(
          error?.message || "An Error ocurred while loading data",
          "error",
          5000,
        );
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [activeCategory, year]);

  useEffect(() => {
    const load = async () => {
      try {
        const data_for_chart_res = await ihmref.data(activeCategory, "");
        setDataForChart(data_for_chart_res);
        // showToast(response.message, "success", 5000);
      } catch (error: any) {
        showToast(
          error?.message || "An Error ocurred while loading data",
          "error",
          5000,
        );
      } finally {
      }
    };
    load();
  }, [activeCategory]);

  const { isSuperAdmin, tenant } = useTenant();
  const initialIhmrefCountry = isSuperAdmin ? 'Nigeria' : (tenant?.name || 'Nigeria');

  const [ihmrefCountry, setIhmrefCountry] = useState<string[]>([]);
  const [selectedIhmrefCountry, setSelectedIhmrefCountry] = useState(initialIhmrefCountry);
  useEffect(() => {
    const load = async () => {
      try {
        const countries_res = await ihmref.countries();
        setIhmrefCountry(countries_res.data.countries);
      } catch (error) { }
    };
    load();
  }, []);

  const [countryIncident, setCountryIncident] =
    useState<IhmrefCountryIncident[]>();
  const [loadingIncident, setLoadingIncident] = useState(false);
  useEffect(() => {
    const load = async () => {
      try {
        setLoadingIncident(true);
        const incident_res = await ihmref.country_incident(
          selectedIhmrefCountry,
        );
        setCountryIncident(incident_res);
      } catch (error) {
      } finally {
        setLoadingIncident(false);
      }
    };
    load();
  }, [selectedIhmrefCountry]);

  if (loading && data.length < 0) return <Loading />;

  return (
    <div className={`p-6 ${isLight ? 'text-[#1a1a1a]' : 'text-white'}`}>
      <div className={isLight ? 'text-[#1a1a1a] mb-10' : 'text-white mb-10'}>
        <h1 className="text-2xl font-bold">IHMREF Overview</h1>
        <p className={`text-sm ${isLight ? 'text-gray-600' : 'text-neutral-300'}`}>
          Detailed Ihmref distribution and analysis visualization
        </p>
      </div>

      <div className={`flex flex-wrap mb-6 gap-2 ${isLight ? 'text-gray-700' : 'text-[#420505]'}`}>
        {categories.map((t) => (
          <button
            key={t}
            onClick={() => {
              setActiveCategory(t as IhmrefCategory);
            }}
            className={`px-4 py-2 text-sm font-medium rounded-md ${activeCategory === t
              ? "bg-red-500 text-white"
              : isLight
                ? "bg-gray-100 hover:bg-gray-200 text-gray-700"
                : "bg-black/30 hover:bg-yellow-900/40 text-gray-300"
              }`}
          >
            {CATEGORY_LABELS[t]}
          </button>
        ))}
      </div>

      {/* Summary Card */}
      <div className={`border rounded-lg p-2 mb-6 flex gap-2 justify-between ${isLight ? 'bg-red-50 border-red-300' : 'bg-red-500/20 border-red-500'}`}>
        <div className={`grow p-2 rounded-md ${isLight ? 'bg-white' : 'bg-black/30'}`}>
          <p className={`text-sm ${isLight ? 'text-gray-700' : 'text-white'}`}>Total AFR</p>
          <p className="text-xl font-semibold">{summary?.afro ?? 0}</p>
        </div>
        <div className={`grow p-2 rounded-md ${isLight ? 'bg-white' : 'bg-black/30'}`}>
          <p className={`text-sm ${isLight ? 'text-gray-700' : 'text-white'}`}>Total Global</p>
          <p className="text-xl font-semibold">{summary?.global_t ?? 0}</p>
        </div>
        <div className={`grow p-2 rounded-md ${isLight ? 'bg-white' : 'bg-black/30'}`}>
          <p className={`text-sm ${isLight ? 'text-gray-700' : 'text-white'}`}>Contribution (%)</p>
          <p className="text-xl font-semibold">{summary?.contribution ?? 0}</p>
        </div>
      </div>

      <div className="flex gap-3 items-center cursor-pointer mb-2">
        <div className="w-48">
          <Dropdown
            label="Year"
            showLabel={false}
            value={year}
            onChange={setYear}
            items={years}
            bgColor={isLight ? "#fee2e2" : "#ef4444"}
            allowEmptyDefault={false}
          />
        </div>
        {loading && (
          <div className="flex items-center">
            <Updating />
          </div>
        )}
      </div>

      {/* Yearly Breakdown */}
      <div className="space-y-4 mb-5">
        {data.map((item) => (
          <div
            key={item.year}
            className={`border rounded-lg p-4 ${isLight ? 'bg-red-50 border-red-300' : 'bg-red-500/10 border-red-500/30'}`}
          >
            {/* Year Details */}
            <div className="mt-2 space-y-2">
              <div>
                <p className="font-semibold text-xl">
                  {item.year} {CATEGORY_LABELS[activeCategory]} Record
                </p>
              </div>
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <p className={`text-sm ${isLight ? 'text-gray-600' : 'text-gray-300'}`}>AFRO</p>
                  <p className="text-lg font-bold">{item.afro}</p>
                </div>
                <div>
                  <p className={`text-sm ${isLight ? 'text-gray-600' : 'text-gray-300'}`}>Global</p>
                  <p className="text-lg font-bold">{item.global_t}</p>
                </div>
                <div>
                  <p className={`text-sm ${isLight ? 'text-gray-600' : 'text-gray-300'}`}>
                    Contribution by AFRO (%)
                  </p>
                  <p className="text-lg font-bold">{item.contribution}</p>
                </div>
                {item.no_of_african_countries !== undefined && (
                  <div>
                    <p className={`text-sm ${isLight ? 'text-gray-600' : 'text-gray-300'}`}>
                      NO African Countries
                    </p>
                    <p className="text-lg font-bold">
                      {item.no_of_african_countries}
                    </p>
                  </div>
                )}
              </div>

              {/* Countries Involved */}
              {item.african_countries_involved && (
                <div className="mt-2">
                  <p className={`text-sm mb-1 ${isLight ? 'text-gray-700' : 'text-gray-200'}`}>
                    African Countries Involved:
                  </p>
                  <div className="p-2 rounded-md  flex flex-row flex-wrap gap-3">
                    {item.african_countries_involved
                      .split(", ")
                      .map((c: string, idx: number) => (
                        <div
                          key={idx}
                          className="flex flex-row gap-1 items-center"
                        >
                          <p className="bg-red-500 p-1 text-xs text-center text-white">
                            {idx + 1}
                          </p>
                          <p className={`text-xs p-1 ${isLight ? 'text-gray-700 bg-gray-100' : 'text-gray-300 bg-black/20'}`}>
                            {c}
                          </p>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="my-5">
        <IHRMEFComparisonCharts
          data={dataForChart}
          summary={totalSummary}
          years={years}
          category={activeCategory}
        />
      </div>

      {isSuperAdmin && (
        <div className="flex flex-row items-center gap-3 mb-5">
          <Dropdown
            label="Country"
            showLabel={false}
            value={selectedIhmrefCountry}
            onChange={setSelectedIhmrefCountry}
            items={ihmrefCountry}
            bgColor="#991b1b"
            allowEmptyDefault={false}
          />
        </div>
      )}

      <div className={`space-y-12 p-4 rounded-md ${isLight ? 'bg-red-50' : 'bg-red-800/50'}`}>
        {/* Page header */}
        <div>
          <div className="flex flex-row gap-3">
            <p className={`text-xl font-bold ${isLight ? 'text-gray-900' : 'text-gray-100'}`}>
              {selectedIhmrefCountry} — IHMREF Engagement
            </p>
            {loadingIncident && (
              <div className="flex items-center">
                <Updating />
              </div>
            )}
          </div>
          <p className={`text-sm ${isLight ? 'text-gray-600' : 'text-gray-300'}`}>
            Overview of IHMREF-related activities and timelines
          </p>
        </div>

        {/* Main dashboard */}
        <CountryIHRPage incidents={countryIncident ?? []} />
      </div>

      {loading && (
        <div className="flex items-center mb-5">
          <Updating />
        </div>
      )}
    </div>
  );
}

function getTotalComparisonData(summary: IhmrefDataSummary[]) {
  return summary.map((item) => ({
    category: CATEGORY_LABELS[item.category],
    AFRO: item.afro,
    Global: item.global_t,
    Contribution: Number(item.contribution),
  }));
}

function getYearComparisonData(data: IhmrefData[], category: IhmrefCategory) {
  return data
    .filter((d) => d.category === category)
    .map((d) => ({
      year: d.year,
      AFRO: d.afro,
      Global: d.global_t,
      Contribution: Number(d.contribution),
    }));
}

interface Props {
  data: IhmrefData[];
  summary: IhmrefDataSummary[];
  years: string[];
  category: IhmrefCategory;
}

export function IHRMEFComparisonCharts({
  data,
  summary,
  years,
  category,
}: Props) {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const [year, setYear] = useState(years[0]);

  const chart1 = useMemo(
    () => getYearComparisonData(data, category),
    [data, category],
  );

  const chart3 = useMemo(() => getTotalComparisonData(summary), [summary]);

  return (
    <div className={`space-y-5 ${isLight ? 'text-[#1a1a1a] border-red-300' : 'text-white border-[#560d0d]'}`}>
      {/* Chart 1 */}
      <Section title={`Yearly Comparison — ${CATEGORY_LABELS[category]}`}>
        <BarBlock data={chart1} />
      </Section>

      {/* Chart 2 */}
      <Section title="Total Comparison — All Categories">
        <BarBlock data={chart3} xKey="category" />
      </Section>
    </div>
  );
}

/* ---------------- Small Reusable Components ---------------- */

function Section({ title, children }: any) {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  return (
    <section>
      <h2 className={`text-lg font-semibold mb-4 ${isLight ? 'text-gray-900' : 'text-gray-100'}`}>{title}</h2>
      {children}
    </section>
  );
}

function BarBlock({ data, xKey = "year" }: { data: any[]; xKey?: string }) {
  const { theme } = useTheme();
  const isLight = theme === 'light';

  return (
    <ResponsiveContainer width="100%" height={310}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke={isLight ? "#d1d5db" : "#ef444483"} />
        <XAxis tick={{ fill: isLight ? "#374151" : "#fff", fontSize: 12 }} dataKey={xKey} />
        <YAxis tick={{ fill: isLight ? "#374151" : "#fff", fontSize: 12 }} />
        <Tooltip
          cursor={false}
          contentStyle={{
            backgroundColor: isLight ? "#ffffff" : "#560d0d",
            border: isLight ? "1px solid #d1d5db" : "1px solid #ef4444",
            borderRadius: 8,
          }}
          labelStyle={{
            color: isLight ? "#1a1a1a" : "#fff",
            fontSize: 12,
          }}
          itemStyle={{
            color: isLight ? "#1a1a1a" : "#fff",
            fontSize: 12,
          }}
        />
        <Legend
          wrapperStyle={{
            fontSize: 12,
            // color: "#E5E7EB",
          }}
        />
        <Bar dataKey="AFRO" fill="#1f7a63" />
        <Bar dataKey="Global" fill="#2f6fa3" />
        <Bar dataKey="Contribution" fill="#c9a227" />
      </BarChart>
    </ResponsiveContainer>
  );
}
