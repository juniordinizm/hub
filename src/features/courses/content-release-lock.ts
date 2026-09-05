import "server-only";
import type { PoolClient } from "pg";

export const lockCourseContentRelease = async (
  client: PoolClient,
  courseId: string
): Promise<void> => {
  await client.query(
    "select pg_advisory_xact_lock(hashtextextended('course-content-release:' || $1::text, 0))",
    [courseId]
  );
};

export const lockCoursesContentRelease = async (
  client: PoolClient,
  courseIds: readonly string[]
): Promise<void> => {
  const orderedCourseIds = [...new Set(courseIds.filter(Boolean))].sort();
  for (const courseId of orderedCourseIds) {
    await lockCourseContentRelease(client, courseId);
  }
};
