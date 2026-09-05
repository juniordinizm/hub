import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("course publication contracts", () => {
  it("takes the shared Course release lock before looking up the publication draft", async () => {
    const source = await readFile(
      new URL("./authoring.ts", import.meta.url),
      "utf8"
    );
    const publishSource = source.slice(
      source.indexOf("const runCoursePublicationTransaction"),
      source.indexOf("export const createCoursePublicationDraft")
    );

    expect(source).toContain("@/features/courses/content-release-lock");
    expect(publishSource).toContain(
      "await lockCourseContentRelease(client, courseId)"
    );
    expect(publishSource.indexOf("lockCourseContentRelease")).toBeLessThan(
      publishSource.indexOf("from course_publications")
    );
  });

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

  it("keeps cover upload, publication and cleanup outside short database transactions", async () => {
    const source = await readFile(
      new URL("./authoring.ts", import.meta.url),
      "utf8"
    );
    const publicationTransaction = source.slice(
      source.indexOf("const runCoursePublicationTransaction"),
      source.indexOf("export const publishCoursePublication")
    );
    const updateTransaction = source.slice(
      source.indexOf("const runCourseUpdateTransaction"),
      source.indexOf("const updateExistingCourse")
    );
    for (const transaction of [publicationTransaction, updateTransaction]) {
      expect(transaction).toContain('client.query("begin")');
      expect(transaction).toContain('client.query("commit")');
      expect(transaction).toContain("client.release()");
      expect(transaction).not.toContain("uploadCourseCoverFile");
      expect(transaction).not.toContain("publishCourseCover(");
      expect(transaction).not.toContain("cleanupPublishedCourseCover");
      expect(transaction).not.toContain("cleanupUploadedCourseCover");
    }

    expect(
      updateTransaction.indexOf("assertMaxReleaseDelayFitsAccessDuration")
    ).toBeLessThan(updateTransaction.indexOf("if (!preparedCover)"));
    const updateSource = source.slice(
      source.indexOf("const updateExistingCourse"),
      source.indexOf("const createNewCourse")
    );
    expect(updateSource).not.toContain("client.query");
    expect(
      updateSource.indexOf("await runCourseUpdateTransaction")
    ).toBeLessThan(updateSource.indexOf("await uploadCourseCoverFile"));
    expect(
      updateSource.lastIndexOf("await runCourseUpdateTransaction")
    ).toBeGreaterThan(
      updateSource.indexOf("await cleanupPublishedCourseCover(nextCoverImage)")
    );
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
    expect(source).toContain("e.starts_at <= now()");
    expect(source).toContain("e.expires_at > now()");
    expect(source).toContain("m.release_delay_days * interval '24 hours'");
    expect(source).not.toContain("interval '1 day'");
    expect(source).toContain("l.is_required");

    const courseLockIndex = source.indexOf(
      "from courses where id = $1 for update"
    );
    const releaseHistoryIndex = source.indexOf("const scheduledReleaseHistory");
    const regressionGuardIndex = source.indexOf(
      "const regressions = findContentReleaseRegressions"
    );
    const expiryGuardIndex = source.indexOf(
      "const incompatibleScheduledEnrollment"
    );
    const retirementIndex = source.indexOf("set status = 'retired'");
    const preparationIndex = source.indexOf("if (!preparedPublication)");
    const publishSource = source.slice(
      source.indexOf("export const publishCoursePublication"),
      source.indexOf("export const createCoursePublicationDraft")
    );
    const coverPublicationIndex = publishSource.indexOf(
      "await publishCourseCover("
    );

    expect(courseLockIndex).toBeGreaterThan(-1);
    expect(releaseHistoryIndex).toBeGreaterThan(courseLockIndex);
    expect(regressionGuardIndex).toBeGreaterThan(-1);
    expect(expiryGuardIndex).toBeGreaterThan(regressionGuardIndex);
    expect(preparationIndex).toBeGreaterThan(expiryGuardIndex);
    expect(retirementIndex).toBeGreaterThan(preparationIndex);
    expect(
      publishSource.indexOf("await runCoursePublicationTransaction")
    ).toBeLessThan(coverPublicationIndex);
    expect(
      publishSource.lastIndexOf("await runCoursePublicationTransaction")
    ).toBeGreaterThan(coverPublicationIndex);
  });
});
