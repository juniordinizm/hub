import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const CURRENT_BUN_EXECUTABLE = /execFileAsync\(\s*process\.execPath/;
const BUN_COMMAND_NAME = /execFileAsync\(\s*"bun"/;

describe("Staging operations", () => {
  it("reuses the current Bun executable when seeding after a reset", () => {
    const script = readFileSync(
      resolve(import.meta.dirname, "../../scripts/reset-staging.ts"),
      "utf8"
    );

    expect(script).toMatch(CURRENT_BUN_EXECUTABLE);
    expect(script).not.toMatch(BUN_COMMAND_NAME);
  });
});
