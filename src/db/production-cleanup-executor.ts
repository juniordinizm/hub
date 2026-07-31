import type { PoolClient } from "pg";
import {
  type AdminCandidate,
  buildCleanupSnapshot,
  type CleanupSnapshot,
  createCleanupFingerprint,
  type MigrationJournalRow,
  normalizeNeonHost,
  PRESERVED_IDENTITY_TABLES,
  PRODUCTION_CLEANUP_TABLES,
  TRUNCATED_OPERATIONAL_TABLES,
} from "./production-cleanup";

const CLEANUP_ADVISORY_LOCK_ID = "7032029001";
const FINGERPRINT_PATTERN = /^[0-9a-f]{64}$/;
const TEST_SCHEMA_PATTERN = /^cleanup_test_[a-f0-9]+$/;
const PUBLIC_SCHEMA = "public";

export interface CleanupExecutionInput {
  branchId: string;
  database: string;
  expectedFingerprint?: string;
  expectedHost: string;
  host: string;
  mode: "execute" | "plan";
  schema?: string;
}

export interface CleanupExecutorDependencies {
  expectedJournal: readonly MigrationJournalRow[];
  readJournal?: (client: PoolClient) => Promise<MigrationJournalRow[]>;
}

export interface CleanupExecutionResult {
  fingerprint: string;
  mode: "execute" | "plan";
  rowCounts: Record<string, number>;
  status: "cleaned" | "planned";
}

interface CleanupFacts {
  adminCandidates: AdminCandidate[];
  publicTables: string[];
  rowCounts: Record<string, number>;
}

type IdentityCounts = Record<
  (typeof PRESERVED_IDENTITY_TABLES)[number],
  number
>;

class ProductionCleanupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProductionCleanupError";
  }
}

const quoteIdentifier = (identifier: string): string =>
  `"${identifier.replaceAll('"', '""')}"`;

const resolveSchema = (schema = PUBLIC_SCHEMA): string => {
  if (schema !== PUBLIC_SCHEMA && !TEST_SCHEMA_PATTERN.test(schema)) {
    throw new ProductionCleanupError("Cleanup schema is not allowed.");
  }
  return schema;
};

const getTargetProblems = ({
  branchId,
  database,
  expectedHost,
  host,
}: Pick<
  CleanupExecutionInput,
  "branchId" | "database" | "expectedHost" | "host"
>): string[] => {
  const problems: string[] = [];
  if (
    !expectedHost.trim() ||
    normalizeNeonHost(host) !== normalizeNeonHost(expectedHost)
  ) {
    problems.push("DATABASE_URL_DIRECT must target PRODUCTION_DATABASE_HOST.");
  }
  if (!database.trim()) {
    problems.push("Production database name is required.");
  }
  if (!branchId.trim()) {
    problems.push("PRODUCTION_NEON_BRANCH_ID is required.");
  }
  return problems;
};

const readPublicTables = async (
  client: PoolClient,
  schema: string
): Promise<string[]> => {
  const result = await client.query<{ table_name: string }>(
    `
      select table_name
      from information_schema.tables
      where table_schema = $1
        and table_type = 'BASE TABLE'
      order by table_name
    `,
    [schema]
  );
  return result.rows.map((row) => row.table_name);
};

const readDefaultJournal = async (
  client: PoolClient
): Promise<MigrationJournalRow[]> => {
  const result = await client.query<{
    created_at: string | number;
    hash: string;
  }>(
    `
      select hash, created_at
      from drizzle.__drizzle_migrations
      order by created_at
    `
  );
  return result.rows.map((row) => ({
    createdAt: String(row.created_at),
    hash: row.hash,
  }));
};

const readAdminCandidates = async (
  client: PoolClient,
  schema: string
): Promise<AdminCandidate[]> => {
  const profiles = `${quoteIdentifier(schema)}.${quoteIdentifier("profiles")}`;
  const accounts = `${quoteIdentifier(schema)}.${quoteIdentifier("accounts")}`;
  const result = await client.query<{
    blocked: boolean;
    credential_count: number;
    id: string;
  }>(`
    select
      p.user_id as id,
      (p.platform_blocked_at is not null) as blocked,
      count(a.id) filter (
        where a.provider_id = 'credential'
          and a.password is not null
          and length(a.password) > 0
      )::int as credential_count
    from ${profiles} p
    left join ${accounts} a on a.user_id = p.user_id
    where p.role = 'admin'
    group by p.user_id, p.platform_blocked_at
    order by p.user_id
  `);
  return result.rows.map((row) => ({
    blocked: row.blocked,
    credentialCount: row.credential_count,
    id: row.id,
  }));
};

const readRowCounts = async (
  client: PoolClient,
  schema: string
): Promise<Record<string, number>> => {
  const counts: Record<string, number> = {};
  for (const table of PRODUCTION_CLEANUP_TABLES) {
    const result = await client.query<{ count: number }>(
      `select count(*)::int as count from ${quoteIdentifier(
        schema
      )}.${quoteIdentifier(table)}`
    );
    counts[table] = result.rows[0]?.count ?? -1;
  }
  return counts;
};

const readFacts = async (
  client: PoolClient,
  schema: string
): Promise<CleanupFacts> => ({
  adminCandidates: await readAdminCandidates(client, schema),
  publicTables: await readPublicTables(client, schema),
  rowCounts: await readRowCounts(client, schema),
});

const readPreservedIdentityCounts = async (
  client: PoolClient,
  schema: string,
  adminId: string
): Promise<IdentityCounts> => {
  const qualified = (table: string): string =>
    `${quoteIdentifier(schema)}.${quoteIdentifier(table)}`;
  const result = await client.query<{
    count: number;
    table_name: (typeof PRESERVED_IDENTITY_TABLES)[number];
  }>(
    `
      select 'accounts' as table_name, count(*)::int as count
      from ${qualified("accounts")} where user_id = $1
      union all
      select 'profiles' as table_name, count(*)::int as count
      from ${qualified("profiles")} where user_id = $1
      union all
      select 'sessions' as table_name, count(*)::int as count
      from ${qualified("sessions")} where user_id = $1
      union all
      select 'users' as table_name, count(*)::int as count
      from ${qualified("users")} where id = $1
    `,
    [adminId]
  );

  const counts = {
    accounts: -1,
    profiles: -1,
    sessions: -1,
    users: -1,
  };
  for (const row of result.rows) {
    counts[row.table_name] = row.count;
  }
  return counts;
};

const buildSnapshot = async ({
  branchId,
  client,
  database,
  dependencies,
  host,
  schema,
}: {
  branchId: string;
  client: PoolClient;
  database: string;
  dependencies: CleanupExecutorDependencies;
  host: string;
  schema: string;
}): Promise<{
  adminId: string;
  facts: CleanupFacts;
  snapshot: CleanupSnapshot;
}> => {
  const facts = await readFacts(client, schema);
  const journal = dependencies.readJournal
    ? await dependencies.readJournal(client)
    : await readDefaultJournal(client);
  const snapshot = buildCleanupSnapshot({
    adminCandidates: facts.adminCandidates,
    branchId,
    database,
    expectedJournal: dependencies.expectedJournal,
    host,
    journal,
    publicTables: facts.publicTables,
    rowCounts: facts.rowCounts,
  });
  const adminId = facts.adminCandidates[0]?.id;
  if (!adminId) {
    throw new ProductionCleanupError("Exactly one usable Admin is required.");
  }
  return { adminId, facts, snapshot };
};

const assertPostconditions = ({
  after,
  preservedIdentityCounts,
}: {
  after: CleanupFacts;
  preservedIdentityCounts: IdentityCounts;
}): void => {
  for (const table of TRUNCATED_OPERATIONAL_TABLES) {
    if (after.rowCounts[table] !== 0) {
      throw new ProductionCleanupError(
        "Cleanup postcondition failed for operational tables."
      );
    }
  }
  for (const table of PRESERVED_IDENTITY_TABLES) {
    if (after.rowCounts[table] !== preservedIdentityCounts[table]) {
      throw new ProductionCleanupError(
        "Cleanup postcondition failed for preserved identity."
      );
    }
  }
  if (
    after.adminCandidates.length !== 1 ||
    after.adminCandidates[0]?.blocked ||
    (after.adminCandidates[0]?.credentialCount ?? 0) < 1
  ) {
    throw new ProductionCleanupError(
      "Cleanup postcondition failed for the Admin."
    );
  }
};

const rollbackQuietly = async (client: PoolClient): Promise<void> => {
  try {
    await client.query("rollback");
  } catch {
    // The caller still receives a sanitized cleanup failure.
  }
};

export const runProductionCleanup = async ({
  client,
  dependencies,
  input,
}: {
  client: PoolClient;
  dependencies: CleanupExecutorDependencies;
  input: CleanupExecutionInput;
}): Promise<CleanupExecutionResult> => {
  const targetProblems = getTargetProblems(input);
  if (targetProblems.length > 0) {
    throw new ProductionCleanupError(targetProblems.join(" "));
  }
  if (
    input.mode === "execute" &&
    !FINGERPRINT_PATTERN.test(input.expectedFingerprint ?? "")
  ) {
    throw new ProductionCleanupError(
      "A valid dry-run fingerprint is required for execute mode."
    );
  }

  const schema = resolveSchema(input.schema);
  let transactionOpen = false;
  try {
    await client.query(
      input.mode === "plan"
        ? "begin isolation level repeatable read read only"
        : "begin isolation level serializable"
    );
    transactionOpen = true;
    await client.query("set local statement_timeout = '30s'");
    await client.query("set local lock_timeout = '10s'");
    const lockFunction =
      input.mode === "plan"
        ? "pg_try_advisory_xact_lock_shared"
        : "pg_try_advisory_xact_lock";
    const lock = await client.query<{ acquired: boolean }>(
      `select ${lockFunction}($1) as acquired`,
      [CLEANUP_ADVISORY_LOCK_ID]
    );
    if (!lock.rows[0]?.acquired) {
      throw new ProductionCleanupError(
        "Another production cleanup is already running."
      );
    }

    if (input.mode === "execute") {
      const tables = PRODUCTION_CLEANUP_TABLES.map(
        (table) => `${quoteIdentifier(schema)}.${quoteIdentifier(table)}`
      ).join(", ");
      await client.query(`lock table ${tables} in access exclusive mode`);
    }

    const before = await buildSnapshot({
      branchId: input.branchId,
      client,
      database: input.database,
      dependencies,
      host: input.host,
      schema,
    });
    const fingerprint = createCleanupFingerprint(before.snapshot);

    if (input.mode === "plan") {
      await client.query("rollback");
      transactionOpen = false;
      return {
        fingerprint,
        mode: input.mode,
        rowCounts: before.facts.rowCounts,
        status: "planned",
      };
    }

    if (fingerprint !== input.expectedFingerprint) {
      throw new ProductionCleanupError(
        "Cleanup fingerprint does not match the locked snapshot."
      );
    }

    const preservedIdentityCounts = await readPreservedIdentityCounts(
      client,
      schema,
      before.adminId
    );
    const truncateTables = TRUNCATED_OPERATIONAL_TABLES.map(
      (table) => `${quoteIdentifier(schema)}.${quoteIdentifier(table)}`
    ).join(", ");
    await client.query(`truncate table ${truncateTables}`);
    await client.query(
      `delete from ${quoteIdentifier(schema)}.${quoteIdentifier(
        "users"
      )} where id <> $1`,
      [before.adminId]
    );

    const after = await readFacts(client, schema);
    assertPostconditions({ after, preservedIdentityCounts });
    await client.query("commit");
    transactionOpen = false;
    return {
      fingerprint,
      mode: input.mode,
      rowCounts: before.facts.rowCounts,
      status: "cleaned",
    };
  } catch (error) {
    if (transactionOpen) {
      await rollbackQuietly(client);
    }
    if (
      error instanceof ProductionCleanupError ||
      (error instanceof Error &&
        error.message.startsWith("Production cleanup precondition failed:"))
    ) {
      throw error;
    }
    throw new ProductionCleanupError("Production cleanup failed.");
  }
};
