import PDFDocument from "pdfkit";

export const createCertificatePdfDocument = (
  options: PDFKit.PDFDocumentOptions
): PDFKit.PDFDocument => new PDFDocument(options);
