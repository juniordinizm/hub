import "server-only";

import type { StudentSheetPayload } from "@/components/admin/student-management-types";
import { getPool } from "@/db";
import { requirePermission } from "@/lib/auth-permissions";

const DEFAULT_PAGE_SIZE = 100;
const MAX_PAGE = 10_000;

export interface SupportCourseOperation {
  activeEnrollmentCount: number;
  id: string;
  paidOrderCount: number;
  paidRevenueInCents: number;
  refundedOrderCount: number;
  refundedRevenueInCents: number;
  status: string;
  title: string;
  totalEnrollmentCount: number;
}

export interface SupportCourseStudentSummary {
  email: string;
  enrollmentId: string;
  enrollmentStatus: string;
  expiresAt: Date;
  name: string;
  platformBlocked: boolean;
  startsAt: Date;
  userId: string;
}

export interface SupportCourseStudentsPage {
  hasNextPage: boolean;
  page: number;
  pageSize: number;
  students: SupportCourseStudentSummary[];
}

export interface SupportCourseStudentContext {
  audit: Array<{
    action: string;
    createdAt: Date;
    targetId: string | null;
    targetType: string;
  }>;
  course: { id: string; title: string };
  enrollment: {
    completedRequiredLessons: number;
    expiresAt: Date;
    id: string;
    originalExpiresAt: Date;
    requiredLessons: number;
    revokedReason: string | null;
    startsAt: Date;
    status: string;
  };
  latestCertificate: {
    code: string;
    courseId: string;
    courseTitle: string;
    id: string;
    issuedAt: Date;
    renderStatus: "failed" | "pending" | "ready";
    revokedAt: Date | null;
    revokedReasonCategory: string | null;
    status: "revoked" | "valid";
    studentName: string;
    workloadHours: number;
  } | null;
  orders: Array<{
    amountInCents: number;
    createdAt: Date;
    id: string;
    paidAmountInCents: number | null;
    refundStatus: string | null;
    refundedAmountInCents: number | null;
    status: string;
  }>;
  student: {
    email: string;
    name: string;
    platformBlocked: boolean;
    platformBlockedAt: Date | null;
    platformBlockedReason: string | null;
    userId: string;
  };
}

export const getSupportCourseOperations = async (): Promise<
  SupportCourseOperation[]
> => {
  await requirePermission("viewCourseOperations");

  const { rows } = await getPool().query<{
    active_enrollment_count: number;
    id: string;
    paid_order_count: number;
    paid_revenue_in_cents: number;
    refunded_order_count: number;
    refunded_revenue_in_cents: number;
    status: string;
    title: string;
    total_enrollment_count: number;
  }>(`
    select
      c.id,
      c.title,
      c.status,
      enrollment_stats.total_enrollment_count,
      enrollment_stats.active_enrollment_count,
      financial_stats.paid_order_count,
      financial_stats.refunded_order_count,
      financial_stats.paid_revenue_in_cents,
      financial_stats.refunded_revenue_in_cents
    from courses c
    cross join lateral (
      select
        count(*)::int as total_enrollment_count,
        count(*) filter (where e.status = 'active')::int
          as active_enrollment_count
      from enrollments e
      where e.course_id = c.id
    ) enrollment_stats
    cross join lateral (
      select
        count(*) filter (where o.status = 'paid')::int as paid_order_count,
        count(*) filter (where o.status = 'refunded')::int
          as refunded_order_count,
        coalesce(
          sum(coalesce(o.paid_amount_in_cents, o.amount_in_cents))
            filter (where o.status = 'paid'),
          0
        )::int as paid_revenue_in_cents,
        coalesce(
          sum(
            coalesce(
              rr.provider_refunded_amount_in_cents,
              o.paid_amount_in_cents,
              o.amount_in_cents
            )
          ) filter (where o.status = 'refunded'),
          0
        )::int as refunded_revenue_in_cents
      from orders o
      left join refund_requests rr on rr.order_id = o.id
      where o.course_id = c.id
    ) financial_stats
    order by c.title asc, c.id asc
  `);

  return rows.map((row) => ({
    activeEnrollmentCount: row.active_enrollment_count,
    id: row.id,
    paidOrderCount: row.paid_order_count,
    paidRevenueInCents: row.paid_revenue_in_cents,
    refundedOrderCount: row.refunded_order_count,
    refundedRevenueInCents: row.refunded_revenue_in_cents,
    status: row.status,
    title: row.title,
    totalEnrollmentCount: row.total_enrollment_count,
  }));
};

export const getSupportCourseStudents = async (
  courseId: string,
  options: { page?: number } = {}
): Promise<SupportCourseStudentsPage> => {
  await requirePermission("viewStudentOperations");

  const requestedPage = Math.trunc(options.page ?? 1);
  const page = Number.isFinite(requestedPage)
    ? Math.min(MAX_PAGE, Math.max(1, requestedPage))
    : 1;
  const offset = (page - 1) * DEFAULT_PAGE_SIZE;
  const { rows } = await getPool().query<{
    email: string;
    enrollment_id: string;
    enrollment_status: string;
    expires_at: Date;
    name: string;
    platform_blocked: boolean;
    starts_at: Date;
    user_id: string;
  }>(
    `
      select
        u.id as user_id,
        u.name,
        u.email,
        e.id as enrollment_id,
        e.status as enrollment_status,
        e.starts_at,
        e.expires_at,
        (p.platform_blocked_at is not null) as platform_blocked
      from enrollments e
      join users u on u.id = e.user_id
      join profiles p on p.user_id = u.id and p.role = 'student'
      where e.course_id = $1
      order by u.name asc, u.id asc
      limit $2 offset $3
    `,
    [courseId, DEFAULT_PAGE_SIZE + 1, offset]
  );

  return {
    hasNextPage: rows.length > DEFAULT_PAGE_SIZE,
    page,
    pageSize: DEFAULT_PAGE_SIZE,
    students: rows.slice(0, DEFAULT_PAGE_SIZE).map((row) => ({
      email: row.email,
      enrollmentId: row.enrollment_id,
      enrollmentStatus: row.enrollment_status,
      expiresAt: row.expires_at,
      name: row.name,
      platformBlocked: row.platform_blocked,
      startsAt: row.starts_at,
      userId: row.user_id,
    })),
  };
};

export const getSupportCourseStudentContext = async ({
  courseId,
  userId,
}: {
  courseId: string;
  userId: string;
}): Promise<SupportCourseStudentContext | null> => {
  await requirePermission("viewStudentOperations");
  await requirePermission("viewScopedAudit");

  const pool = getPool();
  const contextResult = await pool.query<{
    completed_required_lessons: number;
    course_id: string;
    course_title: string;
    email: string;
    enrollment_id: string;
    enrollment_status: string;
    expires_at: Date;
    name: string;
    original_expires_at: Date;
    platform_blocked_at: Date | null;
    platform_blocked_reason: string | null;
    platform_blocked: boolean;
    required_lessons: number;
    revoked_reason: string | null;
    starts_at: Date;
    user_id: string;
  }>(
    `
      select
        c.id as course_id,
        c.title as course_title,
        u.id as user_id,
        u.name,
        u.email,
        p.platform_blocked_at,
        p.platform_blocked_reason,
        (p.platform_blocked_at is not null) as platform_blocked,
        e.id as enrollment_id,
        e.status as enrollment_status,
        e.starts_at,
        e.expires_at,
        coalesce(latest_grant.base_expires_at, e.expires_at)
          as original_expires_at,
        e.revoked_reason,
        (
          select count(*)::int
          from lessons l
          join course_publications cp on cp.id = l.course_publication_id
          where cp.course_id = c.id
            and cp.status = 'published'
            and l.is_published = true
            and l.is_required = true
        ) as required_lessons,
        (
          select count(distinct lp.lesson_id)::int
          from lesson_progress lp
          join lessons l on l.id = lp.lesson_id
          join course_publications cp on cp.id = l.course_publication_id
          where lp.user_id = u.id
            and cp.course_id = c.id
            and cp.status = 'published'
            and l.is_published = true
            and l.is_required = true
        ) as completed_required_lessons
      from enrollments e
      join courses c on c.id = e.course_id
      join users u on u.id = e.user_id
      join profiles p on p.user_id = u.id and p.role = 'student'
      left join lateral (
        select eg.base_expires_at
        from enrollment_grants eg
        where eg.user_id = e.user_id and eg.course_id = e.course_id
        order by eg.effective_expires_at desc, eg.updated_at desc
        limit 1
      ) latest_grant on true
      where e.course_id = $1 and e.user_id = $2
    `,
    [courseId, userId]
  );
  const context = contextResult.rows[0];

  if (!context) {
    return null;
  }

  const [certificateResult, orderResult, auditResult] = await Promise.all([
    pool.query<{
      code: string;
      course_id: string;
      course_title_snapshot: string;
      id: string;
      issued_at: Date;
      render_status: "failed" | "pending" | "ready";
      revoked_at: Date | null;
      revoked_reason_category: string | null;
      status: "revoked" | "valid";
      student_name_snapshot: string;
      workload_hours_snapshot: number;
    }>(
      `
        select
          id,
          code,
          course_id,
          course_title_snapshot,
          student_name_snapshot,
          workload_hours_snapshot,
          issued_at,
          revoked_at,
          revoked_reason_category,
          status,
          render_status
        from certificates
        where course_id = $1 and user_id = $2
        order by issued_at desc, id desc
        limit 1
      `,
      [courseId, userId]
    ),
    pool.query<{
      amount_in_cents: number;
      created_at: Date;
      id: string;
      paid_amount_in_cents: number | null;
      refund_status: string | null;
      refunded_amount_in_cents: number | null;
      status: string;
    }>(
      `
        select
          o.id,
          o.status,
          o.amount_in_cents,
          o.paid_amount_in_cents,
          o.created_at,
          rr.status as refund_status,
          rr.provider_refunded_amount_in_cents as refunded_amount_in_cents
        from orders o
        left join refund_requests rr on rr.order_id = o.id
        where o.course_id = $1 and o.user_id = $2
        order by o.created_at desc, o.id desc
        limit 50
      `,
      [courseId, userId]
    ),
    pool.query<{
      action: string;
      created_at: Date;
      target_id: string | null;
      target_type: string;
    }>(
      `
        select action, target_type, target_id, created_at
        from (
          select
            concat('enrollment.', ee.event_type) as action,
            'enrollment' as target_type,
            ee.enrollment_id::text as target_id,
            ee.created_at
          from enrollment_events ee
          where ee.course_id = $1 and ee.user_id = $2

          union all

          select a.action, a.target_type, a.target_id, a.created_at
          from audit_logs a
          where
            (
              a.target_type = 'enrollment'
              and exists (
                select 1 from enrollments e
                where e.id::text = a.target_id
                  and e.course_id = $1
                  and e.user_id = $2
              )
            )
            or (
              a.target_type = 'certificate'
              and exists (
                select 1 from certificates certificate
                where certificate.id::text = a.target_id
                  and certificate.course_id = $1
                  and certificate.user_id = $2
              )
            )
            or (
              a.target_type = 'order'
              and exists (
                select 1 from orders o
                where o.id::text = a.target_id
                  and o.course_id = $1
                  and o.user_id = $2
              )
            )
        ) scoped_audit
        order by created_at desc
        limit 50
      `,
      [courseId, userId]
    ),
  ]);
  const latestCertificate = certificateResult.rows[0] ?? null;

  return {
    audit: auditResult.rows.map((row) => ({
      action: row.action,
      createdAt: row.created_at,
      targetId: row.target_id,
      targetType: row.target_type,
    })),
    course: { id: context.course_id, title: context.course_title },
    enrollment: {
      completedRequiredLessons: context.completed_required_lessons,
      expiresAt: context.expires_at,
      id: context.enrollment_id,
      originalExpiresAt: context.original_expires_at,
      requiredLessons: context.required_lessons,
      revokedReason: context.revoked_reason,
      startsAt: context.starts_at,
      status: context.enrollment_status,
    },
    latestCertificate: latestCertificate
      ? {
          code: latestCertificate.code,
          courseId: latestCertificate.course_id,
          courseTitle: latestCertificate.course_title_snapshot,
          id: latestCertificate.id,
          issuedAt: latestCertificate.issued_at,
          renderStatus: latestCertificate.render_status,
          revokedAt: latestCertificate.revoked_at,
          revokedReasonCategory: latestCertificate.revoked_reason_category,
          status: latestCertificate.status,
          studentName: latestCertificate.student_name_snapshot,
          workloadHours: latestCertificate.workload_hours_snapshot,
        }
      : null,
    orders: orderResult.rows.map((row) => ({
      amountInCents: row.amount_in_cents,
      createdAt: row.created_at,
      id: row.id,
      paidAmountInCents: row.paid_amount_in_cents,
      refundStatus: row.refund_status,
      refundedAmountInCents: row.refunded_amount_in_cents,
      status: row.status,
    })),
    student: {
      email: context.email,
      name: context.name,
      platformBlocked: context.platform_blocked,
      platformBlockedAt: context.platform_blocked_at,
      platformBlockedReason: context.platform_blocked_reason,
      userId: context.user_id,
    },
  };
};

export const getSupportStudentSheetData = async ({
  courseId,
  userId,
}: {
  courseId: string;
  userId: string;
}): Promise<StudentSheetPayload | null> => {
  const context = await getSupportCourseStudentContext({ courseId, userId });
  if (!context) {
    return null;
  }
  const certificate = context.latestCertificate;
  return {
    certificates: certificate
      ? [
          {
            canReissue: true,
            code: certificate.code,
            courseId: certificate.courseId,
            courseTitle: certificate.courseTitle,
            id: certificate.id,
            issuedAt: certificate.issuedAt.toISOString(),
            renderStatus: certificate.renderStatus,
            revokedAt: certificate.revokedAt?.toISOString() ?? null,
            revokedReasonCategory: certificate.revokedReasonCategory,
            status: certificate.status,
            studentName: certificate.studentName,
            workloadHours: certificate.workloadHours,
          },
        ]
      : [],
    context: { courseId: context.course.id, courseTitle: context.course.title },
    student: {
      email: context.student.email,
      enrollments: [
        {
          courseId: context.course.id,
          courseTitle: context.course.title,
          expiresAt: context.enrollment.expiresAt.toISOString(),
          id: context.enrollment.id,
          originalExpiresAt: context.enrollment.originalExpiresAt.toISOString(),
          revokedReason: context.enrollment.revokedReason,
          startedAt: context.enrollment.startsAt.toISOString(),
          status: context.enrollment.status,
          userId: context.student.userId,
        },
      ],
      name: context.student.name,
      platformBlockedAt:
        context.student.platformBlockedAt?.toISOString() ?? null,
      platformBlockedReason: context.student.platformBlockedReason,
      userId: context.student.userId,
    },
    supportContext: {
      audit: context.audit.map((item) => ({
        ...item,
        createdAt: item.createdAt.toISOString(),
      })),
      orders: context.orders.map((order) => ({
        ...order,
        createdAt: order.createdAt.toISOString(),
      })),
      progress: {
        completedRequiredLessons: context.enrollment.completedRequiredLessons,
        requiredLessons: context.enrollment.requiredLessons,
      },
    },
  };
};
