import { describe, expect, it } from "vitest";
import {
  parseChangeCertificateInput,
  parseIssueManualCertificateInput,
  parseReconcileHistoricalCertificatesInput,
} from "./command-input";

describe("certificate command inputs", () => {
  it("trims valid inputs before an action reaches the service", () => {
    const formData = new FormData();
    formData.set("courseId", " course-1 ");
    formData.set("userId", " student-1 ");
    formData.set("reasonCategory", "identity_correction");
    formData.set("reasonDetail", " Nome corrigido ");

    expect(parseIssueManualCertificateInput(formData)).toEqual({
      courseId: "course-1",
      reasonCategory: "identity_correction",
      reasonDetail: "Nome corrigido",
      userId: "student-1",
    });
  });

  it("rejects an incomplete or unknown certificate command", () => {
    const formData = new FormData();
    formData.set("certificateId", "certificate-1");
    formData.set("reasonCategory", "not-a-reason");
    formData.set("reasonDetail", "");

    expect(() => parseChangeCertificateInput(formData)).toThrow();
  });

  it("requires explicit confirmation before historical reconciliation", () => {
    const formData = new FormData();
    formData.set("courseId", "course-1");

    expect(() => parseReconcileHistoricalCertificatesInput(formData)).toThrow(
      "Confirme a emissao dos certificados pendentes."
    );

    formData.set("confirmed", "yes");

    expect(parseReconcileHistoricalCertificatesInput(formData)).toEqual({
      courseId: "course-1",
      confirmed: "yes",
    });
  });
});
