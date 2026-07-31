import type { PoolClient, QueryResult } from "pg";
import { describe, expect, it, vi } from "vitest";
import {
  type MigrationJournalRow,
  PRODUCTION_CLEANUP_TABLES,
  TRUNCATED_OPERATIONAL_TABLES,
} from "./production-cleanup";
import { runProductionCleanup } from "./production-cleanup-executor";

const EXPECTED_JOURNAL: MigrationJournalRow[] = Array.from(
  { length: 44 },
  (_, index) => ({
    createdAt: String(1_700_000_000_000 + index),
    hash: `hash-${index}`,
  })
);
const COUNT_TABLE_PATTERN = /from "[^"]+"\."([^"]+)"/;
const FINGERPRINT_PATTERN = /^[0-9a-f]{64}$/;
const LOCK_STATEMENT_PATTERN = /^lock table .* in access exclusive mode$/;
const TRUNCATE_STATEMENT_PATTERN = /^truncate table /;
const IDENTITY_TABLES = new Set(["accounts", "profiles", "sessions", "users"]);

interface FakeClientOptions {
  failAfterTruncate?: boolean;
  lockAcquired?: boolean;
  orders?: number;
}

const getPreCleanupCount = (table: string, orders: number): number => {
  if (IDENTITY_TABLES.has(table)) {
    return 2;
  }
  return table === "orders" ? orders : 1;
};

const getPostCleanupCount = (table: string): number =>
  IDENTITY_TABLES.has(table) ? 1 : 0;

const createFakeClient = ({
  failAfterTruncate = false,
  lockAcquired = true,
  orders = 5,
}: FakeClientOptions = {}) => {
  const statements: string[] = [];
  let cleaned = false;
  const preCounts = Object.fromEntries(
    PRODUCTION_CLEANUP_TABLES.map((table) => [
      table,
      getPreCleanupCount(table, orders),
    ])
  );

  const query = vi.fn((statement: string): Partial<QueryResult> => {
    const normalized = statement.trim().replaceAll(/\s+/g, " ");
    statements.push(normalized);

    if (normalized.includes("pg_try_advisory_xact_lock")) {
      return { rows: [{ acquired: lockAcquired }] };
    }
    if (normalized.includes("information_schema.tables")) {
      return {
        rows: PRODUCTION_CLEANUP_TABLES.map((tableName) => ({
          table_name: tableName,
        })),
      };
    }
    if (normalized.includes("from drizzle.__drizzle_migrations")) {
      return {
        rows: EXPECTED_JOURNAL.map((row) => ({
          created_at: row.createdAt,
          hash: row.hash,
        })),
      };
    }
    if (normalized.includes("where p.role = 'admin'")) {
      return {
        rows: [
          {
            blocked: false,
            credential_count: 1,
            id: "admin-private-id",
          },
        ],
      };
    }
    if (normalized.startsWith("select count(*)::int as count from")) {
      const table = COUNT_TABLE_PATTERN.exec(normalized)?.[1];
      if (!table) {
        throw new Error("test could not parse count table");
      }
      const count = cleaned ? getPostCleanupCount(table) : preCounts[table];
      return { rows: [{ count }] };
    }
    if (normalized.startsWith("select 'accounts' as table_name")) {
      return {
        rows: [
          { count: 1, table_name: "accounts" },
          { count: 1, table_name: "profiles" },
          { count: 1, table_name: "sessions" },
          { count: 1, table_name: "users" },
        ],
      };
    }
    if (normalized.startsWith("truncate table")) {
      cleaned = true;
      return { rows: [] };
    }
    if (normalized.startsWith("delete from")) {
      if (failAfterTruncate) {
        throw new Error("private database detail");
      }
      return { rowCount: 1, rows: [] };
    }
    return { rows: [] };
  });

  return {
    client: { query } as unknown as PoolClient,
    get cleaned(): boolean {
      return cleaned;
    },
    statements,
  };
};

const input = {
  branchId: "br-production",
  database: "neondb",
  expectedHost: "ep-production.us-east-2.aws.neon.tech",
  host: "ep-production-pooler.us-east-2.aws.neon.tech",
  schema: "cleanup_test_a1",
} as const;

const planCleanup = async () => {
  const fake = createFakeClient();
  const result = await runProductionCleanup({
    client: fake.client,
    dependencies: { expectedJournal: EXPECTED_JOURNAL },
    input: { ...input, mode: "plan" },
  });
  return { fake, result };
};

describe("production cleanup executor", () => {
  it("plans in a repeatable read-only transaction without writing", async () => {
    const { fake, result } = await planCleanup();

    expect(result.status).toBe("planned");
    expect(result.rowCounts.orders).toBe(5);
    expect(result.fingerprint).toMatch(FINGERPRINT_PATTERN);
    expect(fake.cleaned).toBe(false);
    expect(fake.statements[0]).toBe(
      "begin isolation level repeatable read read only"
    );
    expect(fake.statements).toContain("rollback");
    expect(
      fake.statements.some((statement) => statement.startsWith("truncate"))
    ).toBe(false);
  });

  it("locks, verifies, truncates and preserves the Admin identity", async () => {
    const planned = await planCleanup();
    const fake = createFakeClient();

    const result = await runProductionCleanup({
      client: fake.client,
      dependencies: { expectedJournal: EXPECTED_JOURNAL },
      input: {
        ...input,
        expectedFingerprint: planned.result.fingerprint,
        mode: "execute",
      },
    });

    expect(result.status).toBe("cleaned");
    expect(fake.cleaned).toBe(true);
    expect(fake.statements[0]).toBe("begin isolation level serializable");
    expect(fake.statements).toEqual(
      expect.arrayContaining([
        expect.stringMatching(LOCK_STATEMENT_PATTERN),
        expect.stringMatching(TRUNCATE_STATEMENT_PATTERN),
        'delete from "cleanup_test_a1"."users" where id <> $1',
        "commit",
      ])
    );
    const truncate = fake.statements.find((statement) =>
      statement.startsWith("truncate table")
    );
    expect(truncate).toBeDefined();
    for (const table of TRUNCATED_OPERATIONAL_TABLES) {
      expect(truncate).toContain(`"cleanup_test_a1"."${table}"`);
    }
    expect(truncate).not.toContain("cascade");
  });

  it("rejects fingerprint drift before destructive SQL", async () => {
    const fake = createFakeClient({ orders: 6 });

    await expect(
      runProductionCleanup({
        client: fake.client,
        dependencies: { expectedJournal: EXPECTED_JOURNAL },
        input: {
          ...input,
          expectedFingerprint: "a".repeat(64),
          mode: "execute",
        },
      })
    ).rejects.toThrow(
      "Cleanup fingerprint does not match the locked snapshot."
    );

    expect(fake.cleaned).toBe(false);
    expect(fake.statements).toContain("rollback");
  });

  it("fails before snapshot when another cleanup owns the lock", async () => {
    const fake = createFakeClient({ lockAcquired: false });

    await expect(
      runProductionCleanup({
        client: fake.client,
        dependencies: { expectedJournal: EXPECTED_JOURNAL },
        input: { ...input, mode: "plan" },
      })
    ).rejects.toThrow("Another production cleanup is already running.");

    expect(
      fake.statements.some((statement) =>
        statement.includes("information_schema.tables")
      )
    ).toBe(false);
    expect(fake.statements).toContain("rollback");
  });

  it("rolls back and sanitizes a database failure after truncate", async () => {
    const planned = await planCleanup();
    const fake = createFakeClient({ failAfterTruncate: true });

    await expect(
      runProductionCleanup({
        client: fake.client,
        dependencies: { expectedJournal: EXPECTED_JOURNAL },
        input: {
          ...input,
          expectedFingerprint: planned.result.fingerprint,
          mode: "execute",
        },
      })
    ).rejects.toThrow("Production cleanup failed.");

    expect(fake.statements).toContain("rollback");
    try {
      await runProductionCleanup({
        client: createFakeClient({ failAfterTruncate: true }).client,
        dependencies: { expectedJournal: EXPECTED_JOURNAL },
        input: {
          ...input,
          expectedFingerprint: planned.result.fingerprint,
          mode: "execute",
        },
      });
    } catch (error) {
      expect(String(error)).not.toContain("private database detail");
    }
  });

  it("rejects a mismatched target before opening a transaction", async () => {
    const fake = createFakeClient();

    await expect(
      runProductionCleanup({
        client: fake.client,
        dependencies: { expectedJournal: EXPECTED_JOURNAL },
        input: {
          ...input,
          expectedHost: "different.example",
          mode: "plan",
        },
      })
    ).rejects.toThrow(
      "DATABASE_URL_DIRECT must target PRODUCTION_DATABASE_HOST."
    );
    expect(fake.statements).toEqual([]);
  });
});
