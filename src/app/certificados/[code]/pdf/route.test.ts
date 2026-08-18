import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  consumePublicCertificateLookup: vi.fn(),
  createR2ObjectReadUrl: vi.fn(),
  getCertificateByCode: vi.fn(),
  verifyPrivateR2ObjectSha256: vi.fn(),
}));

vi.mock("@/features/certificates/public-rate-limit", () => ({
  consumePublicCertificateLookup: dependencies.consumePublicCertificateLookup,
}));
vi.mock("@/features/certificates/server", () => ({
  getCertificateByCode: dependencies.getCertificateByCode,
}));
vi.mock("@/features/storage/r2", () => ({
  createR2ObjectReadUrl: dependencies.createR2ObjectReadUrl,
  verifyPrivateR2ObjectSha256: dependencies.verifyPrivateR2ObjectSha256,
}));

import { GET } from "./route";

const readyCertificate = {
  code: "PRT-READY",
  completionAt: new Date("2026-07-20T12:00:00.000Z"),
  courseTitle: "Curso pronto",
  issuedAt: new Date("2026-07-21T12:00:00.000Z"),
  issuerCnpj: "00.000.000/0001-00",
  issuerName: "Emissora",
  pdfSha256: "a".repeat(64),
  pdfStorageKey: "certificates/cert-ready/certificate.pdf",
  renderStatus: "ready" as const,
  revokedAt: null,
  revokedReasonCategory: null,
  status: "valid" as const,
  studentName: "Aluna",
  workloadHours: 8,
};

const requestCertificate = (code: string) =>
  GET(new Request(`https://hub.example.test/certificados/${code}/pdf`), {
    params: Promise.resolve({ code }),
  });

const expectPrivateErrorHeaders = (response: Response): void => {
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(response.headers.get("retry-after")).toBe("60");
};

describe("GET /certificados/[code]/pdf", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dependencies.consumePublicCertificateLookup.mockResolvedValue("allowed");
    dependencies.getCertificateByCode.mockResolvedValue(readyCertificate);
    dependencies.verifyPrivateR2ObjectSha256.mockResolvedValue("match");
    dependencies.createR2ObjectReadUrl.mockResolvedValue(
      "https://private-r2.example.test/signed"
    );
  });

  it("rate limits before looking up a public certificate", async () => {
    dependencies.consumePublicCertificateLookup.mockResolvedValue("limited");

    const response = await requestCertificate("PRT-READY");

    expect(response.status).toBe(404);
    expectPrivateErrorHeaders(response);
    expect(dependencies.getCertificateByCode).not.toHaveBeenCalled();
    expect(dependencies.createR2ObjectReadUrl).not.toHaveBeenCalled();
  });

  it("redirects only a valid ready certificate to a short-lived signed URL", async () => {
    const response = await requestCertificate("PRT-READY");

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://private-r2.example.test/signed"
    );
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    expect(dependencies.verifyPrivateR2ObjectSha256).toHaveBeenCalledWith({
      expectedSha256: "a".repeat(64),
      key: "certificates/cert-ready/certificate.pdf",
    });
    expect(dependencies.createR2ObjectReadUrl).toHaveBeenCalledWith({
      key: "certificates/cert-ready/certificate.pdf",
    });
  });

  it.each([
    ["revoked", { ...readyCertificate, status: "revoked" as const }],
    ["pending", { ...readyCertificate, renderStatus: "pending" as const }],
    ["failed", { ...readyCertificate, renderStatus: "failed" as const }],
  ] as const)("returns 404 for a %s certificate", async (_state, certificate) => {
    dependencies.getCertificateByCode.mockResolvedValue(certificate);

    const response = await requestCertificate(certificate.code);

    expect(response.status).toBe(404);
    expectPrivateErrorHeaders(response);
    expect(dependencies.verifyPrivateR2ObjectSha256).not.toHaveBeenCalled();
    expect(dependencies.createR2ObjectReadUrl).not.toHaveBeenCalled();
  });

  it("returns an uncached empty 404 when the certificate is missing", async () => {
    dependencies.getCertificateByCode.mockResolvedValue(null);

    const response = await requestCertificate("PRT-MISSING");

    expect(response.status).toBe(404);
    expectPrivateErrorHeaders(response);
    expect(await response.text()).toBe("");
  });

  it("returns 503 and never redirects when the stored artifact hash mismatches", async () => {
    dependencies.verifyPrivateR2ObjectSha256.mockResolvedValue("mismatch");

    const response = await requestCertificate("PRT-READY");

    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("retry-after")).toBe("60");
    expect(dependencies.createR2ObjectReadUrl).not.toHaveBeenCalled();
  });

  it("returns a sanitized uncached 503 when certificate lookup fails", async () => {
    dependencies.getCertificateByCode.mockRejectedValue(
      new Error("database details must stay private")
    );

    const response = await requestCertificate("PRT-READY");

    expect(response.status).toBe(503);
    expectPrivateErrorHeaders(response);
    expect(await response.text()).toBe("");
  });

  it("returns a sanitized uncached 503 when signing the PDF URL fails", async () => {
    dependencies.createR2ObjectReadUrl.mockRejectedValue(
      new Error("provider details must stay private")
    );

    const response = await requestCertificate("PRT-READY");

    expect(response.status).toBe(503);
    expectPrivateErrorHeaders(response);
    expect(await response.text()).toBe("");
  });
});
