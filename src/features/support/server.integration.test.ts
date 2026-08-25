import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { afterAll, describe, expect, it, vi } from "vitest";
import { withVerifiedSslMode } from "@/db/connection-url";

const databaseUrl = process.env.CERTIFICATE_CONCURRENCY_DATABASE_URL;
if (!databaseUrl) {
  throw new Error(
    "CERTIFICATE_CONCURRENCY_DATABASE_URL is required for integration tests."
  );
}

const pool = new Pool({
  application_name: "protea-r-support-request-integration",
  connectionString: withVerifiedSslMode(databaseUrl),
  max: 6,
});
const dependencies = vi.hoisted(() => ({
  getPool: vi.fn(),
}));
dependencies.getPool.mockReturnValue(pool);

vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({ getPool: dependencies.getPool }));

import { createSupportRequest } from "./server";

afterAll(async () => {
  await pool.end();
});

const createUser = async (userId: string): Promise<void> => {
  await pool.query(
    `
      insert into users (id, name, email, email_verified, created_at, updated_at)
      values ($1, 'Support integration', $2, true, now(), now())
    `,
    [userId, `${userId}@example.test`]
  );
};

describe("support request PostgreSQL concurrency", () => {
  it("commits exactly three requests and outbox intents for one account", async () => {
    const userId = randomUUID();
    const requestIds: string[] = [];
    await createUser(userId);
    try {
      const outcomes = await Promise.allSettled(
        Array.from({ length: 4 }, (_, index) =>
          createSupportRequest({
            message: `Controlled concurrent message ${index}`,
            subject: `Controlled subject ${index}`,
            userId,
          })
        )
      );
      expect(
        outcomes.filter(({ status }) => status === "fulfilled")
      ).toHaveLength(3);
      expect(
        outcomes.filter(({ status }) => status === "rejected")
      ).toHaveLength(1);

      const requests = await pool.query<{ id: string }>(
        "select id from support_requests where user_id = $1 order by id",
        [userId]
      );
      requestIds.push(...requests.rows.map(({ id }) => id));
      expect(requestIds).toHaveLength(3);
      const outbox = await pool.query<{ count: number }>(
        `
          select count(*)::int as count
          from outbox_messages
          where topic = 'email.support-request'
            and aggregate_id = any($1::text[])
        `,
        [requestIds]
      );
      expect(outbox.rows[0]?.count).toBe(3);
    } finally {
      if (requestIds.length > 0) {
        await pool.query(
          "delete from outbox_messages where aggregate_id = any($1::text[])",
          [requestIds]
        );
      }
      await pool.query("delete from users where id = $1", [userId]);
    }
  });

  it("uses independent advisory locks for different accounts", async () => {
    const first = await pool.connect();
    const second = await pool.connect();
    try {
      await first.query("begin");
      await second.query("begin");
      await first.query(
        "select pg_advisory_xact_lock(hashtextextended($1, 0))",
        ["support-request:first-account"]
      );
      const result = await second.query<{ acquired: boolean }>(
        "select pg_try_advisory_xact_lock(hashtextextended($1, 0)) as acquired",
        ["support-request:second-account"]
      );
      expect(result.rows[0]?.acquired).toBe(true);
    } finally {
      await Promise.all([first.query("rollback"), second.query("rollback")]);
      first.release();
      second.release();
    }
  });
});
