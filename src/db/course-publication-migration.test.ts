import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("course publication migration", () => {
  it("consolidates legacy valid certificates before enforcing one valid certificate per Course", async () => {
    const migration = await readFile(
      new URL(
        "./migrations/0035_course_publications_and_completions.sql",
        import.meta.url
      ),
      "utf8"
    );

    expect(migration).toContain("duplicate_or_technical_issue");
    expect(migration.indexOf("duplicate_or_technical_issue")).toBeLessThan(
      migration.indexOf("certificates_user_course_active_unique_idx")
    );
  });

  it("adds only the new curriculum identity and draft invariant after 0035", async () => {
    const migration = await readFile(
      new URL("./migrations/0036_ambitious_shinobi_shaw.sql", import.meta.url),
      "utf8"
    );

    expect(migration).toContain('ADD COLUMN "curriculum_key"');
    expect(migration).toContain('"lessons_curriculum_key_idx"');
    expect(migration).toContain(
      '"course_publications_one_draft_per_course_idx"'
    );
    expect(migration).not.toContain("DROP TABLE");
    expect(migration).not.toContain("course_versions");
  });
});
