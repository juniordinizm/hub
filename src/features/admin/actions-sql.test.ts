import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("admin course actions", () => {
  it("syncs the JMVStream course folder when saving a course", async () => {
    const source = await readFile(
      new URL("./actions.ts", import.meta.url),
      "utf8"
    );

    expect(source).toContain("let savedCourseId = courseId");
    expect(source).toContain("savedCourseId = insertedCourseId");
    expect(source).toContain(
      "await ensureJmvstreamCourseFolder(savedCourseId)"
    );
  });
});
