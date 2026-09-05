import type { PoolClient } from "pg";
import { MILLISECONDS_PER_DAY } from "@/features/courses/module-content-release";
import { createManualAccessGrant } from "@/features/enrollments/server";

export interface ScheduledCourseSeed {
  futureLessonId: string;
  id: string;
  immediateLessonId: string;
  slug: string;
}

export const seedScheduledCourse = async ({
  client,
  slug,
  studentId,
  suffix,
}: {
  client: PoolClient;
  slug: string;
  studentId: string;
  suffix: string;
}): Promise<ScheduledCourseSeed> => {
  const scheduledCourseResult = await client.query<{ id: string }>(
    `
      insert into courses (
        slug, title, price_in_cents, workload_hours, status,
        certificate_enabled, catalog_visibility, sales_status
      ) values ($1, 'Curso E2E programado', 1000, 2, 'active', false,
        'listed'::course_catalog_visibility, 'open'::course_sales_status)
      returning id
    `,
    [slug]
  );
  const courseId = scheduledCourseResult.rows[0]?.id;
  if (!courseId) {
    throw new Error("Could not create scheduled E2E course.");
  }

  const publicationResult = await client.query<{ id: string }>(
    `
      insert into course_publications (
        course_id, publication_number, status, title_snapshot,
        workload_hours_snapshot, published_at
      ) values ($1, 1, 'published', 'Curso E2E programado', 2, now())
      returning id
    `,
    [courseId]
  );
  const publicationId = publicationResult.rows[0]?.id;
  if (!publicationId) {
    throw new Error("Could not create scheduled E2E publication.");
  }

  const modulesResult = await client.query<{
    id: string;
    sort_order: number;
  }>(
    `
      insert into modules (
        course_id, course_publication_id, title, sort_order,
        release_delay_days, status
      ) values
        ($1, $2, 'Módulo imediato E2E', 1, 0, 'active'),
        ($1, $2, 'Módulo futuro E2E', 2, 8, 'active')
      returning id, sort_order
    `,
    [courseId, publicationId]
  );
  const immediateModuleId = modulesResult.rows.find(
    (row) => row.sort_order === 1
  )?.id;
  const delayedModuleId = modulesResult.rows.find(
    (row) => row.sort_order === 2
  )?.id;
  if (!(immediateModuleId && delayedModuleId)) {
    throw new Error("Could not create scheduled E2E modules.");
  }

  const lessonsResult = await client.query<{
    id: string;
    module_id: string;
  }>(
    `
      insert into lessons (
        module_id, course_publication_id, title, content_json,
        duration_seconds, sort_order, status, is_required
      ) values
        ($1, $3, 'Aula imediata E2E', '{"type":"text","document":{"type":"doc","content":[]}}'::jsonb, 60, 1, 'active', true),
        ($2, $3, 'Aula futura E2E', '{"type":"text","document":{"type":"doc","content":[]}}'::jsonb, 60, 1, 'active', true)
      returning id, module_id
    `,
    [immediateModuleId, delayedModuleId, publicationId]
  );
  const immediateLessonId = lessonsResult.rows.find(
    (row) => row.module_id === immediateModuleId
  )?.id;
  const futureLessonId = lessonsResult.rows.find(
    (row) => row.module_id === delayedModuleId
  )?.id;
  if (!(immediateLessonId && futureLessonId)) {
    throw new Error("Could not create scheduled E2E lessons.");
  }

  await createManualAccessGrant({
    client,
    courseId,
    expiresAt: new Date(Date.now() + 30 * MILLISECONDS_PER_DAY),
    manualReference: `e2e-scheduled-${suffix}`,
    reason: "Fixture E2E de liberacao programada",
    userId: studentId,
  });

  return { futureLessonId, id: courseId, immediateLessonId, slug };
};
