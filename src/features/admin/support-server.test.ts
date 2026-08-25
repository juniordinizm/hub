import { beforeEach, describe, expect, it, vi } from "vitest";

const { query, requirePermission } = vi.hoisted(() => ({
  query: vi.fn(),
  requirePermission: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({ getPool: () => ({ query }) }));
vi.mock("@/lib/auth-permissions", () => ({ requirePermission }));

import {
  getSupportCourseOperations,
  getSupportCourseStudentContext,
  getSupportCourseStudents,
  getSupportStudentSheetData,
} from "./support-server";

const courseId = "00000000-0000-4000-8000-000000000001";
const userId = "student-1";

beforeEach(() => {
  query.mockReset();
  requirePermission.mockReset();
  requirePermission.mockResolvedValue({ role: "support" });
});

describe("support read projections", () => {
  it("lists operational course aggregates without loading authoring data", async () => {
    query.mockResolvedValue({
      rows: [
        {
          active_enrollment_count: 8,
          id: courseId,
          paid_order_count: 7,
          paid_revenue_in_cents: 70_000,
          refunded_order_count: 2,
          refunded_revenue_in_cents: 20_000,
          status: "active",
          title: "Curso operacional",
          total_enrollment_count: 10,
        },
      ],
    });

    await expect(getSupportCourseOperations()).resolves.toEqual([
      {
        activeEnrollmentCount: 8,
        id: courseId,
        paidOrderCount: 7,
        paidRevenueInCents: 70_000,
        refundedOrderCount: 2,
        refundedRevenueInCents: 20_000,
        status: "active",
        title: "Curso operacional",
        totalEnrollmentCount: 10,
      },
    ]);

    expect(requirePermission).toHaveBeenCalledWith("viewCourseOperations");
    const sql = String(query.mock.calls[0]?.[0]).toLowerCase();
    expect(sql).toContain("from courses c");
    expect(sql).toContain("from enrollments e");
    expect(sql).toContain("from orders o");
    expect(sql).not.toContain("content_json");
    expect(sql).not.toContain("price_in_cents");
    expect(sql).not.toContain("from modules");
    expect(sql).not.toContain("from lessons");
  });

  it("lists only students enrolled in the selected course", async () => {
    query.mockResolvedValue({
      rows: [
        {
          email: "student@example.test",
          enrollment_id: "enrollment-1",
          enrollment_status: "active",
          expires_at: new Date("2027-01-01T00:00:00Z"),
          name: "Student",
          platform_blocked: false,
          starts_at: new Date("2026-01-01T00:00:00Z"),
          user_id: userId,
        },
      ],
    });

    await expect(getSupportCourseStudents(courseId)).resolves.toMatchObject({
      hasNextPage: false,
      page: 1,
      students: [
        {
          email: "student@example.test",
          enrollmentId: "enrollment-1",
          enrollmentStatus: "active",
          name: "Student",
          platformBlocked: false,
          userId,
        },
      ],
    });

    expect(requirePermission).toHaveBeenCalledWith("viewStudentOperations");
    const [sql, parameters] = query.mock.calls[0] ?? [];
    expect(String(sql)).toContain("e.course_id = $1");
    expect(String(sql)).toContain("p.role = 'student'");
    expect(parameters).toEqual([courseId, 101, 0]);
  });

  it("returns no context without a matching course enrollment", async () => {
    query.mockResolvedValueOnce({ rows: [] });

    await expect(
      getSupportCourseStudentContext({ courseId, userId })
    ).resolves.toBeNull();

    expect(requirePermission).toHaveBeenNthCalledWith(
      1,
      "viewStudentOperations"
    );
    expect(requirePermission).toHaveBeenNthCalledWith(2, "viewScopedAudit");
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0]?.[1]).toEqual([courseId, userId]);
  });

  it("returns only course-scoped student, progress, finance, certificate and audit data", async () => {
    const startsAt = new Date("2026-01-01T00:00:00Z");
    const expiresAt = new Date("2027-01-01T00:00:00Z");
    const issuedAt = new Date("2026-06-01T00:00:00Z");
    const createdAt = new Date("2026-05-01T00:00:00Z");

    query
      .mockResolvedValueOnce({
        rows: [
          {
            completed_required_lessons: 4,
            course_id: courseId,
            course_title: "Curso operacional",
            email: "student@example.test",
            enrollment_id: "enrollment-1",
            enrollment_status: "active",
            expires_at: expiresAt,
            name: "Student",
            platform_blocked: false,
            required_lessons: 6,
            revoked_reason: null,
            starts_at: startsAt,
            user_id: userId,
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            code: "CERT-1",
            id: "certificate-1",
            issued_at: issuedAt,
            status: "valid",
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            amount_in_cents: 10_000,
            created_at: createdAt,
            id: "order-1",
            paid_amount_in_cents: 10_000,
            refund_status: "confirmed",
            refunded_amount_in_cents: 10_000,
            status: "refunded",
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            action: "enrollment.expiration_extended",
            created_at: createdAt,
            target_id: "enrollment-1",
            target_type: "enrollment",
          },
        ],
      });

    const context = await getSupportCourseStudentContext({ courseId, userId });

    expect(context).toEqual({
      audit: [
        {
          action: "enrollment.expiration_extended",
          createdAt,
          targetId: "enrollment-1",
          targetType: "enrollment",
        },
      ],
      course: { id: courseId, title: "Curso operacional" },
      enrollment: {
        completedRequiredLessons: 4,
        expiresAt,
        id: "enrollment-1",
        requiredLessons: 6,
        revokedReason: null,
        startsAt,
        status: "active",
      },
      latestCertificate: {
        code: "CERT-1",
        id: "certificate-1",
        issuedAt,
        status: "valid",
      },
      orders: [
        {
          amountInCents: 10_000,
          createdAt,
          id: "order-1",
          paidAmountInCents: 10_000,
          refundStatus: "confirmed",
          refundedAmountInCents: 10_000,
          status: "refunded",
        },
      ],
      student: {
        email: "student@example.test",
        name: "Student",
        platformBlocked: false,
        userId,
      },
    });

    const [contextCall, certificateCall, orderCall, auditCall] =
      query.mock.calls;
    expect(contextCall?.[1]).toEqual([courseId, userId]);
    expect(certificateCall?.[1]).toEqual([courseId, userId]);
    expect(orderCall?.[1]).toEqual([courseId, userId]);
    expect(auditCall?.[1]).toEqual([courseId, userId]);
    expect(String(auditCall?.[0])).toContain("ee.user_id = $2");
    expect(String(auditCall?.[0])).toContain("ee.course_id = $1");
  });

  it("builds the management sheet from one course enrollment and only its latest certificate", async () => {
    const startsAt = new Date("2026-01-01T00:00:00Z");
    const expiresAt = new Date("2027-01-01T00:00:00Z");
    const originalExpiresAt = new Date("2026-12-01T00:00:00Z");
    const issuedAt = new Date("2026-06-01T00:00:00Z");

    query
      .mockResolvedValueOnce({
        rows: [
          {
            completed_required_lessons: 4,
            course_id: courseId,
            course_title: "Curso operacional",
            email: "student@example.test",
            enrollment_id: "enrollment-1",
            enrollment_status: "active",
            expires_at: expiresAt,
            name: "Student",
            original_expires_at: originalExpiresAt,
            platform_blocked_at: null,
            platform_blocked_reason: null,
            platform_blocked: false,
            required_lessons: 6,
            revoked_reason: null,
            starts_at: startsAt,
            user_id: userId,
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            code: "CERT-1",
            course_id: courseId,
            course_title_snapshot: "Curso operacional",
            id: "certificate-1",
            issued_at: issuedAt,
            render_status: "ready",
            revoked_at: null,
            revoked_reason_category: null,
            status: "valid",
            student_name_snapshot: "Student",
            workload_hours_snapshot: 20,
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            amount_in_cents: 10_000,
            created_at: new Date("2026-05-01T00:00:00Z"),
            id: "order-1",
            paid_amount_in_cents: 10_000,
            refund_status: null,
            refunded_amount_in_cents: null,
            status: "paid",
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            action: "enrollment.expiration_extended",
            created_at: new Date("2026-05-02T00:00:00Z"),
            target_id: "enrollment-1",
            target_type: "enrollment",
          },
        ],
      });

    await expect(
      getSupportStudentSheetData({ courseId, userId })
    ).resolves.toEqual({
      certificates: [
        {
          canReissue: true,
          code: "CERT-1",
          courseId,
          courseTitle: "Curso operacional",
          id: "certificate-1",
          issuedAt: issuedAt.toISOString(),
          renderStatus: "ready",
          revokedAt: null,
          revokedReasonCategory: null,
          status: "valid",
          studentName: "Student",
          workloadHours: 20,
        },
      ],
      context: { courseId, courseTitle: "Curso operacional" },
      student: {
        email: "student@example.test",
        enrollments: [
          {
            courseId,
            courseTitle: "Curso operacional",
            expiresAt: expiresAt.toISOString(),
            id: "enrollment-1",
            originalExpiresAt: originalExpiresAt.toISOString(),
            revokedReason: null,
            startedAt: startsAt.toISOString(),
            status: "active",
            userId,
          },
        ],
        name: "Student",
        platformBlockedAt: null,
        platformBlockedReason: null,
        userId,
      },
      supportContext: {
        audit: [
          {
            action: "enrollment.expiration_extended",
            createdAt: "2026-05-02T00:00:00.000Z",
            targetId: "enrollment-1",
            targetType: "enrollment",
          },
        ],
        orders: [
          {
            amountInCents: 10_000,
            createdAt: "2026-05-01T00:00:00.000Z",
            id: "order-1",
            paidAmountInCents: 10_000,
            refundStatus: null,
            refundedAmountInCents: null,
            status: "paid",
          },
        ],
        progress: { completedRequiredLessons: 4, requiredLessons: 6 },
      },
    });

    expect(query).toHaveBeenCalledTimes(4);
    expect(query.mock.calls[0]?.[1]).toEqual([courseId, userId]);
    expect(query.mock.calls[1]?.[1]).toEqual([courseId, userId]);
    expect(String(query.mock.calls[0]?.[0])).toContain(
      "where e.course_id = $1 and e.user_id = $2"
    );
    expect(String(query.mock.calls[1]?.[0])).toContain(
      "where course_id = $1 and user_id = $2"
    );
    expect(String(query.mock.calls[1]?.[0])).toContain("limit 1");
  });
});
