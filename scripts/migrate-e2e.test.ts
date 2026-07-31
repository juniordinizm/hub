import { describe, expect, it } from "vitest";
import { createE2eMigrationEnvironment } from "./migrate-e2e";

const E2E_DATABASE_URL =
  "postgresql://e2e:e2e@ep-e2e-only.sa-east-1.aws.neon.tech/e2e";

describe("createE2eMigrationEnvironment", () => {
  it("pins every Drizzle database variable to the guarded E2E database", () => {
    expect(
      createE2eMigrationEnvironment({
        DATABASE_URL: E2E_DATABASE_URL,
        E2E_DATABASE_URL,
      })
    ).toMatchObject({
      DATABASE_URL: E2E_DATABASE_URL,
      DATABASE_URL_DIRECT: E2E_DATABASE_URL,
      E2E_DATABASE_URL,
    });
  });

  it("rejects a preconfigured direct database that differs from E2E", () => {
    expect(() =>
      createE2eMigrationEnvironment({
        DATABASE_URL: E2E_DATABASE_URL,
        DATABASE_URL_DIRECT:
          "postgresql://development:secret@ep-development.neon.tech/development",
        E2E_DATABASE_URL,
      })
    ).toThrow("DATABASE_URL_DIRECT must exactly match E2E_DATABASE_URL.");
  });
});
