import { describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({ getPool: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({ getPool: dependencies.getPool }));
vi.mock("@/lib/env", () => ({
  getServerEnv: () => ({ CERTIFICATE_PUBLIC_BASE_URL: "http://example.test" }),
}));

import {
  getCertificateByCode,
  issueManualCertificate,
  revokeCertificate,
} from "./server";

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
