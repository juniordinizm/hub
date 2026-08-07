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

type MockDocument = EventEmitter & {
  end: () => void;
  fillColor: (color: string) => MockDocument;
  font: (font: string) => MockDocument;
  fontSize: (size: number) => MockDocument;
  heightOfString: (value: string, options: { width: number }) => number;
  image: (...args: unknown[]) => MockDocument;
  text: (...args: unknown[]) => MockDocument;
};

const createMockDocument = () => {
  const document = new EventEmitter() as MockDocument;
  document.image = vi.fn(() => document);
  document.font = vi.fn(() => document);
  document.fillColor = vi.fn(() => document);
  document.fontSize = vi.fn(() => document);
  document.heightOfString = vi.fn(() => 1);
  document.text = vi.fn(() => document);
  document.end = vi.fn(() => {
    document.emit("data", Buffer.from("%PDF-mock"));
    document.emit("end");
  });
  return document;
};

const snapshot: CertificateRenderSnapshot = {
  certificate: { code: "CERT-123", issuedAt: "2026-07-22T12:00:00.000Z" },
  completion: { completedAt: "2026-07-21T12:00:00.000Z" },
  course: { title: "Curso de teste", workloadHours: 10 },
  issuer: {
    cnpj: "12.345.678/0001-90",
    courseFreeStatement: "Curso livre.",
    displayName: "Hub Educacao",
    legalName: "Hub Educacao LTDA",
  },
  student: { name: "Ana" },
  template: {
    backgroundKey: "background.webp",
    fields: [
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
    ],
    id: "2c5c41a6-29c1-4a42-8474-f1f7021d5137",
    signatureKey: null,
    signerName: "Dra. Ana",
    signerRole: "Responsavel tecnica",
    version: 1,
  },
  version: 1,
};

describe("certificate rendering field values", () => {
  it("passes the configured signer role to the PDF document", async () => {
    const document = createMockDocument();
    dependencies.createCertificatePdfDocument.mockReturnValueOnce(document);
    const background = await sharp({
      create: { background: "#ffffff", channels: 3, height: 1680, width: 2376 },
    })
      .webp()
      .toBuffer();

    await renderCertificatePdf({
      background,
      publicBaseUrl: "https://hub.example.test",
      signature: null,
      snapshot,
    });

    expect(document.text).toHaveBeenCalledWith(
      "Responsavel tecnica",
      expect.any(Number),
      expect.any(Number),
      expect.objectContaining({ align: "center" })
    );
    expect(dependencies.createCertificatePdfDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        info: expect.objectContaining({
          Author: "Hub Educacao",
          Creator: "Hub",
          Keywords: expect.stringContaining("CERT-123"),
          Subject: "Certificado de conclusao: Curso de teste",
        }),
      })
    );
  });

  it("rejects text that cannot fit its configured field height", async () => {
    const document = createMockDocument();
    document.heightOfString = vi.fn(() => 100);
    dependencies.createCertificatePdfDocument.mockReturnValueOnce(document);
    const background = await sharp({
      create: { background: "#ffffff", channels: 3, height: 1680, width: 2376 },
    })
      .webp()
      .toBuffer();

    await expect(
      renderCertificatePdf({
        background,
        publicBaseUrl: "https://hub.example.test",
        signature: null,
        snapshot,
      })
    ).rejects.toThrow("certificate_field_overflow:signerRole");
  });
});
