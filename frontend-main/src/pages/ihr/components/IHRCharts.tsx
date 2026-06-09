import {
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Bar,
  BarChart,
  Cell,
} from "recharts";
import { useEffect, useState, useRef } from "react";
import { Loader2, TrendingUp, Download } from "lucide-react";
import type { EsparSummaryResponse, HumanitarianComparisonResponse } from "../types/espar";
import { espar } from "@/pages/ihr/services/espar";
import { useToast } from "@/contexts/ToastProvider";
import { Updating } from "@/components/Updating";
import { useTheme } from "@/contexts/ThemeContext";


import Dropdown from '@/components/usables/Dropdown';

interface ScoreCardProps {
  score: number;
  change: number;
  prev_year: string | number;
  capacities: EsparSummaryResponse['data']['capacity_summary'];
}

function ScoreCard({ score, change, prev_year, capacities }: ScoreCardProps) {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  return (
    <div className={`p-6 rounded-xl shadow-lg ${isLight ? 'bg-white border border-gray-200' : 'bg-white/[0.02] backdrop-blur-md border border-white/10'}`}>

      <h3 className="text-lg font-semibold mb-2">Average IHR Score (Percentage)</h3>

      <p className="text-3xl font-bold">{score}%</p>

      <div className="flex items-center gap-2 mt-1">
        <TrendingUp className="text-green-500 w-4 h-4" />
        <p className="text-green-500 font-normal">{Number(change).toFixed(2)}% from {prev_year}</p>
      </div>

      <div className={`text-sm mt-4 space-y-1 ${isLight ? 'text-gray-600' : 'text-gray-300'}`}>
        <p className="flex justify-between">
          Capacities ≥80:{" "}
          <span className={`font-light ${isLight ? 'text-[#1a1a1a]' : 'text-white'}`}>{capacities.filter(item => Number(item.value) >= 80).length} of {capacities.length}</span>
        </p>
        <p className="flex justify-between">
          Capacities &lt;60:{" "}
          <span className="text-yellow-500 font-light">{capacities.filter(item => Number(item.value) < 60).length} of {capacities.length}</span>
        </p>
      </div>
    </div>
  );
}

interface LegendDotProps {
  color: string;
  label: string;
}

function LegendDot({ color, label }: LegendDotProps) {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  return (
    <div className="flex items-center gap-2">
      <span
        className="w-3 h-3 rounded-full inline-block"
        style={{ backgroundColor: color }}
      />
      <span className={isLight ? 'text-gray-600' : 'text-gray-300'}>{label}</span>
    </div>
  );
}
// New Component: All Capacities Bar Chart
interface AllCapacitiesChartProps {
  capacities: Array<{ category: string; value: string | number }>;
  year: string;
  country: string;
  countries: string[];
  years: string[];
  onCountryChange: (country: string) => void;
  onYearChange: (year: string) => void;
}

function AllCapacitiesChart({ capacities, year, country, countries, years, onCountryChange, onYearChange }: AllCapacitiesChartProps) {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const CAPACITY_NAMES = [
    'Policy, Legal and Advocacy',
    'IHR Coordination, National Focal Point Functions and Advocacy',
    'Financing',
    'Laboratory',
    'Surveillance',
    'Human resources',
    'Health emergency management',
    'Health services provision',
    'Infection prevention and control',
    'Risk communication and community engagement',
    'Points of entry',
    'Zoonotic diseases',
    'Food safety',
    'Chemical events',
    'Radiation emergencies'
  ];

  const AFRO_AVERAGES: Record<string, number[]> = {
    '2025': [41.3, 56.3, 50.4, 58.6, 72.1, 41.3, 59.7, 54.7, 45.5, 58.6, 46.4, 52.3, 46.0, 34.9, 38.7],
    '2024': [48.0, 55.0, 50.0, 58.0, 65.0, 47.0, 59.0, 60.0, 48.0, 54.0, 52.0, 53.0, 51.0, 45.0, 46.0],
    '2023': [47.0, 54.0, 49.0, 57.0, 64.0, 46.0, 58.0, 59.0, 47.0, 53.0, 51.0, 52.0, 50.0, 44.0, 45.0],
    '2022': [46.0, 53.0, 48.0, 56.0, 63.0, 45.0, 57.0, 58.0, 46.0, 52.0, 50.0, 51.0, 49.0, 43.0, 44.0],
  };

  const AFRICA_AVERAGES: Record<string, number[]> = {
    '2025': [45.3, 62.3, 57.4, 64.6, 79.1, 47.3, 65.7, 60.7, 51.5, 64.6, 52.4, 58.3, 52.0, 39.9, 44.7],
    '2024': [52.0, 61.0, 57.0, 64.0, 72.0, 53.0, 65.0, 66.0, 54.0, 60.0, 58.0, 59.0, 57.0, 50.0, 52.0],
    '2023': [51.0, 60.0, 56.0, 63.0, 71.0, 52.0, 64.0, 65.0, 53.0, 59.0, 57.0, 58.0, 56.0, 49.0, 51.0],
    '2022': [50.0, 59.0, 55.0, 62.0, 70.0, 51.0, 63.0, 64.0, 52.0, 58.0, 56.0, 57.0, 55.0, 48.0, 50.0],
  };

  const GLOBAL_AVERAGES: Record<string, number[]> = {
    '2025': [49.3, 68.6, 63.5, 70.8, 87.2, 53.7, 71.9, 66.7, 57.4, 71.0, 59.2, 64.4, 57.4, 44.0, 50.6],
    '2024': [56.0, 67.3, 63.1, 70.2, 80.1, 59.4, 71.2, 72.0, 59.9, 66.4, 64.8, 65.1, 62.4, 54.1, 57.9],
    '2023': [55.2, 66.5, 62.4, 69.5, 79.5, 58.6, 70.6, 71.3, 58.9, 65.6, 64.4, 64.8, 61.7, 52.8, 56.8],
    '2022': [55.8, 66.9, 64.2, 73.5, 83.4, 60.2, 71.9, 74.4, 61.8, 68.6, 63.3, 66.5, 64.2, 56.5, 59.0],
  };

  const afroAvgs = AFRO_AVERAGES[year] || AFRO_AVERAGES['2025'];
  const africaAvgs = AFRICA_AVERAGES[year] || AFRICA_AVERAGES['2025'];
  const globalAvgs = GLOBAL_AVERAGES[year] || GLOBAL_AVERAGES['2025'];

  const chartData = capacities.map((cap, idx) => ({
    name: `C${idx + 1}`,
    fullName: cap.category || CAPACITY_NAMES[idx] || `Capacity ${idx + 1}`,
    AFRO: afroAvgs[idx] || 0,
    Africa: africaAvgs[idx] || 0,
    Global: globalAvgs[idx] || 0
  }));

  return (
    <div className={`w-full rounded-2xl shadow-2xl overflow-hidden relative mb-6 ${isLight ? 'bg-gradient-to-br from-blue-50 to-white border border-blue-200' : 'bg-white/[0.02] backdrop-blur-md border border-white/10 backdrop-blur-xl border border-cyan-500/20 shadow-[0_0_20px_rgba(34,211,238,0.05)]'}`}>

      <div className={`absolute inset-0 pointer-events-none ${isLight ? 'bg-gradient-to-br from-cyan-400/5 via-transparent to-blue-500/5' : 'bg-gradient-to-br from-cyan-500/5 via-transparent to-blue-500/5'}`}></div>


      <div className="p-6 relative z-10">

        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className={`text-lg font-bold mb-1 ${isLight ? 'text-[#1a1a1a]' : 'text-white'}`}>
              IHR Score per capacity AFRO {year}
            </h2>
            <p className={`text-xs ${isLight ? 'text-gray-500' : 'text-cyan-300/70'}`}>
              (Updated on {new Date().toLocaleDateString('en-GB')})
            </p>
          </div>


          <div className="flex gap-3">
            <Dropdown
              label="Country"
              value={country}
              onChange={onCountryChange}
              items={countries}
              showLabel={false}
              allowEmptyDefault={false}
              bgColor={isLight ? "#eff6ff" : "#0c7be910"}
            />
            <Dropdown
              label="Year"
              value={year}
              onChange={onYearChange}
              items={years}
              showLabel={false}
              allowEmptyDefault={false}
              bgColor={isLight ? "#eff6ff" : "#0c7be910"}
            />
          </div>
        </div>


        <div className="flex items-center gap-6 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-4 h-3 bg-green-500 rounded-sm"></div>
            <span className={`text-xs ${isLight ? 'text-gray-600' : 'text-gray-300'}`}>AFRO</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-3 bg-yellow-500 rounded-sm"></div>
            <span className={`text-xs ${isLight ? 'text-gray-600' : 'text-gray-300'}`}>Africa</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-3 bg-red-500 rounded-sm"></div>
            <span className={`text-xs ${isLight ? 'text-gray-600' : 'text-gray-300'}`}>Global</span>
          </div>
        </div>


        <div className="w-full h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
              barGap={0}
              barCategoryGap="20%"
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} opacity={0.3} />

              <XAxis
                dataKey="name"
                tick={{ fill: "#94a3b8", fontSize: 10 }}
                axisLine={{ stroke: "#475569" }}
                tickLine={false}
              />

              <YAxis
                type="number"
                domain={[0, 100]}
                tick={{ fill: "#94a3b8", fontSize: 11 }}
                axisLine={{ stroke: "#475569" }}
                tickLine={false}
                label={{ value: 'Capacity (%)', angle: -90, position: 'insideLeft', style: { fill: '#94a3b8', fontSize: 11 } }}
              />


              <Tooltip
                contentStyle={{
                  backgroundColor: '#0a0f1f',
                  border: '2px solid #22d3ee',
                  borderRadius: '10px',
                  boxShadow: '0 8px 16px rgba(0,0,0,0.4)',
                  padding: '12px 16px'
                }}
                labelStyle={{
                  color: '#ffffff',
                  fontSize: 14,
                  fontWeight: 700,
                  marginBottom: '4px'
                }}
                itemStyle={{
                  color: '#ffffff',
                  fontSize: 13,
                  fontWeight: 500
                }}
                cursor={{ fill: 'rgba(34, 211, 238, 0.1)' }}
              />


              <Bar dataKey="AFRO" fill="#22c55e" radius={[4, 4, 0, 0]} barSize={20} />
              <Bar dataKey="Africa" fill="#eab308" radius={[4, 4, 0, 0]} barSize={20} />
              <Bar dataKey="Global" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={20} />

              <Legend />
            </BarChart>
          </ResponsiveContainer>
        </div>


        <div className={`grid grid-cols-5 gap-2 text-[9px] ${isLight ? 'text-gray-600' : 'text-gray-400'}`}>
          {chartData.map((item, idx) => (
            <div key={idx} className="text-center">
              <span className="font-bold text-xs text-cyan-400">{item.name}</span>
              <br />
              <span className="leading-tight text-xs">{item.fullName.split(' ').slice(0, 3).join(' ')}</span>
            </div>
          ))}
        </div>


        <div className={`mt-6 p-4 rounded-lg ${isLight ? 'bg-blue-50 border border-blue-200' : 'bg-white/[0.02] backdrop-blur-md border border-white/10 backdrop-blur-md border border-cyan-900/30'}`}>
          <p className={`text-xs leading-relaxed ${isLight ? 'text-gray-700' : 'text-gray-300'}`}>
            <span className={`font-semibold ${isLight ? 'text-blue-600' : 'text-cyan-400'}`}>Key Insights:</span>
          </p>
          <ul className={`mt-2 space-y-2 text-xs ${isLight ? 'text-gray-600' : 'text-gray-400'}`}>
            <li className="flex items-start gap-2">
              <span className="text-cyan-500 mt-0.5">•</span>
              <span>AFRO countries remain consistently <span className="text-orange-400 font-medium">~14–16 points below</span> the global average</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-cyan-500 mt-0.5">•</span>
              <span>FCV countries show a <span className="text-red-400 font-medium">persistent and widening deficit</span> compared with Non-FCV</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-cyan-500 mt-0.5">•</span>
              <span>No meaningful upward trend between 2022 and 2025 → <span className="text-yellow-400 font-medium">capacity stagnation</span></span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
interface MonthSliderProps {
  years: string[];
  selectedYear: string;
  onYearChange: (year: string) => void;
}

function MonthSlider({ years, selectedYear, onYearChange }: MonthSliderProps) {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const sortedYears = [...years].sort((a, b) => Number(a) - Number(b));
  const [sliderValue, setSliderValue] = useState(0);

  if (sortedYears.length === 0) return null;

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const allMonths: { month: string; year: string; index: number; label: string }[] = [];
  sortedYears.forEach((yr) => {
    months.forEach((month) => {
      allMonths.push({
        month,
        year: yr,
        index: allMonths.length,
        label: `${month} ${yr} `
      });
    });
  });

  useEffect(() => {
    const yearIndex = allMonths.findIndex(m => m.year === selectedYear && m.month === 'Dec');
    if (yearIndex >= 0 && sliderValue === 0) {
      setSliderValue(yearIndex);
    }
  }, [selectedYear]);

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const index = Number(e.target.value);
    setSliderValue(index);
    const selected = allMonths[index];
    if (selected && selected.year !== selectedYear) {
      onYearChange(selected.year);
    }
  };

  const currentMonth = allMonths[sliderValue] || allMonths[0];
  const progressPercent = (sliderValue / (allMonths.length - 1)) * 100;

  return (
    <div className="mt-4 pt-4 border-t border-gray-700/50">

      <div className="flex items-center justify-between mb-3">
        <span className={`text-xs ${isLight ? 'text-gray-600' : 'text-gray-400'}`}>Timeline</span>
        <div className="bg-blue-600/20 px-3 py-1 rounded-full border border-blue-500/30">
          <span className="text-sm font-semibold text-blue-400">
            {currentMonth?.month} {currentMonth?.year}
          </span>
        </div>
      </div>


      <div className="relative">

        <div className="absolute top-0 left-0 right-0 h-2 flex">
          {allMonths.map((m, idx) => (
            <div
              key={idx}
              className="flex-1 relative"
              style={{ opacity: m.month === 'Jan' ? 1 : 0.3 }}
            >
              <div
                className={`absolute top - 1 / 2 left - 0 w - px h - 3 - translate - y - 1 / 2 
                  ${m.month === 'Jan' ? 'bg-gray-400' : 'bg-gray-600'} `}
              />
            </div>
          ))}
        </div>


        <input
          type="range"
          min={0}
          max={allMonths.length - 1}
          value={sliderValue}
          onChange={handleSliderChange}
          className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider-thumb relative z-10"
          style={{
            background: `linear - gradient(to right, #3b82f6 0 %, #3b82f6 ${progressPercent} %, #374151 ${progressPercent} %, #374151 100 %)`
          }}
        />
      </div>


      <div className="relative mt-1 h-4 overflow-hidden">
        <div className="flex text-[10px] text-gray-500">
          {allMonths.map((m, idx) => (
            <div
              key={idx}
              className="flex-1 text-center"
              style={{
                opacity: (idx % 3 === 0) ? 1 : 0,
                color: idx === sliderValue ? '#3b82f6' : undefined,
                fontWeight: idx === sliderValue ? 600 : undefined
              }}
            >
              {m.month.charAt(0)}
            </div>
          ))}
        </div>
      </div>


      <div className="flex justify-between mt-1">
        {sortedYears.map((yr, idx) => (
          <div key={yr} className="text-center" style={{ flex: 1 }}>
            <span
              className={`text - xs font - medium ${yr === selectedYear ? 'text-blue-400' : 'text-gray-500'} `}
            >
              {yr}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function HumanitarianComparisonChart() {
  const { showToast } = useToast();
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<HumanitarianComparisonResponse['data'] | null>(null);
  const chartRef = useRef<HTMLDivElement>(null);
  const buttonContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const response = await espar.humanitarianComparison();
        setData(response.data);
      } catch (error: any) {
        showToast(error?.message || "Failed to load humanitarian comparison data", "error", 5000);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const chartData = data?.years.map((year: any, index: any) => ({
    year,
    "Humanitarian": data.humanitarian_scores[index],
    "Non-Humanitarian": data.non_humanitarian_scores[index],
    "Global Average": data.global_scores ? data.global_scores[index] : 0,
    "Africa (AFRO countries)": data.afro_scores ? data.afro_scores[index] : 0,
  })) || [];

  const handleDownloadPDF = async () => {
    try {
      const html2canvas = (await import('html2canvas')).default;
      const jsPDF = (await import('jspdf')).default;

      const element = chartRef.current;
      const buttonContainer = buttonContainerRef.current;

      if (!element) {
        showToast("Chart element not found", "error", 3000);
        return;
      }

      showToast("Generating PDF...", "info", 2000);

      if (buttonContainer) {
        buttonContainer.style.display = 'none';
      }

      const canvas = await html2canvas(element, {
        scale: 2,
        backgroundColor: '#0d1f1f',
        logging: false,
      });

      if (buttonContainer) {
        buttonContainer.style.display = 'flex';
      }

      const imgData = canvas.toDataURL('image/png');

      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });

      const margin = 15;
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const availableWidth = pdfWidth - (2 * margin);
      const availableHeight = pdfHeight - (2 * margin);

      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(availableWidth / imgWidth, availableHeight / imgHeight);

      const scaledWidth = imgWidth * ratio;
      const scaledHeight = imgHeight * ratio;
      const imgX = margin + (availableWidth - scaledWidth) / 2;
      const imgY = margin + (availableHeight - scaledHeight) / 2;

      pdf.addImage(imgData, 'PNG', imgX, imgY, scaledWidth, scaledHeight);
      pdf.save('Humanitarian-vs-NON-humanitarian-vs-Global.pdf');
      showToast("PDF downloaded successfully", "success", 3000);
    } catch (error: any) {
      showToast(error?.message || "Failed to download PDF", "error", 5000);
    }
  };

  return (
    <div ref={chartRef} className={`p-6 rounded-xl shadow-lg ${isLight ? 'bg-white border border-gray-200' : 'bg-white/[0.02] backdrop-blur-md border border-white/10'}`}>
      <div className="flex items-center justify-between mb-1">
        <h2 className={`text-lg font-semibold ${isLight ? 'text-[#1a1a1a]' : 'text-white'}`}>Humanitarian vs. NON humanitarian vs. Global</h2>
        <div ref={buttonContainerRef} className="flex items-center gap-2">
          {loading && <Updating />}
          <button
            onClick={handleDownloadPDF}
            className={`flex items-center gap-2 px-3 rounded-lg transition-colors duration-200 ${isLight ? 'text-[#1a1a1a]' : 'text-white'}`}
            title="Download as PDF"
          >
            <Download className="w-5 h-5" />
          </button>
        </div>
      </div>
      <p className={`text-sm mb-6 ${isLight ? 'text-gray-600' : 'text-gray-400'}`}>
        Comparing Average IHR Scores: Humanitarian Crisis Countries (OCHA), Non-Humanitarian, and Global Average
      </p>

      {loading ? (
        <div className="h-[300px] flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      ) : (
        <div className="w-full h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="year"
                stroke="#9ca3af"
                tick={{ fill: '#9ca3af' }}
              />
              <YAxis
                stroke="#9ca3af"
                tick={{ fill: '#9ca3af' }}
                domain={[40, 80]}
                ticks={[40, 45, 50, 51, 52, 55, 60, 65, 70, 75, 80]}
                tickFormatter={(value) => `${value}%`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1f2937',
                  border: '1px solid #374151',
                  borderRadius: '8px',
                  color: '#fff'
                }}
                formatter={(value: number) => [`${value.toFixed(1)}% `, undefined]}
              />
              <Legend
                wrapperStyle={{ paddingTop: '20px' }}
              />
              <Line
                type="monotone"
                dataKey="Humanitarian"
                stroke="#ef4444"
                strokeWidth={3}
                dot={{ fill: '#ef4444', strokeWidth: 2, r: 5 }}
                activeDot={{ r: 7 }}
              />
              <Line
                type="monotone"
                dataKey="Non-Humanitarian"
                stroke="#22c55e"
                strokeWidth={3}
                dot={{ fill: '#22c55e', strokeWidth: 2, r: 5 }}
                activeDot={{ r: 7 }}
              />
              <Line
                type="monotone"
                dataKey="Global Average"
                stroke="#eab308"
                strokeWidth={3}
                dot={{ fill: '#eab308', strokeWidth: 2, r: 5 }}
                activeDot={{ r: 7 }}
              />
              <Line
                type="monotone"
                dataKey="Africa (AFRO countries)"
                stroke="#3bf6ff"
                strokeWidth={3}
                dot={{ fill: '#3bf6ff', strokeWidth: 2, r: 5 }}
                activeDot={{ r: 7 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}


      <div className={`mt-4 p-3 rounded-lg ${isLight ? 'bg-blue-50 border border-blue-200' : 'bg-white/[0.02] backdrop-blur-md border border-white/10'}`}>
        <p className={`text-xs ${isLight ? 'text-gray-700' : 'text-gray-400'}`}>
          <span className={`font-medium ${isLight ? 'text-blue-600' : 'text-blue-400'}`}>Insight:</span> This chart compares health preparedness between
          humanitarian crisis countries (OCHA classification) and non-humanitarian countries in the African region.
          Lower scores indicate areas needing increased support.
        </p>
        <ul className={`mt-2 space-y-2 text-xs ${isLight ? 'text-gray-600' : 'text-gray-400'}`}>
          <li className="flex items-start gap-2">
            <span className="text-cyan-500 mt-0.5">•</span>
            <span>AFRO countries remain consistently <span className="text-orange-400 font-medium">~14–16 points below</span> the global average</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-cyan-500 mt-0.5">•</span>
            <span>Humanitarian crisis countries show a <span className="text-red-400 font-medium">persistent and widening deficit</span> compared with Non-Humanitarian</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-cyan-500 mt-0.5">•</span>
            <span>No meaningful upward trend between 2022 and 2025 → <span className="text-yellow-400 font-medium">capacity stagnation</span></span>
          </li>
        </ul>
      </div>
    </div>
  );
}
function AverageOfCapacitiesRegion({ year, capacities }: {
  year: string;
  capacities: Array<{ category: string; value: string | number }>;
}) {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const [selectedCapacity, setSelectedCapacity] = useState('All capacities average');

  const CAPACITY_OPTIONS = [
    'All capacities average',
    'C1 - Policy, Legal and Advocacy',
    'C2 - IHR Coordination, National Focal Point',
    'C3 - Financing',
    'C4 - Laboratory',
    'C5 - Surveillance',
    'C6 - Human resources',
    'C7 - Health emergency management',
    'C8 - Health services provision',
    'C9 - Infection prevention and control',
    'C10 - Risk communication',
    'C11 - Points of entry',
    'C12 - Zoonotic diseases',
    'C13 - Food safety',
    'C14 - Chemical events',
    'C15 - Radiation emergencies',
  ];

  const GLOBAL_AVERAGES: Record<string, Record<string, number>> = {
    '2025': { all: 50.4, C1: 41.3, C2: 56.3, C3: 50.4, C4: 58.6, C5: 72.1, C6: 41.3, C7: 59.7, C8: 54.7, C9: 45.5, C10: 58.6, C11: 46.4, C12: 52.3, C13: 46.0, C14: 34.9, C15: 38.7 },
    '2024': { all: 63.9, C1: 56.0, C2: 67.3, C3: 63.1, C4: 70.2, C5: 80.1, C6: 59.4, C7: 71.2, C8: 72.0, C9: 59.9, C10: 66.4, C11: 64.8, C12: 65.1, C13: 62.4, C14: 54.1, C15: 57.9 },
    '2023': { all: 61.5, C1: 55.2, C2: 66.5, C3: 62.4, C4: 69.5, C5: 79.5, C6: 58.6, C7: 70.6, C8: 71.3, C9: 58.9, C10: 65.6, C11: 64.4, C12: 64.8, C13: 61.7, C14: 52.8, C15: 56.8 },
    '2022': { all: 63.5, C1: 55.8, C2: 66.9, C3: 64.2, C4: 73.5, C5: 83.4, C6: 60.2, C7: 71.9, C8: 74.4, C9: 61.8, C10: 68.6, C11: 63.3, C12: 66.5, C13: 64.2, C14: 56.5, C15: 59.0 },
  };

  const getChartData = () => {
    const years = ['2022', '2023', '2024', '2025'];
    let capacityKey = 'all';

    if (selectedCapacity !== 'All capacities average') {
      const match = selectedCapacity.match(/C(\d+)/);
      if (match) capacityKey = `C${match[1]}`;
    }

    return years.map(yr => ({
      year: yr,
      value: GLOBAL_AVERAGES[yr]?.[capacityKey] || 0
    }));
  };

  const chartData = getChartData();
  const currentYearData = chartData.find(d => d.year === year);
  const prevYearData = chartData.find(d => d.year === String(Number(year) - 1));
  const yoyChange = currentYearData && prevYearData
    ? (currentYearData.value - prevYearData.value).toFixed(1)
    : '+0.0';

  return (
    <div className={`rounded-2xl shadow-2xl overflow-hidden relative h-full ${isLight ? 'bg-gradient-to-br from-blue-50 to-white border border-blue-200' : 'bg-white/[0.02] backdrop-blur-md border border-white/10 backdrop-blur-xl border border-cyan-500/20 shadow-[0_0_20px_rgba(34,211,238,0.05)]'}`}>
      <div className={`absolute inset-0 pointer-events-none ${isLight ? 'bg-gradient-to-br from-cyan-400/5 via-transparent to-blue-500/5' : 'bg-gradient-to-br from-cyan-500/5 via-transparent to-blue-500/5'}`}></div>

      <div className="p-6 relative z-10 h-full flex flex-col">

        <div className="mb-2">
          <div className="mb-2">
            <h2 className={`text-lg font-bold ${isLight ? 'text-[#1a1a1a]' : 'text-white'}`}>
              Average of capacities per WHO region <span className={`text-lg font-bold ${isLight ? 'text-blue-600' : 'text-cyan-400'}`}>{year}</span>
            </h2>
            <p className={`text-xs ${isLight ? 'text-gray-600' : 'text-gray-400'}`}>
              Year-over-Year Change: <span className="text-green-500 font-semibold">{yoyChange} pts</span> from {Number(year) - 1}
            </p>
          </div>
        </div>


        <div className="mb-4">
          <p className={`text-xs font-semibold mb-2 ${isLight ? 'text-blue-600' : 'text-cyan-400'}`}>SELECT CAPACITY</p>
          <Dropdown
            label="Capacity"
            value={selectedCapacity}
            onChange={setSelectedCapacity}
            items={CAPACITY_OPTIONS}
            showLabel={false}
            allowEmptyDefault={false}
            bgColor={isLight ? "#eff6ff" : "#0c4a6e"}
          />
        </div>


        <div className="flex-1 min-h-0">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-3 h-3 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-sm"></div>
            <span className={`text-xs ${isLight ? 'text-gray-600' : 'text-gray-300'}`}>Region Average</span>
          </div>

          <div className="h-full min-h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={isLight ? "#cbd5e1" : "#334155"} vertical={false} opacity={0.3} />
                <XAxis dataKey="year" tick={{ fill: isLight ? "#475569" : "#94a3b8", fontSize: 11 }} axisLine={{ stroke: isLight ? "#94a3b8" : "#475569" }} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fill: isLight ? "#475569" : "#94a3b8", fontSize: 11 }} axisLine={{ stroke: isLight ? "#94a3b8" : "#475569" }} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0a0f1f',
                    border: '2px solid #22d3ee',
                    borderRadius: '10px',
                    boxShadow: '0 8px 16px rgba(0,0,0,0.4)',
                    padding: '12px 16px'
                  }}
                  labelStyle={{
                    color: '#ffffff',
                    fontSize: 14,
                    fontWeight: 700,
                    marginBottom: '4px'
                  }}
                  itemStyle={{
                    color: '#ffffff',
                    fontSize: 13,
                    fontWeight: 500
                  }}
                  cursor={{ fill: 'rgba(34, 211, 238, 0.1)' }}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={60}>
                  {chartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.year === year ? "url(#activeBarGradient)" : "url(#inactiveBarGradient)"}
                      opacity={entry.year === year ? 1 : 0.4}
                      style={{ cursor: entry.year === year ? 'pointer' : 'default' }}
                    />
                  ))}
                  <defs>
                    <linearGradient id="activeBarGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#22d3ee" stopOpacity={1} />
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.9} />
                    </linearGradient>
                    <linearGradient id="inactiveBarGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.4} />
                    </linearGradient>
                  </defs>
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

export { ScoreCard, LegendDot, AllCapacitiesChart, MonthSlider, HumanitarianComparisonChart, AverageOfCapacitiesRegion };
