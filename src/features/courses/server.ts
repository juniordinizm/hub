import "server-only";
import { randomUUID } from "node:crypto";
import { getPool } from "@/db";
import { createCertificateCode } from "@/features/certificates/rules";
import { deriveCourseWorkloadHours } from "@/features/courses/presentation";
import { sendCertificateIssuedEmail } from "@/features/email/server";
import {
  calculateCourseProgress,
  getNextAvailableLessonId,
  isLessonAvailable,
} from "@/features/progress/rules";
import { shouldApplyDetectedDuration } from "@/features/videos/jmvstream";

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
  supportWhatsappUrl: string | null;
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
    supportWhatsappUrl: string | null;
    thumbnailUrl: string | null;
    title: string;
    workloadHours: number;
  };
  modules: Array<{
    color: string;
    description: string | null;
    id: string;
    lessons: Array<{
      durationSeconds: number;
      id: string;
      isAvailable: boolean;
      isCompleted: boolean;
      lessonType: string;
      sortOrder: number;
      title: string;
    }>;
    sortOrder: number;
    title: string;
  }>;
  nextLessonId: string | null;
  progressPercent: number;
  totalCount: number;
}

export interface StudentLessonData {
  course: {
    id: string;
    title: string;
    supportWhatsappUrl: string | null;
  };
  lesson: {
    id: string;
    title: string;
    description: string | null;
    durationSeconds: number;
    isCompleted: boolean;
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
  support_whatsapp_url: string | null;
  video_embed_url: string | null;
  video_provider: string | null;
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
  lesson_title: string | null;
  lesson_type: string | null;
  module_color: string | null;
  module_description: string | null;
  module_id: string | null;
  module_sort_order: number | null;
  module_title: string | null;
  support_whatsapp_url: string | null;
  thumbnail_url: string | null;
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
    support_whatsapp_url: string | null;
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
        coalesce(c.support_whatsapp_url, s.support_whatsapp_url) as support_whatsapp_url,
        e.expires_at,
        m.id as module_id,
        m.title as module_title,
        m.sort_order as module_sort_order,
        m.color as module_color,
        l.id as lesson_id,
        lp.completed_at
      from enrollments e
      join courses c on c.id = e.course_id
      left join app_settings s on s.id = 'global'
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
      supportWhatsappUrl: row.support_whatsapp_url,
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
      supportWhatsappUrl: course.supportWhatsappUrl,
      expiresAt: course.expiresAt,
      modules,
      progressPercent: progress.percent,
      completedCount: progress.completedCount,
      totalCount: progress.totalCount,
      nextLessonId: getNextAvailableLessonId(course),
    };
  });
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
        coalesce(c.support_whatsapp_url, s.support_whatsapp_url) as support_whatsapp_url,
        e.expires_at,
        cert.code as certificate_code,
        m.id as module_id,
        m.title as module_title,
        m.description as module_description,
        m.sort_order as module_sort_order,
        m.color as module_color,
        l.id as lesson_id,
        l.title as lesson_title,
        l.lesson_type,
        l.duration_seconds,
        l.sort_order as lesson_sort_order,
        lp.completed_at
      from enrollments e
      join courses c on c.id = e.course_id
      left join app_settings s on s.id = 'global'
      left join certificates cert on cert.course_id = c.id and cert.user_id = e.user_id
      left join modules m on m.course_id = c.id
      left join lessons l on l.module_id = m.id and l.is_published = true
      left join lesson_progress lp on lp.lesson_id = l.id and lp.user_id = e.user_id
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
        lessonType: row.lesson_type ?? "video",
        durationSeconds: row.duration_seconds,
        sortOrder: row.lesson_sort_order,
        isCompleted: Boolean(row.completed_at),
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
      supportWhatsappUrl: firstRow.support_whatsapp_url,
      expiresAt: firstRow.expires_at,
    },
    modules: [...modules.values()].sort((a, b) => a.sortOrder - b.sortOrder),
    nextLessonId: getNextAvailableLessonId({ lessonIds, completedLessonIds }),
    progressPercent: progress.percent,
    totalCount: progress.totalCount,
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

export const getSupportWhatsappUrl = async (): Promise<string | null> => {
  const { rows } = await getPool().query<{
    support_whatsapp_url: string | null;
  }>(
    `
      select support_whatsapp_url
      from app_settings
      where id = 'global'
      limit 1
    `
  );

  return rows[0]?.support_whatsapp_url ?? null;
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
        coalesce(c.support_whatsapp_url, s.support_whatsapp_url) as support_whatsapp_url,
        m.id as module_id,
        m.title as module_title,
        m.sort_order as module_sort_order,
        m.color as module_color,
        l.id as lesson_id,
        l.title as lesson_title,
        l.description as lesson_description,
        l.duration_seconds,
        l.sort_order as lesson_sort_order,
        l.video_embed_url,
        l.video_provider,
        lp.completed_at
      from target_course tc
      join enrollments e on e.course_id = tc.course_id and e.user_id = $1
      join courses c on c.id = e.course_id
      left join app_settings s on s.id = 'global'
      join modules m on m.course_id = c.id
      join lessons l on l.module_id = m.id and l.is_published = true
      left join lesson_progress lp on lp.lesson_id = l.id and lp.user_id = e.user_id
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

  return {
    course: {
      id: activeLesson.course_id,
      title: activeLesson.course_title,
      supportWhatsappUrl: activeLesson.support_whatsapp_url,
    },
    lesson: {
      id: activeLesson.lesson_id,
      title: activeLesson.lesson_title,
      description: activeLesson.lesson_description,
      durationSeconds: activeLesson.duration_seconds,
      isCompleted: Boolean(activeLesson.completed_at),
      videoEmbedUrl: activeLesson.video_embed_url,
      videoProvider: activeLesson.video_provider,
    },
    modules: mapModules(rows),
    progressPercent: progress.percent,
    nextLessonId: lessonIds[lessonIndex + 1] ?? null,
    previousLessonId: lessonIds[lessonIndex - 1] ?? null,
  };
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

  if (!data || data.lesson.videoProvider !== "jmvstream") {
    return;
  }

  const roundedDurationSeconds = Math.round(durationSeconds);

  if (
    !shouldApplyDetectedDuration({
      currentSeconds: data.lesson.durationSeconds,
      detectedSeconds: roundedDurationSeconds,
      userEdited: false,
    })
  ) {
    return;
  }

  await getPool().query(
    `
      update lessons
      set duration_seconds = $1,
          updated_at = now()
      where id = $2
    `,
    [roundedDurationSeconds, lessonId]
  );
  await recalculateCourseWorkloadHours(data.course.id);
};
