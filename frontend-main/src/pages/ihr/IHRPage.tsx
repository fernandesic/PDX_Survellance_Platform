import { useEffect, useState, useRef, useCallback } from "react";
import { useToast } from "@/contexts/ToastProvider";
import { useTheme } from "@/contexts/ThemeContext";
import { useIHRQuery } from "@/hooks/queries/useIHRQuery";
import { arcgisService, type ArcGISWebMapLayer } from "@/services/arcgisService";
import { Loading } from "@/components/Loading";
import { logger } from "@/utils/logger";
import { useTenant } from "@/hooks/useTenant";
import IHRView from "./IHRView";

/* ─── Utilities ─── */

const rgbaToHex = (rgba: number[]) => {
    if (!rgba || rgba.length < 3) return '#6b7280';
    const r = rgba[0].toString(16).padStart(2, '0');
    const g = rgba[1].toString(16).padStart(2, '0');
    const b = rgba[2].toString(16).padStart(2, '0');
    return `#${r}${g}${b}`;
};

interface LegendItem {
    label: string;
    bg: string;
    min: number;
    max: number;
}

/* ─── Container Component ─── */

export default function IHRPage() {
    const { showToast } = useToast();
    const { theme } = useTheme();
    const isLight = theme === 'light';
    const { isSuperAdmin, tenant } = useTenant();

    const tenantCountryName = tenant?.name || 'Nigeria';
    const initialCountry = isSuperAdmin ? 'Nigeria' : tenantCountryName;

    const [country, setCountry] = useState(initialCountry);
    const [year, setYear] = useState("2025");

    const [dynamicLegend, setDynamicLegend] = useState<LegendItem[]>([]);
    const [legendLoading, setLegendLoading] = useState(false);

    const { data: summaryData, isLoading, isFetching, error } = useIHRQuery(country, year);

    useEffect(() => {
        if (error) {
            showToast(error.message || "An Error Occurred while retrieving data", "error", 5000);
        }
    }, [error, showToast]);

    // Map year to backend map_id
    const getMapId = (y: string) => {
        if (y === "2025") return "espar_3";
        if (y === "2024") return "espar_3";
        if (y === "2023") return "espar_2";
        if (y === "2022") return "espar_1";
        return "espar_3";
    };

    const radarChartRef = useRef<HTMLDivElement>(null);
    const scoreCardRef = useRef<HTMLDivElement>(null);
    const capacityScoresRef = useRef<HTMLDivElement>(null);
    const downloadButtonRef = useRef<HTMLDivElement>(null);

    // Style Discovery Effect
    useEffect(() => {
        (async () => {
            try {
                setLegendLoading(true);
                const layers: ArcGISWebMapLayer[] = await arcgisService.getWebMapLayers(getMapId(year));
                const eSparLayer = layers.find(l => (l.title === 'eSPAR' || l.title === 'AFRO_eSPAR') && l.layerDefinition?.drawingInfo?.renderer);
                const renderer = eSparLayer?.layerDefinition?.drawingInfo?.renderer;

                if (renderer?.type === 'classBreaks' && renderer.classBreakInfos) {
                    const items: LegendItem[] = renderer.classBreakInfos.map((info, idx, arr) => ({
                        label: info.label,
                        bg: rgbaToHex(info.symbol.color),
                        min: idx === 0 ? 0 : arr[idx - 1].classMaxValue + 1,
                        max: info.classMaxValue
                    }));
                    setDynamicLegend(items);
                }
            } catch (e) {
                logger.error("Discovery error:", e);
            } finally {
                setLegendLoading(false);
            }
        })();
    }, [year]);

    const getMapColor = useCallback((score: number) => {
        if (!dynamicLegend.length) return { bg: '#6b7280', label: 'Loading...' };
        const tier = dynamicLegend.find(t => score <= t.max);
        return tier || dynamicLegend[dynamicLegend.length - 1];
    }, [dynamicLegend]);

    const handleDownloadRadarPDF = async () => {
        try {
            const html2canvas = (await import('html2canvas')).default;
            const jsPDF = (await import('jspdf')).default;

            const radarChart = radarChartRef.current;
            const scoreCard = scoreCardRef.current;
            const capacityScores = capacityScoresRef.current;
            const downloadButton = downloadButtonRef.current;

            if (!radarChart || !scoreCard || !capacityScores) {
                showToast("Sections not found", "error", 3000);
                return;
            }

            showToast("Generating PDF...", "info", 2000);

            if (downloadButton) {
                downloadButton.style.display = 'none';
            }

            await new Promise(resolve => setTimeout(resolve, 300));

            const tempWrapper = document.createElement('div');
            tempWrapper.style.cssText = 'position: fixed; left: -9999px; top: 0; background: #ffffff; padding: 20px; width: 800px;';

            const radarClone = radarChart.cloneNode(true) as HTMLElement;
            const scoreClone = scoreCard.cloneNode(true) as HTMLElement;
            const capacityClone = capacityScores.cloneNode(true) as HTMLElement;

            radarClone.style.width = radarChart.offsetWidth + 'px';
            radarClone.style.marginBottom = '20px';
            radarClone.style.color = '#ffffff';

            scoreClone.style.width = scoreCard.offsetWidth + 'px';
            scoreClone.style.marginBottom = '20px';
            scoreClone.style.color = '#ffffff';

            capacityClone.style.width = capacityScores.offsetWidth + 'px';
            capacityClone.style.color = '#ffffff';

            const scrollDivInClone = capacityClone.querySelector('[class*="max-h-"]') as HTMLElement;
            if (scrollDivInClone) {
                scrollDivInClone.className = 'space-y-2 pr-2';
            }

            tempWrapper.appendChild(radarClone);
            tempWrapper.appendChild(scoreClone);
            tempWrapper.appendChild(capacityClone);
            document.body.appendChild(tempWrapper);

            tempWrapper.offsetHeight;
            await new Promise(resolve => setTimeout(resolve, 100));

            const canvas = await html2canvas(tempWrapper, {
                scale: 2.5,
                backgroundColor: '#ffffff',
                logging: false,
                useCORS: true,
            });

            document.body.removeChild(tempWrapper);

            if (downloadButton) {
                downloadButton.style.display = 'flex';
            }

            const imgData = canvas.toDataURL('image/png');

            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4'
            });

            const margin = 10;
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const availableWidth = pdfWidth - (2 * margin);
            const availableHeight = pdfHeight - (2 * margin);

            const imgWidth = canvas.width;
            const imgHeight = canvas.height;
            const ratio = Math.min(availableWidth / imgWidth, availableHeight / imgHeight);

            const scaledWidth = imgWidth * ratio;
            const scaledHeight = imgHeight * ratio;
            const imgX = margin + (availableWidth - scaledWidth) / 2;
            const imgY = margin;

            pdf.addImage(imgData, 'PNG', imgX, imgY, scaledWidth, scaledHeight);

            pdf.save(`${country}-${year}-IHR-Assessment.pdf`);
            showToast("PDF downloaded successfully", "success", 3000);
        } catch (error: any) {
            showToast(error?.message || "Failed to download PDF", "error", 5000);
        }
    };

    if (isLoading && !summaryData) return <Loading />;

    return (
        <IHRView
            isLight={isLight}
            isSuperAdmin={isSuperAdmin}
            country={country}
            setCountry={setCountry}
            year={year}
            setYear={setYear}
            summaryData={summaryData}
            loading={isFetching}
            dynamicLegend={dynamicLegend}
            getMapColor={getMapColor}
            handleDownloadRadarPDF={handleDownloadRadarPDF}
            radarChartRef={radarChartRef}
            scoreCardRef={scoreCardRef}
            capacityScoresRef={capacityScoresRef}
            downloadButtonRef={downloadButtonRef}
        />
    );
}
