import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  createR2ObjectReadUrl: vi.fn(),
  deleteR2Objects: vi.fn(),
  query: vi.fn(),
  renderCertificatePreview: vi.fn(),
  uploadPrivateR2Object: vi.fn(),
  verifyPrivateR2ObjectSha256: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({
  getPool: () => ({ query: dependencies.query }),
}));
vi.mock("@/features/storage/r2", () => ({
  createR2ObjectReadUrl: dependencies.createR2ObjectReadUrl,
  deleteR2Objects: dependencies.deleteR2Objects,
  uploadPrivateR2Object: dependencies.uploadPrivateR2Object,
  verifyPrivateR2ObjectSha256: dependencies.verifyPrivateR2ObjectSha256,
}));
vi.mock("@/lib/env", () => ({
  getServerEnv: () => ({ CERTIFICATE_PUBLIC_BASE_URL: "https://hub.test" }),
}));
vi.mock("./render-snapshot", () => ({
  parseCertificateRenderSnapshot: () => ({
    template: { backgroundKey: "background.png", signatureKey: null },
  }),
}));
vi.mock("./preview", () => ({
  renderCertificatePreview: dependencies.renderCertificatePreview,
}));

import { getCertificatePreviewReadUrl } from "./preview-server";

const CERTIFICATE = {
  id: "certificate-1",
  preview_sha256: "stored-hash",
  render_snapshot: { template: {} },
};

describe("getCertificatePreviewReadUrl", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(8),
      })
    );
    dependencies.query.mockResolvedValue({ rows: [CERTIFICATE] });
    dependencies.createR2ObjectReadUrl.mockResolvedValue("https://r2.test/url");
    dependencies.renderCertificatePreview.mockResolvedValue({
      png: Buffer.from("png"),
      sha256: "new-hash",
    });
    dependencies.uploadPrivateR2Object.mockResolvedValue(undefined);
    dependencies.deleteR2Objects.mockResolvedValue(undefined);
  });

  it("serves the stored object when the digest matches", async () => {
    dependencies.verifyPrivateR2ObjectSha256.mockResolvedValue("match");

    await expect(getCertificatePreviewReadUrl("PRT-001")).resolves.toBe(
      "https://r2.test/url"
    );

    expect(dependencies.renderCertificatePreview).not.toHaveBeenCalled();
    expect(dependencies.query).not.toHaveBeenCalledWith(
      expect.stringContaining("update certificates"),
      expect.anything()
    );
  });

  it("deletes and regenerates the object when the digest mismatches", async () => {
    dependencies.verifyPrivateR2ObjectSha256.mockResolvedValue("mismatch");

    await getCertificatePreviewReadUrl("PRT-001");

    expect(dependencies.deleteR2Objects).toHaveBeenCalledWith([
      "certificates/certificate-1/certificate-preview.png",
    ]);
    expect(dependencies.uploadPrivateR2Object).toHaveBeenCalled();
    expect(dependencies.query).toHaveBeenCalledWith(
      expect.stringContaining("update certificates set preview_sha256"),
      ["certificate-1", "new-hash"]
    );
  });

  it("regenerates legacy previews without a stored digest", async () => {
    dependencies.query.mockResolvedValue({
      rows: [{ ...CERTIFICATE, preview_sha256: null }],
    });

    await getCertificatePreviewReadUrl("PRT-001");

    expect(dependencies.verifyPrivateR2ObjectSha256).not.toHaveBeenCalled();
    expect(dependencies.deleteR2Objects).not.toHaveBeenCalled();
    expect(dependencies.uploadPrivateR2Object).toHaveBeenCalled();
    expect(dependencies.query).toHaveBeenCalledWith(
      expect.stringContaining("update certificates set preview_sha256"),
      ["certificate-1", "new-hash"]
    );
  });

  it("fails closed when storage verification is unavailable", async () => {
    dependencies.verifyPrivateR2ObjectSha256.mockResolvedValue("unavailable");

    await expect(getCertificatePreviewReadUrl("PRT-001")).rejects.toThrow(
      "certificate_preview_storage_unavailable"
    );

    expect(dependencies.uploadPrivateR2Object).not.toHaveBeenCalled();
  });

  it("returns null for an unknown certificate code", async () => {
    dependencies.query.mockResolvedValue({ rows: [] });

    await expect(getCertificatePreviewReadUrl("PRT-404")).resolves.toBeNull();
  });
});
