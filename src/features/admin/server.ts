import "server-only";
import { getPool } from "@/db";
import {
  type AdminStudentSummary,
  summarizeAdminStudents,
} from "@/features/admin/students";

export interface AdminOverview {
  activeEnrollments: number;
  courses: number;
  paidOrders: number;
  recentWebhooks: Array<{
    eventKey: string;
    eventName: string;
    status: string;
    createdAt: Date;
  }>;
  students: number;
}

export const getAdminOverview = async (): Promise<AdminOverview> => {
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
      event_name: string;
      status: string;
      created_at: Date;
    }>(
      `
        select event_key, event_name, status, created_at
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
      eventKey: row.event_key,
      eventName: row.event_name,
      status: row.status,
      createdAt: row.created_at,
    })),
  };
};

export interface AdminManagementData {
  auditLogs: Array<{
    action: string;
    actorEmail: string | null;
    createdAt: Date;
    targetId: string | null;
    targetType: string;
  }>;
  certificates: Array<{
    code: string;
    courseTitle: string;
    issuedAt: Date;
    studentName: string;
  }>;
  courses: Array<{
    accessDurationMonths: number;
    description: string | null;
    id: string;
    instructorName: string | null;
    paymentProviderProductId: string | null;
    slug: string;
    status: string;
    subtitle: string | null;
    supportWhatsappUrl: string | null;
    title: string;
    workloadHours: number;
  }>;
  enrollments: Array<{
    courseTitle: string;
    email: string;
    expiresAt: Date;
    id: string;
    name: string;
    status: string;
    userId: string;
  }>;
  faqs: Array<{
    answer: string;
    category: string;
    id: string;
    isPublished: boolean;
    question: string;
    sortOrder: number;
  }>;
  lessons: Array<{
    courseTitle: string;
    durationMinutes: number;
    id: string;
    isPublished: boolean;
    lessonType: string;
    moduleId: string;
    moduleTitle: string;
    description: string | null;
    sortOrder: number;
    title: string;
    videoEmbedUrl: string | null;
    videoExternalId: string | null;
    videoProvider: string | null;
  }>;
  modules: Array<{
    color: string;
    courseId: string;
    courseTitle: string;
    description: string | null;
    id: string;
    sortOrder: number;
    title: string;
  }>;
  orders: Array<{
    amountInCents: number;
    courseTitle: string;
    customerEmail: string | null;
    customerName: string | null;
    id: string;
    paidAt: Date | null;
    providerOrderId: string;
    status: string;
  }>;
  settings: {
    abacatepayWebhookSecretLast4: string | null;
    certificateSignerName: string | null;
    certificateSignerRole: string | null;
    supportWhatsappUrl: string | null;
  };
  students: AdminStudentSummary[];
}

export interface AdminStudentDetail {
  email: string;
  enrollments: Array<{
    courseTitle: string;
    expiresAt: Date;
    id: string;
    startedAt: Date;
    status: string;
  }>;
  name: string;
  userId: string;
}

export const getAdminManagementData =
  async (): Promise<AdminManagementData> => {
    const pool = getPool();
    const [
      courses,
      modules,
      lessons,
      enrollments,
      orders,
      certificates,
      faqs,
      settings,
      auditLogs,
    ] = await Promise.all([
      pool.query<{
        access_duration_months: number;
        description: string | null;
        id: string;
        instructor_name: string | null;
        payment_provider_product_id: string | null;
        slug: string;
        status: string;
        subtitle: string | null;
        support_whatsapp_url: string | null;
        title: string;
        workload_hours: number;
      }>(
        "select id, slug, title, subtitle, description, instructor_name, workload_hours, support_whatsapp_url, payment_provider_product_id, access_duration_months, status from courses order by created_at desc"
      ),
      pool.query<{
        color: string;
        course_id: string;
        course_title: string;
        description: string | null;
        id: string;
        sort_order: number;
        title: string;
      }>(
        `
          select m.id, m.course_id, c.title as course_title, m.title, m.description, m.sort_order, m.color
          from modules m
          join courses c on c.id = m.course_id
          order by c.title, m.sort_order
        `
      ),
      pool.query<{
        course_title: string;
        duration_minutes: number;
        id: string;
        is_published: boolean;
        lesson_description: string | null;
        lesson_type: string;
        module_id: string;
        module_title: string;
        sort_order: number;
        title: string;
        video_embed_url: string | null;
        video_external_id: string | null;
        video_provider: string | null;
      }>(
        `
          select l.id, l.module_id, m.title as module_title, c.title as course_title,
                 l.title, l.description as lesson_description, l.lesson_type,
                 l.duration_minutes, l.sort_order, l.video_provider,
                 l.video_external_id, l.video_embed_url, l.is_published
          from lessons l
          join modules m on m.id = l.module_id
          join courses c on c.id = m.course_id
          order by c.title, m.sort_order, l.sort_order
        `
      ),
      pool.query<{
        course_title: string;
        email: string;
        expires_at: Date;
        id: string;
        name: string;
        status: string;
        user_id: string;
      }>(
        `
          select e.id, e.user_id, u.name, u.email, c.title as course_title, e.status, e.expires_at
          from enrollments e
          join users u on u.id = e.user_id
          join courses c on c.id = e.course_id
          order by e.updated_at desc
          limit 60
        `
      ),
      pool.query<{
        amount_in_cents: number;
        course_title: string;
        customer_email: string | null;
        customer_name: string | null;
        id: string;
        paid_at: Date | null;
        provider_order_id: string;
        status: string;
      }>(
        `
          select o.id, c.title as course_title, o.provider_order_id, o.status,
                 o.amount_in_cents, o.customer_email, o.customer_name, o.paid_at
          from orders o
          join courses c on c.id = o.course_id
          order by o.created_at desc
          limit 40
        `
      ),
      pool.query<{
        code: string;
        course_title_snapshot: string;
        issued_at: Date;
        student_name_snapshot: string;
      }>(
        "select code, student_name_snapshot, course_title_snapshot, issued_at from certificates order by issued_at desc limit 40"
      ),
      pool.query<{
        answer: string;
        category: string;
        id: string;
        is_published: boolean;
        question: string;
        sort_order: number;
      }>(
        "select id, question, answer, category, sort_order, is_published from faq_items order by sort_order, question"
      ),
      pool.query<{
        abacatepay_webhook_secret_last4: string | null;
        certificate_signer_name: string | null;
        certificate_signer_role: string | null;
        support_whatsapp_url: string | null;
      }>(
        "select support_whatsapp_url, certificate_signer_name, certificate_signer_role, abacatepay_webhook_secret_last4 from app_settings where id = 'global' limit 1"
      ),
      pool.query<{
        action: string;
        actor_email: string | null;
        created_at: Date;
        target_id: string | null;
        target_type: string;
      }>(
        `
          select a.action, a.target_type, a.target_id, a.created_at, u.email as actor_email
          from audit_logs a
          left join users u on u.id = a.actor_user_id
          order by a.created_at desc
          limit 30
        `
      ),
    ]);

    const settingsRow = settings.rows[0];

    const enrollmentRows = enrollments.rows.map((row) => ({
      courseTitle: row.course_title,
      email: row.email,
      expiresAt: row.expires_at,
      id: row.id,
      name: row.name,
      status: row.status,
      userId: row.user_id,
    }));

    return {
      auditLogs: auditLogs.rows.map((row) => ({
        action: row.action,
        actorEmail: row.actor_email,
        createdAt: row.created_at,
        targetId: row.target_id,
        targetType: row.target_type,
      })),
      certificates: certificates.rows.map((row) => ({
        code: row.code,
        courseTitle: row.course_title_snapshot,
        issuedAt: row.issued_at,
        studentName: row.student_name_snapshot,
      })),
      courses: courses.rows.map((row) => ({
        accessDurationMonths: row.access_duration_months,
        description: row.description,
        id: row.id,
        instructorName: row.instructor_name,
        paymentProviderProductId: row.payment_provider_product_id,
        slug: row.slug,
        status: row.status,
        subtitle: row.subtitle,
        supportWhatsappUrl: row.support_whatsapp_url,
        title: row.title,
        workloadHours: row.workload_hours,
      })),
      enrollments: enrollmentRows,
      faqs: faqs.rows.map((row) => ({
        answer: row.answer,
        category: row.category,
        id: row.id,
        isPublished: row.is_published,
        question: row.question,
        sortOrder: row.sort_order,
      })),
      lessons: lessons.rows.map((row) => ({
        courseTitle: row.course_title,
        durationMinutes: row.duration_minutes,
        id: row.id,
        isPublished: row.is_published,
        lessonType: row.lesson_type,
        moduleId: row.module_id,
        moduleTitle: row.module_title,
        description: row.lesson_description,
        sortOrder: row.sort_order,
        title: row.title,
        videoEmbedUrl: row.video_embed_url,
        videoExternalId: row.video_external_id,
        videoProvider: row.video_provider,
      })),
      modules: modules.rows.map((row) => ({
        color: row.color,
        courseId: row.course_id,
        courseTitle: row.course_title,
        description: row.description,
        id: row.id,
        sortOrder: row.sort_order,
        title: row.title,
      })),
      orders: orders.rows.map((row) => ({
        amountInCents: row.amount_in_cents,
        courseTitle: row.course_title,
        customerEmail: row.customer_email,
        customerName: row.customer_name,
        id: row.id,
        paidAt: row.paid_at,
        providerOrderId: row.provider_order_id,
        status: row.status,
      })),
      settings: {
        abacatepayWebhookSecretLast4:
          settingsRow?.abacatepay_webhook_secret_last4 ?? null,
        certificateSignerName: settingsRow?.certificate_signer_name ?? null,
        certificateSignerRole: settingsRow?.certificate_signer_role ?? null,
        supportWhatsappUrl: settingsRow?.support_whatsapp_url ?? null,
      },
      students: summarizeAdminStudents(enrollmentRows),
    };
  };

export const getAdminStudentDetail = async (
  userId: string
): Promise<AdminStudentDetail | null> => {
  const pool = getPool();
  const result = await pool.query<{
    course_title: string;
    email: string;
    expires_at: Date;
    id: string;
    name: string;
    starts_at: Date;
    status: string;
    user_id: string;
  }>(
    `
      select e.id, e.user_id, u.name, u.email, c.title as course_title,
             e.status, e.starts_at, e.expires_at
      from enrollments e
      join users u on u.id = e.user_id
      join courses c on c.id = e.course_id
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
      courseTitle: row.course_title,
      expiresAt: row.expires_at,
      id: row.id,
      startedAt: row.starts_at,
      status: row.status,
    })),
    name: firstRow.name,
    userId: firstRow.user_id,
  };
};
