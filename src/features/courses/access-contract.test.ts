import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("course access contract", () => {
  it("uses the central enrollment access interface for course and lesson gates", async () => {
    const source = await readFile(
      new URL("./server.ts", import.meta.url),
      "utf8"
    );

    expect(source).toContain("resolveCourseAccess");
    expect(source).toContain("resolveLessonAccess");
  });
});
