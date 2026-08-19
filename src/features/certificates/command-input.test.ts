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
    formData.set("confirmed", "yes");

    expect(parseIssueManualCertificateInput(formData)).toEqual({
      courseId: "course-1",
      confirmed: "yes",
      reasonCategory: "identity_correction",
      reasonDetail: "Nome corrigido",
      userId: "student-1",
    });
  });

  it("requires explicit confirmation for manual issuance", () => {
    const formData = new FormData();
    formData.set("courseId", "course-1");
    formData.set("userId", "student-1");
    formData.set("reasonCategory", "eligibility_correction");
    formData.set("reasonDetail", "Ajuste operacional");

    expect(() => parseIssueManualCertificateInput(formData)).toThrow(
      "Confirme esta operacao de certificado."
    );
  });

  it("requires explicit confirmation for revocation and reissuance", () => {
    const formData = new FormData();
    formData.set("certificateId", "certificate-1");
    formData.set("reasonCategory", "identity_correction");
    formData.set("reasonDetail", "Nome corrigido");

    expect(() => parseChangeCertificateInput(formData)).toThrow(
      "Confirme esta operacao de certificado."
    );

    formData.set("confirmed", "yes");

    expect(parseChangeCertificateInput(formData)).toEqual({
      certificateId: "certificate-1",
      confirmed: "yes",
      reasonCategory: "identity_correction",
      reasonDetail: "Nome corrigido",
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
