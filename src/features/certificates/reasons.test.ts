import { describe, expect, it } from "vitest";
import {
  CERTIFICATE_REASON_CODES,
  certificateReasonLabel,
  parseCertificateReasonCode,
} from "./reasons";

describe("certificate reason categories", () => {
  it("accepts only the stable operational categories", () => {
    expect(CERTIFICATE_REASON_CODES).toContain("identity_correction");
    expect(parseCertificateReasonCode("legal_or_compliance")).toBe(
      "legal_or_compliance"
    );
    expect(parseCertificateReasonCode("free-text reason")).toBeNull();
  });

  it("uses a public-safe label instead of an internal free-text detail", () => {
    expect(certificateReasonLabel("integrity_review")).toBe(
      "Revisao de integridade"
    );
  });
});
