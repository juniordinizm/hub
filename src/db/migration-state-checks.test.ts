import { describe, expect, it } from "vitest";
import { certificateMigrationStateChecks } from "./migration-state-checks";

const MUTATING_STATEMENT_PATTERN =
  /\b(alter|create|delete|drop|insert|truncate|update)\b/i;

describe("migration state checks", () => {
  it("covers the certificate template and render-claim catalog", () => {
    const certificateChecks = certificateMigrationStateChecks;

    expect(certificateChecks).toHaveLength(2);
    expect(certificateChecks[0]?.statement).toContain(
      "certificate_issuer_profiles"
    );
    expect(certificateChecks[0]?.statement).toContain("certificate_templates");
    expect(certificateChecks[0]?.statement).toContain("pdf_storage_key");
    expect(certificateChecks[0]?.statement).toContain("pdf_url");
    expect(certificateChecks[1]?.statement).toContain("render_claim_token");
    expect(certificateChecks[1]?.statement).toContain(
      "certificates_ready_artifact_check"
    );
  });

  it("keeps every migration audit query read-only", () => {
    for (const check of certificateMigrationStateChecks) {
      expect(check.statement).not.toMatch(MUTATING_STATEMENT_PATTERN);
    }
  });
});
