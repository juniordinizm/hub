"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getPool } from "@/db";
import {
  buildAdminLessonEditPath,
  normalizeLessonDraftInput,
} from "@/features/admin/lesson-drafts";
import { resolveLessonVideoFormState } from "@/features/admin/lesson-video-form";
import {
  getLessonContentStorageKeys,
  normalizeLessonContentFromForm,
} from "@/features/courses/lesson-content";
import { calculateLessonDurationBreakdown } from "@/features/courses/lesson-duration";
import { recalculateCourseWorkloadHours } from "@/features/courses/server";
import { createCourseSlug } from "@/features/courses/slug";
import type { ExpirationChangeResult } from "@/features/enrollments/server";
import {
  completeJmvstreamUpload,
  deleteJmvstreamAssetsForLesson,
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
  type CourseCoverImage,
  getCourseCoverStorageKeys,
  getCourseCoverVariantPath,
  parseCourseCoverImage,
} from "@/features/storage/course-cover";
import {
  type CourseCoverFile,
  readCourseCoverFile,
} from "@/features/storage/course-cover-upload";
import { deleteR2Objects, uploadCourseCoverFile } from "@/features/storage/r2";
import { rolesForPermission } from "@/lib/auth-policy";
import { requireRole } from "@/lib/session";

const CREATED_CONTENT_STATUS = "draft";
const PUBLISHED_CONTENT_STATUS = "active";
const ARCHIVED_CONTENT_STATUS = "archived";
const CONTENT_STATUSES = new Set([
  CREATED_CONTENT_STATUS,
  PUBLISHED_CONTENT_STATUS,
  ARCHIVED_CONTENT_STATUS,
]);

type ContentStatus =
  | typeof CREATED_CONTENT_STATUS
  | typeof PUBLISHED_CONTENT_STATUS
  | typeof ARCHIVED_CONTENT_STATUS;

const readString = (formData: FormData, key: string): string =>
  String(formData.get(key) ?? "").trim();

const readNumber = (formData: FormData, key: string, fallback = 0): number => {
  const value = Number(formData.get(key));
  return Number.isFinite(value) ? value : fallback;
};

const readOptionalNumber = (formData: FormData, key: string): number | null => {
  const rawValue = readString(formData, key);

  if (!rawValue) {
    return null;
  }

  const value = Number(rawValue);
  return Number.isFinite(value) ? value : null;
};

const readCheckbox = (formData: FormData, key: string): boolean =>
  formData.get(key) === "on";

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

const getStartOfToday = (): Date => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
};

const assertExpirationDateIsNotInPast = (date: Date): void => {
  const selectedDayStart = new Date(date);
  selectedDayStart.setHours(0, 0, 0, 0);

  if (selectedDayStart < getStartOfToday()) {
    throw new Error("A data de expiracao nao pode ser anterior a hoje.");
  }
};

const parseExpirationDateSelection = (value: string): Date => {
  const match = DATE_ONLY_PATTERN.exec(value);

  if (!match) {
    const parsed = new Date(value);

    if (Number.isFinite(parsed.getTime())) {
      assertExpirationDateIsNotInPast(parsed);
      return parsed;
    }

    throw new Error("Informe a nova data de expiracao.");
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const selectedDayStart = new Date(year, month - 1, day);

  if (
    selectedDayStart.getFullYear() !== year ||
    selectedDayStart.getMonth() !== month - 1 ||
    selectedDayStart.getDate() !== day
  ) {
    throw new Error("Informe a nova data de expiracao.");
  }

  assertExpirationDateIsNotInPast(selectedDayStart);

  return new Date(year, month - 1, day, 23, 59, 59, 999);
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

const parseCourseCoverFormField = (
  formData: FormData
): CourseCoverImage | null => {
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

const cleanupUploadedCourseCover = async (
  coverImage: CourseCoverImage | null
): Promise<void> => {
  await deleteR2Objects(getCourseCoverStorageKeys(coverImage));
};

const readContentStatus = (formData: FormData): ContentStatus => {
  const status = readString(formData, "status");

  if (CONTENT_STATUSES.has(status)) {
    return status as ContentStatus;
  }

  return CREATED_CONTENT_STATUS;
};

interface CourseFormValues {
  accessDurationMonths: number;
  description: string | null;
  status: ContentStatus;
  subtitle: string | null;
  title: string;
}

const readCourseFormValues = (formData: FormData): CourseFormValues => ({
  accessDurationMonths: readNumber(formData, "accessDurationMonths", 12),
  description: readString(formData, "description") || null,
  status: readContentStatus(formData),
  subtitle: readString(formData, "subtitle") || null,
  title: readString(formData, "title"),
});

const updateExistingCourse = async ({
  actorUserId,
  courseId,
  coverFile,
  formData,
  previousCoverKeys,
  values,
}: {
  actorUserId: string;
  courseId: string;
  coverFile: CourseCoverFile | null;
  formData: FormData;
  previousCoverKeys: string[];
  values: CourseFormValues;
}): Promise<void> => {
  let uploadedCoverImage: CourseCoverImage | null = null;

  try {
    const coverImage = coverFile
      ? await uploadCourseCoverFile({ courseId, file: coverFile })
      : parseCourseCoverFormField(formData);
    uploadedCoverImage = coverFile ? coverImage : null;
    const thumbnailUrl = getCourseCoverUrl({
      courseId,
      coverImage,
    });

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
      [
        values.title,
        values.subtitle,
        values.description,
        thumbnailUrl,
        coverImage ? JSON.stringify(coverImage) : null,
        values.accessDurationMonths,
        values.status,
        courseId,
      ]
    );
    await audit({
      action: "course.updated",
      actorUserId,
      targetId: courseId,
      targetType: "course",
    });
    await deleteRemovedR2Objects({
      nextKeys: getCourseCoverStorageKeys(coverImage),
      previousKeys: previousCoverKeys,
    });
  } catch (error) {
    await cleanupUploadedCourseCover(uploadedCoverImage);
    throw error;
  }
};

const createNewCourse = async ({
  actorUserId,
  courseId,
  coverFile,
  formData,
  values,
}: {
  actorUserId: string;
  courseId: string;
  coverFile: CourseCoverFile | null;
  formData: FormData;
  values: CourseFormValues;
}): Promise<void> => {
  let uploadedCoverImage: CourseCoverImage | null = null;

  try {
    const coverImage = coverFile
      ? await uploadCourseCoverFile({ courseId, file: coverFile })
      : parseCourseCoverFormField(formData);
    uploadedCoverImage = coverFile ? coverImage : null;
    const insertedThumbnailUrl = getCourseCoverUrl({
      courseId,
      coverImage,
    });
    const slug = await resolveUniqueCourseSlug(values.title);
    const priceInCents = parsePriceToCents(readString(formData, "price"));
    const { productId } = await createAbacatePayCourseProduct({
      courseId,
      description: values.description,
      imageUrl: insertedThumbnailUrl,
      priceInCents,
      title: values.title,
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
        courseId,
        slug,
        values.title,
        values.subtitle,
        values.description,
        priceInCents,
        insertedThumbnailUrl,
        coverImage ? JSON.stringify(coverImage) : null,
        productId,
        values.accessDurationMonths,
        CREATED_CONTENT_STATUS,
      ]
    );
    await audit({
      action: "course.created",
      actorUserId,
      targetId: inserted.rows[0]?.id,
      targetType: "course",
    });
  } catch (error) {
    await cleanupUploadedCourseCover(uploadedCoverImage);
    throw error;
  }
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

const auditEnrollmentExpirationChange = async ({
  actorUserId,
  enrollmentId,
  result,
}: {
  actorUserId: string;
  enrollmentId: string;
  result: ExpirationChangeResult;
}): Promise<void> => {
  const actionByChangeType: Record<
    ExpirationChangeResult["changeType"],
    string
  > = {
    extension: "enrollment.expiration_extended",
    reduction: "enrollment.expiration_reduced",
    unchanged: "enrollment.expiration_set",
  };

  await audit({
    action: actionByChangeType[result.changeType],
    actorUserId,
    targetId: enrollmentId,
    targetType: "enrollment",
  });
};

const revalidateEnrollmentAdminPaths = (userId: string): void => {
  revalidateAdmin();

  if (userId) {
    revalidatePath(`/admin/alunos/${userId}`);
  }
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

const getExistingVideoForLesson = async (
  lessonId: string
): Promise<{
  embedUrl: string | null;
  externalId: string | null;
  thumbnailUrl: string | null;
} | null> => {
  const { rows } = await getPool().query<{
    thumbnail_url: string | null;
    video_embed_url: string | null;
    video_external_id: string | null;
  }>(
    "select video_embed_url, video_external_id, thumbnail_url from lessons where id = $1 limit 1",
    [lessonId]
  );
  const existingVideo = rows[0];

  return existingVideo
    ? {
        embedUrl: existingVideo.video_embed_url,
        externalId: existingVideo.video_external_id,
        thumbnailUrl: existingVideo.thumbnail_url,
      }
    : null;
};

const getLessonVideoFormState = async ({
  formData,
  lessonId,
}: {
  formData: FormData;
  lessonId: string;
}): Promise<{
  hasVideoContent: boolean;
  shouldDeleteJmvstreamAsset: boolean;
  shouldKeepJmvstreamAsset: boolean;
  thumbnailUrl: string | null;
  videoEmbedUrl: string | null;
  videoExternalId: string | null;
  videoProvider: "jmvstream" | null;
}> => {
  const shouldRemoveVideo = formData.get("removeVideo") === "on";
  const existingVideo = lessonId
    ? await getExistingVideoForLesson(lessonId)
    : null;
  const {
    hasVideoContent,
    shouldDeleteJmvstreamAsset,
    shouldKeepJmvstreamAsset,
    videoEmbedUrl,
    videoExternalId,
    videoProvider,
  } = resolveLessonVideoFormState({
    existingVideo,
    shouldRemoveVideo,
    submittedEmbedUrl: readString(formData, "videoEmbedUrl") || null,
  });
  const urlChanged = videoEmbedUrl && videoEmbedUrl !== existingVideo?.embedUrl;
  let thumbnailUrl: string | null = null;

  if (hasVideoContent) {
    if (urlChanged || !existingVideo?.thumbnailUrl) {
      thumbnailUrl = await resolveJmvstreamPlayerThumbnailUrl(videoEmbedUrl);
    } else {
      thumbnailUrl = existingVideo.thumbnailUrl;
    }
  }

  return {
    hasVideoContent,
    shouldDeleteJmvstreamAsset,
    shouldKeepJmvstreamAsset,
    thumbnailUrl,
    videoEmbedUrl,
    videoExternalId,
    videoProvider,
  };
};

const getLessonR2ObjectKeys = async (lessonId: string): Promise<string[]> => {
  const { rows } = await getPool().query<{ content_json: unknown }>(
    "select content_json from lessons where id = $1 limit 1",
    [lessonId]
  );

  return getLessonContentStorageKeys(rows[0]?.content_json);
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
  lessonId,
  previousR2Keys,
  shouldDeleteJmvstreamAsset,
  shouldKeepJmvstreamAsset,
}: {
  contentJson: unknown;
  lessonId: string;
  previousR2Keys: string[];
  shouldDeleteJmvstreamAsset: boolean;
  shouldKeepJmvstreamAsset: boolean;
}): Promise<void> => {
  if (shouldDeleteJmvstreamAsset && !shouldKeepJmvstreamAsset) {
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
  const values = readCourseFormValues(formData);
  const coverFile = readCourseCoverFile(formData.get("coverFile"));
  let savedCourseId = courseId;
  const previousCoverKeys = courseId
    ? (await getCourseR2ObjectKeys(courseId)).filter((key) =>
        key.includes("/cover/")
      )
    : [];

  if (courseId) {
    await updateExistingCourse({
      actorUserId: session.user.id,
      courseId,
      coverFile,
      formData,
      previousCoverKeys,
      values,
    });
  } else {
    const insertedCourseId = randomUUID();
    savedCourseId = insertedCourseId;
    await createNewCourse({
      actorUserId: session.user.id,
      courseId: insertedCourseId,
      coverFile,
      formData,
      values,
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
  const status = moduleId
    ? readContentStatus(formData)
    : CREATED_CONTENT_STATUS;

  if (moduleId) {
    const previousCourseId = await getCourseIdForModule(moduleId);
    await getPool().query(
      `
        update modules
        set course_id = $1,
            title = $2,
            description = $3,
            sort_order = $4,
            status = $5,
            updated_at = now()
        where id = $6
      `,
      [courseId, title, description, sortOrder, status, moduleId]
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
      insert into modules (course_id, title, description, sort_order, status)
      values ($1, $2, $3, $4, $5)
      on conflict (course_id, sort_order) do update set
        title = excluded.title,
        description = excluded.description,
        status = excluded.status,
        updated_at = now()
      returning id
    `,
    [courseId, title, description, sortOrder, status]
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
        status,
        is_published
      )
      values ($1, $2, $3, null, null, null, null, 0, $4, $5, false)
      returning id
    `,
    [
      draft.moduleId,
      draft.title,
      draft.description,
      draft.sortOrder,
      CREATED_CONTENT_STATUS,
    ]
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
    shouldDeleteJmvstreamAsset,
    shouldKeepJmvstreamAsset,
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
  const status = lessonId
    ? readContentStatus(formData)
    : CREATED_CONTENT_STATUS;
  const isPublished = status === PUBLISHED_CONTENT_STATUS;
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
    status,
    isPublished,
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
            status = $14,
            is_published = $15,
            updated_at = now()
        where id = $16
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
      lessonId,
      previousR2Keys,
      shouldDeleteJmvstreamAsset,
      shouldKeepJmvstreamAsset,
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
          status,
          is_published
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11, $12, $13, $14, $15)
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

export const removeJmvstreamVideoFromLessonAction = async (input: {
  lessonId: string;
}): Promise<{ deletePending: boolean }> => {
  const session = await requireRole(["admin"]);
  const lessonId = input.lessonId.trim();

  if (!lessonId) {
    throw new Error("Aula invalida.");
  }

  const courseId = await getCourseIdForLesson(lessonId);

  if (!courseId) {
    throw new Error("Aula invalida.");
  }

  const deleteResult = await deleteJmvstreamAssetsForLesson(lessonId);
  await getPool().query(
    `
      update lessons
      set video_provider = null,
          video_external_id = null,
          video_embed_url = null,
          thumbnail_url = null,
          video_duration_seconds = 0,
          duration_seconds = text_duration_seconds,
          updated_at = now()
      where id = $1
    `,
    [lessonId]
  );
  await audit({
    action: "lesson.video_removed",
    actorUserId: session.user.id,
    targetId: lessonId,
    targetType: "lesson",
  });
  await recalculateCourseWorkloadHours(courseId);
  revalidateAdmin();
  revalidatePath(buildAdminLessonEditPath({ courseId, lessonId }));

  return { deletePending: deleteResult.failed > 0 };
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
}): Promise<{ error: string; ok: false } | { ok: true }> => {
  await requireRole(["admin"]);
  try {
    await retryJmvstreamAssetDelete(assetId);
    revalidateAdmin();
    return { ok: true };
  } catch (error) {
    revalidateAdmin();
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Nao foi possivel apagar o video na JMVStream.",
    };
  }
};

export const extendEnrollmentExpirationAction = async (
  formData: FormData
): Promise<void> => {
  const session = await requireRole(
    rolesForPermission("manageEnrollmentAccess")
  );
  const enrollmentId = readString(formData, "enrollmentId");
  const userId = readString(formData, "userId");
  const reason = readString(formData, "reason");
  const days = readOptionalNumber(formData, "days");
  const months = readOptionalNumber(formData, "months");
  const { extendEnrollmentExpiration } = await import(
    "@/features/enrollments/server"
  );

  await extendEnrollmentExpiration({
    actorUserId: session.user.id,
    enrollmentId,
    reason,
    ...(days === null ? {} : { days }),
    ...(months === null ? {} : { months }),
  });
  await audit({
    action: "enrollment.expiration_extended",
    actorUserId: session.user.id,
    targetId: enrollmentId,
    targetType: "enrollment",
  });
  revalidateAdmin();

  if (userId) {
    revalidatePath(`/admin/alunos/${userId}`);
  }
};

export const setEnrollmentExpirationAction = async (
  formData: FormData
): Promise<void> => {
  const session = await requireRole(
    rolesForPermission("manageEnrollmentAccess")
  );
  const enrollmentId = readString(formData, "enrollmentId");
  const userId = readString(formData, "userId");
  const reason = readString(formData, "reason");
  const newExpiresAtValue = readString(formData, "newExpiresAt");
  const newExpiresAt = parseExpirationDateSelection(newExpiresAtValue);
  const { setEnrollmentExpiration } = await import(
    "@/features/enrollments/server"
  );

  const result = await setEnrollmentExpiration({
    actorUserId: session.user.id,
    enrollmentId,
    newExpiresAt,
    reason,
  });
  await auditEnrollmentExpirationChange({
    actorUserId: session.user.id,
    enrollmentId,
    result,
  });
  revalidateAdmin();

  if (userId) {
    revalidatePath(`/admin/alunos/${userId}`);
  }
};

export const adjustEnrollmentExpirationAction = async (
  formData: FormData
): Promise<void> => {
  const session = await requireRole(
    rolesForPermission("manageEnrollmentAccess")
  );
  const adjustment = readString(formData, "adjustment");
  const enrollmentId = readString(formData, "enrollmentId");
  const userId = readString(formData, "userId");
  const reason = readString(formData, "reason");

  if (!enrollmentId) {
    throw new Error("Matricula invalida.");
  }

  if (adjustment === "set_exact") {
    const newExpiresAtValue = readString(formData, "newExpiresAt");
    const newExpiresAt = parseExpirationDateSelection(newExpiresAtValue);

    const { setEnrollmentExpiration } = await import(
      "@/features/enrollments/server"
    );
    const result = await setEnrollmentExpiration({
      actorUserId: session.user.id,
      enrollmentId,
      newExpiresAt,
      reason,
    });
    await auditEnrollmentExpirationChange({
      actorUserId: session.user.id,
      enrollmentId,
      result,
    });
    revalidateEnrollmentAdminPaths(userId);
    return;
  }

  throw new Error("Escolha uma nova data de expiracao.");
};

export const blockEnrollmentAccessAction = async (
  formData: FormData
): Promise<void> => {
  const session = await requireRole(
    rolesForPermission("manageEnrollmentAccess")
  );
  const enrollmentId = readString(formData, "enrollmentId");
  const userId = readString(formData, "userId");
  const reason = readString(formData, "reason");

  if (!enrollmentId) {
    throw new Error("Matricula invalida.");
  }

  const { blockEnrollmentAccess } = await import(
    "@/features/enrollments/server"
  );
  await blockEnrollmentAccess({
    actorUserId: session.user.id,
    enrollmentId,
    reason,
  });
  await audit({
    action: "enrollment.access_blocked",
    actorUserId: session.user.id,
    targetId: enrollmentId,
    targetType: "enrollment",
  });
  revalidateEnrollmentAdminPaths(userId);
};

export const restoreEnrollmentAccessAction = async (
  formData: FormData
): Promise<void> => {
  const session = await requireRole(
    rolesForPermission("manageEnrollmentAccess")
  );
  const enrollmentId = readString(formData, "enrollmentId");
  const userId = readString(formData, "userId");
  const reason = readString(formData, "reason");

  if (!enrollmentId) {
    throw new Error("Matricula invalida.");
  }

  const { restoreEnrollmentAccess } = await import(
    "@/features/enrollments/server"
  );
  await restoreEnrollmentAccess({
    actorUserId: session.user.id,
    enrollmentId,
    reason,
  });
  await audit({
    action: "enrollment.access_restored",
    actorUserId: session.user.id,
    targetId: enrollmentId,
    targetType: "enrollment",
  });
  revalidateEnrollmentAdminPaths(userId);
};

export const blockStudentPlatformAccessAction = async (
  formData: FormData
): Promise<void> => {
  const session = await requireRole(
    rolesForPermission("manageEnrollmentAccess")
  );
  const userId = readString(formData, "userId");
  const reason = readString(formData, "reason");

  if (!userId) {
    throw new Error("Aluno invalido.");
  }

  if (!reason) {
    throw new Error("Informe o motivo do bloqueio.");
  }

  await getPool().query(
    `
      update profiles
      set platform_blocked_at = now(),
          platform_blocked_reason = $2,
          updated_at = now()
      where user_id = $1
        and role = 'student'
    `,
    [userId, reason]
  );
  await audit({
    action: "student.platform_blocked",
    actorUserId: session.user.id,
    targetId: userId,
    targetType: "student",
  });
  revalidateEnrollmentAdminPaths(userId);
};

export const restoreStudentPlatformAccessAction = async (
  formData: FormData
): Promise<void> => {
  const session = await requireRole(
    rolesForPermission("manageEnrollmentAccess")
  );
  const userId = readString(formData, "userId");
  const reason = readString(formData, "reason");

  if (!userId) {
    throw new Error("Aluno invalido.");
  }

  if (!reason) {
    throw new Error("Informe o motivo da restauracao.");
  }

  await getPool().query(
    `
      update profiles
      set platform_blocked_at = null,
          platform_blocked_reason = null,
          updated_at = now()
      where user_id = $1
        and role = 'student'
    `,
    [userId]
  );
  await audit({
    action: "student.platform_restored",
    actorUserId: session.user.id,
    targetId: userId,
    targetType: "student",
  });
  revalidateEnrollmentAdminPaths(userId);
};

export const saveFaqAction = async (formData: FormData): Promise<void> => {
  const session = await requireRole(["admin"]);
  const faqId = readString(formData, "faqId");
  const values = [
    readString(formData, "question"),
    readString(formData, "answer"),
    readNumber(formData, "sortOrder"),
    readCheckbox(formData, "isPublished"),
  ];

  if (faqId) {
    await getPool().query(
      `
        update faq_items
        set question = $1,
            answer = $2,
            sort_order = $3,
            is_published = $4,
            updated_at = now()
        where id = $5
      `,
      [...values, faqId]
    );
  } else {
    await getPool().query(
      `
        insert into faq_items (question, answer, sort_order, is_published)
        values ($1, $2, $3, $4)
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

export const reorderFaqsAction = async (
  orderedFaqIds: string[]
): Promise<void> => {
  const session = await requireRole(["admin"]);

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Pass 1: Set to temporary negative order to avoid unique constraint violations
    for (let i = 0; i < orderedFaqIds.length; i++) {
      await client.query("update faq_items set sort_order = $1 where id = $2", [
        -(i + 1),
        orderedFaqIds[i],
      ]);
    }

    // Pass 2: Set to final correct order
    for (let i = 0; i < orderedFaqIds.length; i++) {
      await client.query(
        "update faq_items set sort_order = $1, updated_at = now() where id = $2",
        [i + 1, orderedFaqIds[i]]
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
    action: "faq.reordered",
    actorUserId: session.user.id,
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
