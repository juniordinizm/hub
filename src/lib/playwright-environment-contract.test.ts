import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("Playwright environment contract", () => {
  it("shares the canonical loopback origins with global setup and the web server", async () => {
    const source = await readFile(
      new URL("../../playwright.config.ts", import.meta.url),
      "utf8"
    );

    expect(source).toContain("const e2eApplicationEnvironment = {");
    expect(source).toContain(
      "Object.assign(process.env, e2eApplicationEnvironment)"
    );
    expect(source).toContain("...e2eApplicationEnvironment,");

    const databaseGuardIndex = source.indexOf(
      "assertSafeE2eDatabaseEnvironment({"
    );
    const globalSetupIndex = source.indexOf(
      'globalSetup: "./tests/e2e/global-setup.ts"'
    );

    expect(databaseGuardIndex).toBeGreaterThan(-1);
    expect(globalSetupIndex).toBeGreaterThan(databaseGuardIndex);
  });
});
