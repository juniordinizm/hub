import { describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  deleteR2Objects: vi.fn(),
  getPool: vi.fn(),
  readStagedAdminImageFile: vi.fn(),
  verifyStagedAdminImageObject: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({ getPool: dependencies.getPool }));
vi.mock("@/features/storage/r2", () => ({
  deleteR2Objects: dependencies.deleteR2Objects,
  readStagedAdminImageFile: dependencies.readStagedAdminImageFile,
  verifyStagedAdminImageObject: dependencies.verifyStagedAdminImageObject,
}));

import type { StagedAdminImageReference } from "./staged-image-upload";
import {
  claimStagedAdminImageUpload,
  completeStagedAdminImageUpload,
  consumeStagedAdminImageUploads,
  registerStagedAdminImageUpload,
  releaseStagedAdminImageUpload,
} from "./staged-image-upload-registry";

const reference: StagedAdminImageReference = {
  aggregateId: "c989d54d-d13f-46a1-89ed-2069d7c1c45b",
  contentType: "image/png",
  fileName: "capa.png",
  key: "uploads/admin-images/admin-1/course/c989d54d-d13f-46a1-89ed-2069d7c1c45b/course-cover/upload-capa.png",
  purpose: "course-cover",
  sizeBytes: 1024,
};

describe("staged admin image upload registry", () => {
  it("persists the actor, aggregate and immutable upload metadata", async () => {
    const query = vi.fn(async () => ({ rowCount: 1, rows: [] }));

    await registerStagedAdminImageUpload({
      actorUserId: "admin-1",
      queryable: { query },
      reference,
    });

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("insert into staged_admin_image_uploads"),
      expect.arrayContaining([
        reference.key,
        "admin-1",
        "course",
        reference.aggregateId,
        "course-cover",
      ])
    );
  });

  it("allows only one active claim for the expected aggregate", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ owner_token: "8cf8c94e-55d7-4fe5-8246-af79d6fbf977" }],
      })
      .mockResolvedValueOnce({ rowCount: 0, rows: [] });
    const queryable = { query };

    await expect(
      claimStagedAdminImageUpload({
        actorUserId: "admin-1",
        aggregateId: reference.aggregateId,
        purpose: "course-cover",
        queryable,
        reference,
      })
    ).resolves.toBe("8cf8c94e-55d7-4fe5-8246-af79d6fbf977");
    await expect(
      claimStagedAdminImageUpload({
        actorUserId: "admin-1",
        aggregateId: reference.aggregateId,
        purpose: "course-cover",
        queryable,
        reference,
      })
    ).rejects.toThrow("ja foi utilizado");
  });

  it("uses the owner token to complete or release a claim", async () => {
    const query = vi.fn(async () => ({ rowCount: 1, rows: [] }));
    const input = {
      objectKey: reference.key,
      ownerToken: "8cf8c94e-55d7-4fe5-8246-af79d6fbf977",
      queryable: { query },
    };

    await completeStagedAdminImageUpload(input);
    await releaseStagedAdminImageUpload(input);

    const calls = query.mock.calls as unknown as [string, unknown[]][];
    expect(calls[0]?.[0]).toContain("status = 'consumed'");
    expect(calls[1]?.[0]).toContain("status = 'ready'");
    expect(calls[0]?.[1]).toEqual([reference.key, input.ownerToken]);
  });

  it("claims every file before the operation and completes them atomically", async () => {
    const signatureReference: StagedAdminImageReference = {
      ...reference,
      fileName: "assinatura.png",
      key: `uploads/admin-images/admin-1/certificate-template/${reference.aggregateId}/certificate-signature/upload-assinatura.png`,
      purpose: "certificate-signature",
    };
    const poolQuery = vi
      .fn()
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ owner_token: "owner-background" }],
      })
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ owner_token: "owner-signature" }],
      });
    const clientQuery = vi
      .fn()
      .mockResolvedValueOnce({ rowCount: null, rows: [] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] })
      .mockResolvedValueOnce({ rowCount: null, rows: [] });
    const release = vi.fn();
    dependencies.getPool.mockReturnValue({
      connect: async () => ({ query: clientQuery, release }),
      query: poolQuery,
    });
    const background = new File(["background"], "background.png");
    const signature = new File(["signature"], "signature.png");
    dependencies.readStagedAdminImageFile
      .mockResolvedValueOnce(background)
      .mockResolvedValueOnce(signature);
    dependencies.deleteR2Objects.mockResolvedValue(undefined);
    const operation = vi.fn(async () => "saved");

    await expect(
      consumeStagedAdminImageUploads({
        actorUserId: "admin-1",
        aggregateId: reference.aggregateId,
        operation,
        uploads: [
          { purpose: "course-cover", reference },
          {
            purpose: "certificate-signature",
            reference: signatureReference,
          },
        ],
      })
    ).resolves.toBe("saved");

    expect(poolQuery).toHaveBeenCalledTimes(2);
    expect(operation).toHaveBeenCalledWith([background, signature]);
    expect(clientQuery.mock.calls.map(([sql]) => String(sql).trim())).toEqual([
      "begin",
      expect.stringContaining("status = 'consumed'"),
      expect.stringContaining("status = 'consumed'"),
      "commit",
    ]);
    expect(release).toHaveBeenCalledOnce();
    expect(dependencies.deleteR2Objects).toHaveBeenCalledWith([
      reference.key,
      signatureReference.key,
    ]);
  });
});
