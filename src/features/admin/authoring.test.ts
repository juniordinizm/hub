import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  confirmLessonResourceUpload,
  consumeLessonResourceUpload,
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
  getLessonResourceUpload,
  logLessonResourceUploadEvent,
  connect,
  release,
} = vi.hoisted(() => ({
  confirmLessonResourceUpload: vi.fn(),
  consumeLessonResourceUpload: vi.fn(),
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
  getLessonResourceUpload: vi.fn(),
  logLessonResourceUploadEvent: vi.fn(),
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
vi.mock("@/features/storage/lesson-resource-upload-registry", () => ({
  consumeLessonResourceUpload,
  getLessonResourceUpload,
}));
vi.mock("@/features/storage/lesson-resource-upload-observability", () => ({
  logLessonResourceUploadEvent,
}));

import {
  createCoursePublicationDraft,
  createLessonDraft,
  publishCoursePublication,
  removeLessonVideo,
  saveCourse,
  saveLesson,
  saveModule,
} from "./authoring";

const COURSE_ACTIVATION_UPDATE_PATTERN =
  /update courses\s+set status = 'active'/i;
const SENSITIVE_IDENTITY_PATTERN = /student|user|email/i;

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
  consumeLessonResourceUpload.mockResolvedValue(undefined);
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
  getLessonResourceUpload.mockResolvedValue(null);
  connect.mockResolvedValue({ query, release });
};

beforeEach(() => {
  vi.resetAllMocks();
  setDefaultMocks();
});

describe("admin authoring", () => {
  it("revalidates release history after copying the cover without holding a database connection", async () => {
    let hasScheduledReleaseHistory = false;
    let transactionOpen = false;
    let connectionHeld = false;
    const providerStates: Array<{
      connectionHeld: boolean;
      transactionOpen: boolean;
    }> = [];
    connect.mockImplementation(() => {
      connectionHeld = true;
      return { query, release };
    });
    release.mockImplementation(() => {
      connectionHeld = false;
    });
    query.mockImplementation((sql: string) => {
      if (sql === "begin") {
        transactionOpen = true;
      }
      if (sql === "commit" || sql === "rollback") {
        transactionOpen = false;
      }
      if (sql.includes("select cover_image_json")) {
        return { rows: [{ cover_image_json: coverImage }] };
      }
      if (sql.includes("has_scheduled_release_history")) {
        return {
          rows: [{ has_scheduled_release_history: hasScheduledReleaseHistory }],
        };
      }
      if (sql.includes("as publication_status")) {
        return {
          rows: [
            {
              curriculum_key: "curriculum-1",
              lesson_title: "Introdução",
              module_title: "Comece aqui",
              publication_status: "published",
              release_delay_days: 0,
            },
            {
              curriculum_key: "curriculum-1",
              lesson_title: "Introdução",
              module_title: "Conteúdo futuro",
              publication_status: "draft",
              release_delay_days: 8,
            },
          ],
        };
      }
      return versioningQueryResult(sql) ?? { rows: [] };
    });
    publishR2Object.mockImplementation(() => {
      providerStates.push({ connectionHeld, transactionOpen });
      hasScheduledReleaseHistory = true;
    });

    await expect(
      publishCoursePublication({ actorUserId: "admin-1", courseId: "course-1" })
    ).rejects.toThrow('A Aula "Introdução" passaria de D+0 para D+8');

    expect(providerStates).toEqual([
      { connectionHeld: false, transactionOpen: false },
      { connectionHeld: false, transactionOpen: false },
      { connectionHeld: false, transactionOpen: false },
    ]);
    expect(query).toHaveBeenCalledWith("commit");
    expect(query).toHaveBeenCalledWith("rollback");
    expect(
      query.mock.calls.some(([sql]) =>
        String(sql).includes("set status = 'retired'")
      )
    ).toBe(false);
    expect(
      query.mock.calls.some(([sql]) =>
        String(sql).includes("set status = 'published'")
      )
    ).toBe(false);
  });

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
      if (sql.includes("select cover_image_json")) {
        return { rows: [{ cover_image_json: coverImage }] };
      }
      if (sql.includes("has_scheduled_release_history")) {
        return { rows: [{ has_scheduled_release_history: false }] };
      }
      if (sql.includes("as publication_status")) {
        return { rows: [] };
      }
      if (sql.includes("content_release_mode = 'scheduled'")) {
        return { rows: [] };
      }

      return { rows: [] };
    });

    await expect(
      publishCoursePublication({ actorUserId: "admin-1", courseId: "course-1" })
    ).resolves.toBe("published");

    expect(publishR2Object).toHaveBeenCalledWith(coverImage.original.key);
    expect(publishR2Object).toHaveBeenCalledWith(coverImage.variants.card.key);
    expect(publishR2Object).toHaveBeenCalledWith(coverImage.variants.thumb.key);
    expect(
      query.mock.calls.some(([sql]) =>
        COURSE_ACTIVATION_UPDATE_PATTERN.test(String(sql))
      )
    ).toBe(false);
  });

  it("rejects a published schedule that cannot fit an open Course access window", async () => {
    query.mockImplementation((sql: string) => {
      if (
        sql.includes("from course_publications") &&
        sql.includes("for update")
      ) {
        return { rows: [{ id: "publication-draft" }] };
      }
      if (sql.includes("from lessons") && sql.includes("video_provider")) {
        return { rows: [] };
      }
      if (sql.includes("select cover_image_json")) {
        return {
          rows: [
            {
              access_duration_months: 1,
              cover_image_json: coverImage,
              sales_status: "open",
            },
          ],
        };
      }
      if (sql.includes("has_scheduled_release_history")) {
        return { rows: [{ has_scheduled_release_history: false }] };
      }
      if (sql.includes("as publication_status")) {
        return {
          rows: [
            {
              curriculum_key: "curriculum-future",
              lesson_title: "Aula futura",
              module_title: "Módulo futuro",
              publication_status: "draft",
              release_delay_days: 28,
            },
          ],
        };
      }
      return { rows: [] };
    });

    await expect(
      publishCoursePublication({ actorUserId: "admin-1", courseId: "course-1" })
    ).rejects.toThrow(
      "O cronograma de conteúdo não cabe na duração comercial do Curso."
    );
    expect(publishR2Object).not.toHaveBeenCalled();
    expect(query).toHaveBeenCalledWith("rollback");
  });

  it("rolls back a publication before cover or status effects when an existing lesson becomes more restrictive", async () => {
    query.mockImplementation((sql: string) => {
      if (
        sql.includes("from course_publications") &&
        sql.includes("for update")
      ) {
        return { rows: [{ id: "publication-draft" }] };
      }
      if (sql.includes("from lessons") && sql.includes("video_provider")) {
        return { rows: [] };
      }
      if (sql.includes("select cover_image_json")) {
        return { rows: [{ cover_image_json: coverImage }] };
      }
      if (sql.includes("has_scheduled_release_history")) {
        return { rows: [{ has_scheduled_release_history: true }] };
      }
      if (sql.includes("as publication_status")) {
        return {
          rows: [
            {
              curriculum_key: "curriculum-1",
              lesson_title: "Introdução",
              module_title: "Comece aqui",
              publication_status: "published",
              release_delay_days: 0,
            },
            {
              curriculum_key: "curriculum-1",
              lesson_title: "Introdução",
              module_title: "Conteúdo futuro",
              publication_status: "draft",
              release_delay_days: 8,
            },
          ],
        };
      }
      return { rows: [] };
    });

    await expect(
      publishCoursePublication({ actorUserId: "admin-1", courseId: "course-1" })
    ).rejects.toThrow(
      'A Aula "Introdução" passaria de D+0 para D+8 no Módulo "Conteúdo futuro"'
    );

    expect(publishR2Object).not.toHaveBeenCalled();
    expect(query).toHaveBeenCalledWith("rollback");
    expect(
      query.mock.calls.some(([sql]) =>
        String(sql).includes("set status = 'retired'")
      )
    ).toBe(false);
    expect(
      query.mock.calls.some(([sql]) =>
        String(sql).includes("set status = 'published'")
      )
    ).toBe(false);
  });

  it("rejects a required lesson unavailable for an entire scheduled enrollment without exposing student data", async () => {
    query.mockImplementation((sql: string) => {
      if (
        sql.includes("from course_publications") &&
        sql.includes("for update")
      ) {
        return { rows: [{ id: "publication-draft" }] };
      }
      if (sql.includes("from lessons") && sql.includes("video_provider")) {
        return { rows: [] };
      }
      if (sql.includes("select cover_image_json")) {
        return { rows: [{ cover_image_json: coverImage }] };
      }
      if (sql.includes("has_scheduled_release_history")) {
        return { rows: [{ has_scheduled_release_history: false }] };
      }
      if (sql.includes("as publication_status")) {
        return { rows: [] };
      }
      if (sql.includes("content_release_mode = 'scheduled'")) {
        return {
          rows: [
            {
              lesson_title: "Encerramento",
              module_title: "Conclusão",
              release_delay_days: 30,
            },
          ],
        };
      }
      return { rows: [] };
    });

    const publication = publishCoursePublication({
      actorUserId: "admin-1",
      courseId: "course-1",
    });

    await expect(publication).rejects.toThrow(
      'A Aula "Encerramento" do Módulo "Conclusão" ficaria indisponível durante toda a validade de uma Matrícula agendada.'
    );
    await expect(publication).rejects.not.toThrow(SENSITIVE_IDENTITY_PATTERN);
    expect(publishR2Object).not.toHaveBeenCalled();
    expect(query).toHaveBeenCalledWith("rollback");
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

  it("does not change Course availability through the generic save lifecycle", async () => {
    query.mockImplementation((sql: string) => {
      if (sql.includes("as should_publish")) {
        return {
          rows: [
            {
              access_duration_months: 12,
              max_release_delay_days: 0,
              sales_status: "closed",
              should_publish: false,
            },
          ],
        };
      }
      return versioningQueryResult(sql) ?? { rows: [] };
    });
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
    expect(updateCourseCall?.[0]).not.toContain("status =");
    expect(updateCourseCall?.[0]).toContain("where id = $12");
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
      "course-1",
    ]);
    expect(ensureJmvstreamCourseFolder).toHaveBeenCalledWith("course-1");
  });

  it("rechecks a duration reduction after R2 and cleans a rejected upload outside database transactions", async () => {
    let currentMaxDelay = 0;
    let transactionOpen = false;
    let connectionHeld = false;
    const providerStates: Array<{
      connectionHeld: boolean;
      transactionOpen: boolean;
    }> = [];
    const recordProviderState = (): void => {
      providerStates.push({ connectionHeld, transactionOpen });
    };
    connect.mockImplementation(() => {
      connectionHeld = true;
      return { query, release };
    });
    release.mockImplementation(() => {
      connectionHeld = false;
    });
    query.mockImplementation((sql: string) => {
      if (sql === "begin") {
        transactionOpen = true;
      }
      if (sql === "commit" || sql === "rollback") {
        transactionOpen = false;
      }
      if (sql.includes("as should_publish")) {
        return {
          rows: [
            {
              access_duration_months: 12,
              max_release_delay_days: currentMaxDelay,
              sales_status: "open",
              should_publish: true,
            },
          ],
        };
      }
      return versioningQueryResult(sql) ?? { rows: [] };
    });
    uploadCourseCoverFile.mockImplementation(() => {
      recordProviderState();
      currentMaxDelay = 28;
      return coverImage;
    });
    publishR2Object.mockImplementation(recordProviderState);
    deleteR2Objects.mockImplementation(recordProviderState);
    deletePublicR2Objects.mockImplementation(recordProviderState);
    const courseId = "c989d54d-d13f-46a1-89ed-2069d7c1c45b";
    const formData = new FormData();
    formData.set("courseId", courseId);
    formData.set("title", "Curso existente");
    formData.set("accessDurationMonths", "1");
    formData.set("price", "100,00");
    formData.set(
      "coverUpload",
      JSON.stringify({
        aggregateId: courseId,
        contentType: "image/png",
        fileName: "cover.png",
        key: `uploads/admin-images/admin-1/course/${courseId}/course-cover/upload.png`,
        purpose: "course-cover",
        sizeBytes: 1,
      })
    );

    await expect(
      saveCourse({ actorUserId: "admin-1", formData })
    ).rejects.toThrow(
      "O cronograma de conteúdo não cabe na duração comercial do Curso."
    );

    expect(providerStates).toHaveLength(6);
    expect(
      providerStates.every(
        (state) => !(state.connectionHeld || state.transactionOpen)
      )
    ).toBe(true);
    const uploadedKeys = [
      coverImage.original.key,
      coverImage.variants.card.key,
      coverImage.variants.thumb.key,
    ];
    expect(deleteR2Objects).toHaveBeenCalledWith(uploadedKeys);
    expect(deletePublicR2Objects).toHaveBeenCalledWith(uploadedKeys);
    expect(
      query.mock.calls.some(([sql]) => String(sql).includes("update courses"))
    ).toBe(false);
    expect(query).toHaveBeenCalledWith("commit");
    expect(query).toHaveBeenCalledWith("rollback");
    expect(ensureJmvstreamCourseFolder).not.toHaveBeenCalled();
  });

  it("rolls back before mutating an open Course when the reduced access duration no longer fits", async () => {
    query.mockImplementation((sql: string) => {
      if (sql.includes("as should_publish")) {
        return {
          rows: [
            {
              access_duration_months: 12,
              max_release_delay_days: 28,
              sales_status: "open",
              should_publish: true,
            },
          ],
        };
      }
      return versioningQueryResult(sql) ?? { rows: [] };
    });
    const formData = new FormData();
    formData.set("courseId", "course-1");
    formData.set("title", "Curso existente");
    formData.set("accessDurationMonths", "1");
    formData.set("price", "100,00");

    await expect(
      saveCourse({ actorUserId: "admin-1", formData })
    ).rejects.toThrow(
      "O cronograma de conteúdo não cabe na duração comercial do Curso."
    );

    expect(query).toHaveBeenCalledWith("rollback");
    expect(
      query.mock.calls.some(([sql]) => String(sql).includes("update courses"))
    ).toBe(false);
    expect(publishR2Object).not.toHaveBeenCalled();
    expect(ensureJmvstreamCourseFolder).not.toHaveBeenCalled();
  });

  it("does not apply the reduction guard when an open Course keeps its current duration", async () => {
    query.mockImplementation((sql: string) => {
      if (sql.includes("as should_publish")) {
        return {
          rows: [
            {
              access_duration_months: 1,
              max_release_delay_days: 28,
              sales_status: "open",
              should_publish: true,
            },
          ],
        };
      }
      return versioningQueryResult(sql) ?? { rows: [] };
    });
    const formData = new FormData();
    formData.set("courseId", "course-1");
    formData.set("title", "Curso existente");
    formData.set("accessDurationMonths", "1");
    formData.set("price", "100,00");

    await expect(
      saveCourse({ actorUserId: "admin-1", formData })
    ).resolves.toEqual({ courseId: "course-1" });
  });

  it("allows reducing access duration while sales are closed", async () => {
    query.mockImplementation((sql: string) => {
      if (sql.includes("as should_publish")) {
        return {
          rows: [
            {
              access_duration_months: 12,
              max_release_delay_days: 28,
              sales_status: "closed",
              should_publish: true,
            },
          ],
        };
      }
      return versioningQueryResult(sql) ?? { rows: [] };
    });
    const formData = new FormData();
    formData.set("courseId", "course-1");
    formData.set("title", "Curso existente");
    formData.set("accessDurationMonths", "1");
    formData.set("price", "100,00");

    await expect(
      saveCourse({ actorUserId: "admin-1", formData })
    ).resolves.toEqual({ courseId: "course-1" });

    expect(
      query.mock.calls.some(([sql]) => String(sql).includes("update courses"))
    ).toBe(true);
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
    formData.set("releaseMode", "delayed");
    formData.set("releaseDelayDays", "8");

    await saveModule({ actorUserId: "admin-1", formData });

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("update modules"),
      [
        "course-new",
        "Modulo atualizado",
        "Descricao",
        2,
        "archived",
        8,
        "module-1",
      ]
    );
    expect(
      query.mock.calls.find(([sql]) =>
        String(sql).includes("update modules")
      )?.[0]
    ).toContain("release_delay_days");
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
    formData.set("releaseMode", "immediate");
    formData.set("releaseDelayDays", "residual invalid value");

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
        0,
      ]
    );
    const insertSql = String(
      query.mock.calls.find(([sql]) =>
        String(sql).includes("insert into modules")
      )?.[0]
    );
    expect(insertSql).toContain("release_delay_days");
    expect(insertSql).toContain(
      "on conflict (course_publication_id, sort_order)"
    );
    expect(insertSql).toContain(
      "release_delay_days = excluded.release_delay_days"
    );
    expect(recalculateCourseWorkloadHours).toHaveBeenCalledWith("course-1");
  });

  it.each([
    "",
    "1.5",
    "-1",
    "NaN",
    "Infinity",
    "9007199254740992",
  ])("rejects invalid delayed module release days %j", async (releaseDelayDays) => {
    const formData = new FormData();
    formData.set("courseId", "course-1");
    formData.set("title", "Modulo novo");
    formData.set("releaseMode", "delayed");
    formData.set("releaseDelayDays", releaseDelayDays);

    await expect(
      saveModule({ actorUserId: "admin-1", formData })
    ).rejects.toThrow("Informe uma quantidade inteira e não negativa de dias.");

    expect(query).not.toHaveBeenCalled();
  });

  it("copies module release days into a new publication draft", async () => {
    query.mockImplementation((sql: string) => {
      if (
        sql.includes("from course_publications") &&
        sql.includes("status = 'published'")
      ) {
        return {
          rows: [
            {
              id: "publication-published",
              publication_number: 1,
              title_snapshot: "Curso",
              workload_hours_snapshot: 10,
            },
          ],
        };
      }
      if (sql.includes("insert into course_publications")) {
        return { rows: [{ id: "publication-draft" }] };
      }
      if (sql.includes("from modules")) {
        return {
          rows: [
            {
              description: "Descricao",
              id: "module-published",
              release_delay_days: 8,
              sort_order: 1,
              status: "active",
              title: "Modulo D+8",
            },
          ],
        };
      }
      if (sql.includes("insert into modules")) {
        return { rows: [{ id: "module-draft" }] };
      }
      return { rows: [] };
    });

    await expect(
      createCoursePublicationDraft({
        actorUserId: "admin-1",
        courseId: "course-1",
      })
    ).resolves.toEqual({ coursePublicationId: "publication-draft" });

    const moduleSelect = query.mock.calls.find(([sql]) =>
      String(sql).includes("from modules")
    );
    expect(moduleSelect?.[0]).toContain("release_delay_days");
    const moduleInsert = query.mock.calls.find(([sql]) =>
      String(sql).includes("insert into modules")
    );
    expect(moduleInsert?.[0]).toContain("release_delay_days");
    expect(moduleInsert?.[1]).toEqual([
      "course-1",
      "publication-draft",
      "Modulo D+8",
      "Descricao",
      1,
      "active",
      8,
    ]);
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
    formData.set("sortOrder", "3");

    const result = await createLessonDraft({
      actorUserId: "admin-1",
      formData,
    });

    expect(result).toEqual({ courseId: "course-1", lessonId: "lesson-1" });
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("insert into lessons"),
      ["module-1", "course-publication-draft", "Aula inicial", null, 3, "draft"]
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

  it("rejects a lesson without a title before processing its content", async () => {
    const formData = new FormData();
    formData.set("moduleId", "module-1");

    await expect(
      saveLesson({ actorUserId: "admin-1", formData })
    ).rejects.toMatchObject({
      field: "title",
      message: "Informe o título da aula.",
    });
    expect(confirmLessonResourceUpload).not.toHaveBeenCalled();
  });

  it("rejects an empty lesson before reading or confirming stored resources", async () => {
    const formData = new FormData();
    formData.set("lessonId", "lesson-empty");
    formData.set("moduleId", "module-1");
    formData.set("title", "Aula sem conteúdo");
    formData.set(
      "textDocument",
      JSON.stringify({ type: "doc", content: [{ type: "paragraph" }] })
    );

    await expect(
      saveLesson({ actorUserId: "admin-1", formData })
    ).rejects.toMatchObject({
      field: "content",
      message:
        "A aula não pode ser salva sem conteúdo. Adicione pelo menos um vídeo, um texto com conteúdo ou um material anexado.",
    });
    expect(confirmLessonResourceUpload).not.toHaveBeenCalled();
    expect(
      query.mock.calls.some(([sql]) =>
        String(sql).includes("select content_json from lessons")
      )
    ).toBe(false);
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
    formData.set(
      "textDocument",
      JSON.stringify({ type: "doc", content: [{ type: "paragraph" }] })
    );
    formData.append("resourceStorage[]", "r2");
    formData.append("resourceId[]", "resource-1");
    formData.append("resourceLabel[]", "Apostila");
    formData.append("resourceUrl[]", "");
    formData.append("resourceKey[]", "lessons/lesson-1/resources/upload.pdf");
    formData.append("resourceFileName[]", "apostila.pdf");
    formData.append("resourceContentType[]", "application/pdf");
    formData.append("resourcePreview[]", "");
    formData.append("resourceSizeBytes[]", "1024");
    getLessonResourceUpload.mockResolvedValue({
      actorUserId: "admin-1",
      expiresAt: new Date("2026-08-30T17:00:00.000Z"),
      lessonId: "lesson-1",
      reference: {
        contentType: "application/pdf",
        fileName: "apostila.pdf",
        id: "resource-1",
        key: "lessons/lesson-1/resources/upload.pdf",
        label: "apostila.pdf",
        sizeBytes: 1024,
        storage: "r2",
      },
      status: "uploaded",
    });
    consumeLessonResourceUpload.mockRejectedValueOnce(
      new Error("session consume unavailable")
    );

    await saveLesson({ actorUserId: "admin-1", formData });

    expect(confirmLessonResourceUpload).toHaveBeenCalledWith({
      contentType: "application/pdf",
      key: "lessons/lesson-1/resources/upload.pdf",
      sizeBytes: 1024,
    });
    expect(consumeLessonResourceUpload).toHaveBeenCalledWith({
      actorUserId: "admin-1",
      lessonId: "lesson-1",
      resourceId: "resource-1",
    });
    expect(logLessonResourceUploadEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        errorCode: "lesson_resource_upload_consume_failed",
        lessonId: "lesson-1",
        resourceId: "resource-1",
        stage: "consume",
        success: false,
      })
    );
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

  it("rejects an existing published lesson before processing media or moving it into a draft module", async () => {
    query.mockImplementation((sql: string) => {
      if (
        sql.includes(
          "join course_publications cp on cp.id = l.course_publication_id"
        )
      ) {
        return { rows: [] };
      }

      return versioningQueryResult(sql) ?? { rows: [] };
    });
    const formData = new FormData();
    formData.set("lessonId", "published-lesson");
    formData.set("moduleId", "module-1");
    formData.set("title", "Aula publicada");
    formData.set("textDocument", JSON.stringify(textDocument));

    await expect(
      saveLesson({ actorUserId: "admin-1", formData })
    ).rejects.toThrow("Prepare alteracoes");

    expect(confirmLessonResourceUpload).not.toHaveBeenCalled();
    expect(
      query.mock.calls.some(([sql]) => String(sql).includes("update lessons"))
    ).toBe(false);
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
