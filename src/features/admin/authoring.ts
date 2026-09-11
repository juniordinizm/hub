import "server-only";

import { createHash, randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { getPool } from "@/db";
import {
  type AuditLogQueryClient,
  writeAuditLog,
} from "@/features/admin/audit-log";
import type { AuditChange, AuditMetadata } from "@/features/admin/audit-types";
import {
  findContentReleaseRegressions,
  type PublishedLessonRelease,
} from "@/features/admin/course-publication-release-policy";
import { LessonAuthoringError } from "@/features/admin/lesson-authoring-errors";
import { normalizeLessonDraftInput } from "@/features/admin/lesson-drafts";
import { resolveLessonVideoFormState } from "@/features/admin/lesson-video-form";
import {
  lockCourseContentRelease,
  lockCoursesContentRelease,
} from "@/features/courses/content-release-lock";
import {
  getLessonContentStorageKeys,
  normalizeLessonContentFromForm,
  parseLessonContent,
} from "@/features/courses/lesson-content";
import { calculateLessonDurationBreakdown } from "@/features/courses/lesson-duration";
import {
  assertMaxReleaseDelayFitsAccessDuration,
  assertValidReleaseDelayDays,
} from "@/features/courses/module-content-release";
import { recalculateCourseWorkloadHours } from "@/features/courses/server";
import { createCourseSlug } from "@/features/courses/slug";
import { parseCourseWorkloadOverride } from "@/features/courses/workload";
import {
  deleteJmvstreamAssetsForLesson,
  ensureJmvstreamCourseFolder,
  resolveJmvstreamPlayerThumbnailUrl,
} from "@/features/jmvstream/server";
import {
  DEFAULT_COURSE_PAYMENT_OFFER,
  parseCoursePaymentOffer,
} from "@/features/payments/course-payment-offer";
import { parseCoursePriceToCents } from "@/features/payments/course-price";
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
  assertLessonResourceUploadReferenceMatches,
  type LessonResourceUploadReference,
} from "@/features/storage/lesson-resource-upload";
import { logLessonResourceUploadEvent } from "@/features/storage/lesson-resource-upload-observability";
import {
  consumeLessonResourceUpload,
  getLessonResourceUpload,
} from "@/features/storage/lesson-resource-upload-registry";
import {
  confirmLessonResourceUpload,
  deletePublicR2Objects,
  deleteR2Objects,
  publishR2Object,
  uploadCourseCoverFile,
} from "@/features/storage/r2";
import { parseStagedAdminImageReference } from "@/features/storage/staged-image-upload";
import { consumeStagedAdminImageUpload } from "@/features/storage/staged-image-upload-registry";
import { getServerEnv } from "@/lib/env";

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
  paymentAllowCreditCard: boolean;
  paymentAllowPix: boolean;
  paymentMaxInstallmentCount: number;
  priceInCents: number;
  subtitle: string | null;
  title: string;
  workloadHoursOverride: number | null;
}

const getAuditChanges = (
  changes: Record<string, AuditChange>
): Record<string, AuditChange> =>
  Object.fromEntries(
    Object.entries(changes).filter(
      ([, change]) =>
        JSON.stringify(change.before) !== JSON.stringify(change.after)
    )
  );

const truncateAuditText = (value: string | null): string | null =>
  value && value.length > 500 ? `${value.slice(0, 500)}…` : value;

interface LessonAuditSnapshot {
  content: boolean;
  contentFingerprint: string | null;
  description: string | null;
  durationSeconds: number;
  isPublished: boolean;
  isRequired: boolean;
  moduleId: string;
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

interface LessonAuditDatabaseRow {
  content_json: unknown;
  description: string | null;
  duration_seconds: number;
  id: string;
  is_published: boolean;
  is_required: boolean;
  module_id: string;
  sort_order: number;
  status: string;
  text_duration_seconds: number;
  text_word_count: number;
  title: string;
  video_duration_seconds: number;
  video_embed_url: string | null;
  video_external_id: string | null;
  video_provider: string | null;
}

const getLessonAuditChanges = (
  before: LessonAuditSnapshot | null,
  after: LessonAuditSnapshot
): Record<string, AuditChange> =>
  getAuditChanges({
    content: {
      after:
        before && before.contentFingerprint !== after.contentFingerprint
          ? "versão atual"
          : after.content,
      before:
        before && before.contentFingerprint !== after.contentFingerprint
          ? "versão anterior"
          : (before?.content ?? null),
    },
    description: {
      after: truncateAuditText(after.description),
      before: truncateAuditText(before?.description ?? null),
    },
    durationSeconds: {
      after: after.durationSeconds,
      before: before?.durationSeconds ?? null,
    },
    isPublished: {
      after: after.isPublished,
      before: before?.isPublished ?? null,
    },
    isRequired: {
      after: after.isRequired,
      before: before?.isRequired ?? null,
    },
    moduleId: { after: after.moduleId, before: before?.moduleId ?? null },
    sortOrder: { after: after.sortOrder, before: before?.sortOrder ?? null },
    status: { after: after.status, before: before?.status ?? null },
    textDurationSeconds: {
      after: after.textDurationSeconds,
      before: before?.textDurationSeconds ?? null,
    },
    textWordCount: {
      after: after.textWordCount,
      before: before?.textWordCount ?? null,
    },
    title: { after: after.title, before: before?.title ?? null },
    videoDurationSeconds: {
      after: after.videoDurationSeconds,
      before: before?.videoDurationSeconds ?? null,
    },
    videoEmbedUrl: {
      after: after.videoEmbedUrl,
      before: before?.videoEmbedUrl ?? null,
    },
    videoExternalId: {
      after: after.videoExternalId,
      before: before?.videoExternalId ?? null,
    },
    videoProvider: {
      after: after.videoProvider,
      before: before?.videoProvider ?? null,
    },
  });

const getContentFingerprint = (content: unknown): string | null => {
  if (content === null || content === undefined) {
    return null;
  }
  return createHash("sha256")
    .update(JSON.stringify(content))
    .digest("hex")
    .slice(0, 16);
};

const readString = (formData: FormData, key: string): string =>
  String(formData.get(key) ?? "").trim();

const readNumber = (formData: FormData, key: string, fallback = 0): number => {
  const value = Number(formData.get(key));
  return Number.isFinite(value) ? value : fallback;
};

const readModuleReleaseDelayDays = (formData: FormData): number => {
  if (readString(formData, "releaseMode") === "immediate") {
    return 0;
  }

  const rawValue = readString(formData, "releaseDelayDays");
  const value = Number(rawValue);
  if (!(rawValue && Number.isSafeInteger(value) && value >= 0)) {
    throw new Error("Informe uma quantidade inteira e não negativa de dias.");
  }

  assertValidReleaseDelayDays(value);
  return value;
};

const normalizeLessonContentForSave = ({
  formData,
  lessonId,
}: {
  formData: FormData;
  lessonId: string;
}): ReturnType<typeof normalizeLessonContentFromForm> => {
  try {
    return normalizeLessonContentFromForm({ formData, lessonId });
  } catch (error) {
    if (error instanceof LessonAuthoringError) {
      throw error;
    }

    if (error instanceof Error) {
      throw new LessonAuthoringError(error.message, "content");
    }

    throw error;
  }
};

const assertLessonHasContent = ({
  contentJson,
  hasVideoContent,
}: {
  contentJson: ReturnType<typeof normalizeLessonContentFromForm>;
  hasVideoContent: boolean;
}): void => {
  if (hasVideoContent || contentJson) {
    return;
  }

  throw new LessonAuthoringError(
    "A aula não pode ser salva sem conteúdo. Adicione pelo menos um vídeo, um texto com conteúdo ou um material anexado.",
    "content"
  );
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

const readCourseFormValues = (formData: FormData): CourseFormValues => {
  const paymentOffer = formData.has("paymentOfferPresent")
    ? parseCoursePaymentOffer({
        allowCreditCard: formData.has("paymentAllowCreditCard"),
        allowPix: formData.has("paymentAllowPix"),
        maxInstallmentCount: readNumber(
          formData,
          "paymentMaxInstallmentCount",
          1
        ),
      })
    : DEFAULT_COURSE_PAYMENT_OFFER;

  return {
    accessDurationMonths: readNumber(formData, "accessDurationMonths", 12),
    description: readString(formData, "description") || null,
    workloadHoursOverride: parseCourseWorkloadOverride(
      readString(formData, "workloadHoursOverride")
    ),
    paymentAllowCreditCard: paymentOffer.allowCreditCard,
    paymentAllowPix: paymentOffer.allowPix,
    paymentMaxInstallmentCount: paymentOffer.maxInstallmentCount,
    priceInCents: parseCoursePriceToCents(readString(formData, "price")),
    subtitle: readString(formData, "subtitle") || null,
    title: readString(formData, "title"),
  };
};

const audit = async ({
  action,
  actorUserId,
  client,
  metadata,
  targetId,
  targetType,
}: {
  action: string;
  actorUserId: string;
  client?: AuditLogQueryClient;
  metadata?: AuditMetadata;
  targetId?: string | undefined;
  targetType: string;
}): Promise<void> => {
  await writeAuditLog({
    action,
    actorUserId,
    client,
    metadata,
    targetId,
    targetType,
  });
};

const withCourseContentReleaseLock = async <T>(
  courseIds: readonly string[],
  operation: (client: PoolClient) => Promise<T>
): Promise<T> => {
  const client = await getPool().connect();

  try {
    await client.query("begin");
    await lockCoursesContentRelease(client, courseIds);
    const result = await operation(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
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

const getCourseAndPublicationForModule = async (
  moduleId: string
): Promise<{ courseId: string; coursePublicationId: string } | null> => {
  const { rows } = await getPool().query<{
    course_id: string;
    course_publication_id: string | null;
  }>(
    "select course_id, course_publication_id from modules where id = $1 limit 1",
    [moduleId]
  );
  const module = rows[0];

  if (!(module?.course_id && module.course_publication_id)) {
    return null;
  }

  return {
    courseId: module.course_id,
    coursePublicationId: module.course_publication_id,
  };
};

const assertDraftModule = async (moduleId: string): Promise<void> => {
  const { rows } = await getPool().query<{ id: string }>(
    `
      select m.id
      from modules m
      join course_publications cp on cp.id = m.course_publication_id
      where m.id = $1 and cp.status = 'draft'
      limit 1
    `,
    [moduleId]
  );

  if (!rows[0]) {
    throw new LessonAuthoringError(
      "Modulo nao pertence a uma versao em rascunho."
    );
  }
};

const getModulePublicationStatus = async (
  moduleId: string
): Promise<"draft" | "published" | "retired" | null> => {
  const { rows } = await getPool().query<{
    status: "draft" | "published" | "retired";
  }>(
    `
      select cp.status
      from modules m
      join course_publications cp on cp.id = m.course_publication_id
      where m.id = $1
      limit 1
    `,
    [moduleId]
  );

  return rows[0]?.status ?? null;
};

const assertLessonTargetPublicationIsEditable = async ({
  moduleId,
}: {
  moduleId: string;
}): Promise<"draft"> => {
  const modulePublicationStatus = await getModulePublicationStatus(moduleId);

  if (modulePublicationStatus === "draft") {
    await assertDraftModule(moduleId);
    return modulePublicationStatus;
  }

  throw new LessonAuthoringError(
    "Prepare alteracoes antes de editar conteudo publicado."
  );
};

export const assertLessonPublicationIsEditable = async (
  lessonId: string
): Promise<void> => {
  const { rows } = await getPool().query<{ id: string }>(
    `
      select l.id
      from lessons l
      join course_publications cp on cp.id = l.course_publication_id
      where l.id = $1 and cp.status = 'draft'
      limit 1
    `,
    [lessonId]
  );

  if (!rows[0]) {
    throw new LessonAuthoringError(
      "Prepare alteracoes antes de editar conteudo publicado."
    );
  }
};

const assertExistingLessonPublicationIsEditable = async (
  lessonId: string
): Promise<void> => {
  if (!lessonId) {
    return;
  }

  await assertLessonPublicationIsEditable(lessonId);
};

interface PreparedCoursePublication {
  coursePublicationId: string;
  coverImage: CourseCoverImage | null;
}

const runCoursePublicationTransaction = async ({
  actorUserId,
  courseId,
  preparedPublication,
}: {
  actorUserId: string;
  courseId: string;
  preparedPublication?: PreparedCoursePublication;
}): Promise<PreparedCoursePublication | null> => {
  const client = await getPool().connect();

  try {
    await client.query("begin");
    await lockCourseContentRelease(client, courseId);
    const { rows } = await client.query<{
      id: string;
      publication_number: number;
      title_snapshot: string;
      workload_hours_snapshot: number;
    }>(
      `
        select id, publication_number, title_snapshot, workload_hours_snapshot
        from course_publications
        where course_id = $1 and status = 'draft'
        order by publication_number desc
        limit 1
        for update
      `,
      [courseId]
    );
    const coursePublicationId = rows[0]?.id;
    const publicationNumber = rows[0]?.publication_number;

    if (!coursePublicationId) {
      await client.query("rollback");
      return null;
    }

    const unavailableVideo = await client.query<{ id: string }>(
      `
        select id
        from lessons
        where course_publication_id = $1
          and video_provider = 'jmvstream'
          and coalesce(video_embed_url, '') = ''
        limit 1
      `,
      [coursePublicationId]
    );
    if (unavailableVideo.rows[0]) {
      throw new Error("A publicacao possui video JMVStream sem player pronto.");
    }

    const courseCover = await client.query<{
      access_duration_months: number;
      cover_image_json: unknown;
      sales_status: "closed" | "open";
      title: string;
    }>(
      "select cover_image_json, access_duration_months, sales_status, title from courses where id = $1 for update",
      [courseId]
    );

    const scheduledReleaseHistory = await client.query<{
      has_scheduled_release_history: boolean;
    }>(
      `
        select exists (
          select 1
          from enrollment_events
          where course_id = $1
            and event_type = 'content_release_scheduled'
        ) as has_scheduled_release_history
      `,
      [courseId]
    );
    const publicationLessons = await client.query<{
      curriculum_key: string;
      lesson_title: string;
      module_title: string;
      publication_status: "draft" | "published";
      release_delay_days: number;
    }>(
      `
        select cp.status as publication_status,
               l.curriculum_key::text as curriculum_key,
               l.title as lesson_title,
               m.title as module_title,
               m.sort_order as module_sort_order,
               l.sort_order as lesson_sort_order,
               m.release_delay_days
        from lessons l
        join course_publications cp on cp.id = l.course_publication_id
        join modules m
          on m.id = l.module_id
         and m.course_publication_id = cp.id
        where cp.course_id = $1
          and (cp.status = 'published' or cp.id = $2)
          and m.status = 'active'
          and l.status = 'active'
        order by case cp.status when 'published' then 0 else 1 end,
                 m.sort_order,
                 l.sort_order
      `,
      [courseId, coursePublicationId]
    );
    const toPublishedLessonRelease = (row: {
      curriculum_key: string;
      lesson_title: string;
      module_title: string;
      release_delay_days: number;
    }): PublishedLessonRelease => ({
      curriculumKey: row.curriculum_key,
      lessonTitle: row.lesson_title,
      moduleTitle: row.module_title,
      releaseDelayDays: row.release_delay_days,
    });
    const previous = publicationLessons.rows
      .filter(({ publication_status }) => publication_status === "published")
      .map(toPublishedLessonRelease);
    const next = publicationLessons.rows
      .filter(({ publication_status }) => publication_status === "draft")
      .map(toPublishedLessonRelease);
    if (
      next.some((lesson) => lesson.releaseDelayDays > 0) &&
      !getServerEnv().CONTENT_RELEASE_DELAYED_PUBLISHING_ENABLED
    ) {
      throw new Error(
        "Publicação de conteúdo atrasado está desabilitada durante o rollout."
      );
    }
    const currentCourse = courseCover.rows[0];
    if (currentCourse?.sales_status === "open") {
      assertMaxReleaseDelayFitsAccessDuration({
        accessDurationMonths: currentCourse.access_duration_months,
        maxReleaseDelayDays: next.reduce(
          (maxDelay, lesson) => Math.max(maxDelay, lesson.releaseDelayDays),
          0
        ),
      });
    }
    const regressions = findContentReleaseRegressions({
      hasScheduledReleaseHistory:
        scheduledReleaseHistory.rows[0]?.has_scheduled_release_history ?? false,
      next,
      previous,
    });
    const firstRegression = regressions[0];
    if (firstRegression) {
      throw new Error(
        `Não foi possível publicar: A Aula "${firstRegression.lessonTitle}" passaria de D+${firstRegression.previousDelayDays} para D+${firstRegression.nextDelayDays} no Módulo "${firstRegression.nextModuleTitle}". Depois do início das Matrículas, atrasos só podem ser reduzidos.`
      );
    }

    const incompatibleScheduledEnrollment = await client.query<{
      lesson_title: string;
      module_title: string;
      release_delay_days: number;
    }>(
      `
        select m.title as module_title,
               l.title as lesson_title,
               m.release_delay_days
        from enrollments e
        join modules m on m.course_publication_id = $2
        join lessons l
          on l.module_id = m.id
         and l.course_publication_id = $2
        where e.course_id = $1
          and e.status = 'active'
          and e.starts_at <= now()
          and e.expires_at > now()
          and e.content_release_mode = 'scheduled'
          and e.content_release_started_at is not null
          and m.status = 'active'
          and m.release_delay_days > 0
          and l.status = 'active'
          and l.is_required
          and e.content_release_started_at
                + (m.release_delay_days * interval '24 hours') >= e.expires_at
        order by m.sort_order, l.sort_order
        limit 1
      `,
      [courseId, coursePublicationId]
    );
    const firstUnavailableLesson = incompatibleScheduledEnrollment.rows[0];
    if (firstUnavailableLesson) {
      throw new Error(
        `Não foi possível publicar: A Aula "${firstUnavailableLesson.lesson_title}" do Módulo "${firstUnavailableLesson.module_title}" ficaria indisponível durante toda a validade de uma Matrícula agendada.`
      );
    }

    const publication = {
      coursePublicationId,
      coverImage: parseCourseCoverImage(courseCover.rows[0]?.cover_image_json),
    };
    if (!preparedPublication) {
      await client.query("commit");
      return publication;
    }
    if (
      coursePublicationId !== preparedPublication.coursePublicationId ||
      JSON.stringify(publication.coverImage) !==
        JSON.stringify(preparedPublication.coverImage)
    ) {
      throw new Error(
        "O Curso mudou durante a publicação. Tente publicar novamente."
      );
    }

    await client.query(
      `
        update course_publications
        set status = 'retired', retired_at = now(), updated_at = now()
        where course_id = $1 and status = 'published'
      `,
      [courseId]
    );
    await client.query(
      `
        update course_publications
        set status = 'published', published_at = now(), retired_at = null, updated_at = now()
        where id = $1
      `,
      [coursePublicationId]
    );
    await client.query(
      `
        update courses
        set workload_hours = coalesce(
              (
                select workload_hours_override
                from courses
                where id = $2
              ),
              (
                select workload_hours_snapshot
                from course_publications
                where id = $1
              )
            ),
            updated_at = now()
        where id = $2
      `,
      [coursePublicationId, courseId]
    );
    await audit({
      action: "course_publication.published",
      actorUserId,
      client,
      metadata: {
        changes: getAuditChanges({
          publicationNumber: {
            after: publicationNumber ?? null,
            before: publicationNumber ?? null,
          },
          status: { after: "published", before: "draft" },
          titleSnapshot: {
            after: rows[0]?.title_snapshot ?? null,
            before: rows[0]?.title_snapshot ?? null,
          },
          workloadHoursSnapshot: {
            after: rows[0]?.workload_hours_snapshot ?? null,
            before: rows[0]?.workload_hours_snapshot ?? null,
          },
        }),
        courseId,
        targetLabelAfter: currentCourse?.title ?? null,
      },
      targetId: coursePublicationId,
      targetType: "course_publication",
    });
    await client.query("commit");
    return publication;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
};

export const publishCoursePublication = async ({
  actorUserId,
  courseId,
}: {
  actorUserId: string;
  courseId: string;
}): Promise<"no_draft" | "published"> => {
  const preparedPublication = await runCoursePublicationTransaction({
    actorUserId,
    courseId,
  });
  if (!preparedPublication) {
    return "no_draft";
  }

  await publishCourseCover(preparedPublication.coverImage);

  const publication = await runCoursePublicationTransaction({
    actorUserId,
    courseId,
    preparedPublication,
  });
  return publication ? "published" : "no_draft";
};

export const createCoursePublicationDraft = async ({
  actorUserId,
  courseId,
}: {
  actorUserId: string;
  courseId: string;
}): Promise<{ coursePublicationId: string }> => {
  const client = await getPool().connect();

  try {
    await client.query("begin");
    await lockCourseContentRelease(client, courseId);
    await client.query(
      "select id from courses where id = $1 limit 1 for update",
      [courseId]
    );
    const existingDraft = await client.query<{ id: string }>(
      `select id from course_publications where course_id = $1 and status = 'draft' limit 1`,
      [courseId]
    );
    const existingDraftId = existingDraft.rows[0]?.id;
    if (existingDraftId) {
      await client.query("commit");
      return { coursePublicationId: existingDraftId };
    }

    const published = await client.query<{
      id: string;
      title_snapshot: string;
      publication_number: number;
      workload_hours_snapshot: number;
    }>(
      `
        select id, publication_number, title_snapshot, workload_hours_snapshot
        from course_publications
        where course_id = $1 and status = 'published'
        limit 1
        for update
      `,
      [courseId]
    );
    const source = published.rows[0];
    if (!source) {
      throw new Error(
        "Curso sem publicacao publicada nao pode preparar alteracoes."
      );
    }

    const nextPublication = await client.query<{
      id: string;
      publication_number: number;
    }>(
      `
        insert into course_publications (
          course_id, publication_number, status, title_snapshot, workload_hours_snapshot
        ) values ($1, $2, 'draft', $3, $4)
         returning id, publication_number
      `,
      [
        courseId,
        source.publication_number + 1,
        source.title_snapshot,
        source.workload_hours_snapshot,
      ]
    );
    const coursePublicationId = nextPublication.rows[0]?.id;
    if (!coursePublicationId) {
      throw new Error("Nao foi possivel preparar as alteracoes.");
    }

    const modulesToCopy = await client.query<{
      description: string | null;
      id: string;
      release_delay_days: number;
      sort_order: number;
      status: ContentStatus;
      title: string;
    }>(
      `
        select id, title, description, sort_order, status, release_delay_days
        from modules
        where course_publication_id = $1
        order by sort_order asc
      `,
      [source.id]
    );
    const moduleIdBySourceId = new Map<string, string>();
    for (const module of modulesToCopy.rows) {
      const clonedModule = await client.query<{ id: string }>(
        `
          insert into modules (course_id, course_publication_id, title, description, sort_order, status, release_delay_days)
          values ($1, $2, $3, $4, $5, $6, $7)
          returning id
        `,
        [
          courseId,
          coursePublicationId,
          module.title,
          module.description,
          module.sort_order,
          module.status,
          module.release_delay_days,
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
      curriculum_key: string;
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
          module_id, curriculum_key, title, description, video_provider, video_external_id, video_embed_url,
          thumbnail_url, content_json, duration_seconds, video_duration_seconds,
          text_duration_seconds, text_word_count, sort_order, status, is_published, is_required
        from lessons
        where course_publication_id = $1
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
            module_id, course_publication_id, curriculum_key, title, description, video_provider, video_external_id,
            video_embed_url, thumbnail_url, content_json, duration_seconds, video_duration_seconds,
            text_duration_seconds, text_word_count, sort_order, status, is_published, is_required
          ) values (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11, $12, $13, $14, $15, $16, $17, $18
          )
        `,
        [
          moduleId,
          coursePublicationId,
          lesson.curriculum_key,
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
    await audit({
      action: "course_publication.draft_created",
      actorUserId,
      client,
      metadata: {
        changes: {
          publicationNumber: {
            after: nextPublication.rows[0]?.publication_number ?? null,
            before: source.publication_number,
          },
          status: { after: "draft", before: "published" },
          titleSnapshot: {
            after: source.title_snapshot,
            before: null,
          },
          workloadHoursSnapshot: {
            after: source.workload_hours_snapshot,
            before: null,
          },
        },
        lessonCount: lessonsToCopy.rows.length,
        moduleCount: modulesToCopy.rows.length,
        sourcePublicationId: source.id,
        targetLabelAfter: source.title_snapshot,
      },
      targetId: coursePublicationId,
      targetType: "course_publication",
    });
    await client.query("commit");
    return { coursePublicationId };
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
      join course_publications published_publication
        on published_publication.id = published_lesson.course_publication_id
      where published_lesson.id <> $1
        and published_publication.status = 'published'
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
      join course_publications published_publication
        on published_publication.id = published_lesson.course_publication_id
      where source_lesson.id = $1
        and source_lesson.video_provider = 'jmvstream'
        and published_publication.status = 'published'
      limit 1
    `,
    [lessonId]
  );

  return Boolean(rows[0]);
};

const assertSafeLessonResourceUploadReference = ({
  expected,
  received,
}: {
  expected: LessonResourceUploadReference;
  received: LessonResourceUploadReference;
}): void => {
  try {
    assertLessonResourceUploadReferenceMatches({ expected, received });
  } catch (error) {
    if (error instanceof Error) {
      throw new LessonAuthoringError(error.message, "content");
    }

    throw error;
  }
};

const confirmSingleLessonResourceUpload = async ({
  actorUserId,
  lessonId,
  previousR2Keys,
  resource,
}: {
  actorUserId: string;
  lessonId: string | null;
  previousR2Keys: string[];
  resource: LessonResourceUploadReference;
}): Promise<boolean> => {
  const isExistingResource = previousR2Keys.includes(resource.key);
  if (!isExistingResource) {
    if (!lessonId) {
      throw new LessonAuthoringError(
        "O upload do material precisa estar vinculado a uma aula."
      );
    }

    const upload = await getLessonResourceUpload({
      actorUserId,
      lessonId,
      resourceId: resource.id,
    });
    if (!(upload && upload.status === "uploaded")) {
      throw new LessonAuthoringError(
        "Confirme o upload do material antes de salvar a aula."
      );
    }

    assertSafeLessonResourceUploadReference({
      expected: upload.reference,
      received: resource,
    });
  }

  await confirmLessonResourceUpload({
    contentType: resource.contentType,
    key: resource.key,
    sizeBytes: resource.sizeBytes,
  });
  if (resource.preview) {
    await confirmLessonResourceUpload({
      contentType: resource.preview.contentType,
      key: resource.preview.key,
      sizeBytes: resource.preview.sizeBytes,
    });
  }

  return !isExistingResource;
};

const confirmLessonResourceUploads = async ({
  actorUserId,
  contentJson,
  lessonId,
  previousR2Keys,
}: {
  actorUserId: string;
  contentJson: unknown;
  lessonId: string | null;
  previousR2Keys: string[];
}): Promise<string[]> => {
  const content = parseLessonContent(contentJson);

  if (content?.type !== "text" || !("resources" in content)) {
    return [];
  }

  const newUploadIds: string[] = [];
  for (const resource of content.resources ?? []) {
    if (resource.storage !== "r2") {
      continue;
    }

    const isNewUpload = await confirmSingleLessonResourceUpload({
      actorUserId,
      lessonId,
      previousR2Keys,
      resource,
    });
    if (isNewUpload) {
      newUploadIds.push(resource.id);
    }
  }

  return newUploadIds;
};

const consumeUploadedLessonResources = async ({
  actorUserId,
  lessonId,
  resourceIds,
}: {
  actorUserId: string;
  lessonId: string | null;
  resourceIds: string[];
}): Promise<void> => {
  if (!(lessonId && resourceIds.length > 0)) {
    return;
  }

  await Promise.all(
    resourceIds.map(async (resourceId) => {
      try {
        await consumeLessonResourceUpload({
          actorUserId,
          lessonId,
          resourceId,
        });
        logLessonResourceUploadEvent({
          correlationId: randomUUID(),
          httpStatus: 200,
          lessonId,
          resourceId,
          stage: "consume",
          success: true,
        });
      } catch {
        logLessonResourceUploadEvent({
          correlationId: randomUUID(),
          errorCode: "lesson_resource_upload_consume_failed",
          lessonId,
          resourceId,
          stage: "consume",
          success: false,
        });
      }
    })
  );
};

const runCourseUpdateTransaction = async ({
  actorUserId,
  courseId,
  preparedCover,
  values,
}: {
  actorUserId: string;
  courseId: string;
  preparedCover?: {
    coverImage: CourseCoverImage | null;
    expectedPreviousCoverImage: CourseCoverImage | null;
    shouldPublish: boolean;
  };
  values: CourseFormValues;
}): Promise<{
  coverImage: CourseCoverImage | null;
  shouldPublish: boolean;
}> => {
  const client = await getPool().connect();

  try {
    await client.query("begin");
    await lockCourseContentRelease(client, courseId);
    const publicationState = await client.query<{
      access_duration_months: number;
      cover_image_json: unknown;
      description: string | null;
      max_release_delay_days: number;
      payment_allow_credit_card: boolean;
      payment_allow_pix: boolean;
      payment_max_installment_count: number;
      price_in_cents: number;
      sales_status: "closed" | "open";
      should_publish: boolean;
      subtitle: string | null;
      title: string;
      workload_hours_override: number | null;
    }>(
      `
        select (c.status = 'active' or c.catalog_visibility = 'listed') as should_publish,
               c.title,
               c.subtitle,
               c.description,
               c.workload_hours_override,
               c.price_in_cents,
               c.payment_allow_pix,
               c.payment_allow_credit_card,
               c.payment_max_installment_count,
               c.access_duration_months,
               c.cover_image_json,
               c.sales_status,
               coalesce((
                 select max(m.release_delay_days)
                 from modules m
                 join course_publications cp on cp.id = m.course_publication_id
                 where cp.course_id = c.id
                   and cp.status = 'published'
                   and m.status = 'active'
               ), 0)::int as max_release_delay_days
        from courses c
        where c.id = $1
        limit 1
        for update
      `,
      [courseId]
    );
    const currentCourse = publicationState.rows[0];
    if (!currentCourse) {
      throw new Error("Curso não encontrado.");
    }
    const currentCoverImage = parseCourseCoverImage(
      currentCourse.cover_image_json
    );
    if (
      currentCourse.sales_status === "open" &&
      values.accessDurationMonths < currentCourse.access_duration_months
    ) {
      assertMaxReleaseDelayFitsAccessDuration({
        accessDurationMonths: values.accessDurationMonths,
        maxReleaseDelayDays: currentCourse.max_release_delay_days,
      });
    }

    if (!preparedCover) {
      await client.query("commit");
      return {
        coverImage: currentCoverImage,
        shouldPublish: currentCourse.should_publish,
      };
    }
    if (
      preparedCover.shouldPublish !== currentCourse.should_publish ||
      JSON.stringify(preparedCover.expectedPreviousCoverImage) !==
        JSON.stringify(currentCoverImage)
    ) {
      throw new Error(
        "A disponibilidade do Curso mudou durante o envio da capa. Tente salvar novamente."
      );
    }
    const nextCoverImage = preparedCover.coverImage;
    const thumbnailUrl = getCourseCoverUrl({
      courseId,
      coverImage: nextCoverImage,
    });

    await client.query(
      `
         update courses
         set title = $1,
             subtitle = $2,
             description = $3,
             workload_hours_override = $4,
             price_in_cents = $5,
             payment_allow_pix = $6,
             payment_allow_credit_card = $7,
             payment_max_installment_count = $8,
             thumbnail_url = $9,
             cover_image_json = $10::jsonb,
             access_duration_months = $11,
             updated_at = now()
         where id = $12
      `,
      [
        values.title,
        values.subtitle,
        values.description,
        values.workloadHoursOverride,
        values.priceInCents,
        values.paymentAllowPix,
        values.paymentAllowCreditCard,
        values.paymentMaxInstallmentCount,
        thumbnailUrl,
        nextCoverImage ? JSON.stringify(nextCoverImage) : null,
        values.accessDurationMonths,
        courseId,
      ]
    );
    const changes = getAuditChanges({
      accessDurationMonths: {
        after: values.accessDurationMonths,
        before: currentCourse.access_duration_months,
      },
      description: {
        after: truncateAuditText(values.description),
        before: truncateAuditText(currentCourse.description),
      },
      paymentAllowCreditCard: {
        after: values.paymentAllowCreditCard,
        before: currentCourse.payment_allow_credit_card,
      },
      paymentAllowPix: {
        after: values.paymentAllowPix,
        before: currentCourse.payment_allow_pix,
      },
      paymentMaxInstallmentCount: {
        after: values.paymentMaxInstallmentCount,
        before: currentCourse.payment_max_installment_count,
      },
      priceInCents: {
        after: values.priceInCents,
        before: currentCourse.price_in_cents,
      },
      subtitle: {
        after: truncateAuditText(values.subtitle),
        before: truncateAuditText(currentCourse.subtitle),
      },
      title: { after: values.title, before: currentCourse.title },
      workloadHoursOverride: {
        after: values.workloadHoursOverride,
        before: currentCourse.workload_hours_override,
      },
      cover: {
        after: nextCoverImage ? "configurada" : "não configurada",
        before: currentCoverImage ? "configurada" : "não configurada",
      },
    });
    if (Object.keys(changes).length > 0) {
      await audit({
        action: "course.updated",
        actorUserId,
        client,
        metadata: {
          changes,
          targetLabelAfter: values.title,
          targetLabelBefore: currentCourse.title,
        },
        targetId: courseId,
        targetType: "course",
      });
    }
    await client.query("commit");
    return {
      coverImage: currentCoverImage,
      shouldPublish: currentCourse.should_publish,
    };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
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
  const { coverImage: expectedPreviousCoverImage, shouldPublish } =
    await runCourseUpdateTransaction({ actorUserId, courseId, values });
  let uploadedCoverImage: CourseCoverImage | null = null;
  let nextCoverImage: CourseCoverImage | null = null;

  try {
    nextCoverImage = coverFile
      ? await uploadCourseCoverFile({ courseId, file: coverFile })
      : parseCourseCoverFormField(formData);
    uploadedCoverImage = coverFile ? nextCoverImage : null;

    if (shouldPublish) {
      await publishCourseCover(nextCoverImage);
    } else {
      await cleanupPublishedCourseCover(nextCoverImage);
    }

    await runCourseUpdateTransaction({
      actorUserId,
      courseId,
      preparedCover: {
        coverImage: nextCoverImage,
        expectedPreviousCoverImage,
        shouldPublish,
      },
      values,
    });
  } catch (error) {
    await Promise.all([
      cleanupUploadedCourseCover(uploadedCoverImage),
      cleanupPublishedCourseCover(uploadedCoverImage),
    ]);
    throw error;
  }

  const nextCoverKeys = getCourseCoverStorageKeys(nextCoverImage);
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
    const client = await getPool().connect();
    try {
      await client.query("begin");
      const inserted = await client.query<{ id: string }>(
        `
          insert into courses (
            id,
            slug,
            title,
            subtitle,
            description,
            workload_hours,
            workload_hours_override,
            price_in_cents,
            payment_allow_pix,
            payment_allow_credit_card,
            payment_max_installment_count,
            thumbnail_url,
            cover_image_json,
            access_duration_months,
            status
          )
          values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb, $14, $15)
          returning id
        `,
        [
          courseId,
          slug,
          values.title,
          values.subtitle,
          values.description,
          values.workloadHoursOverride ?? 0,
          values.workloadHoursOverride,
          values.priceInCents,
          values.paymentAllowPix,
          values.paymentAllowCreditCard,
          values.paymentMaxInstallmentCount,
          insertedThumbnailUrl,
          coverImage ? JSON.stringify(coverImage) : null,
          values.accessDurationMonths,
          CREATED_CONTENT_STATUS,
        ]
      );
      const createdCourseId = inserted.rows[0]?.id;
      if (!createdCourseId) {
        throw new Error("Não foi possível criar o Curso.");
      }
      await client.query(
        `
          insert into course_publications (
            course_id,
            publication_number,
            status,
            title_snapshot,
            workload_hours_snapshot
          )
          values ($1, 1, 'draft', $2, $3)
        `,
        [createdCourseId, values.title, values.workloadHoursOverride ?? 0]
      );
      await audit({
        action: "course.created",
        actorUserId,
        client,
        metadata: {
          changes: getAuditChanges({
            accessDurationMonths: {
              after: values.accessDurationMonths,
              before: null,
            },
            description: {
              after: truncateAuditText(values.description),
              before: null,
            },
            paymentAllowCreditCard: {
              after: values.paymentAllowCreditCard,
              before: null,
            },
            paymentAllowPix: { after: values.paymentAllowPix, before: null },
            paymentMaxInstallmentCount: {
              after: values.paymentMaxInstallmentCount,
              before: null,
            },
            priceInCents: { after: values.priceInCents, before: null },
            subtitle: {
              after: truncateAuditText(values.subtitle),
              before: null,
            },
            title: { after: values.title, before: null },
            workloadHoursOverride: {
              after: values.workloadHoursOverride,
              before: null,
            },
            cover: {
              after: coverImage ? "configurada" : "não configurada",
              before: null,
            },
          }),
          targetLabelAfter: values.title,
        },
        targetId: createdCourseId,
        targetType: "course",
      });
      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
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
  if (readString(formData, "coverUploadPending") === "on") {
    throw new Error("Aguarde o envio da capa terminar.");
  }
  const rawCoverUpload = parseJsonFormField(formData, "coverUpload");
  const coverUpload = rawCoverUpload
    ? parseStagedAdminImageReference(rawCoverUpload)
    : null;
  if (rawCoverUpload && !coverUpload) {
    throw new Error("Upload temporario de capa invalido.");
  }
  const savedCourseId = courseId || coverUpload?.aggregateId || randomUUID();
  const previousCoverKeys = courseId
    ? (await getCourseR2ObjectKeys(courseId)).filter((key) =>
        key.includes("/cover/")
      )
    : [];

  const persistCourse = async (
    coverFile: CourseCoverFile | null
  ): Promise<void> => {
    if (courseId) {
      await updateExistingCourse({
        actorUserId,
        courseId,
        coverFile,
        formData,
        previousCoverKeys,
        values,
      });
      return;
    }

    await createNewCourse({
      actorUserId,
      courseId: savedCourseId,
      coverFile,
      formData,
      values,
    });
  };

  if (coverUpload) {
    await consumeStagedAdminImageUpload({
      actorUserId,
      aggregateId: savedCourseId,
      operation: async (file) => {
        await persistCourse(readCourseCoverFile(file));
      },
      purpose: "course-cover",
      reference: coverUpload,
    });
  } else {
    await persistCourse(null);
  }

  await recalculateCourseWorkloadHours(savedCourseId);

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
  const releaseDelayDays = readModuleReleaseDelayDays(formData);
  const status = moduleId
    ? readContentStatus(formData)
    : CREATED_CONTENT_STATUS;

  if (moduleId) {
    await assertDraftModule(moduleId);
    const previousCourseId = await getCourseIdForModule(moduleId);
    await withCourseContentReleaseLock(
      [courseId, previousCourseId ?? ""],
      async (client) => {
        const current = await client.query<{
          course_id: string;
          description: string | null;
          id: string;
          release_delay_days: number;
          sort_order: number;
          status: string;
          title: string;
        }>(
          `
            select m.id, m.course_id, m.title, m.description, m.sort_order,
                   m.status, m.release_delay_days
            from modules m
            join course_publications cp on cp.id = m.course_publication_id
            where m.id = $1 and cp.status = 'draft'
            limit 1
            for update
          `,
          [moduleId]
        );
        if (!current.rows[0]) {
          throw new LessonAuthoringError(
            "Modulo nao pertence a uma versao em rascunho."
          );
        }

        await client.query(
          `
            update modules
            set course_id = $1,
                title = $2,
                description = $3,
                sort_order = $4,
                status = $5,
                release_delay_days = $6,
                updated_at = now()
            where id = $7
          `,
          [
            courseId,
            title,
            description,
            sortOrder,
            status,
            releaseDelayDays,
            moduleId,
          ]
        );
        const changes = getAuditChanges({
          courseId: { after: courseId, before: current.rows[0].course_id },
          description: {
            after: truncateAuditText(description),
            before: truncateAuditText(current.rows[0].description),
          },
          releaseDelayDays: {
            after: releaseDelayDays,
            before: current.rows[0].release_delay_days,
          },
          sortOrder: {
            after: sortOrder,
            before: current.rows[0].sort_order,
          },
          status: { after: status, before: current.rows[0].status },
          title: { after: title, before: current.rows[0].title },
        });
        if (Object.keys(changes).length > 0) {
          await audit({
            action: "module.updated",
            actorUserId,
            client,
            metadata: {
              changes,
              targetLabelAfter: title,
              targetLabelBefore: current.rows[0].title,
            },
            targetId: moduleId,
            targetType: "module",
          });
        }
      }
    );
    await recalculateCourseWorkloadHours(courseId);
    if (previousCourseId && previousCourseId !== courseId) {
      await recalculateCourseWorkloadHours(previousCourseId);
    }
    return;
  }

  await withCourseContentReleaseLock([courseId], async (client) => {
    const draft = await client.query<{ id: string }>(
      `
          select id
          from course_publications
          where course_id = $1 and status = 'draft'
          order by publication_number desc
          limit 1
          for update
        `,
      [courseId]
    );
    const coursePublicationId = draft.rows[0]?.id;
    if (!coursePublicationId) {
      throw new Error(
        "Prepare alteracoes antes de alterar conteudo publicado."
      );
    }

    const existingModule = await client.query<{
      description: string | null;
      id: string;
      release_delay_days: number;
      sort_order: number;
      status: string;
      title: string;
    }>(
      `
        select m.id, m.title, m.description, m.sort_order,
               m.status, m.release_delay_days
        from modules m
        where m.course_publication_id = $1 and m.sort_order = $2
        limit 1
        for update
      `,
      [coursePublicationId, sortOrder]
    );
    const previousModule = existingModule.rows[0];

    const insertedModule = await client.query<{ id: string }>(
      `
          insert into modules (course_id, course_publication_id, title, description, sort_order, status, release_delay_days)
          values ($1, $2, $3, $4, $5, $6, $7)
          on conflict (course_publication_id, sort_order) do update set
            title = excluded.title,
            description = excluded.description,
            status = excluded.status,
            release_delay_days = excluded.release_delay_days,
            updated_at = now()
          returning id
        `,
      [
        courseId,
        coursePublicationId,
        title,
        description,
        sortOrder,
        status,
        releaseDelayDays,
      ]
    );
    const changes = getAuditChanges({
      description: {
        after: truncateAuditText(description),
        before: truncateAuditText(previousModule?.description ?? null),
      },
      releaseDelayDays: {
        after: releaseDelayDays,
        before: previousModule?.release_delay_days ?? null,
      },
      sortOrder: {
        after: sortOrder,
        before: previousModule?.sort_order ?? null,
      },
      status: { after: status, before: previousModule?.status ?? null },
      title: { after: title, before: previousModule?.title ?? null },
    });
    await audit({
      action: previousModule ? "module.updated" : "module.created",
      actorUserId,
      client,
      metadata: {
        changes: {
          ...changes,
          ...(previousModule
            ? {}
            : { courseId: { after: courseId, before: null } }),
        },
        targetLabelAfter: title,
        ...(previousModule ? { targetLabelBefore: previousModule.title } : {}),
      },
      targetId: insertedModule.rows[0]?.id,
      targetType: "module",
    });
    return insertedModule;
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
  const module = await getCourseAndPublicationForModule(draft.moduleId);
  const courseId = module?.courseId;

  if (!(courseId && module)) {
    throw new LessonAuthoringError("Modulo invalido.");
  }

  const lessonId = await withCourseContentReleaseLock(
    [courseId],
    async (client) => {
      const currentModule = await client.query<{ id: string }>(
        `
          select m.id
          from modules m
          join course_publications cp on cp.id = m.course_publication_id
          where m.id = $1 and cp.status = 'draft'
          limit 1
          for update
        `,
        [draft.moduleId]
      );
      if (!currentModule.rows[0]) {
        throw new LessonAuthoringError(
          "Modulo nao pertence a uma versao em rascunho."
        );
      }

      const inserted = await client.query<{ id: string }>(
        `
          insert into lessons (
            module_id,
            course_publication_id,
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
          module.coursePublicationId,
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
      const lessonAfter: LessonAuditSnapshot = {
        content: false,
        contentFingerprint: null,
        description: draft.description,
        durationSeconds: 0,
        isPublished: false,
        isRequired: true,
        moduleId: draft.moduleId,
        sortOrder: draft.sortOrder,
        status: CREATED_CONTENT_STATUS,
        textDurationSeconds: 0,
        textWordCount: 0,
        title: draft.title,
        videoDurationSeconds: 0,
        videoEmbedUrl: null,
        videoExternalId: null,
        videoProvider: null,
      };
      await audit({
        action: "lesson.created",
        actorUserId,
        client,
        metadata: {
          changes: getLessonAuditChanges(null, lessonAfter),
          targetLabelAfter: draft.title,
        },
        targetId: lessonId,
        targetType: "lesson",
      });
      return lessonId;
    }
  );
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
  const title = readString(formData, "title");

  if (!title) {
    throw new LessonAuthoringError("Informe o título da aula.", "title");
  }

  await assertExistingLessonPublicationIsEditable(existingLessonId);

  let savedLessonId = existingLessonId;
  const contentJson = normalizeLessonContentForSave({
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

  assertLessonHasContent({ contentJson, hasVideoContent });

  const previousR2Keys = existingLessonId
    ? await getLessonR2ObjectKeys(existingLessonId)
    : [];
  const uploadedLessonResourceIds = await confirmLessonResourceUploads({
    actorUserId,
    contentJson,
    lessonId: existingLessonId,
    previousR2Keys,
  });

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
  await assertLessonTargetPublicationIsEditable({ moduleId });
  const module = await getCourseAndPublicationForModule(moduleId);

  if (!module) {
    throw new LessonAuthoringError("Modulo invalido.");
  }
  const description = readString(formData, "description") || null;
  const values = [
    moduleId,
    module.coursePublicationId,
    title,
    description,
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
  const previousCourseId = existingLessonId
    ? await getCourseIdForLesson(existingLessonId)
    : null;
  const persistedLessonId = await withCourseContentReleaseLock(
    [moduleCourseId, previousCourseId ?? ""],
    async (client) => {
      let currentLesson: { rows: LessonAuditDatabaseRow[] } | null = null;
      if (existingLessonId) {
        currentLesson = await client.query<LessonAuditDatabaseRow>(
          `
            select l.id, l.module_id, l.title, l.description,
                   l.video_provider, l.video_external_id, l.video_embed_url,
                   l.content_json, l.duration_seconds, l.video_duration_seconds,
                   l.text_duration_seconds, l.text_word_count, l.sort_order,
                   l.status, l.is_published, l.is_required
            from lessons l
            join course_publications cp on cp.id = l.course_publication_id
            where l.id = $1 and cp.status = 'draft'
            limit 1
            for update
          `,
          [existingLessonId]
        );
        if (!currentLesson.rows[0]) {
          throw new LessonAuthoringError(
            "Prepare alteracoes antes de editar conteudo publicado."
          );
        }
      }

      const currentModule = await client.query<{ id: string }>(
        `
          select m.id
          from modules m
          join course_publications cp on cp.id = m.course_publication_id
          where m.id = $1 and cp.status = 'draft'
          limit 1
          for update
        `,
        [moduleId]
      );
      if (!currentModule.rows[0]) {
        throw new LessonAuthoringError(
          "Prepare alteracoes antes de editar conteudo publicado."
        );
      }

      if (existingLessonId) {
        await client.query(
          `
            update lessons
            set module_id = $1,
                course_publication_id = $2,
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
        const current = currentLesson?.rows[0];
        if (!current) {
          throw new LessonAuthoringError(
            "Não foi possível carregar a Aula antes de salvar."
          );
        }
        const lessonAfter: LessonAuditSnapshot = {
          content: Boolean(contentJson),
          contentFingerprint: getContentFingerprint(contentJson),
          description,
          durationSeconds: durationBreakdown.totalDurationSeconds,
          isPublished,
          isRequired,
          moduleId,
          sortOrder,
          status,
          textDurationSeconds: durationBreakdown.textDurationSeconds,
          textWordCount: durationBreakdown.textWordCount,
          title,
          videoDurationSeconds: durationBreakdown.videoDurationSeconds,
          videoEmbedUrl,
          videoExternalId,
          videoProvider,
        };
        const lessonBefore: LessonAuditSnapshot = {
          content: Boolean(current.content_json),
          contentFingerprint: getContentFingerprint(current.content_json),
          description: current.description,
          durationSeconds: current.duration_seconds,
          isPublished: current.is_published,
          isRequired: current.is_required,
          moduleId: current.module_id,
          sortOrder: current.sort_order,
          status: current.status,
          textDurationSeconds: current.text_duration_seconds,
          textWordCount: current.text_word_count,
          title: current.title,
          videoDurationSeconds: current.video_duration_seconds,
          videoEmbedUrl: current.video_embed_url,
          videoExternalId: current.video_external_id,
          videoProvider: current.video_provider,
        };
        const changes = getLessonAuditChanges(lessonBefore, lessonAfter);
        if (Object.keys(changes).length > 0) {
          await audit({
            action: "lesson.updated",
            actorUserId,
            client,
            metadata: {
              changes,
              targetLabelAfter: title,
              targetLabelBefore: current.title,
            },
            targetId: existingLessonId,
            targetType: "lesson",
          });
        }
        return existingLessonId;
      }

      const inserted = await client.query<{ id: string }>(
        `
          insert into lessons (
            module_id,
            course_publication_id,
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
      const lessonAfter: LessonAuditSnapshot = {
        content: Boolean(contentJson),
        contentFingerprint: getContentFingerprint(contentJson),
        description,
        durationSeconds: durationBreakdown.totalDurationSeconds,
        isPublished,
        isRequired,
        moduleId,
        sortOrder,
        status,
        textDurationSeconds: durationBreakdown.textDurationSeconds,
        textWordCount: durationBreakdown.textWordCount,
        title,
        videoDurationSeconds: durationBreakdown.videoDurationSeconds,
        videoEmbedUrl,
        videoExternalId,
        videoProvider,
      };
      await audit({
        action: "lesson.created",
        actorUserId,
        client,
        metadata: {
          changes: getLessonAuditChanges(null, lessonAfter),
          targetLabelAfter: title,
        },
        targetId: insertedLessonId,
        targetType: "lesson",
      });
      return insertedLessonId;
    }
  );
  savedLessonId = persistedLessonId;

  if (existingLessonId) {
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
  } else if (moduleCourseId) {
    await recalculateCourseWorkloadHours(moduleCourseId);
  }

  await consumeUploadedLessonResources({
    actorUserId,
    lessonId: existingLessonId,
    resourceIds: uploadedLessonResourceIds,
  });

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

  await assertLessonPublicationIsEditable(lessonId);

  const courseId = await getCourseIdForLesson(lessonId);

  if (!courseId) {
    throw new Error("Aula invalida.");
  }

  const deleteResult = (await isJmvstreamAssetReferencedByPublishedVersion(
    lessonId
  ))
    ? { failed: 0 }
    : await deleteJmvstreamAssetsForLesson(lessonId);
  await withCourseContentReleaseLock([courseId], async (client) => {
    const currentLesson = await client.query<{
      content_json: unknown;
      description: string | null;
      duration_seconds: number;
      id: string;
      is_published: boolean;
      is_required: boolean;
      module_id: string;
      sort_order: number;
      status: string;
      text_duration_seconds: number;
      text_word_count: number;
      title: string;
      video_duration_seconds: number;
      video_embed_url: string | null;
      video_external_id: string | null;
      video_provider: string | null;
    }>(
      `
        select l.id, l.module_id, l.title, l.description,
               l.video_provider, l.video_external_id, l.video_embed_url,
               l.content_json, l.duration_seconds, l.video_duration_seconds,
               l.text_duration_seconds, l.text_word_count, l.sort_order,
               l.status, l.is_published, l.is_required
        from lessons l
        join course_publications cp on cp.id = l.course_publication_id
        where l.id = $1 and cp.status = 'draft'
        limit 1
        for update
      `,
      [lessonId]
    );
    if (!currentLesson.rows[0]) {
      throw new LessonAuthoringError(
        "Prepare alteracoes antes de editar conteudo publicado."
      );
    }
    const current = currentLesson.rows[0];
    await client.query(
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
    const lessonBefore: LessonAuditSnapshot = {
      content: Boolean(current.content_json),
      contentFingerprint: getContentFingerprint(current.content_json),
      description: current.description,
      durationSeconds: current.duration_seconds,
      isPublished: current.is_published,
      isRequired: current.is_required,
      moduleId: current.module_id,
      sortOrder: current.sort_order,
      status: current.status,
      textDurationSeconds: current.text_duration_seconds,
      textWordCount: current.text_word_count,
      title: current.title,
      videoDurationSeconds: current.video_duration_seconds,
      videoEmbedUrl: current.video_embed_url,
      videoExternalId: current.video_external_id,
      videoProvider: current.video_provider,
    };
    const lessonAfter: LessonAuditSnapshot = {
      ...lessonBefore,
      durationSeconds: current.text_duration_seconds,
      videoDurationSeconds: 0,
      videoEmbedUrl: null,
      videoExternalId: null,
      videoProvider: null,
    };
    const changes = getLessonAuditChanges(lessonBefore, lessonAfter);
    if (Object.keys(changes).length > 0) {
      await audit({
        action: "lesson.video_removed",
        actorUserId,
        client,
        metadata: {
          changes,
          targetLabelAfter: current.title,
          targetLabelBefore: current.title,
        },
        targetId: lessonId,
        targetType: "lesson",
      });
    }
  });
  await recalculateCourseWorkloadHours(courseId);

  return { courseId, deletePending: deleteResult.failed > 0 };
};
