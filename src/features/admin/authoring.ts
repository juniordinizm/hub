import "server-only";

import { randomUUID } from "node:crypto";
import { getPool } from "@/db";
import { normalizeLessonDraftInput } from "@/features/admin/lesson-drafts";
import { resolveLessonVideoFormState } from "@/features/admin/lesson-video-form";
import {
  getLessonContentStorageKeys,
  normalizeLessonContentFromForm,
  parseLessonContent,
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
import {
  confirmLessonResourceUpload,
  deletePublicR2Objects,
  deleteR2Objects,
  publishR2Object,
  uploadCourseCoverFile,
} from "@/features/storage/r2";

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

const readLessonRequired = (formData: FormData): boolean => {
  if (!formData.has("isRequired")) {
    return true;
  }

  return formData.getAll("isRequired").includes("on");
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

const cleanupPublishedCourseCover = async (
  coverImage: CourseCoverImage | null
): Promise<void> => {
  await deletePublicR2Objects(getCourseCoverStorageKeys(coverImage));
};

const publishCourseCover = async (
  coverImage: CourseCoverImage | null
): Promise<void> => {
  await Promise.all(
    getCourseCoverStorageKeys(coverImage).map((key) => publishR2Object(key))
  );
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

const getCourseAndVersionForModule = async (
  moduleId: string
): Promise<{ courseId: string; courseVersionId: string } | null> => {
  const { rows } = await getPool().query<{
    course_id: string;
    course_version_id: string | null;
  }>("select course_id, course_version_id from modules where id = $1 limit 1", [
    moduleId,
  ]);
  const module = rows[0];

  if (!(module?.course_id && module.course_version_id)) {
    return null;
  }

  return {
    courseId: module.course_id,
    courseVersionId: module.course_version_id,
  };
};

const getDraftCourseVersionId = async (courseId: string): Promise<string> => {
  const { rows } = await getPool().query<{ id: string }>(
    `
      select id
      from course_versions
      where course_id = $1 and status = 'draft'
      order by version_number desc
      limit 1
    `,
    [courseId]
  );
  const courseVersionId = rows[0]?.id;

  if (!courseVersionId) {
    throw new Error(
      "Crie uma nova versao de curso antes de alterar conteudo publicado."
    );
  }

  return courseVersionId;
};

const assertDraftModule = async (moduleId: string): Promise<void> => {
  const { rows } = await getPool().query<{ id: string }>(
    `
      select m.id
      from modules m
      join course_versions cv on cv.id = m.course_version_id
      where m.id = $1 and cv.status = 'draft'
      limit 1
    `,
    [moduleId]
  );

  if (!rows[0]) {
    throw new Error("Modulo nao pertence a uma versao em rascunho.");
  }
};

const getModuleVersionStatus = async (
  moduleId: string
): Promise<"draft" | "published" | "retired" | null> => {
  const { rows } = await getPool().query<{
    status: "draft" | "published" | "retired";
  }>(
    `
      select cv.status
      from modules m
      join course_versions cv on cv.id = m.course_version_id
      where m.id = $1
      limit 1
    `,
    [moduleId]
  );

  return rows[0]?.status ?? null;
};

const assertPublishedLessonStructureIsUnchanged = async ({
  isRequired,
  lessonId,
  moduleId,
  sortOrder,
  status,
}: {
  isRequired: boolean;
  lessonId: string;
  moduleId: string;
  sortOrder: number;
  status: ContentStatus;
}): Promise<void> => {
  const { rows } = await getPool().query<{
    is_required: boolean;
    module_id: string;
    sort_order: number;
    status: ContentStatus;
  }>(
    `
      select module_id, sort_order, status, is_required
      from lessons
      where id = $1
      limit 1
    `,
    [lessonId]
  );
  const lesson = rows[0];

  if (!lesson) {
    throw new Error("Aula publicada não encontrada.");
  }

  if (
    lesson.module_id !== moduleId ||
    lesson.sort_order !== sortOrder ||
    lesson.status !== status ||
    lesson.is_required !== isRequired
  ) {
    throw new Error(
      "Correção editorial não pode alterar módulo, ordem, estado ou obrigatoriedade da aula. Crie uma nova versão."
    );
  }
};

const assertLessonTargetVersionIsEditable = async ({
  compatibleCorrection,
  compatibleCorrectionReason,
  existingLessonId,
  isRequired,
  moduleId,
  sortOrder,
  status,
}: {
  compatibleCorrection: boolean;
  compatibleCorrectionReason: string;
  existingLessonId: string;
  isRequired: boolean;
  moduleId: string;
  sortOrder: number;
  status: ContentStatus;
}): Promise<"draft" | "published"> => {
  const moduleVersionStatus = await getModuleVersionStatus(moduleId);

  if (moduleVersionStatus === "draft") {
    await assertDraftModule(moduleId);
    return moduleVersionStatus;
  }

  if (moduleVersionStatus !== "published" || !existingLessonId) {
    throw new Error("Modulo não pertence a uma versão editável.");
  }

  if (!compatibleCorrection) {
    throw new Error(
      "Versão publicada aceita somente correção editorial compatível documentada."
    );
  }
  if (!compatibleCorrectionReason) {
    throw new Error("Informe o motivo da correção editorial compatível.");
  }
  await assertPublishedLessonStructureIsUnchanged({
    isRequired,
    lessonId: existingLessonId,
    moduleId,
    sortOrder,
    status,
  });

  return moduleVersionStatus;
};

export const publishCourseVersion = async ({
  actorUserId,
  courseId,
}: {
  actorUserId: string;
  courseId: string;
}): Promise<void> => {
  const client = await getPool().connect();

  try {
    await client.query("begin");
    const { rows } = await client.query<{ id: string }>(
      `
        select id
        from course_versions
        where course_id = $1 and status = 'draft'
        order by version_number desc
        limit 1
        for update
      `,
      [courseId]
    );
    const courseVersionId = rows[0]?.id;

    if (!courseVersionId) {
      throw new Error("Nao ha versao em rascunho para publicar.");
    }

    const unavailableVideo = await client.query<{ id: string }>(
      `
        select id
        from lessons
        where course_version_id = $1
          and video_provider = 'jmvstream'
          and coalesce(video_embed_url, '') = ''
        limit 1
      `,
      [courseVersionId]
    );
    if (unavailableVideo.rows[0]) {
      throw new Error("A versao possui video JMVStream sem player pronto.");
    }

    await client.query(
      `
        update course_versions
        set status = 'retired', retired_at = now(), updated_at = now()
        where course_id = $1 and status = 'published'
      `,
      [courseId]
    );
    await client.query(
      `
        update course_versions
        set status = 'published', published_at = now(), retired_at = null, updated_at = now()
        where id = $1
      `,
      [courseVersionId]
    );
    await client.query(
      `
        update courses
        set status = 'active', updated_at = now()
        where id = $1
      `,
      [courseId]
    );
    await client.query(
      `
        insert into audit_logs (actor_user_id, action, target_type, target_id, metadata)
        values ($1, 'course_version.published', 'course_version', $2, $3::jsonb)
      `,
      [actorUserId, courseVersionId, JSON.stringify({ courseId })]
    );
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
};

export const createCourseVersionDraft = async ({
  actorUserId,
  courseId,
}: {
  actorUserId: string;
  courseId: string;
}): Promise<{ courseVersionId: string }> => {
  const client = await getPool().connect();

  try {
    await client.query("begin");
    const existingDraft = await client.query<{ id: string }>(
      `select id from course_versions where course_id = $1 and status = 'draft' limit 1`,
      [courseId]
    );
    const existingDraftId = existingDraft.rows[0]?.id;
    if (existingDraftId) {
      await client.query("commit");
      return { courseVersionId: existingDraftId };
    }

    const published = await client.query<{
      id: string;
      title_snapshot: string;
      version_number: number;
      workload_hours_snapshot: number;
    }>(
      `
        select id, version_number, title_snapshot, workload_hours_snapshot
        from course_versions
        where course_id = $1 and status = 'published'
        limit 1
        for update
      `,
      [courseId]
    );
    const source = published.rows[0];
    if (!source) {
      throw new Error("Curso sem versao publicada nao pode gerar rascunho.");
    }

    const nextVersion = await client.query<{ id: string }>(
      `
        insert into course_versions (
          course_id, version_number, status, title_snapshot, workload_hours_snapshot
        ) values ($1, $2, 'draft', $3, $4)
        returning id
      `,
      [
        courseId,
        source.version_number + 1,
        source.title_snapshot,
        source.workload_hours_snapshot,
      ]
    );
    const courseVersionId = nextVersion.rows[0]?.id;
    if (!courseVersionId) {
      throw new Error("Nao foi possivel criar a versao em rascunho.");
    }

    const modulesToCopy = await client.query<{
      description: string | null;
      id: string;
      sort_order: number;
      status: ContentStatus;
      title: string;
    }>(
      `
        select id, title, description, sort_order, status
        from modules
        where course_version_id = $1
        order by sort_order asc
      `,
      [source.id]
    );
    const moduleIdBySourceId = new Map<string, string>();
    for (const module of modulesToCopy.rows) {
      const clonedModule = await client.query<{ id: string }>(
        `
          insert into modules (course_id, course_version_id, title, description, sort_order, status)
          values ($1, $2, $3, $4, $5, $6)
          returning id
        `,
        [
          courseId,
          courseVersionId,
          module.title,
          module.description,
          module.sort_order,
          module.status,
        ]
      );
      const clonedModuleId = clonedModule.rows[0]?.id;
      if (!clonedModuleId) {
        throw new Error("Nao foi possivel copiar o modulo da versao.");
      }
      moduleIdBySourceId.set(module.id, clonedModuleId);
    }

    const lessonsToCopy = await client.query<{
      content_json: unknown;
      description: string | null;
      duration_seconds: number;
      is_published: boolean;
      is_required: boolean;
      module_id: string;
      sort_order: number;
      status: ContentStatus;
      text_duration_seconds: number;
      text_word_count: number;
      thumbnail_url: string | null;
      title: string;
      video_duration_seconds: number;
      video_embed_url: string | null;
      video_external_id: string | null;
      video_provider: string | null;
    }>(
      `
        select
          module_id, title, description, video_provider, video_external_id, video_embed_url,
          thumbnail_url, content_json, duration_seconds, video_duration_seconds,
          text_duration_seconds, text_word_count, sort_order, status, is_published, is_required
        from lessons
        where course_version_id = $1
        order by sort_order asc
      `,
      [source.id]
    );
    for (const lesson of lessonsToCopy.rows) {
      const moduleId = moduleIdBySourceId.get(lesson.module_id);
      if (!moduleId) {
        throw new Error("Aula sem modulo correspondente na versao de origem.");
      }
      await client.query(
        `
          insert into lessons (
            module_id, course_version_id, title, description, video_provider, video_external_id,
            video_embed_url, thumbnail_url, content_json, duration_seconds, video_duration_seconds,
            text_duration_seconds, text_word_count, sort_order, status, is_published, is_required
          ) values (
            $1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11, $12, $13, $14, $15, $16, $17
          )
        `,
        [
          moduleId,
          courseVersionId,
          lesson.title,
          lesson.description,
          lesson.video_provider,
          lesson.video_external_id,
          lesson.video_embed_url,
          lesson.thumbnail_url,
          lesson.content_json === null
            ? null
            : JSON.stringify(lesson.content_json),
          lesson.duration_seconds,
          lesson.video_duration_seconds,
          lesson.text_duration_seconds,
          lesson.text_word_count,
          lesson.sort_order,
          lesson.status,
          lesson.is_published,
          lesson.is_required,
        ]
      );
    }
    await client.query(
      `
        insert into audit_logs (actor_user_id, action, target_type, target_id, metadata)
        values ($1, 'course_version.draft_created', 'course_version', $2, $3::jsonb)
      `,
      [
        actorUserId,
        courseVersionId,
        JSON.stringify({ sourceVersionId: source.id }),
      ]
    );
    await client.query("commit");
    return { courseVersionId };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
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
  lessonId,
  nextKeys,
  previousKeys,
}: {
  lessonId: string;
  nextKeys: string[];
  previousKeys: string[];
}): Promise<void> => {
  const nextKeySet = new Set(nextKeys);
  const removedKeys = previousKeys.filter((key) => !nextKeySet.has(key));

  const protectedKeys = await getR2KeysReferencedByPublishedVersion({
    candidateKeys: removedKeys,
    lessonId,
  });

  await deleteR2Objects(removedKeys.filter((key) => !protectedKeys.has(key)));
};

const getR2KeysReferencedByPublishedVersion = async ({
  candidateKeys,
  lessonId,
}: {
  candidateKeys: string[];
  lessonId: string;
}): Promise<Set<string>> => {
  if (candidateKeys.length === 0) {
    return new Set();
  }

  const { rows } = await getPool().query<{ content_json: unknown }>(
    `
      select published_lesson.content_json
      from lessons published_lesson
      join course_versions published_version
        on published_version.id = published_lesson.course_version_id
      where published_lesson.id <> $1
        and published_version.status = 'published'
        and published_lesson.content_json is not null
    `,
    [lessonId]
  );
  const candidateKeySet = new Set(candidateKeys);
  const protectedKeys = new Set<string>();

  for (const row of rows) {
    for (const key of getLessonContentStorageKeys(row.content_json)) {
      if (candidateKeySet.has(key)) {
        protectedKeys.add(key);
      }
    }
  }

  return protectedKeys;
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
  if (
    shouldDeleteJmvstreamAsset &&
    !shouldKeepJmvstreamAsset &&
    !(await isJmvstreamAssetReferencedByPublishedVersion(lessonId))
  ) {
    await deleteJmvstreamAssetsForLesson(lessonId);
  }

  await deleteRemovedR2Objects({
    lessonId,
    nextKeys: getLessonContentStorageKeys(contentJson),
    previousKeys: previousR2Keys,
  });
};

const isJmvstreamAssetReferencedByPublishedVersion = async (
  lessonId: string
): Promise<boolean> => {
  const { rows } = await getPool().query<{ id: string }>(
    `
      select published_lesson.id
      from lessons source_lesson
      join lessons published_lesson
        on published_lesson.video_external_id = source_lesson.video_external_id
       and published_lesson.id <> source_lesson.id
      join course_versions published_version
        on published_version.id = published_lesson.course_version_id
      where source_lesson.id = $1
        and source_lesson.video_provider = 'jmvstream'
        and published_version.status = 'published'
      limit 1
    `,
    [lessonId]
  );

  return Boolean(rows[0]);
};

const confirmLessonResourceUploads = async (
  contentJson: unknown
): Promise<void> => {
  const content = parseLessonContent(contentJson);

  if (content?.type !== "text" || !("resources" in content)) {
    return;
  }

  await Promise.all(
    (content.resources ?? [])
      .filter((resource) => resource.storage === "r2")
      .flatMap((resource) => [
        confirmLessonResourceUpload({
          contentType: resource.contentType,
          key: resource.key,
          sizeBytes: resource.sizeBytes,
        }),
        ...(resource.preview
          ? [
              confirmLessonResourceUpload({
                contentType: resource.preview.contentType,
                key: resource.preview.key,
                sizeBytes: resource.preview.sizeBytes,
              }),
            ]
          : []),
      ])
  );
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
  let didPersistCourse = false;

  try {
    const coverImage = coverFile
      ? await uploadCourseCoverFile({ courseId, file: coverFile })
      : parseCourseCoverFormField(formData);
    uploadedCoverImage = coverFile ? coverImage : null;
    const thumbnailUrl = getCourseCoverUrl({ courseId, coverImage });

    if (values.status === PUBLISHED_CONTENT_STATUS) {
      await publishCourseCover(coverImage);
    } else {
      await cleanupPublishedCourseCover(coverImage);
    }

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
    didPersistCourse = true;
    await audit({
      action: "course.updated",
      actorUserId,
      targetId: courseId,
      targetType: "course",
    });
  } catch (error) {
    if (!didPersistCourse) {
      await Promise.all([
        cleanupUploadedCourseCover(uploadedCoverImage),
        cleanupPublishedCourseCover(uploadedCoverImage),
      ]);
    }
    throw error;
  }

  const nextCoverKeys = getCourseCoverStorageKeys(
    coverFile ? uploadedCoverImage : parseCourseCoverFormField(formData)
  );
  const removedKeys = previousCoverKeys.filter(
    (key) => !nextCoverKeys.includes(key)
  );
  await Promise.all([
    deleteR2Objects(removedKeys),
    deletePublicR2Objects(removedKeys),
  ]);
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
    await getPool().query(
      `
        insert into course_versions (
          course_id,
          version_number,
          status,
          title_snapshot,
          workload_hours_snapshot
        )
        values ($1, 1, 'draft', $2, 0)
      `,
      [inserted.rows[0]?.id, values.title]
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
    await assertDraftModule(moduleId);
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

  const courseVersionId = await getDraftCourseVersionId(courseId);

  const inserted = await getPool().query<{ id: string }>(
    `
      insert into modules (course_id, course_version_id, title, description, sort_order, status)
      values ($1, $2, $3, $4, $5, $6)
      on conflict (course_id, sort_order) do update set
        title = excluded.title,
        description = excluded.description,
        status = excluded.status,
        updated_at = now()
      returning id
    `,
    [courseId, courseVersionId, title, description, sortOrder, status]
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
  await assertDraftModule(draft.moduleId);
  const module = await getCourseAndVersionForModule(draft.moduleId);
  const courseId = module?.courseId;

  if (!(courseId && module)) {
    throw new Error("Modulo invalido.");
  }

  const inserted = await getPool().query<{ id: string }>(
    `
      insert into lessons (
        module_id,
        course_version_id,
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
      values ($1, $2, $3, $4, null, null, null, null, 0, $5, $6, false)
      returning id
    `,
    [
      draft.moduleId,
      module.courseVersionId,
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

  await confirmLessonResourceUploads(contentJson);

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
  const isRequired = readLessonRequired(formData);
  const sortOrder = readNumber(formData, "sortOrder", 1);
  const moduleId = readString(formData, "moduleId");
  const compatibleCorrection = formData.get("compatibleCorrection") === "on";
  const compatibleCorrectionReason = readString(
    formData,
    "compatibleCorrectionReason"
  );
  const moduleVersionStatus = await assertLessonTargetVersionIsEditable({
    compatibleCorrection,
    compatibleCorrectionReason,
    existingLessonId,
    isRequired,
    moduleId,
    sortOrder,
    status,
  });
  const module = await getCourseAndVersionForModule(moduleId);

  if (!module) {
    throw new Error("Modulo invalido.");
  }
  const values = [
    moduleId,
    module.courseVersionId,
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
    sortOrder,
    status,
    isPublished,
    isRequired,
  ];
  const moduleCourseId = module.courseId;
  const previousR2Keys = existingLessonId
    ? await getLessonR2ObjectKeys(existingLessonId)
    : [];

  if (existingLessonId) {
    const previousCourseId = await getCourseIdForLesson(existingLessonId);
    await getPool().query(
      `
        update lessons
        set module_id = $1,
            course_version_id = $2,
            title = $3,
            description = $4,
            video_provider = $5,
            video_external_id = $6,
            video_embed_url = $7,
            thumbnail_url = $8,
            content_json = $9::jsonb,
            duration_seconds = $10,
            video_duration_seconds = $11,
            text_duration_seconds = $12,
            text_word_count = $13,
            sort_order = $14,
            status = $15,
            is_published = $16,
            is_required = $17,
            updated_at = now()
        where id = $18
      `,
      [...values, existingLessonId]
    );
    if (moduleVersionStatus === "published") {
      await getPool().query(
        `
          insert into audit_logs (actor_user_id, action, target_type, target_id, metadata)
          values ($1, 'course_version.compatible_correction', 'lesson', $2, $3::jsonb)
        `,
        [
          actorUserId,
          existingLessonId,
          JSON.stringify({
            courseId: module.courseId,
            courseVersionId: module.courseVersionId,
            reason: compatibleCorrectionReason,
          }),
        ]
      );
    } else {
      await audit({
        action: "lesson.updated",
        actorUserId,
        targetId: existingLessonId,
        targetType: "lesson",
      });
    }
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
          course_version_id,
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
          is_published,
          is_required
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11, $12, $13, $14, $15, $16, $17)
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

  const deleteResult = (await isJmvstreamAssetReferencedByPublishedVersion(
    lessonId
  ))
    ? { failed: 0 }
    : await deleteJmvstreamAssetsForLesson(lessonId);
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
