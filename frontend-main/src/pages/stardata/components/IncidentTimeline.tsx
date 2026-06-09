import { useEffect, useState } from "react";
import { MapPin, ChevronRight, AlertTriangle, Circle } from "lucide-react";
import { useToast } from "@/contexts/ToastProvider";
import { stardata } from "@/pages/stardata/services/stardata";
import type { StarDataType } from "@/pages/stardata/types/stardata";
import { Updating } from "@/components/Updating";
import SmartPagination from "@/components/usables/SmartPagination";
import { useTheme } from "@/contexts/ThemeContext";

export default function IncidentTimeline({ currentMonth }: { currentMonth?: string }) {
  const { showToast } = useToast();
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const [loading, setLoading] = useState(false);
  const [incidents, setIncidents] = useState<StarDataType[]>();
  const [page, setPage] = useState(1);
  const [count, setCount] = useState(0);
  const PAGE_SIZE = 10;

  useEffect(() => {
    const loadStarDataChart = async () => {
      try {
        setLoading(true);
        const response = await stardata.list(page, PAGE_SIZE, undefined, undefined, currentMonth);
        setCount(response.count);
        setIncidents(response.results);
      } catch (error: any) {
        showToast(error?.message || "An Error Occurred while retrieving data", "error", 5000);
      } finally {
        setLoading(false);
      }
    };
    loadStarDataChart();
  }, [page, currentMonth]);

  return (
    <div className="p-6 space-y-6">

      <div className="flex justify-between items-start">
        <div>
          <h2 className={`text-2xl font-bold ${isLight ? 'text-[#1a1a1a]' : 'text-white'}`}>Incident Timeline</h2>
          <p className={`text-sm mt-1 ${isLight ? 'text-gray-600' : 'text-gray-400'}`}>Chronological list of all incidents and activities</p>
        </div>
        {loading && <Updating />}
      </div>

      <div className="space-y-4 max-h-[600px] overflow-y-auto overflow-x-hidden pr-2 scrollbar-thin scrollbar-thumb-blue-600 scrollbar-track-blue-900/20">
        {incidents?.map((item) => (
          <CleanIncidentCard key={item.id} incident={item} isLight={isLight} />
        ))}
      </div>


      <SmartPagination count={count} pageSize={PAGE_SIZE} currentPage={page} onPageChange={setPage} darkMode={!isLight} />
    </div>
  );
}

interface CardProps {
  incident: StarDataType;
  isLight: boolean;
}

function CleanIncidentCard({ incident, isLight }: CardProps) {
  const getSeverityColor = (severity: string) => {
    const severityLower = severity?.toLowerCase();
    switch (severityLower) {
      case "very high":
        return { bg: "bg-red-600", text: "text-red-500", border: "border-red-500/30" };
      case "high":
        return { bg: "bg-orange-500", text: "text-orange-500", border: "border-orange-500/30" };
      case "moderate":
        return { bg: "bg-yellow-500", text: "text-yellow-500", border: "border-yellow-500/30" };
      case "low":
      case "very low":
        return { bg: "bg-green-600", text: "text-green-500", border: "border-green-500/30" };
      default:
        return { bg: "bg-gray-600", text: "text-gray-500", border: "border-gray-500/30" };
    }
  };

  const colors = getSeverityColor(incident.severity);

  return (
    <div className={`relative backdrop-blur-sm rounded-xl transition-all duration-300 p-5 ${isLight ? 'bg-white border border-gray-200 hover:border-blue-300' : 'bg-[#1E1435]/60 border border-purple-800/20 hover:border-purple-600/40'}`}>

      <div className="absolute -left-10 top-6">
        <div className={`w-3 h-3 rounded-full ${colors.bg}`}></div>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-3">

          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-purple-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <div className="flex items-start justify-between gap-3">
                <h3 className={`text-base font-bold leading-tight ${isLight ? 'text-[#1a1a1a]' : 'text-white'}`}>
                  {incident.hazard}
                </h3>
                <span className={`px-3 py-1 rounded-md ${colors.bg} text-white text-xs font-bold uppercase whitespace-nowrap`}>
                  {incident.severity}
                </span>
              </div>
            </div>
          </div>

          <div className={`flex items-center gap-2 text-sm ml-8 ${isLight ? 'text-gray-600' : 'text-gray-400'}`}>
            <MapPin className="w-4 h-4" />
            <span>{incident.country}</span>
          </div>

          <div className="ml-8 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            <div className="flex items-center gap-2">
              <Circle className="w-1.5 h-1.5 fill-purple-400 text-purple-400" />
              <span className={isLight ? 'text-gray-600' : 'text-gray-400'}>Type:</span>
              <span className={`font-medium ${isLight ? 'text-[#1a1a1a]' : 'text-white'}`}>{incident.main_type_of_hazard || "N/A"}</span>
            </div>
            {incident.risk_level_number && (
              <div className="flex items-center gap-2">
                <span className={isLight ? 'text-gray-600' : 'text-gray-400'}>Risk Score:</span>
                <span className={`font-bold ${colors.text}`}>{incident.risk_level_number}</span>
              </div>
            )}
          </div>

          <div className="ml-8 grid grid-cols-3 gap-3">
            <div className={`rounded-lg p-3 ${isLight ? 'bg-blue-50 border border-blue-200' : 'bg-purple-900/10 border border-purple-700/10'}`}>
              <div className={`text-[10px] uppercase font-semibold mb-1 ${isLight ? 'text-blue-600' : 'text-purple-400'}`}>Severity Level</div>
              <div className={`text-sm font-semibold ${isLight ? 'text-[#1a1a1a]' : 'text-white'}`}>{incident.severity}</div>
              {incident.risk_level && (
                <div className={`text-xs mt-0.5 ${isLight ? 'text-gray-600' : 'text-gray-400'}`}>Risk: {incident.risk_level}</div>
              )}
            </div>

            <div className={`rounded-lg p-3 ${isLight ? 'bg-green-50 border border-green-200' : 'bg-blue-900/10 border border-blue-700/10'}`}>
              <div className={`text-[10px] uppercase font-semibold mb-1 ${isLight ? 'text-green-600' : 'text-blue-400'}`}>Resources</div>
              <div className={`text-sm font-semibold line-clamp-2 ${isLight ? 'text-[#1a1a1a]' : 'text-white'}`}>
                {incident.resources || "Not specified"}
              </div>
            </div>

            <div className={`rounded-lg p-3 ${isLight ? 'bg-orange-50 border border-orange-200' : 'bg-pink-900/10 border border-pink-700/10'}`}>
              <div className={`text-[10px] uppercase font-semibold mb-1 ${isLight ? 'text-orange-600' : 'text-pink-400'}`}>Impact</div>
              <div className={`text-sm font-semibold line-clamp-2 ${isLight ? 'text-[#1a1a1a]' : 'text-white'}`}>
                {incident.impact || "Assessment pending"}
              </div>
            </div>
          </div>

          <div className="ml-8 flex flex-wrap gap-2">
            {incident.health_consequences && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-purple-900/10 rounded-md border border-purple-700/20">
                <span className="text-[10px] text-gray-400">Health Impact:</span>
                <span className="text-xs text-purple-300 font-medium">{incident.health_consequences}</span>
              </div>
            )}
            {incident.frequency && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-900/10 rounded-md border border-blue-700/20">
                <span className="text-[10px] text-gray-400">Frequency:</span>
                <span className="text-xs text-blue-300 font-medium">{incident.frequency}</span>
              </div>
            )}
            {incident.status && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-pink-900/10 rounded-md border border-pink-700/20">
                <span className="text-[10px] text-gray-400">Status:</span>
                <span className="text-xs text-pink-300 font-medium">{incident.status}</span>
              </div>
            )}
          </div>
        </div>

        <button className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-blue-600/80 hover:bg-blue-600 rounded-md text-xs font-semibold text-white transition-colors">
          View Details
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
