import { useToast } from "@/contexts/ToastProvider";
import { readiness } from "@/pages/readiness/services/readiness";
import type { RegionScore } from "@/pages/readiness/types/readiness";
import React, { useEffect, useState } from "react";
import { Loading } from "@/components/Loading";
import { useTheme } from "@/contexts/ThemeContext";
import { TrendingUp, TrendingDown, ShieldCheck, Landmark } from "lucide-react";

interface Prop {
  readinessType: string;
}

const RegionalHeatmap: React.FC<Prop> = ({ readinessType }) => {
  const { showToast } = useToast();
  const { theme } = useTheme();
  const isLight = theme === 'light';

  const [loading, setLoading] = useState(false);
  const [heatMap, setHeatMap] = useState<RegionScore[]>();
  const [sortBy, setSortBy] = useState<'name' | 'score' | 'trust'>('score');
  const [hoveredRegion, setHoveredRegion] = useState<string | null>(null);

  useEffect(() => {
    const loadHeatMap = async () => {
      try {
        setLoading(true);
        const response = await readiness.heatmap(readinessType);
        setHeatMap(response);
      } catch (error: any) {
        showToast(error?.message || "An Error Occurred while retrieving data", "error", 5000);
      } finally {
        setLoading(false);
      }
    };
    loadHeatMap();
  }, [readinessType]);

  const getHeatmapColor = (score: number): string => {
    if (score >= 70) {
      const intensity = Math.min((score - 70) / 30, 1);
      const hue = 120;
      const saturation = isLight ? 60 + intensity * 15 : 70 + intensity * 20;
      const lightness = isLight ? 45 + intensity * 10 : 50 + intensity * 10;
      return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    } else if (score >= 40) {
      const intensity = (score - 40) / 30;
      const hue = isLight ? 40 - intensity * 10 : 45 - intensity * 15;
      const saturation = isLight ? 85 + intensity * 10 : 90;
      const lightness = isLight ? 55 + intensity * 5 : 60;
      return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    } else {
      const intensity = Math.min(score / 40, 1);
      const saturation = isLight ? 75 + intensity * 10 : 85;
      const lightness = isLight ? 50 + intensity * 10 : 55 + intensity * 10;
      return `hsl(0, ${saturation}%, ${lightness}%)`;
    }
  };

  const getCategory = (score: number) => {
    if (score >= 70) return { label: "High", icon: TrendingUp };
    if (score >= 40) return { label: "Medium", icon: TrendingDown };
    return { label: "Low", icon: TrendingDown };
  };

  const sortedData = heatMap ? [...heatMap].sort((a, b) => {
    if (sortBy === 'score') return b.score - a.score;
    if (sortBy === 'trust') return (b.trust_score || 0) - (a.trust_score || 0);
    return a.region.localeCompare(b.region);
  }) : [];
  const avgScore = heatMap && heatMap.length > 0
    ? heatMap.reduce((sum, item) => sum + item.score, 0) / heatMap.length
    : 0;

  const highCount = heatMap?.filter(item => item.score >= 70).length || 0;
  const mediumCount = heatMap?.filter(item => item.score >= 40 && item.score < 70).length || 0;
  const lowCount = heatMap?.filter(item => item.score < 40).length || 0;

  if (loading && !heatMap) return <Loading />;

  return (
    <div className={`p-6 rounded-xl ${isLight ? 'bg-white border border-gray-200' : 'bg-[#1C1607] border border-white/10'}`}>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className={`text-xl font-bold ${isLight ? 'text-[#1a1a1a]' : 'text-white'}`}>
            Regional Readiness Heatmap
          </h1>
          <p className={`text-sm mt-1 ${isLight ? 'text-gray-600' : 'text-neutral-400'}`}>
            Preparedness by country • {heatMap?.length || 0} regions assessed
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setSortBy('score')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${sortBy === 'score'
              ? isLight
                ? 'bg-blue-500 text-white'
                : 'bg-yellow-500 text-black'
              : isLight
                ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                : 'bg-white/10 text-white/70 hover:bg-white/20'
              }`}
          >
            By Score
          </button>
          <button
            onClick={() => setSortBy('trust')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${sortBy === 'trust'
              ? isLight
                ? 'bg-blue-500 text-white'
                : 'bg-yellow-500 text-black'
              : isLight
                ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                : 'bg-white/10 text-white/70 hover:bg-white/20'
              }`}
          >
            By Trust
          </button>
          <button
            onClick={() => setSortBy('name')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${sortBy === 'name'
              ? isLight
                ? 'bg-blue-500 text-white'
                : 'bg-yellow-500 text-black'
              : isLight
                ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                : 'bg-white/10 text-white/70 hover:bg-white/20'
              }`}
          >
            By Name
          </button>
        </div>
      </div>

      <div className={`grid grid-cols-4 gap-4 mb-6 p-4 rounded-lg ${isLight ? 'bg-blue-50' : 'bg-black/30'}`}>
        <div>
          <p className={`text-xs ${isLight ? 'text-gray-600' : 'text-neutral-400'}`}>Average Score</p>
          <p className={`text-2xl font-bold ${isLight ? 'text-blue-600' : 'text-yellow-400'}`}>
            {avgScore.toFixed(1)}%
          </p>
        </div>
        <div>
          <p className={`text-xs ${isLight ? 'text-gray-600' : 'text-neutral-400'}`}>High (≥70%)</p>
          <p className={`text-2xl font-bold ${isLight ? 'text-green-600' : 'text-green-400'}`}>{highCount}</p>
        </div>
        <div>
          <p className={`text-xs ${isLight ? 'text-gray-600' : 'text-neutral-400'}`}>Medium (40-69%)</p>
          <p className={`text-2xl font-bold ${isLight ? 'text-yellow-600' : 'text-yellow-400'}`}>{mediumCount}</p>
        </div>
        <div>
          <p className={`text-xs ${isLight ? 'text-gray-600' : 'text-neutral-400'}`}>Low (&lt;40%)</p>
          <p className={`text-2xl font-bold ${isLight ? 'text-red-600' : 'text-red-400'}`}>{lowCount}</p>
        </div>
      </div>

      {/* Card Grid with 2-row max height and scroll */}
      <div className="max-h-[300px] overflow-y-auto custom-scrollbar pr-2 mb-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 2xl:grid-cols-6 gap-4">
          {sortedData.map((item, index) => {
            const category = getCategory(item.score);
            const bgColor = getHeatmapColor(item.score);
            const isHovered = hoveredRegion === item.region;

            return (
              <div
                key={index}
                onMouseEnter={() => setHoveredRegion(item.region)}
                onMouseLeave={() => setHoveredRegion(null)}
                className={`relative p-4 rounded-xl border transition-all duration-200 cursor-pointer overflow-hidden flex flex-col justify-between ${isHovered ? 'scale-[1.02] z-10' : 'scale-100'
                  } ${isLight ? 'bg-white border-gray-200 hover:border-blue-300' : 'bg-[#0d1424] border-white/5 hover:bg-[#162032]'}`}
                style={{
                  boxShadow: isHovered
                    ? isLight
                      ? '0 8px 16px rgba(0,0,0,0.1)'
                      : '0 8px 24px rgba(0,0,0,0.4)'
                    : 'none'
                }}
              >
                {/* Colored Accent Top Bar */}
                <div
                  className="absolute top-0 left-0 h-1 transition-all duration-300"
                  style={{ width: `${item.score}%`, backgroundColor: bgColor }}
                />

                <div className="flex-1 flex flex-col min-w-0">
                  <div className="flex justify-between items-start mb-2">
                    <p className={`text-xs font-bold truncate pr-2 uppercase ${isLight ? 'text-gray-900' : 'text-gray-300 group-hover:text-white'} transition-colors`} title={item.region}>
                      {item.region}
                    </p>
                    {item.national_only && (
                      <span title="National Level Data Only" className="shrink-0 flex items-center">
                        <Landmark size={12} className={isLight ? "text-gray-400" : "text-gray-500"} />
                      </span>
                    )}
                  </div>

                  <div className="flex items-end gap-1 mb-4 mt-1">
                    <p className={`text-2xl font-black leading-none ${isLight ? 'text-gray-900' : 'text-white'}`}>{item.score.toFixed(1)}<span className="text-sm font-normal text-gray-500">%</span></p>
                  </div>
                </div>

                {/* Details Footer */}
                <div className={`pt-3 border-t flex flex-col gap-2 ${isLight ? 'border-gray-100' : 'border-white/5'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5" title={`${category.label} Readiness`}>
                      <category.icon className="w-3.5 h-3.5" style={{ color: bgColor }} />
                      <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: bgColor }}>{category.label}</span>
                    </div>

                    {item.trust_score !== undefined && (
                      <div className="flex items-center gap-1 bg-white/5 px-1.5 py-0.5 rounded" title={`Evidence Trust Score: ${item.trust_score}%`}>
                        <ShieldCheck size={12} className={item.trust_score >= 50 ? "text-green-400" : "text-yellow-500"} />
                        <span className={`text-[10px] font-bold ${isLight ? 'text-gray-600' : 'text-gray-300'}`}>{item.trust_score.toFixed(0)}%</span>
                      </div>
                    )}
                  </div>

                  {(item.total_indicators !== undefined && item.total_indicators > 0) ? (
                    <div className={`text-[9px] flex justify-between tracking-wider font-semibold uppercase opacity-60 ${isLight ? 'text-gray-500' : 'text-gray-400'}`}>
                      <span>{item.evidence_provided} EV</span>
                      <span>{item.total_indicators} VARS</span>
                    </div>
                  ) : null}
                </div>

                {isHovered && (
                  <div className={`absolute -top-2 -right-2 px-2 py-1 rounded text-xs font-semibold ${isLight ? 'bg-gray-900 text-white' : 'bg-white text-black'}`}>
                    Rank #{index + 1}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className={`flex flex-wrap items-center gap-4 pt-4 border-t text-xs ${isLight ? 'border-gray-200 text-gray-600' : 'border-white/10 text-neutral-400'
        }`}>
        <div className="flex items-center gap-2">
          <span className="w-4 h-4 rounded" style={{ backgroundColor: getHeatmapColor(85) }}></span>
          High (70-100%)
        </div>
        <div className="flex items-center gap-2">
          <span className="w-4 h-4 rounded" style={{ backgroundColor: getHeatmapColor(55) }}></span>
          Medium (40-69%)
        </div>
        <div className="flex items-center gap-2">
          <span className="w-4 h-4 rounded" style={{ backgroundColor: getHeatmapColor(25) }}></span>
          Low (0-39%)
        </div>
        <div className="ml-auto text-xs opacity-70">
          Bar length represents exact score value
        </div>
      </div>
    </div>
  );
};

export default RegionalHeatmap;
