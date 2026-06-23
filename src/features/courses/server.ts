import "server-only";
import { randomUUID } from "node:crypto";
import { getPool } from "@/db";
import { createCertificateCode } from "@/features/certificates/rules";
import {
  type LessonContent,
  parseLessonContent,
} from "@/features/courses/lesson-content";
import { deriveCourseWorkloadHours } from "@/features/courses/presentation";
import { sendCertificateIssuedEmail } from "@/features/email/server";
import { syncJmvstreamLessonPlayer } from "@/features/jmvstream/server";
import {
  calculateCourseProgress,
  calculateVideoPositionProgress,
  getNextAvailableLessonId,
  isLessonAvailable,
} from "@/features/progress/rules";
import {
  shouldApplyDetectedDuration,
  shouldCompleteLessonFromJmvstreamEvent,
} from "@/features/videos/jmvstream";

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
  workloadHours: number;
}

export interface StudentCourseModule {
  color: string;
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
  category: string;
  id: string;
  question: string;
}

export interface ModuleWithLessons {
  color: string;
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
    color: string;
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
  lesson_description: string | null;
  lesson_id: string;
  lesson_sort_order: number;
  lesson_title: string;
  module_color: string;
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
};

type StudentCourseAggregate = StudentCourseCard & {
  completedLessonIds: string[];
  lessonIds: string[];
  modulesById: Map<string, StudentCourseModuleAggregate>;
};

type StudentCatalogCourseAggregate = StudentCatalogCourseCard & {
  completedLessonIds: string[];
  lessonIds: string[];
};

interface CourseOverviewRow {
  certificate_code: string | null;
  completed_at: Date | null;
  course_description: string | null;
  course_id: string;
  course_slug: string;
  course_subtitle: string | null;
  course_title: string;
  duration_seconds: number | null;
  expires_at: Date;
  lesson_id: string | null;
  lesson_sort_order: number | null;
  lesson_thumbnail_url: string | null;
  lesson_title: string | null;
  module_color: string | null;
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
  module_color: string | null;
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
      color: row.module_color,
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
): Promise<StudentCourseCard[]> => {
  const { rows } = await getPool().query<{
    completed_at: Date | null;
    course_description: string | null;
    course_id: string;
    expires_at: Date;
    lesson_id: string | null;
    module_color: string | null;
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
        c.title,
        c.subtitle,
        c.description as course_description,
        c.workload_hours,
        c.thumbnail_url,
        e.expires_at,
        m.id as module_id,
        m.title as module_title,
        m.sort_order as module_sort_order,
        m.color as module_color,
        l.id as lesson_id,
        lp.completed_at
      from enrollments e
      join courses c on c.id = e.course_id
      left join modules m on m.course_id = c.id
      left join lessons l on l.module_id = m.id and l.is_published = true
      left join lesson_progress lp on lp.lesson_id = l.id and lp.user_id = e.user_id
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
      modulesById: new Map<string, StudentCourseModuleAggregate>(),
    };

    if (row.lesson_id) {
      course.lessonIds.push(row.lesson_id);
      if (row.completed_at) {
        course.completedLessonIds.push(row.lesson_id);
      }
    }

    if (row.module_id && row.module_sort_order && row.module_title) {
      const moduleData = course.modulesById.get(row.module_id) ?? {
        id: row.module_id,
        title: row.module_title,
        sortOrder: row.module_sort_order,
        color: row.module_color ?? "#326c71",
        totalCount: 0,
        completedCount: 0,
        progressPercent: 0,
        nextLessonId: null,
        lessonIds: [],
        completedLessonIds: [],
      };

      if (row.lesson_id) {
        moduleData.lessonIds.push(row.lesson_id);
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
          color: moduleData.color,
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
    course_description: string | null;
    course_id: string;
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
        lp.completed_at
      from courses c
      left join enrollments e on e.course_id = c.id
        and e.user_id = $1
      left join modules m on m.course_id = c.id
      left join lessons l on l.module_id = m.id and l.is_published = true
      left join lesson_progress lp on lp.lesson_id = l.id and lp.user_id = $1
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
      thumbnailUrl: row.thumbnail_url,
      expiresAt: row.expires_at,
      isEnrolled: row.is_enrolled,
      accessStatus: row.access_status,
      revokedReason: row.revoked_reason,
      progressPercent: 0,
      completedCount: 0,
      totalCount: 0,
      nextLessonId: null,
      lessonIds: [],
      completedLessonIds: [],
    };

    if (row.lesson_id) {
      course.lessonIds.push(row.lesson_id);
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
      thumbnailUrl: course.thumbnailUrl,
      expiresAt: course.expiresAt,
      isEnrolled: course.isEnrolled,
      accessStatus: course.accessStatus,
      revokedReason: course.revokedReason,
      progressPercent: progress.percent,
      completedCount: progress.completedCount,
      totalCount: progress.totalCount,
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
  const { rows } = await getPool().query<{ id: string }>(
    `
      select e.id
      from enrollments e
      join courses c on c.id = e.course_id
      where e.user_id = $1
        and e.course_id = $2
        and e.status = 'active'
        and e.starts_at <= now()
        and e.expires_at >= now()
        and c.status = 'active'
      limit 1
    `,
    [userId, courseId]
  );

  return {
    canAccess: Boolean(rows[0]),
    redirectTo: `/app/cursos/${courseId}`,
  };
};

export const recalculateCourseWorkloadHours = async (
  courseId: string
): Promise<number> => {
  const { rows } = await getPool().query<{ duration_seconds: number }>(
    `
      select l.duration_seconds
      from lessons l
      join modules m on m.id = l.module_id
      where m.course_id = $1
    `,
    [courseId]
  );
  const workloadHours = deriveCourseWorkloadHours(
    rows.map((row) => row.duration_seconds)
  );

  await getPool().query(
    `
      update courses
      set workload_hours = $1,
          updated_at = now()
      where id = $2
    `,
    [workloadHours, courseId]
  );

  return workloadHours;
};

export const getStudentCourseOverviewData = async ({
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
        c.title as course_title,
        c.subtitle as course_subtitle,
        c.description as course_description,
        c.workload_hours,
        c.thumbnail_url,
        e.expires_at,
        cert.code as certificate_code,
        m.id as module_id,
        m.title as module_title,
        m.description as module_description,
        m.sort_order as module_sort_order,
        m.color as module_color,
        l.id as lesson_id,
        l.title as lesson_title,
        l.thumbnail_url as lesson_thumbnail_url,
        l.video_embed_url,
        l.video_external_id,
        l.duration_seconds,
        l.video_duration_seconds,
        l.sort_order as lesson_sort_order,
        lp.completed_at,
        lwp.watched_percent
      from enrollments e
      join courses c on c.id = e.course_id
      left join certificates cert on cert.course_id = c.id and cert.user_id = e.user_id
      left join modules m on m.course_id = c.id
      left join lessons l on l.module_id = m.id and l.is_published = true
      left join lesson_progress lp on lp.lesson_id = l.id and lp.user_id = e.user_id
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
  const progress = calculateCourseProgress({ lessonIds, completedLessonIds });
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
      color: row.module_color ?? "#326c71",
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

export const getCoursePreviewOverviewData = async ({
  courseId,
}: {
  courseId: string;
}): Promise<StudentCourseOverviewData | null> => {
  const { rows } = await getPool().query<CoursePreviewOverviewRow>(
    `
      select
        c.id as course_id,
        c.slug as course_slug,
        c.title as course_title,
        c.subtitle as course_subtitle,
        c.description as course_description,
        c.workload_hours,
        c.thumbnail_url,
        m.id as module_id,
        m.title as module_title,
        m.description as module_description,
        m.sort_order as module_sort_order,
        m.color as module_color,
        l.id as lesson_id,
        l.title as lesson_title,
        l.thumbnail_url as lesson_thumbnail_url,
        l.video_embed_url,
        l.video_external_id,
        l.duration_seconds,
        l.sort_order as lesson_sort_order
      from courses c
      left join modules m on m.course_id = c.id
      left join lessons l on l.module_id = m.id
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
      color: row.module_color ?? "#326c71",
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

export const getPublishedFaqItems = async (): Promise<FaqItem[]> => {
  const { rows } = await getPool().query<{
    answer: string;
    category: string;
    id: string;
    question: string;
  }>(
    `
      select id, question, answer, category
      from faq_items
      where is_published = true
      order by sort_order asc, question asc
    `
  );

  return rows.map((row) => ({
    answer: row.answer,
    category: row.category,
    id: row.id,
    question: row.question,
  }));
};

export const getStudentLessonData = async ({
  userId,
  lessonId,
}: {
  userId: string;
  lessonId: string;
}): Promise<StudentLessonData | null> => {
  const { rows } = await getPool().query<LessonRow>(
    `
      with target_course as (
        select m.course_id
        from lessons l
        join modules m on m.id = l.module_id
        where l.id = $2
      )
      select
        c.id as course_id,
        c.title as course_title,
        m.id as module_id,
        m.title as module_title,
        m.sort_order as module_sort_order,
        m.color as module_color,
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
        lp.completed_at,
        lwp.current_seconds as watch_current_seconds,
        lwp.duration_seconds as watch_duration_seconds,
        lwp.max_position_seconds as watch_max_position_seconds,
        lwp.watched_percent as watch_percent
      from target_course tc
      join enrollments e on e.course_id = tc.course_id and e.user_id = $1
      join courses c on c.id = e.course_id
      join modules m on m.course_id = c.id
      join lessons l on l.module_id = m.id and l.is_published = true
      left join lesson_progress lp on lp.lesson_id = l.id and lp.user_id = e.user_id
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

  if (!isLessonAvailable({ lessonIds, completedLessonIds, lessonId })) {
    return null;
  }

  const activeLesson = rows.find((row) => row.lesson_id === lessonId);

  if (!activeLesson) {
    return null;
  }

  const lessonIndex = lessonIds.indexOf(lessonId);
  const progress = calculateCourseProgress({ lessonIds, completedLessonIds });
  const videoEmbedUrl = await resolveStudentLessonVideoEmbedUrl(activeLesson);

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
      videoEmbedUrl,
      videoProvider: activeLesson.video_provider,
    },
    modules: mapModules(rows),
    progressPercent: progress.percent,
    nextLessonId: lessonIds[lessonIndex + 1] ?? null,
    previousLessonId: lessonIds[lessonIndex - 1] ?? null,
  };
};

export const getPreviewLessonData = async ({
  lessonId,
}: {
  lessonId: string;
}): Promise<StudentLessonData | null> => {
  const { rows } = await getPool().query<LessonRow>(
    `
      with target_course as (
        select m.course_id
        from lessons l
        join modules m on m.id = l.module_id
        where l.id = $1
      )
      select
        c.id as course_id,
        c.title as course_title,
        m.id as module_id,
        m.title as module_title,
        m.sort_order as module_sort_order,
        m.color as module_color,
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
        null::timestamp as completed_at,
        null::integer as watch_current_seconds,
        null::integer as watch_duration_seconds,
        null::integer as watch_max_position_seconds,
        null::integer as watch_percent
      from target_course tc
      join courses c on c.id = tc.course_id
      join modules m on m.course_id = c.id
      join lessons l on l.module_id = m.id
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
  const videoEmbedUrl = await resolveStudentLessonVideoEmbedUrl(activeLesson);

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
      videoEmbedUrl,
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

const resolveStudentLessonVideoEmbedUrl = async (
  lesson: Pick<
    LessonRow,
    "lesson_id" | "video_embed_url" | "video_external_id" | "video_provider"
  >
): Promise<null | string> => {
  if (
    lesson.video_embed_url ||
    lesson.video_provider !== "jmvstream" ||
    !lesson.video_external_id
  ) {
    return lesson.video_embed_url;
  }

  try {
    const sync = await syncJmvstreamLessonPlayer(lesson.lesson_id);
    return sync.playerUrl ?? lesson.video_embed_url;
  } catch {
    return lesson.video_embed_url;
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
  const data = await getStudentLessonData({ userId, lessonId });

  if (!data) {
    throw new Error("Aula indisponivel para esta matricula.");
  }

  const client = await getPool().connect();

  try {
    await client.query("begin");
    await client.query(
      `
        insert into lesson_progress (user_id, lesson_id)
        values ($1, $2)
        on conflict (user_id, lesson_id) do nothing
      `,
      [userId, lessonId]
    );

    const { rows } = await client.query<{
      total_lessons: number;
      completed_lessons: number;
      certificate_id: string | null;
      student_name: string;
      course_title: string;
      workload_hours: number;
      student_email: string;
    }>(
      `
        select
          count(l.id)::int as total_lessons,
          count(lp.id)::int as completed_lessons,
          max(cert.id::text) as certificate_id,
          max(u.name) as student_name,
          max(u.email) as student_email,
          max(c.title) as course_title,
          max(c.workload_hours)::int as workload_hours
        from courses c
        join enrollments e on e.course_id = c.id and e.user_id = $1
        join users u on u.id = e.user_id
        join modules m on m.course_id = c.id
        join lessons l on l.module_id = m.id and l.is_published = true
        left join lesson_progress lp on lp.lesson_id = l.id and lp.user_id = e.user_id
        left join certificates cert on cert.user_id = e.user_id and cert.course_id = c.id
        where c.id = $2
        group by c.id
      `,
      [userId, data.course.id]
    );

    const summary = rows[0];
    let certificateIssued = false;
    let certificateCode: string | null = null;

    if (
      summary &&
      summary.total_lessons > 0 &&
      summary.completed_lessons >= summary.total_lessons &&
      !summary.certificate_id
    ) {
      certificateCode = createCertificateCode(randomUUID());
      await client.query(
        `
          insert into certificates (
            user_id,
            course_id,
            code,
            student_name_snapshot,
            course_title_snapshot,
            workload_hours_snapshot
          )
          values ($1, $2, $3, $4, $5, $6)
          on conflict (user_id, course_id) do nothing
        `,
        [
          userId,
          data.course.id,
          certificateCode,
          summary.student_name,
          summary.course_title,
          summary.workload_hours,
        ]
      );
      certificateIssued = true;
    }

    await client.query("commit");

    if (certificateIssued && certificateCode && summary) {
      try {
        await sendCertificateIssuedEmail({
          certificateCode,
          courseTitle: summary.course_title,
          to: summary.student_email,
          userName: summary.student_name,
        });
      } catch {
        // E-mail failure must not block certificate issuance.
      }
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

  const data = await getStudentLessonData({ userId, lessonId });

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

export const syncJmvstreamLessonDuration = async ({
  durationSeconds,
  lessonId,
  userId,
}: {
  durationSeconds: number;
  lessonId: string;
  userId: string;
}): Promise<void> => {
  if (
    !Number.isFinite(durationSeconds) ||
    durationSeconds <= 0 ||
    durationSeconds > MAX_LESSON_DURATION_SECONDS
  ) {
    throw new Error("Duracao de aula invalida.");
  }

  const data = await getStudentLessonData({ userId, lessonId });

  if (data?.lesson.videoProvider !== "jmvstream") {
    return;
  }

  const roundedDurationSeconds = Math.round(durationSeconds);

  if (
    !shouldApplyDetectedDuration({
      currentSeconds: data.lesson.videoDurationSeconds,
      detectedSeconds: roundedDurationSeconds,
      userEdited: false,
    })
  ) {
    return;
  }

  await getPool().query(
    `
      update lessons
      set video_duration_seconds = $1,
          duration_seconds = $1 + coalesce(text_duration_seconds, 0),
          updated_at = now()
      where id = $2
    `,
    [roundedDurationSeconds, lessonId]
  );
  await recalculateCourseWorkloadHours(data.course.id);
};
