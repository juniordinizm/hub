import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { MILLISECONDS_PER_DAY } from "./module-content-release";

const FUTURE_RELEASE_DELAY_DAYS = 8;
const ACCESS_DURATION_DAYS = 365;

export interface ContentReleaseFixture {
  courseId: string;
  expiresAt: Date;
  futureAvailableAt: Date;
  futureLessonId: string;
  immediateLessonId: string;
  userId: string;
}

export interface ContentReleaseFixtureRegistry {
  courseIds: Set<string>;
  userIds: Set<string>;
}

export const createContentReleaseFixtureRegistry =
  (): ContentReleaseFixtureRegistry => ({
    courseIds: new Set<string>(),
    userIds: new Set<string>(),
  });

export const cleanupContentReleaseFixtures = async ({
  pool,
  registry,
}: {
  pool: Pool;
  registry: ContentReleaseFixtureRegistry;
}): Promise<void> => {
  for (const courseId of registry.courseIds) {
    await pool.query("delete from courses where id = $1", [courseId]);
  }
  for (const userId of registry.userIds) {
    await pool.query("delete from audit_logs where actor_user_id = $1", [
      userId,
    ]);
    await pool.query("delete from users where id = $1", [userId]);
  }
  registry.courseIds.clear();
  registry.userIds.clear();
};

export const createContentReleaseFixture = async ({
  now,
  pool,
  registry,
}: {
  now: Date;
  pool: Pool;
  registry: ContentReleaseFixtureRegistry;
}): Promise<ContentReleaseFixture> => {
  const courseId = randomUUID();
  const publicationId = randomUUID();
  const immediateModuleId = randomUUID();
  const futureModuleId = randomUUID();
  const immediateLessonId = randomUUID();
  const futureLessonId = randomUUID();
  const userId = `content-release-${randomUUID()}`;
  const futureAvailableAt = new Date(
    now.getTime() + FUTURE_RELEASE_DELAY_DAYS * MILLISECONDS_PER_DAY
  );
  const expiresAt = new Date(
    now.getTime() + ACCESS_DURATION_DAYS * MILLISECONDS_PER_DAY
  );
  registry.courseIds.add(courseId);
  registry.userIds.add(userId);

  await pool.query(
    "insert into users (id, name, email, email_verified) values ($1, 'Release student', $2, true)",
    [userId, `${userId}@example.test`]
  );
  await pool.query(
    `
      insert into courses
        (id, slug, title, status, access_duration_months, certificate_enabled, catalog_visibility, sales_status)
      values ($1, $2, 'Release integration course', 'active', 12, true, 'listed', 'open')
    `,
    [courseId, `content-release-${randomUUID()}`]
  );
  await pool.query(
    `
      insert into course_publications
        (id, course_id, publication_number, status, title_snapshot, workload_hours_snapshot, published_at)
      values ($1, $2, 1, 'published', 'Release integration course', 1, now())
    `,
    [publicationId, courseId]
  );
  await pool.query(
    `
      insert into modules
        (id, course_id, course_publication_id, title, sort_order, release_delay_days, status)
      values
        ($1, $3, $4, 'Immediate module', 1, 0, 'active'),
        ($2, $3, $4, 'Future module', 2, $5, 'active')
    `,
    [
      immediateModuleId,
      futureModuleId,
      courseId,
      publicationId,
      FUTURE_RELEASE_DELAY_DAYS,
    ]
  );
  await pool.query(
    `
      insert into lessons
        (id, module_id, course_publication_id, title, sort_order, status, is_published, duration_seconds)
      values
        ($1, $3, $5, 'Immediate lesson', 1, 'active', true, 120),
        ($2, $4, $5, 'Future lesson secret', 1, 'active', true, 120)
    `,
    [
      immediateLessonId,
      futureLessonId,
      immediateModuleId,
      futureModuleId,
      publicationId,
    ]
  );
  await pool.query(
    `
      insert into enrollments
        (user_id, course_id, status, content_release_mode, content_release_started_at, starts_at, expires_at)
      values ($1, $2, 'active', 'scheduled', $3, $3, $4)
    `,
    [userId, courseId, now, expiresAt]
  );

  return {
    courseId,
    expiresAt,
    futureAvailableAt,
    futureLessonId,
    immediateLessonId,
    userId,
  };
};
