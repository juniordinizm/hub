import { Pool } from "pg";
import {
  assertSafeCiMigrationPreparationEnvironment,
  prepareCiMigrationDatabase,
} from "../src/db/ci-migration-preparation";
import { withVerifiedSslMode } from "../src/db/connection-url";

const main = async (): Promise<void> => {
  assertSafeCiMigrationPreparationEnvironment(process.env);
  const databaseUrl = process.env.DATABASE_URL_DIRECT?.trim();
  if (!databaseUrl) {
    throw new Error("CI database guard accepted an absent database URL.");
  }

  const pool = new Pool({
    application_name: "protea-r-ci-migration-preparation",
    connectionString: withVerifiedSslMode(databaseUrl),
    connectionTimeoutMillis: 10_000,
    max: 1,
  });
  try {
    const client = await pool.connect();
    try {
      const result = await prepareCiMigrationDatabase(client);
      process.stdout.write(`${JSON.stringify(result)}\n`);
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
};

if (import.meta.main) {
  try {
    await main();
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "CI migration preparation failed.";
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  }
}
