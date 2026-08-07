import { beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  issueManualCertificate: vi.fn(),
  parseIssueManualCertificateInput: vi.fn(),
  requirePermission: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth-permissions", () => ({
  requirePermission: dependencies.requirePermission,
}));
vi.mock("./command-input", () => ({
  parseChangeCertificateInput: vi.fn(),
  parseIssueManualCertificateInput:
    dependencies.parseIssueManualCertificateInput,
}));
vi.mock("./server", () => ({
  issueManualCertificate: dependencies.issueManualCertificate,
  reissueCertificate: vi.fn(),
  revokeCertificate: vi.fn(),
}));

import { issueManualCertificateAction } from "./actions";
import { CertificateDomainError } from "./errors";

describe("certificate server actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dependencies.requirePermission.mockResolvedValue({
      user: { id: "admin-1" },
    });
    dependencies.parseIssueManualCertificateInput.mockReturnValue({
      courseId: "course-1",
      reasonCategory: "eligibility",
      reasonDetail: "Ajuste operacional",
      userId: "user-1",
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
});
