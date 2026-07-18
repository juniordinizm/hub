import { beforeEach, describe, expect, it, vi } from "vitest";

const { getJmvstreamAssetsForLesson, query, requirePermission } = vi.hoisted(
  () => ({
    getJmvstreamAssetsForLesson: vi.fn(),
    query: vi.fn(),
    requirePermission: vi.fn(),
  })
);

vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({ getPool: () => ({ query }) }));
vi.mock("@/features/jmvstream/server", () => ({
  getJmvstreamAssetsForLesson,
}));
vi.mock("@/lib/auth-permissions", () => ({ requirePermission }));

import { getAdminCourseDetailData, getAdminLessonEditorData } from "./server";

const courseId = "course-1";
const lessonId = "lesson-1";

const courseRow = {
  access_duration_months: 12,
  cover_image_json: { key: "cover" },
  description: "Course description",
  id: courseId,
  payment_provider_product_id: "product-1",
  price_in_cents: 12_900,
  slug: "course-one",
  status: "active",
  subtitle: "Course subtitle",
  thumbnail_url: "https://example.test/thumb.jpg",
  title: "Course one",
  workload_hours: 24,
};

const moduleRow = {
  course_id: courseId,
  course_title: "Course one",
  description: "Module description",
  id: "module-1",
  sort_order: 2,
  status: "active",
  title: "Module one",
};

const lessonRow = {
  content_json: { type: "doc" },
  course_id: courseId,
  course_title: "Course one",
  duration_seconds: 300,
  id: lessonId,
  is_published: true,
  lesson_description: "Lesson description",
  module_id: "module-1",
  module_title: "Module one",
  module_description: "Module description",
  module_sort_order: 2,
  module_status: "active",
  sort_order: 3,
  status: "active",
  text_duration_seconds: 120,
  text_word_count: 400,
  title: "Lesson one",
  video_embed_url: "https://video.example.test/embed",
  video_duration_seconds: 180,
  video_external_id: "video-1",
  video_provider: "jmvstream",
};

beforeEach(() => {
  getJmvstreamAssetsForLesson.mockReset();
  query.mockReset();
  requirePermission.mockReset();
  requirePermission.mockResolvedValue({});
});

describe("admin read projections", () => {
  it("returns one course detail from records scoped to that course", async () => {
    const rows = [
      [courseRow],
      [moduleRow],
      [lessonRow],
      [
        {
          course_id: courseId,
          course_title: "Course one",
          email: "student@example.test",
          expires_at: new Date("2026-12-01T00:00:00.000Z"),
          id: "enrollment-1",
          last_access_at: null,
          name: "Student",
          original_expires_at: new Date("2026-12-01T00:00:00.000Z"),
          revoked_reason: null,
          starts_at: new Date("2026-01-01T00:00:00.000Z"),
          status: "active",
          user_id: "user-1",
        },
      ],
      [
        {
          amount_in_cents: 12_900,
          course_id: courseId,
          course_title: "Course one",
          customer_email: "student@example.test",
          customer_name: "Student",
          id: "order-1",
          paid_at: new Date("2026-01-02T00:00:00.000Z"),
          provider_order_id: "provider-order-1",
          status: "paid",
        },
      ],
      [
        {
          code: "CERT-1",
          course_id: courseId,
          course_title_snapshot: "Course one",
          issued_at: new Date("2026-01-03T00:00:00.000Z"),
          student_name_snapshot: "Student",
        },
      ],
    ];
    query.mockImplementation((_sql: string, values: unknown[]) => {
      expect(values).toEqual([courseId]);
      return { rows: rows.shift() ?? [] };
    });

    const detail = await getAdminCourseDetailData(courseId);

    expect(requirePermission).toHaveBeenCalledWith("viewAdminPanel");
    expect(query).toHaveBeenCalledTimes(6);
    expect(detail).toMatchObject({
      certificates: [{ code: "CERT-1", courseId }],
      course: { id: courseId, title: "Course one" },
      enrollments: [{ courseId, id: "enrollment-1" }],
      lessons: [{ id: lessonId, moduleId: "module-1" }],
      modules: [{ courseId, id: "module-1" }],
      orders: [{ courseId, id: "order-1" }],
    });
  });

  it("returns the failed JMVStream deletion asset for the requested lesson", async () => {
    query.mockImplementation((_sql: string, values: unknown[]) => {
      if (values.length === 1) {
        expect(values).toEqual([courseId]);
        return { rows: [courseRow] };
      }

      expect(values).toEqual([courseId, lessonId]);
      return { rows: [lessonRow] };
    });
    getJmvstreamAssetsForLesson.mockResolvedValue([
      {
        deleteStatus: "failed",
        filename: "lesson.mp4",
        galleryUuid: null,
        id: "asset-1",
        lastError: "Deletion failed",
        lessonId,
        uploadStatus: "completed",
        videoHash: "old-video",
      },
    ]);

    const editor = await getAdminLessonEditorData({ courseId, lessonId });

    expect(requirePermission).toHaveBeenCalledWith("viewAdminPanel");
    expect(query).toHaveBeenCalledTimes(2);
    expect(getJmvstreamAssetsForLesson).toHaveBeenCalledWith(lessonId);
    expect(editor).toMatchObject({
      asset: { id: "asset-1" },
      course: { id: courseId },
      lesson: { id: lessonId },
      module: { id: "module-1" },
    });
  });
});
