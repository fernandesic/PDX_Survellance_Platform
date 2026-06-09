import React from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { type SummaryStats, type CountrySummary } from "./utils/api";
import { LoadingSpinner, ErrorAlert } from "./components/UI";
import PIPMap from "./components/PIPMap";
import type { PanelMode } from ".";
import { Globe, BarChart2, Activity, FlaskConical, Shield, Newspaper } from "lucide-react";
import clsx from "clsx";

interface PIPViewProps {
  layers: Record<string, boolean>;
  toggleLayer: (key: string) => void;
  tooltip: {
    country: CountrySummary | null;
    x: number;
    y: number;
  };
  handleCountryHover: (country: CountrySummary | null, x: number, y: number) => void;
  countries: CountrySummary[];
  summary: SummaryStats | null;
  loading: boolean;
  error: string | null;
  rightPanel: PanelMode;
  setRightPanel: (panel: PanelMode) => void;
  selectedCountryName: string | null;
  setSelectedCountryName: (name: string | null) => void;
}

const PANEL_TABS: { id: PanelMode; label: string; icon: React.ElementType }[] = [
  { id: "overview", label: "Overview", icon: Globe },
  { id: "surveillance", label: "Surveillance", icon: Activity },
  { id: "virological", label: "Virological", icon: FlaskConical },
  { id: "preparedness", label: "Preparedness", icon: Shield },
  { id: "heatmap", label: "Heatmap", icon: BarChart2 },
  { id: "bulletin", label: "Bulletin", icon: Newspaper },
];

export const PIPView = ({
  layers,
  toggleLayer,
  tooltip,
  handleCountryHover,
  countries,
  summary,
  loading,
  error,
  rightPanel,
  setRightPanel,
  selectedCountryName,
  setSelectedCountryName
}: PIPViewProps) => {
  const { theme } = useTheme();
  const isLight = theme === 'light';

  return (
    <div className="w-full h-full overflow-hidden relative" style={{ background: isLight ? "#f8fafc" : "#060D1A" }}>

      {/* Full-screen Map */}
      <div className="absolute inset-0 z-0">
        <PIPMap
          layers={layers}
          countries={countries}
          onCountryHover={handleCountryHover}
          onCountryClick={(country) => setSelectedCountryName(country.country)}
        />
      </div>

      {/* Metrics Strip (Top) */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[600] w-[80%] max-w-6xl pointer-events-none">
        <div className="flex gap-4 w-full">
          {/* Will replace with a real MetricsStrip component that uses summary */}
        </div>
      </div>

      {/* Right Panel Toggle Tabs */}
      <div className="absolute top-[88px] right-[400px] z-[650] flex flex-col gap-1.5 backdrop-blur-xl rounded-lg p-1.5 pointer-events-auto"
        style={{
          background: isLight ? "rgba(255,255,255,0.92)" : "rgba(6, 13, 26, 0.92)",
          border: `1px solid ${isLight ? "#e2e8f0" : "rgba(255,255,255,0.1)"}`,
          boxShadow: isLight ? "0 4px 6px -1px rgba(0, 0, 0, 0.1)" : "0 4px 6px -1px rgba(0, 0, 0, 0.5)"
        }}>
        {PANEL_TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            className={clsx(
              "flex items-center gap-2 px-3 py-2 rounded-md transition-all font-semibold font-mono text-[10px]",
              rightPanel === id
                ? isLight
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-emerald-500/20 text-emerald-400"
                : isLight
                  ? "text-slate-500 hover:bg-slate-100"
                  : "text-slate-400 hover:bg-white/5"
            )}
            onClick={() => setRightPanel(id)}
            title={label}
          >
            <Icon size={14} />
          </button>
        ))}
      </div>

      {/* Loading & Error Overlays */}
      {loading && (
        <div className="absolute inset-0 z-[1000] flex items-center justify-center bg-black/20 backdrop-blur-sm pointer-events-none">
          <LoadingSpinner label="Loading PIP Landscape Data..." />
        </div>
      )}
      {error && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-[1000]">
          <ErrorAlert message={error} />
        </div>
      )}

      {/* Country Tooltip */}
      {tooltip.country && (
        <div
          className={clsx(
            "fixed z-[900] px-3.5 py-3 pointer-events-none min-w-[200px] rounded-lg border",
            isLight ? "bg-white/95 border-emerald-200 shadow-xl" : "bg-slate-900/95 border-emerald-500/30 shadow-2xl"
          )}
          style={{
            left: tooltip.x + 14,
            top: tooltip.y - 20,
          }}
        >
          <div className={clsx("text-[13px] font-bold mb-2 flex items-center gap-1.5", isLight ? "text-slate-800" : "text-white")}>
            {tooltip.country.country}
          </div>
          {[
            ["READINESS SCORE", `${tooltip.country.readiness_score}%`, tooltip.country.readiness_score >= 70 ? "#10B981" : tooltip.country.readiness_score >= 45 ? "#F59E0B" : "#EF4444"],
            ["HAS NIC", tooltip.country.has_nic ? "Yes" : "No", isLight ? "#64748b" : "#94a3b8"],
            ["RT-PCR CAPABILITY", tooltip.country.has_pcr ? "Yes" : "No", isLight ? "#64748b" : "#94a3b8"],
          ].map(([key, val, color]) => (
            <div key={key} className={clsx("flex justify-between items-center py-0.5 border-b last:border-b-0 text-[10.5px]", isLight ? "border-slate-100" : "border-white/10")}>
              <span className={clsx("font-mono text-[9px]", isLight ? "text-slate-500" : "text-slate-400")}>{key}</span>
              <span className="font-semibold font-mono text-[10px]" style={{ color: color as string }}>{val}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
