import { createHash } from "node:crypto";
import type { MigrationMeta } from "drizzle-orm/migrator";
import type { PoolClient } from "pg";

interface AppliedMigrationRow {
  created_at: string;
  hash: string;
}

const COMMENT_ONLY_LINE = /^\s*(?:--.*)?$/;
const MIGRATION_LINE_BREAK = /\r?\n/;
const MIGRATION_LINE_ENDING = /\r\n?|\n/g;
const STATEMENT_BREAKPOINT = "--> statement-breakpoint";

const sha256 = (value: string): string =>
  createHash("sha256").update(value).digest("hex");

const isCompatibleMigrationHash = (
  migration: MigrationMeta,
  appliedHash: string
): boolean => {
  const source = migration.sql.join(STATEMENT_BREAKPOINT);
  const lfSource = source.replace(MIGRATION_LINE_ENDING, "\n");
  const compatibleHashes = new Set([
    migration.hash,
    sha256(lfSource),
    sha256(lfSource.replaceAll("\n", "\r\n")),
  ]);
  return compatibleHashes.has(appliedHash);
};

export const hasExecutableMigrationSql = (statement: string): boolean =>
  statement
    .split(MIGRATION_LINE_BREAK)
    .some((line) => !COMMENT_ONLY_LINE.test(line));

const assertAppliedJournalMatches = ({
  applied,
  migrations,
}: {
  applied: readonly AppliedMigrationRow[];
  migrations: readonly MigrationMeta[];
}): Set<number> => {
  const localByTimestamp = new Map(
    migrations.map((migration) => [migration.folderMillis, migration])
  );
  const appliedTimestamps = new Set<number>();

  for (const row of applied) {
    const timestamp = Number(row.created_at);
    const local = localByTimestamp.get(timestamp);
    if (!(local && isCompatibleMigrationHash(local, row.hash))) {
      throw new Error(
        `E2E migration journal drift at ${row.created_at}; recreate the disposable branch.`
      );
    }
    appliedTimestamps.add(timestamp);
  }

  return appliedTimestamps;
};

export const applyE2eMigrationsPerFile = async ({
  client,
  migrations,
}: {
  client: Pick<PoolClient, "query">;
  migrations: readonly MigrationMeta[];
}): Promise<void> => {
  await client.query("create schema if not exists drizzle");
  await client.query(`
    create table if not exists drizzle.__drizzle_migrations (
      id serial primary key,
      hash text not null,
      created_at bigint
    )
  `);
  const journal = await client.query<AppliedMigrationRow>(
    "select hash, created_at::text from drizzle.__drizzle_migrations order by created_at"
  );
  const appliedTimestamps = assertAppliedJournalMatches({
    applied: journal.rows,
    migrations,
  });

  for (const migration of migrations) {
    if (appliedTimestamps.has(migration.folderMillis)) {
      continue;
    }

    await client.query("begin");
    try {
      for (const statement of migration.sql) {
        if (hasExecutableMigrationSql(statement)) {
          await client.query(statement);
        }
      }
      await client.query(
        `insert into drizzle.__drizzle_migrations (hash, created_at)
         values ($1, $2)`,
        [migration.hash, migration.folderMillis]
      );
      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
  }
};
