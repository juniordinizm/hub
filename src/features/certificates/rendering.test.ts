import sharp from "sharp";
import { describe, expect, it } from "vitest";
import type { CertificateRenderSnapshot } from "./render-snapshot";
import { renderCertificatePdf } from "./rendering";
import { createDefaultCertificateTemplateFields } from "./template-rules";

const SHA256_PATTERN = /^[0-9a-f]{64}$/;

const snapshot: CertificateRenderSnapshot = {
  certificate: { code: "CERT-123", issuedAt: "2026-07-22T12:00:00.000Z" },
  completion: { completedAt: "2026-07-21T12:00:00.000Z" },
  course: { title: "Curso de teste", workloadHours: 10 },
  issuer: {
    cnpj: "12.345.678/0001-90",
    displayName: "Hub",
    legalName: "Hub Educacao LTDA",
  },
  student: { name: "Ana" },
  template: {
    backgroundKey: "background.webp",
    fields: [
      {
        align: "center",
        color: "#111111",
        field: "studentName",
        font: "Helvetica-Bold",
        fontSize: 24,
        height: 10,
        visible: true,
        width: 80,
        x: 10,
        y: 30,
      },
      {
        align: "center",
        color: "#111111",
        field: "signerRole",
        font: "Helvetica",
        fontSize: 10,
        height: 5,
        visible: true,
        width: 40,
        x: 30,
        y: 45,
      },
      {
        align: "center",
        color: "#111111",
        field: "qrCode",
        fontSize: 10,
        height: 10,
        visible: true,
        width: 10,
        x: 80,
        y: 80,
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

describe("renderCertificatePdf", () => {
  it("renders the immutable background, configured font, student value, and QR code", async () => {
    const background = await sharp({
      create: { background: "#ffffff", channels: 3, height: 1680, width: 2376 },
    })
      .webp()
      .toBuffer();

    const result = await renderCertificatePdf({
      background,
      publicBaseUrl: "https://hub.example.test",
      signature: null,
      snapshot,
    });

    expect(result.pdf.subarray(0, 4).toString()).toBe("%PDF");
    expect(result.sha256).toHaveLength(64);
    expect(result.pdf.toString("latin1")).toContain("Inter-Bold");
  });

  it("produces identical bytes and hash from the same immutable inputs", async () => {
    const background = await sharp({
      create: { background: "#ffffff", channels: 3, height: 1680, width: 2376 },
    })
      .webp()
      .toBuffer();
    const input = {
      background,
      publicBaseUrl: "https://hub.example.test",
      signature: null,
      snapshot,
    } as const;

    const first = await renderCertificatePdf(input);
    const second = await renderCertificatePdf(input);

    expect(second.sha256).toBe(first.sha256);
    expect(second.pdf.equals(first.pdf)).toBe(true);
  });

  it("renders representative certificate data with the published default fields", async () => {
    const background = await sharp({
      create: { background: "#ffffff", channels: 3, height: 849, width: 1200 },
    })
      .png()
      .toBuffer();
    const defaultSnapshot: CertificateRenderSnapshot = {
      ...snapshot,
      certificate: {
        code: "PRT-E55E66C1C8484442AAA93AABCD489AB8",
        issuedAt: snapshot.certificate.issuedAt,
      },
      course: { title: "Curso E2E certificável", workloadHours: 1 },
      student: { name: "Aluna para conclusao" },
      template: {
        ...snapshot.template,
        fields: createDefaultCertificateTemplateFields(),
      },
    };

    await expect(
      renderCertificatePdf({
        background,
        publicBaseUrl: "http://127.0.0.1:3100",
        signature: null,
        snapshot: defaultSnapshot,
      })
    ).resolves.toMatchObject({
      sha256: expect.stringMatching(SHA256_PATTERN),
    });
  });
});
