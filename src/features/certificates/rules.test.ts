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

  it("generates uppercase certificate codes with the PROTEA prefix", () => {
    expect(createCertificateCode("abc123def456")).toBe("PRT-ABC123DE");
  });
});
