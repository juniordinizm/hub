import "server-only";

import { randomUUID } from "node:crypto";
import { getPool } from "@/db";
import { normalizeLessonDraftInput } from "@/features/admin/lesson-drafts";
import { resolveLessonVideoFormState } from "@/features/admin/lesson-video-form";
import {
  getLessonContentStorageKeys,
  normalizeLessonContentFromForm,
} from "@/features/courses/lesson-content";
import { calculateLessonDurationBreakdown } from "@/features/courses/lesson-duration";
import { recalculateCourseWorkloadHours } from "@/features/courses/server";
import { createCourseSlug } from "@/features/courses/slug";
import {
  deleteJmvstreamAssetsForLesson,
  ensureJmvstreamCourseFolder,
  resolveJmvstreamPlayerThumbnailUrl,
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

interface AuthoringFormInput {
  actorUserId: string;
  formData: FormData;
}

interface CourseFormValues {
  accessDurationMonths: number;
  description: string | null;
  status: ContentStatus;
  subtitle: string | null;
  title: string;
}

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

const readCourseFormValues = (formData: FormData): CourseFormValues => ({
  accessDurationMonths: readNumber(formData, "accessDurationMonths", 12),
  description: readString(formData, "description") || null,
  status: readContentStatus(formData),
  subtitle: readString(formData, "subtitle") || null,
  title: readString(formData, "title"),
});

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
}): Promise<void> => {
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
    const thumbnailUrl = getCourseCoverUrl({ courseId, coverImage });

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
    const insertedThumbnailUrl = getCourseCoverUrl({ courseId, coverImage });
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

export const saveCourse = async ({
  actorUserId,
  formData,
}: AuthoringFormInput): Promise<{ courseId: string }> => {
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
      actorUserId,
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
      actorUserId,
      courseId: insertedCourseId,
      coverFile,
      formData,
      values,
    });
  }

  await ensureJmvstreamCourseFolder(savedCourseId);

  return { courseId: savedCourseId };
};

export const saveModule = async ({
  actorUserId,
  formData,
}: AuthoringFormInput): Promise<void> => {
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
      actorUserId,
      targetId: moduleId,
      targetType: "module",
    });
    await recalculateCourseWorkloadHours(courseId);
    if (previousCourseId && previousCourseId !== courseId) {
      await recalculateCourseWorkloadHours(previousCourseId);
    }
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
    actorUserId,
    targetId: inserted.rows[0]?.id,
    targetType: "module",
  });
  await recalculateCourseWorkloadHours(courseId);
};

export const createLessonDraft = async ({
  actorUserId,
  formData,
}: AuthoringFormInput): Promise<{
  courseId: string;
  lessonId: string;
}> => {
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

  if (!lessonId) {
    throw new Error("Nao foi possivel criar a aula.");
  }

  await audit({
    action: "lesson.created",
    actorUserId,
    targetId: lessonId,
    targetType: "lesson",
  });
  await recalculateCourseWorkloadHours(courseId);

  return { courseId, lessonId };
};

export const saveLesson = async ({
  actorUserId,
  formData,
}: AuthoringFormInput): Promise<{
  courseId: string | null;
  lessonId: string;
}> => {
  const existingLessonId = readString(formData, "lessonId");
  let savedLessonId = existingLessonId;
  const contentJson = normalizeLessonContentFromForm({
    formData,
    lessonId: existingLessonId,
  });
  const {
    hasVideoContent,
    shouldDeleteJmvstreamAsset,
    shouldKeepJmvstreamAsset,
    thumbnailUrl,
    videoEmbedUrl,
    videoExternalId,
    videoProvider,
  } = await getLessonVideoFormState({ formData, lessonId: existingLessonId });

  if (!(hasVideoContent || contentJson)) {
    throw new Error("Adicione video ou texto antes de salvar a aula.");
  }

  const durationBreakdown = calculateLessonDurationBreakdown({
    textDocument: contentJson?.document ?? null,
    videoDurationSeconds: hasVideoContent
      ? readNumber(formData, "durationSeconds")
      : 0,
  });
  const status = existingLessonId
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
  const previousR2Keys = existingLessonId
    ? await getLessonR2ObjectKeys(existingLessonId)
    : [];

  if (existingLessonId) {
    const previousCourseId = await getCourseIdForLesson(existingLessonId);
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
      [...values, existingLessonId]
    );
    await audit({
      action: "lesson.updated",
      actorUserId,
      targetId: existingLessonId,
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
      lessonId: existingLessonId,
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
    const insertedLessonId = inserted.rows[0]?.id;

    if (!insertedLessonId) {
      throw new Error("Nao foi possivel salvar a aula.");
    }

    savedLessonId = insertedLessonId;
    await audit({
      action: "lesson.created",
      actorUserId,
      targetId: savedLessonId,
      targetType: "lesson",
    });
    if (moduleCourseId) {
      await recalculateCourseWorkloadHours(moduleCourseId);
    }
  }

  return { courseId: moduleCourseId, lessonId: savedLessonId };
};

export const removeLessonVideo = async ({
  actorUserId,
  lessonId: rawLessonId,
}: {
  actorUserId: string;
  lessonId: string;
}): Promise<{ courseId: string; deletePending: boolean }> => {
  const lessonId = rawLessonId.trim();

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
    actorUserId,
    targetId: lessonId,
    targetType: "lesson",
  });
  await recalculateCourseWorkloadHours(courseId);

  return { courseId, deletePending: deleteResult.failed > 0 };
};
