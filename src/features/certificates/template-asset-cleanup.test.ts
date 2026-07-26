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

import {
  prepareCertificateTemplateAssetReferences,
  reconcileCertificateTemplateAssets,
} from "./template-asset-cleanup";

describe("certificate template asset cleanup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("refuses to restore an asset whose deletion already started", async () => {
    const client = {
      query: vi.fn().mockResolvedValueOnce({
        rows: [{ status: "processing" }],
      }),
    };

    await expect(
      prepareCertificateTemplateAssetReferences({
        client,
        keys: ["templates/old.webp"],
      })
    ).resolves.toBe(false);
    expect(client.query).toHaveBeenCalledOnce();
  });

  it("deletes an unreferenced claimed object and retains its tombstone", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({
        rows: [{ objectKey: "templates/old.webp" }],
      })
      .mockResolvedValueOnce({
        rows: [{ owned: true, referenced: false }],
      })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] });
    dependencies.getPool.mockReturnValue({ query });
    dependencies.deleteR2Objects.mockResolvedValue(undefined);

    await expect(
      reconcileCertificateTemplateAssets({
        ownerToken: "11111111-1111-4111-8111-111111111111",
      })
    ).resolves.toBe(1);

    expect(dependencies.deleteR2Objects).toHaveBeenCalledWith([
      "templates/old.webp",
    ]);
    expect(String(query.mock.calls[2]?.[0])).toContain("status = 'deleted'");
  });

  it("preserves a referenced object and cancels its cleanup", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({
        rows: [{ objectKey: "templates/restored.webp" }],
      })
      .mockResolvedValueOnce({
        rows: [{ owned: true, referenced: true }],
      })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] });
    dependencies.getPool.mockReturnValue({ query });

    await expect(
      reconcileCertificateTemplateAssets({
        ownerToken: "11111111-1111-4111-8111-111111111111",
      })
    ).resolves.toBe(0);

    expect(dependencies.deleteR2Objects).not.toHaveBeenCalled();
    expect(String(query.mock.calls[2]?.[0])).toContain("delete from");
  });

  it("keeps ownership after an R2 failure so stale forms remain blocked", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({
        rows: [{ objectKey: "templates/retry.webp" }],
      })
      .mockResolvedValueOnce({
        rows: [{ owned: true, referenced: false }],
      })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] });
    dependencies.getPool.mockReturnValue({ query });
    dependencies.deleteR2Objects.mockRejectedValue(new Error("unavailable"));

    await expect(
      reconcileCertificateTemplateAssets({
        ownerToken: "11111111-1111-4111-8111-111111111111",
      })
    ).resolves.toBe(0);

    expect(String(query.mock.calls[2]?.[0])).toContain("r2_delete_failed");
    expect(String(query.mock.calls[2]?.[0])).not.toContain(
      "owner_token = null"
    );
  });
});
