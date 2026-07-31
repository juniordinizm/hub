import { randomBytes } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { withVerifiedSslMode } from "./connection-url";
import {
  type MigrationJournalRow,
  PRODUCTION_CLEANUP_TABLES,
  TRUNCATED_OPERATIONAL_TABLES,
} from "./production-cleanup";
import { runProductionCleanup } from "./production-cleanup-executor";

const databaseUrl = process.env.CERTIFICATE_CONCURRENCY_DATABASE_URL;
if (!databaseUrl) {
  throw new Error(
    "CERTIFICATE_CONCURRENCY_DATABASE_URL is required for integration tests."
  );
}

const EXPECTED_JOURNAL: MigrationJournalRow[] = Array.from(
  { length: 44 },
  (_, index) => ({
    createdAt: String(1_700_000_000_000 + index),
    hash: `hash-${index}`,
  })
);
const SCHEMA = `cleanup_test_${randomBytes(8).toString("hex")}`;
const SAFE_SCHEMA_PATTERN = /^cleanup_test_[a-f0-9]+$/;
const pool = new Pool({
  application_name: "protea-r-cleanup-integration",
  connectionString: withVerifiedSslMode(databaseUrl),
  max: 4,
});
const parsedDatabaseUrl = new URL(databaseUrl);

const quoteIdentifier = (identifier: string): string =>
  `"${identifier.replaceAll('"', '""')}"`;
const qualified = (table: string): string =>
  `${quoteIdentifier(SCHEMA)}.${quoteIdentifier(table)}`;

const executorInput = {
  branchId: "br-integration",
  database: parsedDatabaseUrl.pathname.slice(1),
  expectedHost: parsedDatabaseUrl.hostname,
  host: parsedDatabaseUrl.hostname,
  schema: SCHEMA,
} as const;
const dependencies = {
  expectedJournal: EXPECTED_JOURNAL,
  readJournal: async (): Promise<MigrationJournalRow[]> => EXPECTED_JOURNAL,
};

const createSchema = async (client: PoolClient): Promise<void> => {
  if (!SAFE_SCHEMA_PATTERN.test(SCHEMA)) {
    throw new Error("Unsafe cleanup integration schema.");
  }
  await client.query(`create schema ${quoteIdentifier(SCHEMA)}`);
  await client.query(`
    create table ${qualified("users")} (
      id text primary key,
      email text not null
    );
    create table ${qualified("profiles")} (
      user_id text primary key
        references ${qualified("users")}(id) on delete cascade,
      role text not null,
      platform_blocked_at timestamptz
    );
    create table ${qualified("accounts")} (
      id text primary key,
      user_id text not null
        references ${qualified("users")}(id) on delete cascade,
      provider_id text not null,
      password text
    );
    create table ${qualified("sessions")} (
      id text primary key,
      user_id text not null
        references ${qualified("users")}(id) on delete cascade
    );
    create table ${qualified("audit_logs")} (
      id text primary key,
      actor_user_id text references ${qualified("users")}(id)
    );
  `);
  for (const table of TRUNCATED_OPERATIONAL_TABLES) {
    if (table !== "audit_logs") {
      await client.query(
        `create table ${qualified(table)} (id text primary key)`
      );
    }
  }
};

const seedFixture = async (client: PoolClient): Promise<void> => {
  const allTables = PRODUCTION_CLEANUP_TABLES.map(qualified).join(", ");
  await client.query(`truncate table ${allTables} cascade`);
  await client.query(
    `
      insert into ${qualified("users")} (id, email)
      values ('admin-id', 'admin@example.test'),
             ('student-id', 'student@example.test');
      insert into ${qualified("profiles")} (user_id, role, platform_blocked_at)
      values ('admin-id', 'admin', null),
             ('student-id', 'student', null);
      insert into ${qualified("accounts")} (id, user_id, provider_id, password)
      values ('admin-account', 'admin-id', 'credential', 'admin-hash'),
             ('student-account', 'student-id', 'credential', 'student-hash');
      insert into ${qualified("sessions")} (id, user_id)
      values ('admin-session', 'admin-id'),
             ('student-session', 'student-id');
      insert into ${qualified("audit_logs")} (id, actor_user_id)
      values ('audit-fixture', 'student-id');
    `
  );
  for (const table of TRUNCATED_OPERATIONAL_TABLES) {
    if (table !== "audit_logs") {
      await client.query(`insert into ${qualified(table)} (id) values ($1)`, [
        `${table}-fixture`,
      ]);
    }
  }
};

const readCount = async (
  client: Pool | PoolClient,
  table: string
): Promise<number> => {
  const result = await client.query<{ count: number }>(
    `select count(*)::int as count from ${qualified(table)}`
  );
  return result.rows[0]?.count ?? -1;
};

const plan = async () => {
  const client = await pool.connect();
  try {
    return await runProductionCleanup({
      client,
      dependencies,
      input: { ...executorInput, mode: "plan" },
    });
  } finally {
    client.release();
  }
};

describe("production cleanup PostgreSQL transaction", () => {
  beforeAll(async () => {
    const client = await pool.connect();
    try {
      await createSchema(client);
    } finally {
      client.release();
    }
  });

  beforeEach(async () => {
    const client = await pool.connect();
    try {
      await seedFixture(client);
    } finally {
      client.release();
    }
  });

  afterAll(async () => {
    try {
      if (!SAFE_SCHEMA_PATTERN.test(SCHEMA)) {
        throw new Error("Unsafe cleanup integration schema.");
      }
      await pool.query(`drop schema ${quoteIdentifier(SCHEMA)} cascade`);
    } finally {
      await pool.end();
    }
  });

  it("keeps plan mode read-only", async () => {
    const before = await pool.query<{ count: number }>(
      `select count(*)::int as count from ${qualified("orders")}`
    );

    const result = await plan();

    expect(result.status).toBe("planned");
    expect(await readCount(pool, "orders")).toBe(before.rows[0]?.count);
  });

  it("removes operational data and preserves only Admin identity", async () => {
    const planned = await plan();
    const client = await pool.connect();
    try {
      await expect(
        runProductionCleanup({
          client,
          dependencies,
          input: {
            ...executorInput,
            expectedFingerprint: planned.fingerprint,
            mode: "execute",
          },
        })
      ).resolves.toMatchObject({ status: "cleaned" });
    } finally {
      client.release();
    }

    for (const table of TRUNCATED_OPERATIONAL_TABLES) {
      expect(await readCount(pool, table)).toBe(0);
    }
    for (const table of ["users", "profiles", "accounts", "sessions"]) {
      expect(await readCount(pool, table)).toBe(1);
    }
    const identity = await pool.query<{ id: string }>(
      `select id from ${qualified("users")}`
    );
    expect(identity.rows).toEqual([{ id: "admin-id" }]);
  });

  it("rejects drift without changing data", async () => {
    const planned = await plan();
    await pool.query(
      `insert into ${qualified("orders")} (id) values ('drift-order')`
    );
    const client = await pool.connect();
    try {
      await expect(
        runProductionCleanup({
          client,
          dependencies,
          input: {
            ...executorInput,
            expectedFingerprint: planned.fingerprint,
            mode: "execute",
          },
        })
      ).rejects.toThrow(
        "Cleanup fingerprint does not match the locked snapshot."
      );
    } finally {
      client.release();
    }
    expect(await readCount(pool, "orders")).toBe(2);
    expect(await readCount(pool, "users")).toBe(2);
  });

  it("rejects an unexpected table", async () => {
    await pool.query(
      `create table ${qualified("surprise")} (id text primary key)`
    );
    try {
      await expect(plan()).rejects.toThrow("unexpected table: surprise");
    } finally {
      await pool.query(`drop table ${qualified("surprise")}`);
    }
  });

  it("loses immediately to another cleanup lock owner", async () => {
    const owner = await pool.connect();
    const contender = await pool.connect();
    try {
      await owner.query("begin");
      await owner.query("select pg_advisory_xact_lock(7032029001)");

      await expect(
        runProductionCleanup({
          client: contender,
          dependencies,
          input: { ...executorInput, mode: "plan" },
        })
      ).rejects.toThrow("Another production cleanup is already running.");
    } finally {
      await owner.query("rollback");
      owner.release();
      contender.release();
    }
  });

  it("rolls back truncate when deleting other users fails", async () => {
    const planned = await plan();
    await pool.query(`
      create function ${qualified("reject_user_delete")}()
      returns trigger language plpgsql as $$
      begin
        raise exception 'forced integration rollback';
      end;
      $$;
      create trigger reject_user_delete
      before delete on ${qualified("users")}
      for each row execute function ${qualified("reject_user_delete")}();
    `);
    const client = await pool.connect();
    try {
      await expect(
        runProductionCleanup({
          client,
          dependencies,
          input: {
            ...executorInput,
            expectedFingerprint: planned.fingerprint,
            mode: "execute",
          },
        })
      ).rejects.toThrow("Production cleanup failed.");
    } finally {
      client.release();
      await pool.query(
        `drop trigger reject_user_delete on ${qualified("users")}`
      );
      await pool.query(`drop function ${qualified("reject_user_delete")}()`);
    }

    expect(await readCount(pool, "orders")).toBe(1);
    expect(await readCount(pool, "users")).toBe(2);
  });

  it("requires a new plan before a second execution", async () => {
    const planned = await plan();
    const first = await pool.connect();
    try {
      await runProductionCleanup({
        client: first,
        dependencies,
        input: {
          ...executorInput,
          expectedFingerprint: planned.fingerprint,
          mode: "execute",
        },
      });
    } finally {
      first.release();
    }

    const second = await pool.connect();
    try {
      await expect(
        runProductionCleanup({
          client: second,
          dependencies,
          input: {
            ...executorInput,
            expectedFingerprint: planned.fingerprint,
            mode: "execute",
          },
        })
      ).rejects.toThrow(
        "Cleanup fingerprint does not match the locked snapshot."
      );
    } finally {
      second.release();
    }
  });
});
