import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("E2E seed schema contract", () => {
  it("creates fixtures with CoursePublication columns", async () => {
    const source = await readFile(
      new URL("../../scripts/seed-e2e.ts", import.meta.url),
      "utf8"
    );

    expect(source).toContain("insert into course_publications");
    expect(source).toContain("course_publication_id");
    expect(source).not.toContain("course_versions");
    expect(source).not.toContain("course_version_id");
  });
});
