import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("dependency security contract", () => {
  it("pins Browserslist beyond the current high-severity advisories", async () => {
    const packageJson = JSON.parse(await readFile("package.json", "utf8")) as {
      overrides?: Record<string, string>;
    };

    expect(packageJson.overrides?.browserslist).toBe("4.28.8");
  });
});
