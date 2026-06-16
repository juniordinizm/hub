"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getPool } from "@/db";
import { sendAccessReleasedEmail } from "@/features/email/server";
import { addMonths } from "@/features/enrollments/rules";
import {
  resolveLessonVideoEmbedUrl,
  toVideoProvider,
} from "@/features/videos/jmvstream";
import { getAuth } from "@/lib/auth";
import { getServerEnv } from "@/lib/env";
import { requireRole } from "@/lib/session";

const readString = (formData: FormData, key: string): string =>
  String(formData.get(key) ?? "").trim();

const readNumber = (formData: FormData, key: string, fallback = 0): number => {
  const value = Number(formData.get(key));
  return Number.isFinite(value) ? value : fallback;
};

const revalidateAdmin = (): void => {
  for (const path of [
    "/admin",
    "/admin/cursos",
    "/admin/alunas",
    "/admin/financeiro",
    "/admin/faq",
    "/admin/configuracoes",
  ]) {
    revalidatePath(path);
  }
};

const audit = async ({
  action,
  actorUserId,
  targetId,
  targetType,
}: {
  action: string;
  actorUserId: string;
  targetId?: string | undefined;
  targetType: string;
}) => {
  await getPool().query(
    `
      insert into audit_logs (actor_user_id, action, target_type, target_id)
      values ($1, $2, $3, $4)
    `,
    [actorUserId, action, targetType, targetId ?? null]
  );
};

export const saveCourseAction = async (formData: FormData): Promise<void> => {
  const session = await requireRole(["admin"]);
  const courseId = readString(formData, "courseId");
  const values = [
    readString(formData, "slug"),
    readString(formData, "title"),
    readString(formData, "subtitle") || null,
    readString(formData, "description") || null,
    readString(formData, "instructorName") || null,
    readNumber(formData, "workloadHours"),
    readString(formData, "supportWhatsappUrl") || null,
    readString(formData, "paymentProviderProductId") || null,
    readNumber(formData, "accessDurationMonths", 12),
    readString(formData, "status") || "draft",
  ];

  if (courseId) {
    await getPool().query(
      `
        update courses
        set slug = $1,
            title = $2,
            subtitle = $3,
            description = $4,
            instructor_name = $5,
            workload_hours = $6,
            support_whatsapp_url = $7,
            payment_provider_product_id = $8,
            access_duration_months = $9,
            status = $10,
            updated_at = now()
        where id = $11
      `,
      [...values, courseId]
    );
    await audit({
      action: "course.updated",
      actorUserId: session.user.id,
      targetId: courseId,
      targetType: "course",
    });
  } else {
    const inserted = await getPool().query<{ id: string }>(
      `
        insert into courses (
          slug,
          title,
          subtitle,
          description,
          instructor_name,
          workload_hours,
          support_whatsapp_url,
          payment_provider_product_id,
          access_duration_months,
          status
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        returning id
      `,
      values
    );
    await audit({
      action: "course.created",
      actorUserId: session.user.id,
      targetId: inserted.rows[0]?.id,
      targetType: "course",
    });
  }

  revalidateAdmin();
};

export const saveModuleAction = async (formData: FormData): Promise<void> => {
  const session = await requireRole(["admin"]);
  const courseId = readString(formData, "courseId");
  const title = readString(formData, "title");
  const sortOrder = readNumber(formData, "sortOrder", 1);
  const color = readString(formData, "color") || "#326c71";

  const inserted = await getPool().query<{ id: string }>(
    `
      insert into modules (course_id, title, sort_order, color)
      values ($1, $2, $3, $4)
      on conflict (course_id, sort_order) do update set
        title = excluded.title,
        color = excluded.color,
        updated_at = now()
      returning id
    `,
    [courseId, title, sortOrder, color]
  );
  await audit({
    action: "module.upserted",
    actorUserId: session.user.id,
    targetId: inserted.rows[0]?.id,
    targetType: "module",
  });
  revalidateAdmin();
};

export const saveLessonAction = async (formData: FormData): Promise<void> => {
  const session = await requireRole(["admin"]);
  const lessonId = readString(formData, "lessonId");
  const videoProvider = toVideoProvider(readString(formData, "videoProvider"));
  const videoEmbedUrl = resolveLessonVideoEmbedUrl({
    embedUrl: readString(formData, "videoEmbedUrl") || null,
    provider: videoProvider,
  });
  const values = [
    readString(formData, "moduleId"),
    readString(formData, "title"),
    readString(formData, "description") || null,
    readString(formData, "lessonType") || "video",
    videoProvider,
    readString(formData, "videoExternalId") || null,
    videoEmbedUrl,
    readNumber(formData, "durationMinutes"),
    readNumber(formData, "sortOrder", 1),
    formData.get("isPublished") === "on",
  ];

  if (lessonId) {
    await getPool().query(
      `
        update lessons
        set module_id = $1,
            title = $2,
            description = $3,
            lesson_type = $4,
            video_provider = $5,
            video_external_id = $6,
            video_embed_url = $7,
            duration_minutes = $8,
            sort_order = $9,
            is_published = $10,
            updated_at = now()
        where id = $11
      `,
      [...values, lessonId]
    );
    await audit({
      action: "lesson.updated",
      actorUserId: session.user.id,
      targetId: lessonId,
      targetType: "lesson",
    });
  } else {
    const inserted = await getPool().query<{ id: string }>(
      `
        insert into lessons (
          module_id,
          title,
          description,
          lesson_type,
          video_provider,
          video_external_id,
          video_embed_url,
          duration_minutes,
          sort_order,
          is_published
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        returning id
      `,
      values
    );
    await audit({
      action: "lesson.created",
      actorUserId: session.user.id,
      targetId: inserted.rows[0]?.id,
      targetType: "lesson",
    });
  }

  revalidateAdmin();
};

export const inviteStudentAction = async (
  formData: FormData
): Promise<void> => {
  const session = await requireRole(["admin", "support"]);
  const email = readString(formData, "email").toLowerCase();
  const name = readString(formData, "name");
  const courseId = readString(formData, "courseId");
  const months = readNumber(formData, "months", 12);
  const temporaryPassword = `${randomUUID()}Aa1!`;
  let userId: string | null = null;

  try {
    const result = await getAuth().api.signUpEmail({
      body: { email, name, password: temporaryPassword },
    });
    userId = result.user.id;
  } catch {
    const existing = await getPool().query<{ id: string }>(
      "select id from users where email = $1 limit 1",
      [email]
    );
    userId = existing.rows[0]?.id ?? null;
  }

  if (!userId) {
    throw new Error("Nao foi possivel criar ou localizar a aluna.");
  }

  const expiresAt = addMonths(new Date(), months);
  await getPool().query(
    `
      insert into profiles (user_id, role, invited_at)
      values ($1, 'student', now())
      on conflict (user_id) do update set invited_at = now()
    `,
    [userId]
  );
  await getPool().query(
    `
      insert into enrollments (user_id, course_id, status, starts_at, expires_at)
      values ($1, $2, 'active', now(), $3)
      on conflict (user_id, course_id) do update set
        status = 'active',
        expires_at = excluded.expires_at,
        revoked_at = null,
        revoked_reason = null,
        updated_at = now()
    `,
    [userId, courseId, expiresAt]
  );

  await sendAccessReleasedEmail({
    courseTitle: readString(formData, "courseTitle") || "PROTEA-R Hub",
    to: email,
    userName: name,
  });
  await getAuth().api.requestPasswordReset({
    body: {
      email,
      redirectTo: `${getServerEnv().NEXT_PUBLIC_APP_URL}/redefinir-senha`,
    },
  });
  await audit({
    action: "student.invited",
    actorUserId: session.user.id,
    targetId: userId,
    targetType: "user",
  });
  revalidateAdmin();
};

export const updateEnrollmentAction = async (
  formData: FormData
): Promise<void> => {
  const session = await requireRole(["admin", "support"]);
  const enrollmentId = readString(formData, "enrollmentId");
  const status = readString(formData, "status");
  const expiresAt = readString(formData, "expiresAt");

  await getPool().query(
    `
      update enrollments
      set status = $1,
          expires_at = $2::timestamptz,
          revoked_at = case when $1 = 'revoked' then now() else null end,
          revoked_reason = case when $1 = 'revoked' then 'admin_manual' else null end,
          updated_at = now()
      where id = $3
    `,
    [status, expiresAt, enrollmentId]
  );
  await audit({
    action: "enrollment.updated",
    actorUserId: session.user.id,
    targetId: enrollmentId,
    targetType: "enrollment",
  });
  revalidateAdmin();
};

export const saveFaqAction = async (formData: FormData): Promise<void> => {
  const session = await requireRole(["admin"]);
  const faqId = readString(formData, "faqId");
  const values = [
    readString(formData, "question"),
    readString(formData, "answer"),
    readString(formData, "category") || "geral",
    readNumber(formData, "sortOrder"),
    formData.get("isPublished") === "on",
  ];

  if (faqId) {
    await getPool().query(
      `
        update faq_items
        set question = $1,
            answer = $2,
            category = $3,
            sort_order = $4,
            is_published = $5,
            updated_at = now()
        where id = $6
      `,
      [...values, faqId]
    );
  } else {
    await getPool().query(
      `
        insert into faq_items (question, answer, category, sort_order, is_published)
        values ($1, $2, $3, $4, $5)
      `,
      values
    );
  }

  await audit({
    action: "faq.saved",
    actorUserId: session.user.id,
    targetId: faqId || undefined,
    targetType: "faq",
  });
  revalidateAdmin();
};

export const saveSettingsAction = async (formData: FormData): Promise<void> => {
  const session = await requireRole(["admin"]);
  await getPool().query(
    `
      insert into app_settings (
        id,
        support_whatsapp_url,
        certificate_signer_name,
        certificate_signer_role,
        abacatepay_webhook_secret_last4
      )
      values ('global', $1, $2, $3, $4)
      on conflict (id) do update set
        support_whatsapp_url = excluded.support_whatsapp_url,
        certificate_signer_name = excluded.certificate_signer_name,
        certificate_signer_role = excluded.certificate_signer_role,
        abacatepay_webhook_secret_last4 = excluded.abacatepay_webhook_secret_last4,
        updated_at = now()
    `,
    [
      readString(formData, "supportWhatsappUrl") || null,
      readString(formData, "certificateSignerName") || null,
      readString(formData, "certificateSignerRole") || null,
      readString(formData, "abacatepayWebhookSecretLast4") || null,
    ]
  );
  await audit({
    action: "settings.updated",
    actorUserId: session.user.id,
    targetId: "global",
    targetType: "settings",
  });
  revalidateAdmin();
};
