import { resolve } from "node:path";
import { config } from "dotenv";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { withVerifiedSslMode } from "../src/db/connection-url";
import { runMigrationWithLock } from "../src/db/migration-lock";

config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

const directDatabaseUrl = process.env.DATABASE_URL_DIRECT?.trim();
if (!directDatabaseUrl) {
  throw new Error(
    "DATABASE_URL_DIRECT is required for the production migration job."
  );
}

const pool = new Pool({
  application_name: "protea-r-migration",
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
  process.stdout.write("Production migrations applied.\n");
} finally {
  await pool.end();
}
