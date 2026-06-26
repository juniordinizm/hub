import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("admin student data contract", () => {
  it("does not hide enrollments behind a hard-coded limit", async () => {
    const source = await readFile(
      new URL("./server.ts", import.meta.url),
      "utf8"
    );

    expect(source).not.toContain("limit 60");
  });
});
