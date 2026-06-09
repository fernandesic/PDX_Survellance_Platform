import { NavLink } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { QUERY_KEYS } from "@/hooks/queries/queryKeys";
import { fetchOverview } from "@/hooks/queries/useOverviewQuery";
import { fetchCHWData } from "@/hooks/queries/useCHWDataQuery";
import {
  LayoutGrid, Users, Shield, AlertTriangle, MapPin, Bell, FileText, Cloud, Map, Menu, LogOut, Loader2, ClipboardList, Brain, Navigation, Globe, Activity, Syringe, Flag, CheckCircle2
} from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthProvider";
import { authService } from "@/services/auth_service";
import { useState } from "react";

interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
}

export default function Sidebar({ isCollapsed, onToggle }: SidebarProps) {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const { clear, user } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const queryClient = useQueryClient();

  const handlePrefetch = (path: string) => {
    if (path === '/overview') {
      queryClient.prefetchQuery({ queryKey: [...QUERY_KEYS.overview, false], queryFn: () => fetchOverview(false), staleTime: 5 * 60 * 1000 });
    } else if (path === '/chw') {
      queryClient.prefetchQuery({ queryKey: QUERY_KEYS.chwStats, queryFn: fetchCHWData, staleTime: 5 * 60 * 1000 });
    }
    // ... we can easily extend this to other menus as we refactor them
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    // Brief delay for a smooth transition feel
    await new Promise(resolve => setTimeout(resolve, 800));
    clear();
    await authService.logout();
  };
  const links = [
    {
      name: "Overview",
      path: "/overview",
      abbr: "OV",
      icon: <LayoutGrid size={18} />,
    },
    {
      name: "CHW Distribution",
      path: "/chw",
      abbr: "CHW",
      icon: <Users size={18} />,
    },
    {
      name: "IHR",
      path: "/ihr",
      abbr: "IHR",
      icon: <Shield size={18} />,
    },
    {
      name: "Readiness",
      path: "/readiness",
      abbr: "RD",
      icon: <AlertTriangle size={18} />,
    },
    {
      name: "STAR Tracker",
      path: "/star_tracker",
      abbr: "STAR",
      icon: <MapPin size={18} />,
    },
    {
      name: "Alerts & Incidents",
      path: "/alerts-v2",
      abbr: "AL",
      icon: <Bell size={18} />,
    },
    {
      name: "PAMI",
      path: "/pami",
      abbr: "PAMI",
      icon: <Map size={18} />,
    },
    {
      name: "Predictions",
      path: "/predictions",
      abbr: "PRD",
      icon: <Brain size={18} />,
    },
    {
      name: "Verification",
      path: "/verification",
      abbr: "VER",
      icon: <CheckCircle2 size={18} />,
    },
    {
      name: "Points of Entry",
      path: "/poe",
      abbr: "POE",
      icon: <Navigation size={18} />,
    },
    {
      name: "One Health",
      path: "/oneHealth",
      abbr: "OH",
      icon: <Globe size={18} />,
    },
    {
      name: "OCV Intelligence",
      path: "/ocv",
      abbr: "OCV",
      icon: <Syringe size={18} />,
    },
    {
      name: "PIP",
      path: "/pip",
      abbr: "PIP",
      icon: <ClipboardList size={18} />,
    },
    // {
    //   name: "HDIS",
    //   path: "/hdis",
    //   abbr: "HI",
    //   icon: <Globe size={18} />,
    // },
    {
      name: "HDIS",
      path: "/hdis",
      abbr: "HP",
      icon: <Activity size={18} />,
    },
    {
      name: "Climate",
      path: "/climate",
      abbr: "CL",
      icon: <Cloud size={18} />,
    },
    {
      name: "OSL",
      path: "/osl",
      abbr: "OSL",
      icon: <FileText size={18} />,
    },
    {
      name: "IHMREF",
      path: "/ihmref",
      abbr: "IHM",
      icon: <FileText size={18} />,
    },
    {
      name: "SIMEX",
      abbr: "SMX",
      path: "/simex",
      icon: <FileText size={18} />,
    },
    ...(user?.is_supervisor ? [{
      name: "Preparedness",
      abbr: "PR",
      path: "/preparedness",
      icon: <ClipboardList size={18} />,
    }] : []),
    ...(user?.is_supervisor ? [{
      name: "SITREP",
      abbr: "SR",
      path: "/sitrep",
      icon: <FileText size={18} />,
    }] : []),
    {
      name: "Ghana PDX",
      path: "/ghanaPdx",
      abbr: "GH",
      icon: <Flag size={18} />,
    },
  ];

  const renderIcon = (item: typeof links[0], isActive: boolean) => {
    if (isCollapsed) {
      return (
        <div className={`w-10 h-10 flex items-center justify-center rounded-lg font-bold text-[10px] transition-all duration-200
          ${isActive
            ? (isLight ? 'text-[#0093D5]' : 'text-white')
            : isLight
              ? 'text-gray-500 hover:text-gray-900 transition-colors'
              : 'text-gray-400 hover:text-white transition-colors'}`}>
          {item.abbr}
        </div>
      );
    }
    return (
      <div className={`transition-colors duration-200 ${isActive ? (isLight ? 'text-[#0093D5]' : 'text-white') : (isLight ? 'text-gray-500' : 'text-gray-400')}`}>
        {item.icon}
      </div>
    );
  };

  return (
    <div className={`${isCollapsed ? 'w-20' : 'w-64'} h-screen flex flex-col px-3 py-2 flex-shrink-0 transition-all duration-300 relative
                     ${isLight
        ? 'bg-[#f7f7f7] text-[#1a1a1a]'
        : 'text-white'}`}>

      {/* Logo — click to toggle sidebar */}
      <button
        onClick={onToggle}
        className={`group w-full mb-2 py-3 px-1 rounded-xl transition-all duration-200 cursor-pointer
                   ${isLight ? 'hover:bg-gray-100' : 'hover:bg-white/5'}`}
        title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {isCollapsed ? (
          <div className="relative w-10 h-10 mx-auto flex items-center justify-center">
            <img
              src={isLight ? "/assets/logo/light-pdx-without-text.webp" : "/assets/logo/dark-pdx-without-text.webp"}
              alt="PDX"
              loading="eager"
              fetchPriority="high"
              className="w-10 h-10 object-contain rounded-md opacity-90 group-hover:opacity-60 transition-opacity duration-200"
            />
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <Menu size={18} className={isLight ? 'text-[#00B4D8]' : 'text-cyan-400'} />
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center w-full">
            <img
              src={isLight ? "/assets/logo/light-pdx-without-text.webp" : "/assets/logo/dark-pdx-without-text.webp"}
              alt="PDX"
              loading="eager"
              fetchPriority="high"
              className="w-32 h-28 object-contain rounded-md flex-shrink-0"
            />
            <div className="text-center px-2 -mt-3">
              <span className={`text-[10px] font-bold tracking-wider uppercase whitespace-nowrap ${isLight ? 'text-gray-700' : 'text-gray-200'}`}>
                Preparedness Data Exchange
              </span>
            </div>
          </div>
        )}
      </button>
      <div className={`mx-1 mb-2 border-b ${isLight ? 'border-gray-200' : 'border-white/5'}`} />
      <div className="flex-1 min-h-0 flex flex-col overflow-y-auto scrollbar-hide py-2">
        <nav className="flex flex-col space-y-1">
          {
            links.map((item, i) => (
              <NavLink
                key={i}
                to={item.path}
                className={({ isActive }: { isActive: boolean }) =>
                  `flex items-center ${isCollapsed ? 'justify-center py-2' : 'justify-start p-3'} rounded-lg cursor-pointer transition-all duration-200
                 ${isActive
                    ? (isLight
                      ? "bg-[#0093D5]/[0.07] border-l-[3px] border-[#0093D5]"
                      : "bg-white/[0.05] border-l-[3px] border-[#4db8ff]")
                    : (isLight
                      ? "text-[#1a1a1a] hover:bg-gray-100 border-l-[3px] border-transparent"
                      : "text-gray-300 hover:bg-white/[0.03] border-l-[3px] border-transparent")}`
                }
                onMouseEnter={() => handlePrefetch(item.path)}
                title={isCollapsed ? item.name : undefined}
              >
                {({ isActive }: { isActive: boolean }) => (
                  <div className={`flex items-center ${isCollapsed ? '' : 'space-x-3'}`}>
                    {renderIcon(item, isActive)}
                    {!isCollapsed && <span className={`text-sm font-medium ${isActive ? (isLight ? 'text-[#0093D5]' : 'text-white') : (isLight ? 'text-gray-600' : 'text-gray-400')}`}>{item.name}</span>}
                  </div>
                )}
              </NavLink>
            ))
          }
        </nav>

        <div className={`mt-2 pb-2 ${isCollapsed ? 'px-1' : ''}`}>
          <button
            onClick={handleLogout}
            disabled={isLoggingOut}
            className={`flex items-center w-full ${isCollapsed ? 'justify-center py-3' : 'space-x-3 p-3'} rounded-xl cursor-pointer transition-all duration-200
                       ${isLoggingOut ? 'opacity-50 cursor-not-allowed' : ''}
                       ${isLight
                ? "text-red-600 hover:bg-red-50"
                : "text-red-400 hover:bg-red-400/10"
              }`}
            title={isCollapsed ? "Logout" : undefined}
          >
            <div className={`${isCollapsed ? '' : 'flex-shrink-0'}`}>
              {isLoggingOut ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <LogOut size={18} />
              )}
            </div>
            {!isCollapsed && (
              <span className="text-sm font-medium">
                {isLoggingOut ? 'Logging out...' : 'Logout'}
              </span>
            )}
          </button>
        </div>
      </div>
      {user?.role !== 'user' && (
        <div className={`mt-auto pt-2 flex-shrink-0 ${isLight ? 'border-t border-gray-200' : 'border-t border-white/10'}`}>
          <NavLink
            to="/chat"
            className={({ isActive }: { isActive: boolean }) =>
              `flex items-center ${isCollapsed ? 'justify-center' : 'space-x-3'} p-3 rounded-xl cursor-pointer transition-all duration-200
             ${isActive
                ? (isLight
                  ? "bg-[#0093D5]/10 text-[#0093D5] shadow-sm shadow-[#0093D5]/10"
                  : "bg-cyan-500/10 text-white")
                : (isLight
                  ? "text-[#1a1a1a] hover:bg-gray-200"
                  : "text-gray-300 hover:bg-white/5 hover:text-white")
              }`
            }
            title={isCollapsed ? "Ask WHO" : undefined}
          >
            <div className={`${isCollapsed ? 'w-8 h-8' : 'w-10 h-10'} flex items-center justify-center flex-shrink-0`}>
              <img src="/assets/logo-chat.png" alt="Ask WHO" className="w-full h-full object-contain" />
            </div>
            {!isCollapsed && (
              <div className="flex flex-col">
                <span className="text-base font-semibold">Ask WHO</span>
                <span className={`text-xs ${isLight ? 'text-gray-500' : 'text-gray-400'}`}>Ask anything</span>
              </div>
            )}
          </NavLink>
        </div>
      )}
    </div >
  );
}
