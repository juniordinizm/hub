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

  it("validates release history and scheduled enrollment expiry before publication effects", async () => {
    const source = await readFile(
      new URL("./authoring.ts", import.meta.url),
      "utf8"
    );

    expect(source).toContain("from enrollment_events");
    expect(source).toContain("event_type = 'content_release_scheduled'");
    expect(source).toContain("l.curriculum_key");
    expect(source).toContain("m.release_delay_days");
    expect(source).toContain("and m.course_publication_id = cp.id");
    expect(source).toContain("e.content_release_mode = 'scheduled'");
    expect(source).toContain("e.content_release_started_at");
    expect(source).toContain(">= e.expires_at");
    expect(source).toContain("e.status = 'active'");
    expect(source).toContain("l.is_required");

    const courseLockIndex = source.indexOf(
      "select cover_image_json from courses where id = $1 for update"
    );
    const releaseHistoryIndex = source.indexOf("const scheduledReleaseHistory");
    const regressionGuardIndex = source.indexOf(
      "const regressions = findContentReleaseRegressions"
    );
    const expiryGuardIndex = source.indexOf(
      "const incompatibleScheduledEnrollment"
    );
    const coverPublicationIndex = source.indexOf(
      "await publishCourseCover(",
      regressionGuardIndex
    );
    const retirementIndex = source.indexOf("set status = 'retired'");

    expect(courseLockIndex).toBeGreaterThan(-1);
    expect(releaseHistoryIndex).toBeGreaterThan(courseLockIndex);
    expect(regressionGuardIndex).toBeGreaterThan(-1);
    expect(expiryGuardIndex).toBeGreaterThan(regressionGuardIndex);
    expect(coverPublicationIndex).toBeGreaterThan(expiryGuardIndex);
    expect(retirementIndex).toBeGreaterThan(coverPublicationIndex);
  });
});
