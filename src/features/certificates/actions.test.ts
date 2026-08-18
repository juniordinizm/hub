import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  issueManualCertificate: vi.fn(),
  parseIssueManualCertificateInput: vi.fn(),
  parseReconcileHistoricalCertificatesInput: vi.fn(),
  reconcileHistoricalCourseCertificates: vi.fn(),
  revalidatePath: vi.fn(),
  requirePermission: vi.fn(),
  requireRole: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth-permissions", () => ({
  requirePermission: dependencies.requirePermission,
}));
vi.mock("@/lib/session", () => ({ requireRole: dependencies.requireRole }));
vi.mock("next/cache", () => ({ revalidatePath: dependencies.revalidatePath }));
vi.mock("./command-input", () => ({
  parseChangeCertificateInput: vi.fn(),
  parseIssueManualCertificateInput:
    dependencies.parseIssueManualCertificateInput,
  parseReconcileHistoricalCertificatesInput:
    dependencies.parseReconcileHistoricalCertificatesInput,
}));
vi.mock("./server", () => ({
  issueManualCertificate: dependencies.issueManualCertificate,
  reconcileHistoricalCourseCertificates:
    dependencies.reconcileHistoricalCourseCertificates,
  reissueCertificate: vi.fn(),
  revokeCertificate: vi.fn(),
}));

import {
  issueManualCertificateAction,
  reconcileHistoricalCertificatesAction,
} from "./actions";
import { CertificateDomainError } from "./errors";

describe("certificate server actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dependencies.requirePermission.mockResolvedValue({
      user: { id: "admin-1" },
    });
    dependencies.requireRole.mockResolvedValue({ user: { id: "admin-1" } });
    dependencies.parseIssueManualCertificateInput.mockReturnValue({
      courseId: "course-1",
      reasonCategory: "eligibility",
      reasonDetail: "Ajuste operacional",
      userId: "user-1",
    });
    dependencies.parseReconcileHistoricalCertificatesInput.mockReturnValue({
      confirmed: "yes",
      courseId: "course-1",
    });
  });

  it("returns expected domain failures as typed action state", async () => {
    dependencies.issueManualCertificate.mockRejectedValueOnce(
      new CertificateDomainError(
        "A aluna ja possui um certificado valido para este curso."
      )
    );

    await expect(
      issueManualCertificateAction({ status: "idle" }, new FormData())
    ).resolves.toEqual({
      message: "A aluna ja possui um certificado valido para este curso.",
      status: "error",
    });
  });

  it("does not disguise unexpected failures as operator messages", async () => {
    const failure = new Error("database unavailable");
    dependencies.issueManualCertificate.mockRejectedValueOnce(failure);

    await expect(
      issueManualCertificateAction({ status: "idle" }, new FormData())
    ).rejects.toBe(failure);
  });

  it("requires Admin and returns the typed historical reconciliation result", async () => {
    dependencies.reconcileHistoricalCourseCertificates.mockResolvedValue({
      issued: 100,
      remaining: 8,
    });

    await expect(
      reconcileHistoricalCertificatesAction(new FormData())
    ).resolves.toEqual({
      issued: 100,
      message: "100 certificados enviados para geracao. Restam 8.",
      remaining: 8,
      status: "success",
    });

    expect(dependencies.requireRole).toHaveBeenCalledWith(["admin"]);
    expect(
      dependencies.parseReconcileHistoricalCertificatesInput
    ).toHaveBeenCalledOnce();
    expect(
      dependencies.reconcileHistoricalCourseCertificates
    ).toHaveBeenCalledWith({ actorUserId: "admin-1", courseId: "course-1" });
    expect(dependencies.revalidatePath).toHaveBeenCalledWith(
      "/admin/cursos/course-1"
    );
  });
});
