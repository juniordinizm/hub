import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  consumePublicCertificateLookup: vi.fn(),
  getCertificateByCode: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));
vi.mock("next/navigation", () => ({
  notFound: vi.fn(),
}));
vi.mock("@/features/certificates/public-rate-limit", () => ({
  consumePublicCertificateLookup: dependencies.consumePublicCertificateLookup,
}));
vi.mock("@/features/certificates/server", () => ({
  getCertificateByCode: dependencies.getCertificateByCode,
}));

import CertificateValidationPage, { metadata } from "./page";

describe("CertificateValidationPage", () => {
  it("shows the immutable claims needed to compare a presented PDF", async () => {
    dependencies.consumePublicCertificateLookup.mockResolvedValue("allowed");
    dependencies.getCertificateByCode.mockResolvedValue({
      code: "PRT-1234567890ABCDEF1234567890ABCDEF",
      completionAt: new Date("2026-07-20T12:00:00.000Z"),
      courseTitle: "Curso de teste",
      issuedAt: new Date("2026-07-21T12:00:00.000Z"),
      issuerCnpj: "00.000.000/0001-00",
      issuerName: "Emissora",
      renderStatus: "ready",
      revokedAt: null,
      revokedReasonCategory: null,
      status: "valid",
      studentName: "Aluna",
      workloadHours: 8,
    });

    const markup = renderToStaticMarkup(
      await CertificateValidationPage({
        params: Promise.resolve({
          code: "PRT-1234567890ABCDEF1234567890ABCDEF",
        }),
      })
    );

    expect(markup).toContain("Emissora");
    expect(markup).toContain("00.000.000/0001-00");
    expect(markup).toContain("Conclusão");
    expect(markup).toContain("<h1");
    expect(markup).toContain("Compare estes dados com o documento apresentado");
    expect(markup).toContain('title="Prévia do certificado"');
    expect(markup).toContain("Baixar PDF");
    expect(markup).toContain("Copiar link");
  });

  it("keeps a pending certificate visible without exposing a PDF action", async () => {
    dependencies.consumePublicCertificateLookup.mockResolvedValue("allowed");
    dependencies.getCertificateByCode.mockResolvedValue({
      code: "PRT-PENDING",
      completionAt: new Date("2026-07-20T12:00:00.000Z"),
      courseTitle: "Curso em preparação",
      issuedAt: new Date("2026-07-21T12:00:00.000Z"),
      issuerCnpj: "00.000.000/0001-00",
      issuerName: "Emissora",
      renderStatus: "pending",
      revokedAt: null,
      revokedReasonCategory: null,
      status: "valid",
      studentName: "Aluna",
      workloadHours: 8,
    });

    const markup = renderToStaticMarkup(
      await CertificateValidationPage({
        params: Promise.resolve({ code: "PRT-PENDING" }),
      })
    );

    expect(markup).toContain("Certificado em preparação");
    expect(markup).toContain("está sendo preparado");
    expect(markup).not.toContain('title="Prévia do certificado"');
    expect(markup).not.toContain("Baixar PDF");
  });

  it("shows a revoked certificate as invalid without preview or download", async () => {
    dependencies.consumePublicCertificateLookup.mockResolvedValue("allowed");
    dependencies.getCertificateByCode.mockResolvedValue({
      code: "PRT-REVOKED",
      completionAt: new Date("2026-07-20T12:00:00.000Z"),
      courseTitle: "Curso revogado",
      issuedAt: new Date("2026-07-21T12:00:00.000Z"),
      issuerCnpj: "00.000.000/0001-00",
      issuerName: "Emissora",
      renderStatus: "ready",
      revokedAt: new Date("2026-07-22T12:00:00.000Z"),
      revokedReasonCategory: "other",
      status: "revoked",
      studentName: "Aluna",
      workloadHours: 8,
    });

    const markup = renderToStaticMarkup(
      await CertificateValidationPage({
        params: Promise.resolve({ code: "PRT-REVOKED" }),
      })
    );

    expect(markup).toContain("Certificado revogado");
    expect(markup).toContain("não é válido");
    expect(markup).not.toContain('title="Prévia do certificado"');
    expect(markup).not.toContain("Baixar PDF");
  });

  it("marks public certificate links as non-indexable", () => {
    expect(metadata).toEqual({ robots: { follow: false, index: false } });
  });
});
