import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  query,
  resolveCourseAccess,
  resolveLessonAccess,
  syncJmvstreamLessonPlayer,
  getJmvstreamAssetsForLesson,
} = vi.hoisted(() => ({
  query: vi.fn(),
  resolveCourseAccess: vi.fn(),
  resolveLessonAccess: vi.fn(),
  syncJmvstreamLessonPlayer: vi.fn(),
  getJmvstreamAssetsForLesson: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({ getPool: () => ({ query }) }));
vi.mock("@/features/enrollments/access", () => ({
  resolveCourseAccess,
  resolveLessonAccess,
}));
vi.mock("@/features/jmvstream/server", () => ({
  syncJmvstreamLessonPlayer,
}));
vi.mock("@/features/jmvstream/asset-persistence", () => ({
  getJmvstreamAssetsForLesson,
}));

import {
  getStudentCourseOverview,
  getStudentLessonWorkspace,
  recalculateCourseWorkloadHours,
} from "./server";

const expiresAt = new Date("2027-01-01T00:00:00.000Z");

const createCourseOverviewRow = ({
  completedAt = null,
  lessonId,
  lessonSortOrder,
}: {
  completedAt?: Date | null;
  lessonId: string;
  lessonSortOrder: number;
}) => ({
  certificate_code: "CERT-1",
  completed_at: completedAt,
  course_description: "Description",
  course_id: "course-1",
  course_slug: "course-one",
  course_subtitle: "Subtitle",
  course_title: "Course one",
  duration_seconds: 120,
  expires_at: expiresAt,
  lesson_id: lessonId,
  lesson_sort_order: lessonSortOrder,
  lesson_thumbnail_url: null,
  lesson_title: `Lesson ${lessonSortOrder}`,
  module_description: "Module description",
  module_id: "module-1",
  module_sort_order: 1,
  module_title: "Module one",
  student_name: "Aluna Teste",
  thumbnail_url: null,
  video_embed_url: null,
  video_external_id: null,
  watched_percent: completedAt ? 100 : 0,
  workload_hours: 1,
});

const createLessonRow = ({
  completedAt = null,
  lessonId,
  lessonSortOrder,
}: {
  completedAt?: Date | null;
  lessonId: string;
  lessonSortOrder: number;
}) => ({
  completed_at: completedAt,
  content_json: null,
  course_id: "course-1",
  course_title: "Course one",
  duration_seconds: 120,
  lesson_description: `Description ${lessonSortOrder}`,
  lesson_id: lessonId,
  lesson_sort_order: lessonSortOrder,
  lesson_title: `Lesson ${lessonSortOrder}`,
  module_id: "module-1",
  module_sort_order: 1,
  module_title: "Module one",
  video_duration_seconds: 120,
  video_embed_url: null,
  video_external_id: lessonId === "lesson-2" ? "video-2" : null,
  video_provider: lessonId === "lesson-2" ? "jmvstream" : null,
  watch_current_seconds: null,
  watch_duration_seconds: null,
  watch_max_position_seconds: null,
  watch_percent: null,
});

beforeEach(() => {
  vi.resetAllMocks();
  resolveCourseAccess.mockResolvedValue(true);
  resolveLessonAccess.mockResolvedValue(true);
  syncJmvstreamLessonPlayer.mockResolvedValue({ playerUrl: null });
  getJmvstreamAssetsForLesson.mockResolvedValue([]);
});

describe("student experience reads", () => {
  it("stores workload on the editable publication without summing retired content", async () => {
    query.mockImplementation((sql: string) => {
      if (sql.includes("from course_publications")) {
        return { rows: [{ id: "publication-draft", status: "draft" }] };
      }
      if (sql.includes("from lessons l")) {
        return { rows: [{ duration_seconds: 3600 }] };
      }
      return { rows: [] };
    });

    await expect(recalculateCourseWorkloadHours("course-1")).resolves.toBe(1);

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("update course_publications"),
      [1, "publication-draft"]
    );
    expect(query).not.toHaveBeenCalledWith(
      expect.stringContaining("where m.course_id = $1"),
      expect.anything()
    );
  });

  it("assembles an enrolled Course overview with progress and sequence", async () => {
    query.mockResolvedValue({
      rows: [
        createCourseOverviewRow({
          completedAt: new Date("2026-01-01T00:00:00.000Z"),
          lessonId: "lesson-1",
          lessonSortOrder: 1,
        }),
        createCourseOverviewRow({ lessonId: "lesson-2", lessonSortOrder: 2 }),
        createCourseOverviewRow({ lessonId: "lesson-3", lessonSortOrder: 3 }),
      ],
    });

    const overview = await getStudentCourseOverview({
      courseId: "course-1",
      viewer: { role: "student", userId: "student-1" },
    });

    expect(query).toHaveBeenCalledWith(expect.any(String), [
      "student-1",
      "course-1",
    ]);
    expect(overview).toMatchObject({
      certificateCode: "CERT-1",
      completedCount: 1,
      course: { expiresAt, id: "course-1" },
      isPreview: false,
      nextLessonId: "lesson-2",
      progressPercent: 33,
      studentName: "Aluna Teste",
      totalCount: 3,
    });
    expect(overview?.modules[0]?.lessons).toMatchObject([
      { id: "lesson-1", isAvailable: true, isCompleted: true },
      { id: "lesson-2", isAvailable: true, isCompleted: false },
      { id: "lesson-3", isAvailable: false, isCompleted: false },
    ]);
    expect(query.mock.calls[0]?.[0]).toContain(
      "completed_lesson.curriculum_key = l.curriculum_key"
    );
  });

  it("assembles the same Course overview intent as an unrestricted admin preview", async () => {
    query.mockResolvedValue({
      rows: [
        createCourseOverviewRow({ lessonId: "lesson-1", lessonSortOrder: 1 }),
        createCourseOverviewRow({ lessonId: "lesson-2", lessonSortOrder: 2 }),
      ],
    });

    const overview = await getStudentCourseOverview({
      courseId: "course-1",
      viewer: { role: "admin", userId: "admin-1" },
    });

    expect(query).toHaveBeenCalledWith(expect.any(String), ["course-1"]);
    expect(overview).toMatchObject({
      certificateCode: null,
      completedCount: 0,
      isPreview: true,
      nextLessonId: "lesson-1",
      progressPercent: 0,
      totalCount: 2,
    });
    expect(overview?.modules[0]?.lessons).toMatchObject([
      { id: "lesson-1", isAvailable: true, isCompleted: false },
      { id: "lesson-2", isAvailable: true, isCompleted: false },
    ]);
  });

  it("enforces lesson sequence for enrolled students", async () => {
    query.mockResolvedValue({
      rows: [
        createLessonRow({ lessonId: "lesson-1", lessonSortOrder: 1 }),
        createLessonRow({ lessonId: "lesson-2", lessonSortOrder: 2 }),
      ],
    });

    await expect(
      getStudentLessonWorkspace({
        lessonId: "lesson-2",
        viewer: { role: "student", userId: "student-1" },
      })
    ).resolves.toBeNull();

    expect(syncJmvstreamLessonPlayer).not.toHaveBeenCalled();
  });

  it("resolves JMVStream video through the lesson workspace interface", async () => {
    query.mockResolvedValue({
      rows: [
        createLessonRow({
          completedAt: new Date("2026-01-01T00:00:00.000Z"),
          lessonId: "lesson-1",
          lessonSortOrder: 1,
        }),
        createLessonRow({ lessonId: "lesson-2", lessonSortOrder: 2 }),
      ],
    });
    syncJmvstreamLessonPlayer.mockResolvedValue({
      playerUrl: "https://player.example.test/video-2",
    });

    const workspace = await getStudentLessonWorkspace({
      lessonId: "lesson-2",
      viewer: { role: "student", userId: "student-1" },
    });

    expect(syncJmvstreamLessonPlayer).toHaveBeenCalledWith("lesson-2");
    expect(workspace).toMatchObject({
      isPreview: false,
      lesson: {
        id: "lesson-2",
        videoEmbedUrl: "https://player.example.test/video-2",
      },
      nextLessonId: null,
      previousLessonId: "lesson-1",
      progressPercent: 50,
    });
  });

  it("exposes a safe failed state when JMVStream cannot process a lesson video", async () => {
    query.mockResolvedValue({
      rows: [
        createLessonRow({
          completedAt: new Date("2026-01-01T00:00:00.000Z"),
          lessonId: "lesson-1",
          lessonSortOrder: 1,
        }),
        createLessonRow({ lessonId: "lesson-2", lessonSortOrder: 2 }),
      ],
    });
    getJmvstreamAssetsForLesson.mockResolvedValue([{ uploadStatus: "failed" }]);

    const workspace = await getStudentLessonWorkspace({
      lessonId: "lesson-2",
      viewer: { role: "student", userId: "student-1" },
    });

    expect(workspace?.lesson.videoProcessingState).toBe("failed");
  });

  it("keeps every preview lesson available while preserving navigation", async () => {
    query.mockResolvedValue({
      rows: [
        createLessonRow({ lessonId: "lesson-1", lessonSortOrder: 1 }),
        createLessonRow({ lessonId: "lesson-2", lessonSortOrder: 2 }),
      ],
    });

    const workspace = await getStudentLessonWorkspace({
      lessonId: "lesson-2",
      viewer: { role: "support", userId: "support-1" },
    });

    expect(resolveLessonAccess).not.toHaveBeenCalled();
    expect(workspace).toMatchObject({
      isPreview: true,
      lesson: { id: "lesson-2", isCompleted: false, watchProgress: null },
      nextLessonId: null,
      previousLessonId: "lesson-1",
      progressPercent: 0,
    });
    expect(workspace?.modules[0]?.lessons).toMatchObject([
      { id: "lesson-1", isAvailable: true },
      { id: "lesson-2", isAvailable: true },
    ]);
  });
});
