"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getPool } from "@/db";
import {
  buildAdminCourseEditPath,
  buildAdminLessonEditPath,
  normalizeLessonDraftInput,
} from "@/features/admin/lesson-drafts";
import {
  getLessonContentStorageKeys,
  normalizeLessonContentFromForm,
} from "@/features/courses/lesson-content";
import { calculateLessonDurationBreakdown } from "@/features/courses/lesson-duration";
import { recalculateCourseWorkloadHours } from "@/features/courses/server";
import { createCourseSlug } from "@/features/courses/slug";
import {
  completeJmvstreamUpload,
  deleteJmvstreamAssetsForCourse,
  deleteJmvstreamAssetsForLesson,
  deleteJmvstreamAssetsForModule,
  ensureJmvstreamCourseFolder,
  initJmvstreamUpload,
  markJmvstreamUploadFailed,
  resolveJmvstreamPlayerThumbnailUrl,
  retryJmvstreamAssetDelete,
  syncJmvstreamLessonPlayer,
} from "@/features/jmvstream/server";
import { parsePriceToCents } from "@/features/payments/abacatepay";
import { createAbacatePayCourseProduct } from "@/features/payments/server";
import {
  getCourseCoverStorageKeys,
  getCourseCoverVariantPath,
  parseCourseCoverImage,
} from "@/features/storage/course-cover";
import { deleteR2Objects } from "@/features/storage/r2";
import { resolveLessonVideoEmbedUrl } from "@/features/videos/jmvstream";
import { requireRole } from "@/lib/session";

const readString = (formData: FormData, key: string): string =>
  String(formData.get(key) ?? "").trim();

const readNumber = (formData: FormData, key: string, fallback = 0): number => {
  const value = Number(formData.get(key));
  return Number.isFinite(value) ? value : fallback;
};

const parseJsonFormField = (formData: FormData, key: string): unknown => {
  const value = readString(formData, key);

  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as unknown;
  } catch {
    throw new Error("Dados de capa invalidos.");
  }
};

const parseCourseCoverFormField = (formData: FormData): unknown => {
  const rawCoverImage = parseJsonFormField(formData, "coverImage");

  if (!rawCoverImage) {
    return null;
  }

  const coverImage = parseCourseCoverImage(rawCoverImage);

  if (!coverImage) {
    throw new Error("Dados de capa invalidos.");
  }

  return coverImage;
};

const getCourseCoverUrl = ({
  courseId,
  coverImage,
}: {
  courseId: string;
  coverImage: unknown;
}): string | null =>
  getCourseCoverVariantPath({ courseId, coverImage, variant: "card" });

const revalidateAdmin = (): void => {
  for (const path of [
    "/admin",
    "/admin/cursos",
    "/admin/alunas",
    "/admin/alunos",
    "/admin/financeiro",
    "/admin/faq",
    "/admin/configuracoes",
    "/app",
  ]) {
    revalidatePath(path);
  }
  revalidatePath("/admin", "layout");
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

const getVideoExternalIdForLesson = async (
  lessonId: string
): Promise<string | null> => {
  const { rows } = await getPool().query<{ video_external_id: string | null }>(
    "select video_external_id from lessons where id = $1 limit 1",
    [lessonId]
  );

  return rows[0]?.video_external_id ?? null;
};

const getLessonVideoFormState = async ({
  formData,
  lessonId,
}: {
  formData: FormData;
  lessonId: string;
}): Promise<{
  hasVideoContent: boolean;
  thumbnailUrl: string | null;
  videoEmbedUrl: string | null;
  videoExternalId: string | null;
  videoProvider: "jmvstream" | null;
}> => {
  const shouldRemoveVideo = formData.get("removeVideo") === "on";
  const existingVideoExternalId = lessonId
    ? await getVideoExternalIdForLesson(lessonId)
    : null;
  const videoEmbedUrl = shouldRemoveVideo
    ? null
    : resolveLessonVideoEmbedUrl({
        embedUrl: readString(formData, "videoEmbedUrl") || null,
        provider: "jmvstream",
      });
  const hasVideoContent = Boolean(videoEmbedUrl || existingVideoExternalId);
  const shouldKeepVideo = hasVideoContent && !shouldRemoveVideo;
  const thumbnailUrl = shouldKeepVideo
    ? await resolveJmvstreamPlayerThumbnailUrl(videoEmbedUrl)
    : null;

  return {
    hasVideoContent: shouldKeepVideo,
    thumbnailUrl,
    videoEmbedUrl,
    videoExternalId: shouldKeepVideo ? existingVideoExternalId : null,
    videoProvider: shouldKeepVideo ? "jmvstream" : null,
  };
};

const getLessonR2ObjectKeys = async (lessonId: string): Promise<string[]> => {
  const { rows } = await getPool().query<{ content_json: unknown }>(
    "select content_json from lessons where id = $1 limit 1",
    [lessonId]
  );

  return getLessonContentStorageKeys(rows[0]?.content_json);
};

const getModuleR2ObjectKeys = async (moduleId: string): Promise<string[]> => {
  const { rows } = await getPool().query<{ content_json: unknown }>(
    "select content_json from lessons where module_id = $1",
    [moduleId]
  );

  return rows.flatMap((row) => getLessonContentStorageKeys(row.content_json));
};

const getCourseR2ObjectKeys = async (courseId: string): Promise<string[]> => {
  const [courseResult, lessonResult] = await Promise.all([
    getPool().query<{ cover_image_json: unknown }>(
      "select cover_image_json from courses where id = $1 limit 1",
      [courseId]
    ),
    getPool().query<{ content_json: unknown }>(
      `
        select l.content_json
        from lessons l
        join modules m on m.id = l.module_id
        where m.course_id = $1
      `,
      [courseId]
    ),
  ]);

  return [
    ...getCourseCoverStorageKeys(courseResult.rows[0]?.cover_image_json),
    ...lessonResult.rows.flatMap((row) =>
      getLessonContentStorageKeys(row.content_json)
    ),
  ];
};

const deleteRemovedR2Objects = async ({
  nextKeys,
  previousKeys,
}: {
  nextKeys: string[];
  previousKeys: string[];
}): Promise<void> => {
  const nextKeySet = new Set(nextKeys);
  const removedKeys = previousKeys.filter((key) => !nextKeySet.has(key));

  await deleteR2Objects(removedKeys);
};

const cleanupUpdatedLessonAssets = async ({
  contentJson,
  hasVideoContent,
  lessonId,
  previousR2Keys,
}: {
  contentJson: unknown;
  hasVideoContent: boolean;
  lessonId: string;
  previousR2Keys: string[];
}): Promise<void> => {
  if (!hasVideoContent) {
    await deleteJmvstreamAssetsForLesson(lessonId);
  }

  await deleteRemovedR2Objects({
    nextKeys: getLessonContentStorageKeys(contentJson),
    previousKeys: previousR2Keys,
  });
};

export const saveCourseAction = async (formData: FormData): Promise<void> => {
  const session = await requireRole(["admin"]);
  const courseId = readString(formData, "courseId");
  const title = readString(formData, "title");
  const subtitle = readString(formData, "subtitle") || null;
  const description = readString(formData, "description") || null;
  const coverImage = parseCourseCoverFormField(formData);
  const accessDurationMonths = readNumber(formData, "accessDurationMonths", 12);
  const status = readString(formData, "status") || "draft";
  const thumbnailUrl = courseId
    ? getCourseCoverUrl({
        courseId,
        coverImage,
      })
    : null;
  const values = [
    title,
    subtitle,
    description,
    thumbnailUrl,
    coverImage ? JSON.stringify(coverImage) : null,
    accessDurationMonths,
    status,
  ];
  let savedCourseId = courseId;
  const previousCoverKeys = courseId
    ? (await getCourseR2ObjectKeys(courseId)).filter((key) =>
        key.includes("/cover/")
      )
    : [];

  if (courseId) {
    await getPool().query(
      `
        update courses
        set title = $1,
            subtitle = $2,
            description = $3,
            thumbnail_url = $4,
            cover_image_json = $5::jsonb,
            access_duration_months = $6,
            status = $7,
            updated_at = now()
        where id = $8
      `,
      [...values, courseId]
    );
    await audit({
      action: "course.updated",
      actorUserId: session.user.id,
      targetId: courseId,
      targetType: "course",
    });
    await deleteRemovedR2Objects({
      nextKeys: getCourseCoverStorageKeys(coverImage),
      previousKeys: previousCoverKeys,
    });
  } else {
    const insertedCourseId = randomUUID();
    savedCourseId = insertedCourseId;
    const insertedThumbnailUrl = getCourseCoverUrl({
      courseId: insertedCourseId,
      coverImage,
    });
    const slug = await resolveUniqueCourseSlug(title);
    const priceInCents = parsePriceToCents(readString(formData, "price"));
    const { productId } = await createAbacatePayCourseProduct({
      courseId: insertedCourseId,
      description,
      imageUrl: insertedThumbnailUrl,
      priceInCents,
      title,
    });
    const inserted = await getPool().query<{ id: string }>(
      `
        insert into courses (
          id,
          slug,
          title,
          subtitle,
          description,
          price_in_cents,
          thumbnail_url,
          cover_image_json,
          payment_provider_product_id,
          access_duration_months,
          status
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11)
        returning id
      `,
      [
        insertedCourseId,
        slug,
        title,
        subtitle,
        description,
        priceInCents,
        insertedThumbnailUrl,
        coverImage ? JSON.stringify(coverImage) : null,
        productId,
        accessDurationMonths,
        status,
      ]
    );
    await audit({
      action: "course.created",
      actorUserId: session.user.id,
      targetId: inserted.rows[0]?.id,
      targetType: "course",
    });
  }

  await ensureJmvstreamCourseFolder(savedCourseId);
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
  await recalculateCourseWorkloadHours(courseId);
  revalidateAdmin();
};

export const deleteCourseAction = async (formData: FormData): Promise<void> => {
  const session = await requireRole(["admin"]);
  const courseId = readString(formData, "courseId");

  if (!courseId) {
    throw new Error("Curso invalido.");
  }

  const r2ObjectKeys = await getCourseR2ObjectKeys(courseId);
  await deleteR2Objects(r2ObjectKeys);
  await deleteJmvstreamAssetsForCourse(courseId);
  await getPool().query("delete from courses where id = $1", [courseId]);
  await audit({
    action: "course.deleted",
    actorUserId: session.user.id,
    targetId: courseId,
    targetType: "course",
  });
  revalidateAdmin();
  // biome-ignore lint/suspicious/noExplicitAny: Next.js typed routes workaround
  redirect("/admin/cursos" as any);
};

export const deleteModuleAction = async (formData: FormData): Promise<void> => {
  const session = await requireRole(["admin"]);
  const moduleId = readString(formData, "moduleId");

  if (!moduleId) {
    throw new Error("Modulo invalido.");
  }

  const courseId = await getCourseIdForModule(moduleId);
  const r2ObjectKeys = await getModuleR2ObjectKeys(moduleId);
  await deleteR2Objects(r2ObjectKeys);
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
  const r2ObjectKeys = await getLessonR2ObjectKeys(lessonId);
  await deleteR2Objects(r2ObjectKeys);
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
  if (courseId) {
    // biome-ignore lint/suspicious/noExplicitAny: Next.js typed routes workaround
    redirect(buildAdminCourseEditPath(courseId) as any);
  }
};

export const createLessonDraftAction = async (
  formData: FormData
): Promise<void> => {
  const session = await requireRole(["admin"]);
  const draft = normalizeLessonDraftInput(formData);
  const courseId = await getCourseIdForModule(draft.moduleId);

  if (!courseId) {
    throw new Error("Modulo invalido.");
  }

  const inserted = await getPool().query<{ id: string }>(
    `
      insert into lessons (
        module_id,
        title,
        description,
        video_provider,
        video_external_id,
        video_embed_url,
        content_json,
        duration_seconds,
        sort_order,
        is_published
      )
      values ($1, $2, $3, null, null, null, null, 0, $4, false)
      returning id
    `,
    [draft.moduleId, draft.title, draft.description, draft.sortOrder]
  );
  const lessonId = inserted.rows[0]?.id;

  await audit({
    action: "lesson.created",
    actorUserId: session.user.id,
    targetId: lessonId,
    targetType: "lesson",
  });
  await recalculateCourseWorkloadHours(courseId);
  revalidateAdmin();

  if (!lessonId) {
    throw new Error("Nao foi possivel criar a aula.");
  }

  // biome-ignore lint/suspicious/noExplicitAny: Next.js typed routes workaround
  redirect(buildAdminLessonEditPath({ courseId, lessonId }) as any);
};

export const saveLessonAction = async (formData: FormData): Promise<void> => {
  const session = await requireRole(["admin"]);
  const lessonId = readString(formData, "lessonId");
  const contentJson = normalizeLessonContentFromForm({
    formData,
    lessonId,
  });
  const {
    hasVideoContent,
    thumbnailUrl,
    videoEmbedUrl,
    videoExternalId,
    videoProvider,
  } = await getLessonVideoFormState({ formData, lessonId });

  if (!(hasVideoContent || contentJson)) {
    throw new Error("Adicione video ou texto antes de salvar a aula.");
  }

  const durationBreakdown = calculateLessonDurationBreakdown({
    textDocument: contentJson?.document ?? null,
    videoDurationSeconds: hasVideoContent
      ? readNumber(formData, "durationSeconds")
      : 0,
  });
  const values = [
    readString(formData, "moduleId"),
    readString(formData, "title"),
    readString(formData, "description") || null,
    videoProvider,
    videoExternalId,
    videoEmbedUrl,
    thumbnailUrl,
    contentJson ? JSON.stringify(contentJson) : null,
    durationBreakdown.totalDurationSeconds,
    durationBreakdown.videoDurationSeconds,
    durationBreakdown.textDurationSeconds,
    durationBreakdown.textWordCount,
    readNumber(formData, "sortOrder", 1),
    formData.get("isPublished") === "on",
  ];
  const moduleCourseId = await getCourseIdForModule(String(values[0]));
  const previousR2Keys = lessonId ? await getLessonR2ObjectKeys(lessonId) : [];

  if (lessonId) {
    const previousCourseId = await getCourseIdForLesson(lessonId);
    await getPool().query(
      `
        update lessons
        set module_id = $1,
            title = $2,
            description = $3,
            video_provider = $4,
            video_external_id = $5,
            video_embed_url = $6,
            thumbnail_url = $7,
            content_json = $8::jsonb,
            duration_seconds = $9,
            video_duration_seconds = $10,
            text_duration_seconds = $11,
            text_word_count = $12,
            sort_order = $13,
            is_published = $14,
            updated_at = now()
        where id = $15
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
    await cleanupUpdatedLessonAssets({
      contentJson,
      hasVideoContent,
      lessonId,
      previousR2Keys,
    });
  } else {
    const inserted = await getPool().query<{ id: string }>(
      `
        insert into lessons (
          module_id,
          title,
          description,
          video_provider,
          video_external_id,
          video_embed_url,
          thumbnail_url,
          content_json,
          duration_seconds,
          video_duration_seconds,
          text_duration_seconds,
          text_word_count,
          sort_order,
          is_published
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11, $12, $13, $14)
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
    if (moduleCourseId) {
      await recalculateCourseWorkloadHours(moduleCourseId);
    }
  }

  revalidateAdmin();
  if (lessonId && moduleCourseId) {
    revalidatePath(
      buildAdminLessonEditPath({ courseId: moduleCourseId, lessonId })
    );
  }
};

export const ensureJmvstreamCourseFolderAction = async (
  courseId: string
): Promise<void> => {
  await requireRole(["admin"]);
  await ensureJmvstreamCourseFolder(courseId);
  revalidateAdmin();
};

export const initJmvstreamUploadAction = async (input: {
  fileName: string;
  fileSize: number;
  lessonId: string;
  uploadType: "direct" | "multipart";
}): Promise<
  | { data: Awaited<ReturnType<typeof initJmvstreamUpload>>; ok: true }
  | { error: string; ok: false }
> => {
  await requireRole(["admin"]);

  try {
    return {
      data: await initJmvstreamUpload(input),
      ok: true,
    };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Nao foi possivel iniciar o upload JMVStream.",
      ok: false,
    };
  }
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
  uploadSessionId: string;
  uploadId: string;
  videoHash: string;
}): Promise<void> => {
  await requireRole(["admin"]);
  await completeJmvstreamUpload(input);
  revalidateAdmin();
};

export const syncJmvstreamLessonPlayerAction = async (input: {
  lessonId: string;
}): Promise<{ playerUrl: null | string; ready: boolean }> => {
  await requireRole(["admin"]);
  const result = await syncJmvstreamLessonPlayer(input.lessonId);

  if (result.ready) {
    revalidateAdmin();
  }

  return result;
};

export const markJmvstreamUploadFailedAction = async (input: {
  lastError: string;
  videoHash: string;
}): Promise<void> => {
  await requireRole(["admin"]);
  await markJmvstreamUploadFailed(input);
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
          expiry_warning_7d_sent_at = case
            when $1::text = 'active' then null
            else expiry_warning_7d_sent_at
          end,
          expiry_warning_1d_sent_at = case
            when $1::text = 'active' then null
            else expiry_warning_1d_sent_at
          end,
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
        certificate_signer_name,
        certificate_signer_role
      )
      values ('global', $1, $2)
      on conflict (id) do update set
        certificate_signer_name = excluded.certificate_signer_name,
        certificate_signer_role = excluded.certificate_signer_role,
        updated_at = now()
    `,
    [
      readString(formData, "certificateSignerName") || null,
      readString(formData, "certificateSignerRole") || null,
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

export const reorderModulesAction = async (
  courseId: string,
  orderedModuleIds: string[]
): Promise<void> => {
  const session = await requireRole(["admin"]);

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Pass 1: Set to temporary negative order to avoid unique constraint violations
    for (let i = 0; i < orderedModuleIds.length; i++) {
      await client.query(
        "update modules set sort_order = $1 where id = $2 and course_id = $3",
        [-(i + 1), orderedModuleIds[i], courseId]
      );
    }

    // Pass 2: Set to final correct order
    for (let i = 0; i < orderedModuleIds.length; i++) {
      await client.query(
        "update modules set sort_order = $1, updated_at = now() where id = $2 and course_id = $3",
        [i + 1, orderedModuleIds[i], courseId]
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  await audit({
    action: "modules.reordered",
    actorUserId: session.user.id,
    targetId: courseId,
    targetType: "course",
  });
  revalidateAdmin();
};

export const reorderLessonsAction = async (
  moduleId: string,
  orderedLessonIds: string[]
): Promise<void> => {
  const session = await requireRole(["admin"]);

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Pass 1: Set to temporary negative order to avoid unique constraint violations
    for (let i = 0; i < orderedLessonIds.length; i++) {
      await client.query("update lessons set sort_order = $1 where id = $2", [
        -(i + 1),
        orderedLessonIds[i],
      ]);
    }

    // Pass 2: Set to final correct order AND update module_id
    for (let i = 0; i < orderedLessonIds.length; i++) {
      await client.query(
        "update lessons set sort_order = $1, module_id = $3, updated_at = now() where id = $2",
        [i + 1, orderedLessonIds[i], moduleId]
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  await audit({
    action: "lessons.reordered",
    actorUserId: session.user.id,
    targetId: moduleId,
    targetType: "module",
  });
  revalidateAdmin();
};
