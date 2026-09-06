import sharp from "sharp";
import { describe, expect, it } from "vitest";
import {
  createCertificatePreviewSvg,
  renderCertificatePreview,
} from "./preview";
import type { CertificateRenderSnapshot } from "./render-snapshot";

const SHA256_PATTERN = /^[0-9a-f]{64}$/;

const snapshot: CertificateRenderSnapshot = {
  certificate: { code: "PRT-PREVIEW", issuedAt: "2026-08-18T12:00:00.000Z" },
  completion: { completedAt: "2026-08-17T12:00:00.000Z" },
  course: { title: "Ação", workloadHours: 8 },
  issuer: {
    cnpj: "12.345.678/0001-90",
    displayName: "Responsável",
    legalName: "Hub Educação LTDA",
  },
  student: { name: "João" },
  template: {
    backgroundKey: "certificates/templates/background.png",
    fields: [
      {
        align: "center",
        color: "#17292b",
        field: "courseTitle",
        font: "Helvetica",
        fontSize: 24,
        height: 12,
        visible: true,
        width: 70,
        x: 15,
        y: 20,
        verticalAlign: "middle",
      },
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
        field: "signerRole",
        font: "Helvetica",
        fontSize: 24,
        height: 12,
        visible: true,
        width: 70,
        x: 15,
        y: 50,
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
    signerRole: "Responsável",
    version: 1,
  },
  version: 1,
};

describe("createCertificatePreviewSvg", () => {
  it("uses Inter with the configured weight and preserves accented values", () => {
    const svg = createCertificatePreviewSvg({
      qrDataUrl: "data:image/png;base64,qr",
      signatureDataUrl: null,
      snapshot,
    });

    expect(svg).toContain('font-family="Inter"');
    expect(svg).toContain('font-weight="700"');
    expect(svg).not.toContain("Helvetica, Arial, sans-serif");
    expect(svg).toContain("Ação");
    expect(svg).toContain("Responsável");
  });
});

describe("renderCertificatePreview", () => {
  it("keeps PNG metadata and renders accented text into a non-empty ink region", async () => {
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

    const textRegion = await sharp(result.png)
      .extract({ height: 400, left: 100, top: 150, width: 1000 })
      .stats();
    expect(textRegion.channels.some((channel) => channel.min < 128)).toBe(true);
  });
});
