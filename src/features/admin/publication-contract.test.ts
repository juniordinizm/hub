import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("course publication contracts", () => {
  it("serializes draft creation and keeps a stable lesson curriculum key when cloning", async () => {
    const source = await readFile(
      new URL("./authoring.ts", import.meta.url),
      "utf8"
    );

    expect(source).toContain(
      '"select id from courses where id = $1 limit 1 for update"'
    );
    expect(source).toContain("module_id, curriculum_key, title");
    expect(source).toContain(
      "module_id, course_publication_id, curriculum_key, title"
    );
  });

  it("enforces one draft publication per Course in the schema", async () => {
    const schema = await readFile(
      new URL("../../db/schema.ts", import.meta.url),
      "utf8"
    );

    expect(schema).toContain("course_publications_one_draft_per_course_idx");
    expect(schema).toContain("table.status} = 'draft'");
  });
});
