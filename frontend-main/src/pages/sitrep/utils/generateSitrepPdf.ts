/**
 * Native PDF generator for a SITREP report.
 *
 * Builds an A4 vector PDF using jsPDF primitives — real searchable text,
 * no DOM screenshot. Can be called from anywhere with a fetched SitrepReport
 * (the dashboard, the read-only view page, a future scheduled job, etc.).
 */
import jsPDF from 'jspdf';

import { getCountryRisk, getChecklist, RISK_COLORS } from '../constants/checklists';

export interface WeeklyHighlight {
    id: string;
    image_data: string;
    caption: string;
    date: string;
    is_highlight: boolean;
}

export interface SitrepReport {
    id: number;
    sitrep_number: string;
    reporting_period: string;
    date_of_issue: string;
    data_cutoff: string;
    classification: string;
    geographic_scope: string;
    triggering_event: string;
    prepared_by: string;
    cleared_by: string;
    next_issue: string;
    population_in_screening: string;
    high_risk_poe: string;
    referred: string;
    isolated: string;
    suspected: string;
    selected_country: string;
    checklist_responses: Record<string, string>;
    action_points: Array<{ action: string; pillar: string }>;
    planned_actions: string;
    key_challenges: string;
    weekly_highlights?: WeeklyHighlight[];
    created_on?: string;
    updated_on?: string;
}

const loadImage = (src: string): Promise<HTMLImageElement | null> =>
    new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = src;
    });

/** Detect the jsPDF image format token (PNG/JPEG/WEBP) from a data URL. */
const detectImageFormat = (dataUrl: string): 'PNG' | 'JPEG' | 'WEBP' => {
    const m = /^data:image\/([a-zA-Z+]+);/i.exec(dataUrl);
    const sub = (m?.[1] || '').toLowerCase();
    if (sub === 'jpeg' || sub === 'jpg') return 'JPEG';
    if (sub === 'webp') return 'WEBP';
    return 'PNG';
};

/** Fit (w, h) into the (maxW, maxH) box preserving aspect ratio. */
const fitBox = (w: number, h: number, maxW: number, maxH: number) => {
    if (w <= 0 || h <= 0) return { w: maxW, h: maxH };
    const scale = Math.min(maxW / w, maxH / h, 1);
    return { w: w * scale, h: h * scale };
};

const hexToRgb = (hex: string): readonly [number, number, number] => {
    const h = hex.replace('#', '');
    return [
        parseInt(h.slice(0, 2), 16),
        parseInt(h.slice(2, 4), 16),
        parseInt(h.slice(4, 6), 16),
    ] as const;
};

/**
 * Build and trigger the browser download for a SITREP PDF.
 * Resolves once the file has been handed to the browser.
 */
export async function generateSitrepPdf(report: SitrepReport): Promise<void> {
    // ── Page geometry (A4 portrait, mm) ──────────────────────
    const W = 210;
    const H = 297;
    const M = 14;
    const CW = W - M * 2;
    const BOTTOM_LIMIT = H - 14;

    // ── Palette ──────────────────────────────────────────────
    const PRIMARY = [26, 39, 68] as const;
    const ACCENT  = [74, 159, 216] as const;
    const TEXT    = [31, 41, 55] as const;
    const MUTED   = [107, 114, 128] as const;
    const LIGHT   = [229, 231, 235] as const;
    const SUBTLE  = [243, 244, 246] as const;
    const YES     = [22, 163, 74] as const;
    const NO      = [220, 38, 38] as const;
    const NA_CLR  = [100, 116, 139] as const;   // slate-500

    // ── PDF setup ────────────────────────────────────────────
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
    pdf.setProperties({
        title: `SITREP ${report.sitrep_number}`,
        subject: 'EVD Preparedness & Readiness Situation Report',
        author: 'WHO AFRO Health Emergency Preparedness — Preparedness Data Exchange (PDX)',
        creator: 'PDX SITREP Form',
    });
    pdf.setFont('helvetica', 'normal');

    // ── Helpers ──────────────────────────────────────────────
    let y = M;
    const setText = (rgb: readonly [number, number, number]) => pdf.setTextColor(rgb[0], rgb[1], rgb[2]);
    const setFill = (rgb: readonly [number, number, number]) => pdf.setFillColor(rgb[0], rgb[1], rgb[2]);
    const setDraw = (rgb: readonly [number, number, number]) => pdf.setDrawColor(rgb[0], rgb[1], rgb[2]);
    const font = (size: number, style: 'normal' | 'bold' | 'italic' = 'normal') => {
        pdf.setFont('helvetica', style);
        pdf.setFontSize(size);
    };
    const needSpace = (needed: number) => {
        if (y + needed > BOTTOM_LIMIT) {
            pdf.addPage();
            y = M;
        }
    };
    const wrap = (text: string, maxW: number) =>
        pdf.splitTextToSize(text || '', maxW) as string[];

    const sectionHeading = (label: string) => {
        needSpace(14);
        y += 4;
        setFill(ACCENT);
        pdf.rect(M, y, 3, 6, 'F');
        font(11, 'bold');
        setText(PRIMARY);
        pdf.text(label.toUpperCase(), M + 6, y + 4.5);
        y += 8;
        setDraw(LIGHT);
        pdf.setLineWidth(0.2);
        pdf.line(M, y, M + CW, y);
        y += 4;
    };

    const drawHeader = async () => {
        setFill(PRIMARY);
        pdf.rect(0, 0, W, 38, 'F');
        setFill(ACCENT);
        pdf.rect(M, 22, 18, 0.8, 'F');
        try {
            const logo = await loadImage('/logo.png');
            if (logo) pdf.addImage(logo, 'PNG', W - M - 16, 6, 16, 16);
        } catch { /* skip logo */ }

        font(8); setText([255, 255, 255]);
        pdf.text('WORLD HEALTH ORGANIZATION — REGIONAL OFFICE FOR AFRICA', M, 11);

        font(18, 'bold');
        pdf.text('EBOLA VIRUS DISEASE', M, 19);

        font(10, 'bold');
        setText([180, 220, 240]);
        pdf.text('Preparedness & Readiness Situation Report (SITREP)', M, 28);

        font(8);
        setText([220, 230, 240]);
        pdf.text('African Region · Bundibugyo virus disease (BVD)', M, 33);

        y = 44;

        font(9, 'bold'); setText(PRIMARY);
        pdf.text(`SITREP ${report.sitrep_number}`, M, y);
        if (report.reporting_period) {
            font(9); setText(MUTED);
            pdf.text(`·  ${report.reporting_period}`, M + pdf.getTextWidth(`SITREP ${report.sitrep_number}`) + 3, y);
        }
        y += 6;
        setDraw(LIGHT);
        pdf.setLineWidth(0.3);
        pdf.line(M, y, M + CW, y);
        y += 4;
    };

    const keyValueTable = (rows: Array<[string, string]>) => {
        const labelW = 50;
        const valueW = CW - labelW;
        const padX = 3;
        const lineH = 5.2;

        rows.forEach((row, idx) => {
            const [label, raw] = row;
            const value = raw || '—';
            font(9);
            const valueLines = wrap(value, valueW - padX * 2);
            const rowH = Math.max(lineH * 1.4, lineH * valueLines.length + 2);

            needSpace(rowH);
            if (idx % 2 === 0) {
                setFill(SUBTLE);
                pdf.rect(M, y, CW, rowH, 'F');
            }
            setDraw(LIGHT);
            pdf.setLineWidth(0.15);
            pdf.line(M, y + rowH, M + CW, y + rowH);

            font(9, 'bold'); setText(MUTED);
            pdf.text(label, M + padX, y + 4);

            font(9); setText(value === '—' ? MUTED : TEXT);
            let ly = y + 4;
            valueLines.forEach((ln) => {
                pdf.text(ln, M + labelW + padX, ly);
                ly += lineH;
            });

            y += rowH;
        });
        y += 3;
    };

    const statCards = (cards: Array<{ label: string; value: string }>) => {
        const cardW = (CW - 4 * 3) / 5;
        const cardH = 22;
        needSpace(cardH + 3);
        cards.forEach((c, i) => {
            const x = M + i * (cardW + 3);
            setFill([255, 255, 255]);
            setDraw(LIGHT);
            pdf.setLineWidth(0.3);
            pdf.roundedRect(x, y, cardW, cardH, 1.5, 1.5, 'FD');
            font(7, 'bold'); setText(MUTED);
            const labelLines = wrap(c.label.toUpperCase(), cardW - 4);
            let ly = y + 5;
            labelLines.slice(0, 2).forEach((ln) => {
                pdf.text(ln, x + cardW / 2, ly, { align: 'center' });
                ly += 3;
            });
            font(14, 'bold'); setText(PRIMARY);
            pdf.text(c.value || '0', x + cardW / 2, y + cardH - 5, { align: 'center' });
        });
        y += cardH + 4;
    };

    const riskPill = (xRight: number, label: string, hex: string) => {
        const w = pdf.getTextWidth(label) + 6;
        const x = xRight - w;
        setFill(hexToRgb(hex));
        pdf.roundedRect(x, y - 4, w, 5.5, 2.75, 2.75, 'F');
        setText([255, 255, 255]);
        font(8, 'bold');
        pdf.text(label, x + w / 2, y - 0.2, { align: 'center' });
    };

    const ynBadge = (x: number, rowY: number, status: string | undefined) => {
        const text =
            status === 'YES' ? 'YES'
            : status === 'NO' ? 'NO'
            : status === 'NA' ? 'N/A'
            : '—';
        const colour =
            status === 'YES' ? YES
            : status === 'NO' ? NO
            : status === 'NA' ? NA_CLR
            : LIGHT;
        const w = 12;
        const h = 4.8;
        setFill(colour);
        pdf.roundedRect(x, rowY - 3.6, w, h, 1.4, 1.4, 'F');
        font(7, 'bold');
        const filled = status === 'YES' || status === 'NO' || status === 'NA';
        setText(filled ? [255, 255, 255] : MUTED);
        pdf.text(text, x + w / 2, rowY - 0.2, { align: 'center' });
    };

    const textBlock = (raw: string) => {
        const value = raw?.trim() || '—';
        font(9.5);
        const lines = wrap(value, CW - 6);
        const padY = 4;
        const blockH = padY * 2 + lines.length * 4.6;
        needSpace(blockH);
        setFill([255, 255, 255]);
        setDraw(LIGHT);
        pdf.setLineWidth(0.3);
        pdf.roundedRect(M, y, CW, blockH, 1.5, 1.5, 'FD');
        font(9.5); setText(value === '—' ? MUTED : TEXT);
        let ly = y + padY + 3;
        lines.forEach((ln) => {
            pdf.text(ln, M + 3, ly);
            ly += 4.6;
        });
        y += blockH + 3;
    };

    // ── BUILD DOCUMENT ───────────────────────────────────────
    await drawHeader();

    sectionHeading('0 · Document Control');
    keyValueTable([
        ['Sitrep number', report.sitrep_number],
        ['Reporting period', report.reporting_period],
        ['Date of issue', report.date_of_issue],
        ['Data cut-off', report.data_cutoff],
        ['Classification', report.classification],
        ['Geographic scope', report.geographic_scope],
        ['Triggering event', report.triggering_event],
        ['Prepared by', report.prepared_by],
        ['Cleared by', report.cleared_by],
        ['Next issue', report.next_issue],
    ]);

    sectionHeading('1 · Statistics — Population & Case Overview');
    statCards([
        { label: 'PoE Screening', value: report.population_in_screening },
        { label: '# High-risk points of entry', value: report.high_risk_poe },
        { label: 'Referred', value: report.referred },
        { label: 'Isolated', value: report.isolated },
        { label: 'Suspected', value: report.suspected },
    ]);

    sectionHeading('2 · Readiness Capacities');
    {
        const boxH = 24;
        needSpace(boxH + 3);
        const halfW = (CW - 3) / 2;
        [0, 1].forEach((i) => {
            const x = M + i * (halfW + 3);
            setFill([255, 255, 255]);
            setDraw(LIGHT);
            pdf.setLineWidth(0.3);
            pdf.setLineDashPattern([1.2, 1.2], 0);
            pdf.roundedRect(x, y, halfW, boxH, 1.5, 1.5, 'FD');
            pdf.setLineDashPattern([], 0);
            font(9); setText(MUTED);
            pdf.text(
                i === 0 ? 'Readiness Assessment Graph' : 'Regional Risk Map',
                x + halfW / 2,
                y + boxH / 2 + 1,
                { align: 'center' },
            );
        });
        y += boxH + 4;
    }

    sectionHeading('3 · Temporary Recommendations — Implementation Status');
    {
        font(9, 'bold'); setText(MUTED);
        pdf.text('State Party:', M, y + 3);
        font(9); setText(TEXT);
        const countryLabel = report.selected_country || 'No country selected';
        pdf.text(countryLabel, M + 22, y + 3);

        if (report.selected_country) {
            const risk = getCountryRisk(report.selected_country);
            const style = RISK_COLORS[risk.risk];
            if (style) {
                const label = `${style.label.toUpperCase()} RISK · CHECKLIST ${risk.checklist}`;
                font(8, 'bold');
                riskPill(M + CW, label, style.bg);
            }
        }
        y += 8;

        if (report.selected_country) {
            const risk = getCountryRisk(report.selected_country);
            const checklist = getChecklist(risk.checklist);
            const textColW = CW - 18;

            checklist.forEach((cat) => {
                needSpace(8);
                font(8, 'bold'); setText(PRIMARY);
                pdf.text(cat.category.toUpperCase(), M, y);
                y += 1.5;
                setDraw(LIGHT);
                pdf.setLineWidth(0.15);
                pdf.line(M, y + 0.5, M + CW, y + 0.5);
                y += 3.5;

                cat.items.forEach((item, idx) => {
                    const ans = report.checklist_responses?.[item.key];
                    font(9); setText(TEXT);
                    const lines = wrap(item.text, textColW);
                    const rowH = Math.max(5.4, lines.length * 4.2 + 2.4);
                    needSpace(rowH);
                    if (idx % 2 === 0) {
                        setFill(SUBTLE);
                        pdf.rect(M, y, CW, rowH, 'F');
                    }
                    font(9); setText(TEXT);
                    let ly = y + 3.6;
                    lines.forEach((ln) => {
                        pdf.text(ln, M + 2, ly);
                        ly += 4.2;
                    });
                    ynBadge(M + CW - 13, y + 3.6, ans);
                    y += rowH;
                });
                y += 2;
            });
        } else {
            font(9, 'italic'); setText(MUTED);
            pdf.text('No country selected — no checklist to display.', M, y + 3);
            y += 8;
        }
    }

    sectionHeading('4 · Action Points');
    {
        const points = (report.action_points || []).filter((p) => p?.action?.trim());
        if (points.length === 0) {
            font(9, 'italic'); setText(MUTED);
            pdf.text('No action points recorded.', M, y + 3);
            y += 8;
        } else {
            const pillarW = 38;
            const actionW = CW - pillarW;
            needSpace(8);
            setFill(PRIMARY);
            pdf.rect(M, y, CW, 6, 'F');
            font(8, 'bold'); setText([255, 255, 255]);
            pdf.text('ACTION IMPLEMENTED', M + 2, y + 4);
            pdf.text('PILLAR', M + actionW + 2, y + 4);
            y += 6;
            points.forEach((p, idx) => {
                font(9);
                const lines = wrap(p.action, actionW - 4);
                const rowH = Math.max(6, lines.length * 4.4 + 2.4);
                needSpace(rowH);
                if (idx % 2 === 0) {
                    setFill(SUBTLE);
                    pdf.rect(M, y, CW, rowH, 'F');
                }
                setDraw(LIGHT);
                pdf.setLineWidth(0.15);
                pdf.line(M, y + rowH, M + CW, y + rowH);
                font(9); setText(TEXT);
                let ly = y + 4;
                lines.forEach((ln) => { pdf.text(ln, M + 2, ly); ly += 4.4; });
                font(9, 'bold'); setText(MUTED);
                pdf.text(p.pillar || '—', M + actionW + 2, y + 4);
                y += rowH;
            });
            y += 3;
        }
    }

    sectionHeading('5 · Planned Actions & Deployments');
    textBlock(report.planned_actions);

    // ── Section 5b — Weekly Highlight ───────────────────────
    const highlights = report.weekly_highlights || [];
    if (highlights.length > 0) {
        sectionHeading('5b · Weekly Highlight — Photos');
        const star = highlights.find((h) => h.is_highlight) || highlights[0];
        const others = highlights.filter((h) => h.id !== star.id);

        // Featured image: preserve aspect, max 110mm tall, width = CW.
        try {
            const img = await loadImage(star.image_data);
            if (img) {
                const { w: imgW, h: imgH } = fitBox(img.naturalWidth, img.naturalHeight, CW, 110);
                needSpace(imgH + 14);
                const xCenter = M + (CW - imgW) / 2;
                pdf.addImage(star.image_data, detectImageFormat(star.image_data), xCenter, y, imgW, imgH);
                y += imgH + 3;

                // Caption + date line under the featured image.
                font(9, 'bold'); setText(TEXT);
                const captionLines = wrap(star.caption || '—', CW - 30);
                captionLines.forEach((ln) => { pdf.text(ln, M, y + 3.5); y += 4.4; });
                font(8); setText(MUTED);
                if (star.date) pdf.text(star.date, M + CW, y + 2, { align: 'right' });
                y += 4;
            }
        } catch { /* skip featured if loading fails */ }

        // Thumbnail strip — three per row.
        if (others.length > 0) {
            const cols = 3;
            const gap = 4;
            const thumbW = (CW - gap * (cols - 1)) / cols;
            const thumbH = thumbW * 0.62;
            const captionH = 12; // room for caption + date under each thumb
            let i = 0;
            while (i < others.length) {
                const rowItems = others.slice(i, i + cols);
                needSpace(thumbH + captionH + 6);
                for (let c = 0; c < rowItems.length; c += 1) {
                    const it = rowItems[c];
                    const x = M + c * (thumbW + gap);
                    try {
                         
                        const im = await loadImage(it.image_data);
                        if (im) {
                            pdf.addImage(it.image_data, detectImageFormat(it.image_data), x, y, thumbW, thumbH);
                        }
                    } catch { /* skip */ }
                    font(8); setText(TEXT);
                    const cap = wrap(it.caption || '—', thumbW)[0] || '';
                    pdf.text(cap, x, y + thumbH + 4);
                    if (it.date) {
                        font(7); setText(MUTED);
                        pdf.text(it.date, x, y + thumbH + 8);
                    }
                }
                y += thumbH + captionH;
                i += cols;
            }
            y += 2;
        }
    }

    sectionHeading('6 · Key Challenges');
    textBlock(report.key_challenges);

    // ── Footer pass ──────────────────────────────────────────
    const total = pdf.getNumberOfPages();
    for (let i = 1; i <= total; i += 1) {
        pdf.setPage(i);
        setDraw(LIGHT);
        pdf.setLineWidth(0.2);
        pdf.line(M, H - 10, W - M, H - 10);
        font(7.5); setText(MUTED);
        pdf.text('WHO AFRO · Health Emergency Preparedness · Preparedness Data Exchange (PDX)', M, H - 6);
        pdf.text(`SITREP ${report.sitrep_number}  ·  Page ${i} of ${total}`, W - M, H - 6, { align: 'right' });
    }

    const safeNo = (report.sitrep_number || `id${report.id}`).replace(/[^a-z0-9_-]/gi, '_');
    const dt = new Date().toISOString().split('T')[0];
    pdf.save(`SITREP_${safeNo}_${dt}.pdf`);
}
