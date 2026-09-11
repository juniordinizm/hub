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
  getAdminAuditData,
  getAdminCourseCatalogData,
  getAdminCourseDetailData,
  getAdminCourseOverviewSummary,
  getAdminCoursePublicationState,
  getAdminCourseTabData,
  getAdminDashboardProjection,
  getAdminFinancialAnalysisData,
  getAdminFinancialOrdersData,
  getAdminFinancialOverviewData,
  getAdminInstallmentPayments,
  getAdminLessonEditorData,
  getAdminOverview,
  getAdminStatementImportHistory,
  getAdminStatementImportProgress,
  getAdminStudentDetail,
  getAdminStudentsData,
  getAdminWebhookEvents,
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
  it("keeps overview aggregates global", async () => {
    query.mockResolvedValue({
      rows: [
        {
          active_enrollments: 17,
          courses: 4,
          failed_webhooks: 23,
          paid_orders: 31,
          paid_revenue_in_cents: "123456",
          pending_orders: 9,
          retryable_webhooks: 0,
          students: 12,
        },
      ],
    });

    await expect(getAdminOverview()).resolves.toEqual({
      activeEnrollments: 17,
      courses: 4,
      failedWebhooks: 23,
      paidOrders: 31,
      paidRevenueInCents: 123_456,
      pendingOrders: 9,
      students: 12,
      retryableWebhooks: 0,
    });

    expect(requirePermission).toHaveBeenCalledWith("viewAdminPanel");
    expect(requirePermission).toHaveBeenCalledWith("viewFinancials");
    expect(requirePermission).toHaveBeenCalledWith("viewGlobalAudit");
    expect(query).toHaveBeenCalledTimes(1);
    const aggregateSql = String(query.mock.calls[0]?.[0]).toLowerCase();
    expect(aggregateSql).toContain(
      "sum(coalesce(paid_amount_in_cents, amount_in_cents))"
    );
    expect(aggregateSql).toContain("e.starts_at <= now()");
    expect(aggregateSql).toContain("e.expires_at >= now()");
    expect(aggregateSql).toContain("cp.status = 'published'");
    expect(aggregateSql).toContain("status = 'pending'");
    expect(aggregateSql).toContain("status = 'failed'");
    expect(aggregateSql).not.toContain("limit 8");
  });

  it("keeps financial health global and counts retryable Asaas webhooks", async () => {
    query.mockImplementation((sql: string) => {
      if (sql.includes("retryable_webhooks")) {
        return {
          rows: [
            {
              abandoned_checkout_orders: 6,
              disputed_orders: 2,
              failed_webhooks: 1,
              paid_orders: 3,
              paid_revenue_in_cents: "30000",
              pending_orders: 4,
              pending_revenue_in_cents: "40000",
              refunded_orders: 1,
              retryable_webhooks: 4,
              total_orders: 10,
            },
          ],
        };
      }

      return { rows: [] };
    });

    const data = await getAdminFinancialOverviewData();

    expect(data.financialHealth).toEqual({
      abandonedCheckoutOrders: 6,
      averagePaidTicketInCents: 10_000,
      checkoutConversionPercent: 30,
      disputedOrders: 2,
      failedWebhooks: 1,
      paidOrders: 3,
      paidRevenueInCents: 30_000,
      pendingOrders: 4,
      pendingRevenueInCents: 40_000,
      readyWebhooks: 0,
      refundedOrders: 1,
      retryableWebhooks: 4,
      totalOrders: 10,
    });

    const healthSql = String(
      query.mock.calls.find(([sql]) =>
        String(sql).includes("retryable_webhooks")
      )?.[0]
    );
    expect(healthSql).not.toContain("limit");
    expect(healthSql).toContain("status = 'failed'");
    expect(healthSql).toContain("status = 'retryable'");
    expect(healthSql).toContain("ready_webhooks");
    expect(healthSql).toContain("abandoned_checkout_orders");
    expect(healthSql).toContain("checkout_status not in");
    expect(healthSql).toContain(
      "sum(coalesce(paid_amount_in_cents, amount_in_cents))"
    );
  });

  it("loads the overview and orders projections independently", async () => {
    query.mockResolvedValue({ rows: [] });

    await getAdminFinancialOverviewData();

    const overviewSql = query.mock.calls.map(([sql]) => String(sql));
    expect(overviewSql.some((sql) => sql.includes("from orders o"))).toBe(
      false
    );

    query.mockReset();
    query.mockResolvedValue({ rows: [] });
    await getAdminFinancialOrdersData();

    const ordersSql = query.mock.calls.map(([sql]) => String(sql));
    expect(
      ordersSql.some((sql) => sql.includes("select c.id as course_id"))
    ).toBe(false);
    expect(ordersSql.some((sql) => sql.includes("from payment_reviews"))).toBe(
      true
    );
  });

  it("projects period analysis with explicit gross, fee and refund values", async () => {
    query.mockImplementation((sql: string) => {
      if (sql.includes("gross_received_in_cents")) {
        return {
          rows: [
            {
              fees_in_cents: "500",
              gross_received_in_cents: "10000",
              paid_orders: 2,
              pending_orders: 3,
              pending_revenue_in_cents: "15000",
              refunded_orders: 1,
              refunded_revenue_in_cents: "500",
            },
          ],
        };
      }
      if (sql.includes("retryable_webhooks")) {
        return { rows: [{}] };
      }
      return { rows: [] };
    });

    await expect(getAdminFinancialAnalysisData("30d")).resolves.toEqual({
      analytics: {
        averageReceivedTicketInCents: 5000,
        estimatedNetRevenueInCents: 9000,
        feesInCents: 500,
        grossReceivedInCents: 10_000,
        missingFeeEvidenceOrders: 0,
        paidOrders: 2,
        pendingOrders: 3,
        pendingRevenueInCents: 15_000,
        period: "30d",
        periodLabel: "Últimos 30 dias",
        refundRatePercent: 50,
        refundedOrders: 1,
        refundedRevenueInCents: 500,
      },
    });
    expect(requirePermission).toHaveBeenCalledWith("viewFinancials");
    const analyticsSql = String(
      query.mock.calls.find(([sql]) =>
        String(sql).includes("gross_received_in_cents")
      )?.[0]
    );
    expect(analyticsSql).toContain("with received_orders as");
    expect(analyticsSql).toContain(
      "coalesce(paid_amount_in_cents, amount_in_cents)"
    );
    expect(analyticsSql).toContain("status = 'pending'");
    expect(analyticsSql).toContain("checkout_status not in");
    expect(analyticsSql).toContain(
      "coalesce(paid_at, created_at) <= $2::timestamptz"
    );
    expect(
      query.mock.calls.find(([sql]) =>
        String(sql).includes("gross_received_in_cents")
      )?.[1]
    ).toEqual([expect.any(Date), expect.any(Date)]);
  });

  it("preserves the order total when a bounded page has no rows", async () => {
    query.mockImplementation((sql: string) => {
      if (
        sql.includes("from orders o") &&
        sql.includes("count(*)::int as total_count")
      ) {
        return { rows: [{ total_count: 42 }] };
      }
      if (sql.includes("from orders o")) {
        return { rows: [] };
      }
      if (sql.includes("retryable_webhooks")) {
        return { rows: [{}] };
      }
      return { rows: [] };
    });

    const data = await getAdminFinancialOrdersData({ page: 999_999 });

    expect(data.orders).toEqual([]);
    expect(data.ordersTotalCount).toBe(42);
    const orderQuery = query.mock.calls.find(
      ([sql, values]) =>
        String(sql).includes("from orders o") &&
        Array.isArray(values) &&
        values.length === 2
    );
    expect(orderQuery?.[1]).toEqual([21, 19_980]);
  });

  it("returns a compact history of completed statement imports", async () => {
    const completedAt = new Date("2026-09-08T12:00:00.000Z");
    query.mockResolvedValue({
      rows: [
        {
          actor_email: "admin@example.test",
          completed_at: completedAt,
          finish_date: "2026-08-31",
          inserted: "12",
          resumed_from_offset: "100",
          start_date: "2026-08-01",
          updated: "3",
        },
      ],
    });

    await expect(getAdminStatementImportHistory()).resolves.toEqual([
      {
        actorEmail: "admin@example.test",
        completedAt,
        finishDate: "2026-08-31",
        inserted: 12,
        resumedFromOffset: 100,
        startDate: "2026-08-01",
        updated: 3,
      },
    ]);

    expect(requirePermission).toHaveBeenCalledWith("manageFinancialOperations");
    expect(query).toHaveBeenCalledTimes(1);
    const historySql = String(query.mock.calls[0]?.[0]);
    expect(historySql).toContain("asaas.statement_imported");
    expect(historySql).toContain("limit 5");
  });

  it("exposes an active statement import cursor to the admin", async () => {
    const updatedAt = new Date("2026-09-08T12:00:00.000Z");
    query.mockResolvedValue({
      rows: [
        {
          actor_email: "admin@example.test",
          finish_date: "2026-09-08",
          next_offset: 200,
          start_date: "2026-09-01",
          updated_at: updatedAt,
        },
      ],
    });

    await expect(getAdminStatementImportProgress()).resolves.toEqual({
      actorEmail: "admin@example.test",
      finishDate: "2026-09-08",
      nextOffset: 200,
      startDate: "2026-09-01",
      updatedAt,
    });
    expect(requirePermission).toHaveBeenCalledWith("manageFinancialOperations");
  });

  it("keeps the course catalog projection bounded without loading lesson content", async () => {
    query.mockResolvedValue({
      rows: [
        {
          ...courseRow,
          lesson_count: 8,
          module_count: 2,
          total_count: 1,
        },
      ],
    });

    await expect(getAdminCourseCatalogData()).resolves.toMatchObject({
      courses: [expect.objectContaining({ id: courseId })],
      totalCount: 1,
    });

    expect(query).toHaveBeenCalledTimes(1);
    const sql = String(query.mock.calls[0]?.[0]).toLowerCase();
    expect(sql).toContain("limit $1 offset $2");
    expect(sql).not.toContain("l.content_json");
    expect(sql).not.toContain("select l.*");
    expect(sql).toContain("current_publications");
    expect(requirePermission).toHaveBeenCalledWith("manageContent");
  });

  it("loads only the read models needed by the selected course tab", async () => {
    query.mockImplementation((sql: string) => {
      if (sql.includes("select m.id, m.course_id")) {
        return { rows: [moduleRow] };
      }
      if (sql.includes("select l.id, l.module_id")) {
        return { rows: [lessonRow] };
      }
      if (sql.includes("has_draft")) {
        return { rows: [{ has_draft: true, has_published: true }] };
      }
      if (sql.includes("active_enrollment_count")) {
        return {
          rows: [
            {
              active_enrollment_count: 2,
              paid_order_count: 3,
              valid_certificate_count: 1,
            },
          ],
        };
      }
      if (sql.includes("from courses")) {
        return { rows: [courseRow] };
      }
      return { rows: [] };
    });

    await expect(
      getAdminCourseTabData({ courseId, tab: "overview" })
    ).resolves.toMatchObject({
      course: { id: courseId },
      lessons: [{ id: lessonId }],
      modules: [{ id: "module-1" }],
      tab: "overview",
    });

    expect(query).toHaveBeenCalledTimes(5);
    query.mockReset();
    query.mockResolvedValue({ rows: [courseRow] });

    await expect(
      getAdminCourseTabData({ courseId, tab: "certificate" })
    ).resolves.toMatchObject({
      course: { id: courseId },
      tab: "certificate",
    });

    expect(query).toHaveBeenCalledTimes(1);
    const certificateSql = String(query.mock.calls[0]?.[0]).toLowerCase();
    expect(certificateSql).not.toContain("content_json");
    expect(certificateSql).not.toContain("from lessons");
    expect(certificateSql).not.toContain("from modules");

    query.mockReset();
    query.mockImplementation((sql: string) => {
      if (sql.includes("count(*) over()")) {
        return {
          rows: [
            {
              course_id: courseId,
              course_title: "Course one",
              email: "student@example.test",
              expires_at: new Date("2027-01-01T00:00:00.000Z"),
              id: "enrollment-1",
              last_access_at: null,
              name: "Student",
              original_expires_at: new Date("2027-01-01T00:00:00.000Z"),
              revoked_reason: null,
              starts_at: new Date("2026-01-01T00:00:00.000Z"),
              status: "active",
              total_count: 1,
              user_id: "student-1",
            },
          ],
        };
      }
      return { rows: [courseRow] };
    });

    await expect(
      getAdminCourseTabData({ courseId, tab: "students" })
    ).resolves.toMatchObject({
      course: { id: courseId },
      enrollmentsPage: { totalCount: 1 },
      tab: "students",
    });
    expect(query).toHaveBeenCalledTimes(2);

    query.mockReset();
    query.mockImplementation((sql: string) =>
      sql.includes("has_draft")
        ? { rows: [{ has_draft: false, has_published: true }] }
        : { rows: [courseRow] }
    );

    await expect(
      getAdminCourseTabData({ courseId, tab: "settings" })
    ).resolves.toMatchObject({
      course: { id: courseId },
      publicationState: { hasPublished: true },
      tab: "settings",
    });
    expect(query).toHaveBeenCalledTimes(2);
  });

  it("fails closed before reading admin dashboard data without permission", async () => {
    const denied = new Error("permission denied");
    requirePermission.mockRejectedValueOnce(denied);

    await expect(getAdminDashboardProjection()).rejects.toBe(denied);
    expect(query).not.toHaveBeenCalled();
  });

  it("pages actionable Asaas webhooks without exposing payload data", async () => {
    query.mockResolvedValue({
      rows: [
        {
          attempt_count: 2,
          created_at: new Date("2026-09-08T12:00:00.000Z"),
          error_message: "delivery failed",
          event_key: "event-21",
          event_name: "PAYMENT_RECEIVED",
          id: "webhook-21",
          next_attempt_at: null,
          status: "failed",
          total_count: 21,
        },
      ],
    });

    await expect(
      getAdminWebhookEvents({ page: 2, search: "PAYMENT" })
    ).resolves.toMatchObject({
      events: [
        expect.objectContaining({
          attemptCount: 2,
          eventKey: "event-21",
          status: "failed",
        }),
      ],
      hasNextPage: false,
      page: 2,
      search: "PAYMENT",
      totalCount: 21,
    });

    expect(requirePermission).toHaveBeenCalledWith("viewGlobalAudit");
    expect(query.mock.calls[0]?.[1]).toEqual(["PAYMENT", "%PAYMENT%", 21, 20]);
    expect(String(query.mock.calls[0]?.[0])).not.toContain("payload");
  });

  it("pages audit events without exposing actor or student emails", async () => {
    query.mockResolvedValue({
      rows: [
        {
          action: "course.updated",
          actor_email: "admin@example.test",
          actor_name: "Administradora",
          actor_role: "admin",
          created_at: new Date("2026-09-08T12:00:00.000Z"),
          event_id: "audit-21",
          source: "administrative",
          target_id: "course-1",
          target_name: "Curso de exemplo",
          target_type: "course",
          total_count: 26,
        },
      ],
    });

    await expect(
      getAdminAuditData({
        from: "2026-09-01",
        page: 2,
        search: "course",
        source: "administrative",
        targetType: "course",
        to: "2026-09-08",
      })
    ).resolves.toMatchObject({
      auditLogs: [
        expect.objectContaining({
          actorEmail: "admin@example.test",
          actorName: "Administradora",
          action: "course.updated",
          source: "administrative",
        }),
      ],
      page: 2,
      totalCount: 26,
    });

    expect(query.mock.calls[0]?.[1]).toEqual([
      "administrative",
      "course",
      "%course%",
      "2026-09-01",
      "2026-09-08",
      26,
      25,
    ]);
    expect(String(query.mock.calls[0]?.[0])).toContain(
      "u.email as actor_email"
    );
    expect(String(query.mock.calls[0]?.[0])).not.toContain("student.email");
  });

  it("bounds the student projection and returns pagination metadata", async () => {
    query.mockImplementation((sql: string) => {
      if (sql.includes("total_students")) {
        return {
          rows: [
            {
              active_students: 1,
              expiring_soon_students: 0,
              total_students: 1,
              without_active_access_students: 0,
            },
          ],
        };
      }
      if (sql.includes("from profiles")) {
        return {
          rows: [
            {
              active_enrollment_count: 1,
              email: "student@example.test",
              last_access_at: null,
              name: "Student",
              next_expiration: new Date("2026-12-01T00:00:00.000Z"),
              platform_blocked_at: null,
              platform_blocked_reason: null,
              total_count: 3,
              user_id: "student-1",
            },
          ],
        };
      }
      return { rows: [] };
    });

    await expect(
      getAdminStudentsData({ search: "student", page: 2 })
    ).resolves.toMatchObject({
      hasNextPage: false,
      page: 2,
      pageSize: 50,
      search: "student",
      totalCount: 3,
    });

    const profileCall = query.mock.calls.find(([sql]) =>
      String(sql).includes("from profiles")
    );
    expect(String(profileCall?.[0])).toContain("limit $3");
    expect(String(profileCall?.[0])).toContain("offset $4");
    expect(String(profileCall?.[0])).toContain("left join lateral");
    expect(String(profileCall?.[0])).toContain("course_publications");
    expect(profileCall?.[1]).toEqual(["student", "%student%", 51, 50]);
    const accessSummaryCall = query.mock.calls.find(([sql]) =>
      String(sql).includes("total_students")
    );
    const accessSummarySql = String(accessSummaryCall?.[0]).toLowerCase();
    expect(accessSummarySql).toContain("min(e.expires_at)");
    expect(accessSummarySql).toContain("as next_expiration");
    expect(requirePermission).toHaveBeenCalledWith("manageEnrollmentAccess");
  });

  it("applies the student access filter to the bounded profile projection", async () => {
    query.mockImplementation((sql: string) => {
      if (sql.includes("total_students")) {
        return {
          rows: [
            {
              active_students: 1,
              expiring_soon_students: 0,
              total_students: 1,
              without_active_access_students: 0,
            },
          ],
        };
      }
      if (sql.includes("from profiles")) {
        return {
          rows: [
            {
              active_enrollment_count: 0,
              email: "blocked@example.test",
              last_access_at: null,
              name: "Blocked Student",
              next_expiration: null,
              platform_blocked_at: new Date("2026-09-01T00:00:00.000Z"),
              platform_blocked_reason: "support",
              total_count: 1,
              user_id: "student-1",
            },
          ],
        };
      }
      return { rows: [] };
    });

    await expect(
      getAdminStudentsData({ access: "blocked" })
    ).resolves.toMatchObject({
      students: [{ status: "blocked" }],
      totalCount: 1,
    });

    const profileCall = query.mock.calls.find(([sql]) =>
      String(sql).includes("from profiles")
    );
    expect(profileCall?.[1]).toEqual(["", "%%", "blocked", 51, 0]);
    expect(String(profileCall?.[0])).toContain("$3::text = 'blocked'");
  });

  it("applies the enrollment status filter to the course student projection", async () => {
    query.mockImplementation((sql: string) => {
      if (sql.includes("count(*) over()")) {
        return {
          rows: [
            {
              course_id: courseId,
              course_title: "Course one",
              email: "student@example.test",
              expires_at: new Date("2026-12-01T00:00:00.000Z"),
              id: "enrollment-1",
              last_access_at: null,
              name: "Student",
              original_expires_at: new Date("2026-12-01T00:00:00.000Z"),
              revoked_reason: "manual",
              starts_at: new Date("2026-01-01T00:00:00.000Z"),
              status: "revoked",
              total_count: 1,
              user_id: "student-1",
            },
          ],
        };
      }
      return { rows: [courseRow] };
    });

    await expect(
      getAdminCourseTabData({
        courseId,
        enrollmentQuery: { status: "revoked" },
        tab: "students",
      })
    ).resolves.toMatchObject({
      enrollmentsPage: { totalCount: 1 },
      tab: "students",
    });

    const enrollmentCall = query.mock.calls.find(([sql]) =>
      String(sql).includes("count(*) over()")
    );
    expect(enrollmentCall?.[1]).toEqual([courseId, "", "%%", "revoked", 51, 0]);
    expect(String(enrollmentCall?.[0])).toContain("e.status::text = $4::text");
  });

  it("applies the selected student filter to the course projection", async () => {
    query.mockImplementation((sql: string) => {
      if (sql.includes("count(*) over()")) {
        return {
          rows: [
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
              total_count: 1,
              user_id: "student-1",
            },
          ],
        };
      }
      return { rows: [courseRow] };
    });

    await expect(
      getAdminCourseTabData({
        courseId,
        enrollmentQuery: { studentId: "student-1" },
        tab: "students",
      })
    ).resolves.toMatchObject({
      enrollmentsPage: { totalCount: 1 },
      tab: "students",
    });

    const enrollmentCall = query.mock.calls.find(([sql]) =>
      String(sql).includes("count(*) over()")
    );
    expect(enrollmentCall?.[1]).toEqual([
      courseId,
      "",
      "%%",
      "student-1",
      51,
      0,
    ]);
    expect(String(enrollmentCall?.[0])).toContain("e.user_id = $4::text");
  });

  it("projects buyer identity payment reviews with their order in the financial read", async () => {
    query.mockImplementation((sql: string) => {
      if (
        sql.includes("from payment_reviews") &&
        sql.includes("pr.status = 'pending'")
      ) {
        return {
          rows: [
            {
              amount_in_cents: 12_990,
              course_title: "Course one",
              created_at: new Date("2026-09-08T12:00:00.000Z"),
              customer_email: "student@example.test",
              customer_name: "Student",
              decision_reason: null,
              id: "review-1",
              order_id: "order-1",
              order_status: "pending",
              paid_amount_in_cents: null,
              provider_checkout_id: "chk-1",
              provider_payment_id: "pay-1",
              provider_payment_status: "PENDING",
              reason: "buyer_identity_team_account",
              resolved_at: null,
              resolved_by_email: null,
              status: "pending",
              total_count: 1,
              type: "buyer_identity",
            },
          ],
        };
      }
      return { rows: [] };
    });

    const data = await getAdminFinancialOverviewData();

    expect(data.paymentReviews).toEqual({
      hasNextPage: false,
      history: [],
      historyTotalCount: 0,
      page: 1,
      pageSize: 20,
      reviews: [
        {
          amountInCents: 12_990,
          courseTitle: "Course one",
          createdAt: new Date("2026-09-08T12:00:00.000Z"),
          customerEmail: "student@example.test",
          customerName: "Student",
          id: "review-1",
          orderId: "order-1",
          orderStatus: "pending",
          paidAmountInCents: null,
          providerCheckoutId: "chk-1",
          providerPaymentId: "pay-1",
          providerPaymentStatus: "PENDING",
          reason: "buyer_identity_team_account",
          status: "pending",
          type: "buyer_identity",
        },
      ],
      totalCount: 1,
    });
    expect(requirePermission).toHaveBeenCalledWith("viewFinancials");
    const reviewSql = String(
      query.mock.calls.find(([sql]) =>
        String(sql).includes("from payment_reviews pr")
      )?.[0]
    );
    expect(reviewSql).toContain("pr.type");
    expect(reviewSql).toContain("join orders o on o.id = pr.order_id");
    expect(reviewSql).toContain("pr.status = 'pending'");
    expect(reviewSql).toContain("order by pr.created_at asc");
  });

  it("returns the latest resolved payment reviews as separate history", async () => {
    const resolvedAt = new Date("2026-09-08T13:00:00.000Z");
    query.mockImplementation((sql: string) => {
      if (
        sql.includes("from payment_reviews") &&
        sql.includes("pr.status <> 'pending'")
      ) {
        return {
          rows: [
            {
              amount_in_cents: 12_990,
              course_title: "Course one",
              created_at: new Date("2026-09-08T12:00:00.000Z"),
              customer_email: "student@example.test",
              customer_name: "Student",
              decision_reason: "Valor conferido no Asaas.",
              id: "review-1",
              order_id: "order-1",
              order_status: "paid",
              paid_amount_in_cents: 12_990,
              provider_checkout_id: "chk-1",
              provider_payment_id: "pay-1",
              provider_payment_status: "RECEIVED",
              reason: "amount_mismatch",
              resolved_at: resolvedAt,
              resolved_by_email: "admin@example.test",
              status: "approved",
              total_count: 1,
              type: "amount_mismatch",
            },
          ],
        };
      }
      return { rows: [] };
    });

    const data = await getAdminFinancialOverviewData();

    expect(data.paymentReviews.history).toEqual([
      {
        amountInCents: 12_990,
        courseTitle: "Course one",
        createdAt: new Date("2026-09-08T12:00:00.000Z"),
        customerEmail: "student@example.test",
        customerName: "Student",
        decisionReason: "Valor conferido no Asaas.",
        id: "review-1",
        orderId: "order-1",
        orderStatus: "paid",
        paidAmountInCents: 12_990,
        providerCheckoutId: "chk-1",
        providerPaymentId: "pay-1",
        providerPaymentStatus: "RECEIVED",
        reason: "amount_mismatch",
        resolvedAt,
        resolvedByEmail: "admin@example.test",
        status: "approved",
        type: "amount_mismatch",
      },
    ]);
    expect(data.paymentReviews.historyTotalCount).toBe(1);
  });

  it("projects course revenue without a second pagination model", async () => {
    query.mockImplementation((sql: string) => {
      if (sql.includes("from courses c")) {
        return {
          rows: [
            {
              course_id: courseId,
              course_title: "Course one",
              paid_orders: 4,
              total_orders: 5,
              total_revenue_in_cents: 51_600,
            },
          ],
        };
      }

      return { rows: [] };
    });

    const data = await getAdminFinancialOverviewData({ page: 3, pageSize: 5 });

    expect(data.coursesRevenue).toEqual({
      courses: [
        {
          courseId,
          courseTitle: "Course one",
          paidOrders: 4,
          totalOrders: 5,
          totalRevenueInCents: 51_600,
        },
      ],
    });

    const revenueCall = query.mock.calls.find(([sql]) =>
      String(sql).includes("from courses c")
    );
    expect(revenueCall?.[1]).toBeUndefined();
    expect(String(revenueCall?.[0])).toContain("group by c.id, c.title");
    expect(String(revenueCall?.[0])).toContain(
      "coalesce(o.paid_amount_in_cents, o.amount_in_cents)"
    );
    expect(requirePermission).toHaveBeenCalledWith("viewFinancials");
  });

  it("reads individual installment evidence only for the requested Asaas order", async () => {
    query.mockResolvedValue({
      rows: [
        {
          anticipated: false,
          client_payment_date: "2026-09-01",
          due_date: "2026-09-01",
          fee_amount_in_cents: 100,
          installment_number: 1,
          net_value_in_cents: 4900,
          payment_date: "2026-09-01",
          provider_payment_id: "pay-1",
          status: "RECEIVED",
          value_in_cents: 5000,
        },
      ],
    });

    await expect(getAdminInstallmentPayments("order-1")).resolves.toEqual([
      {
        anticipated: false,
        clientPaymentDate: "2026-09-01",
        dueDate: "2026-09-01",
        feeAmountInCents: 100,
        installmentNumber: 1,
        netValueInCents: 4900,
        paymentDate: "2026-09-01",
        providerPaymentId: "pay-1",
        status: "RECEIVED",
        valueInCents: 5000,
      },
    ]);

    expect(requirePermission).toHaveBeenCalledWith("viewFinancials");
    expect(query.mock.calls[0]?.[1]).toEqual(["order-1"]);
    expect(String(query.mock.calls[0]?.[0])).toContain(
      "from asaas_installment_payments ip"
    );
    expect(String(query.mock.calls[0]?.[0])).toContain("o.provider = 'asaas'");
  });

  it("uses one lookahead order to expose financial pagination truthfully", async () => {
    query.mockImplementation((sql: string) => {
      if (sql.includes("from orders o")) {
        return {
          rows: Array.from({ length: 21 }, (_, index) => ({
            amount_in_cents: 10_000,
            checkout_attempt_count: 1,
            checkout_error_message: null,
            checkout_last_attempt_at: new Date("2026-09-07T11:55:00.000Z"),
            checkout_next_attempt_at: null,
            checkout_status: "active",
            course_id: courseId,
            course_title: "Course one",
            created_at: new Date("2026-09-07T12:00:00.000Z"),
            customer_email: "student@example.test",
            customer_name: `Student ${index + 1}`,
            fee_amount_in_cents: 0,
            id: `order-${index + 1}`,
            net_amount_in_cents: 10_000,
            payment_installment_count: null,
            paid_at: new Date("2026-09-07T12:00:00.000Z"),
            paid_amount_in_cents: 10_000,
            payment_method: "PIX",
            provider_checkout_id: `checkout-${index + 1}`,
            provider_installment_id: null,
            provider_payment_id: `payment-${index + 1}`,
            provider_payment_status: "RECEIVED",
            provider_refund_created_at: null,
            provider_refund_end_to_end_id: null,
            provider_refund_receipt_url: null,
            provider_refund_status: null,
            provider_risk_status: null,
            refund_confirmed_at: null,
            refund_error_code: null,
            refund_request_created_at: null,
            refund_request_status: null,
            provider_refunded_amount_in_cents: null,
            status: "paid",
            total_count: 21,
          })),
        };
      }

      return { rows: [] };
    });

    const data = await getAdminFinancialOrdersData({ page: 1 });

    expect(data.orders).toHaveLength(20);
    expect(data.ordersHasNextPage).toBe(true);
    expect(data.ordersTotalCount).toBe(21);
    expect(data.orders[0]).toMatchObject({
      checkoutAttemptCount: 1,
      checkoutErrorMessage: null,
      providerRiskStatus: null,
      refundRequestStatus: null,
    });
    const orderCall = query.mock.calls.find(([sql]) =>
      String(sql).includes("from orders o")
    );
    expect(orderCall?.[1]).toEqual([21, 0]);
    expect(String(orderCall?.[0])).toContain(
      "order by o.created_at desc, o.id desc"
    );
  });

  it("includes the buyer name when filtering financial orders", async () => {
    query.mockImplementation((sql: string) => {
      if (sql.includes("from orders o")) {
        return { rows: [] };
      }

      return { rows: [] };
    });

    await getAdminFinancialOrdersData({ page: 1, search: "Student" });

    const orderCall = query.mock.calls.find(([sql]) =>
      String(sql).includes("from orders o")
    );
    expect(orderCall?.[1]).toEqual(["%Student%", 21, 0]);
    expect(String(orderCall?.[0])).toContain("o.customer_name ilike");
  });

  it("applies status and payment method filters before paginating orders", async () => {
    query.mockImplementation((sql: string) => {
      if (sql.includes("from orders o")) {
        return { rows: [] };
      }

      return { rows: [] };
    });

    await getAdminFinancialOrdersData({
      checkout: "open",
      page: 2,
      paymentMethod: "CREDIT_CARD",
      status: "pending",
    });

    const orderCall = query.mock.calls.find(([sql]) =>
      String(sql).includes("from orders o")
    );
    expect(orderCall?.[1]).toEqual(["pending", "CREDIT_CARD", 21, 20]);
    expect(String(orderCall?.[0])).toContain("o.status = $1");
    expect(String(orderCall?.[0])).toContain("upper(o.payment_method) = $2");
    expect(String(orderCall?.[0])).toContain(
      "o.checkout_status not in ('failed', 'cancelled', 'expired')"
    );
  });

  it("keeps blank payment methods in the unknown bucket, not the other bucket", async () => {
    query.mockImplementation((sql: string) => {
      if (sql.includes("from orders o")) {
        return { rows: [] };
      }
      return { rows: [] };
    });

    await getAdminFinancialOrdersData({ paymentMethod: "OTHER" });

    const orderCall = query.mock.calls.find(([sql]) =>
      String(sql).includes("from orders o")
    );
    expect(String(orderCall?.[0])).toContain("btrim(o.payment_method) <> ''");
  });

  it.each([
    "future_review_type",
    null,
    42,
  ])("fails closed when payment review type drifts to %s", async (type) => {
    query.mockImplementation((sql: string) => {
      if (sql.includes("pr.status <> 'pending'")) {
        return { rows: [] };
      }
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

    await expect(getAdminFinancialOverviewData()).rejects.toThrow(
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
    expect(sql).toContain("from enrollments e");
    expect(sql).toContain("e.status = 'active'");
    expect(sql).toContain("e.starts_at <= now()");
    expect(sql).toContain("e.expires_at >= now()");
    expect(sql).toContain("c.status = 'active'");
    expect(sql).toContain("cp.status = 'published'");
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
          total_count: 1,
          user_id: "user-1",
        },
      ],
    ];
    query.mockImplementation((sql: string, values: unknown[]) => {
      if (sql.includes("count(*) over()")) {
        expect(values).toEqual([courseId, "", "%%", 51, 0]);
      } else {
        expect(values).toEqual([courseId]);
      }
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
      enrollmentsPage: {
        hasNextPage: false,
        page: 1,
        pageSize: 50,
        search: "",
        totalCount: 1,
      },
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

  it("uses the bounded course-health projection for the dashboard", async () => {
    query.mockImplementation((sql: string) => {
      if (sql.includes("course_health as")) {
        return {
          rows: [
            {
              active_courses: 1,
              attention_count: 1,
              average_readiness_percent: 75,
              draft_courses: 0,
              has_description: true,
              has_published_publication: true,
              has_thumbnail: true,
              id: courseId,
              module_count: 2,
              published_lesson_count: 3,
              readiness_percent: 75,
              status: "active",
              title: "Course one",
              total_lesson_count: 4,
            },
          ],
        };
      }

      return { rows: [] };
    });

    await expect(getAdminDashboardProjection()).resolves.toEqual({
      courseHealth: {
        activeCourses: 1,
        averageReadinessPercent: 75,
        coursesNeedingAttention: [
          {
            actionTab: "content",
            hasDescription: true,
            hasPublishedPublication: true,
            hasThumbnail: true,
            id: courseId,
            moduleCount: 2,
            publishedLessonCount: 3,
            readinessPercent: 75,
            status: "active",
            title: "Course one",
            totalLessonCount: 4,
          },
        ],
        coursesNeedingAttentionCount: 1,
        draftCourses: 0,
        salesPausedCourses: 0,
      },
      operations: {
        access: {
          expiringEnrollmentCount: 0,
          expiringStudentCount: 0,
        },
        certificates: {
          pending: [],
          pendingCount: 0,
        },
        financial: {
          disputedOrderCount: 0,
          failedRefundCount: 0,
          pendingPaymentReviewCount: 0,
          pendingRefundCount: 0,
          pendingRevenueInCents: 0,
          refundedOrderCount: 0,
          uncertainCheckoutCount: 0,
          uncertainRefundCount: 0,
          uncorrelatedOrderCount: 0,
        },
        integrations: {
          backlog: {
            alerts: [],
            emailDelivery: {
              accepted: 0,
              bounced: 0,
              complained: 0,
              deadLetters: 0,
              delivered: 0,
              oldestRetryAt: null,
              retrying: 0,
            },
            outbox: {
              deadLetters: 0,
              oldestReadyAt: null,
              ready: 0,
              superseded: 0,
            },
            payments: {
              uncertainCheckouts: 0,
              uncertainRefunds: 0,
              uncorrelatedOrders: 0,
            },
            videos: {
              oldestPendingAt: null,
              pending: 0,
            },
            webhooks: {
              failed: 0,
              oldestFailedAt: null,
              oldestReadyAt: null,
              oldestRetryAt: null,
              ready: 0,
              retryable: 0,
            },
          },
          failedJmvDeleteCount: 0,
          failedJmvUploadCount: 0,
          pendingJmvDeleteCount: 0,
          processingJmvUploadCount: 0,
        },
        supportRequests: {
          deliveredCount: 0,
          failedCount: 0,
          pendingCount: 0,
          recent: [],
          sentCount: 0,
          totalCount: 0,
        },
      },
      recentCertificates: [],
      recentOrders: [],
    });

    expect(requirePermission).toHaveBeenCalledWith("manageContent");
    expect(requirePermission).toHaveBeenCalledWith("viewFinancials");
    expect(requirePermission).toHaveBeenCalledWith("viewGlobalAudit");
    expect(query).toHaveBeenCalledTimes(9);
    const dashboardSql = String(
      query.mock.calls.find(([sql]) =>
        String(sql).includes("course_health as")
      )?.[0]
    ).toLowerCase();
    expect(dashboardSql).not.toContain("content_json");
    expect(dashboardSql).not.toContain("select l.*");
    expect(dashboardSql).not.toContain("select m.*");
    expect(dashboardSql).not.toContain("from orders");
    expect(dashboardSql).not.toContain("revenue");
    expect(dashboardSql).toContain("has_published_publication");
  });

  it("projects daily operational queues with source-specific semantics", async () => {
    const completedAt = new Date("2026-09-01T12:00:00.000Z");
    const issuedAt = new Date("2026-09-08T12:00:00.000Z");
    query.mockImplementation((sql: string) => {
      if (sql.includes("course_health as")) {
        return {
          rows: [
            {
              active_courses: 1,
              attention_count: 0,
              average_readiness_percent: 100,
              draft_courses: 0,
              has_description: true,
              has_published_publication: true,
              has_thumbnail: true,
              id: courseId,
              module_count: 1,
              published_lesson_count: 1,
              readiness_percent: 100,
              status: "active",
              title: "Course one",
              total_lesson_count: 1,
            },
          ],
        };
      }
      if (sql.includes("order by o.created_at desc")) {
        return {
          rows: [
            {
              amount_in_cents: 12_900,
              checkout_status: "active",
              course_title: "Course one",
              created_at: issuedAt,
              customer_email: "student@example.test",
              customer_name: "Student",
              id: "order-1",
              paid_amount_in_cents: 12_900,
              status: "paid",
            },
          ],
        };
      }
      if (sql.includes("course_title_snapshot") && sql.includes("limit 5")) {
        return {
          rows: [
            {
              code: "CERT-1",
              course_title_snapshot: "Course one",
              issued_at: issuedAt,
              status: "valid",
              student_name_snapshot: "Student",
            },
          ],
        };
      }
      if (sql.includes("expiring_enrollments")) {
        return {
          rows: [
            {
              expiring_enrollments: 4,
              expiring_students: 3,
            },
          ],
        };
      }
      if (sql.includes("pending_payment_reviews")) {
        return {
          rows: [
            {
              disputed_orders: 2,
              failed_refunds: 1,
              pending_payment_reviews: 3,
              pending_refunds: 4,
              pending_revenue_in_cents: "45000",
              refunded_orders: 5,
            },
          ],
        };
      }
      if (sql.includes("eligible_completions")) {
        return {
          rows: [
            {
              completed_at: completedAt,
              course_id: courseId,
              course_title: "Course one",
              student_name: "Student",
              total_count: 7,
            },
          ],
        };
      }
      if (
        sql.includes("from jmvstream_video_assets") &&
        !sql.includes("outbox_ready")
      ) {
        return {
          rows: [
            {
              failed_deletes: 1,
              failed_uploads: 2,
              pending_deletes: 3,
              processing_uploads: 4,
            },
          ],
        };
      }
      if (sql.includes("support_delivery")) {
        return {
          rows: [
            {
              course_title: "Course one",
              created_at: completedAt,
              delivered_count: 2,
              delivery_state: "delayed",
              failed_count: 1,
              id: "support-1",
              pending_count: 3,
              sent_count: 1,
              student_name: "Student",
              subject: "Preciso de ajuda",
              total_count: 6,
            },
          ],
        };
      }
      if (sql.includes("outbox_ready")) {
        return {
          rows: [
            {
              dead_letters: "2",
              email_accepted: "3",
              email_bounced: "1",
              email_complained: "0",
              email_delivered: "4",
              email_webhook_dead_letters: "1",
              email_webhook_oldest_retry_at: null,
              email_webhook_retrying: "2",
              oldest_outbox_at: null,
              oldest_video_at: null,
              oldest_webhook_failed_at: null,
              oldest_webhook_ready_at: null,
              oldest_webhook_retry_at: null,
              outbox_ready: "5",
              outbox_superseded: "0",
              uncertain_checkouts: "6",
              uncertain_refunds: "7",
              uncorrelated_orders: "8",
              videos_pending: "9",
              webhooks_failed: "10",
              webhooks_ready: "11",
              webhooks_retryable: "12",
            },
          ],
        };
      }
      return { rows: [] };
    });

    const data = await getAdminDashboardProjection();

    expect(data.operations).toMatchObject({
      access: {
        expiringEnrollmentCount: 4,
        expiringStudentCount: 3,
      },
      certificates: {
        pending: [
          {
            completedAt,
            courseId,
            courseTitle: "Course one",
            studentName: "Student",
          },
        ],
        pendingCount: 7,
      },
      financial: {
        disputedOrderCount: 2,
        failedRefundCount: 1,
        pendingPaymentReviewCount: 3,
        pendingRefundCount: 4,
        pendingRevenueInCents: 45_000,
        refundedOrderCount: 5,
        uncertainCheckoutCount: 6,
        uncertainRefundCount: 7,
        uncorrelatedOrderCount: 8,
      },
      integrations: {
        failedJmvDeleteCount: 1,
        failedJmvUploadCount: 2,
        pendingJmvDeleteCount: 3,
        processingJmvUploadCount: 4,
      },
      supportRequests: {
        deliveredCount: 2,
        failedCount: 1,
        pendingCount: 3,
        recent: [
          {
            courseTitle: "Course one",
            createdAt: completedAt,
            deliveryState: "delayed",
            id: "support-1",
            studentName: "Student",
            subject: "Preciso de ajuda",
          },
        ],
        sentCount: 1,
        totalCount: 6,
      },
    });
    expect(data.recentCertificates).toEqual([
      {
        code: "CERT-1",
        courseTitle: "Course one",
        issuedAt,
        status: "valid",
        studentName: "Student",
      },
    ]);
    expect(
      String(
        query.mock.calls.find(([sql]) =>
          String(sql).includes("order by o.created_at desc")
        )?.[0]
      ).toLowerCase()
    ).toContain("limit 5");
    expect(
      String(
        query.mock.calls.find(([sql]) =>
          String(sql).includes("from certificates")
        )?.[0]
      ).toLowerCase()
    ).toContain("limit 5");
    expect(data.operations.integrations.backlog.payments).toEqual({
      uncertainCheckouts: 6,
      uncertainRefunds: 7,
      uncorrelatedOrders: 8,
    });
    expect(
      String(
        query.mock.calls.find(([sql]) =>
          String(sql).includes("support_delivery")
        )?.[0]
      )
    ).toContain("email.support-request");
  });

  it("keeps the student list within the measured read budget without N+1 queries", async () => {
    const studentCount = 250;
    const enrollmentsPerStudent = 3;
    const profiles = Array.from({ length: studentCount }, (_, index) => ({
      active_enrollment_count: 1,
      email: `student-${index}@example.test`,
      last_access_at: null,
      name: `Student ${index}`,
      next_expiration: new Date("2027-01-01T00:00:00.000Z"),
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
    query.mockImplementation((sql: string) => {
      if (sql.includes("total_students")) {
        return {
          rows: [
            {
              active_students: studentCount,
              expiring_soon_students: 0,
              total_students: studentCount,
              without_active_access_students: 0,
            },
          ],
        };
      }
      return { rows: sql.includes("from profiles") ? profiles : enrollments };
    });

    const data = await getAdminStudentsData({ pageSize: studentCount });
    const payloadBytes = Buffer.byteLength(JSON.stringify(data));

    expect(query).toHaveBeenCalledTimes(3);
    expect(data.enrollments).toHaveLength(studentCount * enrollmentsPerStudent);
    expect(data.students).toHaveLength(studentCount);
    expect(data.accessSummary.totalStudents).toBe(studentCount);
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
