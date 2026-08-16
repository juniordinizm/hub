import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  confirmLessonResourceUpload,
  consumeStagedAdminImageUpload,
  deletePublicR2Objects,
  deleteJmvstreamAssetsForLesson,
  deleteR2Objects,
  ensureJmvstreamCourseFolder,
  query,
  recalculateCourseWorkloadHours,
  resolveJmvstreamPlayerThumbnailUrl,
  uploadCourseCoverFile,
  publishR2Object,
  readStagedAdminImageFile,
  connect,
  release,
} = vi.hoisted(() => ({
  confirmLessonResourceUpload: vi.fn(),
  consumeStagedAdminImageUpload: vi.fn(),
  deletePublicR2Objects: vi.fn(),
  deleteJmvstreamAssetsForLesson: vi.fn(),
  deleteR2Objects: vi.fn(),
  ensureJmvstreamCourseFolder: vi.fn(),
  query: vi.fn(),
  recalculateCourseWorkloadHours: vi.fn(),
  resolveJmvstreamPlayerThumbnailUrl: vi.fn(),
  uploadCourseCoverFile: vi.fn(),
  publishR2Object: vi.fn(),
  readStagedAdminImageFile: vi.fn(),
  connect: vi.fn(),
  release: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({ getPool: () => ({ connect, query }) }));
vi.mock("@/features/courses/server", () => ({
  recalculateCourseWorkloadHours,
}));
vi.mock("@/features/jmvstream/server", () => ({
  deleteJmvstreamAssetsForLesson,
  ensureJmvstreamCourseFolder,
  resolveJmvstreamPlayerThumbnailUrl,
}));
vi.mock("@/features/storage/r2", () => ({
  confirmLessonResourceUpload,
  deletePublicR2Objects,
  deleteR2Objects,
  publishR2Object,
  readStagedAdminImageFile,
  uploadCourseCoverFile,
}));
vi.mock("@/features/storage/staged-image-upload-registry", () => ({
  consumeStagedAdminImageUpload,
}));

import {
  createLessonDraft,
  publishCoursePublication,
  removeLessonVideo,
  saveCourse,
  saveLesson,
  saveModule,
} from "./authoring";

const coverImage = {
  original: {
    contentType: "image/png",
    fileName: "cover.png",
    key: "courses/course-1/cover/original.png",
    sizeBytes: 1,
  },
  variants: {
    card: {
      contentType: "image/webp",
      height: 1000,
      key: "courses/course-1/cover/card.webp",
      sizeBytes: 1,
      width: 960,
    },
    thumb: {
      contentType: "image/webp",
      height: 500,
      key: "courses/course-1/cover/thumb.webp",
      sizeBytes: 1,
      width: 480,
    },
  },
};

const textDocument = {
  content: [
    {
      content: [{ text: "Hello world", type: "text" }],
      type: "paragraph",
    },
  ],
  type: "doc",
};

const versioningQueryResult = (sql: string): { rows: unknown[] } | null => {
  if (
    sql.includes(
      "join course_publications cp on cp.id = m.course_publication_id"
    )
  ) {
    return { rows: [{ status: "draft" }] };
  }
  if (
    sql.includes("join course_publications cp") &&
    sql.includes("cp.status = 'draft'")
  ) {
    return { rows: [{ id: "module-1" }] };
  }
  if (sql.includes("select course_id, course_publication_id from modules")) {
    return {
      rows: [
        {
          course_id: "course-1",
          course_publication_id: "course-publication-draft",
        },
      ],
    };
  }
  if (
    sql.includes("from course_publications") &&
    sql.includes("status = 'draft'")
  ) {
    return { rows: [{ id: "course-publication-draft" }] };
  }
  return null;
};

const setDefaultMocks = (): void => {
  query.mockImplementation(
    (sql: string) => versioningQueryResult(sql) ?? { rows: [] }
  );
  confirmLessonResourceUpload.mockResolvedValue(undefined);
  consumeStagedAdminImageUpload.mockImplementation(
    async ({ operation }: { operation: (file: File) => Promise<unknown> }) =>
      await operation(
        new File([new Uint8Array([1])], "cover.png", { type: "image/png" })
      )
  );
  deletePublicR2Objects.mockResolvedValue(undefined);
  deleteJmvstreamAssetsForLesson.mockResolvedValue({ attempted: 0, failed: 0 });
  deleteR2Objects.mockResolvedValue(undefined);
  ensureJmvstreamCourseFolder.mockResolvedValue(null);
  recalculateCourseWorkloadHours.mockResolvedValue(undefined);
  resolveJmvstreamPlayerThumbnailUrl.mockResolvedValue(null);
  uploadCourseCoverFile.mockResolvedValue(coverImage);
  publishR2Object.mockResolvedValue(undefined);
  readStagedAdminImageFile.mockResolvedValue(
    new File([new Uint8Array([1])], "cover.png", { type: "image/png" })
  );
  connect.mockResolvedValue({ query, release });
};

beforeEach(() => {
  vi.resetAllMocks();
  setDefaultMocks();
});

describe("admin authoring", () => {
  it("publishes the course cover before exposing a publication", async () => {
    query.mockImplementation((sql: string) => {
      if (
        sql.includes("from course_publications") &&
        sql.includes("for update")
      ) {
        return { rows: [{ id: "publication-1" }] };
      }
      if (sql.includes("from lessons") && sql.includes("video_provider")) {
        return { rows: [] };
      }
      if (sql.includes("select cover_image_json from courses")) {
        return { rows: [{ cover_image_json: coverImage }] };
      }

      return { rows: [] };
    });

    await expect(
      publishCoursePublication({ actorUserId: "admin-1", courseId: "course-1" })
    ).resolves.toBe("published");

    expect(publishR2Object).toHaveBeenCalledWith(coverImage.original.key);
    expect(publishR2Object).toHaveBeenCalledWith(coverImage.variants.card.key);
    expect(publishR2Object).toHaveBeenCalledWith(coverImage.variants.thumb.key);
  });

  it("creates a draft course, records it, then syncs its JMVStream folder", async () => {
    query.mockImplementation((sql: string, values?: unknown[]) => {
      if (sql.includes("insert into courses")) {
        return { rows: [{ id: values?.[0] }] };
      }

      return versioningQueryResult(sql) ?? { rows: [] };
    });
    const formData = new FormData();
    formData.set("title", " Curso novo ");
    formData.set("subtitle", " Subtitulo ");
    formData.set("description", " Descricao ");
    formData.set("price", "R$ 129,90");
    formData.set("accessDurationMonths", "6");
    formData.set("status", "active");
    formData.set("workloadHoursOverride", "18");

    const result = await saveCourse({ actorUserId: "admin-1", formData });

    const courseInsert = query.mock.calls.find(([sql]) =>
      String(sql).includes("insert into courses")
    );
    expect(courseInsert?.[0]).not.toContain("payment_provider_product_id");
    expect(courseInsert?.[1]).toEqual([
      result.courseId,
      "curso-novo",
      "Curso novo",
      "Subtitulo",
      "Descricao",
      18,
      18,
      12_990,
      true,
      true,
      3,
      null,
      null,
      6,
      "draft",
    ]);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("insert into audit_logs"),
      ["admin-1", "course.created", "course", result.courseId]
    );
    expect(ensureJmvstreamCourseFolder).toHaveBeenCalledWith(result.courseId);

    const courseInsertIndex = query.mock.calls.findIndex(([sql]) =>
      String(sql).includes("insert into courses")
    );
    const auditIndex = query.mock.calls.findIndex(([sql]) =>
      String(sql).includes("insert into audit_logs")
    );
    const courseInsertOrder = query.mock.invocationCallOrder[courseInsertIndex];
    const auditOrder = query.mock.invocationCallOrder[auditIndex];
    const folderSyncOrder =
      ensureJmvstreamCourseFolder.mock.invocationCallOrder[0];

    if (
      courseInsertOrder === undefined ||
      auditOrder === undefined ||
      folderSyncOrder === undefined
    ) {
      throw new Error("Expected all course authoring operations to run.");
    }

    expect(courseInsertOrder).toBeLessThan(auditOrder);
    expect(auditOrder).toBeLessThan(folderSyncOrder);
  });

  it("removes a newly uploaded course cover when course creation fails", async () => {
    query.mockImplementation((sql: string) => {
      if (sql.includes("insert into courses")) {
        throw new Error("database unavailable");
      }

      return versioningQueryResult(sql) ?? { rows: [] };
    });
    const formData = new FormData();
    formData.set("title", "Curso novo");
    formData.set("price", "100");
    formData.set(
      "coverUpload",
      JSON.stringify({
        aggregateId: "c989d54d-d13f-46a1-89ed-2069d7c1c45b",
        contentType: "image/png",
        fileName: "cover.png",
        key: "uploads/admin-images/admin-1/course/c989d54d-d13f-46a1-89ed-2069d7c1c45b/course-cover/upload.png",
        purpose: "course-cover",
        sizeBytes: 1,
      })
    );

    await expect(
      saveCourse({ actorUserId: "admin-1", formData })
    ).rejects.toThrow("database unavailable");

    expect(deleteR2Objects).toHaveBeenCalledWith([
      coverImage.original.key,
      coverImage.variants.card.key,
      coverImage.variants.thumb.key,
    ]);
    expect(ensureJmvstreamCourseFolder).not.toHaveBeenCalled();
  });

  it("archives an existing course through the save lifecycle", async () => {
    const formData = new FormData();
    formData.set("courseId", "course-1");
    formData.set("title", "Curso existente");
    formData.set("accessDurationMonths", "12");
    formData.set("price", "10,00");
    formData.set("status", "archived");

    await saveCourse({ actorUserId: "admin-1", formData });

    const updateCourseCall = query.mock.calls.find(([sql]) =>
      String(sql).includes("update courses")
    );
    expect(updateCourseCall?.[0]).toContain("price_in_cents = $5");
    expect(updateCourseCall?.[0]).toContain("where id = $13");
    expect(updateCourseCall?.[1]).toEqual([
      "Curso existente",
      null,
      null,
      null,
      1000,
      true,
      true,
      3,
      null,
      null,
      12,
      "archived",
      "course-1",
    ]);
    expect(ensureJmvstreamCourseFolder).toHaveBeenCalledWith("course-1");
  });

  it("updates a module and recalculates both affected courses", async () => {
    query.mockImplementation((sql: string) => {
      if (sql.includes("select course_id from modules")) {
        return { rows: [{ course_id: "course-old" }] };
      }

      return versioningQueryResult(sql) ?? { rows: [] };
    });
    const formData = new FormData();
    formData.set("moduleId", "module-1");
    formData.set("courseId", "course-new");
    formData.set("title", "Modulo atualizado");
    formData.set("description", "Descricao");
    formData.set("sortOrder", "2");
    formData.set("status", "archived");

    await saveModule({ actorUserId: "admin-1", formData });

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("update modules"),
      [
        "course-new",
        "Modulo atualizado",
        "Descricao",
        2,
        "archived",
        "module-1",
      ]
    );
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("insert into audit_logs"),
      ["admin-1", "module.updated", "module", "module-1"]
    );
    expect(recalculateCourseWorkloadHours.mock.calls).toEqual([
      ["course-new"],
      ["course-old"],
    ]);
  });

  it("creates modules as drafts regardless of submitted status", async () => {
    query.mockImplementation((sql: string) => {
      if (sql.includes("insert into modules")) {
        return { rows: [{ id: "module-1" }] };
      }

      return versioningQueryResult(sql) ?? { rows: [] };
    });
    const formData = new FormData();
    formData.set("courseId", "course-1");
    formData.set("title", "Modulo novo");
    formData.set("description", "Descricao");
    formData.set("sortOrder", "1");
    formData.set("status", "active");

    await saveModule({ actorUserId: "admin-1", formData });

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("insert into modules"),
      [
        "course-1",
        "course-publication-draft",
        "Modulo novo",
        "Descricao",
        1,
        "draft",
      ]
    );
    expect(
      query.mock.calls.find(([sql]) =>
        String(sql).includes("insert into modules")
      )?.[0]
    ).toContain("on conflict (course_publication_id, sort_order)");
    expect(recalculateCourseWorkloadHours).toHaveBeenCalledWith("course-1");
  });

  it("creates a minimal lesson draft and returns its editor identifiers", async () => {
    query.mockImplementation((sql: string) => {
      if (sql.includes("select course_id from modules")) {
        return { rows: [{ course_id: "course-1" }] };
      }
      if (sql.includes("insert into lessons")) {
        return { rows: [{ id: "lesson-1" }] };
      }

      return versioningQueryResult(sql) ?? { rows: [] };
    });
    const formData = new FormData();
    formData.set("moduleId", "module-1");
    formData.set("title", " Aula inicial ");
    formData.set("description", " Subtitulo ");
    formData.set("sortOrder", "3");

    const result = await createLessonDraft({
      actorUserId: "admin-1",
      formData,
    });

    expect(result).toEqual({ courseId: "course-1", lessonId: "lesson-1" });
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("insert into lessons"),
      [
        "module-1",
        "course-publication-draft",
        "Aula inicial",
        "Subtitulo",
        3,
        "draft",
      ]
    );
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("insert into audit_logs"),
      ["admin-1", "lesson.created", "lesson", "lesson-1"]
    );
    expect(recalculateCourseWorkloadHours).toHaveBeenCalledWith("course-1");
  });

  it("rejects a lesson draft when the database does not return its identifier", async () => {
    query.mockImplementation((sql: string) => {
      const versioningResult = versioningQueryResult(sql);
      if (versioningResult) {
        return versioningResult;
      }
      if (sql.includes("select course_id from modules")) {
        return { rows: [{ course_id: "course-1" }] };
      }
      if (sql.includes("insert into lessons")) {
        return { rows: [] };
      }

      return versioningQueryResult(sql) ?? { rows: [] };
    });
    const formData = new FormData();
    formData.set("moduleId", "module-1");
    formData.set("title", "Aula inicial");
    formData.set("description", "Subtitulo");
    formData.set("sortOrder", "1");

    await expect(
      createLessonDraft({ actorUserId: "admin-1", formData })
    ).rejects.toThrow("Nao foi possivel criar a aula.");

    expect(recalculateCourseWorkloadHours).not.toHaveBeenCalled();
  });

  it("returns the database identifier after creating a complete lesson", async () => {
    query.mockImplementation((sql: string) => {
      if (sql.includes("select course_id from modules")) {
        return { rows: [{ course_id: "course-1" }] };
      }
      if (sql.includes("insert into lessons")) {
        return { rows: [{ id: "lesson-created" }] };
      }

      return versioningQueryResult(sql) ?? { rows: [] };
    });
    const formData = new FormData();
    formData.set("moduleId", "module-1");
    formData.set("title", "Aula completa");
    formData.set("textDocument", JSON.stringify(textDocument));
    formData.set("sortOrder", "1");

    await expect(
      saveLesson({ actorUserId: "admin-1", formData })
    ).resolves.toEqual({ courseId: "course-1", lessonId: "lesson-created" });
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("insert into audit_logs"),
      ["admin-1", "lesson.created", "lesson", "lesson-created"]
    );
  });

  it("confirms an uploaded lesson resource before persisting its metadata", async () => {
    query.mockImplementation((sql: string) => {
      const versioningResult = versioningQueryResult(sql);
      if (versioningResult) {
        return versioningResult;
      }
      if (sql.includes("select course_id from modules")) {
        return { rows: [{ course_id: "course-1" }] };
      }
      if (sql.includes("select content_json from lessons")) {
        return { rows: [{ content_json: null }] };
      }
      if (sql.includes("from lessons l")) {
        return { rows: [{ course_id: "course-1" }] };
      }

      return { rows: [] };
    });
    const formData = new FormData();
    formData.set("lessonId", "lesson-1");
    formData.set("moduleId", "module-1");
    formData.set("title", "Aula completa");
    formData.set("textDocument", JSON.stringify(textDocument));
    formData.append("resourceStorage[]", "r2");
    formData.append("resourceLabel[]", "Apostila");
    formData.append("resourceUrl[]", "");
    formData.append("resourceKey[]", "lessons/lesson-1/resources/upload.pdf");
    formData.append("resourceFileName[]", "apostila.pdf");
    formData.append("resourceContentType[]", "application/pdf");
    formData.append("resourcePreview[]", "");
    formData.append("resourceSizeBytes[]", "1024");

    await saveLesson({ actorUserId: "admin-1", formData });

    expect(confirmLessonResourceUpload).toHaveBeenCalledWith({
      contentType: "application/pdf",
      key: "lessons/lesson-1/resources/upload.pdf",
      sizeBytes: 1024,
    });
  });

  it("saves lesson content while preserving its existing uploaded video", async () => {
    const previousContent = {
      document: textDocument,
      resources: [
        {
          contentType: "application/pdf",
          fileName: "old.pdf",
          id: "resource-0",
          key: "lessons/lesson-1/resources/old.pdf",
          label: "Old",
          sizeBytes: 100,
          storage: "r2",
        },
      ],
      type: "text",
    };
    query.mockImplementation((sql: string) => {
      const versioningResult = versioningQueryResult(sql);
      if (versioningResult) {
        return versioningResult;
      }
      if (sql.includes("select video_embed_url")) {
        return {
          rows: [
            {
              thumbnail_url: "https://cdn.example/thumb.jpg",
              video_embed_url: "https://player.jmvstream.com/uploaded",
              video_external_id: "asset-hash",
            },
          ],
        };
      }
      if (sql.includes("select course_id from modules")) {
        return { rows: [{ course_id: "course-1" }] };
      }
      if (sql.includes("select content_json from lessons")) {
        return { rows: [{ content_json: previousContent }] };
      }
      if (sql.includes("select m.course_id")) {
        return { rows: [{ course_id: "course-1" }] };
      }

      return { rows: [] };
    });
    const formData = new FormData();
    formData.set("lessonId", "lesson-1");
    formData.set("moduleId", "module-1");
    formData.set("title", "Aula atualizada");
    formData.set("description", "Descricao");
    formData.set("textDocument", JSON.stringify(textDocument));
    formData.set("sortOrder", "2");
    formData.set("status", "archived");
    formData.set("isRequired", "false");

    const result = await saveLesson({ actorUserId: "admin-1", formData });

    expect(result).toEqual({ courseId: "course-1", lessonId: "lesson-1" });
    const updateCall = query.mock.calls.find(([sql]) =>
      String(sql).includes("update lessons")
    );
    expect(updateCall?.[1]).toEqual([
      "module-1",
      "course-publication-draft",
      "Aula atualizada",
      "Descricao",
      "jmvstream",
      "asset-hash",
      "https://player.jmvstream.com/uploaded",
      "https://cdn.example/thumb.jpg",
      JSON.stringify({ type: "text", document: textDocument }),
      1,
      0,
      1,
      2,
      2,
      "archived",
      false,
      false,
      "lesson-1",
    ]);
    expect(deleteJmvstreamAssetsForLesson).not.toHaveBeenCalled();
    expect(deleteR2Objects).toHaveBeenCalledWith([
      "lessons/lesson-1/resources/old.pdf",
    ]);
    expect(recalculateCourseWorkloadHours).toHaveBeenCalledWith("course-1");
  });

  it("does not delete an R2 resource still referenced by a published course version", async () => {
    const previousContent = {
      document: textDocument,
      resources: [
        {
          contentType: "application/pdf",
          fileName: "shared.pdf",
          id: "resource-0",
          key: "lessons/lesson-1/resources/shared.pdf",
          label: "Shared",
          sizeBytes: 100,
          storage: "r2",
        },
      ],
      type: "text",
    };
    query.mockImplementation((sql: string) => {
      const versioningResult = versioningQueryResult(sql);
      if (versioningResult) {
        return versioningResult;
      }
      if (sql.includes("select video_embed_url")) {
        return { rows: [] };
      }
      if (sql.includes("select course_id from modules")) {
        return { rows: [{ course_id: "course-1" }] };
      }
      if (sql.includes("select content_json from lessons")) {
        return { rows: [{ content_json: previousContent }] };
      }
      if (sql.includes("published_publication.status = 'published'")) {
        return { rows: [{ content_json: previousContent }] };
      }
      if (sql.includes("select m.course_id")) {
        return { rows: [{ course_id: "course-1" }] };
      }

      return { rows: [] };
    });
    const formData = new FormData();
    formData.set("lessonId", "lesson-1");
    formData.set("moduleId", "module-1");
    formData.set("title", "Aula atualizada");
    formData.set("textDocument", JSON.stringify(textDocument));

    await saveLesson({ actorUserId: "admin-1", formData });

    expect(deleteR2Objects).toHaveBeenCalledWith([]);
  });

  it("requires a documented compatible-correction reason before changing a published lesson", async () => {
    query.mockImplementation((sql: string) => {
      if (
        sql.includes(
          "join course_publications cp on cp.id = m.course_publication_id"
        )
      ) {
        return { rows: [{ status: "published" }] };
      }
      if (
        sql.includes("select course_id, course_publication_id from modules")
      ) {
        return {
          rows: [
            {
              course_id: "course-1",
              course_publication_id: "course-publication-1",
            },
          ],
        };
      }
      if (sql.includes("select video_embed_url")) {
        return { rows: [] };
      }

      return { rows: [] };
    });
    const formData = new FormData();
    formData.set("lessonId", "lesson-1");
    formData.set("moduleId", "module-1");
    formData.set("title", "Correção de ortografia");
    formData.set("textDocument", JSON.stringify(textDocument));
    formData.set("compatibleCorrection", "on");

    await expect(
      saveLesson({ actorUserId: "admin-1", formData })
    ).rejects.toThrow("Prepare alteracoes");
  });

  it("rejects a compatible correction that changes published lesson structure", async () => {
    query.mockImplementation((sql: string) => {
      if (
        sql.includes(
          "join course_publications cp on cp.id = m.course_publication_id"
        )
      ) {
        return { rows: [{ status: "published" }] };
      }
      if (sql.includes("select module_id, sort_order, status, is_required")) {
        return {
          rows: [
            {
              is_required: true,
              module_id: "module-1",
              sort_order: 2,
              status: "active",
            },
          ],
        };
      }
      if (sql.includes("select video_embed_url")) {
        return { rows: [] };
      }

      return { rows: [] };
    });
    const formData = new FormData();
    formData.set("lessonId", "lesson-1");
    formData.set("moduleId", "module-1");
    formData.set("title", "Correção de ortografia");
    formData.set("textDocument", JSON.stringify(textDocument));
    formData.set("status", "active");
    formData.set("sortOrder", "1");
    formData.set("isRequired", "on");
    formData.set("compatibleCorrection", "on");
    formData.set("compatibleCorrectionReason", "Correção de ortografia.");

    await expect(
      saveLesson({ actorUserId: "admin-1", formData })
    ).rejects.toThrow("Prepare alteracoes");
  });

  it("audits a compatible correction without changing published lesson structure", async () => {
    query.mockImplementation((sql: string) => {
      if (
        sql.includes(
          "join course_publications cp on cp.id = m.course_publication_id"
        )
      ) {
        return { rows: [{ status: "published" }] };
      }
      if (sql.includes("select module_id, sort_order, status, is_required")) {
        return {
          rows: [
            {
              is_required: true,
              module_id: "module-1",
              sort_order: 2,
              status: "active",
            },
          ],
        };
      }
      if (
        sql.includes("select course_id, course_publication_id from modules")
      ) {
        return {
          rows: [
            {
              course_id: "course-1",
              course_publication_id: "course-publication-1",
            },
          ],
        };
      }
      if (sql.includes("select video_embed_url")) {
        return { rows: [] };
      }
      if (sql.includes("select content_json from lessons")) {
        return { rows: [{ content_json: null }] };
      }
      if (sql.includes("select m.course_id")) {
        return { rows: [{ course_id: "course-1" }] };
      }

      return { rows: [] };
    });
    const formData = new FormData();
    formData.set("lessonId", "lesson-1");
    formData.set("moduleId", "module-1");
    formData.set("title", "Correção de ortografia");
    formData.set("textDocument", JSON.stringify(textDocument));
    formData.set("status", "active");
    formData.set("sortOrder", "2");
    formData.set("isRequired", "on");
    formData.set("compatibleCorrection", "on");
    formData.set("compatibleCorrectionReason", "Correção de ortografia.");

    await expect(
      saveLesson({ actorUserId: "admin-1", formData })
    ).rejects.toThrow("Prepare alteracoes");
  });

  it("removes lesson video state after attempting remote asset deletion", async () => {
    query.mockImplementation((sql: string) => {
      if (
        sql.includes(
          "join course_publications cp on cp.id = l.course_publication_id"
        )
      ) {
        return { rows: [{ id: "lesson-1" }] };
      }
      if (sql.includes("select m.course_id")) {
        return { rows: [{ course_id: "course-1" }] };
      }

      return { rows: [] };
    });
    deleteJmvstreamAssetsForLesson.mockResolvedValue({
      attempted: 1,
      failed: 1,
    });

    const result = await removeLessonVideo({
      actorUserId: "admin-1",
      lessonId: " lesson-1 ",
    });

    expect(deleteJmvstreamAssetsForLesson).toHaveBeenCalledWith("lesson-1");
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("update lessons"),
      ["lesson-1"]
    );
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("insert into audit_logs"),
      ["admin-1", "lesson.video_removed", "lesson", "lesson-1"]
    );
    expect(recalculateCourseWorkloadHours).toHaveBeenCalledWith("course-1");
    expect(result).toEqual({ courseId: "course-1", deletePending: true });
  });

  it("refuses to remove a video from a published publication", async () => {
    query.mockImplementation((sql: string) => {
      if (
        sql.includes(
          "join course_publications cp on cp.id = l.course_publication_id"
        )
      ) {
        return { rows: [] };
      }
      if (sql.includes("select m.course_id")) {
        return { rows: [{ course_id: "course-1" }] };
      }
      return { rows: [] };
    });

    await expect(
      removeLessonVideo({ actorUserId: "admin-1", lessonId: "lesson-1" })
    ).rejects.toThrow("Prepare alteracoes");

    expect(deleteJmvstreamAssetsForLesson).not.toHaveBeenCalled();
  });
});
