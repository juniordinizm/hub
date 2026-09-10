import "server-only";
import { getPool } from "@/db";
import {
  type AdminStudentSummary,
  summarizeAdminStudents,
} from "@/features/admin/students";
import {
  type CertificateOperationRecord,
  getCertificateOperationsForUser,
} from "@/features/certificates/server";
import { CONTENT_RELEASE_NEXT_MODULE_LATERAL_SQL } from "@/features/courses/content-release-sql";
import type { ContentReleaseMode } from "@/features/courses/module-content-release";
import { getJmvstreamAssetsForLesson } from "@/features/jmvstream/server";
import {
  getOperationalBacklogSnapshot,
  type OperationalBacklogSnapshot,
} from "@/features/operations/server";
import {
  listOutboxDeadLetters,
  type OutboxDeadLetterPage,
} from "@/features/outbox/server";
import { requirePermission } from "@/lib/auth-permissions";
import type { AdminFinancialPeriod } from "./financial-period";
import {
  getAdminFinancialPeriodLabel,
  getAdminFinancialPeriodStart,
} from "./financial-period";
import type {
  AdminOrderCheckoutFilter,
  AdminOrderPaymentMethodFilter,
  AdminOrderStatusFilter,
} from "./order-filters";
import type {
  AdminFinancialHealthSummary,
  AdminStudentAccessSummary,
} from "./presentation";

export interface AdminOverview {
  activeEnrollments: number;
  courses: number;
  failedWebhooks: number;
  paidOrders: number;
  paidRevenueInCents: number;
  pendingOrders: number;
  retryableWebhooks: number;
  students: number;
}

export interface AdminDashboardCourseHealth {
  actionTab: "content" | "settings";
  hasDescription: boolean;
  hasPublishedPublication: boolean;
  hasThumbnail: boolean;
  id: string;
  moduleCount: number;
  publishedLessonCount: number;
  readinessPercent: number;
  status: string;
  title: string;
  totalLessonCount: number;
}

export interface AdminDashboardCourseHealthProjection {
  activeCourses: number;
  averageReadinessPercent: number | null;
  coursesNeedingAttention: AdminDashboardCourseHealth[];
  coursesNeedingAttentionCount: number;
  draftCourses: number;
  salesPausedCourses: number;
}

export interface AdminDashboardRecentOrder {
  amountInCents: number;
  checkoutStatus: string;
  courseTitle: string;
  createdAt: Date;
  customerEmail: string | null;
  customerName: string | null;
  id: string;
  paidAmountInCents: number | null;
  status: string;
}

export interface AdminDashboardRecentCertificate {
  code: string;
  courseTitle: string;
  issuedAt: Date;
  status: "revoked" | "valid";
  studentName: string;
}

export type AdminDashboardSupportDeliveryState =
  | "delayed"
  | "delivered"
  | "failed"
  | "queued"
  | "sending"
  | "sent";

export interface AdminDashboardPendingCertificate {
  completedAt: Date;
  courseId: string;
  courseTitle: string;
  studentName: string;
}

export interface AdminDashboardSupportRequest {
  courseTitle: string | null;
  createdAt: Date;
  deliveryState: AdminDashboardSupportDeliveryState;
  id: string;
  studentName: string;
  subject: string;
}

export interface AdminDashboardOperations {
  access: {
    expiringEnrollmentCount: number;
    expiringStudentCount: number;
  };
  certificates: {
    pending: AdminDashboardPendingCertificate[];
    pendingCount: number;
  };
  financial: {
    disputedOrderCount: number;
    failedRefundCount: number;
    pendingPaymentReviewCount: number;
    pendingRefundCount: number;
    pendingRevenueInCents: number;
    refundedOrderCount: number;
    uncertainCheckoutCount: number;
    uncertainRefundCount: number;
    uncorrelatedOrderCount: number;
  };
  integrations: {
    backlog: OperationalBacklogSnapshot;
    failedJmvDeleteCount: number;
    failedJmvUploadCount: number;
    pendingJmvDeleteCount: number;
    processingJmvUploadCount: number;
  };
  supportRequests: {
    deliveredCount: number;
    failedCount: number;
    pendingCount: number;
    recent: AdminDashboardSupportRequest[];
    sentCount: number;
    totalCount: number;
  };
}

export const getAdminOverview = async (): Promise<AdminOverview> => {
  await requirePermission("viewAdminPanel");
  await requirePermission("viewFinancials");
  await requirePermission("viewGlobalAudit");

  const pool = getPool();
  const counts = await pool.query<{
    active_enrollments: number;
    courses: number;
    failed_webhooks: number;
    paid_orders: number;
    paid_revenue_in_cents: number | string;
    pending_orders: number;
    retryable_webhooks: number;
    students: number;
  }>(`
      select
        (select count(*)::int from courses) as courses,
        (select count(*)::int from profiles where role = 'student') as students,
        (
          select count(*)::int
          from enrollments e
          join courses c on c.id = e.course_id
          join profiles p on p.user_id = e.user_id
          where e.status = 'active'
            and e.starts_at <= now()
            and e.expires_at >= now()
            and c.status = 'active'
            and p.role = 'student'
            and p.platform_blocked_at is null
            and exists (
              select 1
              from course_publications cp
              where cp.course_id = c.id and cp.status = 'published'
            )
        ) as active_enrollments,
        (select count(*)::int from orders where status = 'paid') as paid_orders,
        (select coalesce(sum(coalesce(paid_amount_in_cents, amount_in_cents)) filter (where status = 'paid'), 0)::bigint from orders) as paid_revenue_in_cents,
        (select count(*)::int from orders where status = 'pending' and checkout_status not in ('failed', 'cancelled', 'expired')) as pending_orders,
        (select count(*)::int from webhook_events where provider = 'asaas' and status = 'failed') as failed_webhooks,
        (select count(*)::int from webhook_events where provider = 'asaas' and status = 'retryable') as retryable_webhooks
    `);
  const countRow = counts.rows[0];

  return {
    courses: countRow?.courses ?? 0,
    students: countRow?.students ?? 0,
    activeEnrollments: countRow?.active_enrollments ?? 0,
    paidOrders: countRow?.paid_orders ?? 0,
    paidRevenueInCents: Number(countRow?.paid_revenue_in_cents ?? 0),
    pendingOrders: countRow?.pending_orders ?? 0,
    retryableWebhooks: countRow?.retryable_webhooks ?? 0,
    failedWebhooks: countRow?.failed_webhooks ?? 0,
  };
};

export interface CourseRevenueSummary {
  courseId: string;
  courseTitle: string;
  paidOrders: number;
  totalOrders: number;
  totalRevenueInCents: number;
}

export interface AdminAuditLog {
  action: string;
  actorEmail: string | null;
  createdAt: Date;
  targetId: string | null;
  targetName: string | null;
  targetType: string;
}

export interface AdminStatementImportHistory {
  actorEmail: string | null;
  completedAt: Date;
  finishDate: string;
  inserted: number;
  resumedFromOffset: number;
  startDate: string;
  updated: number;
}

export interface AdminStatementImportProgress {
  actorEmail: string | null;
  finishDate: string;
  nextOffset: number;
  startDate: string;
  updatedAt: Date;
}

export interface AdminCourse {
  accessDurationMonths: number;
  catalogVisibility: "hidden" | "listed";
  certificateEnabled: boolean;
  coverImage: unknown;
  description: string | null;
  hasCommercialHistory: boolean;
  id: string;
  interestCount: number;
  interestNotificationsSent: number;
  launchDate: string | null;
  launchLandingUrl: string | null;
  lessonCount?: number;
  moduleCount?: number;
  paymentAllowCreditCard: boolean;
  paymentAllowPix: boolean;
  paymentMaxInstallmentCount: number;
  pendingCertificateReconciliationCount: number;
  pendingCheckoutCancellations: number;
  pendingInterestNotifications: number;
  priceInCents: number;
  salesStatus: "closed" | "open";
  slug: string;
  status: string;
  subtitle: string | null;
  thumbnailUrl: string | null;
  title: string;
  workloadHours: number;
  workloadHoursOverride: number | null;
}

export interface AdminCourseOverviewSummary {
  activeEnrollmentCount: number;
  paidOrderCount: number;
  validCertificateCount: number;
}

export interface AdminEnrollment {
  contentReleaseMode?: "full_access" | "scheduled";
  contentReleaseStartedAt?: Date | null;
  courseId: string;
  courseTitle: string;
  email: string;
  expiresAt: Date;
  id: string;
  lastAccessAt: Date | null;
  name: string;
  nextModuleReleaseAt?: Date | null;
  originalExpiresAt: Date;
  revokedReason: string | null;
  startsAt: Date;
  status: string;
  userId: string;
}

const DEFAULT_ADMIN_STUDENT_PAGE_SIZE = 100;
const MAX_ADMIN_STUDENT_PAGE_SIZE = 250;
const MAX_ADMIN_STUDENT_PAGE = 1000;

export interface AdminStudentsQuery {
  page?: number | undefined;
  pageSize?: number | undefined;
  search?: string | undefined;
}

const DEFAULT_ADMIN_COURSE_PAGE_SIZE = 50;
const MAX_ADMIN_COURSE_PAGE_SIZE = 100;
const MAX_ADMIN_COURSE_PAGE = 1000;

export interface AdminCourseCatalogQuery {
  page?: number | undefined;
  pageSize?: number | undefined;
}

export interface AdminCourseCatalogCard {
  accessDurationMonths: number;
  catalogVisibility: "hidden" | "listed";
  coverImage: unknown;
  id: string;
  lessonCount: number;
  moduleCount: number;
  priceInCents: number;
  salesStatus: "closed" | "open";
  status: string;
  subtitle: string | null;
  thumbnailUrl: string | null;
  title: string;
}

const DEFAULT_ADMIN_COURSE_ENROLLMENT_PAGE_SIZE = 50;
const MAX_ADMIN_COURSE_ENROLLMENT_PAGE = 1000;

export interface AdminCourseRevenueData {
  courses: CourseRevenueSummary[];
}

export interface AdminCourseEnrollmentQuery {
  page?: number | undefined;
  search?: string | undefined;
}

export interface AdminFaq {
  answer: string;
  id: string;
  isPublished: boolean;
  question: string;
  sortOrder: number;
}

export interface AdminLesson {
  contentJson: unknown;
  coursePublicationStatus: "draft" | "published" | "retired";
  courseTitle: string;
  description: string | null;
  durationSeconds: number;
  id: string;
  isPublished: boolean;
  isRequired: boolean;
  moduleId: string;
  moduleTitle: string;
  sortOrder: number;
  status: string;
  textDurationSeconds: number;
  textWordCount: number;
  title: string;
  videoDurationSeconds: number;
  videoEmbedUrl: string | null;
  videoExternalId: string | null;
  videoProvider: string | null;
}

export interface AdminModule {
  courseId: string;
  courseTitle: string;
  description: string | null;
  id: string;
  releaseDelayDays: number;
  sortOrder: number;
  status: string;
  title: string;
}

const paymentReviewTypes = [
  "amount_mismatch",
  "terminal_conflict",
  "event_anomaly",
  "partial_refund",
  "uncertain_result",
  "buyer_identity",
] as const;

type PaymentReviewType = (typeof paymentReviewTypes)[number];

const isPaymentReviewType = (value: unknown): value is PaymentReviewType =>
  typeof value === "string" &&
  paymentReviewTypes.some((reviewType) => reviewType === value);

const parsePaymentReviewType = (value: unknown): PaymentReviewType => {
  if (isPaymentReviewType(value)) {
    return value;
  }
  throw new Error("Revisao financeira invalida.");
};

export interface AdminPaymentReview {
  amountInCents: number;
  courseTitle: string;
  createdAt: Date;
  customerEmail: string | null;
  customerName: string | null;
  id: string;
  observedAmountInCents?: number | null;
  observedFeeAmountInCents?: number | null;
  observedNetAmountInCents?: number | null;
  orderId: string;
  orderStatus: string;
  paidAmountInCents: number | null;
  providerCheckoutId: string | null;
  providerPaymentId: string | null;
  providerPaymentStatus: string | null;
  reason: string;
  status: "approved" | "pending" | "rejected";
  type: PaymentReviewType;
}

export interface AdminPaymentReviewHistory extends AdminPaymentReview {
  decisionReason: string | null;
  resolvedAt: Date | null;
  resolvedByEmail: string | null;
  status: "approved" | "rejected";
}

export interface AdminPaymentReviewPage {
  hasNextPage: boolean;
  history: AdminPaymentReviewHistory[];
  historyTotalCount: number;
  page: number;
  pageSize: number;
  reviews: AdminPaymentReview[];
  totalCount: number;
}

export interface AdminWebhookEvent {
  attemptCount: number;
  createdAt: Date;
  errorMessage: string | null;
  eventKey: string;
  eventName: string;
  id: string;
  nextAttemptAt: Date | null;
  status: string;
}

export interface AdminWebhookEventPage {
  events: AdminWebhookEvent[];
  hasNextPage: boolean;
  page: number;
  pageSize: number;
  search: string;
  totalCount: number;
}

export interface AdminWebhookEventQuery {
  page?: number;
  pageSize?: number;
  search?: string;
}

export interface AdminPaymentReviewQuery {
  page?: number;
  pageSize?: number;
}

export interface AdminOrder {
  amountInCents: number;
  checkoutAttemptCount: number;
  checkoutErrorMessage: string | null;
  checkoutLastAttemptAt: Date | null;
  checkoutNextAttemptAt: Date | null;
  checkoutStatus: string;
  courseId: string;
  courseTitle: string;
  createdAt: Date;
  customerEmail: string | null;
  customerName: string | null;
  feeAmountInCents: number | null;
  hasPendingBuyerIdentityReview?: boolean;
  id: string;
  installmentPaymentCount?: number;
  installmentPaymentsSyncedAt?: Date | null;
  netAmountInCents: number | null;
  paidAmountInCents: number | null;
  paidAt: Date | null;
  paymentInstallmentCount: number | null;
  paymentMethod: string | null;
  providerCheckoutId: string | null;
  providerInstallmentId: string | null;
  providerPaymentId: string | null;
  providerPaymentStatus: string | null;
  providerRefundCreatedAt: string | null;
  providerRefundEndToEndId: string | null;
  providerRefundReceiptUrl: string | null;
  providerRefundStatus: string | null;
  providerRiskStatus: string | null;
  refundConfirmedAt: Date | null;
  refundErrorCode: string | null;
  refundedAmountInCents: number | null;
  refundRequestCreatedAt: Date | null;
  refundRequestStatus: string | null;
  status: string;
}

export interface AdminInstallmentPayment {
  anticipated: boolean | null;
  clientPaymentDate: string | null;
  dueDate: string | null;
  feeAmountInCents: number | null;
  installmentNumber: number | null;
  netValueInCents: number | null;
  paymentDate: string | null;
  providerPaymentId: string;
  status: string;
  valueInCents: number;
}

export interface AdminOrderPage {
  hasNextPage: boolean;
  orders: AdminOrder[];
  totalCount: number;
}

export interface AdminFinancialOverviewData {
  coursesRevenue: AdminCourseRevenueData;
  financialHealth: AdminFinancialHealthSummary;
  paymentReviews: AdminPaymentReviewPage;
}

export interface AdminFinancialAnalytics {
  averageReceivedTicketInCents: number;
  estimatedNetRevenueInCents: number;
  feesInCents: number;
  grossReceivedInCents: number;
  missingFeeEvidenceOrders: number;
  paidOrders: number;
  pendingOrders: number;
  pendingRevenueInCents: number;
  period: AdminFinancialPeriod;
  periodLabel: string;
  refundedOrders: number;
  refundedRevenueInCents: number;
  refundRatePercent: number | null;
}

export interface AdminFinancialAnalysisData {
  analytics: AdminFinancialAnalytics;
}

export interface AdminFinancialOrdersData {
  orders: AdminOrder[];
  ordersHasNextPage: boolean;
  ordersTotalCount: number;
}

export interface AdminSettings {
  certificateSignerName: string | null;
  certificateSignerRole: string | null;
  issuerCnpj: string | null;
  issuerDisplayName: string | null;
  issuerLegalName: string | null;
}

export interface AdminLessonAsset {
  deleteStatus: string;
  filename: string;
  galleryUuid: string | null;
  id: string;
  lastError: string | null;
  lessonId: string | null;
  uploadStatus: string;
  videoHash: string;
}

export interface AdminStudentDetail {
  email: string;
  enrollments: Array<{
    contentReleaseMode?: "full_access" | "scheduled";
    contentReleaseStartedAt?: Date | null;
    courseId: string;
    courseTitle: string;
    expiresAt: Date;
    id: string;
    originalExpiresAt: Date;
    nextModuleReleaseAt?: Date | null;
    revokedReason: string | null;
    startedAt: Date;
    status: string;
  }>;
  name: string;
  platformBlockedAt: Date | null;
  platformBlockedReason: string | null;
  userId: string;
}

export interface AdminStudentSheetData {
  certificates: CertificateOperationRecord[];
  context: {
    courseId: string | null;
    courseTitle: string | null;
  };
  student: AdminStudentDetail;
}

const readDashboardAccessOperations = async (): Promise<
  AdminDashboardOperations["access"]
> => {
  const { rows } = await getPool().query<{
    expiring_enrollments: number;
    expiring_students: number;
  }>(`
    select
      count(*)::int as expiring_enrollments,
      count(distinct e.user_id)::int as expiring_students
    from enrollments e
    join courses c on c.id = e.course_id
    join profiles p on p.user_id = e.user_id and p.role = 'student'
    where e.status = 'active'
      and e.starts_at <= now()
      and e.expires_at >= now()
      and e.expires_at <= now() + interval '30 days'
      and c.status = 'active'
      and p.platform_blocked_at is null
      and exists (
        select 1
        from course_publications cp
        where cp.course_id = c.id and cp.status = 'published'
      )
  `);
  const row = rows[0];

  return {
    expiringEnrollmentCount: row?.expiring_enrollments ?? 0,
    expiringStudentCount: row?.expiring_students ?? 0,
  };
};

const readDashboardFinancialOperations = async (): Promise<
  Pick<
    AdminDashboardOperations["financial"],
    | "disputedOrderCount"
    | "failedRefundCount"
    | "pendingPaymentReviewCount"
    | "pendingRefundCount"
    | "pendingRevenueInCents"
    | "refundedOrderCount"
  >
> => {
  const { rows } = await getPool().query<{
    disputed_orders: number;
    failed_refunds: number;
    pending_payment_reviews: number;
    pending_refunds: number;
    pending_revenue_in_cents: number | string;
    refunded_orders: number;
  }>(`
    select
      (select count(*)::int from payment_reviews where status = 'pending')
        as pending_payment_reviews,
      (select count(*)::int
       from refund_requests
       where status in ('requested', 'processing')) as pending_refunds,
      (select count(*)::int
       from refund_requests
       where status = 'failed') as failed_refunds,
      (select count(*)::int from orders where status = 'disputed')
        as disputed_orders,
      (select count(*)::int from orders where status = 'refunded')
        as refunded_orders,
      (select coalesce(sum(amount_in_cents), 0)::bigint
       from orders
       where status = 'pending'
         and checkout_status not in ('failed', 'cancelled', 'expired'))
        as pending_revenue_in_cents
  `);
  const row = rows[0];

  return {
    disputedOrderCount: row?.disputed_orders ?? 0,
    failedRefundCount: row?.failed_refunds ?? 0,
    pendingPaymentReviewCount: row?.pending_payment_reviews ?? 0,
    pendingRefundCount: row?.pending_refunds ?? 0,
    pendingRevenueInCents: Number(row?.pending_revenue_in_cents ?? 0),
    refundedOrderCount: row?.refunded_orders ?? 0,
  };
};

const readDashboardPendingCertificates = async (): Promise<
  AdminDashboardOperations["certificates"]
> => {
  const { rows } = await getPool().query<{
    completed_at: Date;
    course_id: string;
    course_title: string;
    student_name: string;
    total_count: number;
  }>(`
    with eligible_completions as (
      select
        completion.id,
        completion.completed_at,
        completion.course_id,
        course.title as course_title,
        student.name as student_name
      from course_completions completion
      join courses course
        on course.id = completion.course_id
       and course.certificate_enabled = true
      join users student on student.id = completion.user_id
      join course_publications publication
        on publication.id = completion.course_publication_id
       and publication.course_id = completion.course_id
      where exists (
        select 1
        from certificate_templates template
        where template.course_id = completion.course_id
          and template.status = 'published'
      )
        and exists (
          select 1
          from certificate_issuer_profiles issuer
          where issuer.id = 'global'
        )
        and not exists (
          select 1
          from certificates certificate
          where certificate.user_id = completion.user_id
            and certificate.course_id = completion.course_id
        )
    )
    select
      completed_at,
      course_id,
      course_title,
      student_name,
      count(*) over()::int as total_count
    from eligible_completions
    order by completed_at asc, id asc
    limit 5
  `);

  return {
    pending: rows.map((row) => ({
      completedAt: row.completed_at,
      courseId: row.course_id,
      courseTitle: row.course_title,
      studentName: row.student_name,
    })),
    pendingCount: rows[0]?.total_count ?? 0,
  };
};

const readDashboardJmvOperations = async (): Promise<
  Pick<
    AdminDashboardOperations["integrations"],
    | "failedJmvDeleteCount"
    | "failedJmvUploadCount"
    | "pendingJmvDeleteCount"
    | "processingJmvUploadCount"
  >
> => {
  const { rows } = await getPool().query<{
    failed_deletes: number;
    failed_uploads: number;
    pending_deletes: number;
    processing_uploads: number;
  }>(`
    select
      count(*) filter (where upload_status = 'failed')::int as failed_uploads,
      count(*) filter (where upload_status in ('uploading', 'processing'))::int
        as processing_uploads,
      count(*) filter (where delete_status = 'failed')::int as failed_deletes,
      count(*) filter (where delete_status = 'pending')::int as pending_deletes
    from jmvstream_video_assets
  `);
  const row = rows[0];

  return {
    failedJmvDeleteCount: row?.failed_deletes ?? 0,
    failedJmvUploadCount: row?.failed_uploads ?? 0,
    pendingJmvDeleteCount: row?.pending_deletes ?? 0,
    processingJmvUploadCount: row?.processing_uploads ?? 0,
  };
};

const readDashboardSupportRequests = async (): Promise<
  AdminDashboardOperations["supportRequests"]
> => {
  const { rows } = await getPool().query<{
    course_title: string | null;
    created_at: Date;
    delivery_state: AdminDashboardSupportDeliveryState;
    failed_count: number;
    id: string;
    pending_count: number;
    sent_count: number;
    student_name: string;
    subject: string;
    total_count: number;
    delivered_count: number;
  }>(`
    with support_delivery as (
      select
        request.id,
        request.course_title,
        request.created_at,
        request.subject,
        student.name as student_name,
        case
          when outbox.status in ('dead_letter', 'superseded')
            or email.status in ('failed', 'suppressed', 'bounced', 'complained')
            then 'failed'
          when email.status = 'delivered' or outbox.status = 'delivered'
            then 'delivered'
          when email.status = 'accepted'
            then 'sent'
          when email.status = 'sending'
            or outbox.status = 'processing'
            then 'sending'
          when email.status in ('acceptance_unknown', 'delayed')
            or outbox.status = 'retrying'
            then 'delayed'
          else 'queued'
        end as delivery_state
      from support_requests request
      join users student on student.id = request.user_id
      left join outbox_messages outbox
        on outbox.aggregate_type = 'support_request'
       and outbox.aggregate_id = request.id::text
       and outbox.topic = 'email.support-request'
      left join email_messages email on email.outbox_message_id = outbox.id
    )
    select
      id,
      course_title,
      created_at,
      delivery_state,
      subject,
      student_name,
      count(*) over()::int as total_count,
      count(*) filter (where delivery_state = 'failed') over()::int
        as failed_count,
      count(*) filter (
        where delivery_state in ('queued', 'sending', 'delayed')
      ) over()::int as pending_count,
      count(*) filter (where delivery_state = 'sent') over()::int
        as sent_count,
      count(*) filter (where delivery_state = 'delivered') over()::int
        as delivered_count
    from support_delivery
    order by created_at desc, id desc
    limit 5
  `);

  const firstRow = rows[0];
  return {
    deliveredCount: firstRow?.delivered_count ?? 0,
    failedCount: firstRow?.failed_count ?? 0,
    pendingCount: firstRow?.pending_count ?? 0,
    recent: rows.map((row) => ({
      courseTitle: row.course_title,
      createdAt: row.created_at,
      deliveryState: row.delivery_state,
      id: row.id,
      studentName: row.student_name,
      subject: row.subject,
    })),
    sentCount: firstRow?.sent_count ?? 0,
    totalCount: firstRow?.total_count ?? 0,
  };
};

const readDashboardOperations = async (): Promise<AdminDashboardOperations> => {
  const [access, financial, certificates, jmv, supportRequests, backlog] =
    await Promise.all([
      readDashboardAccessOperations(),
      readDashboardFinancialOperations(),
      readDashboardPendingCertificates(),
      readDashboardJmvOperations(),
      readDashboardSupportRequests(),
      getOperationalBacklogSnapshot(),
    ]);

  return {
    access,
    certificates,
    financial: {
      ...financial,
      uncertainCheckoutCount: backlog.payments.uncertainCheckouts,
      uncertainRefundCount: backlog.payments.uncertainRefunds,
      uncorrelatedOrderCount: backlog.payments.uncorrelatedOrders,
    },
    integrations: {
      backlog,
      ...jmv,
    },
    supportRequests,
  };
};

const readDashboardCourseHealth =
  async (): Promise<AdminDashboardCourseHealthProjection> => {
    const { rows } = await getPool().query<{
      active_courses: number;
      attention_count: number;
      average_readiness_percent: number | null;
      draft_courses: number;
      has_description: boolean;
      has_published_publication: boolean;
      has_thumbnail: boolean;
      id: string;
      module_count: number;
      published_lesson_count: number;
      readiness_percent: number;
      sales_paused_courses: number;
      status: string;
      title: string;
      total_lesson_count: number;
    }>(`
    with current_publications as (
      select distinct on (cp.course_id)
        cp.course_id,
        cp.id
      from course_publications cp
      where cp.status in ('draft', 'published')
      order by
        cp.course_id,
        case cp.status when 'draft' then 0 else 1 end,
        cp.publication_number desc,
        cp.id desc
    ), publication_state as (
      select
        cp.course_id,
        bool_or(cp.status = 'published') as has_published_publication
      from course_publications cp
      where cp.status in ('draft', 'published')
      group by cp.course_id
    ), course_health as (
      select
        c.id,
        c.title,
        c.status,
        c.sales_status,
        c.created_at,
        (nullif(btrim(c.description), '') is not null) as has_description,
        (c.thumbnail_url is not null) as has_thumbnail,
        coalesce(publication_state.has_published_publication, false)
          as has_published_publication,
        count(distinct m.id) filter (where m.status = 'active')::int as module_count,
        count(l.id) filter (
          where l.status = 'active' and m.status = 'active'
        )::int as total_lesson_count,
        count(l.id) filter (
          where l.status = 'active'
            and l.is_published = true
            and m.status = 'active'
        )::int as published_lesson_count
      from courses c
      left join current_publications current_publication
        on current_publication.course_id = c.id
      left join publication_state
        on publication_state.course_id = c.id
      left join modules m
        on m.course_publication_id = current_publication.id
      left join lessons l
        on l.course_publication_id = current_publication.id
        and l.module_id = m.id
      group by
        c.id,
        c.title,
        c.status,
        c.sales_status,
        c.created_at,
        c.description,
        c.thumbnail_url,
        publication_state.has_published_publication
    ), scored_courses as (
      select
        course_health.*,
        (
          (
            case when has_description then 1 else 0 end
            + case when has_thumbnail then 1 else 0 end
            + case when module_count > 0 then 1 else 0 end
            + case
                when total_lesson_count > 0 and published_lesson_count > 0 then 1
                else 0
              end
            + case when has_published_publication then 1 else 0 end
          ) * 25
        )::int as readiness_percent
      from course_health
    )
    select
      id,
      title,
      status,
      has_description,
      has_published_publication,
      has_thumbnail,
      module_count,
      total_lesson_count,
      published_lesson_count,
      readiness_percent,
      count(*) filter (where readiness_percent < 100) over ()::int as attention_count,
      count(*) filter (where status = 'active') over ()::int as active_courses,
      count(*) filter (where status = 'draft') over ()::int as draft_courses,
      count(*) filter (
        where status = 'active' and sales_status = 'closed'
      ) over ()::int as sales_paused_courses,
      round(avg(readiness_percent) over ())::int as average_readiness_percent
    from scored_courses
    order by readiness_percent asc, title asc, id asc
    limit 4
  `);

    const firstRow = rows[0];
    return {
      activeCourses: firstRow?.active_courses ?? 0,
      averageReadinessPercent: firstRow?.average_readiness_percent ?? null,
      coursesNeedingAttention: rows
        .filter((row) => row.readiness_percent < 100)
        .map((row) => ({
          actionTab:
            row.has_description &&
            row.has_thumbnail &&
            row.module_count > 0 &&
            row.total_lesson_count > 0 &&
            row.published_lesson_count > 0
              ? "content"
              : "settings",
          hasDescription: row.has_description,
          hasPublishedPublication: row.has_published_publication,
          hasThumbnail: row.has_thumbnail,
          id: row.id,
          moduleCount: row.module_count,
          publishedLessonCount: row.published_lesson_count,
          readinessPercent: row.readiness_percent,
          status: row.status,
          title: row.title,
          totalLessonCount: row.total_lesson_count,
        })),
      coursesNeedingAttentionCount: firstRow?.attention_count ?? 0,
      draftCourses: firstRow?.draft_courses ?? 0,
      salesPausedCourses: firstRow?.sales_paused_courses ?? 0,
    };
  };

const readDashboardRecentOrders = async (): Promise<
  AdminDashboardRecentOrder[]
> => {
  const { rows } = await getPool().query<{
    amount_in_cents: number;
    checkout_status: string;
    course_title: string;
    created_at: Date;
    customer_email: string | null;
    customer_name: string | null;
    id: string;
    paid_amount_in_cents: number | null;
    status: string;
  }>(`
    select
      o.id,
      o.amount_in_cents,
      o.paid_amount_in_cents,
      o.created_at,
      o.customer_name,
      o.customer_email,
      o.status,
      o.checkout_status,
      c.title as course_title
    from orders o
    join courses c on c.id = o.course_id
    order by o.created_at desc, o.id desc
    limit 5
  `);

  return rows.map((row) => ({
    amountInCents: row.amount_in_cents,
    courseTitle: row.course_title,
    checkoutStatus: row.checkout_status,
    createdAt: row.created_at,
    customerEmail: row.customer_email,
    customerName: row.customer_name,
    id: row.id,
    paidAmountInCents: row.paid_amount_in_cents,
    status: row.status,
  }));
};

const readDashboardRecentCertificates = async (): Promise<
  AdminDashboardRecentCertificate[]
> => {
  const { rows } = await getPool().query<{
    code: string;
    course_title_snapshot: string;
    issued_at: Date;
    status: "revoked" | "valid";
    student_name_snapshot: string;
  }>(`
    select
      code,
      course_title_snapshot,
      student_name_snapshot,
      issued_at,
      status
    from certificates
    order by issued_at desc, id desc
    limit 5
  `);

  return rows.map((row) => ({
    code: row.code,
    courseTitle: row.course_title_snapshot,
    issuedAt: row.issued_at,
    status: row.status,
    studentName: row.student_name_snapshot,
  }));
};

const readCourses = async (
  courseId?: string,
  options: AdminCourseCatalogQuery = {}
): Promise<AdminCourse[]> => {
  const requestedPage = Math.trunc(options.page ?? 1);
  const page = Number.isFinite(requestedPage)
    ? Math.min(MAX_ADMIN_COURSE_PAGE, Math.max(1, requestedPage))
    : 1;
  const requestedPageSize = Math.trunc(
    options.pageSize ?? DEFAULT_ADMIN_COURSE_PAGE_SIZE
  );
  const pageSize = Number.isFinite(requestedPageSize)
    ? Math.min(MAX_ADMIN_COURSE_PAGE_SIZE, Math.max(1, requestedPageSize))
    : DEFAULT_ADMIN_COURSE_PAGE_SIZE;
  const values: unknown[] = [];
  const filters: string[] = [];

  if (courseId) {
    values.push(courseId);
    filters.push(`courses.id = $${values.length}`);
  }

  const pagination = courseId
    ? ""
    : (() => {
        values.push(pageSize + 1, (page - 1) * pageSize);
        return `limit $${values.length - 1} offset $${values.length}`;
      })();
  const whereClause =
    filters.length > 0 ? `where ${filters.join(" and ")}` : "";
  const { rows } = await getPool().query<{
    access_duration_months: number;
    catalog_visibility: "hidden" | "listed";
    certificate_enabled: boolean;
    description: string | null;
    has_commercial_history: boolean;
    id: string;
    interest_count: number;
    interest_notifications_sent: number;
    launch_date: string | null;
    launch_landing_url: string | null;
    payment_allow_credit_card: boolean;
    payment_allow_pix: boolean;
    payment_max_installment_count: number;
    pending_certificate_reconciliation_count: number;
    price_in_cents: number;
    pending_checkout_cancellations: number;
    pending_interest_notifications: number;
    sales_status: "closed" | "open";
    slug: string;
    status: string;
    subtitle: string | null;
    cover_image_json: unknown;
    thumbnail_url: string | null;
    title: string;
    workload_hours: number;
    workload_hours_override: number | null;
  }>(
    `
      select courses.*,
        (
          exists (
            select 1 from orders o
            where o.course_id = courses.id and o.status = 'paid'
          ) or exists (
            select 1 from enrollment_grants eg where eg.course_id = courses.id
          ) or exists (
            select 1 from enrollments e where e.course_id = courses.id
          )
        ) as has_commercial_history,
        (
          select count(*)::int from course_sale_interests csi
          where csi.course_id = courses.id
        ) as interest_count,
        (
          select count(*)::int from course_sale_interests csi
          where csi.course_id = courses.id
            and csi.notification_enqueued_at is not null
        ) as pending_interest_notifications,
        (
          select count(*)::int
          from course_completions completion
          where completion.course_id = courses.id
            and courses.certificate_enabled = true
            and exists (
              select 1
              from certificate_templates template
              where template.course_id = courses.id
                and template.status = 'published'
            )
            and exists (
              select 1
              from certificate_issuer_profiles issuer
              where issuer.id = 'global'
            )
            and not exists (
              select 1
              from certificates certificate
              where certificate.user_id = completion.user_id
                and certificate.course_id = completion.course_id
            )
        ) as pending_certificate_reconciliation_count,
        (
          select count(*)::int
          from outbox_messages om
          join orders o on o.id = (om.payload ->> 'orderId')::uuid
          where om.topic = 'payments.checkout-cancel'
            and om.status in ('pending', 'retrying', 'processing')
            and o.course_id = courses.id
        ) as pending_checkout_cancellations
      from courses
      ${whereClause}
      order by courses.created_at desc
      ${pagination}
    `,
    values.length > 0 ? values : undefined
  );

  return rows.map((row) => ({
    accessDurationMonths: row.access_duration_months,
    catalogVisibility: row.catalog_visibility,
    certificateEnabled: row.certificate_enabled,
    description: row.description,
    hasCommercialHistory: row.has_commercial_history,
    id: row.id,
    interestCount: row.interest_count,
    interestNotificationsSent: row.interest_notifications_sent,
    launchDate: row.launch_date,
    launchLandingUrl: row.launch_landing_url,
    paymentAllowCreditCard: row.payment_allow_credit_card,
    paymentAllowPix: row.payment_allow_pix,
    paymentMaxInstallmentCount: row.payment_max_installment_count,
    priceInCents: row.price_in_cents,
    pendingCertificateReconciliationCount:
      row.pending_certificate_reconciliation_count,
    pendingCheckoutCancellations: row.pending_checkout_cancellations,
    pendingInterestNotifications: row.pending_interest_notifications,
    salesStatus: row.sales_status,
    slug: row.slug,
    status: row.status,
    subtitle: row.subtitle,
    coverImage: row.cover_image_json,
    thumbnailUrl: row.thumbnail_url,
    title: row.title,
    workloadHours: row.workload_hours,
    workloadHoursOverride: row.workload_hours_override,
  }));
};

const readCourseCatalogCards = async ({
  page,
  pageSize,
}: {
  page: number;
  pageSize: number;
}): Promise<{
  cards: AdminCourseCatalogCard[];
  hasNextPage: boolean;
  totalCount: number;
}> => {
  const { rows } = await getPool().query<{
    access_duration_months: number;
    catalog_visibility: "hidden" | "listed";
    cover_image_json: unknown;
    id: string;
    lesson_count: number;
    module_count: number;
    price_in_cents: number;
    sales_status: "closed" | "open";
    status: string;
    subtitle: string | null;
    thumbnail_url: string | null;
    title: string;
    total_count: number;
  }>(
    `
      with current_publications as (
        select distinct on (cp.course_id)
          cp.course_id,
          cp.id
        from course_publications cp
        where cp.status in ('draft', 'published')
        order by
          cp.course_id,
          case cp.status when 'draft' then 0 else 1 end,
          cp.publication_number desc,
          cp.id desc
      )
      select
        c.id,
        c.title,
        c.subtitle,
        c.status,
        c.catalog_visibility,
        c.sales_status,
        c.price_in_cents,
        c.access_duration_months,
        c.thumbnail_url,
        c.cover_image_json,
        count(distinct m.id)::int as module_count,
        count(l.id)::int as lesson_count,
        count(*) over()::int as total_count
      from courses c
      left join current_publications current_publication
        on current_publication.course_id = c.id
      left join modules m
        on m.course_publication_id = current_publication.id
      left join lessons l
        on l.course_publication_id = current_publication.id
        and l.module_id = m.id
      group by
        c.id,
        c.title,
        c.subtitle,
        c.status,
        c.catalog_visibility,
        c.sales_status,
        c.price_in_cents,
        c.access_duration_months,
        c.thumbnail_url,
        c.cover_image_json,
        c.created_at
      order by c.created_at desc, c.id desc
      limit $1 offset $2
    `,
    [pageSize + 1, (page - 1) * pageSize]
  );

  let totalCount = rows[0]?.total_count ?? 0;
  if (rows.length === 0 && page > 1) {
    const countResult = await getPool().query<{ total_count: number }>(
      "select count(*)::int as total_count from courses"
    );
    totalCount = countResult.rows[0]?.total_count ?? 0;
  }

  return {
    cards: rows.slice(0, pageSize).map((row) => ({
      accessDurationMonths: row.access_duration_months,
      catalogVisibility: row.catalog_visibility,
      coverImage: row.cover_image_json,
      id: row.id,
      lessonCount: row.lesson_count,
      moduleCount: row.module_count,
      priceInCents: row.price_in_cents,
      salesStatus: row.sales_status,
      status: row.status,
      subtitle: row.subtitle,
      thumbnailUrl: row.thumbnail_url,
      title: row.title,
    })),
    hasNextPage: rows.length > pageSize,
    totalCount,
  };
};

const readModules = async (courseId?: string): Promise<AdminModule[]> => {
  const { rows } = await getPool().query<{
    course_id: string;
    course_title: string;
    description: string | null;
    id: string;
    release_delay_days: number;
    sort_order: number;
    status: string;
    title: string;
  }>(
    courseId
      ? `
          select m.id, m.course_id, c.title as course_title, m.title, m.description, m.sort_order, m.status,
                 m.release_delay_days
          from modules m
          join courses c on c.id = m.course_id
           where m.course_publication_id = (
             select id
             from course_publications
             where course_id = $1 and status in ('draft', 'published')
             order by case status when 'draft' then 0 else 1 end, publication_number desc
             limit 1
           )
          order by m.sort_order
        `
      : `
          select m.id, m.course_id, c.title as course_title, m.title, m.description, m.sort_order, m.status,
                 m.release_delay_days
          from modules m
          join courses c on c.id = m.course_id
          order by c.title, m.sort_order
        `,
    courseId ? [courseId] : undefined
  );

  return rows.map((row) => ({
    courseId: row.course_id,
    courseTitle: row.course_title,
    description: row.description,
    id: row.id,
    releaseDelayDays: row.release_delay_days,
    sortOrder: row.sort_order,
    status: row.status,
    title: row.title,
  }));
};

const readLessons = async (courseId?: string): Promise<AdminLesson[]> => {
  const { rows } = await getPool().query<{
    content_json: unknown;
    course_title: string;
    course_publication_status: "draft" | "published" | "retired";
    duration_seconds: number;
    id: string;
    is_published: boolean;
    is_required: boolean;
    lesson_description: string | null;
    module_id: string;
    module_title: string;
    sort_order: number;
    status: string;
    text_duration_seconds: number;
    text_word_count: number;
    title: string;
    video_embed_url: string | null;
    video_duration_seconds: number;
    video_external_id: string | null;
    video_provider: string | null;
  }>(
    courseId
      ? `
          select l.id, l.module_id, m.title as module_title, c.title as course_title,
                 l.title, l.description as lesson_description, l.content_json,
                 l.duration_seconds, l.video_duration_seconds,
                 l.text_duration_seconds, l.text_word_count,
                 l.sort_order, l.video_provider,
                 l.video_external_id, l.video_embed_url, l.status, l.is_published, l.is_required,
                 cp.status as course_publication_status
          from lessons l
          join modules m on m.id = l.module_id
          join courses c on c.id = m.course_id
          join course_publications cp on cp.id = l.course_publication_id
           where l.course_publication_id = (
             select id
             from course_publications
             where course_id = $1 and status in ('draft', 'published')
             order by case status when 'draft' then 0 else 1 end, publication_number desc
             limit 1
           )
          order by m.sort_order, l.sort_order
        `
      : `
          select l.id, l.module_id, m.title as module_title, c.title as course_title,
                 l.title, l.description as lesson_description, l.content_json,
                 l.duration_seconds, l.video_duration_seconds,
                 l.text_duration_seconds, l.text_word_count,
                 l.sort_order, l.video_provider,
                 l.video_external_id, l.video_embed_url, l.status, l.is_published, l.is_required,
                 cp.status as course_publication_status
          from lessons l
          join modules m on m.id = l.module_id
          join courses c on c.id = m.course_id
          join course_publications cp on cp.id = l.course_publication_id
          order by c.title, m.sort_order, l.sort_order
        `,
    courseId ? [courseId] : undefined
  );

  return rows.map((row) => ({
    contentJson: row.content_json,
    courseTitle: row.course_title,
    coursePublicationStatus: row.course_publication_status,
    durationSeconds: row.duration_seconds,
    id: row.id,
    isPublished: row.status === "active",
    isRequired: row.is_required,
    moduleId: row.module_id,
    moduleTitle: row.module_title,
    description: row.lesson_description,
    sortOrder: row.sort_order,
    status: row.status,
    title: row.title,
    textDurationSeconds: row.text_duration_seconds,
    textWordCount: row.text_word_count,
    videoEmbedUrl: row.video_embed_url,
    videoDurationSeconds: row.video_duration_seconds,
    videoExternalId: row.video_external_id,
    videoProvider: row.video_provider,
  }));
};

const readLessonEditor = async ({
  courseId,
  lessonId,
}: {
  courseId: string;
  lessonId: string;
}): Promise<{ lesson: AdminLesson; module: AdminModule } | null> => {
  const { rows } = await getPool().query<{
    content_json: unknown;
    course_id: string;
    course_title: string;
    course_publication_status: "draft" | "published" | "retired";
    duration_seconds: number;
    id: string;
    is_published: boolean;
    is_required: boolean;
    lesson_description: string | null;
    module_description: string | null;
    module_id: string;
    module_release_delay_days: number;
    module_sort_order: number;
    module_status: string;
    module_title: string;
    sort_order: number;
    status: string;
    text_duration_seconds: number;
    text_word_count: number;
    title: string;
    video_embed_url: string | null;
    video_duration_seconds: number;
    video_external_id: string | null;
    video_provider: string | null;
  }>(
    `
      select l.id, l.module_id, m.title as module_title, m.description as module_description,
             m.sort_order as module_sort_order, m.status as module_status,
             m.release_delay_days as module_release_delay_days,
             c.id as course_id, c.title as course_title, l.title,
             l.description as lesson_description, l.content_json, l.duration_seconds,
             l.video_duration_seconds, l.text_duration_seconds, l.text_word_count,
             l.sort_order, l.video_provider, l.video_external_id, l.video_embed_url,
             l.status, l.is_published, l.is_required, cp.status as course_publication_status
      from lessons l
      join modules m on m.id = l.module_id
      join courses c on c.id = m.course_id
      join course_publications cp on cp.id = l.course_publication_id
      where m.course_id = $1 and l.id = $2 and cp.status = 'draft'
      limit 1
    `,
    [courseId, lessonId]
  );
  const row = rows[0];

  if (!row) {
    return null;
  }

  return {
    lesson: {
      contentJson: row.content_json,
      courseTitle: row.course_title,
      coursePublicationStatus: row.course_publication_status,
      description: row.lesson_description,
      durationSeconds: row.duration_seconds,
      id: row.id,
      isPublished: row.status === "active",
      isRequired: row.is_required,
      moduleId: row.module_id,
      moduleTitle: row.module_title,
      sortOrder: row.sort_order,
      status: row.status,
      textDurationSeconds: row.text_duration_seconds,
      textWordCount: row.text_word_count,
      title: row.title,
      videoEmbedUrl: row.video_embed_url,
      videoDurationSeconds: row.video_duration_seconds,
      videoExternalId: row.video_external_id,
      videoProvider: row.video_provider,
    },
    module: {
      courseId: row.course_id,
      courseTitle: row.course_title,
      description: row.module_description,
      id: row.module_id,
      releaseDelayDays: row.module_release_delay_days,
      sortOrder: row.module_sort_order,
      status: row.module_status,
      title: row.module_title,
    },
  };
};

interface AdminEnrollmentDatabaseRow {
  content_release_mode?: ContentReleaseMode;
  content_release_started_at?: Date | null;
  course_id: string;
  course_title: string;
  email: string;
  expires_at: Date;
  id: string;
  last_access_at: Date | null;
  name: string;
  next_module_release_at?: Date | null;
  original_expires_at: Date;
  revoked_reason: string | null;
  starts_at: Date;
  status: string;
  user_id: string;
}

const mapAdminEnrollment = (
  row: AdminEnrollmentDatabaseRow
): AdminEnrollment => ({
  courseId: row.course_id,
  courseTitle: row.course_title,
  email: row.email,
  expiresAt: row.expires_at,
  id: row.id,
  lastAccessAt: row.last_access_at,
  name: row.name,
  originalExpiresAt: row.original_expires_at,
  revokedReason: row.revoked_reason,
  startsAt: row.starts_at,
  status: row.status,
  userId: row.user_id,
});

const readEnrollments = async (
  courseId?: string,
  userIds?: readonly string[]
): Promise<AdminEnrollment[]> => {
  if (userIds && userIds.length === 0) {
    return [];
  }

  const values: unknown[] = [];
  const filters: string[] = [];

  if (courseId) {
    values.push(courseId);
    filters.push(`e.course_id = $${values.length}`);
  }

  if (userIds) {
    values.push(userIds);
    filters.push(`e.user_id = any($${values.length}::text[])`);
  }

  const whereClause =
    filters.length > 0 ? `where ${filters.join(" and ")}` : "";
  const { rows } = await getPool().query<{
    content_release_mode: ContentReleaseMode;
    content_release_started_at: Date | null;
    course_id: string;
    course_title: string;
    email: string;
    expires_at: Date;
    id: string;
    last_access_at: Date | null;
    name: string;
    next_module_release_at: Date | null;
    original_expires_at: Date;
    revoked_reason: string | null;
    starts_at: Date;
    status: string;
    user_id: string;
  }>(
    `
      select e.id, e.user_id, u.name, u.email, c.id as course_id, c.title as course_title,
             e.status, e.starts_at, e.expires_at,
             e.content_release_mode, e.content_release_started_at,
             coalesce(latest_grant.base_expires_at, e.expires_at) as original_expires_at,
             e.revoked_reason, p.last_access_at,
             next_release.next_module_release_at
      from enrollments e
      join users u on u.id = e.user_id
      left join profiles p on p.user_id = u.id
      join courses c on c.id = e.course_id
      left join lateral (
        select eg.base_expires_at
        from enrollment_grants eg
        where eg.user_id = e.user_id
          and eg.course_id = e.course_id
        order by eg.effective_expires_at desc, eg.updated_at desc
        limit 1
      ) latest_grant on true
      ${CONTENT_RELEASE_NEXT_MODULE_LATERAL_SQL}
      ${whereClause}
      order by e.updated_at desc
    `,
    values.length > 0 ? values : undefined
  );

  return rows.map((row) => ({
    contentReleaseMode: row.content_release_mode,
    contentReleaseStartedAt: row.content_release_started_at,
    courseId: row.course_id,
    courseTitle: row.course_title,
    email: row.email,
    expiresAt: row.expires_at,
    id: row.id,
    lastAccessAt: row.last_access_at,
    name: row.name,
    nextModuleReleaseAt: row.next_module_release_at,
    originalExpiresAt: row.original_expires_at,
    revokedReason: row.revoked_reason,
    startsAt: row.starts_at,
    status: row.status,
    userId: row.user_id,
  }));
};

const readCourseEnrollmentsPage = async (
  courseId: string,
  options: AdminCourseEnrollmentQuery = {}
): Promise<{
  enrollments: AdminEnrollment[];
  hasNextPage: boolean;
  page: number;
  pageSize: number;
  search: string;
  totalCount: number;
}> => {
  const requestedPage = Math.trunc(options.page ?? 1);
  const page = Number.isFinite(requestedPage)
    ? Math.min(MAX_ADMIN_COURSE_ENROLLMENT_PAGE, Math.max(1, requestedPage))
    : 1;
  const search = options.search?.trim() ?? "";
  const pageSize = DEFAULT_ADMIN_COURSE_ENROLLMENT_PAGE_SIZE;
  const offset = (page - 1) * pageSize;
  const { rows } = await getPool().query<
    AdminEnrollmentDatabaseRow & { total_count: number }
  >(
    `
      select e.id, e.user_id, u.name, u.email, c.id as course_id, c.title as course_title,
             e.status, e.starts_at, e.expires_at,
             coalesce(latest_grant.base_expires_at, e.expires_at) as original_expires_at,
             e.revoked_reason, p.last_access_at,
             count(*) over()::int as total_count
      from enrollments e
      join users u on u.id = e.user_id
      left join profiles p on p.user_id = u.id
      join courses c on c.id = e.course_id
      left join lateral (
        select eg.base_expires_at
        from enrollment_grants eg
        where eg.user_id = e.user_id
          and eg.course_id = e.course_id
        order by eg.effective_expires_at desc, eg.updated_at desc
        limit 1
      ) latest_grant on true
      where e.course_id = $1
        and ($2 = '' or u.name ilike $3 or u.email ilike $3)
      order by e.updated_at desc, e.id desc
      limit $4 offset $5
    `,
    [courseId, search, `%${search}%`, pageSize + 1, offset]
  );
  let totalCount = rows[0]?.total_count ?? 0;
  if (rows.length === 0 && page > 1) {
    const countResult = await getPool().query<{ total_count: number }>(
      `
        select count(*)::int as total_count
        from enrollments e
        join users u on u.id = e.user_id
        where e.course_id = $1
          and ($2 = '' or u.name ilike $3 or u.email ilike $3)
      `,
      [courseId, search, `%${search}%`]
    );
    totalCount = countResult.rows[0]?.total_count ?? 0;
  }

  return {
    enrollments: rows.slice(0, pageSize).map(mapAdminEnrollment),
    hasNextPage: rows.length > pageSize,
    page,
    pageSize,
    search,
    totalCount,
  };
};

interface AdminOrderQuery {
  checkout?: AdminOrderCheckoutFilter | undefined;
  page?: number;
  pageSize?: number;
  paymentMethod?: AdminOrderPaymentMethodFilter | undefined;
  search?: string;
  status?: AdminOrderStatusFilter | undefined;
}

const DEFAULT_ADMIN_ORDER_PAGE_SIZE = 20;
export const MAX_ADMIN_ORDER_PAGE = 1000;
const DEFAULT_ADMIN_REVIEW_PAGE_SIZE = 20;
const MAX_ADMIN_REVIEW_PAGE = 1000;
const MAX_ADMIN_REVIEW_PAGE_SIZE = 100;

const getCheckoutPredicate = (
  tableAlias: string,
  checkout: AdminOrderCheckoutFilter
): string => {
  const prefix = tableAlias ? `${tableAlias}.` : "";
  if (checkout === "open") {
    return `${prefix}status = 'pending' and ${prefix}checkout_status not in ('failed', 'cancelled', 'expired')`;
  }
  return `${prefix}status = 'pending' and ${prefix}checkout_status in ('failed', 'cancelled', 'expired')`;
};

const readOrders = async (
  options: AdminOrderQuery = {}
): Promise<AdminOrderPage> => {
  const pageSize = options.pageSize ?? DEFAULT_ADMIN_ORDER_PAGE_SIZE;
  const requestedPage = Math.trunc(options.page ?? 1);
  const page = Number.isFinite(requestedPage)
    ? Math.min(MAX_ADMIN_ORDER_PAGE, Math.max(1, requestedPage))
    : 1;
  const search = options.search?.trim() ?? "";
  const filters: string[] = [];
  const filterValues: unknown[] = [];
  if (options.checkout) {
    filters.push(getCheckoutPredicate("o", options.checkout));
  }
  if (options.status) {
    filterValues.push(options.status);
    filters.push(`o.status = $${filterValues.length}`);
  }
  if (options.paymentMethod === "UNKNOWN") {
    filters.push("(o.payment_method is null or btrim(o.payment_method) = '')");
  } else if (options.paymentMethod === "OTHER") {
    filters.push(
      "(o.payment_method is not null and btrim(o.payment_method) <> '' and upper(o.payment_method) not in ('PIX', 'CREDIT_CARD'))"
    );
  } else if (options.paymentMethod) {
    filterValues.push(options.paymentMethod);
    filters.push(`upper(o.payment_method) = $${filterValues.length}`);
  }
  if (search) {
    filterValues.push(`%${search}%`);
    const parameter = `$${filterValues.length}`;
    filters.push(`(
      o.id::text ilike ${parameter}
      or o.provider_checkout_id ilike ${parameter}
      or o.provider_payment_id ilike ${parameter}
      or o.customer_email ilike ${parameter}
      or o.customer_name ilike ${parameter}
    )`);
  }
  const values = [...filterValues];
  values.push(pageSize + 1, (page - 1) * pageSize);
  const paginationClause = `limit $${values.length - 1} offset $${values.length}`;
  const { rows } = await getPool().query<{
    amount_in_cents: number;
    checkout_attempt_count: number;
    checkout_error_message: string | null;
    checkout_last_attempt_at: Date | null;
    checkout_next_attempt_at: Date | null;
    checkout_status: string;
    course_id: string;
    course_title: string;
    created_at: Date;
    customer_email: string | null;
    customer_name: string | null;
    fee_amount_in_cents: number | null;
    has_pending_buyer_identity_review?: boolean;
    id: string;
    installment_payment_count?: number;
    installment_payments_synced_at: Date | null;
    net_amount_in_cents: number | null;
    payment_installment_count: number | null;
    paid_at: Date | null;
    paid_amount_in_cents: number | null;
    payment_method: string | null;
    provider_checkout_id: string | null;
    provider_installment_id: string | null;
    provider_payment_id: string | null;
    provider_payment_status: string | null;
    provider_refund_created_at: string | null;
    provider_refund_end_to_end_id: string | null;
    provider_refund_receipt_url: string | null;
    provider_refund_status: string | null;
    provider_risk_status: string | null;
    refund_confirmed_at: Date | null;
    refund_error_code: string | null;
    refund_request_created_at: Date | null;
    refund_request_status: string | null;
    provider_refunded_amount_in_cents: number | null;
    status: string;
    total_count: number;
  }>(
    `
      select o.id, c.id as course_id, c.title as course_title,
              o.created_at, o.checkout_attempt_count, o.checkout_last_attempt_at,
              o.checkout_next_attempt_at, o.checkout_error_message,
              o.provider_checkout_id, o.provider_installment_id,
              o.provider_payment_id, o.status,
              o.checkout_status, o.provider_payment_status, o.provider_risk_status,
              o.payment_method,
              o.amount_in_cents, o.paid_amount_in_cents, o.net_amount_in_cents,
              o.payment_installment_count,
              o.fee_amount_in_cents, o.customer_email, o.customer_name, o.paid_at,
              rr.status as refund_request_status, rr.created_at as refund_request_created_at,
              rr.confirmed_at as refund_confirmed_at, rr.provider_refund_status,
              rr.provider_refund_created_at, rr.provider_refund_end_to_end_id,
               rr.provider_refund_receipt_url,
               rr.provider_refunded_amount_in_cents, rr.error_message as refund_error_code,
              installment_summary.installment_payment_count,
              installment_summary.installment_payments_synced_at,
              exists (
                select 1
                from payment_reviews pending_identity_review
                where pending_identity_review.order_id = o.id
                  and pending_identity_review.status = 'pending'
                  and pending_identity_review.type = 'buyer_identity'
              ) as has_pending_buyer_identity_review,
               count(*) over()::int as total_count
      from orders o
      join courses c on c.id = o.course_id
      left join refund_requests rr on rr.order_id = o.id
      left join lateral (
        select
          count(*)::int as installment_payment_count,
          max(synced_at) as installment_payments_synced_at
        from asaas_installment_payments
        where order_id = o.id
      ) installment_summary on true
      ${filters.length ? `where ${filters.join(" and ")}` : ""}
       order by o.created_at desc, o.id desc
      ${paginationClause}
    `,
    values
  );

  let totalCount = rows[0]?.total_count ?? 0;
  if (rows.length === 0) {
    const countResult = await getPool().query<{ total_count: number }>(
      `
        select count(*)::int as total_count
        from orders o
        join courses c on c.id = o.course_id
        ${filters.length ? `where ${filters.join(" and ")}` : ""}
      `,
      filterValues
    );
    totalCount = countResult.rows[0]?.total_count ?? 0;
  }

  return {
    hasNextPage: rows.length > pageSize,
    orders: rows.slice(0, pageSize).map((row) => ({
      amountInCents: row.amount_in_cents,
      checkoutAttemptCount: row.checkout_attempt_count,
      checkoutErrorMessage: row.checkout_error_message,
      checkoutLastAttemptAt: row.checkout_last_attempt_at,
      checkoutNextAttemptAt: row.checkout_next_attempt_at,
      checkoutStatus: row.checkout_status,
      courseId: row.course_id,
      courseTitle: row.course_title,
      createdAt: row.created_at,
      customerEmail: row.customer_email,
      customerName: row.customer_name,
      feeAmountInCents: row.fee_amount_in_cents,
      ...(row.has_pending_buyer_identity_review === undefined
        ? {}
        : {
            hasPendingBuyerIdentityReview:
              row.has_pending_buyer_identity_review,
          }),
      id: row.id,
      ...(row.installment_payment_count === undefined
        ? {}
        : { installmentPaymentCount: row.installment_payment_count }),
      ...(row.installment_payments_synced_at === undefined
        ? {}
        : {
            installmentPaymentsSyncedAt: row.installment_payments_synced_at,
          }),
      netAmountInCents: row.net_amount_in_cents,
      paymentInstallmentCount: row.payment_installment_count,
      paidAt: row.paid_at,
      paidAmountInCents: row.paid_amount_in_cents,
      paymentMethod: row.payment_method,
      providerCheckoutId: row.provider_checkout_id,
      providerInstallmentId: row.provider_installment_id,
      providerPaymentId: row.provider_payment_id,
      providerPaymentStatus: row.provider_payment_status,
      providerRiskStatus: row.provider_risk_status,
      providerRefundEndToEndId: row.provider_refund_end_to_end_id,
      providerRefundCreatedAt: row.provider_refund_created_at,
      providerRefundReceiptUrl: row.provider_refund_receipt_url,
      providerRefundStatus: row.provider_refund_status,
      refundConfirmedAt: row.refund_confirmed_at,
      refundErrorCode: row.refund_error_code,
      refundRequestCreatedAt: row.refund_request_created_at,
      refundRequestStatus: row.refund_request_status,
      refundedAmountInCents: row.provider_refunded_amount_in_cents,
      status: row.status,
    })),
    totalCount,
  };
};

const readInstallmentPayments = async (
  orderId: string
): Promise<AdminInstallmentPayment[]> => {
  const { rows } = await getPool().query<{
    anticipated: boolean | null;
    client_payment_date: string | null;
    due_date: string | null;
    fee_amount_in_cents: number | null;
    installment_number: number | null;
    net_value_in_cents: number | null;
    payment_date: string | null;
    provider_payment_id: string;
    status: string;
    value_in_cents: number;
  }>(
    `
      select
        ip.anticipated,
        ip.client_payment_date,
        ip.due_date,
        ip.fee_amount_in_cents,
        ip.installment_number,
        ip.net_value_in_cents,
        ip.payment_date,
        ip.provider_payment_id,
        ip.status,
        ip.value_in_cents
      from asaas_installment_payments ip
      join orders o on o.id = ip.order_id
      where ip.order_id = $1 and o.provider = 'asaas'
      order by ip.installment_number nulls last, ip.provider_payment_id
    `,
    [orderId]
  );

  return rows.map((row) => ({
    anticipated: row.anticipated,
    clientPaymentDate: row.client_payment_date,
    dueDate: row.due_date,
    feeAmountInCents: row.fee_amount_in_cents,
    installmentNumber: row.installment_number,
    netValueInCents: row.net_value_in_cents,
    paymentDate: row.payment_date,
    providerPaymentId: row.provider_payment_id,
    status: row.status,
    valueInCents: row.value_in_cents,
  }));
};

export const getAdminInstallmentPayments = async (
  orderId: string
): Promise<AdminInstallmentPayment[]> => {
  await requirePermission("viewFinancials");
  return await readInstallmentPayments(orderId);
};

const readFinancialHealth = async (): Promise<AdminFinancialHealthSummary> => {
  const { rows } = await getPool().query<{
    abandoned_checkout_orders: number;
    disputed_orders: number;
    failed_webhooks: number;
    paid_orders: number;
    paid_revenue_in_cents: number | string;
    pending_orders: number;
    pending_revenue_in_cents: number | string;
    ready_webhooks: number;
    refunded_orders: number;
    retryable_webhooks: number;
    total_orders: number;
  }>(`
    select
      count(*)::int as total_orders,
      count(*) filter (where status = 'paid')::int as paid_orders,
      coalesce(sum(coalesce(paid_amount_in_cents, amount_in_cents)) filter (where status = 'paid'), 0)::bigint as paid_revenue_in_cents,
      count(*) filter (where ${getCheckoutPredicate("", "open")})::int as pending_orders,
      coalesce(sum(amount_in_cents) filter (
        where ${getCheckoutPredicate("", "open")}
      ), 0)::bigint as pending_revenue_in_cents,
      count(*) filter (
        where ${getCheckoutPredicate("", "closed")}
      )::int as abandoned_checkout_orders,
      count(*) filter (where status = 'disputed')::int as disputed_orders,
      count(*) filter (where status = 'refunded')::int as refunded_orders,
      (select count(*)::int from webhook_events where provider = 'asaas' and status = 'failed') as failed_webhooks,
      (select count(*)::int from webhook_events where provider = 'asaas' and status = 'retryable') as retryable_webhooks,
      (select count(*)::int from webhook_events where provider = 'asaas' and status in ('received', 'processing')) as ready_webhooks
    from orders
  `);
  const row = rows[0];
  const totalOrders = row?.total_orders ?? 0;
  const paidOrders = row?.paid_orders ?? 0;
  const paidRevenueInCents = Number(row?.paid_revenue_in_cents ?? 0);

  return {
    abandonedCheckoutOrders: row?.abandoned_checkout_orders ?? 0,
    averagePaidTicketInCents: paidOrders
      ? Math.round(paidRevenueInCents / paidOrders)
      : 0,
    checkoutConversionPercent: totalOrders
      ? Math.round((paidOrders / totalOrders) * 100)
      : 0,
    disputedOrders: row?.disputed_orders ?? 0,
    failedWebhooks: row?.failed_webhooks ?? 0,
    paidOrders,
    paidRevenueInCents,
    pendingOrders: row?.pending_orders ?? 0,
    pendingRevenueInCents: Number(row?.pending_revenue_in_cents ?? 0),
    readyWebhooks: row?.ready_webhooks ?? 0,
    refundedOrders: row?.refunded_orders ?? 0,
    retryableWebhooks: row?.retryable_webhooks ?? 0,
    totalOrders,
  };
};

const readFinancialAnalytics = async (
  period: AdminFinancialPeriod
): Promise<AdminFinancialAnalytics> => {
  const periodEnd = new Date();
  const fromDate = getAdminFinancialPeriodStart(period, periodEnd);
  const { rows } = await getPool().query<{
    fees_in_cents: number | string;
    gross_received_in_cents: number | string;
    missing_fee_evidence_orders: number;
    paid_orders: number;
    pending_orders: number;
    pending_revenue_in_cents: number | string;
    refunded_orders: number;
    refunded_revenue_in_cents: number | string;
  }>(
    `
      with received_orders as (
        select
          count(*) filter (
            where status in ('paid', 'refunded', 'disputed')
              and ($1::timestamptz is null or coalesce(paid_at, created_at) >= $1::timestamptz)
              and coalesce(paid_at, created_at) <= $2::timestamptz
          )::int as paid_orders,
          coalesce(sum(coalesce(paid_amount_in_cents, amount_in_cents)) filter (
            where status in ('paid', 'refunded', 'disputed')
              and ($1::timestamptz is null or coalesce(paid_at, created_at) >= $1::timestamptz)
              and coalesce(paid_at, created_at) <= $2::timestamptz
          ), 0)::bigint as gross_received_in_cents,
          coalesce(sum(coalesce(fee_amount_in_cents, 0)) filter (
            where status in ('paid', 'refunded', 'disputed')
              and ($1::timestamptz is null or coalesce(paid_at, created_at) >= $1::timestamptz)
              and coalesce(paid_at, created_at) <= $2::timestamptz
          ), 0)::bigint as fees_in_cents,
          count(*) filter (
            where status in ('paid', 'refunded', 'disputed')
              and ($1::timestamptz is null or coalesce(paid_at, created_at) >= $1::timestamptz)
              and coalesce(paid_at, created_at) <= $2::timestamptz
              and (fee_amount_in_cents is null or net_amount_in_cents is null)
          )::int as missing_fee_evidence_orders,
          count(*) filter (
            where ${getCheckoutPredicate("", "open")}
              and ($1::timestamptz is null or created_at >= $1::timestamptz)
              and created_at <= $2::timestamptz
          )::int as pending_orders,
          coalesce(sum(amount_in_cents) filter (
            where ${getCheckoutPredicate("", "open")}
              and ($1::timestamptz is null or created_at >= $1::timestamptz)
              and created_at <= $2::timestamptz
          ), 0)::bigint as pending_revenue_in_cents
        from orders
      ),
      refunds as (
        select
          count(*) filter (
            where (
              rr.status = 'confirmed'
              or o.status = 'refunded'
            )
              and ($1::timestamptz is null or coalesce(rr.confirmed_at, o.refunded_at) >= $1::timestamptz)
              and coalesce(rr.confirmed_at, o.refunded_at) <= $2::timestamptz
          )::int as refunded_orders,
          coalesce(sum(
            case
              when rr.status = 'confirmed' then coalesce(
                rr.provider_refunded_amount_in_cents,
                coalesce(o.paid_amount_in_cents, o.amount_in_cents)
              )
              when o.status = 'refunded' then
                coalesce(o.paid_amount_in_cents, o.amount_in_cents)
              else 0
            end
          ) filter (
            where (
              rr.status = 'confirmed'
              or o.status = 'refunded'
            )
              and ($1::timestamptz is null or coalesce(rr.confirmed_at, o.refunded_at) >= $1::timestamptz)
              and coalesce(rr.confirmed_at, o.refunded_at) <= $2::timestamptz
          ), 0)::bigint as refunded_revenue_in_cents
        from orders o
        left join refund_requests rr on rr.order_id = o.id
      )
      select received_orders.*, refunds.*
      from received_orders cross join refunds
    `,
    [fromDate, periodEnd]
  );
  const row = rows[0];
  const grossReceivedInCents = Number(row?.gross_received_in_cents ?? 0);
  const feesInCents = Number(row?.fees_in_cents ?? 0);
  const refundedRevenueInCents = Number(row?.refunded_revenue_in_cents ?? 0);
  const paidOrders = row?.paid_orders ?? 0;
  const averageReceivedTicketInCents = paidOrders
    ? Math.round(grossReceivedInCents / paidOrders)
    : 0;
  const refundedOrders = row?.refunded_orders ?? 0;
  const refundRatePercent = paidOrders
    ? Number(((refundedOrders / paidOrders) * 100).toFixed(1))
    : null;

  return {
    averageReceivedTicketInCents,
    estimatedNetRevenueInCents:
      grossReceivedInCents - feesInCents - refundedRevenueInCents,
    feesInCents,
    grossReceivedInCents,
    missingFeeEvidenceOrders: row?.missing_fee_evidence_orders ?? 0,
    paidOrders,
    pendingOrders: row?.pending_orders ?? 0,
    pendingRevenueInCents: Number(row?.pending_revenue_in_cents ?? 0),
    period,
    periodLabel: getAdminFinancialPeriodLabel(period),
    refundRatePercent,
    refundedOrders,
    refundedRevenueInCents,
  };
};

const readPaymentReviews = async (
  options: AdminPaymentReviewQuery = {}
): Promise<AdminPaymentReviewPage> => {
  const requestedPage = Math.trunc(options.page ?? 1);
  const page = Number.isFinite(requestedPage)
    ? Math.min(MAX_ADMIN_REVIEW_PAGE, Math.max(1, requestedPage))
    : 1;
  const requestedPageSize = Math.trunc(
    options.pageSize ?? DEFAULT_ADMIN_REVIEW_PAGE_SIZE
  );
  const pageSize = Number.isFinite(requestedPageSize)
    ? Math.min(MAX_ADMIN_REVIEW_PAGE_SIZE, Math.max(1, requestedPageSize))
    : DEFAULT_ADMIN_REVIEW_PAGE_SIZE;
  const offset = (page - 1) * pageSize;
  interface AdminPaymentReviewRow {
    amount_in_cents: number;
    course_title: string;
    created_at: Date;
    customer_email: string | null;
    customer_name: string | null;
    decision_reason: string | null;
    id: string;
    observed_amount_in_cents?: number | null;
    observed_fee_amount_in_cents?: number | null;
    observed_net_amount_in_cents?: number | null;
    order_id: string;
    order_status: string;
    paid_amount_in_cents: number | null;
    provider_checkout_id: string | null;
    provider_payment_id: string | null;
    provider_payment_status: string | null;
    reason: string;
    resolved_at: Date | null;
    resolved_by_email: string | null;
    status: "approved" | "pending" | "rejected";
    total_count: number;
    type: unknown;
  }
  const reviewSelect = `
    select pr.id, pr.order_id, pr.type, pr.status, pr.reason,
           pr.created_at, pr.decision_reason, pr.resolved_at,
           o.provider_checkout_id, o.provider_payment_id, o.provider_payment_status,
           o.amount_in_cents, o.paid_amount_in_cents, o.status as order_status,
           pr.observed_amount_in_cents, pr.observed_net_amount_in_cents,
           pr.observed_fee_amount_in_cents,
           o.customer_email, o.customer_name, c.title as course_title,
           resolved.email as resolved_by_email,
           count(*) over()::int as total_count
    from payment_reviews pr
    join orders o on o.id = pr.order_id
    join courses c on c.id = o.course_id
    left join users resolved on resolved.id = pr.resolved_by_user_id
  `;
  const [pendingResult, historyResult] = await Promise.all([
    getPool().query<AdminPaymentReviewRow>(
      `${reviewSelect}
       where pr.status = 'pending'
       order by pr.created_at asc, pr.id asc
       limit $1 offset $2`,
      [pageSize + 1, offset]
    ),
    getPool().query<AdminPaymentReviewRow>(
      `${reviewSelect}
       where pr.status <> 'pending'
       order by coalesce(pr.resolved_at, pr.created_at) desc, pr.id desc
       limit 5`
    ),
  ]);
  let pendingTotalCount = pendingResult.rows[0]?.total_count ?? 0;
  if (pendingResult.rows.length === 0 && page > 1) {
    const countResult = await getPool().query<{ total_count: number }>(
      "select count(*)::int as total_count from payment_reviews where status = 'pending'"
    );
    pendingTotalCount = countResult.rows[0]?.total_count ?? 0;
  }
  const mapReview = (row: AdminPaymentReviewRow): AdminPaymentReview => ({
    amountInCents: row.amount_in_cents,
    courseTitle: row.course_title,
    createdAt: row.created_at,
    customerEmail: row.customer_email,
    customerName: row.customer_name,
    id: row.id,
    orderId: row.order_id,
    orderStatus: row.order_status,
    ...(row.observed_amount_in_cents === undefined
      ? {}
      : { observedAmountInCents: row.observed_amount_in_cents }),
    ...(row.observed_fee_amount_in_cents === undefined
      ? {}
      : { observedFeeAmountInCents: row.observed_fee_amount_in_cents }),
    ...(row.observed_net_amount_in_cents === undefined
      ? {}
      : { observedNetAmountInCents: row.observed_net_amount_in_cents }),
    paidAmountInCents: row.paid_amount_in_cents,
    providerCheckoutId: row.provider_checkout_id,
    providerPaymentId: row.provider_payment_id,
    providerPaymentStatus: row.provider_payment_status,
    reason: row.reason,
    status: row.status,
    type: parsePaymentReviewType(row.type),
  });
  const mapHistory = (
    row: AdminPaymentReviewRow
  ): AdminPaymentReviewHistory => {
    if (row.status === "pending") {
      throw new Error("Historico de revisao financeira invalido.");
    }
    return {
      ...mapReview(row),
      decisionReason: row.decision_reason,
      resolvedAt: row.resolved_at,
      resolvedByEmail: row.resolved_by_email,
      status: row.status,
    };
  };

  return {
    hasNextPage: pendingResult.rows.length > pageSize,
    history: historyResult.rows.map(mapHistory),
    historyTotalCount: historyResult.rows[0]?.total_count ?? 0,
    page,
    pageSize,
    reviews: pendingResult.rows.slice(0, pageSize).map(mapReview),
    totalCount: pendingTotalCount,
  };
};

const readCourseRevenue = async (): Promise<AdminCourseRevenueData> => {
  const { rows } = await getPool().query<{
    course_id: string;
    course_title: string;
    total_orders: number;
    paid_orders: number;
    total_revenue_in_cents: number;
  }>(
    `
      select c.id as course_id, c.title as course_title,
             count(o.id)::int as total_orders,
             count(case when o.status = 'paid' then 1 end)::int as paid_orders,
             coalesce(sum(case when o.status = 'paid' then coalesce(o.paid_amount_in_cents, o.amount_in_cents) else 0 end), 0)::bigint as total_revenue_in_cents
       from courses c
       left join orders o on o.course_id = c.id
       group by c.id, c.title
       order by total_revenue_in_cents desc, c.title asc, c.id asc
    `
  );
  return {
    courses: rows.map((row) => ({
      courseId: row.course_id,
      courseTitle: row.course_title,
      totalOrders: row.total_orders,
      paidOrders: row.paid_orders,
      totalRevenueInCents: Number(row.total_revenue_in_cents),
    })),
  };
};

const readFaqs = async (): Promise<AdminFaq[]> => {
  const { rows } = await getPool().query<{
    answer: string;
    id: string;
    is_published: boolean;
    question: string;
    sort_order: number;
  }>(
    "select id, question, answer, sort_order, is_published from faq_items order by sort_order, question"
  );

  return rows.map((row) => ({
    answer: row.answer,
    id: row.id,
    isPublished: row.is_published,
    question: row.question,
    sortOrder: row.sort_order,
  }));
};

const readSettings = async (): Promise<AdminSettings> => {
  const { rows } = await getPool().query<{
    certificate_signer_name: string | null;
    certificate_signer_role: string | null;
  }>(
    "select certificate_signer_name, certificate_signer_role from app_settings where id = 'global' limit 1"
  );
  const settings = rows[0];
  const issuer = await getPool().query<{
    cnpj: string;
    display_name: string;
    legal_name: string;
  }>(
    "select cnpj, display_name, legal_name from certificate_issuer_profiles where id = 'global' limit 1"
  );

  return {
    certificateSignerName: settings?.certificate_signer_name ?? null,
    certificateSignerRole: settings?.certificate_signer_role ?? null,
    issuerCnpj: issuer.rows[0]?.cnpj ?? null,
    issuerDisplayName: issuer.rows[0]?.display_name ?? null,
    issuerLegalName: issuer.rows[0]?.legal_name ?? null,
  };
};

const readAuditLogs = async (): Promise<AdminAuditLog[]> => {
  const { rows } = await getPool().query<{
    action: string;
    actor_email: string | null;
    created_at: Date;
    target_id: string | null;
    target_name: string | null;
    target_type: string;
  }>(`
    select *
    from (
      select a.action, a.target_type, a.target_id, a.created_at, u.email as actor_email,
             coalesce(
               (select title from courses where id::text = a.target_id),
               (select title from modules where id::text = a.target_id),
               (select title from lessons where id::text = a.target_id),
               (select name from users where id::text = a.target_id),
               (select question from faq_items where id::text = a.target_id),
               (select u2.email from enrollments e2 join users u2 on u2.id = e2.user_id where e2.id::text = a.target_id limit 1)
             ) as target_name
      from audit_logs a
      left join users u on u.id = a.actor_user_id

      union all

      select
        concat('enrollment.', ee.event_type) as action,
        'enrollment' as target_type,
        ee.enrollment_id::text as target_id,
        ee.created_at,
        actor.email as actor_email,
        nullif(concat_ws(' - ', student.email, c.title), '') as target_name
      from enrollment_events ee
      left join users actor on actor.id = ee.actor_user_id
      left join users student on student.id = ee.user_id
      left join courses c on c.id = ee.course_id
      where ee.event_type in ('payment_paid', 'payment_refunded', 'payment_disputed')
    ) audit_feed
    order by created_at desc
    limit 30
  `);

  return rows.map((row) => ({
    action: row.action,
    actorEmail: row.actor_email,
    createdAt: row.created_at,
    targetId: row.target_id,
    targetName: row.target_name,
    targetType: row.target_type,
  }));
};

export const getAdminStatementImportHistory = async (): Promise<
  AdminStatementImportHistory[]
> => {
  await requirePermission("manageFinancialOperations");
  const { rows } = await getPool().query<{
    actor_email: string | null;
    completed_at: Date;
    finish_date: string;
    inserted: string;
    resumed_from_offset: string;
    start_date: string;
    updated: string;
  }>(`
    select
      a.created_at as completed_at,
      split_part(a.target_id, ':', 1) as start_date,
      split_part(a.target_id, ':', 2) as finish_date,
      u.email as actor_email,
      coalesce(nullif(a.metadata->>'inserted', ''), '0') as inserted,
      coalesce(nullif(a.metadata->>'updated', ''), '0') as updated,
      coalesce(nullif(a.metadata->>'resumedFromOffset', ''), '0') as resumed_from_offset
    from audit_logs a
    left join users u on u.id = a.actor_user_id
    where a.action = 'asaas.statement_imported'
      and a.target_type = 'asaas_statement'
      and a.target_id is not null
    order by a.created_at desc
    limit 5
  `);

  return rows.map((row) => ({
    actorEmail: row.actor_email,
    completedAt: row.completed_at,
    finishDate: row.finish_date,
    inserted: Number(row.inserted),
    resumedFromOffset: Number(row.resumed_from_offset),
    startDate: row.start_date,
    updated: Number(row.updated),
  }));
};

export const getAdminStatementImportProgress =
  async (): Promise<AdminStatementImportProgress | null> => {
    await requirePermission("manageFinancialOperations");
    const { rows } = await getPool().query<{
      actor_email: string | null;
      finish_date: string;
      next_offset: number;
      start_date: string;
      updated_at: Date;
    }>(`
    select c.start_date, c.finish_date, c.next_offset, c.updated_at,
           u.email as actor_email
    from asaas_statement_import_cursors c
    left join users u on u.id = c.started_by_user_id
    where c.status = 'running'
    order by c.updated_at desc
    limit 1
  `);
    const row = rows[0];
    return row
      ? {
          actorEmail: row.actor_email,
          finishDate: row.finish_date,
          nextOffset: row.next_offset,
          startDate: row.start_date,
          updatedAt: row.updated_at,
        }
      : null;
  };

const readStudentProfiles = async (
  options: AdminStudentsQuery = {}
): Promise<{
  hasNextPage: boolean;
  page: number;
  pageSize: number;
  profiles: Array<{
    email: string;
    lastAccessAt: Date | null;
    name: string;
    platformBlockedAt: Date | null;
    platformBlockedReason: string | null;
    userId: string;
  }>;
  search: string;
  totalCount: number;
}> => {
  const requestedPage = Math.trunc(options.page ?? 1);
  const page = Number.isFinite(requestedPage)
    ? Math.min(MAX_ADMIN_STUDENT_PAGE, Math.max(1, requestedPage))
    : 1;
  const requestedPageSize = Math.trunc(
    options.pageSize ?? DEFAULT_ADMIN_STUDENT_PAGE_SIZE
  );
  const pageSize = Number.isFinite(requestedPageSize)
    ? Math.min(MAX_ADMIN_STUDENT_PAGE_SIZE, Math.max(1, requestedPageSize))
    : DEFAULT_ADMIN_STUDENT_PAGE_SIZE;
  const search = options.search?.trim() ?? "";
  const offset = (page - 1) * pageSize;
  const { rows } = await getPool().query<{
    email: string;
    last_access_at: Date | null;
    name: string;
    platform_blocked_at: Date | null;
    platform_blocked_reason: string | null;
    user_id: string;
    total_count: number;
  }>(
    `
      select u.id as user_id, u.name, u.email, p.last_access_at,
             p.platform_blocked_at, p.platform_blocked_reason,
             count(*) over()::int as total_count
      from profiles p
      join users u on u.id = p.user_id
      where p.role = 'student'
        and ($1 = '' or u.name ilike $2 or u.email ilike $2)
      order by u.name asc, u.id asc
      limit $3 offset $4
    `,
    [search, `%${search}%`, pageSize + 1, offset]
  );
  let totalCount = rows[0]?.total_count ?? 0;
  if (rows.length === 0 && page > 1) {
    const countResult = await getPool().query<{ total_count: number }>(
      `
        select count(*)::int as total_count
        from profiles p
        join users u on u.id = p.user_id
        where p.role = 'student'
          and ($1 = '' or u.name ilike $2 or u.email ilike $2)
      `,
      [search, `%${search}%`]
    );
    totalCount = countResult.rows[0]?.total_count ?? 0;
  }

  return {
    hasNextPage: rows.length > pageSize,
    page,
    pageSize,
    profiles: rows.slice(0, pageSize).map((row) => ({
      email: row.email,
      lastAccessAt: row.last_access_at,
      name: row.name,
      platformBlockedAt: row.platform_blocked_at,
      platformBlockedReason: row.platform_blocked_reason,
      userId: row.user_id,
    })),
    search,
    totalCount,
  };
};

const readAdminStudentAccessSummary =
  async (): Promise<AdminStudentAccessSummary> => {
    const { rows } = await getPool().query<{
      active_students: number;
      expiring_soon_students: number;
      total_students: number;
      without_active_access_students: number;
    }>(`
    with student_summary as (
      select
        p.user_id,
        p.platform_blocked_at,
        count(e.id) filter (
          where e.status = 'active'
            and e.starts_at <= now()
            and e.expires_at >= now()
            and c.status = 'active'
            and exists (
              select 1
              from course_publications cp
              where cp.course_id = c.id and cp.status = 'published'
            )
        )::int as active_enrollments,
        max(e.expires_at) filter (
          where e.status = 'active'
            and e.starts_at <= now()
            and e.expires_at >= now()
            and c.status = 'active'
            and exists (
              select 1
              from course_publications cp
              where cp.course_id = c.id and cp.status = 'published'
            )
        ) as latest_expiration
      from profiles p
      left join enrollments e on e.user_id = p.user_id
      left join courses c on c.id = e.course_id
      where p.role = 'student'
      group by p.user_id, p.platform_blocked_at
    )
    select
      count(*)::int as total_students,
      count(*) filter (
        where active_enrollments > 0 and platform_blocked_at is null
      )::int as active_students,
      count(*) filter (
        where active_enrollments = 0 or platform_blocked_at is not null
      )::int as without_active_access_students,
        count(*) filter (
          where active_enrollments > 0
            and platform_blocked_at is null
            and latest_expiration >= now()
            and latest_expiration <= now() + interval '30 days'
      )::int as expiring_soon_students
    from student_summary
  `);
    const row = rows[0];

    return {
      activeStudents: row?.active_students ?? 0,
      expiringSoonStudents: row?.expiring_soon_students ?? 0,
      totalStudents: row?.total_students ?? 0,
      withoutActiveAccessStudents: row?.without_active_access_students ?? 0,
    };
  };

export const getAdminDashboardProjection = async (): Promise<{
  courseHealth: AdminDashboardCourseHealthProjection;
  operations: AdminDashboardOperations;
  recentCertificates: AdminDashboardRecentCertificate[];
  recentOrders: AdminDashboardRecentOrder[];
}> => {
  await requirePermission("manageContent");
  await requirePermission("viewFinancials");
  await requirePermission("viewGlobalAudit");
  const [courseHealth, recentOrders, recentCertificates, operations] =
    await Promise.all([
      readDashboardCourseHealth(),
      readDashboardRecentOrders(),
      readDashboardRecentCertificates(),
      readDashboardOperations(),
    ]);
  return { courseHealth, operations, recentCertificates, recentOrders };
};

export const getAdminStudentsData = async (
  options: AdminStudentsQuery = {}
): Promise<{
  accessSummary: AdminStudentAccessSummary;
  enrollments: AdminEnrollment[];
  hasNextPage: boolean;
  page: number;
  pageSize: number;
  search: string;
  students: AdminStudentSummary[];
  totalCount: number;
}> => {
  await requirePermission("manageEnrollmentAccess");
  const [profilePage, accessSummary] = await Promise.all([
    readStudentProfiles(options),
    readAdminStudentAccessSummary(),
  ]);
  const enrollments = await readEnrollments(
    undefined,
    profilePage.profiles.map((profile) => profile.userId)
  );

  return {
    accessSummary,
    enrollments,
    hasNextPage: profilePage.hasNextPage,
    page: profilePage.page,
    pageSize: profilePage.pageSize,
    search: profilePage.search,
    students: summarizeAdminStudents(enrollments, profilePage.profiles),
    totalCount: profilePage.totalCount,
  };
};

export const getAdminAuditData = async ({
  outboxPage = 1,
}: {
  outboxPage?: number;
} = {}): Promise<{
  auditLogs: AdminAuditLog[];
  operationalBacklog: OperationalBacklogSnapshot;
  outboxDeadLetters: OutboxDeadLetterPage;
}> => {
  await requirePermission("viewGlobalAudit");
  const [auditLogs, outboxDeadLetters, operationalBacklog] = await Promise.all([
    readAuditLogs(),
    listOutboxDeadLetters({ page: outboxPage }),
    getOperationalBacklogSnapshot(),
  ]);
  return { auditLogs, operationalBacklog, outboxDeadLetters };
};

export const getAdminWebhookEvents = async (
  options: AdminWebhookEventQuery = {}
): Promise<AdminWebhookEventPage> => {
  await requirePermission("viewGlobalAudit");

  const requestedPage = Math.trunc(options.page ?? 1);
  const page = Number.isFinite(requestedPage)
    ? Math.min(MAX_ADMIN_REVIEW_PAGE, Math.max(1, requestedPage))
    : 1;
  const requestedPageSize = Math.trunc(options.pageSize ?? 20);
  const pageSize = Number.isFinite(requestedPageSize)
    ? Math.min(MAX_ADMIN_REVIEW_PAGE_SIZE, Math.max(1, requestedPageSize))
    : 20;
  const search = options.search?.trim() ?? "";
  const { rows } = await getPool().query<{
    attempt_count: number;
    created_at: Date;
    error_message: string | null;
    event_key: string;
    event_name: string;
    id: string;
    next_attempt_at: Date | null;
    status: string;
    total_count: number;
  }>(
    `
      select
        id,
        event_key,
        event_name,
        status,
        attempt_count,
        next_attempt_at,
        error_message,
        created_at,
        count(*) over()::int as total_count
      from webhook_events
      where provider = 'asaas'
        and status in ('failed', 'retryable')
        and (
          $1 = ''
          or event_key ilike $2
          or event_name ilike $2
          or error_message ilike $2
        )
      order by created_at desc, id desc
      limit $3 offset $4
    `,
    [search, `%${search}%`, pageSize + 1, (page - 1) * pageSize]
  );

  let totalCount = rows[0]?.total_count ?? 0;
  if (rows.length === 0 && page > 1) {
    const countResult = await getPool().query<{ total_count: number }>(
      `
        select count(*)::int as total_count
        from webhook_events
        where provider = 'asaas'
          and status in ('failed', 'retryable')
          and (
            $1 = ''
            or event_key ilike $2
            or event_name ilike $2
            or error_message ilike $2
          )
      `,
      [search, `%${search}%`]
    );
    totalCount = countResult.rows[0]?.total_count ?? 0;
  }

  return {
    events: rows.slice(0, pageSize).map((row) => ({
      attemptCount: row.attempt_count,
      createdAt: row.created_at,
      errorMessage: row.error_message,
      eventKey: row.event_key,
      eventName: row.event_name,
      id: row.id,
      nextAttemptAt: row.next_attempt_at,
      status: row.status,
    })),
    hasNextPage: rows.length > pageSize,
    page,
    pageSize,
    search,
    totalCount,
  };
};

export const getAdminSettingsData = async (): Promise<{
  settings: AdminSettings;
}> => {
  await requirePermission("manageSettings");
  return { settings: await readSettings() };
};

export const getAdminCourseCatalogData = async (
  options: AdminCourseCatalogQuery = {}
): Promise<{
  courses: AdminCourseCatalogCard[];
  hasNextPage: boolean;
  page: number;
  pageSize: number;
  totalCount: number;
}> => {
  await requirePermission("manageContent");
  const requestedPage = Math.trunc(options.page ?? 1);
  const page = Number.isFinite(requestedPage)
    ? Math.min(MAX_ADMIN_COURSE_PAGE, Math.max(1, requestedPage))
    : 1;
  const requestedPageSize = Math.trunc(
    options.pageSize ?? DEFAULT_ADMIN_COURSE_PAGE_SIZE
  );
  const pageSize = Number.isFinite(requestedPageSize)
    ? Math.min(MAX_ADMIN_COURSE_PAGE_SIZE, Math.max(1, requestedPageSize))
    : DEFAULT_ADMIN_COURSE_PAGE_SIZE;
  const { cards, hasNextPage, totalCount } = await readCourseCatalogCards({
    page,
    pageSize,
  });
  return {
    courses: cards,
    hasNextPage,
    page,
    pageSize,
    totalCount,
  };
};

export const getAdminFaqData = async (): Promise<{ faqs: AdminFaq[] }> => {
  await requirePermission("manageContent");
  return { faqs: await readFaqs() };
};

export const getAdminFinancialOverviewData = async (
  reviewQuery: AdminPaymentReviewQuery = {}
): Promise<AdminFinancialOverviewData> => {
  await requirePermission("viewFinancials");
  const [financialHealth, paymentReviews, coursesRevenue] = await Promise.all([
    readFinancialHealth(),
    readPaymentReviews(reviewQuery),
    readCourseRevenue(),
  ]);

  return { coursesRevenue, financialHealth, paymentReviews };
};

export const getAdminFinancialAnalysisData = async (
  period: AdminFinancialPeriod
): Promise<AdminFinancialAnalysisData> => {
  await requirePermission("viewFinancials");
  const analytics = await readFinancialAnalytics(period);

  return { analytics };
};

export const getAdminFinancialOrdersData = async (
  orderQuery: AdminOrderQuery = {}
): Promise<AdminFinancialOrdersData> => {
  await requirePermission("viewFinancials");
  const orderPage = await readOrders(orderQuery);

  return {
    orders: orderPage.orders.slice(0, DEFAULT_ADMIN_ORDER_PAGE_SIZE),
    ordersHasNextPage: orderPage.hasNextPage,
    ordersTotalCount: orderPage.totalCount,
  };
};

export const getAdminCourseOverviewSummary = async (
  courseId: string
): Promise<AdminCourseOverviewSummary> => {
  await requirePermission("manageContent");
  const { rows } = await getPool().query<{
    active_enrollment_count: number;
    paid_order_count: number;
    valid_certificate_count: number;
  }>(
    `
      select
        (
          select count(*)::int
          from enrollments e
          join courses c on c.id = e.course_id
          where e.course_id = $1
            and e.status = 'active'
            and e.starts_at <= now()
            and e.expires_at >= now()
            and c.status = 'active'
            and exists (
              select 1
              from course_publications cp
              where cp.course_id = c.id and cp.status = 'published'
            )
        ) as active_enrollment_count,
        (select count(*)::int from orders where course_id = $1 and status = 'paid') as paid_order_count,
        (select count(*)::int from certificates where course_id = $1 and status = 'valid') as valid_certificate_count
    `,
    [courseId]
  );
  const row = rows[0];

  return {
    activeEnrollmentCount: row?.active_enrollment_count ?? 0,
    paidOrderCount: row?.paid_order_count ?? 0,
    validCertificateCount: row?.valid_certificate_count ?? 0,
  };
};

export const getAdminCourseDetailData = async (
  courseId: string,
  enrollmentQuery: AdminCourseEnrollmentQuery = {}
): Promise<{
  course: AdminCourse;
  enrollments: AdminEnrollment[];
  enrollmentsPage: {
    hasNextPage: boolean;
    page: number;
    pageSize: number;
    search: string;
    totalCount: number;
  };
  lessons: AdminLesson[];
  modules: AdminModule[];
} | null> => {
  await requirePermission("manageContent");
  const [courses, modules, lessons, enrollmentsPage] = await Promise.all([
    readCourses(courseId),
    readModules(courseId),
    readLessons(courseId),
    readCourseEnrollmentsPage(courseId, enrollmentQuery),
  ]);
  const course = courses[0];

  if (!course) {
    return null;
  }

  return {
    course,
    enrollments: enrollmentsPage.enrollments,
    enrollmentsPage: {
      hasNextPage: enrollmentsPage.hasNextPage,
      page: enrollmentsPage.page,
      pageSize: enrollmentsPage.pageSize,
      search: enrollmentsPage.search,
      totalCount: enrollmentsPage.totalCount,
    },
    lessons,
    modules,
  };
};

export type AdminCourseManagementTab =
  | "certificate"
  | "content"
  | "overview"
  | "settings"
  | "students";

export type AdminCourseTabData =
  | {
      course: AdminCourse;
      lessons: AdminLesson[];
      modules: AdminModule[];
      overviewSummary: AdminCourseOverviewSummary;
      publicationState: { hasDraft: boolean; hasPublished: boolean };
      tab: "overview";
    }
  | {
      course: AdminCourse;
      lessons: AdminLesson[];
      modules: AdminModule[];
      publicationState: { hasDraft: boolean; hasPublished: boolean };
      tab: "content";
    }
  | {
      course: AdminCourse;
      enrollmentsPage: {
        enrollments: AdminEnrollment[];
        hasNextPage: boolean;
        page: number;
        pageSize: number;
        search: string;
        totalCount: number;
      };
      tab: "students";
    }
  | {
      course: AdminCourse;
      publicationState: { hasDraft: boolean; hasPublished: boolean };
      tab: "settings";
    }
  | { course: AdminCourse; tab: "certificate" };

export const getAdminCourseTabData = async ({
  courseId,
  enrollmentQuery = {},
  tab,
}: {
  courseId: string;
  enrollmentQuery?: AdminCourseEnrollmentQuery;
  tab: AdminCourseManagementTab;
}): Promise<AdminCourseTabData | null> => {
  await requirePermission("manageContent");

  if (tab === "overview") {
    const [courses, modules, lessons, overviewSummary, publicationState] =
      await Promise.all([
        readCourses(courseId),
        readModules(courseId),
        readLessons(courseId),
        getAdminCourseOverviewSummary(courseId),
        getAdminCoursePublicationState(courseId),
      ]);
    const course = courses[0];
    return course
      ? { course, lessons, modules, overviewSummary, publicationState, tab }
      : null;
  }

  if (tab === "content") {
    const [courses, modules, lessons, publicationState] = await Promise.all([
      readCourses(courseId),
      readModules(courseId),
      readLessons(courseId),
      getAdminCoursePublicationState(courseId),
    ]);
    const course = courses[0];
    return course ? { course, lessons, modules, publicationState, tab } : null;
  }

  if (tab === "students") {
    const [courses, enrollmentsPage] = await Promise.all([
      readCourses(courseId),
      readCourseEnrollmentsPage(courseId, enrollmentQuery),
    ]);
    const course = courses[0];
    return course ? { course, enrollmentsPage, tab } : null;
  }

  if (tab === "settings") {
    const [courses, publicationState] = await Promise.all([
      readCourses(courseId),
      getAdminCoursePublicationState(courseId),
    ]);
    const course = courses[0];
    return course ? { course, publicationState, tab } : null;
  }

  const courses = await readCourses(courseId);
  const course = courses[0];
  return course ? { course, tab } : null;
};

export const getAdminCoursePublicationState = async (
  courseId: string
): Promise<{ hasDraft: boolean; hasPublished: boolean }> => {
  await requirePermission("manageContent");
  const result = await getPool().query<{
    has_draft: boolean;
    has_published: boolean;
  }>(
    `select coalesce(bool_or(status = 'draft'), false) as has_draft,
            coalesce(bool_or(status = 'published'), false) as has_published
     from course_publications
     where course_id = $1 and status in ('draft', 'published')`,
    [courseId]
  );
  const state = result.rows[0];

  return {
    hasDraft: state?.has_draft ?? false,
    hasPublished: state?.has_published ?? false,
  };
};

export const getAdminLessonEditorData = async ({
  courseId,
  lessonId,
}: {
  courseId: string;
  lessonId: string;
}): Promise<{
  asset: AdminLessonAsset | undefined;
  course: AdminCourse;
  lesson: AdminLesson;
  module: AdminModule;
} | null> => {
  await requirePermission("manageContent");
  const [courses, lessonEditor, assets] = await Promise.all([
    readCourses(courseId),
    readLessonEditor({ courseId, lessonId }),
    getJmvstreamAssetsForLesson(lessonId),
  ]);
  const course = courses[0];

  if (!(course && lessonEditor)) {
    return null;
  }

  const { lesson, module } = lessonEditor;

  const asset =
    (lesson.videoExternalId
      ? assets.find(
          (item) =>
            item.lessonId === lesson.id &&
            item.videoHash === lesson.videoExternalId
        )
      : undefined) ??
    assets.find(
      (item) => item.lessonId === lesson.id && item.deleteStatus === "failed"
    );

  return { asset, course, lesson, module };
};

export const getAdminStudentDetail = async (
  userId: string
): Promise<AdminStudentDetail | null> => {
  await requirePermission("manageEnrollmentAccess");

  const pool = getPool();
  const result = await pool.query<{
    content_release_mode: ContentReleaseMode | null;
    content_release_started_at: Date | null;
    course_id: string | null;
    course_title: string | null;
    email: string;
    expires_at: Date | null;
    id: string | null;
    name: string;
    next_module_release_at: Date | null;
    original_expires_at: Date | null;
    platform_blocked_at: Date | null;
    platform_blocked_reason: string | null;
    revoked_reason: string | null;
    starts_at: Date | null;
    status: string | null;
    user_id: string;
  }>(
    `
      select e.id, e.user_id, u.name, u.email, c.id as course_id, c.title as course_title,
             e.status, e.starts_at, e.expires_at,
             e.content_release_mode, e.content_release_started_at,
             coalesce(latest_grant.base_expires_at, e.expires_at) as original_expires_at,
             e.revoked_reason, p.platform_blocked_at, p.platform_blocked_reason,
             next_release.next_module_release_at
      from users u
      join profiles p on p.user_id = u.id and p.role = 'student'
      left join enrollments e on e.user_id = u.id
      left join courses c on c.id = e.course_id
      left join lateral (
        select eg.base_expires_at
        from enrollment_grants eg
        where eg.user_id = u.id
          and eg.course_id = e.course_id
        order by eg.effective_expires_at desc, eg.updated_at desc
        limit 1
      ) latest_grant on true
      ${CONTENT_RELEASE_NEXT_MODULE_LATERAL_SQL}
      where u.id = $1
      order by c.title nulls last
    `,
    [userId]
  );

  const firstRow = result.rows[0];

  if (!firstRow) {
    return null;
  }

  return {
    email: firstRow.email,
    enrollments: result.rows.flatMap((row) => {
      if (
        !(
          row.course_id &&
          row.course_title &&
          row.expires_at &&
          row.id &&
          row.original_expires_at &&
          row.starts_at &&
          row.status
        )
      ) {
        return [];
      }

      return [
        {
          courseId: row.course_id,
          courseTitle: row.course_title,
          contentReleaseMode: row.content_release_mode ?? "full_access",
          contentReleaseStartedAt: row.content_release_started_at,
          expiresAt: row.expires_at,
          id: row.id,
          originalExpiresAt: row.original_expires_at,
          nextModuleReleaseAt: row.next_module_release_at,
          revokedReason: row.revoked_reason,
          startedAt: row.starts_at,
          status: row.status,
        },
      ];
    }),
    name: firstRow.name,
    platformBlockedAt: firstRow.platform_blocked_at,
    platformBlockedReason: firstRow.platform_blocked_reason,
    userId: firstRow.user_id,
  };
};

export const getAdminStudentSheetData = async ({
  courseId,
  userId,
}: {
  courseId?: string;
  userId: string;
}): Promise<AdminStudentSheetData | null> => {
  await requirePermission("manageEnrollmentAccess");
  const [student, certificates] = await Promise.all([
    getAdminStudentDetail(userId),
    getCertificateOperationsForUser(userId),
  ]);

  if (!student) {
    return null;
  }

  if (!courseId) {
    return {
      certificates,
      context: { courseId: null, courseTitle: null },
      student,
    };
  }

  const enrollment = student.enrollments.find(
    (candidate) => candidate.courseId === courseId
  );

  if (!enrollment) {
    return null;
  }

  return {
    certificates: certificates.filter(
      (certificate) => certificate.courseId === courseId
    ),
    context: { courseId, courseTitle: enrollment.courseTitle },
    student: { ...student, enrollments: [enrollment] },
  };
};

export interface AdminBanner {
  blurDataUrl: string | null;
  buttonText: string | null;
  id: string;
  imageUrl: string;
  isActive: boolean;
  linkUrl: string | null;
  sortOrder: number;
}

export const getAdminBannersData = async (): Promise<{
  banners: AdminBanner[];
}> => {
  await requirePermission("manageSettings");

  const { rows } = await getPool().query<{
    blur_data_url: string | null;
    id: string;
    image_url: string;
    link_url: string | null;
    button_text: string | null;
    is_active: boolean;
    sort_order: number;
  }>(
    "select id, image_url, blur_data_url, link_url, button_text, is_active, sort_order from dashboard_banners order by sort_order"
  );

  const banners = rows.map((row) => ({
    blurDataUrl: row.blur_data_url,
    id: row.id,
    imageUrl: row.image_url,
    linkUrl: row.link_url,
    buttonText: row.button_text,
    isActive: row.is_active,
    sortOrder: row.sort_order,
  }));

  return { banners };
};
