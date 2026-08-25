import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  issueManualCertificate: vi.fn(),
  reconcileHistoricalCourseCertificates: vi.fn(),
  reissueCertificate: vi.fn(),
  revalidatePath: vi.fn(),
  requirePermission: vi.fn(),
  requireRole: vi.fn(),
  revokeCertificate: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth-permissions", () => ({
  requirePermission: dependencies.requirePermission,
}));
vi.mock("@/lib/session", () => ({ requireRole: dependencies.requireRole }));
vi.mock("next/cache", () => ({ revalidatePath: dependencies.revalidatePath }));
vi.mock("./server", () => ({
  issueManualCertificate: dependencies.issueManualCertificate,
  reconcileHistoricalCourseCertificates:
    dependencies.reconcileHistoricalCourseCertificates,
  reissueCertificate: dependencies.reissueCertificate,
  revokeCertificate: dependencies.revokeCertificate,
}));

import {
  issueManualCertificateAction,
  reconcileHistoricalCertificatesAction,
  reissueCertificateAction,
  revokeCertificateAction,
} from "./actions";
import { CertificateDomainError } from "./errors";

describe("certificate server actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dependencies.requirePermission.mockResolvedValue({
      role: "admin",
      user: { id: "admin-1" },
    });
    dependencies.requireRole.mockResolvedValue({ user: { id: "admin-1" } });
  });

  const validIssueFormData = (): FormData => {
    const formData = new FormData();
    formData.set("confirmed", "yes");
    formData.set("courseId", "course-1");
    formData.set("reasonCategory", "eligibility_correction");
    formData.set("reasonDetail", "Ajuste operacional");
    formData.set("userId", "user-1");
    return formData;
  };

  const validChangeFormData = (): FormData => {
    const formData = new FormData();
    formData.set("certificateId", "certificate-1");
    formData.set("confirmed", "yes");
    formData.set("reasonCategory", "identity_correction");
    formData.set("reasonDetail", "Nome corrigido");
    return formData;
  };

  const validReconciliationFormData = (): FormData => {
    const formData = new FormData();
    formData.set("confirmed", "yes");
    formData.set("courseId", "course-1");
    return formData;
  };

  it("returns expected domain failures as typed action state", async () => {
    dependencies.issueManualCertificate.mockRejectedValueOnce(
      new CertificateDomainError(
        "A aluna ja possui um certificado valido para este curso."
      )
    );

    await expect(
      issueManualCertificateAction({ status: "idle" }, validIssueFormData())
    ).resolves.toEqual({
      message: "A aluna ja possui um certificado valido para este curso.",
      status: "error",
    });
  });

  it("does not disguise unexpected failures as operator messages", async () => {
    const failure = new Error("database unavailable");
    dependencies.issueManualCertificate.mockRejectedValueOnce(failure);

    await expect(
      issueManualCertificateAction({ status: "idle" }, validIssueFormData())
    ).rejects.toBe(failure);
  });

  it.each([
    [
      "issue",
      issueManualCertificateAction,
      dependencies.issueManualCertificate,
    ],
    ["revoke", revokeCertificateAction, dependencies.revokeCertificate],
    ["reissue", reissueCertificateAction, dependencies.reissueCertificate],
  ])("rejects %s without confirmation before calling the command", async (_name, action, command) => {
    const formData =
      _name === "issue" ? validIssueFormData() : validChangeFormData();
    formData.delete("confirmed");

    await expect(action({ status: "idle" }, formData)).resolves.toEqual({
      message: "Confirme esta operacao de certificado.",
      status: "error",
    });
    expect(command).not.toHaveBeenCalled();
  });

  it.each([
    [
      "issue",
      issueManualCertificateAction,
      dependencies.issueManualCertificate,
    ],
    ["revoke", revokeCertificateAction, dependencies.revokeCertificate],
    ["reissue", reissueCertificateAction, dependencies.reissueCertificate],
  ])("executes %s with explicit confirmation", async (_name, action, command) => {
    const formData =
      _name === "issue" ? validIssueFormData() : validChangeFormData();

    await expect(action({ status: "idle" }, formData)).resolves.toMatchObject({
      status: "success",
    });
    expect(command).toHaveBeenCalledOnce();
  });

  it("separates certificate reissue from issuance and revocation", async () => {
    await issueManualCertificateAction(
      { status: "idle" },
      validIssueFormData()
    );
    await revokeCertificateAction({ status: "idle" }, validChangeFormData());
    await reissueCertificateAction({ status: "idle" }, validChangeFormData());

    expect(dependencies.requirePermission).toHaveBeenNthCalledWith(
      1,
      "manageCertificates"
    );
    expect(dependencies.requirePermission).toHaveBeenNthCalledWith(
      2,
      "manageCertificates"
    );
    expect(dependencies.requirePermission).toHaveBeenNthCalledWith(
      3,
      "reissueCertificates"
    );
    expect(dependencies.reissueCertificate).toHaveBeenCalledWith(
      expect.objectContaining({ actorRole: "admin" })
    );
  });

  it("requires Admin and returns the typed historical reconciliation result", async () => {
    dependencies.reconcileHistoricalCourseCertificates.mockResolvedValue({
      issued: 100,
      remaining: 8,
    });

    await expect(
      reconcileHistoricalCertificatesAction(validReconciliationFormData())
    ).resolves.toEqual({
      issued: 100,
      message: "100 certificados enviados para geracao. Restam 8.",
      remaining: 8,
      status: "success",
    });

    expect(dependencies.requireRole).toHaveBeenCalledWith(["admin"]);
    expect(
      dependencies.reconcileHistoricalCourseCertificates
    ).toHaveBeenCalledWith({ actorUserId: "admin-1", courseId: "course-1" });
    expect(dependencies.revalidatePath).toHaveBeenCalledWith(
      "/admin/cursos/course-1"
    );
  });
});
