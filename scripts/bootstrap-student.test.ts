import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("bootstrap student script", () => {
  it("creates a manual grant and never writes an enrollment directly", async () => {
    const source = await readFile(
      new URL("./bootstrap-student.ts", import.meta.url),
      "utf8"
    );

    expect(source).toContain("createManualAccessGrant");
    expect(source).toContain("seed-student:");
    expect(source).not.toContain("insert into enrollments");
  });
});
