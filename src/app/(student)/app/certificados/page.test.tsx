import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CertificateRecord } from "@/features/certificates/server";

const dependencies = vi.hoisted(() => ({
  getCertificatesForUser: vi.fn(),
  requireSession: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));
vi.mock("@/features/certificates/server", () => ({
  getCertificatesForUser: dependencies.getCertificatesForUser,
}));
vi.mock("@/lib/env", () => ({
  getServerEnv: () => ({
    CERTIFICATE_PUBLIC_BASE_URL: "https://certificates.example",
  }),
}));
vi.mock("@/lib/session", () => ({
  requireSession: dependencies.requireSession,
}));
vi.mock("./certificate-card", () => ({
  CertificateCard: ({
    certificate,
    publicUrl,
  }: {
    certificate: CertificateRecord;
    publicUrl: string;
  }) => (
    <article data-public-url={publicUrl}>{certificate.courseTitle}</article>
  ),
}));
vi.mock("./pending-certificate-refresh", () => ({
  PendingCertificateRefresh: () => null,
}));

import MyCertificatesPage from "./page";

const readyCertificate: CertificateRecord = {
  code: "CERT-001",
  courseTitle: "Curso de teste",
  issuedAt: new Date("2026-07-20T12:00:00.000Z"),
  renderStatus: "ready",
  revokedAt: null,
  revokedReasonCategory: null,
  status: "valid",
  studentName: "Maria Silva",
  workloadHours: 12,
};

const renderPage = async (
  certificates: CertificateRecord[]
): Promise<string> => {
  dependencies.getCertificatesForUser.mockResolvedValue(certificates);
  return renderToStaticMarkup(await MyCertificatesPage());
};

describe("MyCertificatesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dependencies.requireSession.mockResolvedValue({
      role: "student",
      user: { id: "student-1" },
    });
  });

  it("renders the certificate library without decorative metrics", async () => {
    const markup = await renderPage([readyCertificate]);

    expect(markup).toContain("Seus certificados");
    expect(markup).toContain("Curso de teste");
    expect(markup).toContain(
      'data-public-url="https://certificates.example/certificados/CERT-001"'
    );
    expect(markup).not.toContain("Emitidos");
    expect(markup).not.toContain("Validação</p>");
    expect(markup).not.toContain(">QR<");
  });

  it("preserves the empty state and course navigation", async () => {
    const markup = await renderPage([]);

    expect(markup).toContain("Nenhum certificado emitido ainda");
    expect(markup).toContain('href="/app"');
    expect(markup).toContain("Voltar para meus cursos");
  });
});
