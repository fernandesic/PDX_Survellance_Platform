import { createContext, useContext, type ReactNode } from "react";
import {
    useDashboardStats,
    useIntelRecords,
    useCountries,
    useBriefings,
} from "@/pages/hdis/hooks/useIntelligence";
import type {
    DashboardStats,
    IntelRecord,
    CountryIntelligence,
    Briefing,
} from "@/pages/hdis/types";

interface DashboardContextValue {
    stats: DashboardStats | undefined;
    records: IntelRecord[] | undefined;
    countries: CountryIntelligence[] | undefined;
    briefings: Briefing[] | undefined;
    isLoading: boolean;
}

const Ctx = createContext<DashboardContextValue | null>(null);

export function DashboardProvider({ children }: { children: ReactNode }) {
    const { data: stats, isLoading: l1 } = useDashboardStats();
    const { data: records, isLoading: l2 } = useIntelRecords();
    const { data: countries, isLoading: l3 } = useCountries();
    const { data: briefings, isLoading: l4 } = useBriefings();

    return (
        <Ctx.Provider value={{ stats, records, countries, briefings, isLoading: l1 || l2 || l3 || l4 }}>
            {children}
        </Ctx.Provider>
    );
}

export function useDashboardContext() {
    const ctx = useContext(Ctx);
    if (!ctx) throw new Error("useDashboardContext must be used within DashboardProvider");
    return ctx;
}
