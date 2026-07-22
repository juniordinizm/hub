import "server-only";
import { getPool } from "@/db";
import {
  type CompletionCertificateSummary,
  issueCompletionCertificateIfEligible,
} from "@/features/certificates/server";
import {
  type LessonContent,
  parseLessonContent,
} from "@/features/courses/lesson-content";
import { deriveCourseWorkloadHours } from "@/features/courses/presentation";
import { isPreviewRole } from "@/features/courses/preview";
import {
  resolveCourseAccess,
  resolveLessonAccess,
} from "@/features/enrollments/access";
import { getJmvstreamAssetsForLesson } from "@/features/jmvstream/asset-persistence";
import { syncJmvstreamLessonPlayer } from "@/features/jmvstream/server";
import { getWatchCheckpointPercent } from "@/features/learning-analytics/rules";
import { recordLearningAnalyticsEvent } from "@/features/learning-analytics/server";
import {
  calculateCourseProgress,
  calculateVideoPositionProgress,
  getNextAvailableLessonId,
  isLessonAvailable,
} from "@/features/progress/rules";
import { getCourseCoverBlurDataUrl } from "@/features/storage/course-cover";
import { shouldCompleteLessonFromJmvstreamEvent } from "@/features/videos/jmvstream";
import type { AppRole } from "@/lib/session";

const MAX_LESSON_DURATION_SECONDS = 12 * 60 * 60;

export interface StudentCourseCard {
  completedCount: number;
  courseId: string;
  description: string | null;
  expiresAt: Date;
  modules: StudentCourseModule[];
  nextLessonId: string | null;
  progressPercent: number;
  slug: string;
  subtitle: string | null;
  thumbnailUrl: string | null;
  title: string;
  totalCount: number;
  workloadHours: number;
}

export interface StudentCatalogCourseCard {
  accessStatus: "active" | "expired" | "none" | "revoked";
  completedCount: number;
  courseId: string;
  coverBlurDataUrl: string | null;
  description: string | null;
  expiresAt: Date | null;
  isEnrolled: boolean;
  nextLessonId: string | null;
  priceInCents: number;
  progressPercent: number;
  revokedReason: string | null;
  slug: string;
  subtitle: string | null;
  thumbnailUrl: string | null;
  title: string;
  totalCount: number;
  totalDurationSeconds: number;
  workloadHours: number;
}

export interface StudentCourseModule {
  completedCount: number;
  id: string;
  nextLessonId: string | null;
  progressPercent: number;
  sortOrder: number;
  title: string;
  totalCount: number;
}

export interface FaqItem {
  answer: string;
  id: string;
  question: string;
}

export interface ModuleWithLessons {
  id: string;
  lessons: Array<{
    id: string;
    title: string;
    durationSeconds: number;
    sortOrder: number;
    isCompleted: boolean;
    isAvailable: boolean;
  }>;
  sortOrder: number;
  title: string;
}

export interface StudentCourseOverviewData {
  certificateCode: string | null;
  certificateEnabled: boolean;
  certificateRenderStatus: "failed" | "pending" | "ready" | null;
  completedCount: number;
  course: {
    description: string | null;
    expiresAt: Date;
    id: string;
    slug: string;
    subtitle: string | null;
    thumbnailUrl: string | null;
    title: string;
    workloadHours: number;
  };
  isPreview: boolean;
  modules: Array<{
    description: string | null;
    id: string;
    lessons: Array<{
      durationSeconds: number;
      hasVideo: boolean;
      id: string;
      isAvailable: boolean;
      isCompleted: boolean;
      sortOrder: number;
      thumbnailUrl: string | null;
      title: string;
      watchedPercent: number;
    }>;
    sortOrder: number;
    title: string;
  }>;
  nextLessonId: string | null;
  progressPercent: number;
  totalCount: number;
}

export interface StudentCourseAccessStatus {
  canAccess: boolean;
  redirectTo: string;
}

export interface StudentExperienceViewer {
  role: AppRole;
  userId: string;
}

export interface StudentLessonData {
  course: {
    id: string;
    title: string;
  };
  isPreview: boolean;
  lesson: {
    contentJson: LessonContent | null;
    id: string;
    title: string;
    description: string | null;
    durationSeconds: number;
    videoDurationSeconds: number;
    isCompleted: boolean;
    watchProgress: {
      currentSeconds: number;
      durationSeconds: number;
      maxPositionSeconds: number;
      watchedPercent: number;
    } | null;
    videoEmbedUrl: string | null;
    videoExternalId: string | null;
    videoProcessingState: "failed" | "processing" | null;
    videoProvider: string | null;
  };
  modules: ModuleWithLessons[];
  nextLessonId: string | null;
  previousLessonId: string | null;
  progressPercent: number;
}

interface LessonRow {
  completed_at: Date | null;
  content_json: unknown;
  course_id: string;
  course_title: string;
  duration_seconds: number;
  is_required: boolean;
  lesson_description: string | null;
  lesson_id: string;
  lesson_sort_order: number;
  lesson_title: string;
  module_id: string;
  module_sort_order: number;
  module_title: string;
  video_duration_seconds: number;
  video_embed_url: string | null;
  video_external_id: string | null;
  video_provider: string | null;
  watch_current_seconds: number | null;
  watch_duration_seconds: number | null;
  watch_max_position_seconds: number | null;
  watch_percent: number | null;
}

interface LessonWatchProgressRow {
  current_seconds: number;
  duration_seconds: number;
  max_position_seconds: number;
  watched_percent: number;
}

type StudentCourseModuleAggregate = StudentCourseModule & {
  completedLessonIds: string[];
  lessonIds: string[];
  requiredLessonIds: string[];
};

type StudentCourseAggregate = StudentCourseCard & {
  completedLessonIds: string[];
  lessonIds: string[];
  requiredLessonIds: string[];
  modulesById: Map<string, StudentCourseModuleAggregate>;
};

type StudentCatalogCourseAggregate = StudentCatalogCourseCard & {
  completedLessonIds: string[];
  durationSecondsPerLesson: Map<string, number>;
  lessonIds: string[];
};

interface CourseOverviewRow {
  certificate_code: string | null;
  certificate_enabled: boolean;
  certificate_render_status: "failed" | "pending" | "ready" | null;
  completed_at: Date | null;
  course_description: string | null;
  course_id: string;
  course_slug: string;
  course_subtitle: string | null;
  course_title: string;
  duration_seconds: number | null;
  expires_at: Date;
  is_required: boolean | null;
  lesson_id: string | null;
  lesson_sort_order: number | null;
  lesson_thumbnail_url: string | null;
  lesson_title: string | null;
  module_description: string | null;
  module_id: string | null;
  module_sort_order: number | null;
  module_title: string | null;
  thumbnail_url: string | null;
  video_embed_url: string | null;
  video_external_id: string | null;
  watched_percent: number | null;
  workload_hours: number;
}

interface CoursePreviewOverviewRow {
  course_description: string | null;
  course_id: string;
  course_slug: string;
  course_subtitle: string | null;
  course_title: string;
  duration_seconds: number | null;
  lesson_id: string | null;
  lesson_sort_order: number | null;
  lesson_thumbnail_url: string | null;
  lesson_title: string | null;
  module_description: string | null;
  module_id: string | null;
  module_sort_order: number | null;
  module_title: string | null;
  thumbnail_url: string | null;
  video_embed_url: string | null;
  video_external_id: string | null;
  workload_hours: number;
}

const mapModules = (rows: LessonRow[]): ModuleWithLessons[] => {
  const lessonIds = rows.map((row) => row.lesson_id);
  const completedLessonIds = rows
    .filter((row) => row.completed_at)
    .map((row) => row.lesson_id);
  const modules = new Map<string, ModuleWithLessons>();

  for (const row of rows) {
    const existingModule = modules.get(row.module_id);
    const moduleData = existingModule ?? {
      id: row.module_id,
      title: row.module_title,
      sortOrder: row.module_sort_order,
      lessons: [],
    };

    moduleData.lessons.push({
      id: row.lesson_id,
      title: row.lesson_title,
      durationSeconds: row.duration_seconds,
      sortOrder: row.lesson_sort_order,
      isCompleted: Boolean(row.completed_at),
      isAvailable: isLessonAvailable({
        lessonIds,
        completedLessonIds,
        lessonId: row.lesson_id,
      }),
    });

    modules.set(row.module_id, moduleData);
  }

  return [...modules.values()].sort((a, b) => a.sortOrder - b.sortOrder);
};

export const getStudentCourses = async (
  userId: string
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: assembles one course tree from a flat version-scoped query.
): Promise<StudentCourseCard[]> => {
  const { rows } = await getPool().query<{
    completed_at: Date | null;
    course_description: string | null;
    course_id: string;
    expires_at: Date;
    lesson_id: string | null;
    is_required: boolean | null;
    module_id: string | null;
    module_sort_order: number | null;
    module_title: string | null;
    slug: string;
    subtitle: string | null;
    thumbnail_url: string | null;
    title: string;
    workload_hours: number;
  }>(
    `
      select
        c.id as course_id,
        c.slug,
        cp.title_snapshot as title,
        c.subtitle,
        c.description as course_description,
        cp.workload_hours_snapshot as workload_hours,
        c.thumbnail_url,
        e.expires_at,
        m.id as module_id,
        m.title as module_title,
        m.sort_order as module_sort_order,
        l.id as lesson_id,
        l.is_required,
        lp.completed_at
      from enrollments e
      join courses c on c.id = e.course_id
      join course_publications cp on cp.course_id = c.id and cp.status = 'published'
      left join modules m on m.course_publication_id = cp.id and m.status = 'active'
      left join lessons l on l.module_id = m.id
        and l.course_publication_id = cp.id
        and l.status = 'active'
      left join lateral (
        select min(lp.completed_at) as completed_at
        from lesson_progress lp
        join lessons completed_lesson on completed_lesson.id = lp.lesson_id
        where lp.user_id = e.user_id
          and completed_lesson.curriculum_key = l.curriculum_key
      ) lp on true
      where e.user_id = $1
        and e.status = 'active'
        and e.starts_at <= now()
        and e.expires_at >= now()
        and c.status = 'active'
      order by c.title asc, m.sort_order asc, l.sort_order asc
    `,
    [userId]
  );

  const byCourse = new Map<string, StudentCourseAggregate>();

  for (const row of rows) {
    const course: StudentCourseAggregate = byCourse.get(row.course_id) ?? {
      courseId: row.course_id,
      slug: row.slug,
      title: row.title,
      subtitle: row.subtitle,
      description: row.course_description,
      workloadHours: row.workload_hours,
      thumbnailUrl: row.thumbnail_url,
      expiresAt: row.expires_at,
      modules: [],
      progressPercent: 0,
      completedCount: 0,
      totalCount: 0,
      nextLessonId: null,
      lessonIds: [],
      completedLessonIds: [],
      requiredLessonIds: [],
      modulesById: new Map<string, StudentCourseModuleAggregate>(),
    };

    if (row.lesson_id) {
      course.lessonIds.push(row.lesson_id);
      if (row.is_required) {
        course.requiredLessonIds.push(row.lesson_id);
      }
      if (row.completed_at) {
        course.completedLessonIds.push(row.lesson_id);
      }
    }

    if (row.module_id && row.module_sort_order && row.module_title) {
      const moduleData = course.modulesById.get(row.module_id) ?? {
        id: row.module_id,
        title: row.module_title,
        sortOrder: row.module_sort_order,
        totalCount: 0,
        completedCount: 0,
        progressPercent: 0,
        nextLessonId: null,
        lessonIds: [],
        completedLessonIds: [],
        requiredLessonIds: [],
      };

      if (row.lesson_id) {
        moduleData.lessonIds.push(row.lesson_id);
        if (row.is_required) {
          moduleData.requiredLessonIds.push(row.lesson_id);
        }
        if (row.completed_at) {
          moduleData.completedLessonIds.push(row.lesson_id);
        }
      }

      course.modulesById.set(row.module_id, moduleData);
    }

    byCourse.set(row.course_id, course);
  }

  return [...byCourse.values()].map((course) => {
    const progress = calculateCourseProgress(course);
    const modules = [...course.modulesById.values()]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((moduleData) => {
        const moduleProgress = calculateCourseProgress(moduleData);

        return {
          id: moduleData.id,
          title: moduleData.title,
          sortOrder: moduleData.sortOrder,
          totalCount: moduleProgress.totalCount,
          completedCount: moduleProgress.completedCount,
          progressPercent: moduleProgress.percent,
          nextLessonId: getNextAvailableLessonId(moduleData),
        };
      });

    return {
      courseId: course.courseId,
      slug: course.slug,
      title: course.title,
      subtitle: course.subtitle,
      description: course.description,
      workloadHours: course.workloadHours,
      thumbnailUrl: course.thumbnailUrl,
      expiresAt: course.expiresAt,
      modules,
      progressPercent: progress.percent,
      completedCount: progress.completedCount,
      totalCount: progress.totalCount,
      nextLessonId: getNextAvailableLessonId(course),
    };
  });
};

export const getStudentCourseCatalog = async (
  userId: string
): Promise<StudentCatalogCourseCard[]> => {
  const { rows } = await getPool().query<{
    access_status: "active" | "expired" | "none" | "revoked";
    completed_at: Date | null;
    cover_image_json: unknown;
    course_description: string | null;
    course_id: string;
    duration_seconds: number;
    expires_at: Date | null;
    is_enrolled: boolean;
    lesson_id: string | null;
    price_in_cents: number;
    revoked_reason: string | null;
    slug: string;
    subtitle: string | null;
    thumbnail_url: string | null;
    title: string;
    workload_hours: number;
  }>(
    `
      select
        c.id as course_id,
        c.slug,
        c.title,
        c.subtitle,
        c.description as course_description,
        c.workload_hours,
        c.price_in_cents,
        c.cover_image_json,
        c.thumbnail_url,
        e.expires_at,
        e.revoked_reason,
        case
          when e.id is null then 'none'
          when e.status = 'revoked' then 'revoked'
          when e.status = 'expired' or e.expires_at < now() then 'expired'
          when e.status = 'active' and e.starts_at <= now() and e.expires_at >= now() then 'active'
          else 'none'
        end as access_status,
        (
          e.status = 'active'
          and e.starts_at <= now()
          and e.expires_at >= now()
        ) as is_enrolled,
        l.id as lesson_id,
        coalesce(l.duration_seconds, 0) as duration_seconds,
        lp.completed_at
      from courses c
      left join enrollments e on e.course_id = c.id
        and e.user_id = $1
      left join lateral (
        select id
        from course_publications
        where course_id = c.id and status = 'published'
        limit 1
      ) cv on true
      left join modules m on m.course_publication_id = cv.id and m.status = 'active'
      left join lessons l on l.module_id = m.id
        and l.course_publication_id = cv.id
        and l.status = 'active'
      left join lateral (
        select min(lp.completed_at) as completed_at
        from lesson_progress lp
        join lessons completed_lesson on completed_lesson.id = lp.lesson_id
        where lp.user_id = $1
          and completed_lesson.curriculum_key = l.curriculum_key
      ) lp on true
      where c.status = 'active'
      order by c.created_at desc, m.sort_order asc, l.sort_order asc
    `,
    [userId]
  );
  const byCourse = new Map<string, StudentCatalogCourseAggregate>();

  for (const row of rows) {
    const course = byCourse.get(row.course_id) ?? {
      courseId: row.course_id,
      slug: row.slug,
      title: row.title,
      subtitle: row.subtitle,
      description: row.course_description,
      workloadHours: row.workload_hours,
      priceInCents: row.price_in_cents,
      coverBlurDataUrl: getCourseCoverBlurDataUrl(row.cover_image_json),
      thumbnailUrl: row.thumbnail_url,
      expiresAt: row.expires_at,
      isEnrolled: row.is_enrolled,
      accessStatus: row.access_status,
      revokedReason: row.revoked_reason,
      progressPercent: 0,
      completedCount: 0,
      totalCount: 0,
      totalDurationSeconds: 0,
      nextLessonId: null,
      lessonIds: [],
      completedLessonIds: [],
      durationSecondsPerLesson: new Map<string, number>(),
    };

    if (row.lesson_id) {
      course.lessonIds.push(row.lesson_id);
      course.durationSecondsPerLesson.set(row.lesson_id, row.duration_seconds);
      if (row.completed_at && row.is_enrolled) {
        course.completedLessonIds.push(row.lesson_id);
      }
    }

    byCourse.set(row.course_id, course);
  }

  return [...byCourse.values()].map((course) => {
    const progress = course.isEnrolled
      ? calculateCourseProgress(course)
      : { completedCount: 0, percent: 0, totalCount: course.lessonIds.length };

    return {
      courseId: course.courseId,
      slug: course.slug,
      title: course.title,
      subtitle: course.subtitle,
      description: course.description,
      workloadHours: course.workloadHours,
      priceInCents: course.priceInCents,
      coverBlurDataUrl: course.coverBlurDataUrl,
      thumbnailUrl: course.thumbnailUrl,
      expiresAt: course.expiresAt,
      isEnrolled: course.isEnrolled,
      accessStatus: course.accessStatus,
      revokedReason: course.revokedReason,
      progressPercent: progress.percent,
      completedCount: progress.completedCount,
      totalCount: progress.totalCount,
      totalDurationSeconds: [
        ...course.durationSecondsPerLesson.values(),
      ].reduce((sum, s) => sum + Math.max(0, s), 0),
      nextLessonId: course.isEnrolled ? getNextAvailableLessonId(course) : null,
    };
  });
};

export const getStudentCourseAccessStatus = async ({
  courseId,
  userId,
}: {
  courseId: string;
  userId: string;
}): Promise<StudentCourseAccessStatus> => {
  const canAccess = await resolveCourseAccess({ courseId, userId });

  return {
    canAccess,
    redirectTo: `/app/cursos/${courseId}`,
  };
};

export const recalculateCourseWorkloadHours = async (
  courseId: string
): Promise<number> => {
  const publication = await getPool().query<{
    id: string;
    status: "draft" | "published";
  }>(
    `
      select id, status
      from course_publications
      where course_id = $1 and status in ('draft', 'published')
      order by case status when 'draft' then 0 else 1 end, publication_number desc
      limit 1
    `,
    [courseId]
  );
  const coursePublication = publication.rows[0];

  if (!coursePublication) {
    return 0;
  }

  const { rows } = await getPool().query<{ duration_seconds: number }>(
    `
      select l.duration_seconds
      from lessons l
      join modules m on m.id = l.module_id
      where l.course_publication_id = $1
        and m.status = 'active'
        and l.status = 'active'
    `,
    [coursePublication.id]
  );
  const workloadHours = deriveCourseWorkloadHours(
    rows.map((row) => row.duration_seconds)
  );

  await getPool().query(
    `
      update course_publications
      set workload_hours_snapshot = $1,
          updated_at = now()
      where id = $2
    `,
    [workloadHours, coursePublication.id]
  );

  if (coursePublication.status === "published") {
    await getPool().query(
      `
        update courses
        set workload_hours = $1,
            updated_at = now()
        where id = $2
      `,
      [workloadHours, courseId]
    );
  }

  return workloadHours;
};

const getEnrolledCourseOverview = async ({
  courseId,
  userId,
}: {
  courseId: string;
  userId: string;
}): Promise<StudentCourseOverviewData | null> => {
  const { rows } = await getPool().query<CourseOverviewRow>(
    `
      select
        c.id as course_id,
        c.slug as course_slug,
        cp.title_snapshot as course_title,
        c.subtitle as course_subtitle,
        c.description as course_description,
        cp.workload_hours_snapshot as workload_hours,
        c.thumbnail_url,
        e.expires_at,
        cert.code as certificate_code,
        c.certificate_enabled,
        cert.render_status as certificate_render_status,
        m.id as module_id,
        m.title as module_title,
        m.description as module_description,
        m.sort_order as module_sort_order,
        l.id as lesson_id,
        l.title as lesson_title,
        l.thumbnail_url as lesson_thumbnail_url,
        l.video_embed_url,
        l.video_external_id,
        l.duration_seconds,
        l.video_duration_seconds,
        l.is_required,
        l.sort_order as lesson_sort_order,
        lp.completed_at,
        lwp.watched_percent
      from enrollments e
      join courses c on c.id = e.course_id
      join course_publications cp on cp.course_id = c.id and cp.status = 'published'
      left join certificates cert on cert.course_id = c.id
        and cert.user_id = e.user_id
        and cert.status = 'valid'
      left join modules m on m.course_publication_id = cp.id and m.status = 'active'
      left join lessons l on l.module_id = m.id
        and l.course_publication_id = cp.id
        and l.status = 'active'
      left join lateral (
        select min(lp.completed_at) as completed_at
        from lesson_progress lp
        join lessons completed_lesson on completed_lesson.id = lp.lesson_id
        where lp.user_id = e.user_id
          and completed_lesson.curriculum_key = l.curriculum_key
      ) lp on true
      left join lesson_watch_progress lwp on lwp.lesson_id = l.id and lwp.user_id = e.user_id
      where e.user_id = $1
        and c.id = $2
        and e.status = 'active'
        and e.starts_at <= now()
        and e.expires_at >= now()
        and c.status = 'active'
      order by m.sort_order asc, l.sort_order asc
    `,
    [userId, courseId]
  );

  const firstRow = rows[0];

  if (!firstRow) {
    return null;
  }

  const lessonIds = rows
    .map((row) => row.lesson_id)
    .filter((lessonId): lessonId is string => Boolean(lessonId));
  const completedLessonIds = rows
    .filter((row) => row.completed_at && row.lesson_id)
    .map((row) => row.lesson_id as string);
  const requiredLessonIds = rows
    .filter((row) => row.lesson_id && row.is_required !== false)
    .map((row) => row.lesson_id as string);
  const progress = calculateCourseProgress({
    lessonIds,
    requiredLessonIds,
    completedLessonIds,
  });
  const modules = new Map<
    string,
    StudentCourseOverviewData["modules"][number]
  >();

  for (const row of rows) {
    if (!(row.module_id && row.module_title && row.module_sort_order)) {
      continue;
    }

    const moduleData = modules.get(row.module_id) ?? {
      id: row.module_id,
      title: row.module_title,
      description: row.module_description,
      sortOrder: row.module_sort_order,
      lessons: [],
    };

    if (
      row.lesson_id &&
      row.lesson_title &&
      row.lesson_sort_order !== null &&
      row.duration_seconds !== null
    ) {
      moduleData.lessons.push({
        id: row.lesson_id,
        title: row.lesson_title,
        thumbnailUrl: row.lesson_thumbnail_url,
        hasVideo: Boolean(row.video_embed_url || row.video_external_id),
        durationSeconds: row.duration_seconds,
        sortOrder: row.lesson_sort_order,
        isCompleted: Boolean(row.completed_at),
        watchedPercent: row.watched_percent ?? 0,
        isAvailable: isLessonAvailable({
          lessonIds,
          completedLessonIds,
          lessonId: row.lesson_id,
        }),
      });
    }

    modules.set(row.module_id, moduleData);
  }

  return {
    certificateCode: firstRow.certificate_code,
    certificateEnabled: firstRow.certificate_enabled,
    certificateRenderStatus: firstRow.certificate_render_status,
    completedCount: progress.completedCount,
    course: {
      id: firstRow.course_id,
      slug: firstRow.course_slug,
      title: firstRow.course_title,
      subtitle: firstRow.course_subtitle,
      description: firstRow.course_description,
      workloadHours: firstRow.workload_hours,
      thumbnailUrl: firstRow.thumbnail_url,
      expiresAt: firstRow.expires_at,
    },
    isPreview: false,
    modules: [...modules.values()].sort((a, b) => a.sortOrder - b.sortOrder),
    nextLessonId: getNextAvailableLessonId({ lessonIds, completedLessonIds }),
    progressPercent: progress.percent,
    totalCount: progress.totalCount,
  };
};

const getPreviewCourseOverview = async ({
  courseId,
}: {
  courseId: string;
}): Promise<StudentCourseOverviewData | null> => {
  const { rows } = await getPool().query<CoursePreviewOverviewRow>(
    `
      select
        c.id as course_id,
        c.slug as course_slug,
        cv.title_snapshot as course_title,
        c.subtitle as course_subtitle,
        c.description as course_description,
        cv.workload_hours_snapshot as workload_hours,
        c.thumbnail_url,
        m.id as module_id,
        m.title as module_title,
        m.description as module_description,
        m.sort_order as module_sort_order,
        l.id as lesson_id,
        l.title as lesson_title,
        l.thumbnail_url as lesson_thumbnail_url,
        l.video_embed_url,
        l.video_external_id,
        l.duration_seconds,
        l.sort_order as lesson_sort_order
      from courses c
      join lateral (
        select id, title_snapshot, workload_hours_snapshot
        from course_publications
        where course_id = c.id and status in ('draft', 'published')
        order by case status when 'draft' then 0 else 1 end, publication_number desc
        limit 1
      ) cv on true
      left join modules m on m.course_publication_id = cv.id
      left join lessons l on l.module_id = m.id and l.course_publication_id = cv.id
      where c.id = $1
      order by m.sort_order asc, l.sort_order asc
    `,
    [courseId]
  );
  const firstRow = rows[0];

  if (!firstRow) {
    return null;
  }

  const lessonIds = rows
    .map((row) => row.lesson_id)
    .filter((lessonId): lessonId is string => Boolean(lessonId));
  const modules = new Map<
    string,
    StudentCourseOverviewData["modules"][number]
  >();

  for (const row of rows) {
    if (!(row.module_id && row.module_title && row.module_sort_order)) {
      continue;
    }

    const moduleData = modules.get(row.module_id) ?? {
      id: row.module_id,
      title: row.module_title,
      description: row.module_description,
      sortOrder: row.module_sort_order,
      lessons: [],
    };

    if (
      row.lesson_id &&
      row.lesson_title &&
      row.lesson_sort_order !== null &&
      row.duration_seconds !== null
    ) {
      moduleData.lessons.push({
        id: row.lesson_id,
        title: row.lesson_title,
        thumbnailUrl: row.lesson_thumbnail_url,
        hasVideo: Boolean(row.video_embed_url || row.video_external_id),
        durationSeconds: row.duration_seconds,
        sortOrder: row.lesson_sort_order,
        isCompleted: false,
        watchedPercent: 0,
        isAvailable: true,
      });
    }

    modules.set(row.module_id, moduleData);
  }

  return {
    certificateCode: null,
    certificateEnabled: false,
    certificateRenderStatus: null,
    completedCount: 0,
    course: {
      id: firstRow.course_id,
      slug: firstRow.course_slug,
      title: firstRow.course_title,
      subtitle: firstRow.course_subtitle,
      description: firstRow.course_description,
      workloadHours: firstRow.workload_hours,
      thumbnailUrl: firstRow.thumbnail_url,
      expiresAt: new Date(),
    },
    isPreview: true,
    modules: [...modules.values()].sort((a, b) => a.sortOrder - b.sortOrder),
    nextLessonId: lessonIds[0] ?? null,
    progressPercent: 0,
    totalCount: lessonIds.length,
  };
};

export const getStudentCourseOverview = async ({
  courseId,
  viewer,
}: {
  courseId: string;
  viewer: StudentExperienceViewer;
}): Promise<StudentCourseOverviewData | null> => {
  if (isPreviewRole(viewer.role)) {
    return await getPreviewCourseOverview({ courseId });
  }

  return await getEnrolledCourseOverview({
    courseId,
    userId: viewer.userId,
  });
};

export const getPublishedFaqItems = async (): Promise<FaqItem[]> => {
  const { rows } = await getPool().query<{
    answer: string;
    id: string;
    question: string;
  }>(
    `
      select id, question, answer
      from faq_items
      where is_published = true
      order by sort_order asc, question asc
    `
  );

  return rows.map((row) => ({
    answer: row.answer,
    id: row.id,
    question: row.question,
  }));
};

const getEnrolledLessonWorkspace = async ({
  userId,
  lessonId,
}: {
  userId: string;
  lessonId: string;
}): Promise<StudentLessonData | null> => {
  const canAccessLesson = await resolveLessonAccess({ lessonId, userId });

  if (!canAccessLesson) {
    return null;
  }

  const { rows } = await getPool().query<LessonRow>(
    `
      with target_course as (
        select l.course_publication_id
        from lessons l
        where l.id = $2
      )
      select
        c.id as course_id,
        c.title as course_title,
        m.id as module_id,
        m.title as module_title,
        m.sort_order as module_sort_order,
        l.id as lesson_id,
        l.title as lesson_title,
        l.description as lesson_description,
        l.content_json,
        l.duration_seconds,
        l.video_duration_seconds,
        l.sort_order as lesson_sort_order,
        l.video_embed_url,
        l.video_external_id,
        l.video_provider,
        l.is_required,
        lp.completed_at,
        lwp.current_seconds as watch_current_seconds,
        lwp.duration_seconds as watch_duration_seconds,
        lwp.max_position_seconds as watch_max_position_seconds,
        lwp.watched_percent as watch_percent
      from target_course tc
      join course_publications cp on cp.id = tc.course_publication_id and cp.status = 'published'
      join enrollments e on e.course_id = cp.course_id and e.user_id = $1
      join courses c on c.id = e.course_id
      join modules m on m.course_publication_id = cp.id and m.status = 'active'
      join lessons l on l.module_id = m.id
        and l.course_publication_id = cp.id
        and l.status = 'active'
      left join lateral (
        select min(lp.completed_at) as completed_at
        from lesson_progress lp
        join lessons completed_lesson on completed_lesson.id = lp.lesson_id
        where lp.user_id = e.user_id
          and completed_lesson.curriculum_key = l.curriculum_key
      ) lp on true
      left join lesson_watch_progress lwp on lwp.lesson_id = l.id and lwp.user_id = e.user_id
      where e.status = 'active'
        and e.starts_at <= now()
        and e.expires_at >= now()
        and c.status = 'active'
      order by m.sort_order asc, l.sort_order asc
    `,
    [userId, lessonId]
  );

  if (rows.length === 0) {
    return null;
  }

  const lessonIds = rows.map((row) => row.lesson_id);
  const completedLessonIds = rows
    .filter((row) => row.completed_at)
    .map((row) => row.lesson_id);
  const requiredLessonIds = rows
    .filter((row) => row.is_required !== false)
    .map((row) => row.lesson_id);

  if (!isLessonAvailable({ lessonIds, completedLessonIds, lessonId })) {
    return null;
  }

  const activeLesson = rows.find((row) => row.lesson_id === lessonId);

  if (!activeLesson) {
    return null;
  }

  const lessonIndex = lessonIds.indexOf(lessonId);
  const progress = calculateCourseProgress({
    lessonIds,
    requiredLessonIds,
    completedLessonIds,
  });
  const video = await resolveStudentLessonVideo(activeLesson);

  return {
    course: {
      id: activeLesson.course_id,
      title: activeLesson.course_title,
    },
    isPreview: false,
    lesson: {
      contentJson: parseLessonContent(activeLesson.content_json),
      id: activeLesson.lesson_id,
      title: activeLesson.lesson_title,
      description: activeLesson.lesson_description,
      durationSeconds: activeLesson.duration_seconds,
      videoDurationSeconds: activeLesson.video_duration_seconds,
      isCompleted: Boolean(activeLesson.completed_at),
      watchProgress:
        activeLesson.watch_percent === null
          ? null
          : {
              currentSeconds: activeLesson.watch_current_seconds ?? 0,
              durationSeconds: activeLesson.watch_duration_seconds ?? 0,
              maxPositionSeconds: activeLesson.watch_max_position_seconds ?? 0,
              watchedPercent: activeLesson.watch_percent,
            },
      videoEmbedUrl: video.embedUrl,
      videoExternalId: activeLesson.video_external_id,
      videoProcessingState: video.processingState,
      videoProvider: activeLesson.video_provider,
    },
    modules: mapModules(rows),
    progressPercent: progress.percent,
    nextLessonId: lessonIds[lessonIndex + 1] ?? null,
    previousLessonId: lessonIds[lessonIndex - 1] ?? null,
  };
};

const getPreviewLessonWorkspace = async ({
  lessonId,
}: {
  lessonId: string;
}): Promise<StudentLessonData | null> => {
  const { rows } = await getPool().query<LessonRow>(
    `
      with target_course as (
        select l.course_publication_id
        from lessons l
        where l.id = $1
      )
      select
        c.id as course_id,
        c.title as course_title,
        m.id as module_id,
        m.title as module_title,
        m.sort_order as module_sort_order,
        l.id as lesson_id,
        l.title as lesson_title,
        l.description as lesson_description,
        l.content_json,
        l.duration_seconds,
        l.video_duration_seconds,
        l.sort_order as lesson_sort_order,
        l.video_embed_url,
        l.video_external_id,
        l.video_provider,
        l.is_required,
        null::timestamp as completed_at,
        null::integer as watch_current_seconds,
        null::integer as watch_duration_seconds,
        null::integer as watch_max_position_seconds,
        null::integer as watch_percent
      from target_course tc
      join course_publications cp on cp.id = tc.course_publication_id
      join courses c on c.id = cp.course_id
      join modules m on m.course_publication_id = cp.id
      join lessons l on l.module_id = m.id and l.course_publication_id = cp.id
      order by m.sort_order asc, l.sort_order asc
    `,
    [lessonId]
  );

  if (rows.length === 0) {
    return null;
  }

  const activeLesson = rows.find((row) => row.lesson_id === lessonId);

  if (!activeLesson) {
    return null;
  }

  const lessonIds = rows.map((row) => row.lesson_id);
  const lessonIndex = lessonIds.indexOf(lessonId);
  const video = await resolveStudentLessonVideo(activeLesson);

  return {
    course: {
      id: activeLesson.course_id,
      title: activeLesson.course_title,
    },
    isPreview: true,
    lesson: {
      contentJson: parseLessonContent(activeLesson.content_json),
      id: activeLesson.lesson_id,
      title: activeLesson.lesson_title,
      description: activeLesson.lesson_description,
      durationSeconds: activeLesson.duration_seconds,
      videoDurationSeconds: activeLesson.video_duration_seconds,
      isCompleted: false,
      watchProgress: null,
      videoEmbedUrl: video.embedUrl,
      videoExternalId: activeLesson.video_external_id,
      videoProcessingState: video.processingState,
      videoProvider: activeLesson.video_provider,
    },
    modules: mapModules(
      rows.map((row) => ({
        ...row,
        completed_at: null,
      }))
    ).map((moduleData) => ({
      ...moduleData,
      lessons: moduleData.lessons.map((lesson) => ({
        ...lesson,
        isAvailable: true,
      })),
    })),
    progressPercent: 0,
    nextLessonId: lessonIds[lessonIndex + 1] ?? null,
    previousLessonId: lessonIds[lessonIndex - 1] ?? null,
  };
};

export const getStudentLessonWorkspace = async ({
  lessonId,
  viewer,
}: {
  lessonId: string;
  viewer: StudentExperienceViewer;
}): Promise<StudentLessonData | null> => {
  if (isPreviewRole(viewer.role)) {
    return await getPreviewLessonWorkspace({ lessonId });
  }

  return await getEnrolledLessonWorkspace({
    lessonId,
    userId: viewer.userId,
  });
};

const resolveStudentLessonVideo = async (
  lesson: Pick<
    LessonRow,
    "lesson_id" | "video_embed_url" | "video_external_id" | "video_provider"
  >
): Promise<{
  embedUrl: null | string;
  processingState: "failed" | "processing" | null;
}> => {
  if (
    lesson.video_embed_url ||
    lesson.video_provider !== "jmvstream" ||
    !lesson.video_external_id
  ) {
    return { embedUrl: lesson.video_embed_url, processingState: null };
  }

  try {
    const sync = await syncJmvstreamLessonPlayer(lesson.lesson_id);
    if (sync.playerUrl) {
      return { embedUrl: sync.playerUrl, processingState: null };
    }

    const assets = await getJmvstreamAssetsForLesson(lesson.lesson_id);
    return {
      embedUrl: null,
      processingState: assets.some((asset) => asset.uploadStatus === "failed")
        ? "failed"
        : "processing",
    };
  } catch {
    return { embedUrl: lesson.video_embed_url, processingState: "processing" };
  }
};

export const completeLesson = async ({
  userId,
  lessonId,
}: {
  userId: string;
  lessonId: string;
}): Promise<{
  certificateIssued: boolean;
  courseId: string;
  nextLessonId: string | null;
}> => {
  const data = await getEnrolledLessonWorkspace({ userId, lessonId });

  if (!data) {
    throw new Error("Aula indisponivel para esta matricula.");
  }

  const client = await getPool().connect();

  try {
    await client.query("begin");
    const progressInsert = await client.query(
      `
        insert into lesson_progress (user_id, lesson_id)
        values ($1, $2)
        on conflict (user_id, lesson_id) do nothing
      `,
      [userId, lessonId]
    );

    const { rows } = await client.query<{
      course_publication_id: string;
      total_lessons: number;
      completed_lessons: number;
      certificate_id: string | null;
      student_name: string;
      course_title: string;
      workload_hours: number;
    }>(
      `
        select
          count(l.id) filter (where l.is_required)::int as total_lessons,
          count(*) filter (where l.is_required and lp.completed_at is not null)::int as completed_lessons,
          max(cp.id::text) as course_publication_id,
          max(cert.id::text) as certificate_id,
          max(u.name) as student_name,
          max(cp.title_snapshot) as course_title,
          max(cp.workload_hours_snapshot)::int as workload_hours
        from courses c
        join enrollments e on e.course_id = c.id and e.user_id = $1
        join course_publications cp on cp.course_id = c.id and cp.status = 'published'
        join users u on u.id = e.user_id
        join modules m on m.course_publication_id = cp.id and m.status = 'active'
        join lessons l on l.module_id = m.id
          and l.course_publication_id = cp.id
          and l.status = 'active'
        left join lateral (
          select min(lp.completed_at) as completed_at
          from lesson_progress lp
          join lessons completed_lesson on completed_lesson.id = lp.lesson_id
          where lp.user_id = e.user_id
            and completed_lesson.curriculum_key = l.curriculum_key
        ) lp on true
        left join certificates cert on cert.user_id = e.user_id
          and cert.course_id = c.id
        where c.id = $2
        group by c.id
      `,
      [userId, data.course.id]
    );

    const summary = rows[0];
    const certificateIssued = summary
      ? await issueCompletionCertificateIfEligible({
          client,
          courseId: data.course.id,
          coursePublicationId: summary.course_publication_id,
          summary: {
            certificateId: summary.certificate_id,
            completedLessons: summary.completed_lessons,
            courseTitle: summary.course_title,
            studentName: summary.student_name,
            totalLessons: summary.total_lessons,
            workloadHours: summary.workload_hours,
          } satisfies CompletionCertificateSummary,
          userId,
        })
      : false;

    await client.query("commit");

    if (progressInsert.rowCount) {
      await recordLearningAnalyticsEvent({
        eventType: "lesson_completed",
        idempotencyKey: `lesson_completed/${userId}/${lessonId}/v1`,
        lessonId,
        userId,
      }).catch(() => undefined);
    }

    return {
      certificateIssued,
      courseId: data.course.id,
      nextLessonId: data.nextLessonId,
    };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
};

export const recordLessonWatchProgress = async ({
  currentSeconds,
  durationSeconds,
  eventName,
  lessonId,
  userId,
}: {
  currentSeconds: number;
  durationSeconds: number;
  eventName: string;
  lessonId: string;
  userId: string;
}): Promise<{
  completed: boolean;
  courseId: string;
  nextLessonId: string | null;
  watchedPercent: number;
}> => {
  if (!(lessonId && eventName)) {
    throw new Error("Evento de aula invalido.");
  }

  if (
    !(Number.isFinite(currentSeconds) && Number.isFinite(durationSeconds)) ||
    currentSeconds < 0 ||
    durationSeconds <= 0 ||
    durationSeconds > MAX_LESSON_DURATION_SECONDS
  ) {
    throw new Error("Progresso de video invalido.");
  }

  const data = await getEnrolledLessonWorkspace({ userId, lessonId });

  if (!data) {
    throw new Error("Aula indisponivel para esta matricula.");
  }

  if (data.lesson.videoProvider !== "jmvstream") {
    return {
      completed: data.lesson.isCompleted,
      courseId: data.course.id,
      nextLessonId: data.nextLessonId,
      watchedPercent: data.lesson.watchProgress?.watchedPercent ?? 0,
    };
  }

  const roundedCurrentSeconds = Math.max(0, Math.round(currentSeconds));
  const roundedDurationSeconds = Math.max(1, Math.round(durationSeconds));
  const { rows } = await getPool().query<LessonWatchProgressRow>(
    `
      select
        current_seconds,
        duration_seconds,
        max_position_seconds,
        watched_percent
      from lesson_watch_progress
      where user_id = $1 and lesson_id = $2
      limit 1
    `,
    [userId, lessonId]
  );
  const previousProgress = rows[0];
  const { maxPositionSeconds, watchedPercent } = calculateVideoPositionProgress(
    {
      currentSeconds: roundedCurrentSeconds,
      durationSeconds: roundedDurationSeconds,
      previousMaxPositionSeconds: previousProgress?.max_position_seconds ?? 0,
    }
  );
  const shouldCompleteByVideo = shouldCompleteLessonFromJmvstreamEvent({
    eventName,
    watchedPercent,
  });

  await getPool().query(
    `
      insert into lesson_watch_progress (
        user_id,
        lesson_id,
        current_seconds,
        max_position_seconds,
        duration_seconds,
        watched_percent,
        last_event_name,
        last_event_at,
        completed_by_video_at
      )
      values ($1, $2, $3, $4, $5, $6, $7, now(), case when $8 then now() else null end)
      on conflict (user_id, lesson_id) do update set
        current_seconds = excluded.current_seconds,
        max_position_seconds = greatest(lesson_watch_progress.max_position_seconds, excluded.max_position_seconds),
        duration_seconds = excluded.duration_seconds,
        watched_percent = greatest(lesson_watch_progress.watched_percent, excluded.watched_percent),
        last_event_name = excluded.last_event_name,
        last_event_at = now(),
        completed_by_video_at = case
          when excluded.completed_by_video_at is not null then coalesce(lesson_watch_progress.completed_by_video_at, excluded.completed_by_video_at)
          else lesson_watch_progress.completed_by_video_at
        end,
        updated_at = now()
    `,
    [
      userId,
      lessonId,
      roundedCurrentSeconds,
      maxPositionSeconds,
      roundedDurationSeconds,
      watchedPercent,
      eventName,
      shouldCompleteByVideo,
    ]
  );

  const checkpointPercent = getWatchCheckpointPercent({
    previousPercent: previousProgress?.watched_percent ?? 0,
    watchedPercent,
  });
  const eventType = previousProgress ? "watch_checkpoint" : "lesson_started";
  let analyticsKey: string | null = null;
  if (eventType === "lesson_started") {
    analyticsKey = `lesson_started/${userId}/${lessonId}/v1`;
  } else if (checkpointPercent !== null) {
    analyticsKey = `watch_checkpoint/${userId}/${lessonId}/${checkpointPercent}/v1`;
  }
  if (analyticsKey) {
    await recordLearningAnalyticsEvent({
      ...(checkpointPercent === null ? {} : { checkpointPercent }),
      eventType,
      idempotencyKey: analyticsKey,
      lessonId,
      userId,
    }).catch(() => undefined);
  }

  if (!(shouldCompleteByVideo || data.lesson.isCompleted)) {
    return {
      completed: false,
      courseId: data.course.id,
      nextLessonId: data.nextLessonId,
      watchedPercent,
    };
  }

  const result = data.lesson.isCompleted
    ? {
        courseId: data.course.id,
        nextLessonId: data.nextLessonId,
      }
    : await completeLesson({ userId, lessonId });

  return {
    completed: true,
    courseId: result.courseId,
    nextLessonId: result.nextLessonId,
    watchedPercent,
  };
};
