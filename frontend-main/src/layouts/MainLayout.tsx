import { useState } from "react";
import Sidebar from "@/components/layout/Sidebar";
import TopBar from "@/components/layout/Topbar";
import { Outlet, useLocation } from "react-router-dom";
import PHEICAlert from "@/components/PHEICAlert/PHEICAlert";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthProvider";

const MainLayout: React.FC = () => {
    const { pathname } = useLocation();
    const { theme } = useTheme();
    const { user } = useAuth();
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

    const gradients: Record<string, { dark: string; light: string }> = {
        "/overview": {
            dark: "bg-gradient-to-br from-[#0B1120] via-[#070B14] to-[#04060A]",
            light: "bg-gradient-to-br from-slate-50 via-blue-50 to-white"
        },
        "/chw": {
            dark: "bg-gradient-to-br from-[#082e23] via-[#00130d] to-[#001a11]",
            light: "bg-gradient-to-br from-emerald-50 via-green-50 to-white"
        },
        "/ihr": {
            dark: "bg-gradient-to-br from-[#0D2424] via-[#041414] to-[#020808]",
            light: "bg-gradient-to-br from-teal-50 via-cyan-50 to-white"
        },
        "/readiness": {
            dark: "bg-gradient-to-br from-[#362A0E] via-[#100C03] to-[#100C03]",
            light: "bg-gradient-to-br from-amber-50 via-yellow-50 to-white"
        },
        "/star_tracker": {
            dark: "bg-gradient-to-br from-[#2A1A3F] via-[#170928] to-[#10041F]",
            light: "bg-gradient-to-br from-purple-50 via-violet-50 to-white"
        },
        "/alerts": {
            dark: "bg-gradient-to-br from-[#141414] via-[#0a0a0a] to-[#050505]",
            light: "bg-gradient-to-br from-[#fafafa] via-[#f5f5f5] to-white"
        },
        "/chat": {
            dark: "bg-gradient-to-br from-[#090b14] via-[#05070a] to-[#010204]",
            light: "bg-gradient-to-br from-indigo-50 via-blue-50 to-white"
        },
        "/climate": {
            dark: "bg-gradient-to-br from-[#0a1b24] via-[#040d12] to-[#020508]",
            light: "bg-gradient-to-br from-slate-50 via-gray-50 to-white"
        },
        "/preparedness": {
            dark: "bg-gradient-to-br from-[#0a1628] via-[#0c1a30] to-[#04080f]",
            light: "bg-gradient-to-br from-blue-50 via-indigo-50 to-white"
        },
        "/hdis": {
            dark: "bg-gradient-to-br from-[#0c111d] via-[#060a12] to-[#020408]",
            light: "bg-[#f7f7f7]"
        },
        "/hdis-pro": {
            dark: "bg-gradient-to-br from-[#0c111d] via-[#060a12] to-[#020408]",
            light: "bg-[#f7f7f7]"
        },
        "/oneHealth": {
            dark: "bg-gradient-to-br from-[#0d1b2a] via-[#091119] to-[#04080c]",
            light: "bg-[#f0f7fa]"
        },
        "/ocv": {
            dark: "bg-gradient-to-br from-[#06142a] via-[#030a17] to-[#01050c]",
            light: "bg-gradient-to-br from-cyan-50 via-blue-50 to-white"
        },
        "/pip": {
            dark: "bg-gradient-to-br from-[#1a0b12] via-[#0d0509] to-[#050103]",
            light: "bg-gradient-to-br from-rose-50 via-pink-50 to-white"
        },
        "/predictions": {
            dark: "bg-gradient-to-br from-[#0f111a] via-[#0a0c14] to-[#05060b]",
            light: "bg-gradient-to-br from-violet-50 via-purple-50 to-white"
        },
        "/poe": {
            dark: "bg-gradient-to-br from-[#1a120b] via-[#0d0805] to-[#050301]",
            light: "bg-gradient-to-br from-orange-50 via-stone-50 to-white"
        },
        "/pami": {
            dark: "bg-gradient-to-br from-[#0B1A2D] via-[#07111D] to-[#04080F]",
            light: "bg-gradient-to-br from-blue-50 via-indigo-50 to-white"
        },
        "/ihmref": {
            dark: "bg-gradient-to-br from-[#1a0f1a] via-[#0d070d] to-[#050305]",
            light: "bg-gradient-to-br from-fuchsia-50 via-pink-50 to-white"
        },
        "/simex": {
            dark: "bg-gradient-to-br from-[#0f1a1a] via-[#070d0d] to-[#030505]",
            light: "bg-gradient-to-br from-teal-50 via-emerald-50 to-white"
        },
    };

    const defaultGradient = {
        dark: "bg-gradient-to-br from-[#050810] via-[#050810] to-[#020408]",
        light: "bg-[#f7f7f7]"
    };

    // Find the best matching gradient by checking route prefixes (longest prefix first)
    const sortedPaths = Object.keys(gradients).sort((a, b) => b.length - a.length);
    const matchedPath = sortedPaths.find(path => pathname.startsWith(path));
    
    const currentGradient = matchedPath ? gradients[matchedPath] : defaultGradient;
    const layoutGradient = theme === 'light' ? currentGradient.light : currentGradient.dark;

    return (
        <div className={`flex font-Fellix ${layoutGradient} relative theme-transition`}>
            <div className="sticky top-0 h-screen shrink-0" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                <Sidebar isCollapsed={isSidebarCollapsed} onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)} />
            </div>
            <main className="flex-1 flex flex-col min-h-screen min-w-0">
                <TopBar />
                <div className="grow min-w-0 overflow-y-auto">
                    <Outlet />
                </div>

                {/* WHO logo — fixed bottom-right institutional watermark */}
                <div
                    className="fixed bottom-3 right-3 z-[9990] pointer-events-none"
                    style={{ padding: '12px' }}
                >
                    <img
                        src={theme === 'light' ? '/logo-blue.png' : '/logo.png'}
                        alt="WHO"
                        className="w-16 h-auto object-contain opacity-60 select-none"
                        style={{ filter: theme === 'dark' ? 'drop-shadow(0 1px 4px rgba(0,0,0,0.5))' : 'none' }}
                    />
                </div>


            </main>

            {/* Cross-page PHEIC popup — self-gates on session dismissal +
                only renders if a confirmed critical outbreak exists. Safe to
                mount on every authenticated page. */}
            <PHEICAlert />
        </div>
    );
}

export default MainLayout;
