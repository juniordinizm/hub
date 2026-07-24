import { describe, expect, it } from "vitest";
import type { CertificateRecord } from "@/features/certificates/server";
import { getCertificateListViewModel } from "./certificate-list-view-model";

const certificateState = (
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

describe("getCertificateListViewModel", () => {
  it("marks a valid pending certificate as preparing without download", () => {
    const result = getCertificateListViewModel(certificateState());

    expect(result).toMatchObject({
      canDownload: false,
      kind: "preparing",
      showSupportAction: false,
      statusLabel: "Preparando",
    });
  });

  it("makes only a valid ready certificate available for download", () => {
    const result = getCertificateListViewModel(
      certificateState({ renderStatus: "ready" })
    );

    expect(result).toMatchObject({
      alert: null,
      canDownload: true,
      kind: "available",
      statusLabel: "Disponível",
    });
  });

  it("gives revocation precedence over a ready render", () => {
    const result = getCertificateListViewModel(
      certificateState({
        renderStatus: "ready",
        revokedAt: new Date("2026-07-22T12:00:00.000Z"),
        revokedReasonCategory: "integrity_review",
        status: "revoked",
      })
    );

    expect(result).toMatchObject({
      canDownload: false,
      kind: "revoked",
      showSupportAction: false,
      statusLabel: "Revogado",
    });
    expect(result.alert?.description).toContain("22 de jul. de 2026");
    expect(result.alert?.description).toContain("Revisao de integridade");
  });

  it("distinguishes a render failure and exposes a support action", () => {
    const result = getCertificateListViewModel(
      certificateState({ renderStatus: "failed" })
    );

    expect(result).toMatchObject({
      canDownload: false,
      kind: "failed",
      showSupportAction: true,
      statusLabel: "Falha no preparo",
    });
    expect(result.alert?.title).toBe("Falha no preparo do PDF");
  });
});
