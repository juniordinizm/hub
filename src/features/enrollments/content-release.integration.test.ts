import { randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { withVerifiedSslMode } from "@/db/connection-url";
import { lockCourseContentRelease } from "@/features/courses/content-release-lock";

const databaseUrl =
  process.env.CERTIFICATE_CONCURRENCY_DATABASE_URL?.trim() ||
  process.env.INTEGRATION_DATABASE_URL?.trim();
if (!databaseUrl) {
  throw new Error(
    "CERTIFICATE_CONCURRENCY_DATABASE_URL is required for integration tests."
  );
}

vi.mock("server-only", () => ({}));

import {
  applyPaidWebhookAccess,
  applyPaymentRevocation,
  blockEnrollmentAccess,
  grantEnrollmentFullContentAccess,
  restoreEnrollmentAccess,
} from "./server";

const LOCK_OBSERVATION_TIMEOUT_MS = 30_000;
const ACCESS_DURATION_MONTHS = 12;
const pool = new Pool({
  application_name: "protea-r-enrollment-release-integration",
  connectionString: withVerifiedSslMode(databaseUrl),
  max: 4,
});
const fixtureCourseIds = new Set<string>();
const fixtureUserIds = new Set<string>();

interface EnrollmentContentReleaseFixture {
  courseId: string;
  firstOrderId: string;
  secondOrderId: string;
  userId: string;
}

const cleanupFixtures = async (): Promise<void> => {
  if (fixtureCourseIds.size > 0) {
    await pool.query("delete from courses where id = any($1::uuid[])", [
      [...fixtureCourseIds],
    ]);
    fixtureCourseIds.clear();
  }
  if (fixtureUserIds.size > 0) {
    await pool.query(
      "delete from audit_logs where actor_user_id = any($1::text[])",
      [[...fixtureUserIds]]
    );
    await pool.query("delete from users where id = any($1::text[])", [
      [...fixtureUserIds],
    ]);
    fixtureUserIds.clear();
  }
};

const createFixture = async (): Promise<EnrollmentContentReleaseFixture> => {
  const courseId = randomUUID();
  const coursePublicationId = randomUUID();
  const immediateModuleId = randomUUID();
  const delayedModuleId = randomUUID();
  const lessonId = randomUUID();
  const firstOrderId = randomUUID();
  const secondOrderId = randomUUID();
  const suffix = randomUUID();
  const userId = `enrollment-release-${suffix}`;
  fixtureCourseIds.add(courseId);
  fixtureUserIds.add(userId);

  await pool.query(
    `
      insert into users (id, name, email, email_verified)
      values ($1, 'Aluna de serializacao', $2, true)
    `,
    [userId, `${userId}@example.test`]
  );
  await pool.query(
    `
      insert into courses (id, slug, title, status, access_duration_months)
      values ($1, $2, 'Curso de serializacao', 'active', $3)
    `,
    [courseId, `enrollment-release-${suffix}`, ACCESS_DURATION_MONTHS]
  );
  await pool.query(
    `
      insert into course_publications (
        id,
        course_id,
        publication_number,
        status,
        title_snapshot,
        workload_hours_snapshot,
        published_at
      )
      values ($1, $2, 1, 'published', 'Curso de serializacao', 1, now())
    `,
    [coursePublicationId, courseId]
  );
  await pool.query(
    `
      insert into modules (
        id,
        course_id,
        course_publication_id,
        title,
        sort_order,
        release_delay_days,
        status
      )
      values
        ($1, $3, $4, 'Modulo imediato', 1, 0, 'active'),
        ($2, $3, $4, 'Modulo D+8', 2, 8, 'active')
    `,
    [immediateModuleId, delayedModuleId, courseId, coursePublicationId]
  );
  await pool.query(
    `
      insert into lessons (
        id,
        module_id,
        course_publication_id,
        title,
        sort_order,
        status
      )
      values ($1, $2, $3, 'Aula futura', 1, 'active')
    `,
    [lessonId, delayedModuleId, coursePublicationId]
  );
  await pool.query(
    `
      insert into orders (
        id,
        course_id,
        user_id,
        buyer_identity_status,
        provider,
        provider_payment_id,
        external_id,
        status,
        amount_in_cents,
        access_duration_months,
        paid_amount_in_cents,
        paid_at,
        checkout_course_slug,
        checkout_item_name,
        checkout_item_description
      )
      values
        ($1, $3, $4, 'resolved', 'integration', $5, $6, 'paid', 1000, $7, 1000, $8, $9, 'Curso de serializacao', 'Teste concorrente'),
        ($2, $3, $4, 'resolved', 'integration', $10, $11, 'paid', 1000, $7, 1000, $8, $9, 'Curso de serializacao', 'Teste concorrente')
    `,
    [
      firstOrderId,
      secondOrderId,
      courseId,
      userId,
      `payment-first-${suffix}`,
      `order-first-${suffix}`,
      ACCESS_DURATION_MONTHS,
      new Date("2026-09-04T17:30:00.000Z"),
      `enrollment-release-${suffix}`,
      `payment-second-${suffix}`,
      `order-second-${suffix}`,
    ]
  );

  return { courseId, firstOrderId, secondOrderId, userId };
};

const isWaitingForAdvisoryLock = async (
  backendPid: number
): Promise<boolean> => {
  const { rows } = await pool.query<{ waiting: boolean }>(
    `
      select exists (
        select 1
        from pg_locks
        where pid = $1
          and locktype = 'advisory'
          and granted = false
      ) as waiting
    `,
    [backendPid]
  );
  return rows[0]?.waiting ?? false;
};

const rollbackQuietly = async (client: PoolClient): Promise<void> => {
  await client.query("rollback").catch(() => undefined);
};

describe("serializacao de concessoes e ancora de conteudo", () => {
  beforeEach(async () => {
    await cleanupFixtures();
  });

  afterAll(async () => {
    await cleanupFixtures();
    await pool.end();
  });

  it("impede a primeira concessao de atravessar a decisao de publicacao do Curso", async () => {
    const fixture = await createFixture();
    const publication = await pool.connect();
    const grant = await pool.connect();
    let grantApplication: Promise<void> | null = null;

    try {
      await publication.query("begin");
      await lockCourseContentRelease(publication, fixture.courseId);
      await grant.query("begin");
      const { rows: backendRows } = await grant.query<{ pid: number }>(
        "select pg_backend_pid() as pid"
      );
      const grantBackendPid = backendRows[0]?.pid;
      if (!grantBackendPid) {
        throw new Error("Nao foi possivel identificar a conexao da concessao.");
      }

      grantApplication = applyPaidWebhookAccess({
        accessDurationMonths: ACCESS_DURATION_MONTHS,
        client: grant,
        courseId: fixture.courseId,
        now: new Date("2026-09-04T17:30:00.000Z"),
        orderId: fixture.firstOrderId,
        userId: fixture.userId,
      });
      await vi.waitFor(
        async () => {
          expect(await isWaitingForAdvisoryLock(grantBackendPid)).toBe(true);
        },
        { interval: 50, timeout: LOCK_OBSERVATION_TIMEOUT_MS }
      );

      const historyQuery = `
        select exists (
          select 1 from enrollment_events
          where course_id = $1 and event_type = 'content_release_scheduled'
        ) as has_scheduled_release_history
      `;
      const historyBeforeCommit = await publication.query(historyQuery, [
        fixture.courseId,
      ]);
      expect(historyBeforeCommit.rows).toEqual([
        { has_scheduled_release_history: false },
      ]);

      await publication.query("commit");
      await grantApplication;
      await grant.query("commit");

      await publication.query("begin");
      await lockCourseContentRelease(publication, fixture.courseId);
      const historyAfterCommit = await publication.query(historyQuery, [
        fixture.courseId,
      ]);
      expect(historyAfterCommit.rows).toEqual([
        { has_scheduled_release_history: true },
      ]);
      await publication.query("commit");
    } finally {
      await rollbackQuietly(publication);
      if (grantApplication) {
        await grantApplication.catch(() => undefined);
      }
      await rollbackQuietly(grant);
      publication.release();
      grant.release();
      await cleanupFixtures();
    }
  });

  it("preserva as duas extensoes e uma unica ancora sob pagamentos concorrentes", async () => {
    const fixture = await createFixture();
    const firstNow = new Date("2026-09-04T17:30:00.000Z");
    const secondNow = new Date("2026-09-04T17:30:01.000Z");
    const firstExpectedExpiration = new Date("2027-09-04T17:30:00.000Z");
    const secondExpectedExpiration = new Date("2028-09-04T17:30:00.000Z");
    const first = await pool.connect();
    const second = await pool.connect();
    let secondApplication: Promise<void> | null = null;

    try {
      await first.query("begin");
      await second.query("begin");
      const { rows: backendRows } = await second.query<{ pid: number }>(
        "select pg_backend_pid() as pid"
      );
      const secondBackendPid = backendRows[0]?.pid;
      if (!secondBackendPid) {
        throw new Error("Nao foi possivel identificar a segunda conexao.");
      }

      await applyPaidWebhookAccess({
        accessDurationMonths: ACCESS_DURATION_MONTHS,
        client: first,
        courseId: fixture.courseId,
        now: firstNow,
        orderId: fixture.firstOrderId,
        userId: fixture.userId,
      });

      secondApplication = applyPaidWebhookAccess({
        accessDurationMonths: ACCESS_DURATION_MONTHS,
        client: second,
        courseId: fixture.courseId,
        now: secondNow,
        orderId: fixture.secondOrderId,
        userId: fixture.userId,
      });
      await vi.waitFor(
        async () => {
          expect(await isWaitingForAdvisoryLock(secondBackendPid)).toBe(true);
        },
        { interval: 50, timeout: LOCK_OBSERVATION_TIMEOUT_MS }
      );

      await first.query("commit");
      await secondApplication;
      await second.query("commit");

      const { rows: grantRows } = await pool.query<{
        effective_expires_at: Date;
        status: string;
      }>(
        `
          select status, effective_expires_at
          from enrollment_grants
          where user_id = $1 and course_id = $2
          order by effective_expires_at
        `,
        [fixture.userId, fixture.courseId]
      );
      expect(grantRows).toEqual([
        { effective_expires_at: firstExpectedExpiration, status: "active" },
        { effective_expires_at: secondExpectedExpiration, status: "active" },
      ]);

      const { rows: enrollmentRows } = await pool.query<{
        content_release_mode: string;
        content_release_started_at: Date;
        expires_at: Date;
      }>(
        `
          select content_release_mode, content_release_started_at, expires_at
          from enrollments
          where user_id = $1 and course_id = $2
        `,
        [fixture.userId, fixture.courseId]
      );
      expect(enrollmentRows).toEqual([
        {
          content_release_mode: "scheduled",
          content_release_started_at: firstNow,
          expires_at: secondExpectedExpiration,
        },
      ]);

      const { rows: eventRows } = await pool.query<{
        count: string;
        event_type: string;
      }>(
        `
          select event_type, count(*)
          from enrollment_events
          where user_id = $1 and course_id = $2
          group by event_type
          order by event_type::text
        `,
        [fixture.userId, fixture.courseId]
      );
      expect(eventRows).toEqual([
        { count: "1", event_type: "content_release_scheduled" },
        { count: "2", event_type: "payment_paid" },
        { count: "2", event_type: "projection_rebuilt" },
      ]);
    } finally {
      await rollbackQuietly(first);
      if (secondApplication) {
        await secondApplication.catch(() => undefined);
      }
      await rollbackQuietly(second);
      first.release();
      second.release();
      await cleanupFixtures();
    }
  });

  it("mantem concessao, expiracao, ancora e eventos em replay do mesmo pedido", async () => {
    const fixture = await createFixture();
    const firstNow = new Date("2026-09-04T17:30:00.000Z");
    const replayNow = new Date("2026-09-05T17:30:00.000Z");
    const expectedExpiration = new Date("2027-09-04T17:30:00.000Z");

    try {
      for (const now of [firstNow, replayNow]) {
        const client = await pool.connect();
        try {
          await client.query("begin");
          await applyPaidWebhookAccess({
            accessDurationMonths: ACCESS_DURATION_MONTHS,
            client,
            courseId: fixture.courseId,
            now,
            orderId: fixture.firstOrderId,
            userId: fixture.userId,
          });
          await client.query("commit");
        } catch (error) {
          await rollbackQuietly(client);
          throw error;
        } finally {
          client.release();
        }
      }

      const { rows: grantRows } = await pool.query<{
        effective_expires_at: Date;
      }>(
        `
          select effective_expires_at
          from enrollment_grants
          where order_id = $1
        `,
        [fixture.firstOrderId]
      );
      expect(grantRows).toEqual([{ effective_expires_at: expectedExpiration }]);

      const { rows: enrollmentRows } = await pool.query<{
        content_release_started_at: Date;
        expires_at: Date;
      }>(
        `
          select content_release_started_at, expires_at
          from enrollments
          where user_id = $1 and course_id = $2
        `,
        [fixture.userId, fixture.courseId]
      );
      expect(enrollmentRows).toEqual([
        {
          content_release_started_at: firstNow,
          expires_at: expectedExpiration,
        },
      ]);

      const { rows: eventRows } = await pool.query<{
        count: string;
        event_type: string;
      }>(
        `
          select event_type, count(*)
          from enrollment_events
          where user_id = $1 and course_id = $2
          group by event_type
          order by event_type::text
        `,
        [fixture.userId, fixture.courseId]
      );
      expect(eventRows).toEqual([
        { count: "1", event_type: "content_release_scheduled" },
        { count: "1", event_type: "payment_paid" },
        { count: "1", event_type: "projection_rebuilt" },
      ]);
    } finally {
      await cleanupFixtures();
    }
  });

  it("concede acesso integral uma vez e preserva a auditoria", async () => {
    const fixture = await createFixture();
    const now = new Date("2026-09-04T17:30:00.000Z");
    const grantClient = await pool.connect();
    try {
      await grantClient.query("begin");
      await applyPaidWebhookAccess({
        accessDurationMonths: ACCESS_DURATION_MONTHS,
        client: grantClient,
        courseId: fixture.courseId,
        now,
        orderId: fixture.firstOrderId,
        userId: fixture.userId,
      });
      await grantClient.query("commit");
    } finally {
      grantClient.release();
    }

    const enrollment = await pool.query<{ id: string }>(
      "select id from enrollments where user_id = $1 and course_id = $2",
      [fixture.userId, fixture.courseId]
    );
    const enrollmentId = enrollment.rows[0]?.id;
    if (!enrollmentId) {
      throw new Error("Matrícula de integração não criada.");
    }

    const result = await grantEnrollmentFullContentAccess({
      actorUserId: fixture.userId,
      enrollmentId,
      reason: "Liberacao operacional de teste",
    });
    const replay = await grantEnrollmentFullContentAccess({
      actorUserId: fixture.userId,
      enrollmentId,
      reason: "Repeticao idempotente",
    });
    expect(result).toEqual({ changed: true });
    expect(replay).toEqual({ changed: false });

    const state = await pool.query({
      text: `
        select content_release_mode, content_release_started_at
        from enrollments
        where id = $1
      `,
      values: [enrollmentId],
    });
    expect(state.rows).toEqual([
      { content_release_mode: "full_access", content_release_started_at: null },
    ]);
    const events = await pool.query<{ count: string }>(
      `
        select count(*)
        from enrollment_events
        where enrollment_id = $1 and event_type = 'content_full_access_granted'
      `,
      [enrollmentId]
    );
    expect(events.rows).toEqual([{ count: "1" }]);
    const audits = await pool.query<{ count: string }>(
      `
        select count(*)
        from audit_logs
        where target_type = 'enrollment'
          and target_id = $1
          and action = 'enrollment.content_full_access_granted'
      `,
      [enrollmentId]
    );
    expect(audits.rows).toEqual([{ count: "1" }]);
  });

  it("preserva a ancora em renovacao, reembolso parcial e bloqueio manual", async () => {
    const fixture = await createFixture();
    const firstNow = new Date("2026-09-04T17:30:00.000Z");
    const secondNow = new Date("2026-09-05T17:30:00.000Z");
    const runTransaction = async (
      operation: (client: PoolClient) => Promise<void>
    ): Promise<void> => {
      const client = await pool.connect();
      try {
        await client.query("begin");
        await operation(client);
        await client.query("commit");
      } catch (error) {
        await rollbackQuietly(client);
        throw error;
      } finally {
        client.release();
      }
    };

    try {
      await runTransaction((client) =>
        applyPaidWebhookAccess({
          accessDurationMonths: ACCESS_DURATION_MONTHS,
          client,
          courseId: fixture.courseId,
          now: firstNow,
          orderId: fixture.firstOrderId,
          userId: fixture.userId,
        })
      );
      await runTransaction((client) =>
        applyPaidWebhookAccess({
          accessDurationMonths: ACCESS_DURATION_MONTHS,
          client,
          courseId: fixture.courseId,
          now: secondNow,
          orderId: fixture.secondOrderId,
          userId: fixture.userId,
        })
      );

      const before = await pool.query<{
        content_release_started_at: Date;
        id: string;
      }>(
        "select id, content_release_started_at from enrollments where user_id = $1 and course_id = $2",
        [fixture.userId, fixture.courseId]
      );
      const enrollment = before.rows[0];
      if (!enrollment) {
        throw new Error("Matrícula de integração não criada.");
      }

      await runTransaction((client) =>
        applyPaymentRevocation({
          client,
          courseId: fixture.courseId,
          now: secondNow,
          orderId: fixture.firstOrderId,
          reason: "payment_refund",
          userId: fixture.userId,
        }).then(() => undefined)
      );
      const afterPartialRefund = await pool.query<{
        content_release_started_at: Date;
        status: string;
      }>(
        "select content_release_started_at, status from enrollments where id = $1",
        [enrollment.id]
      );
      expect(afterPartialRefund.rows).toEqual([
        {
          content_release_started_at: enrollment.content_release_started_at,
          status: "active",
        },
      ]);

      await blockEnrollmentAccess({
        actorUserId: fixture.userId,
        enrollmentId: enrollment.id,
        now: secondNow,
        reason: "Bloqueio operacional de teste",
      });
      await restoreEnrollmentAccess({
        actorUserId: fixture.userId,
        enrollmentId: enrollment.id,
        now: secondNow,
        reason: "Restauracao operacional de teste",
      });
      const afterManualCycle = await pool.query<{
        content_release_started_at: Date;
        status: string;
      }>(
        "select content_release_started_at, status from enrollments where id = $1",
        [enrollment.id]
      );
      expect(afterManualCycle.rows).toEqual([
        {
          content_release_started_at: enrollment.content_release_started_at,
          status: "active",
        },
      ]);

      await runTransaction((client) =>
        applyPaymentRevocation({
          client,
          courseId: fixture.courseId,
          now: secondNow,
          orderId: fixture.secondOrderId,
          reason: "payment_refund",
          userId: fixture.userId,
        }).then(() => undefined)
      );
      const terminal = await pool.query<{ status: string }>(
        "select status from enrollments where id = $1",
        [enrollment.id]
      );
      expect(terminal.rows).toEqual([{ status: "revoked" }]);
    } finally {
      await cleanupFixtures();
    }
  });
});
