import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { withVerifiedSslMode } from "@/db/connection-url";

const databaseUrl = process.env.CERTIFICATE_CONCURRENCY_DATABASE_URL;
if (!databaseUrl) {
  throw new Error(
    "CERTIFICATE_CONCURRENCY_DATABASE_URL is required for integration tests."
  );
}

const pool = new Pool({
  application_name: "protea-r-expiry-warning-integration",
  connectionString: withVerifiedSslMode(databaseUrl),
  max: 4,
});
const dependencies = vi.hoisted(() => ({
  getPool: vi.fn(),
  sendAccessExpiryWarningEmail: vi.fn(),
}));
dependencies.getPool.mockReturnValue(pool);

vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({ getPool: dependencies.getPool }));
vi.mock("@/features/email/server", () => ({
  sendAccessExpiryWarningEmail: dependencies.sendAccessExpiryWarningEmail,
  sendAccessReleasedEmail: vi.fn(),
  sendCertificateIssuedEmail: vi.fn(),
  sendCourseSalesOpenedEmail: vi.fn(),
  sendSupportRequestEmail: vi.fn(),
}));
vi.mock("@/features/certificates/server", () => ({
  renderPendingCertificate: vi.fn(),
}));
vi.mock("@/features/payments/provider", () => ({
  getApplicationUrl: vi.fn(),
  getAsaasProviderClient: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ getAuth: vi.fn() }));
vi.mock("@/lib/env", () => ({ getServerEnv: vi.fn() }));

import { deliverOutboxMessage } from "./delivery";
import { createEnrollmentExpiryWarningMessage } from "./rules";
import {
  claimOutboxMessages,
  enqueueOutboxMessage,
  markOutboxMessageDeadLetter,
  markOutboxMessageDeferred,
  markOutboxMessageDelivered,
  markOutboxMessageForRetry,
  markOutboxMessageSuperseded,
} from "./server";
import { processClaimedOutboxMessage } from "./worker";

interface Fixture {
  courseId: string;
  enrollmentId: string;
  userId: string;
}

const createFixture = async (expiresAt: Date): Promise<Fixture> => {
  const userId = randomUUID();
  await pool.query(
    `
      insert into users (id, name, email, email_verified, created_at, updated_at)
      values ($1, 'Expiry integration', $2, true, now(), now())
    `,
    [userId, `${userId}@example.test`]
  );
  const course = await pool.query<{ id: string }>(
    `
      insert into courses (slug, title, created_at, updated_at)
      values ($1, 'Expiry integration course', now(), now())
      returning id
    `,
    [`expiry-integration-${randomUUID()}`]
  );
  const courseId = String(course.rows[0]?.id);
  const enrollment = await pool.query<{ id: string }>(
    `
      insert into enrollments (
        user_id, course_id, status, starts_at, expires_at, created_at, updated_at
      )
      values ($1, $2, 'active', now(), $3, now(), now())
      returning id
    `,
    [userId, courseId, expiresAt]
  );
  return {
    courseId,
    enrollmentId: String(enrollment.rows[0]?.id),
    userId,
  };
};

const cleanupFixture = async (fixture: Fixture): Promise<void> => {
  await pool.query("delete from outbox_messages where aggregate_id = $1", [
    fixture.enrollmentId,
  ]);
  await pool.query("delete from courses where id = $1", [fixture.courseId]);
  await pool.query("delete from users where id = $1", [fixture.userId]);
};

const processNext = async (workerId: string) => {
  const [message] = await claimOutboxMessages({
    client: pool,
    limit: 1,
    workerId,
  });
  if (!message) {
    throw new Error("Expected an expiry warning message.");
  }
  const outcome = await processClaimedOutboxMessage({
    deliver: deliverOutboxMessage,
    markDeadLetter: ({ errorCode, id }) =>
      markOutboxMessageDeadLetter({
        client: pool,
        errorCode,
        id,
        workerId,
      }),
    markDeferred: ({ errorCode, id }) =>
      markOutboxMessageDeferred({
        client: pool,
        errorCode,
        id,
        workerId,
      }),
    markDelivered: (id) =>
      markOutboxMessageDelivered({ client: pool, id, workerId }),
    markRetry: ({ errorCode, id, retryDelayMs }) =>
      markOutboxMessageForRetry({
        client: pool,
        errorCode,
        id,
        retryDelayMs,
        workerId,
      }),
    markSuperseded: ({ errorCode, id }) =>
      markOutboxMessageSuperseded({
        client: pool,
        errorCode,
        id,
        workerId,
      }),
    message,
  });
  return { message, outcome };
};

afterAll(async () => {
  await pool.end();
});

describe("expiry warning generation races", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dependencies.sendAccessExpiryWarningEmail.mockResolvedValue(undefined);
  });

  it("delivers one current generation and keeps retries idempotent", async () => {
    const expiresAt = new Date(Date.now() + 6 * 86_400_000);
    const fixture = await createFixture(expiresAt);
    try {
      const message = createEnrollmentExpiryWarningMessage({
        enrollmentId: fixture.enrollmentId,
        expectedExpiresAt: expiresAt,
        warningKind: "7d",
      });
      const first = await enqueueOutboxMessage({ client: pool, message });
      const duplicate = await enqueueOutboxMessage({ client: pool, message });
      expect(first.inserted).toBe(true);
      expect(duplicate.inserted).toBe(false);

      await expect(processNext("expiry-current-worker")).resolves.toMatchObject(
        {
          outcome: "delivered",
        }
      );
      expect(dependencies.sendAccessExpiryWarningEmail).toHaveBeenCalledOnce();
    } finally {
      await cleanupFixture(fixture);
    }
  });

  it("supersedes a changed generation and allows a new idempotency key", async () => {
    const originalExpiry = new Date(Date.now() + 6 * 86_400_000);
    const fixture = await createFixture(originalExpiry);
    try {
      const original = createEnrollmentExpiryWarningMessage({
        enrollmentId: fixture.enrollmentId,
        expectedExpiresAt: originalExpiry,
        warningKind: "7d",
      });
      await enqueueOutboxMessage({ client: pool, message: original });
      const extendedExpiry = new Date(Date.now() + 36 * 86_400_000);
      await pool.query(
        `
          update enrollments
          set expires_at = $2,
              expiry_warning_7d_sent_at = null,
              expiry_warning_1d_sent_at = null,
              updated_at = now()
          where id = $1
        `,
        [fixture.enrollmentId, extendedExpiry]
      );
      await expect(processNext("expiry-changed-worker")).resolves.toMatchObject(
        {
          outcome: "superseded",
        }
      );
      expect(dependencies.sendAccessExpiryWarningEmail).not.toHaveBeenCalled();
      const state = await pool.query<{
        last_error_code: string;
        status: string;
      }>(
        "select status, last_error_code from outbox_messages where idempotency_key = $1",
        [original.idempotencyKey]
      );
      expect(state.rows[0]).toEqual({
        last_error_code: "expiry_generation_changed",
        status: "superseded",
      });
      const replacement = createEnrollmentExpiryWarningMessage({
        enrollmentId: fixture.enrollmentId,
        expectedExpiresAt: extendedExpiry,
        warningKind: "7d",
      });
      expect(replacement.idempotencyKey).not.toBe(original.idempotencyKey);
    } finally {
      await cleanupFixture(fixture);
    }
  });

  it.each([
    ["revoked", "expiry_inactive"],
    ["expired", "expiry_inactive"],
  ] as const)("supersedes an %s enrollment", async (status, errorCode) => {
    const expiresAt = new Date(Date.now() + 6 * 86_400_000);
    const fixture = await createFixture(expiresAt);
    try {
      await enqueueOutboxMessage({
        client: pool,
        message: createEnrollmentExpiryWarningMessage({
          enrollmentId: fixture.enrollmentId,
          expectedExpiresAt: expiresAt,
          warningKind: "7d",
        }),
      });
      await pool.query(
        "update enrollments set status = $2, updated_at = now() where id = $1",
        [fixture.enrollmentId, status]
      );
      const processed = await processNext(`expiry-${status}-worker`);
      expect(processed.outcome).toBe("superseded");
      const state = await pool.query<{ last_error_code: string }>(
        "select last_error_code from outbox_messages where id = $1",
        [processed.message.id]
      );
      expect(state.rows[0]?.last_error_code).toBe(errorCode);
    } finally {
      await cleanupFixture(fixture);
    }
  });

  it("supersedes a delayed 7d warning in the 1d window", async () => {
    const expiresAt = new Date(Date.now() + 12 * 3_600_000);
    const fixture = await createFixture(expiresAt);
    try {
      await enqueueOutboxMessage({
        client: pool,
        message: createEnrollmentExpiryWarningMessage({
          enrollmentId: fixture.enrollmentId,
          expectedExpiresAt: expiresAt,
          warningKind: "7d",
        }),
      });
      await expect(processNext("expiry-window-worker")).resolves.toMatchObject({
        outcome: "superseded",
      });
      const oneDay = createEnrollmentExpiryWarningMessage({
        enrollmentId: fixture.enrollmentId,
        expectedExpiresAt: expiresAt,
        warningKind: "1d",
      });
      expect(oneDay.idempotencyKey).toContain("/1d/");
      expect(dependencies.sendAccessExpiryWarningEmail).not.toHaveBeenCalled();
    } finally {
      await cleanupFixture(fixture);
    }
  });

  it("supersedes a remaining v1 payload without resolving identity or sending", async () => {
    const expiresAt = new Date(Date.now() + 6 * 86_400_000);
    const fixture = await createFixture(expiresAt);
    try {
      await enqueueOutboxMessage({
        client: pool,
        message: {
          aggregateId: fixture.enrollmentId,
          aggregateType: "enrollment",
          idempotencyKey: `email.access-expiry-warning/${fixture.enrollmentId}/7d/v1`,
          payload: {
            enrollmentId: fixture.enrollmentId,
            warningKind: "7d",
          },
          payloadVersion: 1,
          topic: "email.access-expiry-warning",
        },
      });
      const processed = await processNext("expiry-v1-worker");
      expect(processed.outcome).toBe("superseded");
      const state = await pool.query<{ last_error_code: string }>(
        "select last_error_code from outbox_messages where id = $1",
        [processed.message.id]
      );
      expect(state.rows[0]?.last_error_code).toBe("expiry_payload_v1");
      expect(dependencies.sendAccessExpiryWarningEmail).not.toHaveBeenCalled();
    } finally {
      await cleanupFixture(fixture);
    }
  });

  it("allows only the lease owner to transition a competed message", async () => {
    const expiresAt = new Date(Date.now() + 6 * 86_400_000);
    const fixture = await createFixture(expiresAt);
    try {
      await enqueueOutboxMessage({
        client: pool,
        message: createEnrollmentExpiryWarningMessage({
          enrollmentId: fixture.enrollmentId,
          expectedExpiresAt: expiresAt,
          warningKind: "7d",
        }),
      });
      const [claimed] = await claimOutboxMessages({
        client: pool,
        limit: 1,
        workerId: "expiry-owner-worker",
      });
      if (!claimed) {
        throw new Error("Expected a claimed expiry warning.");
      }
      await expect(
        markOutboxMessageSuperseded({
          client: pool,
          errorCode: "expiry_generation_changed",
          id: claimed.id,
          workerId: "expiry-competing-worker",
        })
      ).resolves.toBe(false);
      await expect(
        markOutboxMessageSuperseded({
          client: pool,
          errorCode: "expiry_generation_changed",
          id: claimed.id,
          workerId: "expiry-owner-worker",
        })
      ).resolves.toBe(true);
    } finally {
      await cleanupFixture(fixture);
    }
  });
});
