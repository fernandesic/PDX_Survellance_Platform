import { useEffect, useState } from "react";
import { useToast } from "@/contexts/ToastProvider";
import { useTheme } from "@/contexts/ThemeContext";
import { readiness } from "@/pages/readiness/services/readiness";
import { normalizeText } from "@/utils/index";
import { logger } from "@/utils/logger";
import type { BaseReadiness, RegionScore } from "@/pages/readiness/types/readiness";
import { useTenant } from "@/hooks/useTenant";
import ReadinessView from "./ReadinessView";

export default function ReadinessPage() {
    const { showToast } = useToast();
    const { theme } = useTheme();
    const isLight = theme === 'light';
    const { isSuperAdmin, tenant } = useTenant();

    // Derive initial country from tenant (fall back to "Togo" for super admins)
    const tenantCountryName = tenant?.name || 'Togo';
    const initialCountry = isSuperAdmin ? 'Togo' : tenantCountryName;

    const [countries, setCountries] = useState<string[]>([]);
    const [country, setCountry] = useState(initialCountry);
    const [isInitialized, setIsInitialized] = useState(false);

    const [activeTab, setActiveTab] = useState("Arbo Virus");
    const [loading, setLoading] = useState(false);
    const [summary, setSummary] = useState({
        answered_questions: 0, completion_pct: 0, total_questions: 0
    });
    const [readinesses, setReadinesses] = useState<BaseReadiness[]>();
    const [heatmapData, setHeatmapData] = useState<RegionScore[]>([]);
    const [catAverages, setCatAverages] = useState<Record<string, number>>({});

    const [page, setPage] = useState(1);
    const PAGE_SIZE = 15;

    useEffect(() => {
        if (isInitialized) {
            setPage(1);
        }
    }, [country, activeTab]);

    useEffect(() => {
        const loadHeatmap = async () => {
            try {
                const response = await readiness.heatmap(normalizeText(activeTab));
                setHeatmapData(response);
            } catch (error) {
                logger.error("Error loading heatmap data:", error);
            }
        };
        loadHeatmap();
    }, [activeTab]);

    useEffect(() => {
        const loadCategoryAverages = async () => {
            try {
                const response = await readiness.categoryAverages(normalizeText(activeTab));
                setCatAverages(response || {});
            } catch (error) {
                logger.error("Error loading category averages:", error);
            }
        };
        loadCategoryAverages();
    }, [activeTab]);

    useEffect(() => {
        const loadEsparSummary = async () => {
            try {
                setLoading(true);
                const response = await readiness.summary(page, PAGE_SIZE, activeTab, country);
                setReadinesses(response.results);
                setCountries(response.countries);
                setSummary({
                    answered_questions: response.answered_questions,
                    completion_pct: response.completion_pct,
                    total_questions: response.total_questions
                });
                if (!isInitialized) {
                    setIsInitialized(true);
                }
            } catch (error: any) {
                showToast(error?.message || "An Error Ocurred while retrieving data", "error", 5000);
            } finally {
                setLoading(false);
            }
        };
        loadEsparSummary();
    }, [page, activeTab, country]);

    return (
        <ReadinessView
            isLight={isLight}
            isSuperAdmin={isSuperAdmin}
            loading={loading}
            countries={countries}
            country={country}
            setCountry={setCountry}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            heatmapData={heatmapData}
            readinesses={readinesses}
            catAverages={catAverages}
        />
    );
}
