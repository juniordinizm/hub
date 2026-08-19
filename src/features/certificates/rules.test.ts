import { describe, expect, it } from "vitest";
import {
  canIssueCertificate,
  createCertificateCode,
  getCertificateValidationPath,
} from "./rules";

describe("certificate rules", () => {
  it("issues certificates only when every lesson is completed", () => {
    expect(
      canIssueCertificate({ totalLessons: 24, completedLessons: 24 })
    ).toBe(true);
    expect(
      canIssueCertificate({ totalLessons: 24, completedLessons: 23 })
    ).toBe(false);
    expect(canIssueCertificate({ totalLessons: 0, completedLessons: 0 })).toBe(
      false
    );
  });

  it("creates stable validation paths from certificate codes", () => {
    expect(getCertificateValidationPath("PRT-2026-ABC123")).toBe(
      "/certificados/PRT-2026-ABC123"
    );
  });

  it("preserves the full random material in uppercase certificate codes", () => {
    expect(createCertificateCode("abc123def456")).toBe("PRT-ABC123DEF456");
    expect(createCertificateCode("2c5c41a6-29c1-4a42-8474-f1f7021d5137")).toBe(
      "PRT-2C5C41A629C14A428474F1F7021D5137"
    );
  });
});
