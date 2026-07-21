import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { withVerifiedSslMode } from "@/db/connection-url";

const databaseUrl = process.env.CERTIFICATE_CONCURRENCY_DATABASE_URL;
if (!databaseUrl) {
  throw new Error(
    "CERTIFICATE_CONCURRENCY_DATABASE_URL is required for integration tests."
  );
}
const AUTOMATIC_CERTIFICATE_CODE = /^PRT-/;
const CONSECUTIVE_ISSUANCE_RUNS = 20;
const CONSECUTIVE_ISSUANCE_TIMEOUT_MS = 60_000;

const dependencies = vi.hoisted(() => ({
  getPool: vi.fn(),
  resolveLessonAccess: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({ getPool: dependencies.getPool }));
vi.mock("@/features/enrollments/access", () => ({
  resolveLessonAccess: dependencies.resolveLessonAccess,
}));

import { tryIssueAutomaticCompletionCertificate } from "../certificates/server";
import { completeLesson, recordLessonWatchProgress } from "./server";

const pool = new Pool({ connectionString: withVerifiedSslMode(databaseUrl) });

const getTestPool = (): Pool => pool;

const createFixture = async (): Promise<{
  courseId: string;
  courseVersionId: string;
  lessonId: string;
  userId: string;
}> => {
  const testPool = getTestPool();

  const userId = `certificate-student-${randomUUID()}`;
  const { rows: courseRows } = await testPool.query<{ id: string }>(
    `
      insert into courses (slug, title, workload_hours, status)
      values ($1, 'Curso de concorrencia', 8, 'active')
      returning id
    `,
    [`certificate-concurrency-${randomUUID()}`]
  );
  const courseId = courseRows[0]?.id;

  if (!courseId) {
    throw new Error("Nao foi possivel criar o curso de teste.");
  }
  const { rows: courseVersionRows } = await testPool.query<{ id: string }>(
    `
      insert into course_versions (
        course_id, version_number, status, title_snapshot, workload_hours_snapshot, published_at
      ) values ($1, 1, 'published', 'Curso de concorrencia', 8, now())
      returning id
    `,
    [courseId]
  );
  const courseVersionId = courseVersionRows[0]?.id;
  if (!courseVersionId) {
    throw new Error("Nao foi possivel criar a versao do curso de teste.");
  }

  const { rows: moduleRows } = await testPool.query<{ id: string }>(
    `
      insert into modules (course_id, course_version_id, title, sort_order, status)
      values ($1, $2, 'Modulo final', 1, 'active')
      returning id
    `,
    [courseId, courseVersionId]
  );
  const moduleId = moduleRows[0]?.id;

  if (!moduleId) {
    throw new Error("Nao foi possivel criar o modulo de teste.");
  }

  const { rows: lessonRows } = await testPool.query<{ id: string }>(
    `
      insert into lessons (
        module_id,
        course_version_id,
        title,
        duration_seconds,
        video_duration_seconds,
        sort_order,
        status,
        video_provider
      )
      values ($1, $2, 'Aula final', 120, 120, 1, 'active', 'jmvstream')
      returning id
    `,
    [moduleId, courseVersionId]
  );
  const lessonId = lessonRows[0]?.id;

  if (!lessonId) {
    throw new Error("Nao foi possivel criar a aula de teste.");
  }

  await testPool.query(
    `
      insert into users (id, name, email, email_verified)
      values ($1, 'Aluna de concorrencia', $2, true)
    `,
    [userId, `${userId}@example.test`]
  );
  await testPool.query(
    `
      insert into enrollments (user_id, course_id, course_version_id, status, starts_at, expires_at)
      values ($1, $2, $3, 'active', now() - interval '1 minute', now() + interval '1 day')
    `,
    [userId, courseId, courseVersionId]
  );

  return { courseId, courseVersionId, lessonId, userId };
};

const countCertificates = async (courseId: string, userId: string) => {
  const { rows } = await getTestPool().query<{ count: string }>(
    "select count(*) from certificates where course_id = $1 and user_id = $2",
    [courseId, userId]
  );
  return Number(rows[0]?.count ?? 0);
};

const countCertificateOutboxMessages = async (certificateId: string) => {
  const { rows } = await getTestPool().query<{ count: string }>(
    `
      select count(*)
      from outbox_messages
      where topic = 'email.certificate-issued'
        and payload->>'certificateId' = $1
    `,
    [certificateId]
  );
  return Number(rows[0]?.count ?? 0);
};

describe("emissao concorrente de certificado", () => {
  beforeAll(() => {
    dependencies.getPool.mockReturnValue(pool);
    dependencies.resolveLessonAccess.mockResolvedValue(true);
  });

  beforeEach(async () => {
    dependencies.resolveLessonAccess.mockResolvedValue(true);
    await pool.query("truncate table users cascade");
  });

  afterAll(async () => {
    await pool.end();
  });

  it("emite e registra uma unica notificacao duravel sob duas conclusoes simultaneas", async () => {
    const fixture = await createFixture();

    const results = await Promise.all([
      completeLesson({ userId: fixture.userId, lessonId: fixture.lessonId }),
      completeLesson({ userId: fixture.userId, lessonId: fixture.lessonId }),
    ]);

    const issued = results.filter((result) => result.certificateIssued);
    expect(issued).toHaveLength(1);
    expect(await countCertificates(fixture.courseId, fixture.userId)).toBe(1);

    const { rows } = await getTestPool().query<{ id: string }>(
      "select id from certificates where course_id = $1 and user_id = $2",
      [fixture.courseId, fixture.userId]
    );
    expect(await countCertificateOutboxMessages(rows[0]?.id ?? "")).toBe(1);
  });

  it("retorna código somente para a transação que vence o conflito", async () => {
    const fixture = await createFixture();
    const testPool = getTestPool();
    const firstClient = await testPool.connect();
    const secondClient = await testPool.connect();
    try {
      await firstClient.query("begin");
      await secondClient.query("begin");
      const firstCode = await tryIssueAutomaticCompletionCertificate({
        client: firstClient,
        courseId: fixture.courseId,
        courseVersionId: fixture.courseVersionId,
        courseTitle: "Curso de concorrencia",
        studentName: "Aluna de concorrencia",
        userId: fixture.userId,
        workloadHours: 8,
      });
      const second = tryIssueAutomaticCompletionCertificate({
        client: secondClient,
        courseId: fixture.courseId,
        courseVersionId: fixture.courseVersionId,
        courseTitle: "Curso de concorrencia",
        studentName: "Aluna de concorrencia",
        userId: fixture.userId,
        workloadHours: 8,
      });

      await firstClient.query("commit");
      const secondCode = await second;
      await secondClient.query("commit");

      expect(firstCode).toMatch(AUTOMATIC_CERTIFICATE_CODE);
      expect(secondCode).toBeNull();
      expect(await countCertificates(fixture.courseId, fixture.userId)).toBe(1);
    } finally {
      await firstClient.query("rollback").catch(() => undefined);
      await secondClient.query("rollback").catch(() => undefined);
      firstClient.release();
      secondClient.release();
    }
  });

  it("permanece idempotente em retry e em callback de video duplicado", async () => {
    const fixture = await createFixture();

    await recordLessonWatchProgress({
      currentSeconds: 120,
      durationSeconds: 120,
      eventName: "ended",
      lessonId: fixture.lessonId,
      userId: fixture.userId,
    });
    await completeLesson({
      userId: fixture.userId,
      lessonId: fixture.lessonId,
    });
    await recordLessonWatchProgress({
      currentSeconds: 120,
      durationSeconds: 120,
      eventName: "ended",
      lessonId: fixture.lessonId,
      userId: fixture.userId,
    });

    expect(await countCertificates(fixture.courseId, fixture.userId)).toBe(1);
    const certificate = await getTestPool().query<{ id: string }>(
      "select id from certificates where course_id = $1 and user_id = $2",
      [fixture.courseId, fixture.userId]
    );
    expect(
      await countCertificateOutboxMessages(certificate.rows[0]?.id ?? "")
    ).toBe(1);
  });

  it("nao emite automaticamente quando ja existe certificado valido ou revogado", async () => {
    const fixture = await createFixture();
    await getTestPool().query(
      `
        insert into certificates (
          user_id, course_id, code, student_name_snapshot,
          course_title_snapshot, workload_hours_snapshot, status
        )
        values ($1, $2, $3, 'Aluna de concorrencia', 'Curso de concorrencia', 8, $4)
      `,
      [fixture.userId, fixture.courseId, randomUUID(), "valid"]
    );

    await expect(
      completeLesson({ userId: fixture.userId, lessonId: fixture.lessonId })
    ).resolves.toMatchObject({ certificateIssued: false });
    expect(await countCertificates(fixture.courseId, fixture.userId)).toBe(1);

    await getTestPool().query("update certificates set status = 'revoked'");
    await expect(
      completeLesson({ userId: fixture.userId, lessonId: fixture.lessonId })
    ).resolves.toMatchObject({ certificateIssued: false });
    expect(await countCertificates(fixture.courseId, fixture.userId)).toBe(1);
  });

  it("registra a notificacao antes de confirmar o certificado", async () => {
    const fixture = await createFixture();

    await expect(
      completeLesson({ userId: fixture.userId, lessonId: fixture.lessonId })
    ).resolves.toMatchObject({ certificateIssued: true });
    expect(await countCertificates(fixture.courseId, fixture.userId)).toBe(1);
    const certificate = await getTestPool().query<{ id: string }>(
      "select id from certificates where course_id = $1 and user_id = $2",
      [fixture.courseId, fixture.userId]
    );
    expect(
      await countCertificateOutboxMessages(certificate.rows[0]?.id ?? "")
    ).toBe(1);
  });

  it(
    "mantem a unicidade em vinte corridas consecutivas",
    async () => {
      for (let index = 0; index < CONSECUTIVE_ISSUANCE_RUNS; index += 1) {
        const fixture = await createFixture();
        const results = await Promise.all([
          completeLesson({
            userId: fixture.userId,
            lessonId: fixture.lessonId,
          }),
          completeLesson({
            userId: fixture.userId,
            lessonId: fixture.lessonId,
          }),
        ]);

        expect(
          results.filter((result) => result.certificateIssued)
        ).toHaveLength(1);
        expect(await countCertificates(fixture.courseId, fixture.userId)).toBe(
          1
        );
      }
    },
    CONSECUTIVE_ISSUANCE_TIMEOUT_MS
  );
});
