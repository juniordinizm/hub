import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("Playwright environment contract", () => {
  it("allows one diagnostic CI retry and keeps local runs single-attempt", async () => {
    const source = await readFile(
      new URL("../../playwright.config.ts", import.meta.url),
      "utf8"
    );

    expect(source).toContain("retries: process.env.CI ? 1 : 0,");
  });

  it("keeps mutators direct while the web server may use the guarded pooled URL", async () => {
    const source = await readFile(
      new URL("../../playwright.config.ts", import.meta.url),
      "utf8"
    );

    expect(source).toContain("const e2eApplicationEnvironment = {");
    expect(source).toContain(
      "Object.assign(process.env, e2eApplicationEnvironment, {"
    );
    expect(source).toContain("DATABASE_URL: e2eRuntimeDatabaseUrl,");
    expect(source).toContain("DATABASE_URL: e2eDatabaseUrl,");
    expect(source).toContain("...e2eApplicationEnvironment,");

    const databaseGuardIndex = source.indexOf(
      "resolveSafeE2eRuntimeDatabaseUrl({"
    );
    const globalSetupIndex = source.indexOf(
      'globalSetup: "./tests/e2e/global-setup.ts"'
    );

    expect(databaseGuardIndex).toBeGreaterThan(-1);
    expect(globalSetupIndex).toBeGreaterThan(databaseGuardIndex);
  });
});
