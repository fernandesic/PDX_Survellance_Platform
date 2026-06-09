import jsPDF from 'jspdf';
import { ApiConsumer } from '@/lib/api';
import { logger } from "@/utils/logger";

const loadImageAsDataUrl = async (src: string): Promise<string> => {
    const res = await fetch(src);
    if (!res.ok) throw new Error(`Failed to load image: ${src}`);
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error(`Failed to read image: ${src}`));
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
    });
};

export const generateReportPdf = async (report: any, showToast: (msg: string, type: 'success'|'error') => void) => {
        let fullReport = report;
        try {
            const res: any = await ApiConsumer.get(`/readiness/weekly-report-detail/${report.id}`);
            if (res.data) {
                fullReport = res.data;
            }
        } catch (err) {
            logger.error('Failed to fetch full report data', err);
        }

        const doc = new jsPDF({ unit: 'mm', format: 'a4' });
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const marginX = 12;
        const contentWidth = pageWidth - marginX * 2;

        // Colors from mockup
        const brandBlue: [number, number, number] = [0, 147, 213];
        const tealBlue: [number, number, number] = [110, 193, 228];
        const yellowOrange: [number, number, number] = [255, 193, 7];
        const darkBlueText: [number, number, number] = [0, 80, 140];
        const lightBlueBg: [number, number, number] = [232, 245, 255];
        const headerGray: [number, number, number] = [220, 220, 220];
        const lightGrayBg: [number, number, number] = [245, 247, 250];

        // helper to sanitize text for standard PDF fonts (replace unsupported characters)
        // Uses Unicode escape sequences instead of literal characters for production build safety
        const sanitize = (val: any): string => {
            if (typeof val !== 'string') return '';
            return val
                // Bullets and dots → dash
                .replace(/[\u2022\u2023\u25E6\u2043\u2219\u00B7]/g, '-')
                // Dashes: en-dash, em-dash → hyphen
                .replace(/[\u2013\u2014]/g, '-')
                // Curly quotes → straight quotes
                .replace(/[\u2018\u2019\u201A]/g, "'")
                .replace(/[\u201C\u201D\u201E]/g, '"')
                // Ellipsis → three dots
                .replace(/\u2026/g, '...')
                // Non-breaking space → regular space
                .replace(/\u00A0/g, ' ')
                // Common emojis (green circle, white circle, alarm clock, etc.)
                .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '')
                // Any remaining non-ASCII → remove
                .replace(/[^\x20-\x7E\n\r\t]/g, '');
        };

        let y = 0;

        // ── Header Banner ──
        const leftH = 75;
        const dipH = 98;
        const rightH = 18;
        const d = doc as any;

        // 1. Draw the Blue Section (Precision "dip and rise")
        d.setFillColor(...brandBlue);
        d.moveTo(0, 0);
        d.lineTo(pageWidth, 0);
        d.lineTo(pageWidth, rightH);
        // Curve from right to left: sweep down then dip
        d.curveTo((pageWidth * 2) / 3, 60, pageWidth / 3, dipH, 0, leftH);
        d.fill();

        // 2. Draw the Yellow Ribbon (Following the exact trajectory)
        d.setFillColor(...yellowOrange);
        d.moveTo(0, leftH);
        d.curveTo(pageWidth / 3, dipH, (pageWidth * 2) / 3, 60, pageWidth, rightH);
        d.lineTo(pageWidth, rightH + 4);
        d.curveTo((pageWidth * 2) / 3, 64, pageWidth / 3, dipH + 4, 0, leftH + 4);
        d.fill();

        // Titles
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(30);
        doc.setTextColor(255, 255, 255);
        doc.text('PREPAREDNESS', marginX, 22);

        doc.setFontSize(30);
        doc.setTextColor(...yellowOrange);
        doc.text('THIS WEEK', marginX, 34);

        // Date Box (Slanted Tab Design)
        doc.setFont('helvetica', 'normal'); // Reset for date and subtext
        const dateStr = fullReport.week_range || 'February 9–14';
        doc.setFontSize(12);
        const textW = doc.getTextWidth(dateStr);
        const boxH_date = 9;
        const boxPadding = 4;
        const boxW_base = textW + boxPadding * 2;
        const slantW = 6;

        // Draw the white main box
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(...yellowOrange);
        doc.setLineWidth(1.0);

        // Custom polygon for slanted appearance
        const bx = marginX;
        const by = 44;
        d.moveTo(bx, by);
        d.lineTo(bx + boxW_base, by);
        d.lineTo(bx + boxW_base + slantW, by + (boxH_date / 2));
        d.lineTo(bx + boxW_base, by + boxH_date);
        d.lineTo(bx, by + boxH_date);
        d.lineTo(bx, by);
        d.fill();

        // Draw yellow borders (Left, Top, Bottom)
        doc.line(bx, by, bx + boxW_base, by); // Top
        doc.line(bx, by + boxH_date, bx + boxW_base, by + boxH_date); // Bottom
        doc.line(bx, by, bx, by + boxH_date); // Left

        // Draw the slanted yellow end
        doc.setFillColor(...yellowOrange);
        d.moveTo(bx + boxW_base, by);
        d.lineTo(bx + boxW_base + slantW, by + (boxH_date / 2));
        d.lineTo(bx + boxW_base, by + boxH_date);
        d.lineTo(bx + boxW_base, by);
        d.fill();

        doc.setTextColor(...darkBlueText);
        doc.text(dateStr, bx + boxPadding, by + 6);

        // Subtext description (Balanced position at y=60)
        doc.setFontSize(12);
        doc.setTextColor(255, 255, 255);
        const subTextContent = "The weekly updates of what was achieved by the Health Emergency, Pandemics, and Threats Preparedness (HEP)";
        const subTextLines = doc.splitTextToSize(subTextContent, 90);
        doc.text(subTextLines, marginX, 60);

        // Map Image (Rounded corners + white border)
        const bannerImgW = 97;
        const bannerImgH = 60;
        const bannerImgX = pageWidth - 5 - bannerImgW;
        const bannerImgY = 15;
        const radius = 1;

        try {
            const mapRes = await fetch('/assets/climate_map_report.jpg');
            if (mapRes.ok) {
                const mapDataUrl = await loadImageAsDataUrl('/assets/climate_map_report.jpg');

                // Add image directly (radius is small enough that square image is acceptable and robust)
                doc.addImage(mapDataUrl, 'JPEG', bannerImgX, bannerImgY, bannerImgW, bannerImgH);

                // Draw white border OVER the image
                doc.setDrawColor(255, 255, 255);
                doc.setLineWidth(1.0);
                doc.roundedRect(bannerImgX, bannerImgY, bannerImgW, bannerImgH, radius, radius, 'S');
            }
        } catch (e) {
            logger.error("Failed to load map image", e);
        }

        y = 90; // Compacted margin to ensure single-page fit

        // ── Featured Achievement + Key Figures (only show if filled) ──
        const hasAchievement = !!fullReport.featured_achievement?.trim();
        const hasFigures = !!fullReport.key_figures?.trim();
        const boxH_headers = 7;
        const lineHeight = 4.5;
        const minBoxHeight = 22;

        if (hasAchievement || hasFigures) {
            // Determine layout: side-by-side if both filled, full-width if only one
            const bothFilled = hasAchievement && hasFigures;
            const boxW = bothFilled ? (contentWidth - 4) / 2 : contentWidth;

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);

            const achLines = hasAchievement ? doc.splitTextToSize(sanitize(fullReport.featured_achievement), boxW - 16) : [];
            const figLines = hasFigures ? doc.splitTextToSize(sanitize(fullReport.key_figures), boxW - 16) : [];
            const dynamicBoxH = Math.max(minBoxHeight, achLines.length * lineHeight + 8, figLines.length * lineHeight + 8);

            // 1. Featured Achievement (Blue Theme)
            if (hasAchievement) {
                const achX = marginX;
                doc.setFillColor(...brandBlue);
                doc.rect(achX, y, boxW, boxH_headers, 'F');
                doc.setTextColor(255, 255, 255);
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(11);
                doc.text('Featured Achievement', achX + 4, y + 4.5);

                doc.setFillColor(...lightBlueBg);
                doc.rect(achX, y + boxH_headers, boxW, dynamicBoxH, 'F');
                doc.setDrawColor(...brandBlue);
                doc.setLineWidth(0.1);
                doc.rect(achX, y + boxH_headers, boxW, dynamicBoxH, 'D');

                doc.setTextColor(40, 40, 40);
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(9);
                doc.text(achLines, achX + 8, y + boxH_headers + 5);
            }

            // 2. Key Figures (Gray Theme)
            if (hasFigures) {
                const figX = bothFilled ? marginX + boxW + 4 : marginX;
                doc.setFillColor(240, 240, 240);
                doc.rect(figX, y, boxW, boxH_headers, 'F');
                doc.setTextColor(60, 60, 60);
                doc.setFont('helvetica', 'bold');
                doc.text('Key Figures', figX + 4, y + 4.5);

                doc.setFillColor(255, 255, 255);
                doc.rect(figX, y + boxH_headers, boxW, dynamicBoxH, 'F');
                doc.setDrawColor(200, 200, 200);
                doc.rect(figX, y + boxH_headers, boxW, dynamicBoxH, 'D');

                doc.setTextColor(60, 60, 60);
                doc.setFont('helvetica', 'normal');
                doc.text(figLines, figX + 8, y + boxH_headers + 5);
            }

            y += boxH_headers + dynamicBoxH + 8;
        }

        // ── HEP at Glance Table ──
        doc.setTextColor(...brandBlue);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.text('HEP at Glance', marginX, y);
        y += 6;

        const labelColW = 60;
        const valueColW = contentWidth - labelColW;

        const sections = [
            { label: 'Health Security Governance', key: 'health_security_governance' },
            { label: 'Health Security Financing', key: 'health_security_financing' },
            { label: 'Threats & Risks Management', key: 'threats_risks_management' },
            { label: 'IHR M&E', key: 'ihrme' },
            { label: 'IPC', key: 'ipc' },
            { label: 'Readiness', key: 'readiness' },
            { label: 'NAPHS', key: 'naphs' },
            { label: 'Community Protection', key: 'community_protection' },
            { label: 'Workforce and Training', key: 'workforce_training' },
            { label: 'Pandemic Influenza', key: 'pandemic_influenza' },
            { label: 'Vaccines and Research', key: 'vaccines_research' },
            { label: 'Diseases under Elimination', key: 'diseases_under_elimination' },
            { label: 'One Health', key: 'one_health' },
            { label: 'Innovative Projects', key: 'innovative_projects' },
            { label: 'OSL', key: 'osl' },
            { label: 'HEDRM', key: 'hedrm' },
        ];

        // Filter out sections with empty values — only show filled fields
        let rowIndex = 0;
        sections.forEach((sec) => {
            const rawValue = fullReport[sec.key];
            // Skip empty/blank fields entirely
            if (!rawValue || (typeof rawValue === 'string' && !rawValue.trim())) return;

            const value = sanitize(rawValue);
            if (!value.trim()) return; // Also skip if sanitize stripped everything

            // Set font context before splitting text so line-wrapping calculation is accurate
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            const valueLines = doc.splitTextToSize(value, valueColW - 16);
            const rowH = Math.max(10, valueLines.length * 4.5 + 4);

            if (y + rowH > pageHeight - 25) {
                doc.addPage();
                y = 20;
                // Re-sync font after page break just in case
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(9);
            }

            if (rowIndex % 2 === 0) {
                doc.setFillColor(235, 245, 255);
            } else {
                doc.setFillColor(255, 255, 255);
            }

            doc.rect(marginX, y, labelColW, rowH, 'F');
            doc.rect(marginX + labelColW, y, valueColW, rowH, 'F');

            doc.setTextColor(40, 40, 40);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9.5);
            // Center label vertically
            doc.text(sec.label, marginX + 4, y + (rowH / 2) + 0.5, { baseline: 'middle' });

            doc.setTextColor(60, 60, 60);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            doc.text(valueLines, marginX + labelColW + 8, y + 5.5);

            y += rowH;
            rowIndex++;
        });

        y += 10;
        if (y > pageHeight - 35) {
            doc.addPage();
            y = 20;
        }

        doc.setFillColor(248, 250, 252); // Very light slate
        doc.rect(marginX, y, contentWidth, 18, 'F');
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.2);
        doc.rect(marginX, y, contentWidth, 18, 'D');

        doc.setTextColor(...darkBlueText);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.text('INSTITUTIONAL POLICY FRAMEWORK', marginX + 4, y + 5);

        doc.setTextColor(100, 116, 139); // Slate-500
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(8.5);

        y += 24;

        const imageFields = [
            { key: 'featured_achievement_image', label: 'Featured Achievement' },
            { key: 'key_figures_image', label: 'Key Figures in this Week' },
        ];

        const imagesToRender: { label: string; dataUrl: string }[] = [];
        for (const imgField of imageFields) {
            const imgData = fullReport[imgField.key];
            if (imgData && typeof imgData === 'string' && imgData.startsWith('data:')) {
                imagesToRender.push({ label: imgField.label, dataUrl: imgData });
            }
        }

        if (imagesToRender.length > 0) {
            doc.addPage();
            y = 20;

            doc.setFillColor(...brandBlue);
            doc.rect(marginX, y, contentWidth, 10, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(14);
            doc.text('Attachments', marginX + 4, y + 7);
            y += 16;

            for (const imgItem of imagesToRender) {
                try {
                    const imgDims = await new Promise<{ w: number; h: number }>((resolve) => {
                        const img = new Image();
                        img.onload = () => resolve({ w: img.width, h: img.height });
                        img.onerror = () => resolve({ w: 400, h: 300 });
                        img.src = imgItem.dataUrl;
                    });

                    const maxImgW = contentWidth - 8;
                    const maxImgH = pageHeight - y - 40;

                    let drawW = maxImgW;
                    let drawH = (imgDims.h / imgDims.w) * drawW;

                    if (drawH > maxImgH) {
                        drawH = maxImgH;
                        drawW = (imgDims.w / imgDims.h) * drawH;
                    }

                    if (y + drawH + 12 > pageHeight - 25) {
                        doc.addPage();
                        y = 20;
                    }
                    doc.setTextColor(...darkBlueText);
                    doc.setFont('helvetica', 'bold');
                    doc.setFontSize(10);
                    doc.text(imgItem.label, marginX + 4, y + 4);
                    y += 8;

                    const imgX = marginX + (contentWidth - drawW) / 2;
                    doc.addImage(imgItem.dataUrl, 'PNG', imgX, y, drawW, drawH);
                    doc.setDrawColor(200, 200, 200);
                    doc.setLineWidth(0.3);
                    doc.rect(imgX, y, drawW, drawH, 'S');

                    y += drawH + 10;
                } catch (imgErr) {
                    logger.error(`Failed to load image for ${imgItem.label}:`, imgErr);
                }
            }
        }
        let whoLogo = '';
        let logoRatio = 0;
        try {
            const logoRes = await fetch('/logo.png');
            if (logoRes.ok) {
                const blob = await logoRes.blob();
                whoLogo = await new Promise<string>((resolve) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result as string);
                    reader.readAsDataURL(blob);
                });

                await new Promise<void>((resolve) => {
                    const img = new Image();
                    img.onload = () => {
                        logoRatio = img.width / img.height;
                        resolve();
                    };
                    img.src = whoLogo;
                });
            }
        } catch (e) {
            logger.error("Failed to load WHO logo", e);
        }

        const drawFooter = (pageNum: number, totalPages: number) => {
            doc.setPage(pageNum);
            const d = doc as any;
            d.setFillColor(...brandBlue);
            const baseH = 8;
            const tallH = 16;
            const transitionX = pageWidth * 0.78;
            const slopeW = 10;

            d.moveTo(0, pageHeight);
            d.lineTo(pageWidth, pageHeight);
            d.lineTo(pageWidth, pageHeight - tallH);
            d.lineTo(transitionX + slopeW, pageHeight - tallH);
            d.lineTo(transitionX, pageHeight - baseH);
            d.lineTo(0, pageHeight - baseH);
            d.fill();

            const maxW = 32;
            const maxH = 12;
            const rightBlockLX = transitionX + slopeW;
            const centerX = (rightBlockLX + pageWidth) / 2;
            const boxY = pageHeight - tallH + 2;

            let drawW = maxW;
            let drawH = maxH;

            if (logoRatio > 0) {
                const boxRatio = maxW / maxH;
                if (logoRatio > boxRatio) {
                    drawW = maxW;
                    drawH = drawW / logoRatio;
                } else {
                    drawH = maxH;
                    drawW = drawH * logoRatio;
                }
            }

            const logoX = centerX - (drawW / 2);
            const logoY = boxY + (maxH - drawH) / 2;

            if (whoLogo) {
                doc.addImage(whoLogo, 'PNG', logoX, logoY, drawW, drawH);
            }

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7.5);
            doc.text(`Page ${pageNum} of ${totalPages}`, marginX, pageHeight - 3);
        };

        const totalPages = doc.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
            drawFooter(i, totalPages);
        }

        const safeName = (fullReport.week_range || 'Current_Week').replace(/[^a-zA-Z0-9–-]/g, '_').replace(/_+/g, '_');
        try {
            doc.save(`Preparedness_Report_${safeName}.pdf`);
            showToast('Report PDF generated!', 'success');
        } catch (e) {
            logger.error("Failed to save PDF", e);
            showToast('Failed to save PDF. Please check console.', 'error');
        }
};
