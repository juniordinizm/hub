import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  deleteR2Objects: vi.fn(),
  getPool: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({ getPool: dependencies.getPool }));
vi.mock("@/features/storage/r2", () => ({
  deleteR2Objects: dependencies.deleteR2Objects,
}));

import { reconcileRevokedCertificateArtifacts } from "./artifact-reconciliation";

describe("reconcileRevokedCertificateArtifacts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("clears stale revoked claims and deletes only twice-verified orphan keys", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rowCount: 1, rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: "certificate-1" }] })
      .mockResolvedValueOnce({ rows: [{ id: "certificate-1" }] });
    dependencies.getPool.mockReturnValue({ query });
    dependencies.deleteR2Objects.mockResolvedValue(undefined);

    await expect(reconcileRevokedCertificateArtifacts()).resolves.toBe(1);

    expect(query.mock.calls[0]?.[0]).toContain("status = 'revoked'");
    expect(query.mock.calls[0]?.[0]).toContain("render_claimed_at < now()");
    expect(query.mock.calls[1]?.[0]).toContain("pdf_storage_key is null");
    expect(query.mock.calls[1]?.[0]).toContain(
      "render_status in ('pending', 'failed')"
    );
    expect(query.mock.calls[1]?.[0]).toContain("message.status = 'processing'");
    expect(query.mock.calls[1]?.[0]).toContain(
      "certificate.artifact_reconciled"
    );
    expect(query.mock.calls[2]?.[0]).toContain("certificate.id = $1");
    expect(dependencies.deleteR2Objects).toHaveBeenCalledWith([
      "certificates/certificate-1/certificate.pdf",
    ]);
    expect(query.mock.calls[3]?.[0]).toContain(
      "certificate.artifact_reconciled"
    );
  });

  it("does not delete when the final database verification no longer qualifies", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: "certificate-1" }] })
      .mockResolvedValueOnce({ rows: [] });
    dependencies.getPool.mockReturnValue({ query });

    await expect(reconcileRevokedCertificateArtifacts()).resolves.toBe(0);
    expect(dependencies.deleteR2Objects).not.toHaveBeenCalled();
  });
});
