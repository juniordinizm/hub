import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  createR2ObjectReadUrl: vi.fn(),
  getPool: vi.fn(),
  renderCertificatePdf: vi.fn(),
  uploadPrivateR2ObjectIfAbsent: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({ getPool: dependencies.getPool }));
vi.mock("@/features/certificates/rendering", () => ({
  renderCertificatePdf: dependencies.renderCertificatePdf,
}));
vi.mock("@/features/storage/r2", () => ({
  createR2ObjectReadUrl: dependencies.createR2ObjectReadUrl,
  uploadPrivateR2ObjectIfAbsent: dependencies.uploadPrivateR2ObjectIfAbsent,
}));
vi.mock("@/lib/env", () => ({
  getServerEnv: () => ({ CERTIFICATE_PUBLIC_BASE_URL: "http://example.test" }),
}));

import {
  getCertificateByCode,
  issueCompletionCertificateIfEligible,
  issueManualCertificate,
  reissueCertificate,
  renderPendingCertificate,
  revokeCertificate,
  tryIssueAutomaticCompletionCertificate,
} from "./server";

const UUID_PATTERN = /^[0-9a-f-]{36}$/;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const CERTIFICATE_CODE_PATTERN = /^PRT-[0-9A-F]{32}$/;

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

const renderSnapshot = {
  certificate: { code: "CERT-123", issuedAt: "2026-07-22T12:00:00.000Z" },
  completion: { completedAt: "2026-07-21T12:00:00.000Z" },
  course: { title: "Curso", workloadHours: 8 },
  issuer: {
    cnpj: "00.000.000/0001-00",
    displayName: "Emissora",
    legalName: "Emissora LTDA",
  },
  student: { name: "Aluna" },
  template: {
    backgroundKey: "templates/background.webp",
    fields: [
      {
        align: "center",
        color: "#111111",
        field: "studentName",
        fontSize: 24,
        height: 10,
        visible: true,
        width: 80,
        x: 10,
        y: 30,
      },
    ],
    id: "2c5c41a6-29c1-4a42-8474-f1f7021d5137",
    signatureKey: "templates/signature.webp",
    signerName: "Responsavel",
    signerRole: "Especialista",
    version: 1,
  },
  version: 1,
} as const;

describe("certificate lifecycle reasons", () => {
  it("uses the persisted completion date and effective course workload in manual snapshots", async () => {
    const completedAt = new Date("2026-06-10T15:30:00.000Z");
    const query = vi.fn((statement: string, _values?: unknown[]) => {
      if (statement.includes("from enrollments")) {
        return { rows: [{ id: "enrollment-1" }] };
      }
      if (
        statement.includes("from certificates") &&
        statement.includes("order by issued_at")
      ) {
        return { rows: [] };
      }
      if (
        statement.includes("from course_publications") &&
        statement.includes("status = 'published'")
      ) {
        return { rows: [{ id: "publication-current" }] };
      }
      if (
        statement.includes("from course_completions") &&
        statement.includes("course_publication_id")
      ) {
        return { rows: [{ course_publication_id: "publication-origin" }] };
      }
      if (
        statement.includes("from users u") &&
        statement.includes("join certificate_templates")
      ) {
        return {
          rows: [
            {
              background_key: "templates/background.webp",
              completed_at: completedAt,
              course_title: "Curso",
              issuer_cnpj: "00.000.000/0001-00",
              issuer_display_name: "Emissora",
              issuer_legal_name: "Emissora LTDA",
              signature_key: null,
              signer_name: null,
              signer_role: null,
              spec: {
                backgroundKey: renderSnapshot.template.backgroundKey,
                fields: renderSnapshot.template.fields,
              },
              student_name: "Aluna",
              template_id: renderSnapshot.template.id,
              template_version: 1,
              workload_hours: 24,
            },
          ],
        };
      }
      if (statement.includes("insert into certificates")) {
        return { rows: [{ id: "certificate-1" }] };
      }
      return { rows: [] };
    });
    dependencies.getPool.mockReturnValue({
      connect: vi.fn().mockResolvedValue({ query, release: vi.fn() }),
    });

    await issueManualCertificate({
      actorUserId: "support-1",
      courseId: "course-1",
      reasonCategory: "duplicate_or_technical_issue",
      reasonDetail: "Emissao solicitada pelo suporte.",
      userId: "student-1",
    });

    const certificateInsert = query.mock.calls.find(([statement]) =>
      statement.includes("insert into certificates")
    );
    const values = certificateInsert?.[1] as unknown[] | undefined;
    const snapshot = JSON.parse(String(values?.[9])) as {
      completion: { completedAt: string };
      course: { workloadHours: number };
    };

    expect(values?.[3]).toMatch(CERTIFICATE_CODE_PATTERN);
    expect(values?.[2]).toBe("publication-origin");
    expect(values?.[6]).toBe(24);
    expect(snapshot.completion.completedAt).toBe(completedAt.toISOString());
    expect(snapshot.course.workloadHours).toBe(24);
  });

  it("retries a manual code collision inside the existing transaction", async () => {
    let insertAttempts = 0;
    const duplicateCodeError = Object.assign(
      new Error("duplicate certificate code"),
      { code: "23505", constraint: "certificates_code_unique" }
    );
    const query = vi.fn((statement: string, _values?: unknown[]) => {
      if (statement === "begin" || statement === "commit") {
        return { rows: [] };
      }
      if (statement.includes("from enrollments")) {
        return { rows: [{ id: "enrollment-1" }] };
      }
      if (
        statement.includes("from certificates") &&
        statement.includes("order by issued_at")
      ) {
        return { rows: [] };
      }
      if (
        statement.includes("from course_publications") &&
        statement.includes("status = 'published'")
      ) {
        return { rows: [{ id: "publication-current" }] };
      }
      if (
        statement.includes("from course_completions") &&
        statement.includes("course_publication_id")
      ) {
        return { rows: [{ course_publication_id: "publication-origin" }] };
      }
      if (
        statement.includes("from users u") &&
        statement.includes("join certificate_templates")
      ) {
        return {
          rows: [
            {
              background_key: "templates/background.webp",
              completed_at: new Date("2026-06-10T15:30:00.000Z"),
              course_title: "Curso",
              issuer_cnpj: "00.000.000/0001-00",
              issuer_display_name: "Emissora",
              issuer_legal_name: "Emissora LTDA",
              signature_key: null,
              signer_name: null,
              signer_role: null,
              spec: {
                backgroundKey: "templates/background.webp",
                fields: renderSnapshot.template.fields,
              },
              student_name: "Aluna",
              template_id: renderSnapshot.template.id,
              template_version: 1,
              workload_hours: 8,
            },
          ],
        };
      }
      if (statement.includes("insert into certificates")) {
        insertAttempts += 1;
        if (insertAttempts === 1) {
          throw duplicateCodeError;
        }
        return { rows: [{ id: "certificate-2" }] };
      }
      if (
        statement.includes("insert into course_completions") ||
        statement.includes("insert into audit_logs") ||
        statement.includes("insert into outbox_messages")
      ) {
        return { rows: [{ id: "completion-1" }] };
      }
      return { rows: [] };
    });
    const release = vi.fn();
    dependencies.getPool.mockReturnValue({
      connect: vi.fn().mockResolvedValue({ query, release }),
    });

    await expect(
      issueManualCertificate({
        actorUserId: "support-1",
        courseId: "course-1",
        reasonCategory: "duplicate_or_technical_issue",
        reasonDetail: "Nova via apos colisao de identificador.",
        userId: "student-1",
      })
    ).resolves.toEqual({ id: "certificate-2" });

    expect(insertAttempts).toBe(2);
    expect(query).toHaveBeenCalledWith(
      "rollback to savepoint certificate_code_attempt_0"
    );
    expect(release).toHaveBeenCalledOnce();
  });

  it("requires reissue when the student already has a revoked certificate", async () => {
    const release = vi.fn();
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: "enrollment-1" }] })
      .mockResolvedValueOnce({
        rows: [{ id: "certificate-1", status: "revoked" }],
      });
    dependencies.getPool.mockReturnValue({
      connect: vi.fn().mockResolvedValue({ query, release }),
    });

    await expect(
      issueManualCertificate({
        actorUserId: "support-1",
        courseId: "course-1",
        reasonCategory: "duplicate_or_technical_issue",
        reasonDetail: "Certificado anterior precisa de nova via.",
        userId: "student-1",
      })
    ).rejects.toThrow("Use a reemissao");

    expect(release).toHaveBeenCalledOnce();
  });

  it("reissues the latest revoked certificate without rewriting its history", async () => {
    const release = vi.fn();
    const replacementId = "certificate-replacement";
    const query = vi.fn((statement: string, _values?: unknown[]) => {
      if (statement === "begin" || statement === "commit") {
        return { rows: [] };
      }
      if (statement.includes("pg_advisory_xact_lock")) {
        return { rows: [] };
      }
      if (
        statement.includes("select id, user_id, course_id") &&
        statement.includes("from certificates")
      ) {
        return {
          rows: [
            {
              course_id: "course-1",
              course_publication_id: "publication-origin",
              id: "certificate-1",
              status: "revoked",
              user_id: "student-1",
            },
          ],
        };
      }
      if (
        statement.includes("order by issued_at desc") &&
        statement.includes("from certificates")
      ) {
        return { rows: [{ id: "certificate-1", status: "revoked" }] };
      }
      if (
        statement.includes("status = 'valid'") &&
        statement.includes("from certificates")
      ) {
        return { rows: [] };
      }
      if (
        statement.includes("from users u") &&
        statement.includes("join certificate_templates")
      ) {
        return {
          rows: [
            {
              background_key: "templates/background.webp",
              completed_at: new Date("2026-06-10T15:30:00.000Z"),
              course_title: "Curso",
              issuer_cnpj: "00.000.000/0001-00",
              issuer_display_name: "Emissora",
              issuer_legal_name: "Emissora LTDA",
              signature_key: null,
              signer_name: null,
              signer_role: null,
              spec: {
                backgroundKey: "templates/background.webp",
                fields: renderSnapshot.template.fields,
              },
              student_name: "Aluna",
              template_id: renderSnapshot.template.id,
              template_version: 1,
              workload_hours: 8,
            },
          ],
        };
      }
      if (statement.includes("insert into certificates")) {
        return { rows: [{ id: replacementId }] };
      }
      if (statement.includes("insert into audit_logs")) {
        return { rows: [] };
      }
      if (statement.includes("insert into outbox_messages")) {
        return { rows: [{ id: "outbox-1" }] };
      }
      return { rows: [] };
    });
    dependencies.getPool.mockReturnValue({
      connect: vi.fn().mockResolvedValue({ query, release }),
    });

    await expect(
      reissueCertificate({
        actorUserId: "support-1",
        certificateId: "certificate-1",
        reasonCategory: "identity_correction",
        reasonDetail: "Nome corrigido após revogação anterior.",
      })
    ).resolves.toEqual({ id: replacementId });

    const insert = query.mock.calls.find(([statement]) =>
      statement.includes("insert into certificates")
    );
    expect(insert?.[1]).toEqual(expect.arrayContaining(["certificate-1"]));
    expect(
      query.mock.calls.some(([statement]) =>
        statement.includes("set status = 'revoked'")
      )
    ).toBe(false);
    expect(release).toHaveBeenCalledOnce();
  });

  it("rejects reissue of an older certificate after a newer history entry exists", async () => {
    const release = vi.fn();
    const query = vi.fn((statement: string, _values?: unknown[]) => {
      if (statement === "begin" || statement === "rollback") {
        return { rows: [] };
      }
      if (statement.includes("select id, user_id, course_id")) {
        return {
          rows: [
            {
              course_id: "course-1",
              course_publication_id: "publication-origin",
              id: "certificate-old",
              status: "revoked",
              user_id: "student-1",
            },
          ],
        };
      }
      if (statement.includes("pg_advisory_xact_lock")) {
        return { rows: [] };
      }
      if (statement.includes("order by issued_at desc")) {
        return { rows: [{ id: "certificate-newer", status: "revoked" }] };
      }
      return { rows: [] };
    });
    dependencies.getPool.mockReturnValue({
      connect: vi.fn().mockResolvedValue({ query, release }),
    });

    await expect(
      reissueCertificate({
        actorUserId: "support-1",
        certificateId: "certificate-old",
        reasonCategory: "identity_correction",
        reasonDetail: "Registro antigo.",
      })
    ).rejects.toThrow("Somente o certificado historico mais recente");

    expect(query).not.toHaveBeenCalledWith(
      expect.stringContaining("insert into certificates"),
      expect.anything()
    );
    expect(release).toHaveBeenCalledOnce();
  });

  it("persists the public category separately from the internal revocation detail", async () => {
    const release = vi.fn();
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: "certificate-1" }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });
    dependencies.getPool.mockReturnValue({
      connect: vi.fn().mockResolvedValue({ query, release }),
    });

    await revokeCertificate({
      actorUserId: "support-1",
      certificateId: "certificate-1",
      reasonCategory: "identity_correction",
      reasonDetail: "Nome da titular corrigido mediante documento.",
    });

    expect(query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("revoked_reason_category = $2"),
      [
        "certificate-1",
        "identity_correction",
        "Nome da titular corrigido mediante documento.",
        "support-1",
      ]
    );
    expect(query).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining("insert into audit_logs"),
      expect.arrayContaining([
        "support-1",
        "certificate.revoked",
        "certificate-1",
      ])
    );
    expect(release).toHaveBeenCalledOnce();
  });

  it("never returns a historical free-text reason from the public lookup", async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [
        {
          code: "PRT-12345678",
          course_title_snapshot: "Curso",
          issued_at: new Date("2026-07-21T00:00:00.000Z"),
          revoked_at: new Date("2026-07-22T00:00:00.000Z"),
          revoked_reason: "Dados pessoais ou alegacao sensivel.",
          revoked_reason_category: "integrity_review",
          status: "revoked",
          student_name_snapshot: "Aluna",
          workload_hours_snapshot: 8,
        },
      ],
    });
    dependencies.getPool.mockReturnValue({ query });

    await expect(getCertificateByCode("PRT-12345678")).resolves.toMatchObject({
      revokedAt: new Date("2026-07-22T00:00:00.000Z"),
      revokedReasonCategory: "integrity_review",
      status: "revoked",
    });
    expect(query).toHaveBeenCalledWith(
      expect.not.stringContaining("revoked_reason\n      from"),
      ["PRT-12345678"]
    );
  });

  it("returns public claims needed to compare the PDF with the verifier", async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [
        {
          code: "PRT-1234567890ABCDEF1234567890ABCDEF",
          completion_at_snapshot: "2026-07-20T12:00:00.000Z",
          course_title_snapshot: "Curso",
          issued_at: new Date("2026-07-21T00:00:00.000Z"),
          issuer_cnpj_snapshot: "00.000.000/0001-00",
          issuer_name_snapshot: "Emissora",
          revoked_at: null,
          revoked_reason_category: null,
          status: "valid",
          student_name_snapshot: "Aluna",
          workload_hours_snapshot: 8,
        },
      ],
    });
    dependencies.getPool.mockReturnValue({ query });

    await expect(
      getCertificateByCode("PRT-1234567890ABCDEF1234567890ABCDEF")
    ).resolves.toMatchObject({
      completionAt: new Date("2026-07-20T12:00:00.000Z"),
      issuerCnpj: "00.000.000/0001-00",
      issuerName: "Emissora",
    });
  });
});

describe("automatic completion certificate retries", () => {
  it("snapshots the effective course workload when issuing automatically", async () => {
    const query = vi.fn((statement: string, _values?: unknown[]) => {
      if (statement.includes("join certificate_templates")) {
        return {
          rows: [
            {
              background_key: renderSnapshot.template.backgroundKey,
              id: renderSnapshot.template.id,
              issuer_cnpj: renderSnapshot.issuer.cnpj,
              issuer_display_name: renderSnapshot.issuer.displayName,
              issuer_legal_name: renderSnapshot.issuer.legalName,
              signature_key: renderSnapshot.template.signatureKey,
              signer_name: renderSnapshot.template.signerName,
              signer_role: renderSnapshot.template.signerRole,
              spec: {
                backgroundKey: renderSnapshot.template.backgroundKey,
                fields: renderSnapshot.template.fields,
              },
              version: renderSnapshot.template.version,
            },
          ],
        };
      }
      if (statement.includes("insert into certificates")) {
        return { rows: [{ code: "PRT-OVERRIDE" }] };
      }
      return { rows: [] };
    });

    await expect(
      tryIssueAutomaticCompletionCertificate({
        client: { query } as never,
        courseId: "course-1",
        coursePublicationId: "publication-1",
        courseTitle: "Curso",
        completedAt: new Date("2026-07-22T12:00:00.000Z"),
        studentName: "Aluna",
        userId: "student-1",
        workloadHours: 8,
      })
    ).resolves.toBe("PRT-OVERRIDE");

    const insert = query.mock.calls.find(([statement]) =>
      statement.includes("insert into certificates")
    );
    const values = insert?.[1] as unknown[] | undefined;
    const snapshot = JSON.parse(String(values?.[8])) as {
      course: { workloadHours: number };
    };

    expect(values?.[6]).toBe(8);
    expect(snapshot.course.workloadHours).toBe(8);
  });

  it("retries a public code collision without aborting the surrounding transaction", async () => {
    let insertAttempts = 0;
    const duplicateCodeError = Object.assign(
      new Error("duplicate certificate code"),
      { code: "23505", constraint: "certificates_code_unique" }
    );
    const query = vi.fn((statement: string) => {
      if (statement.includes("join certificate_templates")) {
        return {
          rows: [
            {
              background_key: "templates/background.webp",
              id: renderSnapshot.template.id,
              issuer_cnpj: renderSnapshot.issuer.cnpj,
              issuer_display_name: renderSnapshot.issuer.displayName,
              issuer_legal_name: renderSnapshot.issuer.legalName,
              signature_key: null,
              signer_name: null,
              signer_role: null,
              spec: {
                backgroundKey: "templates/background.webp",
                fields: renderSnapshot.template.fields,
              },
              version: 1,
            },
          ],
        };
      }
      if (statement.includes("insert into certificates")) {
        insertAttempts += 1;
        if (insertAttempts === 1) {
          throw duplicateCodeError;
        }
        return { rows: [{ code: "PRT-RETRIED" }] };
      }
      return { rows: [] };
    });

    await expect(
      tryIssueAutomaticCompletionCertificate({
        client: { query } as never,
        courseId: "course-1",
        coursePublicationId: "publication-1",
        courseTitle: "Curso",
        completedAt: new Date("2026-07-22T12:00:00.000Z"),
        studentName: "Aluna",
        userId: "student-1",
        workloadHours: 8,
      })
    ).resolves.toBe("PRT-RETRIED");

    expect(insertAttempts).toBe(2);
    expect(query).toHaveBeenCalledWith("savepoint certificate_code_attempt_0");
    expect(query).toHaveBeenCalledWith(
      "rollback to savepoint certificate_code_attempt_0"
    );
  });

  it("returns a typed failure after exhausting public code collision retries", async () => {
    let insertAttempts = 0;
    const duplicateCodeError = Object.assign(
      new Error("duplicate certificate code"),
      { code: "23505", constraint: "certificates_code_unique" }
    );
    const query = vi.fn((statement: string) => {
      if (statement.includes("join certificate_templates")) {
        return {
          rows: [
            {
              background_key: "templates/background.webp",
              id: renderSnapshot.template.id,
              issuer_cnpj: renderSnapshot.issuer.cnpj,
              issuer_display_name: renderSnapshot.issuer.displayName,
              issuer_legal_name: renderSnapshot.issuer.legalName,
              signature_key: null,
              signer_name: null,
              signer_role: null,
              spec: {
                backgroundKey: "templates/background.webp",
                fields: renderSnapshot.template.fields,
              },
              version: 1,
            },
          ],
        };
      }
      if (statement.includes("insert into certificates")) {
        insertAttempts += 1;
        throw duplicateCodeError;
      }
      return { rows: [] };
    });

    await expect(
      tryIssueAutomaticCompletionCertificate({
        client: { query } as never,
        courseId: "course-1",
        coursePublicationId: "publication-1",
        courseTitle: "Curso",
        completedAt: new Date("2026-07-22T12:00:00.000Z"),
        studentName: "Aluna",
        userId: "student-1",
        workloadHours: 8,
      })
    ).rejects.toThrow("codigo publico unico");

    expect(insertAttempts).toBe(3);
    expect(query).toHaveBeenCalledWith(
      "rollback to savepoint certificate_code_attempt_2"
    );
  });

  it("issues from a newly created completion and enqueues rendering", async () => {
    const query = vi.fn((sql: string) => {
      if (sql.includes("insert into course_completions")) {
        return sql.includes("do nothing")
          ? {
              rows: [
                {
                  completed_at: new Date("2026-07-22T12:00:00.000Z"),
                  id: "completion-1",
                },
              ],
            }
          : { rows: [] };
      }
      if (sql.includes("join certificate_templates")) {
        return {
          rows: [
            {
              background_key: "templates/background.webp",
              id: "2c5c41a6-29c1-4a42-8474-f1f7021d5137",
              issuer_cnpj: "00.000.000/0001-00",
              issuer_display_name: "Emissora",
              issuer_legal_name: "Emissora LTDA",
              signature_key: null,
              signer_name: null,
              signer_role: null,
              spec: {
                backgroundKey: "templates/background.webp",
                fields: [
                  {
                    align: "center",
                    color: "#111111",
                    field: "studentName",
                    fontSize: 24,
                    height: 10,
                    visible: true,
                    width: 80,
                    x: 10,
                    y: 30,
                  },
                ],
              },
              version: 1,
            },
          ],
        };
      }
      if (sql.includes("insert into certificates")) {
        return { rows: [{ code: "PRT-RETRY" }] };
      }
      if (sql.includes("from certificates") && sql.includes("where code")) {
        return {
          rows: [{ id: "a75ee2a4-cd57-4c37-878a-20d5fc263ebe" }],
        };
      }
      if (sql.includes("insert into outbox_messages")) {
        return { rows: [{ id: "outbox-1" }] };
      }
      return { rows: [] };
    });

    await expect(
      issueCompletionCertificateIfEligible({
        client: { query } as never,
        courseId: "course-1",
        coursePublicationId: "publication-1",
        summary: {
          certificateId: null,
          completedLessons: 1,
          courseTitle: "Curso",
          studentName: "Aluna",
          totalLessons: 1,
          workloadHours: 8,
        },
        userId: "student-1",
      })
    ).resolves.toBe(true);

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("join certificate_templates"),
      ["course-1"]
    );
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("insert into outbox_messages"),
      [
        "certificate.render",
        "certificate",
        "a75ee2a4-cd57-4c37-878a-20d5fc263ebe",
        "certificate.render/a75ee2a4-cd57-4c37-878a-20d5fc263ebe/v1",
        1,
        JSON.stringify({
          certificateId: "a75ee2a4-cd57-4c37-878a-20d5fc263ebe",
        }),
      ]
    );
  });

  it("stops automatic issuance when another transaction created the completion", async () => {
    const query = vi.fn((sql: string) => {
      if (sql.includes("insert into course_completions")) {
        return sql.includes("do nothing")
          ? { rows: [] }
          : {
              rows: [
                {
                  completed_at: new Date("2026-07-22T12:00:00.000Z"),
                  id: "completion-existing",
                },
              ],
            };
      }
      return { rows: [] };
    });

    await expect(
      issueCompletionCertificateIfEligible({
        client: { query } as never,
        courseId: "course-1",
        coursePublicationId: "publication-1",
        summary: {
          certificateId: null,
          completedLessons: 1,
          courseTitle: "Curso",
          studentName: "Aluna",
          totalLessons: 1,
          workloadHours: 8,
        },
        userId: "student-1",
      })
    ).resolves.toBe(false);

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("on conflict (user_id, course_id) do nothing"),
      ["student-1", "course-1", "publication-1"]
    );
    expect(
      query.mock.calls.some(([sql]) =>
        sql.includes("join certificate_templates")
      )
    ).toBe(false);
    expect(
      query.mock.calls.some(([sql]) =>
        sql.includes("insert into outbox_messages")
      )
    ).toBe(false);
  });
});

describe("certificate rendering assets", () => {
  it("claims a pending render atomically without retaining a database connection", async () => {
    const connect = vi.fn();
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ render_snapshot: renderSnapshot }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] });
    dependencies.getPool.mockReturnValue({ connect, query });
    dependencies.createR2ObjectReadUrl.mockImplementation(
      async ({ key }: { key: string }) => `https://r2.test/${key}`
    );
    dependencies.renderCertificatePdf.mockResolvedValue({
      pdf: Buffer.from("pdf"),
      sha256: "a".repeat(64),
    });
    dependencies.uploadPrivateR2ObjectIfAbsent.mockResolvedValue("created");
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) =>
        url.endsWith("certificate.pdf")
          ? new Response(null, { status: 404 })
          : new Response(Buffer.from("asset"), { status: 200 })
      )
    );

    await expect(renderPendingCertificate("certificate-1")).resolves.toBe(true);

    expect(connect).not.toHaveBeenCalled();
    expect(dependencies.uploadPrivateR2ObjectIfAbsent).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: { sha256: "a".repeat(64) },
      })
    );
    expect(query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("render_claim_token is null"),
      ["certificate-1", expect.stringMatching(UUID_PATTERN), 10]
    );
    expect(query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("render_claim_token = $4"),
      [
        "certificate-1",
        "certificates/certificate-1/certificate.pdf",
        "a".repeat(64),
        expect.stringMatching(UUID_PATTERN),
      ]
    );
  });

  it("does not render while another unexpired claimant owns the certificate", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{ render_status: "pending", status: "valid" }],
      });
    dependencies.getPool.mockReturnValue({ query });

    await expect(renderPendingCertificate("certificate-1")).rejects.toThrow(
      "certificate_render_in_progress"
    );

    expect(dependencies.createR2ObjectReadUrl).not.toHaveBeenCalled();
    expect(dependencies.renderCertificatePdf).not.toHaveBeenCalled();
    expect(dependencies.uploadPrivateR2ObjectIfAbsent).not.toHaveBeenCalled();
  });

  it("returns ready without claiming, rendering, or uploading again", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{ render_status: "ready", status: "valid" }],
      });
    dependencies.getPool.mockReturnValue({ query });

    await expect(renderPendingCertificate("certificate-1")).resolves.toBe(true);

    expect(dependencies.createR2ObjectReadUrl).not.toHaveBeenCalled();
    expect(dependencies.renderCertificatePdf).not.toHaveBeenCalled();
    expect(dependencies.uploadPrivateR2ObjectIfAbsent).not.toHaveBeenCalled();
  });

  it("recovers an uploaded deterministic artifact without rendering or uploading again", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ render_snapshot: renderSnapshot }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] });
    dependencies.getPool.mockReturnValue({ query });
    dependencies.createR2ObjectReadUrl.mockResolvedValue(
      "https://r2.test/certificate.pdf"
    );
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(Buffer.from("existing-pdf")))
    );

    await expect(renderPendingCertificate("certificate-1")).resolves.toBe(true);

    expect(dependencies.renderCertificatePdf).not.toHaveBeenCalled();
    expect(dependencies.uploadPrivateR2ObjectIfAbsent).not.toHaveBeenCalled();
    expect(query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("render_claim_token = $4"),
      [
        "certificate-1",
        "certificates/certificate-1/certificate.pdf",
        expect.stringMatching(SHA256_PATTERN),
        expect.stringMatching(UUID_PATTERN),
      ]
    );
  });

  it("rejects a stored artifact whose bytes do not match the persisted hash", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({
        rows: [
          {
            pdf_sha256: "0".repeat(64),
            render_snapshot: renderSnapshot,
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] });
    dependencies.getPool.mockReturnValue({ query });
    dependencies.createR2ObjectReadUrl.mockResolvedValue(
      "https://r2.test/certificate.pdf"
    );
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(Buffer.from("existing-pdf")))
    );

    await expect(renderPendingCertificate("certificate-1")).rejects.toThrow(
      "certificate_artifact_hash_mismatch"
    );
  });

  it("releases its claim when a snapshotted signature is unavailable", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ render_snapshot: renderSnapshot }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] });
    dependencies.getPool.mockReturnValue({ query });
    dependencies.createR2ObjectReadUrl.mockImplementation(
      async ({ key }: { key: string }) => `https://r2.test/${key}`
    );
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url.endsWith("certificate.pdf")) {
          return new Response(null, { status: 404 });
        }
        if (url.endsWith("signature.webp")) {
          return new Response(null, { status: 503 });
        }
        return new Response(Buffer.from("background"), { status: 200 });
      })
    );

    await expect(renderPendingCertificate("certificate-1")).rejects.toThrow(
      "certificate_signature_unavailable"
    );

    expect(dependencies.renderCertificatePdf).not.toHaveBeenCalled();
    expect(dependencies.uploadPrivateR2ObjectIfAbsent).not.toHaveBeenCalled();
    expect(query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("render_claim_token = $2"),
      ["certificate-1", expect.stringMatching(UUID_PATTERN)]
    );
  });

  it("does not complete a render revoked while external IO was running", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ render_snapshot: renderSnapshot }] })
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
      .mockResolvedValueOnce({
        rows: [{ render_status: "pending", status: "revoked" }],
      })
      .mockResolvedValueOnce({ rowCount: 0, rows: [] });
    dependencies.getPool.mockReturnValue({ query });
    dependencies.createR2ObjectReadUrl.mockImplementation(
      async ({ key }: { key: string }) => `https://r2.test/${key}`
    );
    dependencies.renderCertificatePdf.mockResolvedValue({
      pdf: Buffer.from("pdf"),
      sha256: "b".repeat(64),
    });
    dependencies.uploadPrivateR2ObjectIfAbsent.mockResolvedValue("created");
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) =>
        url.endsWith("certificate.pdf")
          ? new Response(null, { status: 404 })
          : new Response(Buffer.from("asset"), { status: 200 })
      )
    );

    await expect(renderPendingCertificate("certificate-1")).resolves.toBe(
      false
    );

    expect(query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("status = 'valid'"),
      expect.any(Array)
    );
    expect(query).toHaveBeenNthCalledWith(
      4,
      expect.stringContaining("render_claim_token = $2"),
      ["certificate-1", expect.stringMatching(UUID_PATTERN)]
    );
  });

  it("hashes the immutable winner when another worker creates the object first", async () => {
    const winner = Buffer.from("winner-pdf");
    const winnerHash = createHash("sha256").update(winner).digest("hex");
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ render_snapshot: renderSnapshot }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] });
    dependencies.getPool.mockReturnValue({ query });
    dependencies.createR2ObjectReadUrl.mockImplementation(
      async ({ key }: { key: string }) => `https://r2.test/${key}`
    );
    dependencies.renderCertificatePdf.mockResolvedValue({
      pdf: Buffer.from("loser-pdf"),
      sha256: "f".repeat(64),
    });
    dependencies.uploadPrivateR2ObjectIfAbsent.mockResolvedValue("existing");
    let artifactReads = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url.endsWith("certificate.pdf")) {
          artifactReads += 1;
          return artifactReads === 1
            ? new Response(null, { status: 404 })
            : new Response(winner);
        }
        return new Response(Buffer.from("asset"), { status: 200 });
      })
    );

    await expect(renderPendingCertificate("certificate-1")).resolves.toBe(true);

    expect(query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("pdf_sha256 = $3"),
      [
        "certificate-1",
        "certificates/certificate-1/certificate.pdf",
        winnerHash,
        expect.stringMatching(UUID_PATTERN),
      ]
    );
  });
});
