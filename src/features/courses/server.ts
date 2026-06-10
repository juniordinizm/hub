import "server-only";
import { randomUUID } from "node:crypto";
import { getPool } from "@/db";
import { createCertificateCode } from "@/features/certificates/rules";
import { sendCertificateIssuedEmail } from "@/features/email/server";
import {
  calculateCourseProgress,
  getNextAvailableLessonId,
  isLessonAvailable,
} from "@/features/progress/rules";

export interface StudentCourseCard {
  completedCount: number;
  courseId: string;
  expiresAt: Date;
  nextLessonId: string | null;
  progressPercent: number;
  slug: string;
  subtitle: string | null;
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
    durationMinutes: number;
    sortOrder: number;
    isCompleted: boolean;
    isAvailable: boolean;
  }>;
  sortOrder: number;
  title: string;
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
    durationMinutes: number;
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
  duration_minutes: number;
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
      durationMinutes: row.duration_minutes,
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
    course_id: string;
    slug: string;
    title: string;
    subtitle: string | null;
    expires_at: Date;
    lesson_id: string | null;
    completed_at: Date | null;
  }>(
    `
      select
        c.id as course_id,
        c.slug,
        c.title,
        c.subtitle,
        e.expires_at,
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

  const byCourse = new Map<
    string,
    StudentCourseCard & { lessonIds: string[]; completedLessonIds: string[] }
  >();

  for (const row of rows) {
    const course = byCourse.get(row.course_id) ?? {
      courseId: row.course_id,
      slug: row.slug,
      title: row.title,
      subtitle: row.subtitle,
      expiresAt: row.expires_at,
      progressPercent: 0,
      completedCount: 0,
      totalCount: 0,
      nextLessonId: null,
      lessonIds: [],
      completedLessonIds: [],
    };

    if (row.lesson_id) {
      course.lessonIds.push(row.lesson_id);
      if (row.completed_at) {
        course.completedLessonIds.push(row.lesson_id);
      }
    }

    byCourse.set(row.course_id, course);
  }

  return [...byCourse.values()].map((course) => {
    const progress = calculateCourseProgress(course);
    return {
      courseId: course.courseId,
      slug: course.slug,
      title: course.title,
      subtitle: course.subtitle,
      expiresAt: course.expiresAt,
      progressPercent: progress.percent,
      completedCount: progress.completedCount,
      totalCount: progress.totalCount,
      nextLessonId: getNextAvailableLessonId(course),
    };
  });
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
        l.duration_minutes,
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
      durationMinutes: activeLesson.duration_minutes,
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
}): Promise<{ nextLessonId: string | null; certificateIssued: boolean }> => {
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
      nextLessonId: data.nextLessonId,
      certificateIssued,
    };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
};
