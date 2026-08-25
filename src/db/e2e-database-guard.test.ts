import { describe, expect, it } from "vitest";
import {
  assertSafeE2eDatabaseEnvironment,
  resolveSafeE2eRuntimeDatabaseUrl,
} from "./e2e-database-guard";

const SAFE_E2E_DATABASE_URL =
  "postgresql://e2e_user:e2e_password@ep-e2e-only.sa-east-1.aws.neon.tech/e2e";
const SAFE_POOLED_E2E_DATABASE_URL =
  "postgresql://e2e_user:e2e_password@ep-e2e-only-pooler.sa-east-1.aws.neon.tech/e2e";
const PRODUCTION_DATABASE_URL =
  "postgresql://owner:production-password@ep-hidden-tooth-ac843qc2-pooler.sa-east-1.aws.neon.tech/neondb";

describe("assertSafeE2eDatabaseEnvironment", () => {
  it("rejects the known Production database without exposing credentials", () => {
    expect(() =>
      assertSafeE2eDatabaseEnvironment({
        DATABASE_URL: PRODUCTION_DATABASE_URL,
        E2E_DATABASE_URL: PRODUCTION_DATABASE_URL,
      })
    ).toThrow("E2E database must not target the Production Neon compute.");

    try {
      assertSafeE2eDatabaseEnvironment({
        DATABASE_URL: PRODUCTION_DATABASE_URL,
        E2E_DATABASE_URL: PRODUCTION_DATABASE_URL,
      });
    } catch (error) {
      expect(String(error)).not.toContain("production-password");
      expect(String(error)).not.toContain(PRODUCTION_DATABASE_URL);
    }
  });

  it("rejects a runtime database that differs from the E2E database", () => {
    expect(() =>
      assertSafeE2eDatabaseEnvironment({
        DATABASE_URL:
          "postgresql://e2e_user:e2e_password@ep-other.sa-east-1.aws.neon.tech/e2e",
        E2E_DATABASE_URL: SAFE_E2E_DATABASE_URL,
      })
    ).toThrow("DATABASE_URL must exactly match E2E_DATABASE_URL.");
  });

  it("rejects an invalid or non-PostgreSQL E2E URL", () => {
    for (const invalidUrl of ["not-a-url", "https://example.test/database"]) {
      expect(() =>
        assertSafeE2eDatabaseEnvironment({
          DATABASE_URL: invalidUrl,
          E2E_DATABASE_URL: invalidUrl,
        })
      ).toThrow("E2E_DATABASE_URL must be a valid PostgreSQL URL.");
    }
  });

  it("rejects a pooled endpoint because concurrency tests require sessions", () => {
    const pooledUrl =
      "postgresql://e2e:e2e@ep-e2e-only-pooler.sa-east-1.aws.neon.tech/e2e";

    expect(() =>
      assertSafeE2eDatabaseEnvironment({
        DATABASE_URL: pooledUrl,
        E2E_DATABASE_URL: pooledUrl,
      })
    ).toThrow("E2E database must use a direct PostgreSQL endpoint");
  });

  it("accepts an exact isolated PostgreSQL E2E URL", () => {
    expect(() =>
      assertSafeE2eDatabaseEnvironment({
        DATABASE_URL: SAFE_E2E_DATABASE_URL,
        E2E_DATABASE_URL: SAFE_E2E_DATABASE_URL,
      })
    ).not.toThrow();
  });
});

describe("resolveSafeE2eRuntimeDatabaseUrl", () => {
  it("uses the direct E2E URL when a dedicated runtime URL is absent", () => {
    expect(
      resolveSafeE2eRuntimeDatabaseUrl({
        DATABASE_URL: SAFE_E2E_DATABASE_URL,
        E2E_DATABASE_URL: SAFE_E2E_DATABASE_URL,
      })
    ).toBe(SAFE_E2E_DATABASE_URL);
  });

  it("accepts only the pooled counterpart of the guarded direct URL", () => {
    expect(
      resolveSafeE2eRuntimeDatabaseUrl({
        DATABASE_URL: SAFE_E2E_DATABASE_URL,
        E2E_DATABASE_URL: SAFE_E2E_DATABASE_URL,
        E2E_RUNTIME_DATABASE_URL: SAFE_POOLED_E2E_DATABASE_URL,
      })
    ).toBe(SAFE_POOLED_E2E_DATABASE_URL);
  });

  it("rejects a pooled runtime URL for a different Neon compute", () => {
    expect(() =>
      resolveSafeE2eRuntimeDatabaseUrl({
        DATABASE_URL: SAFE_E2E_DATABASE_URL,
        E2E_DATABASE_URL: SAFE_E2E_DATABASE_URL,
        E2E_RUNTIME_DATABASE_URL:
          "postgresql://e2e_user:e2e_password@ep-other-pooler.sa-east-1.aws.neon.tech/e2e",
      })
    ).toThrow(
      "E2E_RUNTIME_DATABASE_URL must be the pooled counterpart of E2E_DATABASE_URL."
    );
  });

  it("rejects a runtime URL with different credentials or database", () => {
    for (const runtimeUrl of [
      "postgresql://other:e2e_password@ep-e2e-only-pooler.sa-east-1.aws.neon.tech/e2e",
      "postgresql://e2e_user:e2e_password@ep-e2e-only-pooler.sa-east-1.aws.neon.tech/other",
    ]) {
      expect(() =>
        resolveSafeE2eRuntimeDatabaseUrl({
          DATABASE_URL: SAFE_E2E_DATABASE_URL,
          E2E_DATABASE_URL: SAFE_E2E_DATABASE_URL,
          E2E_RUNTIME_DATABASE_URL: runtimeUrl,
        })
      ).toThrow(
        "E2E_RUNTIME_DATABASE_URL must be the pooled counterpart of E2E_DATABASE_URL."
      );
    }
  });
});
