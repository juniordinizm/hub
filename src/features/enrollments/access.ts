import "server-only";
import { getPool } from "@/db";

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
  userId,
}: {
  lessonId: string;
  userId: string;
}): Promise<boolean> => {
  const { rows } = await getPool().query<{ id: string }>(
    `
      select e.id
      from lessons l
      join modules m on m.id = l.module_id
      join courses c on c.id = m.course_id
      join enrollments e on e.course_id = c.id
      where l.id = $2
        and e.user_id = $1
        and e.status = 'active'
        and e.starts_at <= now()
        and e.expires_at >= now()
        and c.status = 'active'
        and m.status = 'active'
        and l.status = 'active'
      limit 1
    `,
    [userId, lessonId]
  );

  return Boolean(rows[0]);
};
