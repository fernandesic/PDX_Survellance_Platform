import { useEffect, useState, useMemo, useCallback } from "react";
import { useToast } from "@/contexts/ToastProvider";
import { useTheme } from "@/contexts/ThemeContext";
import { stardata } from "@/pages/stardata/services/stardata";
import { logger } from "@/utils/logger";
import type { StardataMapResponse, StardataSummaryResponse } from "@/pages/stardata/types/stardata";
import StarDataView from "./StarDataView";

const GEO_URL = "https://raw.githubusercontent.com/johan/world.geo.json/master/countries.geo.json";

const AFRO_COUNTRIES = [
  "Angola", "Benin", "Botswana", "Burkina Faso", "Burundi",
  "Cameroon", "Cape Verde", "Central African Republic", "Chad", "Comoros",
  "Democratic Republic of the Congo", "Republic of the Congo", "Djibouti",
  "Equatorial Guinea", "Eritrea", "Ethiopia", "Gabon", "Gambia",
  "Ghana", "Guinea", "Guinea-Bissau", "Ivory Coast", "Kenya", "Lesotho",
  "Liberia", "Madagascar", "Malawi", "Mali", "Mauritania", "Mauritius",
  "Mozambique", "Namibia", "Niger", "Nigeria", "Rwanda",
  "Sao Tome and Principe", "Senegal", "Seychelles", "Sierra Leone", "Somalia",
  "South Africa", "South Sudan", "Sudan", "Swaziland", "Tanzania",
  "Togo", "Uganda", "Zambia", "Zimbabwe",
  "United Republic of Tanzania", "Somaliland", "Côte d'Ivoire", "eSwatini"
];

export default function StarDataPage() {
  const { theme } = useTheme();
  const isLight = theme === 'light';

  const getSeverityColor = (severity: string) => {
    const s = severity?.toLowerCase().trim();
    if (s === "very high" || s === "muito elevada") return "#dc2626";
    if (s === "high" || s === "elevada") return "#f97316";
    if (s === "moderate" || s === "moderada") return "#eab308";
    if (s === "low" || s === "baixa" || s === "very low" || s === "muito baixa") return "#22c55e";
    return "#e5e7eb"; // No Data or default
  };

  const { showToast } = useToast();
  const [hazard, setHazard] = useState("");
  const [hazardType, setHazardType] = useState("");
  const [severity, setSeverity] = useState("");

  const [loading, setLoading] = useState(false);
  const [summaryData, setSummaryData] = useState<StardataSummaryResponse['data']>();
  const [mapData, setMapData] = useState<StardataMapResponse['data']>();
  const [mapLoading, setMapLoading] = useState(false);
  const [geoData, setGeoData] = useState<any>(null);
  const [selectedCountry, setSelectedCountry] = useState<any>(null);
  const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  const MONTH_NAMES: Record<string, string> = {
    jan: 'January', feb: 'February', mar: 'March', apr: 'April',
    may: 'May', jun: 'June', jul: 'July', aug: 'August',
    sep: 'September', oct: 'October', nov: 'November', dec: 'December'
  };
  const initialMonthInt = new Date().getMonth();
  const [currentMonth, setCurrentMonth] = useState<string>(MONTHS[initialMonthInt]);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  useEffect(() => {
    const loadEsparSummary = async () => {
      try {
        setLoading(true);
        const response = await stardata.summary(hazard, hazardType, severity, "", currentMonth);
        setSummaryData(response.data);
      } catch (error: any) {
        showToast(error?.message || "An Error Ocurred while retrieving data", "error", 5000);
      } finally {
        setLoading(false);
      }
    };
    loadEsparSummary();
  }, [hazard, hazardType, severity, currentMonth, showToast]);

  useEffect(() => {
    const loadMapData = async () => {
      try {
        setMapData(undefined); // Clear old data to force clean state
        setMapLoading(true);
        const response = await stardata.map(severity || undefined, currentMonth, hazard || undefined, hazardType || undefined);
        setMapData(response.data);
      } catch (error: any) {
        showToast(error?.message || "An Error Ocurred while retrieving map data", "error", 5000);
      } finally {
        setMapLoading(false);
      }
    };
    loadMapData();
  }, [currentMonth, hazard, hazardType, severity, showToast]);

  useEffect(() => {
    const loadGeoData = async () => {
      try {
        const response = await fetch(GEO_URL);
        const data = await response.json();
        const ALL_AFRICAN_COUNTRIES = [
          ...AFRO_COUNTRIES,
          "Egypt", "Libya", "Tunisia", "Algeria", "Morocco"
        ];
        const africaData = {
          ...data,
          features: data.features.filter((feature: any) =>
            ALL_AFRICAN_COUNTRIES.some((name: string) =>
              feature.properties?.name?.toLowerCase().includes(name.toLowerCase()) ||
              name.toLowerCase().includes(feature.properties?.name?.toLowerCase() || '')
            )
          )
        };
        setGeoData(africaData);
      } catch (error) {
        logger.error("Error loading GeoJSON:", error);
      }
    };
    loadGeoData();
  }, []);

  const countryDataMap = useMemo(() => {
    const dataMap: Record<string, any> = {};
    if (mapData?.countries) {
      mapData.countries.forEach((c: any) => {
        dataMap[c.country.toLowerCase()] = c;
      });
    }
    return dataMap;
  }, [mapData]);

  const getCountryData = (countryName: string) => {
    return countryDataMap[countryName.toLowerCase()] || null;
  };

  const getCountryStyle = useCallback((feature: any) => {
    const countryName = feature?.properties?.name || "";
    const NON_AFRO_COUNTRIES = ['egypt', 'libya', 'tunisia', 'algeria', 'morocco'];
    const isNonAFRO = NON_AFRO_COUNTRIES.some(name =>
      countryName.toLowerCase().includes(name)
    );
    if (isNonAFRO) {
      return {
        fillColor: "transparent",
        fillOpacity: 0,
        weight: 0,
        opacity: 0,
        color: "transparent"
      };
    }
    const countryData = getCountryData(countryName);
    const fillColor = countryData ? "#5c8bd6" : "transparent";
    const fillOpacity = countryData ? 0.9 : 0;

    return {
      fillColor,
      fillOpacity,
      color: "#ffffff",
      weight: 0.5,
      opacity: 0.15,
    };
  }, [countryDataMap]);

  const getMarkerStyle = useCallback((feature: any) => {
    const countryName = feature?.properties?.name || "";
    const countryData = getCountryData(countryName);
    if (!countryData) return { color: "transparent" };

    return {
      color: getSeverityColor(countryData.severity)
    };
  }, [countryDataMap]);

  return (
    <StarDataView
      isLight={isLight}
      hazard={hazard}
      setHazard={setHazard}
      hazardType={hazardType}
      setHazardType={setHazardType}
      severity={severity}
      setSeverity={setSeverity}
      loading={loading}
      mapLoading={mapLoading}
      summaryData={summaryData}
      mapData={mapData}
      geoData={geoData}
      selectedCountry={selectedCountry}
      setSelectedCountry={setSelectedCountry}
      currentMonth={currentMonth}
      setCurrentMonth={setCurrentMonth}
      isPlaying={isPlaying}
      setIsPlaying={setIsPlaying}
      MONTHS={MONTHS}
      MONTH_NAMES={MONTH_NAMES}
      getCountryStyle={getCountryStyle}
      getMarkerStyle={getMarkerStyle}
    />
  );
}
