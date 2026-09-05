import "server-only";
import { getPool } from "@/db";
import { resolveModuleContentRelease } from "@/features/courses/module-content-release";

export type LessonAccessDecision =
  | { courseId: string; kind: "allowed" }
  | { availableAt: Date; courseId: string; kind: "time_locked" }
  | { kind: "denied" };

export const resolveCourseAccess = async ({
  courseId,
  userId,
}: {
  courseId: string;
  userId: string;
}): Promise<boolean> => {
  const { rows } = await getPool().query<{ id: string }>(
    `
      select e.id
      from enrollments e
      join courses c on c.id = e.course_id
      join course_publications cp
        on cp.course_id = c.id
       and cp.status = 'published'
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

  return Boolean(rows[0]);
};

export const resolveLessonAccess = async ({
  lessonId,
  now = new Date(),
  userId,
}: {
  lessonId: string;
  now?: Date;
  userId: string;
}): Promise<LessonAccessDecision> => {
  const { rows } = await getPool().query<{
    content_release_mode: "full_access" | "scheduled";
    content_release_started_at: Date | null;
    course_id: string;
    is_completed: boolean;
    release_delay_days: number;
    sequence_available: boolean;
  }>(
    `
      select
        c.id as course_id,
        e.content_release_mode,
        e.content_release_started_at,
        m.release_delay_days,
        exists (
          select 1
          from lesson_progress lp
          join lessons completed_lesson
            on completed_lesson.id = lp.lesson_id
           and completed_lesson.curriculum_key = l.curriculum_key
          where lp.user_id = e.user_id
        ) as is_completed
        ,not exists (
          select 1
          from lessons prior_lesson
          join modules prior_module on prior_module.id = prior_lesson.module_id
          where prior_lesson.course_publication_id = cp.id
            and prior_lesson.status = 'active'
            and prior_module.status = 'active'
            and (
              prior_module.sort_order < m.sort_order
              or (
                prior_module.sort_order = m.sort_order
                and prior_lesson.sort_order < l.sort_order
              )
            )
            and not exists (
              select 1
              from lesson_progress prior_progress
              join lessons completed_prior
                on completed_prior.id = prior_progress.lesson_id
               and completed_prior.curriculum_key = prior_lesson.curriculum_key
              where prior_progress.user_id = e.user_id
            )
        ) as sequence_available
      from lessons l
      join modules m on m.id = l.module_id
      join courses c on c.id = m.course_id
      join course_publications cp
        on cp.id = l.course_publication_id
       and cp.status = 'published'
      join enrollments e on e.course_id = c.id
      where l.id = $2
        and e.user_id = $1
        and e.status = 'active'
        and e.starts_at <= now()
        and e.expires_at >= now()
        and c.status = 'active'
        and m.status = 'active'
        and l.status = 'active'
        and m.course_publication_id = cp.id
      limit 1
    `,
    [userId, lessonId]
  );

  const row = rows[0];
  if (!row) {
    return { kind: "denied" };
  }
  if (row.is_completed) {
    return { courseId: row.course_id, kind: "allowed" };
  }

  try {
    const release = resolveModuleContentRelease({
      contentReleaseMode: row.content_release_mode,
      contentReleaseStartedAt: row.content_release_started_at,
      now,
      releaseDelayDays: row.release_delay_days,
    });
    if (release.kind === "time_locked") {
      return {
        availableAt: release.availableAt,
        courseId: row.course_id,
        kind: "time_locked",
      };
    }
    return row.sequence_available
      ? { courseId: row.course_id, kind: "allowed" }
      : { kind: "denied" };
  } catch {
    return { kind: "denied" };
  }
};
