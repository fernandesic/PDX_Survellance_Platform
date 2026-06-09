import { useState, useEffect, useRef, lazy, Suspense } from "react";

const RVFCandlestickChart = lazy(() => import("@/components/usables/RVFCandlestickChart"));

/** Renders the RVF chart only when the user scrolls near this section */
export function LazyRVFChart() {
    const ref = useRef<HTMLDivElement>(null);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (!ref.current) return;
        const observer = new IntersectionObserver(
            ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect(); } },
            { rootMargin: '200px' }
        );
        observer.observe(ref.current);
        return () => observer.disconnect();
    }, []);

    return (
        <div ref={ref} className="pr-5 my-8 min-h-[200px]">
            {visible && (
                <Suspense fallback={<div className="h-[400px] bg-white/[0.03] rounded-lg animate-pulse" />}>
                    <RVFCandlestickChart />
                </Suspense>
            )}
        </div>
    );
}
