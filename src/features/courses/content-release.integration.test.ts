import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { withVerifiedSslMode } from "@/db/connection-url";
import {
  createLessonComment,
  getLessonComments,
} from "@/features/comments/server";
import { lockCourseContentRelease } from "@/features/courses/content-release-lock";
import { buildContentReleaseScheduleSnapshot } from "@/features/courses/module-content-release";
import { getContentReleaseScheduleDigest } from "@/features/courses/module-content-release-digest";
import { resolveLessonAccess } from "@/features/enrollments/access";
import {
  type CheckoutIntentError,
  createAsaasCheckoutIntent,
} from "@/features/payments/checkout";
import { FakeAsaasGateway } from "@/features/payments/fake-asaas-gateway";
import {
  cleanupContentReleaseFixtures,
  createContentReleaseFixture,
  createContentReleaseFixtureRegistry,
} from "./content-release.integration-fixture";
import {
  completeLesson,
  getStudentCourseOverview,
  getStudentLessonWorkspace,
  recordLessonWatchProgress,
} from "./server";

const databaseUrl =
  process.env.INTEGRATION_DATABASE_URL?.trim() ||
  process.env.CERTIFICATE_CONCURRENCY_DATABASE_URL?.trim();
if (!databaseUrl) {
  throw new Error(
    "INTEGRATION_DATABASE_URL is required for integration tests."
  );
}

process.env.DATABASE_URL = databaseUrl;
process.env.DATABASE_URL_DIRECT = databaseUrl;

vi.mock("server-only", () => ({}));

const pool = new Pool({
  application_name: "hub-content-release-integration",
  connectionString: withVerifiedSslMode(databaseUrl),
  max: 4,
});
const NOW = new Date("2026-09-04T12:00:00.000Z");
const registry = createContentReleaseFixtureRegistry();
const createFixture = () =>
  createContentReleaseFixture({ now: NOW, pool, registry });
const cleanupFixtures = () => cleanupContentReleaseFixtures({ pool, registry });

describe("content release PostgreSQL surfaces", () => {
  beforeEach(cleanupFixtures);
  afterAll(async () => {
    await cleanupFixtures();
    await pool.end();
  });

  it("fails closed across workspace, comments, watch and completion", async () => {
    const fixture = await createFixture();

    await expect(
      resolveLessonAccess({
        lessonId: fixture.futureLessonId,
        now: NOW,
        userId: fixture.userId,
      })
    ).resolves.toMatchObject({ kind: "time_locked" });
    await expect(
      getStudentLessonWorkspace({
        lessonId: fixture.futureLessonId,
        viewer: { role: "student", userId: fixture.userId },
      })
    ).resolves.toMatchObject({ kind: "time_locked" });
    await expect(
      getLessonComments({
        lessonId: fixture.futureLessonId,
        role: "student",
        userId: fixture.userId,
      })
    ).rejects.toThrow("Aula indisponivel");
    await expect(
      createLessonComment({
        body: "não deveria inserir",
        lessonId: fixture.futureLessonId,
        role: "student",
        userId: fixture.userId,
      })
    ).rejects.toThrow("Aula indisponivel");
    await expect(
      recordLessonWatchProgress({
        currentSeconds: 10,
        durationSeconds: 120,
        eventName: "timeupdate",
        lessonId: fixture.futureLessonId,
        userId: fixture.userId,
      })
    ).rejects.toThrow("Aula indisponivel");
    await expect(
      completeLesson({
        lessonId: fixture.futureLessonId,
        userId: fixture.userId,
      })
    ).rejects.toThrow("Aula indisponivel");

    const counts = await pool.query<{
      comments: string;
      progress: string;
      watch: string;
    }>(
      `
        select
          (select count(*) from lesson_comments where lesson_id = $1) as comments,
          (select count(*) from lesson_progress where lesson_id = $1) as progress,
          (select count(*) from lesson_watch_progress where lesson_id = $1) as watch
      `,
      [fixture.futureLessonId]
    );
    expect(counts.rows).toEqual([{ comments: "0", progress: "0", watch: "0" }]);
    const certificates = await pool.query(
      "select count(*) from certificates where course_id = $1 and user_id = $2",
      [fixture.courseId, fixture.userId]
    );
    expect(certificates.rows).toEqual([{ count: "0" }]);
  });

  it("keeps a previously completed future lesson revisable without exposing pending lessons", async () => {
    const fixture = await createFixture();
    await pool.query(
      "insert into lesson_progress (user_id, lesson_id, completed_at) values ($1, $2, $3)",
      [
        fixture.userId,
        fixture.futureLessonId,
        new Date("2026-09-03T12:00:00.000Z"),
      ]
    );

    await expect(
      resolveLessonAccess({
        lessonId: fixture.futureLessonId,
        now: NOW,
        userId: fixture.userId,
      })
    ).resolves.toMatchObject({ courseId: fixture.courseId, kind: "allowed" });
    const overview = await getStudentCourseOverview({
      courseId: fixture.courseId,
      viewer: { role: "student", userId: fixture.userId },
    });
    const futureModule = overview?.modules.find(
      (moduleData) => moduleData.title === "Future module"
    );
    expect(futureModule?.lessons).toEqual([
      expect.objectContaining({
        id: fixture.futureLessonId,
        isCompleted: true,
      }),
    ]);
  });

  it("rejects completion after a concurrent revocation commits", async () => {
    const fixture = await createFixture();
    const revocation = await pool.connect();
    let completion: Promise<unknown> | null = null;
    try {
      await revocation.query("begin");
      await lockCourseContentRelease(revocation, fixture.courseId);
      await revocation.query(
        "update enrollments set status = 'revoked', revoked_at = now(), revoked_reason = 'payment_refund' where user_id = $1 and course_id = $2",
        [fixture.userId, fixture.courseId]
      );
      completion = completeLesson({
        lessonId: fixture.immediateLessonId,
        userId: fixture.userId,
      });
      await vi.waitFor(
        async () => {
          const { rows } = await pool.query<{ waiting: boolean }>(
            `
              select exists (
                select 1 from pg_locks
                where pid <> pg_backend_pid()
                  and locktype = 'advisory'
                  and granted = false
              ) as waiting
            `
          );
          expect(rows[0]?.waiting).toBe(true);
        },
        { interval: 50, timeout: 30_000 }
      );
      await revocation.query("commit");
      await expect(completion).rejects.toThrow("Aula indisponivel");
      const progress = await pool.query(
        "select count(*) from lesson_progress where user_id = $1 and lesson_id = $2",
        [fixture.userId, fixture.immediateLessonId]
      );
      expect(progress.rows).toEqual([{ count: "0" }]);
    } finally {
      if (completion) {
        await completion.catch(() => undefined);
      }
      await revocation.query("rollback").catch(() => undefined);
      revocation.release();
    }
  });

  it("rejects a checkout digest after a concurrent publication changes the schedule", async () => {
    const fixture = await createFixture();
    await pool.query(
      "update courses set price_in_cents = 10_000, sales_status = 'open' where id = $1",
      [fixture.courseId]
    );
    const expectedSnapshot = buildContentReleaseScheduleSnapshot([
      { releaseDelayDays: 0, sortOrder: 1, title: "Immediate module" },
      { releaseDelayDays: 8, sortOrder: 2, title: "Future module" },
    ]);
    const publication = await pool.connect();
    const attemptId = randomUUID();
    const gateway = new FakeAsaasGateway({
      createCheckout: {
        id: "checkout-integration",
        link: "https://asaas.example/integration",
        status: "ACTIVE",
      },
    });
    let checkout: Promise<unknown> | null = null;
    try {
      await publication.query("begin");
      await lockCourseContentRelease(publication, fixture.courseId);
      checkout = createAsaasCheckoutIntent({
        attemptId,
        buyer: { kind: "provider_pending" },
        callbacks: {
          cancelUrl: "https://hub.example/cancel",
          expiredUrl: "https://hub.example/expired",
          successUrl: "https://hub.example/success",
        },
        courseId: fixture.courseId,
        expectedContentReleaseScheduleDigest:
          getContentReleaseScheduleDigest(expectedSnapshot),
        gateway,
        now: () => NOW,
      });
      await vi.waitFor(
        async () => {
          const { rows } = await pool.query<{ waiting: boolean }>(
            `
              select exists (
                select 1 from pg_locks
                where locktype = 'advisory' and granted = false
              ) as waiting
            `
          );
          expect(rows[0]?.waiting).toBe(true);
        },
        { interval: 50, timeout: 30_000 }
      );
      await publication.query(
        "update modules set release_delay_days = 9 where course_publication_id = (select id from course_publications where course_id = $1 and status = 'published') and sort_order = 2",
        [fixture.courseId]
      );
      await publication.query("commit");
      await expect(checkout).rejects.toMatchObject({
        kind: "conflict",
        reason: "schedule_changed",
      } satisfies Partial<CheckoutIntentError>);
      expect(gateway.calls.createCheckout).toHaveLength(0);
      const orders = await pool.query(
        "select count(*) from orders where id = $1",
        [attemptId]
      );
      expect(orders.rows).toEqual([{ count: "0" }]);
    } finally {
      if (checkout) {
        await checkout.catch(() => undefined);
      }
      await publication.query("rollback").catch(() => undefined);
      publication.release();
    }
  });
});
