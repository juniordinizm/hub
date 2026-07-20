import { config } from "dotenv";
import { Pool } from "pg";
import { withVerifiedSslMode } from "../src/db/connection-url";
import { runInitialCatalogSeed } from "../src/db/initial-catalog-seed";
import { assertSafeLocalDatabaseCommand } from "../src/lib/local-database-command";

config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

const rawDatabaseUrl =
  process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL;

if (!rawDatabaseUrl) {
  throw new Error("DATABASE_URL or DATABASE_URL_DIRECT is required.");
}

const target = assertSafeLocalDatabaseCommand({
  databaseUrl: rawDatabaseUrl,
  environment: process.env.NODE_ENV ?? "development",
  operation: "seed",
});
const pool = new Pool({
  connectionString: withVerifiedSslMode(rawDatabaseUrl),
});

const main = async (): Promise<void> => {
  console.log(
    `Seed local autorizado para banco ${target.databaseName} em ${target.host}.`
  );
  const client = await pool.connect();

  try {
    await client.query("begin");
    await runInitialCatalogSeed(client);
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }

  console.log("Seed inicial PROTEA-R concluido.");
};

await main();
