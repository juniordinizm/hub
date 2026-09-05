import { describe, expect, it } from "vitest";
import {
  CERTIFICATE_PREVIEW_LINE_HEIGHT,
  getCertificatePreviewFontSize,
  getCertificatePreviewFrame,
  getCertificatePreviewTextStyle,
} from "./certificate-template-preview-layout";

const THIRTY_PIXEL_PATTERN = /^30(\.0+)?px$/;

describe("getCertificatePreviewFontSize", () => {
  it("scales PDF points from the rendered A4 width", () => {
    expect(getCertificatePreviewFontSize(30, 841.89)).toBeCloseTo(30, 2);
    expect(getCertificatePreviewFontSize(30, 420.945)).toBeCloseTo(15, 2);
  });

  it("keeps a safe size before the preview is measured", () => {
    expect(getCertificatePreviewFontSize(30, 0)).toBe(0);
  });
});

describe("certificate preview layout", () => {
  const field = {
    align: "right" as const,
    color: "#123456",
    field: "studentName" as const,
    font: "Helvetica-Bold" as const,
    fontSize: 30,
    height: 12,
    visible: true,
    width: 18,
    x: 72,
    y: 80,
  };

  it("uses the exact normalized box for QR, signature and text", () => {
    expect(getCertificatePreviewFrame(field)).toEqual({
      height: "12%",
      left: "72%",
      top: "80%",
      width: "18%",
    });
  });

  it("maps PDF Helvetica typography to the closest browser metrics", () => {
    expect(getCertificatePreviewTextStyle(field, 841.89)).toMatchObject({
      alignItems: "center",
      color: "#123456",
      display: "flex",
      fontFamily: "Certificate Inter, sans-serif",
      fontSize: expect.stringMatching(THIRTY_PIXEL_PATTERN),
      fontWeight: 700,
      lineHeight: CERTIFICATE_PREVIEW_LINE_HEIGHT,
      justifyContent: "flex-end",
      textAlign: "right",
    });
  });

  it.each([
    ["left", "flex-start"],
    ["center", "center"],
    ["right", "flex-end"],
  ] as const)("maps horizontal alignment %s to %s", (align, justifyContent) => {
    expect(
      getCertificatePreviewTextStyle({ ...field, align }, 841.89)
    ).toMatchObject({ justifyContent, textAlign: align });
  });

  it.each([
    ["top", "flex-start"],
    ["middle", "center"],
    ["bottom", "flex-end"],
  ] as const)("maps vertical alignment %s to %s", (verticalAlign, alignItems) => {
    expect(
      getCertificatePreviewTextStyle({ ...field, verticalAlign }, 841.89)
    ).toMatchObject({ alignItems });
  });
});
