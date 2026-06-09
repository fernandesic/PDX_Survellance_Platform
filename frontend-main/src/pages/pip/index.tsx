import { useState, useEffect, useCallback } from "react";
import { PIPView } from "./PIPView";
import { fetchSummary, fetchCountries, type SummaryStats, type CountrySummary } from "./utils/api";
import { logger } from "@/utils/logger";

export type PanelMode = "overview" | "surveillance" | "virological" | "preparedness" | "heatmap" | "bulletin";

const PIPPage = () => {
  const [layers, setLayers] = useState<Record<string, boolean>>({
    countries: true,
    alerts: false,
    indicators: false
  });

  const [tooltip, setTooltip] = useState<{
    country: CountrySummary | null;
    x: number;
    y: number;
  }>({ country: null, x: 0, y: 0 });

  // Data state
  const [countries, setCountries] = useState<CountrySummary[]>([]);
  const [summary, setSummary] = useState<SummaryStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCountryName, setSelectedCountryName] = useState<string | null>(null);

  // Right panel mode
  const [rightPanel, setRightPanel] = useState<PanelMode>("overview");

  // Fetch real data on mount
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        const [apiCountries, apiSummary] = await Promise.all([
          fetchCountries(),
          fetchSummary(),
        ]);

        if (cancelled) return;
        if (apiCountries) setCountries(apiCountries);
        if (apiSummary) setSummary(apiSummary);
      } catch (err: any) {
        if (!cancelled) setError(err.message || "Failed to load PIP data");
        logger.error("PIP Data Load Error:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const toggleLayer = useCallback((key: string) => {
    setLayers((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const handleCountryHover = useCallback(
    (country: CountrySummary | null, x: number, y: number) => {
      setTooltip({ country, x, y });
    },
    []
  );

  // Prevent parent layout from scrolling on the PIP page
  useEffect(() => {
    const parent = document.querySelector(".grow.overflow-y-auto") as HTMLElement | null;
    if (parent) {
      parent.style.overflow = "hidden";
    }
    return () => {
      if (parent) {
        parent.style.overflow = "";
      }
    };
  }, []);

  return (
    <PIPView
      layers={layers}
      toggleLayer={toggleLayer}
      tooltip={tooltip}
      handleCountryHover={handleCountryHover}
      countries={countries}
      summary={summary}
      loading={loading}
      error={error}
      rightPanel={rightPanel}
      setRightPanel={setRightPanel}
      selectedCountryName={selectedCountryName}
      setSelectedCountryName={setSelectedCountryName}
    />
  );
};

export default PIPPage;
