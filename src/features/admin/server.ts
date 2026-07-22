import "server-only";
import { getPool } from "@/db";
import {
  type AdminStudentSummary,
  summarizeAdminStudents,
} from "@/features/admin/students";
import { getJmvstreamAssetsForLesson } from "@/features/jmvstream/server";
import {
  getOperationalBacklogSnapshot,
  type OperationalBacklogSnapshot,
} from "@/features/operations/server";
import {
  listOutboxDeadLetters,
  type OutboxDeadLetterMessage,
} from "@/features/outbox/server";
import { requirePermission } from "@/lib/auth-permissions";

export interface AdminOverview {
  activeEnrollments: number;
  courses: number;
  paidOrders: number;
  recentWebhooks: Array<{
    id: string;
    eventKey: string;
    eventName: string;
    errorMessage: string | null;
    status: string;
    createdAt: Date;
  }>;
  students: number;
}

export const getAdminOverview = async (): Promise<AdminOverview> => {
  await requirePermission("viewAdminPanel");

  const pool = getPool();
  const [counts, webhooks] = await Promise.all([
    pool.query<{
      courses: number;
      students: number;
      active_enrollments: number;
      paid_orders: number;
    }>(
      `
        select
          (select count(*)::int from courses) as courses,
          (select count(*)::int from profiles where role = 'student') as students,
          (select count(*)::int from enrollments where status = 'active') as active_enrollments,
          (select count(*)::int from orders where status = 'paid') as paid_orders
      `
    ),
    pool.query<{
      event_key: string;
      id: string;
      event_name: string;
      error_message: string | null;
      status: string;
      created_at: Date;
    }>(
      `
        select id, event_key, event_name, status, error_message, created_at
        from webhook_events
        order by created_at desc
        limit 8
      `
    ),
  ]);
  const countRow = counts.rows[0];

  return {
    courses: countRow?.courses ?? 0,
    students: countRow?.students ?? 0,
    activeEnrollments: countRow?.active_enrollments ?? 0,
    paidOrders: countRow?.paid_orders ?? 0,
    recentWebhooks: webhooks.rows.map((row) => ({
      id: row.id,
      eventKey: row.event_key,
      eventName: row.event_name,
      errorMessage: row.error_message,
      status: row.status,
      createdAt: row.created_at,
    })),
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

export interface AdminCertificate {
  code: string;
  courseId: string;
  courseTitle: string;
  issuedAt: Date;
  studentName: string;
}

export interface AdminCourse {
  accessDurationMonths: number;
  certificateEnabled: boolean;
  coverImage: unknown;
  description: string | null;
  id: string;
  paymentProviderProductId: string | null;
  priceInCents: number;
  slug: string;
  status: string;
  subtitle: string | null;
  thumbnailUrl: string | null;
  title: string;
  workloadHours: number;
}

export interface AdminEnrollment {
  courseId: string;
  courseTitle: string;
  email: string;
  expiresAt: Date;
  id: string;
  lastAccessAt: Date | null;
  name: string;
  originalExpiresAt: Date;
  revokedReason: string | null;
  startsAt: Date;
  status: string;
  userId: string;
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
  sortOrder: number;
  status: string;
  title: string;
}

export interface AdminPaymentReview {
  id: string;
  orderId: string;
  providerOrderId: string;
  reason: string;
  status: "approved" | "pending" | "rejected";
  type: "amount_mismatch" | "terminal_conflict";
}

export interface AdminOrder {
  amountInCents: number;
  courseId: string;
  courseTitle: string;
  customerEmail: string | null;
  customerName: string | null;
  id: string;
  paidAt: Date | null;
  providerOrderId: string;
  status: string;
}

export interface AdminSettings {
  certificateSignerName: string | null;
  certificateSignerRole: string | null;
  issuerCnpj: string | null;
  issuerCourseFreeStatement: string | null;
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
    courseId: string;
    courseTitle: string;
    expiresAt: Date;
    id: string;
    originalExpiresAt: Date;
    revokedReason: string | null;
    startedAt: Date;
    status: string;
  }>;
  name: string;
  platformBlockedAt: Date | null;
  platformBlockedReason: string | null;
  userId: string;
}

const requireAdminReadAccess = (): Promise<void> =>
  requirePermission("viewAdminPanel").then(() => undefined);

const readCourses = async (courseId?: string): Promise<AdminCourse[]> => {
  const { rows } = await getPool().query<{
    access_duration_months: number;
    certificate_enabled: boolean;
    description: string | null;
    id: string;
    payment_provider_product_id: string | null;
    price_in_cents: number;
    slug: string;
    status: string;
    subtitle: string | null;
    cover_image_json: unknown;
    thumbnail_url: string | null;
    title: string;
    workload_hours: number;
  }>(
    courseId
      ? "select id, slug, title, subtitle, description, workload_hours, price_in_cents, thumbnail_url, cover_image_json, payment_provider_product_id, access_duration_months, certificate_enabled, status from courses where id = $1"
      : "select id, slug, title, subtitle, description, workload_hours, price_in_cents, thumbnail_url, cover_image_json, payment_provider_product_id, access_duration_months, certificate_enabled, status from courses order by created_at desc",
    courseId ? [courseId] : undefined
  );

  return rows.map((row) => ({
    accessDurationMonths: row.access_duration_months,
    certificateEnabled: row.certificate_enabled,
    description: row.description,
    id: row.id,
    paymentProviderProductId: row.payment_provider_product_id,
    priceInCents: row.price_in_cents,
    slug: row.slug,
    status: row.status,
    subtitle: row.subtitle,
    coverImage: row.cover_image_json,
    thumbnailUrl: row.thumbnail_url,
    title: row.title,
    workloadHours: row.workload_hours,
  }));
};

const readModules = async (courseId?: string): Promise<AdminModule[]> => {
  const { rows } = await getPool().query<{
    course_id: string;
    course_title: string;
    description: string | null;
    id: string;
    sort_order: number;
    status: string;
    title: string;
  }>(
    courseId
      ? `
          select m.id, m.course_id, c.title as course_title, m.title, m.description, m.sort_order, m.status
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
          select m.id, m.course_id, c.title as course_title, m.title, m.description, m.sort_order, m.status
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
             c.id as course_id, c.title as course_title, l.title,
             l.description as lesson_description, l.content_json, l.duration_seconds,
             l.video_duration_seconds, l.text_duration_seconds, l.text_word_count,
             l.sort_order, l.video_provider, l.video_external_id, l.video_embed_url,
             l.status, l.is_published, l.is_required, cp.status as course_publication_status
      from lessons l
      join modules m on m.id = l.module_id
      join courses c on c.id = m.course_id
      join course_publications cp on cp.id = l.course_publication_id
      where m.course_id = $1 and l.id = $2
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
      sortOrder: row.module_sort_order,
      status: row.module_status,
      title: row.module_title,
    },
  };
};

const readEnrollments = async (
  courseId?: string
): Promise<AdminEnrollment[]> => {
  const { rows } = await getPool().query<{
    course_id: string;
    course_title: string;
    email: string;
    expires_at: Date;
    id: string;
    last_access_at: Date | null;
    name: string;
    original_expires_at: Date;
    revoked_reason: string | null;
    starts_at: Date;
    status: string;
    user_id: string;
  }>(
    `
      select e.id, e.user_id, u.name, u.email, c.id as course_id, c.title as course_title,
             c.id as course_id, e.status, e.starts_at, e.expires_at,
             coalesce(latest_grant.base_expires_at, e.expires_at) as original_expires_at,
             e.revoked_reason, p.last_access_at
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
      ${courseId ? "where e.course_id = $1" : ""}
      order by e.updated_at desc
    `,
    courseId ? [courseId] : undefined
  );

  return rows.map((row) => ({
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
  }));
};

const readOrders = async (courseId?: string): Promise<AdminOrder[]> => {
  const { rows } = await getPool().query<{
    amount_in_cents: number;
    course_id: string;
    course_title: string;
    customer_email: string | null;
    customer_name: string | null;
    id: string;
    paid_at: Date | null;
    provider_order_id: string;
    status: string;
  }>(
    `
      select o.id, c.id as course_id, c.title as course_title, o.provider_order_id, o.status,
             o.amount_in_cents, o.customer_email, o.customer_name, o.paid_at
      from orders o
      join courses c on c.id = o.course_id
      ${courseId ? "where o.course_id = $1" : ""}
      order by o.created_at desc
      limit 40
    `,
    courseId ? [courseId] : undefined
  );

  return rows.map((row) => ({
    amountInCents: row.amount_in_cents,
    courseId: row.course_id,
    courseTitle: row.course_title,
    customerEmail: row.customer_email,
    customerName: row.customer_name,
    id: row.id,
    paidAt: row.paid_at,
    providerOrderId: row.provider_order_id,
    status: row.status,
  }));
};

const readCertificates = async (
  courseId?: string
): Promise<AdminCertificate[]> => {
  const { rows } = await getPool().query<{
    code: string;
    course_id: string;
    course_title_snapshot: string;
    issued_at: Date;
    student_name_snapshot: string;
  }>(
    `
      select code, course_id, student_name_snapshot, course_title_snapshot, issued_at
      from certificates
      ${courseId ? "where course_id = $1" : ""}
      order by issued_at desc
      limit 40
    `,
    courseId ? [courseId] : undefined
  );

  return rows.map((row) => ({
    code: row.code,
    courseId: row.course_id,
    courseTitle: row.course_title_snapshot,
    issuedAt: row.issued_at,
    studentName: row.student_name_snapshot,
  }));
};

const readPaymentReviews = async (): Promise<AdminPaymentReview[]> => {
  const { rows } = await getPool().query<{
    id: string;
    order_id: string;
    provider_order_id: string;
    reason: string;
    status: "approved" | "pending" | "rejected";
    type: "amount_mismatch" | "terminal_conflict";
  }>(`
    select pr.id, pr.order_id, pr.type, pr.status, pr.reason, o.provider_order_id
    from payment_reviews pr
    join orders o on o.id = pr.order_id
    order by pr.created_at desc
    limit 40
  `);

  return rows.map((row) => ({
    id: row.id,
    orderId: row.order_id,
    providerOrderId: row.provider_order_id,
    reason: row.reason,
    status: row.status,
    type: row.type,
  }));
};

const readCourseRevenue = async (): Promise<CourseRevenueSummary[]> => {
  const { rows } = await getPool().query<{
    course_id: string;
    course_title: string;
    total_orders: number;
    paid_orders: number;
    total_revenue_in_cents: number;
  }>(`
    select c.id as course_id, c.title as course_title,
           count(o.id)::int as total_orders,
           count(case when o.status = 'paid' then 1 end)::int as paid_orders,
           coalesce(sum(case when o.status = 'paid' then o.amount_in_cents else 0 end), 0)::bigint as total_revenue_in_cents
    from courses c
    left join orders o on o.course_id = c.id
    group by c.id, c.title
    order by total_revenue_in_cents desc
  `);

  return rows.map((row) => ({
    courseId: row.course_id,
    courseTitle: row.course_title,
    totalOrders: row.total_orders,
    paidOrders: row.paid_orders,
    totalRevenueInCents: Number(row.total_revenue_in_cents),
  }));
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
    course_free_statement: string;
    display_name: string;
    legal_name: string;
  }>(
    "select cnpj, display_name, legal_name, course_free_statement from certificate_issuer_profiles where id = 'global' limit 1"
  );

  return {
    certificateSignerName: settings?.certificate_signer_name ?? null,
    certificateSignerRole: settings?.certificate_signer_role ?? null,
    issuerCnpj: issuer.rows[0]?.cnpj ?? null,
    issuerCourseFreeStatement: issuer.rows[0]?.course_free_statement ?? null,
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

const readStudentProfiles = async (): Promise<
  Array<{
    email: string;
    lastAccessAt: Date | null;
    name: string;
    platformBlockedAt: Date | null;
    platformBlockedReason: string | null;
    userId: string;
  }>
> => {
  const { rows } = await getPool().query<{
    email: string;
    last_access_at: Date | null;
    name: string;
    platform_blocked_at: Date | null;
    platform_blocked_reason: string | null;
    user_id: string;
  }>(`
    select u.id as user_id, u.name, u.email, p.last_access_at,
           p.platform_blocked_at, p.platform_blocked_reason
    from profiles p
    join users u on u.id = p.user_id
    where p.role = 'student'
    order by u.name asc
  `);

  return rows.map((row) => ({
    email: row.email,
    lastAccessAt: row.last_access_at,
    name: row.name,
    platformBlockedAt: row.platform_blocked_at,
    platformBlockedReason: row.platform_blocked_reason,
    userId: row.user_id,
  }));
};

export const getAdminDashboardData = async (): Promise<{
  courses: AdminCourse[];
  coursesRevenue: CourseRevenueSummary[];
  lessons: AdminLesson[];
  modules: AdminModule[];
  orders: AdminOrder[];
}> => {
  await requirePermission("viewAdminPanel");
  const [courses, modules, lessons, orders, coursesRevenue] = await Promise.all(
    [
      readCourses(),
      readModules(),
      readLessons(),
      readOrders(),
      readCourseRevenue(),
    ]
  );

  return { courses, coursesRevenue, lessons, modules, orders };
};

export const getAdminStudentsData = async (): Promise<{
  enrollments: AdminEnrollment[];
  students: AdminStudentSummary[];
}> => {
  await requireAdminReadAccess();
  const [enrollments, profiles] = await Promise.all([
    readEnrollments(),
    readStudentProfiles(),
  ]);

  return {
    enrollments,
    students: summarizeAdminStudents(enrollments, profiles),
  };
};

export const getAdminAuditData = async (): Promise<{
  auditLogs: AdminAuditLog[];
  operationalBacklog: OperationalBacklogSnapshot;
  outboxDeadLetters: OutboxDeadLetterMessage[];
}> => {
  await requireAdminReadAccess();
  const [auditLogs, outboxDeadLetters, operationalBacklog] = await Promise.all([
    readAuditLogs(),
    listOutboxDeadLetters(),
    getOperationalBacklogSnapshot(),
  ]);
  return { auditLogs, operationalBacklog, outboxDeadLetters };
};

export const getAdminSettingsData = async (): Promise<{
  settings: AdminSettings;
}> => {
  await requireAdminReadAccess();
  return { settings: await readSettings() };
};

export const getAdminCourseCatalogData = async (): Promise<{
  courses: AdminCourse[];
  lessons: AdminLesson[];
  modules: AdminModule[];
}> => {
  await requireAdminReadAccess();
  const [courses, modules, lessons] = await Promise.all([
    readCourses(),
    readModules(),
    readLessons(),
  ]);
  return { courses, lessons, modules };
};

export const getAdminFaqData = async (): Promise<{ faqs: AdminFaq[] }> => {
  await requireAdminReadAccess();
  return { faqs: await readFaqs() };
};

export const getAdminFinancialData = async (): Promise<{
  certificates: AdminCertificate[];
  coursesRevenue: CourseRevenueSummary[];
  orders: AdminOrder[];
  paymentReviews: AdminPaymentReview[];
}> => {
  await requireAdminReadAccess();
  const [orders, certificates, paymentReviews, coursesRevenue] =
    await Promise.all([
      readOrders(),
      readCertificates(),
      readPaymentReviews(),
      readCourseRevenue(),
    ]);

  return { certificates, coursesRevenue, orders, paymentReviews };
};

export const getAdminCourseDetailData = async (
  courseId: string
): Promise<{
  certificates: AdminCertificate[];
  course: AdminCourse;
  enrollments: AdminEnrollment[];
  lessons: AdminLesson[];
  modules: AdminModule[];
  orders: AdminOrder[];
} | null> => {
  await requireAdminReadAccess();
  const [courses, modules, lessons, enrollments, orders, certificates] =
    await Promise.all([
      readCourses(courseId),
      readModules(courseId),
      readLessons(courseId),
      readEnrollments(courseId),
      readOrders(courseId),
      readCertificates(courseId),
    ]);
  const course = courses[0];

  if (!course) {
    return null;
  }

  return {
    certificates,
    course,
    enrollments,
    lessons,
    modules,
    orders,
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
  await requireAdminReadAccess();
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
  await requirePermission("viewAdminPanel");

  const pool = getPool();
  const result = await pool.query<{
    course_id: string;
    course_title: string;
    email: string;
    expires_at: Date;
    id: string;
    name: string;
    original_expires_at: Date;
    platform_blocked_at: Date | null;
    platform_blocked_reason: string | null;
    revoked_reason: string | null;
    starts_at: Date;
    status: string;
    user_id: string;
  }>(
    `
      select e.id, e.user_id, u.name, u.email, c.id as course_id, c.title as course_title,
             e.status, e.starts_at, e.expires_at,
             coalesce(latest_grant.base_expires_at, e.expires_at) as original_expires_at,
             e.revoked_reason, p.platform_blocked_at, p.platform_blocked_reason
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
      where e.user_id = $1
      order by c.title
    `,
    [userId]
  );

  const firstRow = result.rows[0];

  if (!firstRow) {
    return null;
  }

  return {
    email: firstRow.email,
    enrollments: result.rows.map((row) => ({
      courseId: row.course_id,
      courseTitle: row.course_title,
      expiresAt: row.expires_at,
      id: row.id,
      originalExpiresAt: row.original_expires_at,
      revokedReason: row.revoked_reason,
      startedAt: row.starts_at,
      status: row.status,
    })),
    name: firstRow.name,
    platformBlockedAt: firstRow.platform_blocked_at,
    platformBlockedReason: firstRow.platform_blocked_reason,
    userId: firstRow.user_id,
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
  await requireAdminReadAccess();

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
