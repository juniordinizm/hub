import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "dotenv";
import { Pool, type PoolClient, type PoolConfig } from "pg";
import { withVerifiedSslMode } from "../src/db/connection-url";
import {
  type CleanupArguments,
  type MigrationJournalRow,
  parseCleanupArguments,
} from "../src/db/production-cleanup";
import {
  type CleanupExecutionResult,
  runProductionCleanup,
} from "../src/db/production-cleanup-executor";

const EXPECTED_JOURNAL_COUNT = 44;
const EXPECTED_JOURNAL_TOP = "0043_staged_admin_image_uploads";
const MIGRATION_TAG_PATTERN = /^\d{4}_[a-z0-9_]+$/;
const APPLIED_MIGRATION_HASH_OVERRIDES: Readonly<Record<string, string>> = {
  "0009_lesson_watch_progress":
    "6eb810a886848de15920cb70399433bcff2b6c7756f13c2ff8930b66e7309600",
  "0037_certificate_templates":
    "eb34cd09c5f37f74b66be564efaa7ec87057ca412d2b397921b6c07944d9ad08",
  "0038_certificate_snapshot_baseline":
    "c86ee2d86297d032acac48323cb4275659fa94225dba165b83e9e2dc4a000b6d",
  "0039_certificate_snapshot_final":
    "c86ee2d86297d032acac48323cb4275659fa94225dba165b83e9e2dc4a000b6d",
};

interface CleanupPool {
  connect: () => Promise<PoolClient>;
  end: () => Promise<void>;
}

type CreatePool = (configuration: PoolConfig) => CleanupPool;
type ExecuteCleanup = typeof runProductionCleanup;

export class ProductionCleanupCliError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProductionCleanupCliError";
  }
}

const requireEnvironmentValue = (
  environment: Readonly<Record<string, string | undefined>>,
  name: string
): string => {
  const value = environment[name]?.trim();
  if (!value) {
    throw new ProductionCleanupCliError(`${name} is required.`);
  }
  return value;
};

const parseDatabaseTarget = (
  databaseUrl: string
): { database: string; host: string } => {
  let parsed: URL;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new ProductionCleanupCliError(
      "DATABASE_URL_DIRECT must be a valid PostgreSQL URL."
    );
  }
  if (!["postgres:", "postgresql:"].includes(parsed.protocol)) {
    throw new ProductionCleanupCliError(
      "DATABASE_URL_DIRECT must be a valid PostgreSQL URL."
    );
  }
  const database = decodeURIComponent(parsed.pathname.slice(1)).trim();
  if (!(parsed.hostname && database)) {
    throw new ProductionCleanupCliError(
      "DATABASE_URL_DIRECT must include host and database."
    );
  }
  return { database, host: parsed.hostname };
};

interface JournalFile {
  entries?: Array<{
    tag?: string;
    when?: number;
  }>;
}

const hashCanonicalMigrationSql = (migrationPath: string): string => {
  let migrationSql: string;
  try {
    migrationSql = readFileSync(migrationPath, "utf8");
  } catch {
    throw new ProductionCleanupCliError(
      "The local migration files do not match the journal through 0043."
    );
  }

  return createHash("sha256")
    .update(migrationSql.replace(/\r\n?/g, "\n"))
    .digest("hex");
};

export const readExpectedProductionCleanupJournal = (
  migrationsFolder: string
): MigrationJournalRow[] => {
  const journalPath = resolve(migrationsFolder, "meta", "_journal.json");
  let journalFile: JournalFile;
  try {
    journalFile = JSON.parse(readFileSync(journalPath, "utf8")) as JournalFile;
  } catch {
    throw new ProductionCleanupCliError(
      "The local migration journal could not be read."
    );
  }

  const expectedEntries = journalFile.entries?.slice(0, EXPECTED_JOURNAL_COUNT);
  if (
    expectedEntries?.length !== EXPECTED_JOURNAL_COUNT ||
    expectedEntries.at(-1)?.tag !== EXPECTED_JOURNAL_TOP ||
    expectedEntries.some(
      (entry) =>
        !(
          entry.tag &&
          Number.isSafeInteger(entry.when) &&
          MIGRATION_TAG_PATTERN.test(entry.tag)
        )
    )
  ) {
    throw new ProductionCleanupCliError(
      "The local migration journal does not end at 0043."
    );
  }

  return expectedEntries.map((entry) => ({
    createdAt: String(entry.when),
    hash:
      APPLIED_MIGRATION_HASH_OVERRIDES[entry.tag ?? ""] ??
      hashCanonicalMigrationSql(resolve(migrationsFolder, `${entry.tag}.sql`)),
  }));
};

const writeSafeResult = (
  result: CleanupExecutionResult,
  writeOutput: (value: string) => void
): void => {
  writeOutput(
    `${JSON.stringify({
      fingerprint: result.fingerprint,
      mode: result.mode,
      rowCounts: result.rowCounts,
      status: result.status,
    })}\n`
  );
};

export const runProductionCleanupCli = async ({
  argv,
  createPool = (configuration) => new Pool(configuration),
  environment,
  executeCleanup = runProductionCleanup,
  migrationsFolder,
  writeOutput = (value) => process.stdout.write(value),
}: {
  argv: readonly string[];
  createPool?: CreatePool;
  environment: Readonly<Record<string, string | undefined>>;
  executeCleanup?: ExecuteCleanup;
  migrationsFolder: string;
  writeOutput?: (value: string) => void;
}): Promise<void> => {
  let arguments_: CleanupArguments;
  try {
    arguments_ = parseCleanupArguments(argv);
  } catch (error) {
    throw new ProductionCleanupCliError(
      error instanceof Error ? error.message : "Cleanup arguments are invalid."
    );
  }

  const databaseUrl = requireEnvironmentValue(
    environment,
    "DATABASE_URL_DIRECT"
  );
  const expectedHost = requireEnvironmentValue(
    environment,
    "PRODUCTION_DATABASE_HOST"
  );
  const branchId = requireEnvironmentValue(
    environment,
    "PRODUCTION_NEON_BRANCH_ID"
  );
  const { database, host } = parseDatabaseTarget(databaseUrl);
  const expectedJournal =
    readExpectedProductionCleanupJournal(migrationsFolder);
  const pool = createPool({
    application_name: "protea-r-production-cleanup",
    connectionString: withVerifiedSslMode(databaseUrl),
    connectionTimeoutMillis: 10_000,
    max: 1,
  });
  let client: PoolClient | undefined;
  try {
    client = await pool.connect();
    const result = await executeCleanup({
      client,
      dependencies: { expectedJournal },
      input: {
        branchId,
        database,
        expectedHost,
        host,
        mode: arguments_.mode,
        ...(arguments_.mode === "execute"
          ? { expectedFingerprint: arguments_.fingerprint }
          : {}),
      },
    });
    writeSafeResult(result, writeOutput);
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.startsWith("Production cleanup") ||
        error.message.startsWith("Cleanup ") ||
        error.message.startsWith("Another production cleanup") ||
        error.message.startsWith("DATABASE_URL_DIRECT"))
    ) {
      throw new ProductionCleanupCliError(error.message);
    }
    throw new ProductionCleanupCliError("Production cleanup command failed.");
  } finally {
    client?.release();
    await pool.end();
  }
};

const main = async (): Promise<void> => {
  config({ path: ".env.local", quiet: true });
  config({ path: ".env", quiet: true });
  await runProductionCleanupCli({
    argv: process.argv.slice(2),
    environment: process.env,
    migrationsFolder: resolve(process.cwd(), "src/db/migrations"),
  });
};

if (import.meta.main) {
  try {
    await main();
  } catch (error) {
    const message =
      error instanceof ProductionCleanupCliError
        ? error.message
        : "Production cleanup command failed.";
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  }
}
