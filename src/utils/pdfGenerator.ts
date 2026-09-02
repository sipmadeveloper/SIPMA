import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

/**
 * High-quality client-side PDF generator from DOM Element
 * Creates a clean A4 portrait PDF file and triggers instant download.
 */
export async function downloadElementAsPdf(
  elementId: string,
  filename: string
): Promise<boolean> {
  try {
    const element = document.getElementById(elementId);
    if (!element) {
      console.warn(`Element #${elementId} not found for PDF generation.`);
      return false;
    }

    // Capture at high resolution (scale 2) with clean background
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: 1200,
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.98);
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pdfWidth = pdf.internal.pageSize.getWidth(); // 210mm
    const pdfHeight = pdf.internal.pageSize.getHeight(); // 297mm
    const imgWidth = pdfWidth;
    const imgHeight = (canvas.height * pdfWidth) / canvas.width;

    // Center or fit nicely
    if (imgHeight <= pdfHeight) {
      pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, imgHeight);
    } else {
      // Multi-page or single fit
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
      heightLeft -= pdfHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
        heightLeft -= pdfHeight;
      }
    }

    const cleanFilename = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
    pdf.save(cleanFilename);
    return true;
  } catch (error) {
    console.error('Error generating PDF:', error);
    // Fallback: trigger standard browser print dialog
    try {
      window.print();
      return true;
    } catch {
      return false;
    }
  }
}
