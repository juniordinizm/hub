import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("lesson editor authorization", () => {
  it("requires content management directly on the page", async () => {
    const source = await readFile(
      new URL("./page.tsx", import.meta.url),
      "utf8"
    );

    expect(source).toContain('requirePermission("manageContent")');
    expect(source).not.toContain('requireRole(["admin", "support"])');
  });
});
