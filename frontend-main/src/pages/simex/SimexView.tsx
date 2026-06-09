import { ResponsiveContainer, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Bar } from "recharts";
import { useTheme } from "@/contexts/ThemeContext";
import { SIMEX_DATA } from "./data/simexData";
import { SimexOverview } from "./components/SimexOverview";

export default function SimexView() {
  const { theme } = useTheme();
  const isLight = theme === 'light';

  const chartData = SIMEX_DATA.map(d => ({
    category: d.category,
    conducted: d.conducted_afro,
  }));

  return (
    <div className="p-6 space-y-12">
      <SimexOverview data={SIMEX_DATA} />

      <div className={`rounded-xl ${isLight ? 'bg-gray-100' : 'bg-black/20'}`}>
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={chartData} margin={{ top: 20, right: 20, left: 20, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={isLight ? "#d1d5db" : "#ef444483"} />
            <XAxis dataKey="category" tick={{ fill: isLight ? "#374151" : "#fff", fontSize: 12 }} />
            <YAxis tick={{ fill: isLight ? "#374151" : "#fff", fontSize: 12 }} />
            <Tooltip
              cursor={{ fill: "rgba(255,255,255,0.05)" }}
              contentStyle={{
                backgroundColor: isLight ? "#ffffff" : "#000000",
                border: isLight ? "1px solid #d1d5db" : "1px solid #eab308",
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
            <Bar dataKey="conducted" fill="#eab308" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
