import { useState, useRef, useEffect } from "react";
import { AlertTriangle, Send, ChevronRight, X, ExternalLink /*, Search, Bell */ } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthProvider";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useLiveFeedWatchlistContext } from "@/contexts/LiveFeedWatchlistContext";
import { AlertLevel } from "@/pages/alerts/types";
import TenantSwitcher from "@/components/layout/TenantSwitcher";


const PAGE_TITLES: Record<string, string> = {
  "/hdis": "Health Diplomacy Intelligence System",
  "/hdis/feed": "Intelligence Feed",
  "/hdis/alerts": "Alerts",
  "/hdis/map": "Risk Map",
  "/hdis/countries": "Country Monitor",
  "/hdis/briefings": "Briefings",
  // "/hdis/admin": "Admin",
  // "/hdis/settings": "Settings",
  "/overview": "Overview",
  "/chw": "Community Health Workers · WHO AFRO Region",
  "/ihr": "IHR",
  "/readiness": "Readiness",
  "/star_tracker": "STAR Tracker",
  "/alerts": "Alerts & Incidents",
  "/alerts-v2": "Alerts & Incidents",
  "/pami": "PAMI",
  "/climate": "Climate",
  "/osl": "OSL",
  "/ihmref": "IHMREF",
  "/simex": "SIMEX",
  "/preparedness": "Preparedness",
  "/chat": "Ask WHO",
  "/pip": "Pandemic Influenza Preparedness",
  "/pip/indicators": "Pandemic Influenza Preparedness · Indicators",
  "/pip/surveillance": "Pandemic Influenza Preparedness · Surveillance",
  "/pip/countries": "Pandemic Influenza Preparedness · Countries",
  "/pip/virological": "Pandemic Influenza Preparedness · Virological",
  "/pip/preparedness": "Pandemic Influenza Preparedness · Preparedness",
  "/pip/heatmap": "Pandemic Influenza Preparedness · Heatmap",
  "/pip/bulletin": "Pandemic Influenza Preparedness · Bulletin",
};

const ASK_WHO_SUGGESTIONS = [
  {
    category: "STAR Hazards", queries: [
      "What are the high-risk hazards in East Africa?",
      "Which countries have very high risk scores?",
    ]
  },
  {
    category: "Alerts & Incidents", queries: [
      "Show me the latest critical disease signals",
      "Any active outbreak alerts in West Africa?",
    ]
  },
  {
    category: "IHR Capacities", queries: [
      "What is the IHR score for Nigeria?",
      "Compare IHR capacities across AFRO countries",
    ]
  },
  {
    category: "Climate & Health", queries: [
      "Climate-related health risks this season",
      "Which regions face climate-driven outbreaks?",
    ]
  },
  {
    category: "CHW & Readiness", queries: [
      "CHW density statistics for Kenya",
      "Readiness completion rates for Mpox",
    ]
  },
];

export default function TopBar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const { user } = useAuth();
  const { data } = useLiveFeedWatchlistContext();
  // const isHdis = pathname.startsWith('/hdis');
  // const [searchParams] = useSearchParams();
  // const { data: hdisAlerts } = useAlerts({ enabled: isHdis });

  const [askWhoQuery, setAskWhoQuery] = useState("");
  // const [hdisSearchQuery, setHdisSearchQuery] = useState(searchParams.get("q") || "");
  const [showAskWhoDropdown, setShowAskWhoDropdown] = useState(false);
  const [showAlertPanel, setShowAlertPanel] = useState(false);
  const askWhoRef = useRef<HTMLDivElement>(null);
  const alertRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (askWhoRef.current && !askWhoRef.current.contains(e.target as Node)) {
        setShowAskWhoDropdown(false);
      }
      if (alertRef.current && !alertRef.current.contains(e.target as Node)) {
        setShowAlertPanel(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const liveFeedItems = data?.liveFeed || [];

  const criticalCount = liveFeedItems.filter((item: any) => {
    const priority = item.priority || 'P4';
    return priority === 'P1' || priority === AlertLevel.CRITICAL;
  }).length;

  const totalAlerts = liveFeedItems.length;

  // const hdisCriticalCount = hdisAlerts?.filter((a) => a.risk_level === "critical" && !a.acknowledged_by).length ?? 0;
  // const hdisUnackCount = hdisAlerts?.filter((a) => !a.acknowledged_by).length ?? 0;

  const pageTitle = PAGE_TITLES[pathname] || "Dashboard";

  const getPriorityStyle = (priority: string) => {
    switch (priority) {
      case 'P1': return { bg: 'bg-red-500', text: 'text-red-500', label: 'Critical' };
      case 'P2': return { bg: 'bg-orange-500', text: 'text-orange-500', label: 'High' };
      case 'P3': return { bg: 'bg-yellow-500', text: 'text-yellow-500', label: 'Medium' };
      default: return { bg: 'bg-blue-400', text: 'text-blue-400', label: 'Low' };
    }
  };

  const handleAskWho = (query?: string) => {
    const q = query || askWhoQuery;
    if (!q.trim()) return;
    navigate('/chat', { state: { prefill: q } });
    setAskWhoQuery("");
    setShowAskWhoDropdown(false);
  };

  // const handleHdisSearch = () => {
  //   if (hdisSearchQuery.trim()) {
  //     navigate(`/hdis/feed?q=${encodeURIComponent(hdisSearchQuery.trim())}`);
  //   } else {
  //     navigate("/hdis/feed");
  //   }
  // };

  const userRole = user?.is_supervisor ? 'Supervisor' : (user?.role || 'User');

  return (
    <div className={`w-full flex items-center justify-between px-5 py-2 border-b relative z-50 ${isLight ? 'border-gray-200 bg-white/60 backdrop-blur-sm' : 'border-white/5 bg-black/20 backdrop-blur-sm'}`}>

      {/* Left: Page title */}
      <div className="flex items-center gap-2 min-w-0">
        <h1 className={`text-sm font-semibold truncate ${isLight ? 'text-gray-800' : 'text-white'}`}>
          {pageTitle}
        </h1>
      </div>

      {/* Center: Alert Badge + Ask WHO + HDIS */}
      <div className="flex items-center gap-3 flex-1 justify-center max-w-2xl mx-4">

        {/* Critical Alert Badge */}
        <div className="relative flex-shrink-0" ref={alertRef}>
          <button
            onClick={() => setShowAlertPanel(!showAlertPanel)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all duration-200
              ${criticalCount > 0
                ? (isLight ? 'bg-red-50 border border-red-200 hover:bg-red-100' : 'bg-red-500/10 border border-red-500/20 hover:bg-red-500/20')
                : (isLight ? 'bg-gray-50 border border-gray-200 hover:bg-gray-100' : 'bg-white/5 border border-white/10 hover:bg-white/10')
              }`}
            title="View alerts"
          >
            <div className="relative">
              <AlertTriangle size={13} className={criticalCount > 0 ? 'text-red-500' : (isLight ? 'text-gray-400' : 'text-gray-500')} />
              {criticalCount > 0 && (
                <div className="absolute -top-1 -right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
              )}
            </div>
            <span className={`text-[11px] font-medium ${criticalCount > 0 ? 'text-red-600' : (isLight ? 'text-gray-500' : 'text-gray-400')}`}>
              {criticalCount > 0 ? `${criticalCount} Critical` : `${totalAlerts} Signals`}
            </span>
          </button>

          {/* Alert Dropdown Panel */}
          {showAlertPanel && (
            <div className={`absolute top-full mt-2 left-0 w-[360px] rounded-xl shadow-2xl border overflow-hidden
              ${isLight ? 'bg-white border-gray-200' : 'bg-[#111827] border-white/10'}`}>

              {/* Panel header */}
              <div className={`flex items-center justify-between px-4 py-3 border-b ${isLight ? 'border-gray-100' : 'border-white/5'}`}>
                <span className={`text-sm font-semibold ${isLight ? 'text-gray-800' : 'text-white'}`}>Live Signals</span>
                <button onClick={() => setShowAlertPanel(false)} className={`p-0.5 rounded ${isLight ? 'hover:bg-gray-100' : 'hover:bg-white/10'}`}>
                  <X size={14} className={isLight ? 'text-gray-400' : 'text-gray-500'} />
                </button>
              </div>

              {/* Alert items */}
              <div className="max-h-[300px] overflow-y-auto">
                {liveFeedItems.length === 0 ? (
                  <div className={`px-4 py-8 text-center text-sm ${isLight ? 'text-gray-400' : 'text-gray-500'}`}>
                    No active signals
                  </div>
                ) : (
                  liveFeedItems.slice(0, 8).map((item: any, idx: number) => {
                    const priority = item.priority || 'P4';
                    const style = getPriorityStyle(priority);
                    return (
                      <div
                        key={idx}
                        className={`px-4 py-2.5 border-b last:border-b-0 transition-colors ${isLight ? 'border-gray-50 hover:bg-gray-50' : 'border-white/[0.03] hover:bg-white/[0.03]'}`}
                      >
                        <div className="flex items-start gap-2.5">
                          <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${style.bg}`} />
                          <div className="min-w-0 flex-1">
                            <p className={`text-xs font-medium leading-snug truncate ${isLight ? 'text-gray-800' : 'text-gray-200'}`}>
                              {item.headline || item.title || 'Unknown Signal'}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className={`text-[10px] ${isLight ? 'text-gray-400' : 'text-gray-500'}`}>
                                {item.country || 'Unknown'}
                              </span>
                              <span className={`text-[10px] font-medium ${style.text}`}>
                                {style.label}
                              </span>
                              {item.source && (
                                <span className={`text-[10px] ${isLight ? 'text-gray-400' : 'text-gray-500'}`}>
                                  · {item.source}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* View All button */}
              <button
                onClick={() => {
                  setShowAlertPanel(false);
                  navigate('/alerts');
                }}
                className={`w-full flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-medium transition-colors border-t
                  ${isLight
                    ? 'border-gray-100 text-[#0093D5] hover:bg-[#0093D5]/5'
                    : 'border-white/5 text-cyan-400 hover:bg-cyan-400/5'
                  }`}
              >
                View All Alerts
                <ExternalLink size={11} />
              </button>
            </div>
          )}
        </div>

        {/* Global Ask WHO Search */}
        <div className={`relative flex-1 max-w-sm`} ref={askWhoRef}>
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all duration-200 border
            ${showAskWhoDropdown
              ? (isLight ? 'bg-white border-[#0093D5]/30 shadow-sm' : 'bg-white/10 border-cyan-500/30')
              : (isLight ? 'bg-gray-50 border-gray-200 hover:border-gray-300' : 'bg-white/5 border-white/10 hover:border-white/15')
            }`}
          >
            <img src="/assets/logo-chat.png" alt="Ask WHO" className="w-4 h-4 object-contain flex-shrink-0" />
            <input
              type="text"
              placeholder="Ask WHO anything..."
              value={askWhoQuery}
              onChange={(e) => setAskWhoQuery(e.target.value)}
              onFocus={() => setShowAskWhoDropdown(true)}
              onKeyDown={(e) => e.key === 'Enter' && handleAskWho()}
              className={`bg-transparent text-xs outline-none w-full placeholder:text-gray-400 ${isLight ? 'text-gray-700' : 'text-gray-200'}`}
            />
            {askWhoQuery && (
              <button
                onClick={() => handleAskWho()}
                className={`p-0.5 rounded transition-colors ${isLight ? 'text-[#0093D5] hover:bg-[#0093D5]/10' : 'text-cyan-400 hover:bg-cyan-400/10'}`}
              >
                <Send size={12} />
              </button>
            )}
          </div>

          {/* Ask WHO Suggestions Dropdown */}
          {showAskWhoDropdown && !askWhoQuery && (
            <div className={`absolute top-full mt-2 left-0 right-0 rounded-xl shadow-2xl border overflow-hidden
              ${isLight ? 'bg-white border-gray-200' : 'bg-[#111827] border-white/10'}`}>

              <div className={`px-4 py-2.5 border-b ${isLight ? 'border-gray-100' : 'border-white/5'}`}>
                <span className={`text-[11px] font-medium uppercase tracking-wider ${isLight ? 'text-gray-400' : 'text-gray-500'}`}>
                  Quick Topics
                </span>
              </div>

              <div className="max-h-[280px] overflow-y-auto py-1">
                {ASK_WHO_SUGGESTIONS.map((group, gIdx) => (
                  <div key={gIdx}>
                    <div className={`px-4 py-1.5`}>
                      <span className={`text-[11px] font-semibold ${isLight ? 'text-gray-500' : 'text-gray-400'}`}>
                        {group.category}
                      </span>
                    </div>
                    {group.queries.map((q, qIdx) => (
                      <button
                        key={qIdx}
                        onMouseDown={(e) => { e.preventDefault(); handleAskWho(q); }}
                        className={`w-full text-left px-4 pl-9 py-1.5 text-xs transition-colors flex items-center gap-1.5
                          ${isLight ? 'text-gray-600 hover:bg-gray-50 hover:text-[#0093D5]' : 'text-gray-400 hover:bg-white/[0.03] hover:text-cyan-400'}`}
                      >
                        <ChevronRight size={10} className="opacity-40 flex-shrink-0" />
                        <span className="truncate">{q}</span>
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* HDIS Specific Search/Action Bar — COMMENTED OUT (search bar, critical alert badge, notification bell) */}
      </div>

      {/* Right: Tenant Switcher + Role + Theme */}
      <div className="flex items-center gap-3 flex-shrink-0">
        {/* Tenant Switcher (only visible for super admins) */}
        <TenantSwitcher />

        {/* User role badge */}
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium
          ${isLight ? 'bg-[#0093D5]/8 text-[#0093D5]' : 'bg-cyan-500/10 text-cyan-400'}`}>
          <div className={`w-1.5 h-1.5 rounded-full ${isLight ? 'bg-[#0093D5]' : 'bg-cyan-400'}`} />
          {userRole}
        </div>

        {/* Divider */}
        <div className={`w-px h-5 ${isLight ? 'bg-gray-200' : 'bg-white/10'}`} />

        {/* Theme toggle */}
        <ThemeToggle variant="pill" />
      </div>
    </div >
  );
}
