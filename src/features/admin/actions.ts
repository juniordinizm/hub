"use server";

import { revalidatePath } from "next/cache";
import { getPool } from "@/db";
import { recalculateCourseWorkloadHours } from "@/features/courses/server";
import { createCourseSlug } from "@/features/courses/slug";
import {
  assertJmvstreamVideoHashAvailable,
  completeJmvstreamUpload,
  deleteJmvstreamAssetsForCourse,
  deleteJmvstreamAssetsForLesson,
  deleteJmvstreamAssetsForModule,
  ensureJmvstreamCourseFolder,
  ensureJmvstreamModuleFolder,
  initJmvstreamUpload,
  retryJmvstreamAssetDelete,
  syncManualJmvstreamVideoAsset,
} from "@/features/jmvstream/server";
import {
  resolveLessonVideoEmbedUrl,
  toVideoProvider,
} from "@/features/videos/jmvstream";
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
    "/admin/alunos",
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

const resolveUniqueCourseSlug = async (title: string): Promise<string> => {
  const baseSlug = createCourseSlug(title);
  let candidate = baseSlug;
  let suffix = 2;

  while (true) {
    const existing = await getPool().query<{ id: string }>(
      "select id from courses where slug = $1 limit 1",
      [candidate]
    );

    if (!existing.rows[0]) {
      return candidate;
    }

    candidate = `${baseSlug}-${suffix}`;
    suffix += 1;
  }
};

const getCourseIdForModule = async (
  moduleId: string
): Promise<string | null> => {
  const { rows } = await getPool().query<{ course_id: string }>(
    "select course_id from modules where id = $1 limit 1",
    [moduleId]
  );

  return rows[0]?.course_id ?? null;
};

const getCourseIdForLesson = async (
  lessonId: string
): Promise<string | null> => {
  const { rows } = await getPool().query<{ course_id: string }>(
    `
      select m.course_id
      from lessons l
      join modules m on m.id = l.module_id
      where l.id = $1
      limit 1
    `,
    [lessonId]
  );

  return rows[0]?.course_id ?? null;
};

interface LessonJmvstreamSyncInput {
  lessonId: string;
  shouldTrackJmvstreamVideo: boolean;
  videoExternalId: null | string;
}

const validateJmvstreamLessonHash = async ({
  lessonId,
  shouldTrackJmvstreamVideo,
  videoExternalId,
}: LessonJmvstreamSyncInput): Promise<void> => {
  if (!(shouldTrackJmvstreamVideo && videoExternalId)) {
    return;
  }

  await assertJmvstreamVideoHashAvailable(
    videoExternalId,
    lessonId || undefined
  );
};

const syncSavedLessonJmvstreamVideo = async ({
  lessonId,
  shouldTrackJmvstreamVideo,
  videoExternalId,
}: LessonJmvstreamSyncInput): Promise<void> => {
  await syncManualJmvstreamVideoAsset({
    lessonId,
    videoHash: shouldTrackJmvstreamVideo ? videoExternalId : null,
  });
};

export const saveCourseAction = async (formData: FormData): Promise<void> => {
  const session = await requireRole(["admin"]);
  const courseId = readString(formData, "courseId");
  const title = readString(formData, "title");
  const values = [
    title,
    readString(formData, "subtitle") || null,
    readString(formData, "description") || null,
    readString(formData, "thumbnailUrl") || null,
    readString(formData, "supportWhatsappUrl") || null,
    readString(formData, "paymentProviderProductId") || null,
    readNumber(formData, "accessDurationMonths", 12),
    readString(formData, "status") || "draft",
  ];

  if (courseId) {
    await getPool().query(
      `
        update courses
        set title = $1,
            subtitle = $2,
            description = $3,
            thumbnail_url = $4,
            support_whatsapp_url = $5,
            payment_provider_product_id = $6,
            access_duration_months = $7,
            status = $8,
            updated_at = now()
        where id = $9
      `,
      [...values, courseId]
    );
    await audit({
      action: "course.updated",
      actorUserId: session.user.id,
      targetId: courseId,
      targetType: "course",
    });
    await ensureJmvstreamCourseFolder(courseId);
  } else {
    const slug = await resolveUniqueCourseSlug(title);
    const inserted = await getPool().query<{ id: string }>(
      `
        insert into courses (
          slug,
          title,
          subtitle,
          description,
          workload_hours,
          thumbnail_url,
          support_whatsapp_url,
          payment_provider_product_id,
          access_duration_months,
          status
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        returning id
      `,
      [slug, ...values.slice(0, 3), 0, ...values.slice(3)]
    );
    await audit({
      action: "course.created",
      actorUserId: session.user.id,
      targetId: inserted.rows[0]?.id,
      targetType: "course",
    });
    const insertedCourseId = inserted.rows[0]?.id;

    if (insertedCourseId) {
      await ensureJmvstreamCourseFolder(insertedCourseId);
    }
  }

  revalidateAdmin();
};

export const saveModuleAction = async (formData: FormData): Promise<void> => {
  const session = await requireRole(["admin"]);
  const moduleId = readString(formData, "moduleId");
  const courseId = readString(formData, "courseId");
  const title = readString(formData, "title");
  const description = readString(formData, "description") || null;
  const sortOrder = readNumber(formData, "sortOrder", 1);
  const color = readString(formData, "color") || "#326c71";

  if (moduleId) {
    const previousCourseId = await getCourseIdForModule(moduleId);
    await getPool().query(
      `
        update modules
        set course_id = $1,
            title = $2,
            description = $3,
            sort_order = $4,
            color = $5,
            updated_at = now()
        where id = $6
      `,
      [courseId, title, description, sortOrder, color, moduleId]
    );
    await audit({
      action: "module.updated",
      actorUserId: session.user.id,
      targetId: moduleId,
      targetType: "module",
    });
    await recalculateCourseWorkloadHours(courseId);
    if (previousCourseId && previousCourseId !== courseId) {
      await recalculateCourseWorkloadHours(previousCourseId);
    }
    await ensureJmvstreamModuleFolder(moduleId);
    revalidateAdmin();
    return;
  }

  const inserted = await getPool().query<{ id: string }>(
    `
      insert into modules (course_id, title, description, sort_order, color)
      values ($1, $2, $3, $4, $5)
      on conflict (course_id, sort_order) do update set
        title = excluded.title,
        description = excluded.description,
        color = excluded.color,
        updated_at = now()
      returning id
    `,
    [courseId, title, description, sortOrder, color]
  );
  await audit({
    action: "module.upserted",
    actorUserId: session.user.id,
    targetId: inserted.rows[0]?.id,
    targetType: "module",
  });
  const insertedModuleId = inserted.rows[0]?.id;

  if (insertedModuleId) {
    await ensureJmvstreamModuleFolder(insertedModuleId);
  }
  await recalculateCourseWorkloadHours(courseId);
  revalidateAdmin();
};

export const deleteCourseAction = async (formData: FormData): Promise<void> => {
  const session = await requireRole(["admin"]);
  const courseId = readString(formData, "courseId");

  if (!courseId) {
    throw new Error("Curso invalido.");
  }

  await deleteJmvstreamAssetsForCourse(courseId);
  await getPool().query("delete from courses where id = $1", [courseId]);
  await audit({
    action: "course.deleted",
    actorUserId: session.user.id,
    targetId: courseId,
    targetType: "course",
  });
  revalidateAdmin();
};

export const deleteModuleAction = async (formData: FormData): Promise<void> => {
  const session = await requireRole(["admin"]);
  const moduleId = readString(formData, "moduleId");

  if (!moduleId) {
    throw new Error("Modulo invalido.");
  }

  const courseId = await getCourseIdForModule(moduleId);
  await deleteJmvstreamAssetsForModule(moduleId);
  await getPool().query("delete from modules where id = $1", [moduleId]);
  await audit({
    action: "module.deleted",
    actorUserId: session.user.id,
    targetId: moduleId,
    targetType: "module",
  });
  if (courseId) {
    await recalculateCourseWorkloadHours(courseId);
  }
  revalidateAdmin();
};

export const deleteLessonAction = async (formData: FormData): Promise<void> => {
  const session = await requireRole(["admin"]);
  const lessonId = readString(formData, "lessonId");

  if (!lessonId) {
    throw new Error("Aula invalida.");
  }

  const courseId = await getCourseIdForLesson(lessonId);
  await deleteJmvstreamAssetsForLesson(lessonId);
  await getPool().query("delete from lessons where id = $1", [lessonId]);
  await audit({
    action: "lesson.deleted",
    actorUserId: session.user.id,
    targetId: lessonId,
    targetType: "lesson",
  });
  if (courseId) {
    await recalculateCourseWorkloadHours(courseId);
  }
  revalidateAdmin();
};

export const saveLessonAction = async (formData: FormData): Promise<void> => {
  const session = await requireRole(["admin"]);
  const lessonId = readString(formData, "lessonId");
  const videoProvider = toVideoProvider(readString(formData, "videoProvider"));
  const videoExternalId = readString(formData, "videoExternalId") || null;
  const videoEmbedUrl = resolveLessonVideoEmbedUrl({
    embedUrl: readString(formData, "videoEmbedUrl") || null,
    provider: videoProvider,
  });
  const shouldTrackJmvstreamVideo = videoProvider === "jmvstream";

  await validateJmvstreamLessonHash({
    lessonId,
    shouldTrackJmvstreamVideo,
    videoExternalId,
  });

  const values = [
    readString(formData, "moduleId"),
    readString(formData, "title"),
    readString(formData, "description") || null,
    readString(formData, "lessonType") || "video",
    videoProvider,
    videoExternalId,
    videoEmbedUrl,
    readNumber(formData, "durationSeconds"),
    readNumber(formData, "sortOrder", 1),
    formData.get("isPublished") === "on",
  ];
  const moduleCourseId = await getCourseIdForModule(String(values[0]));

  if (lessonId) {
    const previousCourseId = await getCourseIdForLesson(lessonId);
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
            duration_seconds = $8,
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
    if (moduleCourseId) {
      await recalculateCourseWorkloadHours(moduleCourseId);
    }
    if (previousCourseId && previousCourseId !== moduleCourseId) {
      await recalculateCourseWorkloadHours(previousCourseId);
    }
    await syncSavedLessonJmvstreamVideo({
      lessonId,
      shouldTrackJmvstreamVideo,
      videoExternalId,
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
          duration_seconds,
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
    const insertedLessonId = inserted.rows[0]?.id;

    if (insertedLessonId) {
      await syncSavedLessonJmvstreamVideo({
        lessonId: insertedLessonId,
        shouldTrackJmvstreamVideo,
        videoExternalId,
      });
    }
    if (moduleCourseId) {
      await recalculateCourseWorkloadHours(moduleCourseId);
    }
  }

  revalidateAdmin();
};

export const ensureJmvstreamCourseFolderAction = async (
  courseId: string
): Promise<void> => {
  await requireRole(["admin"]);
  await ensureJmvstreamCourseFolder(courseId);
  revalidateAdmin();
};

export const ensureJmvstreamModuleFolderAction = async (
  moduleId: string
): Promise<void> => {
  await requireRole(["admin"]);
  await ensureJmvstreamModuleFolder(moduleId);
  revalidateAdmin();
};

export const initJmvstreamUploadAction = async (input: {
  fileName: string;
  fileSize: number;
  lessonId: string;
  uploadType: "direct" | "multipart";
}) => {
  await requireRole(["admin"]);
  return initJmvstreamUpload(input);
};

export const createLessonForJmvstreamUploadAction = async (
  formData: FormData
): Promise<string> => {
  const session = await requireRole(["admin"]);
  const lessonId = readString(formData, "lessonId");

  if (lessonId) {
    return lessonId;
  }

  const moduleId = readString(formData, "moduleId");
  const values = [
    moduleId,
    readString(formData, "title"),
    readString(formData, "description") || null,
    readString(formData, "lessonType") || "video",
    "jmvstream",
    null,
    null,
    readNumber(formData, "durationSeconds"),
    readNumber(formData, "sortOrder", 1),
    formData.get("isPublished") === "on",
  ];
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
        duration_seconds,
        sort_order,
        is_published
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      returning id
    `,
    values
  );
  const insertedLessonId = inserted.rows[0]?.id;

  if (!insertedLessonId) {
    throw new Error("Nao foi possivel criar a aula para upload.");
  }

  await audit({
    action: "lesson.created",
    actorUserId: session.user.id,
    targetId: insertedLessonId,
    targetType: "lesson",
  });

  const moduleCourseId = await getCourseIdForModule(moduleId);

  if (moduleCourseId) {
    await recalculateCourseWorkloadHours(moduleCourseId);
  }

  revalidateAdmin();
  return insertedLessonId;
};

export const completeJmvstreamUploadAction = async (input: {
  filename: string;
  lessonId: string;
  objectName: string;
  parts: Array<{
    ETag?: string;
    PartNumber?: number;
    etag?: string;
    partNumber?: number;
  }>;
  size: number;
  uploadId: string;
  videoHash: string;
}): Promise<void> => {
  await requireRole(["admin"]);
  await completeJmvstreamUpload(input);
  revalidateAdmin();
};

export const retryJmvstreamDeleteAction = async ({
  assetId,
}: {
  assetId: string;
}): Promise<void> => {
  await requireRole(["admin"]);
  await retryJmvstreamAssetDelete(assetId);
  revalidateAdmin();
};

export const updateEnrollmentAction = async (
  formData: FormData
): Promise<void> => {
  const session = await requireRole(["admin", "support"]);
  const enrollmentId = readString(formData, "enrollmentId");
  const status = readString(formData, "status");
  const expiresAt = readString(formData, "expiresAt");
  const userId = readString(formData, "userId");

  await getPool().query(
    `
      update enrollments
      set status = $1::enrollment_status,
          expires_at = $2::timestamptz,
          revoked_at = case when $1::text = 'revoked' then now() else null end,
          revoked_reason = case when $1::text = 'revoked' then 'admin_manual' else null end,
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

  if (userId) {
    revalidatePath(`/admin/alunos/${userId}`);
  }
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

export const deleteFaqAction = async (formData: FormData): Promise<void> => {
  const session = await requireRole(["admin"]);
  const faqId = readString(formData, "faqId");

  if (!faqId) {
    throw new Error("FAQ invalido.");
  }

  await getPool().query("delete from faq_items where id = $1", [faqId]);
  await audit({
    action: "faq.deleted",
    actorUserId: session.user.id,
    targetId: faqId,
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
