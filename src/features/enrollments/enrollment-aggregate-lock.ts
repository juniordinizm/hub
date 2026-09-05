import "server-only";
import type { PoolClient } from "pg";
import { lockCourseContentRelease } from "@/features/courses/content-release-lock";

export const lockEnrollmentAggregate = async (
  client: PoolClient,
  userId: string,
  courseId: string
): Promise<void> => {
  await lockCourseContentRelease(client, courseId);
  await client.query(
    "select pg_advisory_xact_lock(hashtextextended($1 || ':' || $2, 0))",
    [userId, courseId]
  );
};
