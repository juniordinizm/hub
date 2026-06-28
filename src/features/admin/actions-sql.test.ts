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

  it("does not persist course workload from manual form input", async () => {
    const source = await readFile(
      new URL("./actions.ts", import.meta.url),
      "utf8"
    );

    expect(source).not.toContain('readNumber(formData, "workloadHours"');
    expect(source).not.toContain("workload_hours = $7");
  });

  it("creates courses, modules, and lessons as drafts regardless of form status", async () => {
    const source = await readFile(
      new URL("./actions.ts", import.meta.url),
      "utf8"
    );

    expect(source).toContain('const CREATED_CONTENT_STATUS = "draft"');
    expect(source).toContain("values.status");
    expect(source).toContain("CREATED_CONTENT_STATUS");
    expect(source).not.toContain('status: readString(formData, "status")');
    expect(source).not.toContain('formData.get("isPublished") === "on"');
  });

  it("manages course, module, and lesson archival through status save flows", async () => {
    const source = await readFile(
      new URL("./actions.ts", import.meta.url),
      "utf8"
    );

    expect(source).toContain("status = $7");
    expect(source).toContain("values.status");
    expect(source).toContain("status = $5");
    expect(source).toContain("status = $14");
    expect(source).not.toContain("archiveModuleAction");
    expect(source).not.toContain("archiveLessonAction");
    expect(source).not.toContain("delete from courses");
    expect(source).not.toContain("delete from modules");
    expect(source).not.toContain("delete from lessons");
  });

  it("preserves existing lesson video links when saving other lesson fields", async () => {
    const source = await readFile(
      new URL("./actions.ts", import.meta.url),
      "utf8"
    );

    expect(source).toContain("select video_embed_url, video_external_id");
    expect(source).toContain("resolveLessonVideoFormState");
  });

  it("does not delete JMVStream assets from lesson save without explicit replacement or removal", async () => {
    const source = await readFile(
      new URL("./actions.ts", import.meta.url),
      "utf8"
    );

    expect(source).toContain("shouldDeleteJmvstreamAsset");
    expect(source).toContain(
      "if (shouldDeleteJmvstreamAsset && !shouldKeepJmvstreamAsset)"
    );
    expect(source).not.toContain("if (!shouldKeepJmvstreamAsset)");
  });

  it("exposes an immediate action to remove a lesson JMVStream video", async () => {
    const source = await readFile(
      new URL("./actions.ts", import.meta.url),
      "utf8"
    );

    expect(source).toContain("removeJmvstreamVideoFromLessonAction");
    expect(source).toContain(
      "const deleteResult = await deleteJmvstreamAssetsForLesson(lessonId)"
    );
    expect(source).toContain("video_external_id = null");
    expect(source).toContain("video_embed_url = null");
    expect(source).toContain("deletePending: deleteResult.failed > 0");
  });

  it("keeps failed JMVStream delete assets visible after unlinking a lesson video", async () => {
    const source = await readFile(
      new URL(
        "../../app/(admin)/admin/cursos/[courseId]/aulas/[lessonId]/page.tsx",
        import.meta.url
      ),
      "utf8"
    );

    expect(source).toContain('item.deleteStatus === "failed"');
    expect(source).toContain("item.lessonId === lesson.id");
  });

  it("returns retry delete failures as action state instead of throwing a server error", async () => {
    const source = await readFile(
      new URL("./actions.ts", import.meta.url),
      "utf8"
    );

    expect(source).toContain("retryJmvstreamDeleteAction");
    expect(source).toContain("ok: false");
    expect(source).toContain("Nao foi possivel apagar o video na JMVStream.");
  });

  it("stores module and lesson publication lifecycle status in the schema", async () => {
    const schema = await readFile(
      new URL("../../db/schema.ts", import.meta.url),
      "utf8"
    );

    expect(schema).toContain('status: courseStatusEnum("status")');
    expect(schema).toContain("modules");
    expect(schema).toContain("lessons");
  });
});
