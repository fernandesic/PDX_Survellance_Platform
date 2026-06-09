import React from "react";
import { NavLink, Outlet } from "react-router-dom";
import {
  LayoutDashboard,
  Globe,
  BarChart2,
  Activity,
  FlaskConical,
  Shield,
  Newspaper,
  TrendingUp,
} from "lucide-react";
import clsx from "clsx";
import { useTheme } from "@/contexts/ThemeContext";
import { useThemeColors } from "@/contexts/useThemeColors";

const navItems = [
  { to: "/pip", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/pip/indicators", label: "PIP Indicators", icon: TrendingUp },
  { to: "/pip/surveillance", label: "Surveillance", icon: Activity },
  { to: "/pip/countries", label: "Countries", icon: Globe },
  { to: "/pip/virological", label: "Virological", icon: FlaskConical },
  { to: "/pip/preparedness", label: "Preparedness", icon: Shield },
  { to: "/pip/heatmap", label: "Heatmap Analysis", icon: BarChart2 },
  { to: "/pip/bulletin", label: "Epi Bulletin", icon: Newspaper },
];

export default function PIPLayout() {
  const { theme } = useTheme();
  const colors = useThemeColors();
  const isLight = theme === "light";

  return (
    <div className="flex flex-col h-full overflow-hidden relative">
      {/* Top Tabs Navigation */}
      <div className={clsx(
        "flex-shrink-0 border-b",
        isLight ? "bg-white/80 backdrop-blur-md border-gray-100" : `${colors.bg.primary} border-white/10`
      )}>
        <div className="max-w-7xl pt-4">
          <nav className="flex space-x-4 overflow-x-auto scrollbar-hide pb-0">
            {navItems.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  clsx(
                    "flex items-center gap-2 px-3 py-3 text-sm font-semibold border-b-2 transition-all whitespace-nowrap",
                    isActive
                      ? isLight
                        ? "border-emerald-600 text-emerald-600"
                        : "border-emerald-400 text-emerald-400"
                      : isLight
                        ? "border-transparent text-gray-500 hover:text-emerald-600 hover:border-emerald-200"
                        : "border-transparent text-gray-400 hover:text-emerald-300 hover:border-emerald-800/40"
                  )
                }
              >
                <Icon size={16} />
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
      </div>

      {/* Main Content Area */}
      <div className={clsx("flex-1 overflow-y-auto w-full", isLight ? "bg-transparent" : "bg-transparent")}>
        <div className="p-4 sm:p-6 max-w-[1600px] mx-auto w-full">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
