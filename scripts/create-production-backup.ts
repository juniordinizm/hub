import { randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  Pool,
  type PoolClient,
  type QueryResult,
  type QueryResultRow,
} from "pg";
import {
  buildProductionBackupKeys,
  type ProductionBackupManifestV1,
  recommendBackupCadence,
  selectBackupRetentionClasses,
} from "../src/tooling/production-backup";
import {
  assertProductionBackupDatabase,
  classifyProductionBackupFailure,
  type ProductionBackupDatabaseInspection,
  type ProductionBackupExecutionConfig,
  type ProductionBackupFailurePhase,
  type ProductionBackupProviderEvidence,
  resolveProductionBackupExecutionConfig,
  resolveProductionBackupFailureCategory,
  verifyProductionBackupProviderEvidence,
  withEncryptedProductionDump,
} from "../src/tooling/production-backup-execution";
import {
  createProductionBackupR2Client,
  findLatestBackupManifests,
  publishProductionBackup,
  resolveProductionBackupR2Config,
} from "../src/tooling/production-backup-r2";

interface MigrationJournal {
  entries: Array<{ tag: string; when: number }>;
}

interface ExpectedMigration {
  migrationTag: string;
  migrationTimestamp: number;
}

const API_TIMEOUT_MS = 10_000;
const CANONICAL_ALIAS = "app.neurocapacitar.com.br";

type BackupFailurePhase = ProductionBackupFailurePhase;

let currentPhase: BackupFailurePhase = "configuration-database";

const requiredEnvironmentValue = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
};

const readProviderJson = async ({
  authorization,
  url,
}: {
  authorization: string;
  url: string;
}): Promise<unknown> => {
  const response = await fetch(url, {
    headers: { authorization },
    signal: AbortSignal.timeout(API_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`Provider read failed with HTTP ${response.status}.`);
  }
  return (await response.json()) as unknown;
};

const inspectProviderProvenance = async (
  executionConfig: ProductionBackupExecutionConfig
): Promise<ProductionBackupProviderEvidence> => {
  const vercelToken = requiredEnvironmentValue("VERCEL_TOKEN");
  const vercelOrgId = requiredEnvironmentValue("VERCEL_ORG_ID");
  const vercelProjectId = requiredEnvironmentValue("VERCEL_PROJECT_ID");
  const neonApiKey = requiredEnvironmentValue("NEON_API_KEY");
  const encodedVercelProject = encodeURIComponent(vercelProjectId);
  const encodedProject = encodeURIComponent(
    executionConfig.productionProjectId
  );
  const encodedBranch = encodeURIComponent(executionConfig.productionBranchId);
  const [vercel, vercelDomains, neon, neonEndpoints] = await Promise.all([
    readProviderJson({
      authorization: `Bearer ${vercelToken}`,
      url: `https://api.vercel.com/v13/deployments/${CANONICAL_ALIAS}?teamId=${encodeURIComponent(vercelOrgId)}&withGitRepoInfo=true`,
    }),
    readProviderJson({
      authorization: `Bearer ${vercelToken}`,
      url: `https://api.vercel.com/v9/projects/${encodedVercelProject}/domains?teamId=${encodeURIComponent(vercelOrgId)}`,
    }),
    readProviderJson({
      authorization: `Bearer ${neonApiKey}`,
      url: `https://console.neon.tech/api/v2/projects/${encodedProject}/branches/${encodedBranch}`,
    }),
    readProviderJson({
      authorization: `Bearer ${neonApiKey}`,
      url: `https://console.neon.tech/api/v2/projects/${encodedProject}/branches/${encodedBranch}/endpoints`,
    }),
  ]);
  return verifyProductionBackupProviderEvidence({
    databaseHost: String(executionConfig.pgEnvironment.PGHOST ?? ""),
    expected: {
      canonicalAlias: CANONICAL_ALIAS,
      neonBranchId: executionConfig.productionBranchId,
      neonProjectId: executionConfig.productionProjectId,
      vercelProjectId,
    },
    neon,
    neonEndpoints,
    vercel,
    vercelDomains,
  });
};

const readExpectedMigration = async (): Promise<ExpectedMigration> => {
  const journalPath = join(
    import.meta.dirname,
    "../src/db/migrations/meta/_journal.json"
  );
  const journal = JSON.parse(
    await readFile(journalPath, "utf8")
  ) as MigrationJournal;
  const latest = journal.entries.at(-1);
  if (!(latest?.tag && Number.isSafeInteger(latest.when))) {
    throw new Error("Local migration journal is invalid.");
  }
  return {
    migrationTag: latest.tag,
    migrationTimestamp: latest.when,
  };
};

const toBoolean = (value: boolean | string): boolean =>
  value === true || value === "on" || value === "true";

const queryDatabase = async <Result extends QueryResultRow>(
  client: PoolClient,
  phase: "transaction" | "settings" | "identity" | "migration",
  sql: string
): Promise<QueryResult<Result>> => {
  try {
    return await client.query<Result>(sql);
  } catch (error: unknown) {
    const safeError = new Error(
      `Production backup database query failed: ${phase}.`
    );
    if (
      error instanceof Error &&
      "code" in error &&
      typeof error.code === "string"
    ) {
      Object.defineProperty(safeError, "code", { value: error.code });
    }
    throw safeError;
  }
};

const connectDatabase = async (pool: Pool): Promise<PoolClient> => {
  try {
    return await pool.connect();
  } catch (error: unknown) {
    const safeError = new Error(
      "Production backup database connection failed."
    );
    if (
      error instanceof Error &&
      "code" in error &&
      typeof error.code === "string"
    ) {
      Object.defineProperty(safeError, "code", { value: error.code });
    }
    throw safeError;
  }
};

const inspectDatabase = async (
  client: PoolClient,
  expectedMigration: ExpectedMigration
): Promise<ProductionBackupDatabaseInspection> => {
  await queryDatabase(
    client,
    "transaction",
    "begin isolation level repeatable read read only"
  );
  try {
    await queryDatabase(
      client,
      "settings",
      "set local statement_timeout = '5min'"
    );
    await queryDatabase(client, "settings", "set local lock_timeout = '10s'");
    const identity = await queryDatabase<{
      current_database: string;
      current_user: string;
      default_read_only: string;
      logical_database_bytes: string;
      pg_read_all_data_member: boolean;
      postgres_server_version: string;
      transaction_read_only: string;
    }>(
      client,
      "identity",
      `
      select
        current_database() as current_database,
        current_user as current_user,
        current_setting('default_transaction_read_only') as default_read_only,
        current_setting('transaction_read_only') as transaction_read_only,
        current_setting('server_version') as postgres_server_version,
        pg_database_size(current_database())::text as logical_database_bytes,
        pg_has_role(current_user, 'pg_read_all_data', 'member') as pg_read_all_data_member
    `
    );
    const migration = await queryDatabase<{ created_at: string }>(
      client,
      "migration",
      `
      select created_at::text as created_at
      from drizzle.__drizzle_migrations
      order by created_at desc
      limit 1
    `
    );
    const row = identity.rows[0];
    const migrationTimestamp = Number(migration.rows[0]?.created_at);
    if (!(row && Number.isSafeInteger(migrationTimestamp))) {
      throw new Error("Production backup database inspection is incomplete.");
    }
    return {
      currentDatabase: row.current_database,
      currentUser: row.current_user,
      defaultReadOnly: toBoolean(row.default_read_only),
      logicalDatabaseBytes: Number(row.logical_database_bytes),
      migrationTag: expectedMigration.migrationTag,
      migrationTimestamp,
      pgReadAllDataMember: row.pg_read_all_data_member,
      postgresServerVersion: row.postgres_server_version,
      transactionReadOnly: toBoolean(row.transaction_read_only),
    };
  } finally {
    await client.query("rollback");
  }
};

const main = async (): Promise<void> => {
  currentPhase = "configuration-database";
  const executionConfig = resolveProductionBackupExecutionConfig(process.env);
  currentPhase = "configuration-storage";
  const r2Config = resolveProductionBackupR2Config(process.env);
  currentPhase = "configuration-migration";
  const expectedMigration = await readExpectedMigration();
  currentPhase = "provider";
  const providerEvidence = await inspectProviderProvenance(executionConfig);
  const databaseUrl = process.env.BACKUP_DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("BACKUP_DATABASE_URL is required.");
  }
  const pool = new Pool({
    application_name: "protea-r-production-backup",
    connectionString: databaseUrl,
    max: 1,
  });
  const r2Client = createProductionBackupR2Client(r2Config);
  try {
    let databaseInspection: ProductionBackupDatabaseInspection;
    currentPhase = "database-connection";
    const client = await connectDatabase(pool);
    try {
      currentPhase = "database-inspection";
      databaseInspection = await inspectDatabase(client, expectedMigration);
      assertProductionBackupDatabase(databaseInspection, expectedMigration);
    } finally {
      client.release();
    }

    currentPhase = "storage";
    const latestManifests = await findLatestBackupManifests({
      bucketName: r2Config.bucketName,
      client: r2Client,
    });
    const createdAt = new Date();
    const backupId = randomUUID();
    const retentionClasses = selectBackupRetentionClasses({
      createdAt,
      ...(latestManifests.daily
        ? { latestDailyCreatedAt: latestManifests.daily }
        : {}),
      ...(latestManifests.weekly
        ? { latestWeeklyCreatedAt: latestManifests.weekly }
        : {}),
    });
    const frequentKey = buildProductionBackupKeys(backupId, ["frequent"])[0];
    if (!frequentKey) {
      throw new Error("Production backup key generation failed.");
    }

    currentPhase = "backup-command";
    const completed = await withEncryptedProductionDump({
      ageRecipient: executionConfig.ageRecipient,
      pgEnvironment: executionConfig.pgEnvironment,
      processEncryptedDump: async ({
        dumpBytes,
        dumpSha256,
        encryptedBytes,
        encryptedPath,
        encryptedSha256,
        pgDumpVersion,
      }) => {
        currentPhase = "storage";
        const manifest: ProductionBackupManifestV1 = {
          backupId,
          cadenceHours: executionConfig.cadenceHours,
          compression: "pg-custom-z9",
          createdAt: createdAt.toISOString(),
          dumpBytes,
          dumpSha256,
          encryptedBytes,
          encryptedObjectKey: frequentKey.encryptedObjectKey,
          encryptedSha256,
          encryption: "age-x25519",
          migrationTag: expectedMigration.migrationTag,
          migrationTimestamp: expectedMigration.migrationTimestamp,
          logicalDatabaseBytes: databaseInspection.logicalDatabaseBytes,
          pgDumpVersion,
          postgresServerVersion: databaseInspection.postgresServerVersion,
          releaseSha: providerEvidence.releaseSha,
          retentionClasses,
          schemaVersion: 1,
          sourceEnvironment: "production",
          sourceNeonBranchId: providerEvidence.sourceNeonBranchId,
          sourceNeonProjectId: providerEvidence.sourceNeonProjectId,
        };
        const manifestBytes = Buffer.byteLength(JSON.stringify(manifest));
        const recommendation = recommendBackupCadence({
          encryptedBytes,
          manifestBytes,
        });
        if (
          !recommendation ||
          executionConfig.cadenceHours < recommendation.cadenceHours
        ) {
          throw new Error(
            "Projected backup usage exceeds the 80 percent R2 Free reserve."
          );
        }
        return await publishProductionBackup({
          bucketName: r2Config.bucketName,
          client: r2Client,
          createEncryptedBody: () => createReadStream(encryptedPath),
          manifest,
        });
      },
    });

    process.stdout.write(
      `${JSON.stringify({
        backupId,
        bytes: completed.encryptedBytes,
        classes: retentionClasses,
        createdAt: createdAt.toISOString(),
        migration: expectedMigration.migrationTag,
        objectCount: completed.result.objectCount,
        status: "completed",
      })}\n`
    );
  } finally {
    r2Client.destroy();
    await pool.end();
  }
};

if (import.meta.main) {
  try {
    await main();
  } catch (error: unknown) {
    const category = classifyProductionBackupFailure(error);
    const safeCategory = resolveProductionBackupFailureCategory(
      category,
      currentPhase
    );
    process.stderr.write(`Production backup failed: ${safeCategory}.\n`);
    process.exitCode = 1;
  }
}
