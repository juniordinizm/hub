import "server-only";
import { getPool } from "@/db";
import {
  type AdminStudentSummary,
  summarizeAdminStudents,
} from "@/features/admin/students";
import { getJmvstreamAssets } from "@/features/jmvstream/server";

export interface AdminOverview {
  activeEnrollments: number;
  courses: number;
  paidOrders: number;
  recentWebhooks: Array<{
    eventKey: string;
    eventName: string;
    errorMessage: string | null;
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
      error_message: string | null;
      status: string;
      created_at: Date;
    }>(
      `
        select event_key, event_name, status, error_message, created_at
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

export interface AdminManagementData {
  auditLogs: Array<{
    action: string;
    actorEmail: string | null;
    createdAt: Date;
    targetId: string | null;
    targetName: string | null;
    targetType: string;
  }>;
  certificates: Array<{
    code: string;
    courseId: string;
    courseTitle: string;
    issuedAt: Date;
    studentName: string;
  }>;
  courses: Array<{
    accessDurationMonths: number;
    description: string | null;
    id: string;
    paymentProviderProductId: string | null;
    priceInCents: number;
    slug: string;
    status: string;
    subtitle: string | null;
    coverImage: unknown;
    thumbnailUrl: string | null;
    title: string;
    workloadHours: number;
  }>;
  coursesRevenue: CourseRevenueSummary[];
  enrollments: Array<{
    courseId: string;
    courseTitle: string;
    email: string;
    expiresAt: Date;
    id: string;
    lastAccessAt: Date | null;
    name: string;
    startsAt: Date;
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
  jmvstreamAssets: Array<{
    deleteStatus: string;
    filename: string;
    galleryUuid: string | null;
    id: string;
    lastError: string | null;
    lessonId: string | null;
    uploadStatus: string;
    videoHash: string;
  }>;
  lessons: Array<{
    contentJson: unknown;
    courseTitle: string;
    durationSeconds: number;
    id: string;
    isPublished: boolean;
    moduleId: string;
    moduleTitle: string;
    description: string | null;
    sortOrder: number;
    title: string;
    textDurationSeconds: number;
    textWordCount: number;
    videoEmbedUrl: string | null;
    videoDurationSeconds: number;
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
    courseId: string;
    courseTitle: string;
    customerEmail: string | null;
    customerName: string | null;
    id: string;
    paidAt: Date | null;
    providerOrderId: string;
    status: string;
  }>;
  settings: {
    certificateSignerName: string | null;
    certificateSignerRole: string | null;
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
      jmvstreamAssets,
      studentProfiles,
      coursesRevenue,
    ] = await Promise.all([
      pool.query<{
        access_duration_months: number;
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
        "select id, slug, title, subtitle, description, workload_hours, price_in_cents, thumbnail_url, cover_image_json, payment_provider_product_id, access_duration_months, status from courses order by created_at desc"
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
        content_json: unknown;
        course_title: string;
        duration_seconds: number;
        id: string;
        is_published: boolean;
        lesson_description: string | null;
        module_id: string;
        module_title: string;
        sort_order: number;
        text_duration_seconds: number;
        text_word_count: number;
        title: string;
        video_embed_url: string | null;
        video_duration_seconds: number;
        video_external_id: string | null;
        video_provider: string | null;
      }>(
        `
          select l.id, l.module_id, m.title as module_title, c.title as course_title,
                 l.title, l.description as lesson_description, l.content_json,
                 l.duration_seconds, l.video_duration_seconds,
                 l.text_duration_seconds, l.text_word_count,
                 l.sort_order, l.video_provider,
                 l.video_external_id, l.video_embed_url, l.is_published
          from lessons l
          join modules m on m.id = l.module_id
          join courses c on c.id = m.course_id
          order by c.title, m.sort_order, l.sort_order
        `
      ),
      pool.query<{
        course_id: string;
        course_title: string;
        email: string;
        expires_at: Date;
        id: string;
        last_access_at: Date | null;
        name: string;
        starts_at: Date;
        status: string;
        user_id: string;
      }>(
        `
          select e.id, e.user_id, u.name, u.email, c.title as course_title,
                 c.id as course_id, e.status, e.starts_at, e.expires_at, p.last_access_at
          from enrollments e
          join users u on u.id = e.user_id
          left join profiles p on p.user_id = u.id
          join courses c on c.id = e.course_id
          order by e.updated_at desc
          limit 60
        `
      ),
      pool.query<{
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
          order by o.created_at desc
          limit 40
        `
      ),
      pool.query<{
        code: string;
        course_id: string;
        course_title_snapshot: string;
        issued_at: Date;
        student_name_snapshot: string;
      }>(
        "select code, course_id, student_name_snapshot, course_title_snapshot, issued_at from certificates order by issued_at desc limit 40"
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
        certificate_signer_name: string | null;
        certificate_signer_role: string | null;
      }>(
        "select certificate_signer_name, certificate_signer_role from app_settings where id = 'global' limit 1"
      ),
      pool.query<{
        action: string;
        actor_email: string | null;
        created_at: Date;
        target_id: string | null;
        target_name: string | null;
        target_type: string;
      }>(
        `
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
          order by a.created_at desc
          limit 30
        `
      ),
      getJmvstreamAssets(),
      pool.query<{
        email: string;
        last_access_at: Date | null;
        name: string;
        user_id: string;
      }>(
        `
          select u.id as user_id, u.name, u.email, p.last_access_at
          from profiles p
          join users u on u.id = p.user_id
          where p.role = 'student'
          order by u.name asc
        `
      ),
      pool.query<{
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
                 coalesce(sum(case when o.status = 'paid' then o.amount_in_cents else 0 end), 0)::bigint as total_revenue_in_cents
          from courses c
          left join orders o on o.course_id = c.id
          group by c.id, c.title
          order by total_revenue_in_cents desc
        `
      ),
    ]);

    const settingsRow = settings.rows[0];

    const enrollmentRows = enrollments.rows.map((row) => ({
      courseId: row.course_id,
      courseTitle: row.course_title,
      email: row.email,
      expiresAt: row.expires_at,
      id: row.id,
      lastAccessAt: row.last_access_at,
      name: row.name,
      startsAt: row.starts_at,
      status: row.status,
      userId: row.user_id,
    }));

    return {
      auditLogs: auditLogs.rows.map((row) => ({
        action: row.action,
        actorEmail: row.actor_email,
        createdAt: row.created_at,
        targetId: row.target_id,
        targetName: row.target_name,
        targetType: row.target_type,
      })),
      certificates: certificates.rows.map((row) => ({
        code: row.code,
        courseId: row.course_id,
        courseTitle: row.course_title_snapshot,
        issuedAt: row.issued_at,
        studentName: row.student_name_snapshot,
      })),
      courses: courses.rows.map((row) => ({
        accessDurationMonths: row.access_duration_months,
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
      jmvstreamAssets,
      lessons: lessons.rows.map((row) => ({
        contentJson: row.content_json,
        courseTitle: row.course_title,
        durationSeconds: row.duration_seconds,
        id: row.id,
        isPublished: row.is_published,
        moduleId: row.module_id,
        moduleTitle: row.module_title,
        description: row.lesson_description,
        sortOrder: row.sort_order,
        title: row.title,
        textDurationSeconds: row.text_duration_seconds,
        textWordCount: row.text_word_count,
        videoEmbedUrl: row.video_embed_url,
        videoDurationSeconds: row.video_duration_seconds,
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
        courseId: row.course_id,
        courseTitle: row.course_title,
        customerEmail: row.customer_email,
        customerName: row.customer_name,
        id: row.id,
        paidAt: row.paid_at,
        providerOrderId: row.provider_order_id,
        status: row.status,
      })),
      settings: {
        certificateSignerName: settingsRow?.certificate_signer_name ?? null,
        certificateSignerRole: settingsRow?.certificate_signer_role ?? null,
      },
      students: summarizeAdminStudents(
        enrollmentRows,
        studentProfiles.rows.map((row) => ({
          email: row.email,
          lastAccessAt: row.last_access_at,
          name: row.name,
          userId: row.user_id,
        }))
      ),
      coursesRevenue: coursesRevenue.rows.map((row) => ({
        courseId: row.course_id,
        courseTitle: row.course_title,
        totalOrders: row.total_orders,
        paidOrders: row.paid_orders,
        totalRevenueInCents: Number(row.total_revenue_in_cents),
      })),
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
