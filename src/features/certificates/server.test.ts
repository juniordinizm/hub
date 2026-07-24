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
  renderPendingCertificate,
  revokeCertificate,
} from "./server";

const UUID_PATTERN = /^[0-9a-f-]{36}$/;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;

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
    courseFreeStatement: "Curso livre.",
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
  it("requires reissue when the student already has a revoked certificate", async () => {
    const release = vi.fn();
    const query = vi
      .fn()
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
});

describe("automatic completion certificate retries", () => {
  it("reuses an existing completion, issues from the available template, and enqueues rendering", async () => {
    const query = vi.fn((sql: string) => {
      if (sql.includes("insert into course_completions")) {
        return sql.includes("do update")
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
              issuer_course_free_statement: "Curso livre.",
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
