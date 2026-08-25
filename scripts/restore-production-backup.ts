import { constants } from "node:fs";
import { access, readFile } from "node:fs/promises";
import { join } from "node:path";
import { Pool, type PoolClient } from "pg";
import {
  createProductionBackupR2Client,
  downloadProductionBackupObject,
  readProductionBackupManifest,
  resolveProductionRestoreR2Config,
} from "../src/tooling/production-backup-r2";
import {
  assertEmptyRestoreTarget,
  resolveProductionRestoreConfig,
  runProductionRestore,
} from "../src/tooling/production-restore";

interface MigrationJournal {
  entries: Array<{ tag: string; when: number }>;
}

const CRITICAL_INDEXES = [
  "certificates_user_course_active_unique_idx",
  "enrollments_user_course_unique_idx",
  "orders_provider_payment_unique_idx",
  "users_email_lower_unique_idx",
] as const;
const MINIMUM_APPLICATION_TABLES = 43;

const readMigrationJournal = async (): Promise<MigrationJournal> => {
  const source = await readFile(
    join(import.meta.dirname, "../src/db/migrations/meta/_journal.json"),
    "utf8"
  );
  const journal = JSON.parse(source) as MigrationJournal;
  if (!Array.isArray(journal.entries) || journal.entries.length === 0) {
    throw new Error("Local migration journal is invalid.");
  }
  return journal;
};

const readTargetIdentity = async (
  client: PoolClient
): Promise<{ applicationRelationCount: number; currentDatabase: string }> => {
  const result = await client.query<{
    application_relation_count: number;
    current_database: string;
  }>(`
    select
      current_database() as current_database,
      (
        select count(*)::int
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname in ('public', 'drizzle')
          and c.relkind in ('r', 'p', 'v', 'm', 'S', 'f')
      ) as application_relation_count
  `);
  const row = result.rows[0];
  if (!row) {
    throw new Error("Restore target identity is unavailable.");
  }
  return {
    applicationRelationCount: row.application_relation_count,
    currentDatabase: row.current_database,
  };
};

const verifyRestoredDatabase = async ({
  client,
  migrationTimestamp,
}: {
  client: PoolClient;
  migrationTimestamp: number;
}): Promise<{ tableCount: number }> => {
  const result = await client.query<{
    constraint_count: number;
    critical_index_count: number;
    migration_timestamp: string;
    table_count: number;
  }>(
    `
      select
        (select count(*)::int from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE') as table_count,
        (select count(*)::int from pg_constraint c join pg_namespace n on n.oid = c.connamespace where n.nspname = 'public') as constraint_count,
        (select count(*)::int from pg_indexes where schemaname = 'public' and indexname = any($1::text[])) as critical_index_count,
        (select created_at::text from drizzle.__drizzle_migrations order by created_at desc limit 1) as migration_timestamp
    `,
    [CRITICAL_INDEXES]
  );
  const row = result.rows[0];
  if (
    !row ||
    row.table_count < MINIMUM_APPLICATION_TABLES ||
    row.constraint_count < 1 ||
    row.critical_index_count !== CRITICAL_INDEXES.length ||
    Number(row.migration_timestamp) !== migrationTimestamp
  ) {
    throw new Error("Restored database postflight failed.");
  }
  await client.query(`
    select
      (select count(*) from users) as users,
      (select count(*) from courses) as courses,
      (select count(*) from orders) as orders,
      (select count(*) from certificates) as certificates
  `);
  return { tableCount: row.table_count };
};

const main = async (): Promise<void> => {
  const startedAt = Date.now();
  const restoreConfig = resolveProductionRestoreConfig(process.env, {
    workspaceDirectory: join(import.meta.dirname, ".."),
  });
  await access(restoreConfig.identityFile, constants.R_OK);
  const r2Config = resolveProductionRestoreR2Config(process.env);
  const journal = await readMigrationJournal();
  const knownMigrationTags = new Set(journal.entries.map(({ tag }) => tag));
  const r2Client = createProductionBackupR2Client(r2Config);
  const targetUrl = process.env.RESTORE_DATABASE_URL;
  if (!targetUrl) {
    throw new Error("RESTORE_DATABASE_URL is required.");
  }
  const pool = new Pool({
    application_name: "protea-r-production-restore-drill",
    connectionString: targetUrl,
    max: 1,
  });

  try {
    const manifest = await readProductionBackupManifest({
      bucketName: r2Config.bucketName,
      client: r2Client,
      key: restoreConfig.manifestKey,
      knownMigrationTags,
    });
    if (!manifest.retentionClasses.some((value) => value === "frequent")) {
      throw new Error("Restore manifest lacks the frequent retention class.");
    }
    const client = await pool.connect();
    try {
      const result = await runProductionRestore({
        assertTargetEmpty: async () => {
          assertEmptyRestoreTarget({
            ...(await readTargetIdentity(client)),
            expectedDatabase: restoreConfig.targetDatabase,
          });
        },
        downloadEncrypted: async (destinationPath) =>
          await downloadProductionBackupObject({
            bucketName: r2Config.bucketName,
            client: r2Client,
            destinationPath,
            key: manifest.encryptedObjectKey,
          }),
        identityFile: restoreConfig.identityFile,
        manifest,
        pgEnvironment: restoreConfig.pgEnvironment,
        verifyRestoredDatabase: async () =>
          await verifyRestoredDatabase({
            client,
            migrationTimestamp: manifest.migrationTimestamp,
          }),
      });
      process.stdout.write(
        `${JSON.stringify({
          backupId: manifest.backupId,
          migration: manifest.migrationTag,
          rtoSeconds: Math.ceil((Date.now() - startedAt) / 1000),
          status: "restored",
          tableCount: result.tableCount,
        })}\n`
      );
    } finally {
      client.release();
    }
  } finally {
    r2Client.destroy();
    await pool.end();
  }
};

if (import.meta.main) {
  try {
    await main();
  } catch {
    process.stderr.write("Production backup restore failed.\n");
    process.exitCode = 1;
  }
}
