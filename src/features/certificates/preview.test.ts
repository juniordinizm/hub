import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { renderCertificatePreview } from "./preview";
import type { CertificateRenderSnapshot } from "./render-snapshot";

const SHA256_PATTERN = /^[0-9a-f]{64}$/;

const snapshot: CertificateRenderSnapshot = {
  certificate: { code: "PRT-PREVIEW", issuedAt: "2026-08-18T12:00:00.000Z" },
  completion: { completedAt: "2026-08-17T12:00:00.000Z" },
  course: { title: "Curso de preview", workloadHours: 8 },
  issuer: {
    cnpj: "12.345.678/0001-90",
    displayName: "Hub",
    legalName: "Hub Educação LTDA",
  },
  student: { name: "Aluna de preview" },
  template: {
    backgroundKey: "certificates/templates/background.png",
    fields: [
      {
        align: "center",
        color: "#17292b",
        field: "studentName",
        font: "Helvetica-Bold",
        fontSize: 24,
        height: 12,
        visible: true,
        width: 70,
        x: 15,
        y: 35,
        verticalAlign: "middle",
      },
      {
        align: "center",
        color: "#17292b",
        field: "qrCode",
        fontSize: 10,
        height: 12,
        visible: true,
        width: 12,
        x: 82,
        y: 80,
        verticalAlign: "middle",
      },
    ],
    id: "2c5c41a6-29c1-4a42-8474-f1f7021d5137",
    signatureKey: null,
    signerName: null,
    signerRole: null,
    version: 1,
  },
  version: 1,
};

describe("renderCertificatePreview", () => {
  it("creates a self-contained PNG preview with the A4 dimensions", async () => {
    const background = await sharp({
      create: {
        background: "#ffffff",
        channels: 3,
        height: 849,
        width: 1200,
      },
    })
      .png()
      .toBuffer();

    const result = await renderCertificatePreview({
      background,
      publicBaseUrl: "https://hub.example.test",
      signature: null,
      snapshot,
    });
    const metadata = await sharp(result.png).metadata();

    expect(result.png.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    expect(metadata.width).toBe(1200);
    expect(metadata.height).toBe(848);
    expect(result.sha256).toMatch(SHA256_PATTERN);
  });
});
