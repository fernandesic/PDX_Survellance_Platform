
import type { CHWOverview, EsparOverview, ReadinessOverview, StardataOverview } from "@/types";
import { useState, useEffect, useMemo, useCallback, Suspense, memo } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { arcgisService, type ArcGISWebMapLayer } from "@/services/arcgisService";
import { Loader2 } from "lucide-react";

import { UnifiedArcGISMap } from "@/components/maps/UnifiedArcGISMap";
import { logger } from "@/utils/logger";


import localAfricaGeoJson from '@/data/africa.geo.json';

const AFRICAN_COUNTRIES_FOR_MAP = [
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

interface LegendItem {
  label: string;
  bg: string;
  min: number;
  max: number;
}

const rgbaToHex = (rgba: any) => {
  try {
    if (!rgba) return '#6b7280';
    
    // Handle array format [r, g, b, a]
    if (Array.isArray(rgba)) {
      const r = rgba[0].toString(16).padStart(2, '0');
      const g = rgba[1].toString(16).padStart(2, '0');
      const b = rgba[2].toString(16).padStart(2, '0');
      return `#${r}${g}${b}`;
    }
    
    // Handle object format { r, g, b, a }
    if (typeof rgba === 'object' && rgba.r !== undefined) {
      const r = rgba.r.toString(16).padStart(2, '0');
      const g = rgba.g.toString(16).padStart(2, '0');
      const b = rgba.b.toString(16).padStart(2, '0');
      return `#${r}${g}${b}`;
    }
    
    return '#6b7280';
  } catch (e) {
    return '#6b7280';
  }
};

const getColor = (value: number, type: 'chw' | 'espar' | 'readiness' | 'star' | 'ihr'): string => {
  if (type === 'chw') {
    if (value >= 40) return "#22c55e"; // Green
    if (value >= 20) return "#3b82f6"; // Blue
    if (value >= 10) return "#f59e0b"; // Orange
    if (value > 0) return "#ef4444";  // Red
    return "transparent";
  }
  if (type === 'espar' || type === 'ihr') {
    if (value >= 80) return "#22c55e"; // Green
    if (value >= 60) return "#eab308"; // Yellow (was Blue)
    if (value >= 40) return "#f97316"; // Orange
    if (value > 0) return "#ef4444";   // Red
    return "transparent";
  }
  if (type === 'readiness') {
    if (value >= 70) return "#22c55e";
    if (value >= 40) return "#f59e0b";
    if (value > 0) return "#ef4444";
    return "#334155";
  }
  if (type === 'star') {
    if (value >= 4) return "#ef4444";
    if (value >= 3) return "#f59e0b";
    if (value >= 2) return "#3b82f6";
    if (value >= 1) return "#22c55e";
    return "transparent";
  }
  return "transparent";
};

interface Prop {
  chw: CHWOverview;
  espar: EsparOverview;
  readiness: ReadinessOverview;
  stardata: StardataOverview;
  chwRates?: any[];
}

type TabType = 'CHW' | 'IHR' | 'Readiness';

const normalizeCountryName = (name: string): string => {
  const normalized = name.toLowerCase().trim();
  const mappings: Record<string, string> = {
    'united republic of tanzania': 'tanzania',
    'democratic republic of the congo': 'drc',
    'republic of the congo': 'congo',
    'ivory coast': 'côte d\'ivoire',
    'cote d\'ivoire': 'côte d\'ivoire',
    'guinea bissau': 'guinea-bissau',
    'somaliland': 'somalia',
    'swaziland': 'eswatini',
  };
  return mappings[normalized] || normalized;
};

export default function DashboardMap({ chw, espar, readiness, stardata, chwRates }: Prop) {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const [tabs] = useState<TabType[]>(['CHW', 'IHR', 'Readiness']);
  const [activeTab, setActivetab] = useState<TabType>('CHW');
  const [selectedEsparYear, setSelectedEsparYear] = useState<string | null>(null);
  const [africaGeoJson, setAfricaGeoJson] = useState<any | null>(null);
  const [mapView, setMapView] = useState<any>(null);
  const [dynamicLegend, setDynamicLegend] = useState<LegendItem[]>([]);
  const [legendLoading, setLegendLoading] = useState(false);

  const africanCountries = useMemo(() => {
    const allCountries = new Set<string>();
    chw.countries?.forEach((country: string) => allCountries.add(country));
    espar.countries?.forEach((country: string) => allCountries.add(country));
    chw.top_region?.forEach((region) => {
      const parts = region.region.split(", ");
      const countryName = parts[parts.length - 1];
      if (countryName) allCountries.add(countryName);
    });
    const variations = new Map<string, string[]>([
      ['Tanzania', ['United Republic of Tanzania']],
      ['DRC', ['Democratic Republic of the Congo', 'Congo, Dem. Rep.']],
      ['Congo', ['Republic of the Congo', 'Congo, Rep.']],
      ["Cote d'Ivoire", ['Ivory Coast', 'Côte d\'Ivoire']],
      ['Guinea-Bissau', ['Guinea Bissau']],
      ['eSwatini', ['Swaziland']],
    ]);
    allCountries.forEach(country => {
      variations.forEach((alts, key) => {
        if (country.toLowerCase().includes(key.toLowerCase())) {
          alts.forEach(alt => allCountries.add(alt));
        }
      });
    });

    return Array.from(allCountries);
  }, [chw, espar]);

  const processedEspar = useMemo(() => {
    if (!espar) return espar;
    const yearsData = [...(espar.years_data || [])];
    const years = [...(espar.years || [])];
    if (!yearsData.find(y => y.year === '2025')) {
      const yearEntry = {
        year: '2025',
        count: Object.keys(espar.country_scores || {}).length,
        countries: Object.keys(espar.country_scores || {}),
        country_scores: espar.country_scores || {}
      };
      yearsData.unshift(yearEntry);
      if (!years.includes('2025')) years.unshift('2025');
    }
    return { ...espar, years_data: yearsData, years };
  }, [espar]);

  // Use bundled Africa GeoJSON — no network fetch required
  useEffect(() => {
    setAfricaGeoJson(localAfricaGeoJson as any);
  }, []);

  useEffect(() => {
    if (activeTab !== 'CHW') {
      setDynamicLegend([]);
      return;
    }

    (async () => {
      try {
        setLegendLoading(true);
        const mapId = 'chw';
        const layers: ArcGISWebMapLayer[] = await arcgisService.getWebMapLayers(mapId);

        // Use robust finding for the layer title (case-insensitive and partial match)
        let targetLayer = layers.find(l => 
          (l.title?.toUpperCase().includes('CHW') || l.title?.toUpperCase().includes('WORKER')) && 
          l.layerDefinition?.drawingInfo?.renderer
        );

        // Fallback to first layer with a renderer if nothing found
        if (!targetLayer) {
          targetLayer = layers.find(l => l.layerDefinition?.drawingInfo?.renderer);
        }

        const renderer = targetLayer?.layerDefinition?.drawingInfo?.renderer;

        if (renderer) {
          let items: LegendItem[] = [];
          
          if (renderer.type === 'classBreaks' && renderer.classBreakInfos) {
            items = renderer.classBreakInfos.map((info, idx, arr) => ({
              label: info.label,
              bg: rgbaToHex(info.symbol.color),
              min: idx === 0 ? 0 : arr[idx - 1].classMaxValue + 1,
              max: info.classMaxValue
            }));
          } else if (renderer.type === 'uniqueValue' && renderer.uniqueValueInfos) {
            items = renderer.uniqueValueInfos.map(info => ({
              label: info.label,
              bg: rgbaToHex(info.symbol.color),
              min: 0,
              max: 0
            }));
          }
          
          if (items.length > 0) {
            setDynamicLegend(items);
          } else {
            setDynamicLegend([]);
          }
        } else {
          setDynamicLegend([]);
        }
      } catch (e) {
        logger.error("Discovery error:", e);
        setDynamicLegend([]);
      } finally {
        setLegendLoading(false);
      }
    })();
  }, [activeTab]);
  const getCountryData = useMemo(() => {
    const dataMap: Record<string, { value: number; label: string }> = {};

    if (activeTab === 'CHW') {
      if (chwRates && chwRates.length > 0) {
        chwRates.forEach(item => {
          const chwCount = Number(item.chw);
          const population = Number(item.population);
          const rate = population > 0 ? Number(((chwCount / population) * 10000).toFixed(1)) : 0;
          const normName = normalizeCountryName(item.country);
          dataMap[normName] = {
            value: rate,
            label: `${rate}`
          };
        });
      } else {
        chw.top_region?.forEach((region) => {
          const parts = region.region.split(", ");
          const countryName = parts[parts.length - 1];
          const normName = normalizeCountryName(countryName);
          dataMap[normName] = {
            value: region.percentage,
            label: `${region.percentage}%`
          };
        });
      }
    } else if (activeTab === 'IHR') {
      // Use real IHR scores from the backend
      const yearData = selectedEsparYear
        ? espar.years_data?.find(yd => yd.year === selectedEsparYear)
        : null;
      // If a specific year is selected, use that year's country_scores;
      // otherwise use the latest scores (country_scores at the top level)
      const scores = yearData?.country_scores || espar.country_scores || {};
      Object.entries(scores).forEach(([country, score]) => {
        if (score != null) {
          const normName = normalizeCountryName(country);
          dataMap[normName] = { value: score, label: `${score}%` };
        }
      });
    } else if (activeTab === 'Readiness') {
      readiness.country_completion && Object.entries(readiness.country_completion).forEach(([country, completion]) => {
        const normName = normalizeCountryName(country);
        dataMap[normName] = {
          value: completion,
          label: `${completion}%`
        };
      });
    } else if (activeTab === 'STAR') {
    }

    return dataMap;
  }, [activeTab, chw, espar, africanCountries, selectedEsparYear]);
  const getFeatureStyle = useCallback((feature?: any) => {
    const countryName = feature?.properties?.name || '';
    const normName = normalizeCountryName(countryName);
    const NON_AFRO_COUNTRIES = ['egypt', 'libya', 'tunisia', 'algeria', 'morocco'];
    const isNonAFRO = NON_AFRO_COUNTRIES.some(name =>
      countryName.toLowerCase().includes(name) || normName.includes(name)
    );
    if (isNonAFRO) {
      return {
        fillColor: 'transparent',
        fillOpacity: 0,
        weight: 0,
        opacity: 0,
        color: 'transparent'
      };
    }
    const data = getCountryData[normName];
    const value = data?.value || 0;

    const tabType = activeTab.toLowerCase().replace('-', '') as 'chw' | 'espar' | 'readiness' | 'star' | 'ihr';
    
    let color = 'transparent';
    color = getColor(value, tabType);

    if (color === 'transparent') {
      return {
        fillColor: 'transparent',
        weight: 0,
        opacity: 0,
        color: 'transparent',
        fillOpacity: 0
      };
    }

    return {
      fillColor: color,
      weight: 0.5,
      opacity: 0.15,
      color: '#ffffff',
      fillOpacity: 0.7
    };
  }, [getCountryData, activeTab]);
  const geoJsonKey = useMemo(() => `${activeTab}-${JSON.stringify(getCountryData)}-${dynamicLegend.length}`, [activeTab, getCountryData, dynamicLegend]);

  return (
    <div className="w-full grid grid-cols-1 xl:grid-cols-3 gap-4 h-full">

      <div className={`col-span-2 h-[610px] flex flex-col ${isLight ? 'bg-white border-gray-200' : 'bg-[#0d1424] border-blue-500/20 shadow-blue-500/10'} rounded-xl p-4 relative border shadow-lg`}>

        <div className="w-full h-[500px] rounded-lg overflow-hidden relative" style={{ backgroundColor: !isLight ? '#093055' : '#87CEEB' }}>
          <Suspense fallback={<div className="w-full h-full flex flex-col items-center justify-center text-white/50"><Loader2 className="animate-spin mb-2" size={24} /><span className="text-xs">Loading Unified Map…</span></div>}>
            <UnifiedArcGISMap
              mode={(activeTab === 'Readiness' || activeTab === 'IHR') ? 'geojson' : 'webmap'}
              webMapId={activeTab === 'CHW' ? 'chw' : undefined}
              geoData={(activeTab === 'Readiness' || activeTab === 'IHR') ? africaGeoJson : undefined}
              getCountryStyle={getFeatureStyle}
              isLight={isLight}
              onCountryClick={(attrs) => logger.log('Map feature clicked:', attrs)}
              selectedCountryName={null}
            />
          </Suspense>
        </div>

        <div className={`absolute bottom-3 left-3 ${(activeTab === 'CHW' || activeTab === 'IHR') && !isLight ? 'bg-[#0d1424]/95 border border-white/10 text-gray-300' : 'text-white'} px-3 py-2 rounded-lg text-sm z-[400]`} style={(activeTab === 'CHW' || activeTab === 'IHR') && !isLight ? {} : { textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>
          <div className={`font-bold mb-1.5 text-sm tracking-wide ${(activeTab === 'CHW' || activeTab === 'IHR') && !isLight ? 'text-white' : ''}`}>
            {activeTab === 'IHR' ? `IHR Score ${selectedEsparYear || '2025'}` : activeTab === 'CHW' ? 'CHW per 10k (Official)' : ''}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {activeTab === 'IHR' ? (
              legendLoading ? (
                <div className="flex items-center gap-2 text-gray-500 animate-pulse">
                  <Loader2 className="animate-spin" size={12} />
                  <span>Loading legend...</span>
                </div>
              ) : dynamicLegend.length > 0 ? (
                dynamicLegend.map(d => (
                  <div key={d.label} className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-sm border border-white/50 shadow-md" style={{ backgroundColor: d.bg }} />
                    <span className="text-[10px] font-bold">{d.label}</span>
                  </div>
                ))
              ) : (
                <>
                  <div className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded-sm border border-white/50 shadow-md" style={{ backgroundColor: '#22c55e' }} />
                    <span className="text-[10px] font-bold">≥80</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded-sm border border-white/50 shadow-md" style={{ backgroundColor: '#eab308' }} />
                    <span className="text-[10px] font-bold">60–79</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded-sm border border-white/50 shadow-md" style={{ backgroundColor: '#f97316' }} />
                    <span className="text-[10px] font-bold">40–59</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded-sm border border-white/50 shadow-md" style={{ backgroundColor: '#ef4444' }} />
                    <span className="text-[10px] font-bold">&lt;40</span>
                  </div>
                </>
              )
            ) : activeTab === 'CHW' ? (
              <>
                <div className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-sm border border-white/50 shadow-md" style={{ backgroundColor: '#fee5d9' }} />
                  <span className="text-[10px] font-bold">0 - 50</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-sm border border-white/50 shadow-md" style={{ backgroundColor: '#fcae91' }} />
                  <span className="text-[10px] font-bold">&gt; 50 - 150</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-sm border border-white/50 shadow-md" style={{ backgroundColor: '#fb6a4a' }} />
                  <span className="text-[10px] font-bold">&gt; 150 - 250</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-sm border border-white/50 shadow-md" style={{ backgroundColor: '#de2d26' }} />
                  <span className="text-[10px] font-bold">&gt; 250 - 500</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-sm border border-white/50 shadow-md" style={{ backgroundColor: '#a50f15' }} />
                  <span className="text-[10px] font-bold">&gt; 500</span>
                </div>
              </>
            ) : null}
          </div>
        </div>

      </div>

      <div className={`h-[610px] flex flex-col ${isLight ? 'bg-white border-gray-200' : 'bg-[#0d1424] border-white/5'} rounded-xl p-4 border space-y-5 shadow-lg`}>

        <div className={`flex gap-8 text-sm font-medium ${isLight ? 'text-gray-600' : 'text-gray-400'} flex-shrink-0`}>
          {tabs.map((item) => (
            <button
              key={item}
              onClick={() => { setActivetab(item) }}
              className={`${(activeTab == item) && (isLight ? 'text-[#0093D5]' : 'text-blue-400')} outline-none transition-colors`}
            >
              {item}
            </button>
          ))}
        </div>

        <div className="flex-1 min-h-0 overflow-hidden">
          {(activeTab == 'CHW') ? <CHWPanel data={chw} isLight={isLight} />
            :
            (activeTab == 'IHR') ? (
              <EsparPanel
                data={processedEspar}
                selectedYear={selectedEsparYear}
                onYearSelect={setSelectedEsparYear}
                isLight={isLight}
              />
            )
              :
              (activeTab == 'Readiness') ? <ReadinessPanel data={readiness} isLight={isLight} />
                :
                (activeTab == 'STAR') ? <StardataPanel data={stardata} />
                  :
                  null
          }
        </div>

      </div>

    </div>
  );
}

interface ChwProp {
  data: CHWOverview;
  isLight: boolean;
}
const CHWPanel = memo(function CHWPanel({ data, isLight }: ChwProp) {
  const getRegionColor = (percentage: number): string => {
    if (percentage >= 40) return "#22c55e";
    if (percentage >= 20) return "#84cc16";
    if (percentage >= 10) return "#f59e0b";
    if (percentage > 0) return "#ef4444";
    return "#e5e7eb";
  };
  const validRegions = data.top_region.filter(item => item.percentage > 0);

  return (
    <div className="h-full overflow-y-auto pr-2 custom-scrollbar">
      <div className={`${isLight ? 'text-[#1a1a1a]' : 'text-white'} font-semibold mb-1`}>Global Summary</div>
      <div className="space-y-2 text-sm">
        <div className={`flex justify-between ${isLight ? 'text-gray-700' : 'text-gray-300'}`}>
          <span>Total CHWs</span>
          <span className={`${isLight ? 'text-[#1a1a1a]' : 'text-white'}`}>{data.total_chw.toLocaleString()}</span>
        </div>
        <div className="flex justify-between text-gray-300">
          <span>CHWs per 10k</span>
          <span className={`${isLight ? 'text-[#1a1a1a]' : 'text-white'}`}>{Math.round(Number(data.total_chw_per_10k)).toLocaleString()}</span>
        </div>
        <div className="flex justify-between text-gray-300">
          <span>Countries Covered</span>
          <span className={`${isLight ? 'text-[#1a1a1a]' : 'text-white'}`}>{data.countries.length}</span>
        </div>
        <div className="flex justify-between text-gray-300">
          <span>Regions Covered</span>
          <span className={`${isLight ? 'text-[#1a1a1a]' : 'text-white'}`}>{data.regions}</span>
        </div>
        <div className="flex justify-between text-gray-300">
          <span>District Covered</span>
          <span className={`${isLight ? 'text-[#1a1a1a]' : 'text-white'}`}>{data.districts}</span>
        </div>
      </div>

      <div className="mt-6 flex-shrink-0">
        <div>
          <div className={`${isLight ? 'text-[#1a1a1a]' : 'text-white'} font-semibold mb-0.5`}>Top Regions by CHW Density</div>
          <div className="text-gray-500 text-[10px] mb-3">Community Health Workers per 10,000 population</div>
        </div>
        {validRegions.length > 0 ? (
          <div className="space-y-2.5 text-sm max-h-[140px] overflow-y-auto pr-2 custom-scrollbar">
            {validRegions.map((item, idx) => (
              <div key={idx} className="flex justify-between items-center group">
                <span className={`${isLight ? 'text-gray-700' : 'text-gray-300'} text-xs group-hover:text-blue-400 transition-colors`}>{item.region}</span>
                <div className="flex items-center gap-2">
                  <span className={`${isLight ? 'text-[#1a1a1a]' : 'text-white'} font-semibold text-xs`}>{item.percentage.toFixed(1)}</span>
                  <span className="text-gray-400 text-[10px]">CHWs/10k</span>
                  <span
                    className="w-3 h-3 rounded-full shadow-[0_0_8px_currentColor]"
                    style={{ backgroundColor: getRegionColor(item.percentage) }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-gray-400 text-xs mt-2">No regional data available</div>
        )}
      </div>

      {data.top_countries && data.top_countries.length > 0 && (
        <div className="mt-8 pt-6 border-t border-white/5 flex-shrink-0">
          <div className={`${isLight ? 'text-[#1a1a1a]' : 'text-white'} font-semibold mb-3`}>Top Countries (Density)</div>
          <div className="grid grid-cols-1 gap-3 max-h-[140px] overflow-y-auto pr-2 custom-scrollbar">
            {data.top_countries.map((item, idx) => (
              <div key={idx} className={`p-2 rounded-lg ${isLight ? 'bg-gray-50' : 'bg-white/5'} flex justify-between items-center`}>
                <span className={`text-xs font-medium ${isLight ? 'text-gray-700' : 'text-gray-300'}`}>{item.country}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-blue-400">{item.rate.toFixed(1)}</span>
                  <div className="w-16 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500"
                      style={{ width: `${Math.min(100, (item.rate / 40) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
});

interface EsparProp {
  data: EsparOverview;
  selectedYear: string | null;
  onYearSelect: (year: string | null) => void;
  isLight: boolean;
}
const EsparPanel = memo(function EsparPanel({ data, selectedYear, onYearSelect, isLight }: EsparProp) {
  const COLORS = ['#22c55e', '#f59e0b', '#ef4444']
  const getYearLabel = (year: string, idx: number) => {
    if (idx === 0) return "Most Recent";
    if (idx === data.years.length - 1) return "Baseline";
    return "Assessment";
  };

  return (
    <div className="h-full overflow-y-auto pr-2 custom-scrollbar">
      <div className={`${isLight ? 'text-[#1a1a1a]' : 'text-white'} font-semibold mb-1`}>Regional Summary</div>
      <div className="text-gray-500 text-[10px] mb-2">WHO African Region (AFRO)</div>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between text-gray-300">
          <span className="text-xs">Health Emergency Capacities</span>
          <span className={`${isLight ? 'text-[#1a1a1a]' : 'text-white'} font-semibold text-xs`}>{data.total_capacities}</span>
        </div>
        <div className="flex justify-between text-gray-300">
          <span className="text-xs">African Countries Covered</span>
          <span className={`${isLight ? 'text-[#1a1a1a]' : 'text-white'} font-semibold text-xs`}>{data.countries.length}</span>
        </div>
        <div className="flex justify-between text-gray-300">
          <span className="text-xs">Assessment Years Available</span>
          <span className={`${isLight ? 'text-[#1a1a1a]' : 'text-white'} font-semibold text-xs`}>{data.years.length}</span>
        </div>
        {data.avg_score > 0 && (
          <div className="flex justify-between text-gray-300 pt-1 border-t border-white/5">
            <span className="text-xs">Average Regional Score</span>
            <span className={`${isLight ? 'text-[#1a1a1a]' : 'text-white'} font-semibold text-xs`}>{data.avg_score.toFixed(1)}%</span>
          </div>
        )}
      </div>

      <div className="mt-5">
        <div>
          <div className={`${isLight ? 'text-[#1a1a1a]' : 'text-white'} font-semibold mb-0.5`}>Assessment Coverage</div>
          <div className="text-gray-500 text-[10px] mb-2">Click year to filter map</div>
        </div>
        <div className="space-y-1.5 text-sm">
          {data.years_data && data.years_data.length > 0 ? (
            data.years_data.map((yearData, idx) => (
              <button
                key={idx}
                onClick={() => {
                  const newYear = selectedYear === yearData.year ? null : yearData.year;
                  onYearSelect(newYear);
                }}
                className={`w-full flex justify-between items-center p-2 rounded-lg transition-all outline-none ${selectedYear === yearData.year
                  ? 'bg-blue-500/20 border border-blue-500/50'
                  : 'bg-white/5 hover:bg-white/10 border border-transparent'
                  }`}
              >
                <div className="flex flex-col items-start">
                  <span className={`${isLight ? 'text-[#1a1a1a]' : 'text-white'} text-xs font-medium`}>{yearData.year}</span>
                  <span className="text-gray-500 text-[9px]">
                    {yearData.count} countr{yearData.count === 1 ? 'y' : 'ies'} assessed
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`${isLight ? 'text-[#1a1a1a]' : 'text-white'} font-bold text-xs`}>{yearData.count}</span>
                  {selectedYear === yearData.year && (
                    <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                  )}
                </div>
              </button>
            ))
          ) : (
            data.years.map((item, idx) => (
              <div key={idx} className="flex justify-between items-center p-2 bg-white/5 rounded-lg">
                <span className={`${isLight ? 'text-[#1a1a1a]' : 'text-white'} text-xs font-medium`}>{item} Assessment</span>
                <div className="w-3 h-3 rounded-full bg-gray-500" />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
});

interface ReadinessProp {
  data: ReadinessOverview;
  isLight: boolean;
}
const ReadinessPanel = memo(function ReadinessPanel({ data, isLight }: ReadinessProp) {
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const highPerforming: Array<{ name: string; pct: number }> = [];
  const needsWork: Array<{ name: string; pct: number }> = [];
  const critical: Array<{ name: string; pct: number }> = [];

  if (data?.country_completion) {
    Object.entries(data.country_completion).forEach(([country, pct]) => {
      if (pct === 0) return;

      if (pct >= 70) {
        highPerforming.push({ name: country, pct });
      } else if (pct >= 40) {
        needsWork.push({ name: country, pct });
      } else {
        critical.push({ name: country, pct });
      }
    });
  }
  highPerforming.sort((a, b) => b.pct - a.pct);
  needsWork.sort((a, b) => b.pct - a.pct);
  critical.sort((a, b) => b.pct - a.pct);

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  return (
    <div className="h-full overflow-y-auto pr-2 custom-scrollbar">
      <div className={`${isLight ? 'text-[#1a1a1a]' : 'text-white'} font-semibold mb-1`}>Assessment Progress</div>
      <div className="text-gray-500 text-[10px] mb-2">Country-level readiness completion</div>

      <div className="space-y-2">

        <div className="bg-white/5 p-3 rounded-lg">
          <div className="flex justify-between items-center">
            <span className="text-gray-300 text-xs">Overall Progress</span>
            <span className={`${isLight ? 'text-[#1a1a1a]' : 'text-white'} font-bold text-lg`}>{data.overall_completion.toFixed(1)}%</span>
          </div>
          <div className="w-full bg-gray-700 h-2 rounded-full mt-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all"
              style={{ width: `${data.overall_completion}%` }}
            />
          </div>
        </div>

        {highPerforming.length > 0 && (
          <div>
            <button
              onClick={() => toggleSection('high')}
              className="w-full flex justify-between items-center p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-all outline-none"
            >
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-400" />
                <span className={`${isLight ? 'text-[#1a1a1a]' : 'text-white'} text-xs font-semibold`}>High Performance</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-green-400 text-xs font-bold">{highPerforming.length}</span>
                <span className="text-gray-400 text-xs">{expandedSection === 'high' ? '▼' : '▶'}</span>
              </div>
            </button>
            {expandedSection === 'high' && (
              <div className="mt-1 space-y-1 pl-4 max-h-40 overflow-y-auto">
                {highPerforming.slice(0, 10).map((country, idx) => (
                  <div key={idx} className="flex justify-between items-center text-xs bg-green-500/10 px-2 py-1 rounded">
                    <span className="text-gray-300">{country.name}</span>
                    <span className="text-green-400 font-semibold">{country.pct}%</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {needsWork.length > 0 && (
          <div>
            <button
              onClick={() => toggleSection('medium')}
              className="w-full flex justify-between items-center p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-all outline-none"
            >
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-orange-400" />
                <span className={`${isLight ? 'text-[#1a1a1a]' : 'text-white'} text-xs font-semibold`}>Needs Improvement</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-orange-400 text-xs font-bold">{needsWork.length}</span>
                <span className="text-gray-400 text-xs">{expandedSection === 'medium' ? '▼' : '▶'}</span>
              </div>
            </button>
            {expandedSection === 'medium' && (
              <div className="mt-1 space-y-1 pl-4 max-h-40 overflow-y-auto">
                {needsWork.slice(0, 10).map((country, idx) => (
                  <div key={idx} className="flex justify-between items-center text-xs bg-orange-500/10 px-2 py-1 rounded">
                    <span className="text-gray-300">{country.name}</span>
                    <span className="text-orange-400 font-semibold">{country.pct}%</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {critical.length > 0 && (
          <div>
            <button
              onClick={() => toggleSection('critical')}
              className="w-full flex justify-between items-center p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-all outline-none"
            >
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-400" />
                <span className={`${isLight ? 'text-[#1a1a1a]' : 'text-white'} text-xs font-semibold`}>Critical Attention</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-red-400 text-xs font-bold">{critical.length}</span>
                <span className="text-gray-400 text-xs">{expandedSection === 'critical' ? '▼' : '▶'}</span>
              </div>
            </button>
            {expandedSection === 'critical' && (
              <div className="mt-1 space-y-1 pl-4 max-h-40 overflow-y-auto">
                {critical.slice(0, 10).map((country, idx) => (
                  <div key={idx} className="flex justify-between items-center text-xs bg-red-500/10 px-2 py-1 rounded">
                    <span className="text-gray-300">{country.name}</span>
                    <span className="text-red-400 font-semibold">{country.pct}%</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="pt-2 border-t border-white/10">
          <div className="text-gray-400 text-[10px] space-y-0.5">
            <div>{Object.keys(data.country_completion).length} countries assessed</div>
            <div>{data.total_hazards} hazard types tracked</div>
          </div>
        </div>
      </div>
    </div>
  )
});

interface StardataProp {
  data: StardataOverview
}
const StardataPanel = memo(function StardataPanel({ data }: StardataProp) {
  const COLORS = ['#22c55e', '#22c55e', '#22c55e', '#f59e0b', '#ef4444']
  return (
    <div className="mt-4 flex-1 flex flex-col min-h-0 h-full overflow-y-auto pr-2 custom-scrollbar">
      <div className="space-y-4 text-sm">
        <div className="flex justify-between text-gray-300">
          <span>Countries Covered</span>
          <span className="text-white font-bold">{data.countries}</span>
        </div>
        <div className="flex justify-between text-gray-300">
          <span>Total Hazards</span>
          <span className="text-white font-bold">{data.hazards}</span>
        </div>
        <div className="flex justify-between text-gray-300">
          <span>Active Incidents</span>
          <span className="text-red-400 font-bold">{data.active}</span>
        </div>
      </div>

      <div className="mt-6 flex-1 overflow-y-auto pr-2 space-y-6">
        {data.risk_distribution && (
          <div>
            <div className="text-white font-semibold mb-3">Risk Distribution</div>
            <div className="space-y-3">
              {[
                { label: 'Very High', count: data.risk_distribution.very_high, color: '#ef4444' },
                { label: 'High', count: data.risk_distribution.high, color: '#f97316' },
                { label: 'Moderate', count: data.risk_distribution.moderate, color: '#f59e0b' },
                { label: 'Low', count: data.risk_distribution.low, color: '#3b82f6' },
                { label: 'Very Low', count: data.risk_distribution.very_low, color: '#22c55e' }
              ].map((item, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex justify-between text-[10px] uppercase font-bold tracking-wider">
                    <span style={{ color: item.color }}>{item.label}</span>
                    <span className="text-white">{item.count}</span>
                  </div>
                  <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full transition-all duration-500"
                      style={{
                        backgroundColor: item.color,
                        width: `${data.active > 0 ? (item.count / data.active) * 100 : 0}%`
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <div className="text-white font-semibold mb-2">Available Levels</div>
          <div className="flex flex-wrap gap-2">
            {data.levels.map((item, idx) => (
              <span key={idx} className="px-2 py-1 bg-white/5 rounded text-[10px] text-gray-400 border border-white/10">
                {item}
              </span>
            ))}
          </div>
        </div>

        <div>
          <div className="text-white font-semibold mb-2">Active Periods</div>
          <div className="flex flex-wrap gap-2 text-[10px]">
            {data.years.map((item, idx) => (
              <span key={idx} className="inline-flex items-center gap-1.5 text-gray-400">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                {item}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
});
