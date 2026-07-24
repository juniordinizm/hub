import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  deleteR2Objects: vi.fn(),
  getPool: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({ getPool: dependencies.getPool }));
vi.mock("@/features/storage/r2", () => ({
  createR2ObjectReadUrl: vi.fn(),
  deleteR2Objects: dependencies.deleteR2Objects,
  uploadPrivateR2Object: vi.fn(),
}));
vi.mock("@/lib/session", () => ({ requireRole: vi.fn() }));

import { CertificateTemplateDomainError } from "./template-errors";
import {
  deleteUnreferencedCertificateTemplateAssets,
  enableCertificateForCourse,
  runCertificateTemplateAssetMutation,
  saveCertificateTemplateDraft,
} from "./templates";

const createCleanupPool = (rows: { key: string }[]) => {
  const query = vi.fn((sql: string) => {
    if (sql.includes("from unnest")) {
      return { rows };
    }
    return { rows: [] };
  });
  const release = vi.fn();
  dependencies.getPool.mockReturnValue({
    connect: vi.fn().mockResolvedValue({ query, release }),
  });
  return { query, release };
};

describe("certificate template asset lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deletes only assets not referenced by a template or certificate snapshot", async () => {
    const { query, release } = createCleanupPool([
      { key: "templates/unreferenced.webp" },
    ]);

    await deleteUnreferencedCertificateTemplateAssets({
      courseId: "course-1",
      keys: [
        "templates/published.webp",
        "templates/pending-signature.webp",
        "templates/unreferenced.webp",
        "templates/unreferenced.webp",
      ],
    });

    expect(query).toHaveBeenNthCalledWith(
      1,
      "select pg_advisory_lock(hashtextextended($1, 0))",
      ["course-1"]
    );
    expect(query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("render_snapshot #>> '{template,backgroundKey}'"),
      [
        [
          "templates/published.webp",
          "templates/pending-signature.webp",
          "templates/unreferenced.webp",
        ],
      ]
    );
    expect(query.mock.calls[1]?.[0]).toContain(
      "render_snapshot #>> '{template,signatureKey}'"
    );
    expect(dependencies.deleteR2Objects).toHaveBeenCalledWith([
      "templates/unreferenced.webp",
    ]);
    expect(query).toHaveBeenLastCalledWith(
      "select pg_advisory_unlock(hashtextextended($1, 0))",
      ["course-1"]
    );
    expect(release).toHaveBeenCalledOnce();
  });

  it("does not call R2 when every candidate remains referenced", async () => {
    createCleanupPool([]);

    await deleteUnreferencedCertificateTemplateAssets({
      courseId: "course-1",
      keys: ["templates/published.webp"],
    });

    expect(dependencies.deleteR2Objects).not.toHaveBeenCalled();
  });

  it("cleans newly uploaded assets when draft persistence fails", async () => {
    const persistenceError = new Error("database unavailable");
    createCleanupPool([
      { key: "templates/new-background.webp" },
      { key: "templates/new-signature.webp" },
    ]);

    await expect(
      runCertificateTemplateAssetMutation({
        courseId: "course-1",
        operation: (trackUploadedKey) => {
          trackUploadedKey("templates/new-background.webp");
          trackUploadedKey("templates/new-signature.webp");
          return Promise.reject(persistenceError);
        },
      })
    ).rejects.toBe(persistenceError);

    expect(dependencies.deleteR2Objects).toHaveBeenCalledWith([
      "templates/new-background.webp",
      "templates/new-signature.webp",
    ]);
  });

  it("preserves an uploaded asset when an ambiguous failure left it referenced", async () => {
    createCleanupPool([]);

    await expect(
      runCertificateTemplateAssetMutation({
        courseId: "course-1",
        operation: (trackUploadedKey) => {
          trackUploadedKey("templates/possibly-persisted.webp");
          return Promise.reject(new Error("connection lost after commit"));
        },
      })
    ).rejects.toThrow("connection lost after commit");

    expect(dependencies.deleteR2Objects).not.toHaveBeenCalled();
  });
});

describe("certificate template draft serialization", () => {
  it("locks the course and returns replaced keys from the same transaction", async () => {
    const query = vi.fn((sql: string) => {
      if (
        sql.includes("from certificate_templates") &&
        sql.includes("for update")
      ) {
        return {
          rows: [
            {
              background_key: "templates/old-background.webp",
              id: "draft-1",
              signature_key: "templates/old-signature.webp",
            },
          ],
        };
      }
      if (sql.includes("update certificate_templates")) {
        return { rowCount: 1, rows: [] };
      }
      return { rows: [] };
    });
    const release = vi.fn();
    dependencies.getPool.mockReturnValue({
      connect: vi.fn().mockResolvedValue({ query, release }),
    });

    await expect(
      saveCertificateTemplateDraft({
        courseId: "course-1",
        signatureKey: "templates/new-signature.webp",
        signerName: null,
        signerRole: null,
        spec: {
          backgroundKey: "templates/new-background.webp",
          fields: [
            "studentName",
            "courseTitle",
            "issuerName",
            "validationCode",
            "qrCode",
          ].map((field, index) => ({
            align: "center" as const,
            color: "#111111",
            field: field as
              | "courseTitle"
              | "issuerName"
              | "qrCode"
              | "studentName"
              | "validationCode",
            fontSize: 10,
            height: 5,
            visible: true,
            width: 10,
            x: 0,
            y: index * 10,
          })),
        },
      })
    ).resolves.toEqual([
      "templates/old-background.webp",
      "templates/old-signature.webp",
    ]);

    expect(query).toHaveBeenNthCalledWith(1, "begin");
    expect(query).toHaveBeenNthCalledWith(
      2,
      "select pg_advisory_xact_lock(hashtextextended($1, 0))",
      ["course-1"]
    );
    expect(query).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining("for update"),
      ["course-1"]
    );
    expect(query).toHaveBeenLastCalledWith("commit");
    expect(release).toHaveBeenCalledOnce();
  });
});

describe("certificate course activation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects activation unless issuer and published template exist", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    dependencies.getPool.mockReturnValue({ query });

    await expect(enableCertificateForCourse("course-1")).rejects.toBeInstanceOf(
      CertificateTemplateDomainError
    );
    expect(query).not.toHaveBeenCalledWith(
      expect.stringContaining("update courses"),
      expect.anything()
    );
  });

  it("activates the course when every publication prerequisite exists", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ id: "template-1" }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] });
    dependencies.getPool.mockReturnValue({ query });

    await enableCertificateForCourse("course-1");

    expect(query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("update courses set certificate_enabled = true"),
      ["course-1"]
    );
  });
});
