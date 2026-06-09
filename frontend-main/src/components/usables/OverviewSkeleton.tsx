import { useTheme } from "@/contexts/ThemeContext";

/* ─── Breathing animation keyframes (injected once) ─── */
const breatheStyle = `
@keyframes skeleton-breathe {
  0%, 100% { opacity: 0.25; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(1.01); }
}
`;

/* ─── Shared pulse bar ─── */
const Pulse = ({ className = "", style }: { className?: string; style?: React.CSSProperties }) => {
    const { theme } = useTheme();
    const isLight = theme === 'light';
    return (
        <>
            <style>{breatheStyle}</style>
            <div
                className={`rounded ${isLight ? 'bg-gray-200' : 'bg-white/[0.06]'} ${className}`}
                style={{ animation: 'skeleton-breathe 2.4s ease-in-out infinite', ...style }}
            />
        </>
    );
};

/* ─── 6 KPI cards ─── */
export function KPICardsSkeleton() {
    const { theme } = useTheme();
    const isLight = theme === 'light';
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
                <div
                    key={i}
                    className={`relative flex flex-col justify-between ${isLight ? 'bg-white border-gray-200' : 'bg-[#0a1128] border-white/10'} rounded-xl p-4 border`}
                >
                    <div className="flex items-center justify-between mb-3">
                        <Pulse className="w-8 h-8 rounded-lg" />
                        <Pulse className="w-12 h-3 rounded" />
                    </div>
                    <Pulse className="w-20 h-3 mb-2 rounded" />
                    <Pulse className="w-16 h-6 mb-1 rounded" />
                    <Pulse className="w-28 h-3 mb-3 rounded" />
                    <div className="mt-auto pt-2 border-t border-white/5">
                        <Pulse className="w-24 h-2 rounded" />
                    </div>
                </div>
            ))}
        </div>
    );
}

/* ─── Map area ─── */
export function MapSkeleton() {
    const { theme } = useTheme();
    const isLight = theme === 'light';
    return (
        <div className={`w-full grid grid-cols-1 xl:grid-cols-3 gap-4 h-full`}>
            <div className={`col-span-2 h-[610px] flex flex-col ${isLight ? 'bg-white border-gray-200' : 'bg-[#0d1424] border-blue-500/20'} rounded-xl p-4 border`}>
                <Pulse className="w-full h-[500px] rounded-lg" />
            </div>
            <div className={`h-[610px] flex flex-col ${isLight ? 'bg-white border-gray-200' : 'bg-[#0d1424] border-white/5'} rounded-xl p-4 border space-y-4`}>
                <div className="flex gap-8">
                    <Pulse className="w-12 h-4 rounded" />
                    <Pulse className="w-14 h-4 rounded" />
                    <Pulse className="w-16 h-4 rounded" />
                </div>
                <Pulse className="w-32 h-5 rounded" />
                {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex justify-between">
                        <Pulse className="w-24 h-3 rounded" />
                        <Pulse className="w-16 h-3 rounded" />
                    </div>
                ))}
                <Pulse className="w-40 h-5 mt-4 rounded" />
                {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex justify-between items-center">
                        <Pulse className="w-36 h-3 rounded" />
                        <Pulse className="w-20 h-3 rounded" />
                    </div>
                ))}
            </div>
        </div>
    );
}

/* ─── Bottom charts (DualBarChart + tables) ─── */
export function BottomChartsSkeleton() {
    const { theme } = useTheme();
    const isLight = theme === 'light';
    return (
        <div className="w-full grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-5 gap-6 mt-6 px-4 items-stretch lg:h-[440px]">
            {/* Bar chart placeholder */}
            <div className={`xl:col-span-3 h-full ${isLight ? 'bg-white border-gray-200' : 'bg-[#0d1424] border-white/5'} rounded-lg border p-4`}>
                <Pulse className="w-48 h-5 mb-4 rounded" />
                <div className="flex items-end gap-2 h-[350px]">
                    {Array.from({ length: 10 }).map((_, i) => (
                        <Pulse key={i} className="flex-1 rounded" style={{ height: `${30 + Math.random() * 60}%` }} />
                    ))}
                </div>
            </div>
            {/* Country Summary skeleton */}
            <div className={`w-full h-full ${isLight ? 'bg-white border-gray-200' : 'bg-[#0d1424] border-white/5'} rounded-lg border p-3 pt-6 flex flex-col`}>
                <Pulse className="w-32 h-5 mb-3 rounded" />
                <div className="space-y-3">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="flex items-center justify-between py-2">
                            <div className="flex items-center gap-2">
                                <Pulse className="w-7 h-7 rounded-lg" />
                                <div>
                                    <Pulse className="w-20 h-3 mb-1 rounded" />
                                    <Pulse className="w-10 h-2 rounded" />
                                </div>
                            </div>
                            <div className="text-right">
                                <Pulse className="w-14 h-4 mb-1 rounded" />
                                <Pulse className="w-8 h-2 rounded" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
            {/* Country Rates skeleton */}
            <div className={`w-full h-full ${isLight ? 'bg-white border-gray-200' : 'bg-[#0d1424] border-white/5'} rounded-lg border p-3 pt-6 flex flex-col`}>
                <Pulse className="w-28 h-5 mb-3 rounded" />
                <div className="space-y-3">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="flex items-center justify-between py-2">
                            <div className="flex items-center gap-2">
                                <Pulse className="w-7 h-7 rounded-lg" />
                                <div>
                                    <Pulse className="w-20 h-3 mb-1 rounded" />
                                    <Pulse className="w-10 h-2 rounded" />
                                </div>
                            </div>
                            <div className="text-right">
                                <Pulse className="w-12 h-4 mb-1 rounded" />
                                <Pulse className="w-8 h-2 rounded" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
