import { EventEmitter } from "node:events";
import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";
import type { CertificateRenderSnapshot } from "./render-snapshot";

const dependencies = vi.hoisted(() => ({
  createCertificatePdfDocument: vi.fn(),
}));

vi.mock("./pdf-document", () => ({
  createCertificatePdfDocument: dependencies.createCertificatePdfDocument,
}));

import { renderCertificatePdf } from "./rendering";

const snapshot: CertificateRenderSnapshot = {
  certificate: { code: "CERT-ERROR", issuedAt: "2026-07-22T12:00:00.000Z" },
  completion: { completedAt: "2026-07-21T12:00:00.000Z" },
  course: { title: "Curso", workloadHours: 8 },
  issuer: {
    cnpj: "12.345.678/0001-90",
    displayName: "Hub",
    legalName: "Hub Educacao LTDA",
  },
  student: { name: "Ana" },
  template: {
    backgroundKey: "background.webp",
    fields: [],
    id: "2c5c41a6-29c1-4a42-8474-f1f7021d5137",
    signatureKey: null,
    signerName: null,
    signerRole: null,
    version: 1,
  },
  version: 1,
};

describe("renderCertificatePdf errors", () => {
  it("rejects when PDFKit emits an output error", async () => {
    const document = new EventEmitter() as EventEmitter & {
      end: () => void;
      image: () => typeof document;
    };
    document.image = () => document;
    document.end = () => {
      queueMicrotask(() =>
        document.emit("error", new Error("pdf_write_failed"))
      );
    };
    dependencies.createCertificatePdfDocument.mockReturnValue(document);
    const background = await sharp({
      create: { background: "#ffffff", channels: 3, height: 1680, width: 2376 },
    })
      .png()
      .toBuffer();

    await expect(
      renderCertificatePdf({
        background,
        publicBaseUrl: "https://hub.example.test",
        signature: null,
        snapshot,
      })
    ).rejects.toThrow("pdf_write_failed");
  });
});
