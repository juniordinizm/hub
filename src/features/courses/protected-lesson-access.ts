import "server-only";
import type { PoolClient } from "pg";
import { getPool } from "@/db";
import { resolveLessonAccessWithClient } from "@/features/enrollments/access";
import { lockEnrollmentAggregate } from "@/features/enrollments/enrollment-aggregate-lock";

export class LessonAccessDeniedError extends Error {
  constructor() {
    super("Aula indisponivel para esta matricula.");
    this.name = "LessonAccessDeniedError";
  }
}

export const assertProtectedLessonAccess = async ({
  courseId,
  lessonId,
  userId,
}: {
  courseId: string;
  lessonId: string;
  userId: string;
}): Promise<void> => {
  const client: PoolClient = await getPool().connect();

  try {
    await client.query("begin");
    await lockEnrollmentAggregate(client, userId, courseId);
    const access = await resolveLessonAccessWithClient({
      client,
      lessonId,
      userId,
    });
    if (access?.kind !== "allowed") {
      throw new LessonAccessDeniedError();
    }
    await client.query("commit");
  } catch (error) {
    try {
      await client.query("rollback");
    } catch {
      // Preserve the authorization failure if rollback itself is unavailable.
    }
    throw error;
  } finally {
    client.release();
  }
};
