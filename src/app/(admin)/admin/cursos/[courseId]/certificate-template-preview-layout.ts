import type { CertificateTemplateField } from "@/features/certificates/template-rules";
import { CERTIFICATE_PAGE } from "@/features/certificates/template-rules";

const POINTS_PER_MILLIMETER = 72 / 25.4;
export const CERTIFICATE_PAGE_WIDTH_POINTS =
  CERTIFICATE_PAGE.width * POINTS_PER_MILLIMETER;

// PDFKit and browsers use different font engines. This fixed ratio is the
// closest stable browser approximation of PDFKit's built-in Helvetica leading.
export const CERTIFICATE_PREVIEW_LINE_HEIGHT = 1.15;

const getVerticalAlignItems = (
  verticalAlign: CertificateTemplateField["verticalAlign"]
): "center" | "flex-end" | "flex-start" => {
  if (verticalAlign === "top") {
    return "flex-start";
  }
  if (verticalAlign === "bottom") {
    return "flex-end";
  }
  return "center";
};

const getHorizontalJustifyContent = (
  align: CertificateTemplateField["align"]
): "center" | "flex-end" | "flex-start" => {
  if (align === "right") {
    return "flex-end";
  }
  if (align === "center") {
    return "center";
  }
  return "flex-start";
};

export const getCertificatePreviewFontSize = (
  fontSizePoints: number,
  renderedWidth: number
): number => (fontSizePoints * renderedWidth) / CERTIFICATE_PAGE_WIDTH_POINTS;

export const getCertificatePreviewFrame = (
  field: CertificateTemplateField
): React.CSSProperties => ({
  height: `${field.height}%`,
  left: `${field.x}%`,
  top: `${field.y}%`,
  width: `${field.width}%`,
});

export const getCertificatePreviewTextStyle = (
  field: CertificateTemplateField,
  renderedWidth: number
): React.CSSProperties => {
  const verticalAlign = field.verticalAlign ?? "middle";
  return {
    ...getCertificatePreviewFrame(field),
    alignItems: getVerticalAlignItems(verticalAlign),
    color: field.color,
    display: "flex",
    fontFamily: "Helvetica, Arial, sans-serif",
    fontSize: `${
      Math.round(
        getCertificatePreviewFontSize(field.fontSize, renderedWidth) * 1000
      ) / 1000
    }px`,
    fontWeight: field.font === "Helvetica-Bold" ? 700 : 400,
    justifyContent: getHorizontalJustifyContent(field.align),
    lineHeight: CERTIFICATE_PREVIEW_LINE_HEIGHT,
    textAlign: field.align,
  };
};
