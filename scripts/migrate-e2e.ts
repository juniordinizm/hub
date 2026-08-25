import { resolve } from "node:path";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { Pool } from "pg";
import { withVerifiedSslMode } from "../src/db/connection-url";
import { assertSafeE2eDatabaseEnvironment } from "../src/db/e2e-database-guard";
import { applyE2eMigrationsPerFile } from "../src/db/e2e-migrator";
import { runMigrationWithLock } from "../src/db/migration-lock";

type Environment = Readonly<Record<string, string | undefined>>;

export const createE2eMigrationEnvironment = (
  environment: Environment
): NodeJS.ProcessEnv => {
  assertSafeE2eDatabaseEnvironment(environment);
  const e2eDatabaseUrl = environment.E2E_DATABASE_URL?.trim();
  if (!e2eDatabaseUrl) {
    throw new Error("E2E database guard accepted an absent database URL.");
  }

  const directDatabaseUrl = environment.DATABASE_URL_DIRECT?.trim();
  if (directDatabaseUrl && directDatabaseUrl !== e2eDatabaseUrl) {
    throw new Error("DATABASE_URL_DIRECT must exactly match E2E_DATABASE_URL.");
  }

  return {
    ...environment,
    DATABASE_URL: e2eDatabaseUrl,
    DATABASE_URL_DIRECT: e2eDatabaseUrl,
    E2E_DATABASE_URL: e2eDatabaseUrl,
    NODE_ENV: "test",
  };
};

if (import.meta.main) {
  const environment = createE2eMigrationEnvironment(process.env);
  const connectionString = environment.E2E_DATABASE_URL;
  if (!connectionString) {
    throw new Error("E2E migration environment lost its database URL.");
  }
  const pool = new Pool({
    application_name: "protea-r-e2e-migration",
    connectionString: withVerifiedSslMode(connectionString),
    connectionTimeoutMillis: 10_000,
    max: 2,
  });
  const client = await pool.connect();
  try {
    const migrationsFolder = resolve(process.cwd(), "src/db/migrations");
    await runMigrationWithLock({
      client,
      migrate: async () =>
        await applyE2eMigrationsPerFile({
          client,
          migrations: readMigrationFiles({ migrationsFolder }),
        }),
    });
    process.stdout.write("E2E migrations applied.\n");
  } finally {
    await pool.end();
  }
}
