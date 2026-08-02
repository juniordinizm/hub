import { resolve } from "node:path";
import { config } from "dotenv";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { withVerifiedSslMode } from "../src/db/connection-url";
import { runMigrationWithLock } from "../src/db/migration-lock";
import { assertStagingTarget } from "../src/db/staging-target";

config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

const directDatabaseUrl = process.env.DATABASE_URL_DIRECT?.trim();
if (!directDatabaseUrl) {
  throw new Error("DATABASE_URL_DIRECT is required for Staging migrations.");
}
const target = assertStagingTarget({
  branchId: process.env.STAGING_NEON_BRANCH_ID,
  confirmation: process.env.STAGING_OPERATION_CONFIRMATION,
  databaseUrl: directDatabaseUrl,
  expectedBranchId: process.env.STAGING_NEON_BRANCH_ID,
  expectedHost: process.env.STAGING_DATABASE_HOST,
});

const pool = new Pool({
  application_name: "protea-r-staging-migration",
  connectionString: withVerifiedSslMode(directDatabaseUrl),
  connectionTimeoutMillis: 10_000,
  max: 2,
});
const database = drizzle(pool);
const lockClient = await pool.connect();

try {
  await runMigrationWithLock({
    client: lockClient,
    migrate: () =>
      migrate(database, {
        migrationsFolder:
          process.env.MIGRATIONS_FOLDER ??
          resolve(process.cwd(), "src/db/migrations"),
      }),
  });
  process.stdout.write(
    `Staging migrations applied on ${target.databaseName} at ${target.host}; branch ${target.branchId}.\n`
  );
} finally {
  await pool.end();
}
