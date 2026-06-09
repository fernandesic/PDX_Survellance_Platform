import { useState, useEffect } from 'react'
import { COVERAGE_BANDS } from '../constants/ocv'
import { coverageColor, normalizeCountryName } from '../services/ocv'
import { SimpleArcGISMap } from "@/components/maps/SimpleArcGISMap"
import { useTheme } from '@/contexts/ThemeContext'
import clsx from 'clsx'
import { logger } from "@/utils/logger";

// Minimal GeoJSON types — avoids adding @types/geojson just for these two
// usages. Properties is loose since we only read .name off it.
interface GeoFeature {
  type: 'Feature';
  geometry: unknown;
  properties?: { name?: string;[k: string]: unknown };
}
interface GeoFeatureCollection {
  type: 'FeatureCollection';
  features: GeoFeature[];
}

const GEO_URL = "https://raw.githubusercontent.com/johan/world.geo.json/master/countries.geo.json";

const AFRICAN_COUNTRIES = [
  "Algeria", "Angola", "Benin", "Botswana", "Burkina Faso", "Burundi", "Cameroon", "Cape Verde",
  "Central African Republic", "Chad", "Comoros", "Democratic Republic of the Congo",
  "Republic of the Congo", "Djibouti", "Egypt", "Equatorial Guinea", "Eritrea", "Ethiopia",
  "Gabon", "Gambia", "Ghana", "Guinea", "Guinea-Bissau", "Ivory Coast", "Kenya", "Lesotho",
  "Liberia", "Libya", "Madagascar", "Malawi", "Mali", "Mauritania", "Mauritius", "Morocco",
  "Mozambique", "Namibia", "Niger", "Nigeria", "Rwanda", "Sao Tome and Principe", "Senegal",
  "Seychelles", "Sierra Leone", "Somalia", "South Africa", "South Sudan", "Sudan", "Swaziland",
  "Tanzania", "Togo", "Tunisia", "Uganda", "Zambia", "Zimbabwe", "United Republic of Tanzania",
  "Somaliland", "Côte d'Ivoire", "eSwatini"
];

interface OCVCountry {
  code: string
  name: string
  [key: string]: unknown
}

interface AfricaMapProps {
  countries: OCVCountry[]
  antigen: string
  selected: string | null
  onSelect: (code: string | null) => void
}

export default function AfricaMap({ countries, antigen, selected, onSelect }: AfricaMapProps) {
  const { theme } = useTheme()
  const isLight = theme === 'light'
  const [africaGeoJson, setAfricaGeoJson] = useState<GeoFeatureCollection | null>(null)

  useEffect(() => {
    fetch(GEO_URL)
      .then(res => res.json())
      .then((geoData: GeoFeatureCollection) => {
        const africaData: GeoFeatureCollection = {
          type: "FeatureCollection",
          features: geoData.features.filter(f =>
            AFRICAN_COUNTRIES.some((name: string) =>
              f.properties?.name?.toLowerCase().includes(name.toLowerCase()) ||
              name.toLowerCase().includes(f.properties?.name?.toLowerCase() || '')
            )
          )
        };
        setAfricaGeoJson(africaData);
      })
      .catch(err => logger.error('Error loading GeoJSON:', err));
  }, []);

  const getCountryStyle = () => {
    return {
      fillColor: 'transparent',
      fillOpacity: 0
    };
  };

  const getMarkerStyle = (feature: any) => {
    const countryName = feature.properties?.name || '';
    const normName = normalizeCountryName(countryName);

    // Find matching country in OCV data
    const ocvMatch = countries.find(c =>
      normalizeCountryName(c.name) === normName ||
      c.code.toLowerCase() === normName
    );

    if (ocvMatch) {
      const val = ocvMatch[antigen] as number | null;
      const color = coverageColor(val);
      const size = val === null ? 6 : Math.max(8, Math.min(22, 6 + (Math.min(val, 130) / 130) * 16));
      return { color, size: `${size}px` };
    }

    return { color: 'transparent', size: '0px' };
  };

  const handleMapClick = (attributes: any) => {
    const name = attributes?.name || '';
    const normName = normalizeCountryName(name);
    const ocvMatch = countries.find(c =>
      normalizeCountryName(c.name) === normName ||
      c.code.toLowerCase() === normName
    );
    if (ocvMatch) {
      onSelect(ocvMatch.code === selected ? null : ocvMatch.code);
    }
  };

  return (
    <div className="relative group/map w-full h-[440px]">
      {africaGeoJson && (
        <div className={clsx(
          "w-full h-full rounded-xl overflow-hidden border transition-all duration-300 shadow-2xl",
          isLight ? "bg-white border-slate-200" : "bg-[#060d1a] border-white/10"
        )}>
          <SimpleArcGISMap
            geoData={africaGeoJson}
            getCountryStyle={getCountryStyle}
            getMarkerStyle={getMarkerStyle}
            onCountryClick={handleMapClick}
            mapKey={`${antigen}-${JSON.stringify(countries.map(c => c.code))}`}
            selectedCountryName={selected ? countries.find(c => c.code === selected)?.name : ''}
            isLight={true}
          />
        </div>
      )}

      {/* Legend overlay */}
      <div className={clsx(
        "absolute bottom-4 left-4 z-[400] backdrop-blur-md px-3 py-2.5 rounded-lg border shadow-2xl transition-all duration-300",
        isLight ? "bg-white/90 border-slate-200" : "bg-[#060d1a]/80 border-white/10"
      )}>
        <div className={clsx("text-[10px] font-bold uppercase mb-2.5 tracking-wider font-mono", isLight ? "text-blue-600" : "text-[#00d4ff]")}>Coverage Target (95%)</div>
        <div className="flex flex-col gap-2">
          {COVERAGE_BANDS.map((b, i) => (
            <div key={i} className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full shadow-[0_2px_4px_rgba(0,0,0,0.1)]" style={{ backgroundColor: b.color }} />
              <span className={clsx("text-[10px] font-medium font-mono", isLight ? "text-slate-600" : "text-white/60")}>{b.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
