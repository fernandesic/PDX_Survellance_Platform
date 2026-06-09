import { useState, useEffect, lazy, Suspense } from "react";
const Globe3D = lazy(() => import("@/components/usables/Globe3D"));
import { useNavigate } from "react-router-dom";



export default function GlobalMap() {
    const navigate = useNavigate();
    const [showContent, setShowContent] = useState(false);
    const [mountGlobe, setMountGlobe] = useState(false);

    useEffect(() => {
        setTimeout(() => setShowContent(true), 100);

        let timerId: any;
        if ('requestIdleCallback' in window) {
            timerId = (window as any).requestIdleCallback(() => setMountGlobe(true), { timeout: 2000 });
        } else {
            timerId = setTimeout(() => setMountGlobe(true), 500);
        }
        
        return () => {
            if ('cancelIdleCallback' in window && timerId) {
                (window as any).cancelIdleCallback(timerId);
            } else {
                clearTimeout(timerId);
            }
        };
    }, []);

    const getColorClasses = (color: string) => {
        const colors: Record<string, { border: string; bg: string; text: string; hover: string }> = {
            cyan: { border: "border-cyan-500/30", bg: "bg-cyan-500/10", text: "text-cyan-400", hover: "hover:border-cyan-500/60 hover:bg-cyan-500/20" },
            red: { border: "border-red-500/30", bg: "bg-red-500/10", text: "text-red-400", hover: "hover:border-red-500/60 hover:bg-red-500/20" },
            blue: { border: "border-blue-500/30", bg: "bg-blue-500/10", text: "text-blue-400", hover: "hover:border-blue-500/60 hover:bg-blue-500/20" },
            green: { border: "border-green-500/30", bg: "bg-green-500/10", text: "text-green-400", hover: "hover:border-green-500/60 hover:bg-green-500/20" },
            purple: { border: "border-purple-500/30", bg: "bg-purple-500/10", text: "text-purple-400", hover: "hover:border-purple-500/60 hover:bg-purple-500/20" },
            orange: { border: "border-orange-500/30", bg: "bg-orange-500/10", text: "text-orange-400", hover: "hover:border-orange-500/60 hover:bg-orange-500/20" }
        };
        return colors[color] || colors.cyan;
    };

    return (
        <div className="relative w-full h-screen overflow-hidden bg-[#020817]">

            <div className="absolute inset-0 z-0">
                {mountGlobe ? (
                    <Suspense fallback={<div className="w-full h-full bg-[#020817]" />}>
                        <Globe3D />
                    </Suspense>
                ) : (
                    <div className="w-full h-full bg-[#020817]" />
                )}
            </div>

            <div className={`relative z-20 h-full flex flex-col items-center justify-between py-12 transition-opacity duration-1000 pointer-events-none ${showContent ? 'opacity-100' : 'opacity-0'}`}>

                <div className="text-center space-y-3 px-6 pointer-events-auto">
                    <h1 className="text-2xl font-bold text-white tracking-tight">
                        Preparedness Data Exchange
                        <span className="text-blue-400 ml-3">(PDX)</span>
                    </h1>
                    <p className="text-gray-300 text-lg max-w-3xl mx-auto">
                        Integrated preparedness intelligence across the WHO African Region
                    </p>
                    <div className="flex items-center justify-center gap-2 text-gray-400 text-xs">
                        <div className="w-1 h-1 rounded-full bg-green-400 animate-pulse"></div>
                        <span>Continuous situational awareness</span>
                    </div>
                </div>

                <div className="text-center text-gray-500 text-xs space-y-1 pointer-events-auto">
                    <p>WHO African Region · AFRO-wide Intelligence System</p>
                    <p className="text-gray-600">Regional preparedness gateway · Not a data analysis interface</p>
                </div>
            </div>
        </div>
    );
}
