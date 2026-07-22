import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { getPool } from "@/db";
import { rebuildEnrollmentProjection } from "@/features/enrollments/server";
import { getAuth } from "@/lib/auth";

const E2E_PASSWORD = "E2E-password-123!";
const FIXTURE_PATH = resolve(
  process.env.E2E_FIXTURE_PATH ?? ".e2e-fixture.json"
);

export interface E2eFixture {
  admin: { email: string; password: string };
  certificate: { revokedCode: string; validCode: string };
  course: { id: string; lessonOneId: string; lessonTwoId: string };
  studentWithExpiredAccess: { email: string; id: string; password: string };
  studentWithGrant: { email: string; id: string; password: string };
  studentWithoutGrant: { email: string; id: string; password: string };
  studentWithRevokedAccess: { email: string; id: string; password: string };
}

const requireE2eMode = (): void => {
  if (process.env.E2E_TEST_MODE !== "true") {
    throw new Error("seed-e2e requires E2E_TEST_MODE=true.");
  }

  if (!process.env.DATABASE_URL) {
    throw new Error("seed-e2e requires DATABASE_URL.");
  }
};

const createUser = async ({
  email,
  name,
  role,
}: {
  email: string;
  name: string;
  role: "admin" | "student";
}): Promise<string> => {
  const result = await getAuth().api.signUpEmail({
    body: { email, name, password: E2E_PASSWORD },
  });
  const userId = result.user.id;

  await getPool().query(
    "insert into profiles (user_id, role) values ($1, $2::role)",
    [userId, role]
  );
  return userId;
};

export const seedE2e = async (): Promise<E2eFixture> => {
  requireE2eMode();

  const suffix = crypto.randomUUID().replaceAll("-", "");
  const studentEmail = `sg${suffix}@example.com`;
  const noGrantEmail = `sn${suffix}@example.com`;
  const adminEmail = `ad${suffix}@example.com`;
  const [
    studentId,
    noGrantId,
    ,
    expiredAccessStudentId,
    revokedAccessStudentId,
  ] = await Promise.all([
    createUser({
      email: studentEmail,
      name: "Aluna com acesso",
      role: "student",
    }),
    createUser({
      email: noGrantEmail,
      name: "Aluna sem acesso",
      role: "student",
    }),
    createUser({ email: adminEmail, name: "Admin E2E", role: "admin" }),
    createUser({
      email: `se${suffix}@example.com`,
      name: "Aluna com acesso expirado",
      role: "student",
    }),
    createUser({
      email: `sr${suffix}@example.com`,
      name: "Aluna com acesso revogado",
      role: "student",
    }),
  ]);
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("begin");
    const { rows: courses } = await client.query<{ id: string }>(
      `
        insert into courses (slug, title, price_in_cents, workload_hours, status)
        values ($1, 'Curso E2E', 9900, 2, 'active')
        returning id
      `,
      [`course-e2e-${suffix}`]
    );
    const courseId = courses[0]?.id;
    if (!courseId) {
      throw new Error("Could not create E2E course.");
    }
    const { rows: coursePublications } = await client.query<{ id: string }>(
      `
        insert into course_publications (
          course_id, publication_number, status, title_snapshot, workload_hours_snapshot, published_at
        ) values ($1, 1, 'published', 'Curso E2E', 2, now())
        returning id
      `,
      [courseId]
    );
    const coursePublicationId = coursePublications[0]?.id;
    if (!coursePublicationId) {
      throw new Error("Could not create E2E course publication.");
    }

    const { rows: modules } = await client.query<{ id: string }>(
      `insert into modules (course_id, course_publication_id, title, sort_order, status)
       values ($1, $2, 'Modulo E2E', 1, 'active') returning id`,
      [courseId, coursePublicationId]
    );
    const moduleId = modules[0]?.id;
    if (!moduleId) {
      throw new Error("Could not create E2E module.");
    }

    const lessonIds: string[] = [];
    for (const [sortOrder, title] of [
      "Primeira aula",
      "Segunda aula",
    ].entries()) {
      const { rows } = await client.query<{ id: string }>(
        `
          insert into lessons (module_id, course_publication_id, title, duration_seconds, sort_order, status)
          values ($1, $2, $3, 60, $4, 'active') returning id
        `,
        [moduleId, coursePublicationId, title, sortOrder + 1]
      );
      const lessonId = rows[0]?.id;
      if (!lessonId) {
        throw new Error("Could not create E2E lesson.");
      }
      lessonIds.push(lessonId);
    }

    await client.query(
      `
        insert into enrollment_grants (
          user_id, course_id, source_type, manual_reference, status,
          starts_at, base_expires_at, effective_expires_at
        ) values ($1, $2, 'manual', $3, 'active', now() - interval '1 minute',
                  now() + interval '30 days', now() + interval '30 days')
      `,
      [studentId, courseId, `e2e-${suffix}`]
    );
    await rebuildEnrollmentProjection({ client, courseId, userId: studentId });

    await client.query(
      `
        insert into enrollment_grants (
          user_id, course_id, source_type, manual_reference, status,
          starts_at, base_expires_at, effective_expires_at, revoked_at,
          revoked_reason
        ) values
          ($1, $2, 'manual', $3, 'active', now() - interval '31 days',
           now() - interval '1 day', now() - interval '1 day', null, null),
          ($4, $2, 'manual', $5, 'cancelled', now() - interval '31 days',
           now() - interval '1 day', now() - interval '1 day', now(),
           'abacatepay_dispute')
      `,
      [
        expiredAccessStudentId,
        courseId,
        `e2e-expired-${suffix}`,
        revokedAccessStudentId,
        `e2e-revoked-${suffix}`,
      ]
    );
    await rebuildEnrollmentProjection({
      client,
      courseId,
      userId: expiredAccessStudentId,
    });
    await rebuildEnrollmentProjection({
      client,
      courseId,
      userId: revokedAccessStudentId,
    });

    const validCode = `E2E-VALID-${suffix}`;
    const revokedCode = `E2E-REVOKED-${suffix}`;
    await client.query(
      `
        insert into certificates (
          user_id, course_id, code, course_publication_id, student_name_snapshot,
          course_title_snapshot, workload_hours_snapshot, status
        ) values
          ($1, $2, $3, $4, 'Aluna com acesso', 'Curso E2E', 2, 'valid'),
          ($1, $2, $5, $4, 'Aluna com acesso', 'Curso E2E', 2, 'revoked')
        `,
      [studentId, courseId, validCode, coursePublicationId, revokedCode]
    );
    await client.query("commit");

    const lessonOneId = lessonIds[0];
    const lessonTwoId = lessonIds[1];
    if (!(lessonOneId && lessonTwoId)) {
      throw new Error("Missing E2E lessons.");
    }

    const fixture: E2eFixture = {
      admin: { email: adminEmail, password: E2E_PASSWORD },
      certificate: { revokedCode, validCode },
      course: { id: courseId, lessonOneId, lessonTwoId },
      studentWithGrant: {
        email: studentEmail,
        id: studentId,
        password: E2E_PASSWORD,
      },
      studentWithExpiredAccess: {
        email: `se${suffix}@example.com`,
        id: expiredAccessStudentId,
        password: E2E_PASSWORD,
      },
      studentWithRevokedAccess: {
        email: `sr${suffix}@example.com`,
        id: revokedAccessStudentId,
        password: E2E_PASSWORD,
      },
      studentWithoutGrant: {
        email: noGrantEmail,
        id: noGrantId,
        password: E2E_PASSWORD,
      },
    };
    await writeFile(FIXTURE_PATH, `${JSON.stringify(fixture)}\n`, "utf8");
    return fixture;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
};

if (import.meta.main) {
  await seedE2e();
  await getPool().end();
}
