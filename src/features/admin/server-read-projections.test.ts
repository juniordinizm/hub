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

import {
  getAdminCourseDetailData,
  getAdminCoursePublicationState,
  getAdminFinancialData,
  getAdminLessonEditorData,
  getAdminStudentsData,
} from "./server";

const courseId = "course-1";
const lessonId = "lesson-1";

const courseRow = {
  access_duration_months: 12,
  cover_image_json: { key: "cover" },
  description: "Course description",
  id: courseId,
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
  it("projects buyer identity payment reviews with their order in the financial read", async () => {
    query.mockImplementation((sql: string) => {
      if (sql.includes("from payment_reviews")) {
        return {
          rows: [
            {
              id: "review-1",
              order_id: "order-1",
              provider_checkout_id: "chk-1",
              reason: "buyer_identity_team_account",
              status: "pending",
              type: "buyer_identity",
            },
          ],
        };
      }
      return { rows: [] };
    });

    const data = await getAdminFinancialData();

    expect(data.paymentReviews).toEqual([
      {
        id: "review-1",
        orderId: "order-1",
        providerCheckoutId: "chk-1",
        reason: "buyer_identity_team_account",
        status: "pending",
        type: "buyer_identity",
      },
    ]);
    expect(requirePermission).toHaveBeenCalledWith("viewAdminPanel");
    const reviewSql = String(
      query.mock.calls.find(([sql]) =>
        String(sql).includes("from payment_reviews")
      )?.[0]
    );
    expect(reviewSql).toContain("pr.type");
    expect(reviewSql).toContain("join orders o on o.id = pr.order_id");
  });

  it.each([
    "future_review_type",
    null,
    42,
  ])("fails closed when payment review type drifts to %s", async (type) => {
    query.mockImplementation((sql: string) => {
      if (sql.includes("from payment_reviews")) {
        return {
          rows: [
            {
              id: "review-1",
              order_id: "order-1",
              provider_checkout_id: "chk-1",
              reason: "unexpected_review",
              status: "pending",
              type,
            },
          ],
        };
      }
      return { rows: [] };
    });

    await expect(getAdminFinancialData()).rejects.toThrow(
      "Revisao financeira invalida."
    );
  });

  it("aggregates draft and published publication state in one query", async () => {
    query.mockResolvedValue({
      rows: [{ has_draft: true, has_published: true }],
    });

    await expect(getAdminCoursePublicationState(courseId)).resolves.toEqual({
      hasDraft: true,
      hasPublished: true,
    });

    expect(requirePermission).toHaveBeenCalledWith("viewAdminPanel");
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0]?.[1]).toEqual([courseId]);
    expect(String(query.mock.calls[0]?.[0])).toContain("status = 'draft'");
    expect(String(query.mock.calls[0]?.[0])).toContain("status = 'published'");
  });

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
          provider_checkout_id: "provider-order-1",
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
    expect(
      query.mock.calls.find(([sql]) =>
        String(sql).includes("from courses")
      )?.[0]
    ).not.toContain("payment_provider_product_id");
    expect(detail).toMatchObject({
      certificates: [{ code: "CERT-1", courseId }],
      course: { id: courseId, title: "Course one" },
      enrollments: [{ courseId, id: "enrollment-1" }],
      lessons: [{ id: lessonId, moduleId: "module-1" }],
      modules: [{ courseId, id: "module-1" }],
      orders: [
        {
          courseId,
          id: "order-1",
          providerCheckoutId: "provider-order-1",
        },
      ],
    });
    expect(detail?.orders[0]).not.toHaveProperty(
      ["providerOrder", "Id"].join("")
    );
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

  it("keeps the student list within the measured read budget without N+1 queries", async () => {
    const studentCount = 250;
    const enrollmentsPerStudent = 3;
    const profiles = Array.from({ length: studentCount }, (_, index) => ({
      email: `student-${index}@example.test`,
      last_access_at: null,
      name: `Student ${index}`,
      platform_blocked_at: null,
      platform_blocked_reason: null,
      user_id: `student-${index}`,
    }));
    const enrollments = profiles.flatMap((profile) =>
      Array.from({ length: enrollmentsPerStudent }, (_, index) => ({
        course_id: `course-${index}`,
        course_title: `Course ${index}`,
        email: profile.email,
        expires_at: new Date("2027-01-01T00:00:00.000Z"),
        id: `${profile.user_id}-enrollment-${index}`,
        last_access_at: null,
        name: profile.name,
        original_expires_at: new Date("2027-01-01T00:00:00.000Z"),
        revoked_reason: null,
        starts_at: new Date("2026-01-01T00:00:00.000Z"),
        status: "active",
        user_id: profile.user_id,
      }))
    );
    query.mockImplementation((sql: string) => ({
      rows: sql.includes("from profiles") ? profiles : enrollments,
    }));

    const data = await getAdminStudentsData();
    const payloadBytes = Buffer.byteLength(JSON.stringify(data));

    expect(query).toHaveBeenCalledTimes(2);
    expect(data.enrollments).toHaveLength(studentCount * enrollmentsPerStudent);
    expect(data.students).toHaveLength(studentCount);
    expect(payloadBytes).toBeLessThan(512 * 1024);
  });
});
