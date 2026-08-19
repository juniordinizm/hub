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

    expect(markup).toContain("<h1");
    expect(markup).toContain("Verificação de certificado");
    expect(markup).toContain("Emitido para");
    expect(markup).toContain(
      "Documento válido e verificável pelo código público."
    );
    expect(markup).toContain(
      'aria-label="Certificado válido: Documento válido e verificável pelo código público."'
    );
    expect(markup).toContain("bg-emerald-600");
    expect(markup).toContain('data-certificate-status="valid"');
    expect(markup).toContain('data-certificate-document="true"');
    expect(markup).toContain("Código do certificado");
    expect(markup).toContain('data-certificate-code="true"');
    expect(markup).not.toContain("Emissora");
    expect(markup).not.toContain("CNPJ do emissor");
    expect(markup).not.toContain("Carga horária");
    expect(markup).not.toContain("Emissão");
    expect(markup).toContain('alt="Prévia do certificado"');
    expect(markup).not.toContain("Documento oficial");
    expect(markup).toContain(
      'src="/certificados/PRT-1234567890ABCDEF1234567890ABCDEF/preview"'
    );
    expect(markup).toContain("Baixar PDF");
    expect(markup).toContain("Copiar link");
    expect(markup).not.toContain("A4 · PDF");
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
    expect(markup).toContain("Estamos preparando o documento");
    expect(markup).toContain('data-certificate-status="pending"');
    expect(markup).toContain('data-certificate-code="true"');
    expect(markup).not.toContain('alt="Prévia do certificado"');
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
    expect(markup).toContain('data-certificate-status="revoked"');
    expect(markup).toContain('data-certificate-code="true"');
    expect(markup).not.toContain('alt="Prévia do certificado"');
    expect(markup).not.toContain("Baixar PDF");
  });

  it("shows a failed certificate with a recovery message without preview or download", async () => {
    dependencies.consumePublicCertificateLookup.mockResolvedValue("allowed");
    dependencies.getCertificateByCode.mockResolvedValue({
      code: "PRT-FAILED",
      completionAt: new Date("2026-07-20T12:00:00.000Z"),
      courseTitle: "Curso indisponível",
      issuedAt: new Date("2026-07-21T12:00:00.000Z"),
      issuerCnpj: "00.000.000/0001-00",
      issuerName: "Emissora",
      renderStatus: "failed",
      revokedAt: null,
      revokedReasonCategory: null,
      status: "valid",
      studentName: "Aluna",
      workloadHours: 8,
    });

    const markup = renderToStaticMarkup(
      await CertificateValidationPage({
        params: Promise.resolve({ code: "PRT-FAILED" }),
      })
    );

    expect(markup).toContain("Certificado indisponível");
    expect(markup).toContain("Entre em contato com o Suporte");
    expect(markup).toContain('data-certificate-status="failed"');
    expect(markup).toContain('data-certificate-code="true"');
    expect(markup).not.toContain('alt="Prévia do certificado"');
    expect(markup).not.toContain("Baixar PDF");
  });

  it("marks public certificate links as non-indexable", () => {
    expect(metadata).toEqual({ robots: { follow: false, index: false } });
  });
});
