import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  getPool: vi.fn(),
  prepareCertificateTemplateAssetReferences: vi.fn(),
  queueCertificateTemplateAssetCleanup: vi.fn(),
  scheduleCertificateTemplateAssetCleanup: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({ getPool: dependencies.getPool }));
vi.mock("@/features/storage/r2", () => ({
  createR2ObjectReadUrl: vi.fn(),
  uploadPrivateR2Object: vi.fn(),
}));
vi.mock("@/lib/session", () => ({ requireRole: vi.fn() }));
vi.mock("./template-asset-cleanup", () => ({
  prepareCertificateTemplateAssetReferences:
    dependencies.prepareCertificateTemplateAssetReferences,
  queueCertificateTemplateAssetCleanup:
    dependencies.queueCertificateTemplateAssetCleanup,
  scheduleCertificateTemplateAssetCleanup:
    dependencies.scheduleCertificateTemplateAssetCleanup,
}));

import { CertificateTemplateDomainError } from "./template-errors";
import {
  disableCertificateForCourse,
  enableCertificateForCourse,
  publishCertificateTemplate,
  runCertificateTemplateAssetMutation,
  saveCertificateTemplateDraft,
} from "./templates";

beforeEach(() => {
  vi.clearAllMocks();
  dependencies.prepareCertificateTemplateAssetReferences.mockResolvedValue(
    true
  );
  dependencies.queueCertificateTemplateAssetCleanup.mockResolvedValue(
    undefined
  );
  dependencies.scheduleCertificateTemplateAssetCleanup.mockResolvedValue(
    undefined
  );
});

describe("certificate template asset lifecycle", () => {
  it("schedules newly uploaded assets when draft persistence fails", async () => {
    const persistenceError = new Error("database unavailable");

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

    expect(
      dependencies.scheduleCertificateTemplateAssetCleanup
    ).toHaveBeenCalledWith({
      courseId: "course-1",
      keys: ["templates/new-background.webp", "templates/new-signature.webp"],
    });
  });

  it("preserves the original error if durable cleanup scheduling also fails", async () => {
    dependencies.scheduleCertificateTemplateAssetCleanup.mockRejectedValueOnce(
      new Error("cleanup unavailable")
    );

    await expect(
      runCertificateTemplateAssetMutation({
        courseId: "course-1",
        operation: (trackUploadedKey) => {
          trackUploadedKey("templates/new.webp");
          return Promise.reject(new Error("connection lost after commit"));
        },
      })
    ).rejects.toThrow("connection lost after commit");
  });
});

describe("certificate template draft serialization", () => {
  it("persists intentional overlaps instead of rejecting the draft", async () => {
    const query = vi.fn((statement: string) => {
      if (statement.includes("from certificate_templates")) {
        return { rows: [] };
      }
      return { rows: [], rowCount: 1 };
    });
    const release = vi.fn();
    dependencies.getPool.mockReturnValue({
      connect: vi.fn().mockResolvedValue({ query, release }),
    });

    await expect(
      saveCertificateTemplateDraft({
        actorUserId: "admin-1",
        courseId: "course-1",
        signatureKey: null,
        signerName: null,
        signerRole: null,
        spec: {
          backgroundKey: "templates/background.webp",
          fields: [
            "studentName",
            "courseTitle",
            "issuerName",
            "validationCode",
            "qrCode",
          ].map((field) => ({
            align: "center" as const,
            color: "#111111",
            field: field as
              | "courseTitle"
              | "issuerName"
              | "qrCode"
              | "studentName"
              | "validationCode",
            fontSize: 10,
            height: 20,
            visible: true,
            width: 40,
            x: 0,
            y: 0,
          })),
        },
      })
    ).resolves.toEqual([]);

    expect(query).toHaveBeenCalledWith("commit");
    expect(release).toHaveBeenCalledOnce();
  });

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
        actorUserId: "admin-1",
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
    expect(
      dependencies.prepareCertificateTemplateAssetReferences
    ).toHaveBeenCalledWith({
      client: expect.objectContaining({ query }),
      keys: ["templates/new-background.webp", "templates/new-signature.webp"],
    });
    expect(
      dependencies.queueCertificateTemplateAssetCleanup
    ).toHaveBeenCalledWith({
      client: expect.objectContaining({ query }),
      courseId: "course-1",
      keys: ["templates/old-background.webp", "templates/old-signature.webp"],
    });
    expect(query).toHaveBeenLastCalledWith("commit");
    expect(release).toHaveBeenCalledOnce();
  });

  it("audits draft changes in the same transaction", async () => {
    const query = vi.fn((statement: string) => {
      if (statement.includes("from certificate_templates")) {
        return { rows: [] };
      }
      return { rows: [], rowCount: 1 };
    });
    const release = vi.fn();
    dependencies.getPool.mockReturnValue({
      connect: vi.fn().mockResolvedValue({ query, release }),
    });

    await saveCertificateTemplateDraft({
      actorUserId: "admin-1",
      courseId: "course-1",
      signatureKey: null,
      signerName: null,
      signerRole: null,
      spec: {
        backgroundKey: "templates/background.webp",
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
    } as Parameters<typeof saveCertificateTemplateDraft>[0]);

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("insert into audit_logs"),
      expect.arrayContaining([
        "admin-1",
        "certificate.template_draft_saved",
        "course-1",
      ])
    );
    const auditIndex = query.mock.calls.findIndex(([statement]) =>
      statement.includes("insert into audit_logs")
    );
    const commitIndex = query.mock.calls.findIndex(
      ([statement]) => statement === "commit"
    );
    expect(auditIndex).toBeGreaterThanOrEqual(0);
    expect(auditIndex).toBeLessThan(commitIndex);
  });
});

describe("certificate course activation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects activation unless issuer and published template exist", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });

    const connect = vi.fn().mockResolvedValue({
      query,
      release: vi.fn(),
    });
    dependencies.getPool.mockReturnValue({ connect });

    await expect(
      enableCertificateForCourse("course-1", "admin-1")
    ).rejects.toBeInstanceOf(CertificateTemplateDomainError);
    expect(query).not.toHaveBeenCalledWith(
      expect.stringContaining("update courses"),
      expect.anything()
    );
  });

  it("activates the course when every publication prerequisite exists", async () => {
    const query = vi.fn((statement: string) => {
      if (statement.includes("from certificate_templates")) {
        return Promise.resolve({ rows: [{ id: "template-1" }] });
      }
      if (statement.includes("update courses")) {
        return Promise.resolve({ rowCount: 1, rows: [] });
      }
      return Promise.resolve({ rows: [] });
    });
    dependencies.getPool.mockReturnValue({
      connect: vi.fn().mockResolvedValue({ query, release: vi.fn() }),
    });

    await enableCertificateForCourse("course-1", "admin-1");

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("update courses set certificate_enabled = true"),
      ["course-1"]
    );
  });

  it("audits disabling a course in the same transaction", async () => {
    const query = vi.fn().mockResolvedValue({ rowCount: 1, rows: [] });
    const release = vi.fn();
    dependencies.getPool.mockReturnValue({
      connect: vi.fn().mockResolvedValue({ query, release }),
    });

    await disableCertificateForCourse("course-1", "admin-1");

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("insert into audit_logs"),
      expect.arrayContaining(["admin-1", "certificate.disabled", "course-1"])
    );
    expect(release).toHaveBeenCalledOnce();
  });

  it("audits publication after enabling the course", async () => {
    const query = vi.fn((statement: string) => {
      if (statement.includes("certificate_issuer_profiles")) {
        return Promise.resolve({ rows: [{ id: "issuer-global" }] });
      }
      if (statement.includes("status = 'draft'")) {
        return Promise.resolve({ rows: [{ id: "template-draft" }] });
      }
      return Promise.resolve({ rows: [], rowCount: 1 });
    });
    const release = vi.fn();
    dependencies.getPool.mockReturnValue({
      connect: vi.fn().mockResolvedValue({ query, release }),
    });

    await publishCertificateTemplate("course-1", "admin-1");

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("insert into audit_logs"),
      expect.arrayContaining([
        "admin-1",
        "certificate.template_published",
        "course-1",
      ])
    );
    expect(release).toHaveBeenCalledOnce();
  });
});
