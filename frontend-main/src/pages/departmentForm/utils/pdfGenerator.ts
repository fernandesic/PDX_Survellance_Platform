import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { saveAs } from 'file-saver';
import { logger } from "@/utils/logger";

export const generateDepartmentFormPdf = async (
    elementId: string,
    record: any,
    onStart?: () => void,
    onComplete?: () => void,
    onError?: (error: any) => void
) => {
    if (onStart) onStart();

    // Give React a moment to render the newly mounted component
    let element = document.getElementById(elementId);
    let attempts = 0;
    while (!element && attempts < 10) {
        await new Promise(r => setTimeout(r, 100));
        element = document.getElementById(elementId);
        attempts++;
    }

    if (!element) {
        if (onError) onError(new Error('PDF element not found after multiple attempts'));
        return;
    }

    try {
        // Standardized wait for font/signature rendering
        await new Promise(r => setTimeout(r, 1500));

        const canvas = await html2canvas(element, {
            scale: 2,
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff'
        });

        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'px',
            format: [canvas.width / 2, canvas.height / 2]
        });

        pdf.addImage(imgData, 'PNG', 0, 0, canvas.width / 2, canvas.height / 2);

        const safeSerial = String(record?.serial_no || 'Document').trim().replace(/[^a-z0-9]/gi, '_');
        const fileName = `DPR_${safeSerial}.pdf`;

        const pdfBlob = pdf.output('blob');
        saveAs(pdfBlob, fileName);

        if (onComplete) onComplete();
    } catch (error) {
        logger.error('PDF Generation Error:', error);
        if (onError) onError(error);
    }
};
