import {
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { useEffect, useState } from "react";
import type { EsparComparisonResponse, EsparSummaryResponse } from "@/pages/ihr/types/espar";
import { espar } from "@/pages/ihr/services/espar";
import { useToast } from "@/contexts/ToastProvider";
import Dropdown from "@/components/usables/Dropdown";
import { Updating } from "@/components/Updating";
import { useTheme } from "@/contexts/ThemeContext";


const CustomDot = (props: any) => {
  const { cx, cy, value, stroke } = props;

  return (
    <>
      <circle
        cx={cx}
        cy={cy}
        r={7}
        fill="white"
      />

      <circle
        cx={cx}
        cy={cy}
        r={5}
        fill={stroke}
      />

      <text
        x={cx}
        y={cy - 12}
        textAnchor="middle"
        fontSize={12}
        fill={stroke}
      >
        {value}
      </text>
    </>
  );
};

const rgbaToHex = (rgba: number[]) => {
  if (!rgba || rgba.length < 3) return '#6b7280';
  const r = rgba[0].toString(16).padStart(2, '0');
  const g = rgba[1].toString(16).padStart(2, '0');
  const b = rgba[2].toString(16).padStart(2, '0');
  return `#${r}${g}${b}`;
};

interface LegendItem {
  label: string;
  bg: string;
  min: number;
  max: number;
}


const WrappedTick = ({ x, y, payload }: any) => {
  if (x === undefined || y === undefined) return null; // safety check

  const words = payload.value.split(" ");

  return (
    <text
      x={x}
      y={y}
      textAnchor="middle"
      fontSize={12}
      fill="#94a3b8"
    >
      {words.map((word: string, index: number) => (
        <tspan
          key={index}
          x={x}
          dy={index === 0 ? 0 : 14}
        >
          {word}
        </tspan>
      ))}
    </text>
  );
};


const COLORS = ["#6366f1", "#06b6d4", "#f97316", "#10b981"]
interface CountryComparisonProp {
  countries: string[];
  years: string[];
  capacity_summary: EsparSummaryResponse["data"]["capacity_summary"];
}
interface SelectedCountry {
  country: string;
  year: number | string;
}

export function CountryComparison({ countries, years }: CountryComparisonProp) {
  const { showToast } = useToast();
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<EsparComparisonResponse["data"]>();

  const [selectedCountries, setSelectedCountries] = useState<SelectedCountry[]>([
    { country: "Nigeria", year: 2025 },
    { country: "Kenya", year: 2025 },
    { country: "Cameroon", year: 2025 },
    { country: "South Africa", year: 2025 },
  ]);

  const c1 = selectedCountries[0].country;
  const c2 = selectedCountries[1].country;
  const c3 = selectedCountries[2].country;
  const c4 = selectedCountries[3].country;

  const handleCountryChange = (index: number, country: string) => {
    const newSelected = [...selectedCountries];
    newSelected[index].country = country;
    setSelectedCountries(newSelected);
  };

  const handleYearChange = (index: number, year: string) => {
    const newSelected = [...selectedCountries];
    newSelected[index].year = year;
    setSelectedCountries(newSelected);
  };

  useEffect(() => {
    const loadEsparSummary = async () => {
      try {
        setLoading(true);
        const response = await espar.comparison(selectedCountries);
        setData(response.data);
      } catch (error: any) {
        showToast(error?.message || "An error occurred while retrieving data", "error", 5000);
      } finally {
        setLoading(false);
      }
    };
    loadEsparSummary();
  }, [selectedCountries]);

  const categories = data?.categories || [];
  const countryScores = data?.country_scores || {};

  const chartData = categories.map((cat: string | number) => ({
    category: cat,
    [c1]: countryScores[c1]?.[cat] ?? 0,
    [c2]: countryScores[c2]?.[cat] ?? 0,
    [c3]: countryScores[c3]?.[cat] ?? 0,
    [c4]: countryScores[c4]?.[cat] ?? 0,
  }));

  return (
    <div className={`p-6 min-h-screen ${isLight ? 'text-[#1a1a1a]' : 'text-white'}`}>
      <div className="flex items-center gap-4">
        <h2 className="text-xl font-bold mb-1">Country Comparison</h2>
        {loading && <Updating />}
      </div>
      <p className={`text-sm mb-6 ${isLight ? 'text-gray-600' : 'text-gray-400'}`}>Compare capacity scores across multiple countries</p>


      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="flex flex-col gap-2">
          <Dropdown flat={false} label="Country 1" value={c1} onChange={(val) => handleCountryChange(0, val)} items={countries} bgColor={isLight ? "#eff6ff" : "#0c7be910"} />
          <Dropdown flat={false} label="Year" value={String(selectedCountries[0].year)} onChange={(val) => handleYearChange(0, val)} items={years} bgColor={isLight ? "#eff6ff" : "#0c7be910"} />
        </div>
        <div className="flex flex-col gap-2">
          <Dropdown flat={false} label="Country 2" value={c2} onChange={(val) => handleCountryChange(1, val)} items={countries} bgColor={isLight ? "#eff6ff" : "#0c7be910"} />
          <Dropdown flat={false} label="Year" value={String(selectedCountries[1].year)} onChange={(val) => handleYearChange(1, val)} items={years} bgColor={isLight ? "#eff6ff" : "#0c7be910"} />
        </div>
        <div className="flex flex-col gap-2">
          <Dropdown flat={false} label="Country 3" value={c3} onChange={(val) => handleCountryChange(2, val)} items={countries} bgColor={isLight ? "#eff6ff" : "#0c7be910"} />
          <Dropdown flat={false} label="Year" value={String(selectedCountries[2].year)} onChange={(val) => handleYearChange(2, val)} items={years} bgColor={isLight ? "#eff6ff" : "#0c7be910"} />
        </div>
        <div className="flex flex-col gap-2">
          <Dropdown flat={false} label="Country 4" value={c4} onChange={(val) => handleCountryChange(3, val)} items={countries} bgColor={isLight ? "#eff6ff" : "#0c7be910"} />
          <Dropdown flat={false} label="Year" value={String(selectedCountries[3].year)} onChange={(val) => handleYearChange(3, val)} items={years} bgColor={isLight ? "#eff6ff" : "#0c7be910"} />
        </div>
      </div>


      <div className={`rounded-xl shadow-lg ${isLight ? 'bg-white border border-gray-200' : 'bg-white/[0.02] backdrop-blur-md border border-white/10'}`}>
        <div className="w-full h-[500px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#4b5563" />
              <XAxis dataKey="category" stroke="#94a3b8" interval={0} height={70} tick={<WrappedTick />} />
              <YAxis stroke="#94a3b8" />
              <Tooltip
                contentStyle={{ backgroundColor: "#0f172a", borderRadius: "6px" }}
                labelStyle={{ color: "white" }}
              />
              {[c1, c2, c3, c4].map((country, index) => (
                <Line
                  key={country}
                  type="monotone"
                  dataKey={country}
                  name={country}
                  stroke={COLORS[index]}
                  strokeWidth={1}
                  dot={<CustomDot stroke={COLORS[index]} />}
                />
              ))}
              <Legend verticalAlign="bottom" align="center" wrapperStyle={{ paddingTop: 50 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}



export default CountryComparison;
