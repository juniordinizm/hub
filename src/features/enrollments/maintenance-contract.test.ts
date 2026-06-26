import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("enrollment maintenance contract", () => {
  it("expires paid grants before expiring enrollment projections", async () => {
    const source = await readFile(
      new URL("./maintenance.ts", import.meta.url),
      "utf8"
    );

    expect(source).toContain("update enrollment_grants");
    expect(source).toContain("effective_expires_at < $1");
  });
});
