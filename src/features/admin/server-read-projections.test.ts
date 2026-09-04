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
  getAdminCourseCatalogData,
  getAdminCourseDetailData,
  getAdminCourseOverviewSummary,
  getAdminCoursePublicationState,
  getAdminDashboardData,
  getAdminFinancialData,
  getAdminLessonEditorData,
  getAdminStudentDetail,
  getAdminStudentsData,
} from "./server";

const courseId = "course-1";
const lessonId = "lesson-1";
const limitKeywordPattern = /\blimit\b/;

const courseRow = {
  access_duration_months: 12,
  catalog_visibility: "listed",
  certificate_enabled: true,
  cover_image_json: { key: "cover" },
  description: "Course description",
  id: courseId,
  has_commercial_history: true,
  interest_count: 3,
  interest_notifications_sent: 5,
  launch_date: "2026-10-01",
  launch_landing_url: null,
  pending_checkout_cancellations: 1,
  pending_interest_notifications: 2,
  pending_certificate_reconciliation_count: 7,
  price_in_cents: 12_900,
  sales_status: "closed",
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
  release_delay_days: 8,
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
  module_release_delay_days: 8,
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
  it("keeps the course catalog projection bounded without loading lesson content", async () => {
    query.mockResolvedValue({ rows: [courseRow] });

    await expect(getAdminCourseCatalogData()).resolves.toMatchObject({
      courses: [expect.objectContaining({ id: courseId })],
      lessons: [],
      modules: [],
    });

    expect(query).toHaveBeenCalledTimes(1);
    const sql = String(query.mock.calls[0]?.[0]).toLowerCase();
    expect(sql).toContain("limit $1 offset $2");
    expect(sql).not.toContain("l.content_json");
    expect(sql).not.toContain("select l.*");
    expect(requirePermission).toHaveBeenCalledWith("manageContent");
  });

  it("bounds the student projection and returns pagination metadata", async () => {
    query.mockImplementation((sql: string) => ({
      rows: sql.includes("from profiles")
        ? [
            {
              email: "student@example.test",
              last_access_at: null,
              name: "Student",
              platform_blocked_at: null,
              platform_blocked_reason: null,
              user_id: "student-1",
            },
          ]
        : [],
    }));

    await expect(
      getAdminStudentsData({ search: "student", page: 2 })
    ).resolves.toMatchObject({
      hasNextPage: false,
      page: 2,
      pageSize: 100,
      search: "student",
    });

    const profileCall = query.mock.calls.find(([sql]) =>
      String(sql).includes("from profiles")
    );
    expect(String(profileCall?.[0])).toContain("limit $3");
    expect(String(profileCall?.[0])).toContain("offset $4");
    expect(profileCall?.[1]).toEqual(["student", "%student%", 101, 100]);
    expect(requirePermission).toHaveBeenCalledWith("manageEnrollmentAccess");
  });

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
    expect(requirePermission).toHaveBeenCalledWith("viewFinancials");
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

    expect(requirePermission).toHaveBeenCalledWith("manageContent");
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0]?.[1]).toEqual([courseId]);
    expect(String(query.mock.calls[0]?.[0])).toContain("status = 'draft'");
    expect(String(query.mock.calls[0]?.[0])).toContain("status = 'published'");
  });

  it("returns exact course overview counts from one aggregate query", async () => {
    query.mockResolvedValue({
      rows: [
        {
          active_enrollment_count: 57,
          paid_order_count: 83,
          valid_certificate_count: 41,
        },
      ],
    });

    await expect(getAdminCourseOverviewSummary(courseId)).resolves.toEqual({
      activeEnrollmentCount: 57,
      paidOrderCount: 83,
      validCertificateCount: 41,
    });

    expect(requirePermission).toHaveBeenCalledWith("manageContent");
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0]?.[1]).toEqual([courseId]);
    const sql = String(query.mock.calls[0]?.[0])
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
    expect(sql).toContain(
      "count(*)::int from enrollments where course_id = $1 and status = 'active'"
    );
    expect(sql).toContain(
      "count(*)::int from orders where course_id = $1 and status = 'paid'"
    );
    expect(sql).toContain(
      "count(*)::int from certificates where course_id = $1 and status = 'valid'"
    );
    expect(sql).not.toMatch(limitKeywordPattern);
  });

  it("normalizes a missing course overview aggregate row to zero", async () => {
    query.mockResolvedValue({ rows: [] });

    await expect(getAdminCourseOverviewSummary(courseId)).resolves.toEqual({
      activeEnrollmentCount: 0,
      paidOrderCount: 0,
      validCertificateCount: 0,
    });
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
    ];
    query.mockImplementation((_sql: string, values: unknown[]) => {
      expect(values).toEqual([courseId]);
      return { rows: rows.shift() ?? [] };
    });

    const detail = await getAdminCourseDetailData(courseId);

    expect(requirePermission).toHaveBeenCalledWith("manageContent");
    expect(query).toHaveBeenCalledTimes(4);
    expect(
      query.mock.calls.find(([sql]) =>
        String(sql).includes("from courses")
      )?.[0]
    ).not.toContain("payment_provider_product_id");
    expect(detail).toMatchObject({
      course: {
        catalogVisibility: "listed",
        hasCommercialHistory: true,
        id: courseId,
        interestCount: 3,
        interestNotificationsSent: 5,
        pendingCheckoutCancellations: 1,
        pendingCertificateReconciliationCount: 7,
        pendingInterestNotifications: 2,
        salesStatus: "closed",
        title: "Course one",
      },
      enrollments: [{ courseId, id: "enrollment-1" }],
      lessons: [{ id: lessonId, moduleId: "module-1" }],
      modules: [{ courseId, id: "module-1" }],
    });
    expect(detail?.modules[0]?.releaseDelayDays).toBe(8);
    const moduleSql = String(
      query.mock.calls.find(([sql]) =>
        String(sql).includes("select m.id, m.course_id")
      )?.[0]
    );
    expect(moduleSql).toContain("m.release_delay_days");
    const courseSql = String(
      query.mock.calls.find(([sql]) =>
        String(sql).includes("from courses")
      )?.[0]
    ).toLowerCase();
    expect(courseSql).toContain("from course_completions");
    expect(courseSql).toContain("not exists");
    expect(courseSql).not.toContain("certificate.status = 'valid'");
    expect(courseSql).not.toContain("users");
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

    expect(requirePermission).toHaveBeenCalledWith("manageContent");
    expect(query).toHaveBeenCalledTimes(2);
    expect(getJmvstreamAssetsForLesson).toHaveBeenCalledWith(lessonId);
    const lessonEditorSql = String(
      query.mock.calls.find(([, values]) => values?.length === 2)?.[0]
    );
    expect(lessonEditorSql).toContain("cp.status = 'draft'");
    expect(editor).toMatchObject({
      asset: { id: "asset-1" },
      course: { id: courseId },
      lesson: { id: lessonId },
      module: { id: "module-1" },
    });
    expect(editor?.module.releaseDelayDays).toBe(8);
    expect(lessonEditorSql).toContain("m.release_delay_days");
  });

  it("projects module release days in the unscoped dashboard read", async () => {
    query.mockImplementation((sql: string) => ({
      rows: sql.includes("select m.id, m.course_id") ? [moduleRow] : [],
    }));

    const data = await getAdminDashboardData();

    expect(data.modules).toEqual([
      expect.objectContaining({ id: "module-1", releaseDelayDays: 8 }),
    ]);
    const moduleSql = String(
      query.mock.calls.find(([sql]) =>
        String(sql).includes("select m.id, m.course_id")
      )?.[0]
    );
    expect(moduleSql).toContain("m.release_delay_days");
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

    const data = await getAdminStudentsData({ pageSize: studentCount });
    const payloadBytes = Buffer.byteLength(JSON.stringify(data));

    expect(query).toHaveBeenCalledTimes(2);
    expect(data.enrollments).toHaveLength(studentCount * enrollmentsPerStudent);
    expect(data.students).toHaveLength(studentCount);
    expect(payloadBytes).toBeLessThan(512 * 1024);
  });

  it("keeps a student detail available when the profile has no enrollment", async () => {
    query.mockResolvedValue({
      rows: [
        {
          course_id: null,
          course_title: null,
          email: "student@example.test",
          expires_at: null,
          id: null,
          name: "Student",
          original_expires_at: null,
          platform_blocked_at: null,
          platform_blocked_reason: null,
          revoked_reason: null,
          starts_at: null,
          status: null,
          user_id: "student-without-enrollment",
        },
      ],
    });

    await expect(
      getAdminStudentDetail("student-without-enrollment")
    ).resolves.toEqual({
      email: "student@example.test",
      enrollments: [],
      name: "Student",
      platformBlockedAt: null,
      platformBlockedReason: null,
      userId: "student-without-enrollment",
    });

    const sql = String(query.mock.calls[0]?.[0]).toLowerCase();
    expect(sql).toContain("left join enrollments");
    expect(requirePermission).toHaveBeenCalledWith("manageEnrollmentAccess");
  });
});
