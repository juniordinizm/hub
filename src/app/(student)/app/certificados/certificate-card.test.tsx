import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { CertificateRecord } from "@/features/certificates/server";

vi.mock("@/components/support-request-dialog", () => ({
  SupportRequestDialog: ({ triggerLabel }: { triggerLabel: string }) => (
    <button type="button">{triggerLabel}</button>
  ),
}));
vi.mock("./pending-certificate-refresh", () => ({
  PendingCertificateRefresh: ({
    showManualRefresh,
  }: {
    showManualRefresh?: boolean;
  }) =>
    showManualRefresh ? <button type="button">Atualizar status</button> : null,
}));
vi.mock("./certificate-copy-link-button", () => ({
  CertificateCopyLinkButton: ({ publicUrl }: { publicUrl: string }) => (
    <button data-public-url={publicUrl} type="button">
      Copiar link
    </button>
  ),
}));

import { CertificateCard } from "./certificate-card";

const certificate = (
  overrides: Partial<CertificateRecord> = {}
): CertificateRecord => ({
  code: "CERT-001",
  courseTitle: "Curso de teste",
  issuedAt: new Date("2026-07-20T12:00:00.000Z"),
  renderStatus: "pending",
  revokedAt: null,
  revokedReasonCategory: null,
  status: "valid",
  studentName: "Maria Silva",
  workloadHours: 12,
  ...overrides,
});

const renderCertificate = (
  overrides: Partial<CertificateRecord> = {},
  publicUrl = "https://certificados.example/certificados/CERT-001"
): string =>
  renderToStaticMarkup(
    <CertificateCard
      certificate={certificate(overrides)}
      publicUrl={publicUrl}
    />
  );

describe("CertificateCard", () => {
  it("exposes accessible status and actions for an available certificate", () => {
    const markup = renderCertificate({ renderStatus: "ready" });

    expect(markup).toContain('role="article"');
    expect(markup).toContain('aria-label="Status: Disponível"');
    expect(markup).toContain('aria-label="Baixar PDF de Curso de teste"');
    expect(markup).toContain('href="/certificados/CERT-001"');
    expect(markup).toContain(">Curso de teste</a>");
    expect(markup).toContain("Copiar link");
    expect(markup).not.toContain(">Validar</a>");
    expect(markup).not.toContain('role="alert"');
  });

  it("never renders download for a revoked ready certificate", () => {
    const markup = renderCertificate({
      renderStatus: "ready",
      revokedAt: new Date("2026-07-22T12:00:00.000Z"),
      revokedReasonCategory: "integrity_review",
      status: "revoked",
    });

    expect(markup).toContain('aria-label="Status: Revogado"');
    expect(markup).toContain('role="alert"');
    expect(markup).toContain("Revogado em 22 de jul. de 2026");
    expect(markup).toContain("Revisao de integridade");
    expect(markup).not.toContain("Baixar PDF");
    expect(markup).toContain('href="/certificados/CERT-001"');
    expect(markup).toContain("Copiar link");
    expect(markup).not.toContain(">Validar</a>");
  });

  it("presents a failed render as an actionable error", () => {
    const markup = renderCertificate({ renderStatus: "failed" });

    expect(markup).toContain('aria-label="Status: Falha no preparo"');
    expect(markup).toContain('role="alert"');
    expect(markup).toContain("Falha no preparo do PDF");
    expect(markup).toContain("Falar com suporte");
    expect(markup).not.toContain("Baixar PDF");
  });

  it("presents a pending render without a false failure or download", () => {
    const markup = renderCertificate();

    expect(markup).toContain('aria-label="Status: Preparando"');
    expect(markup).toContain('role="status"');
    expect(markup).toContain("Estamos preparando seu PDF");
    expect(markup).not.toContain('role="alert"');
    expect(markup).not.toContain("Falar com suporte");
    expect(markup).not.toContain("Baixar PDF");
    expect(markup).toContain("Atualizar status");
  });

  it("encodes reserved certificate code characters in every destination", () => {
    const markup = renderCertificate(
      { code: "CERT/A B?#", renderStatus: "ready" },
      "https://certificados.example/certificados/CERT%2FA%20B%3F%23"
    );

    expect(markup).toContain('href="/certificados/CERT%2FA%20B%3F%23"');
    expect(markup).toContain('href="/app/certificados/CERT%2FA%20B%3F%23/pdf"');
    expect(markup).toContain(
      'data-public-url="https://certificados.example/certificados/CERT%2FA%20B%3F%23"'
    );
  });
});
