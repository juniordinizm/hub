import { config } from "dotenv";
import { Pool } from "pg";
import { withVerifiedSslMode } from "../src/db/connection-url";
import {
  assertSafeLocalDatabaseCommand,
  parseLocalResetArguments,
} from "../src/lib/local-database-command";

config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

const rawDatabaseUrl =
  process.env.DATABASE_URL ?? process.env.DATABASE_URL_DIRECT;

if (!rawDatabaseUrl) {
  throw new Error("DATABASE_URL or DATABASE_URL_DIRECT is required.");
}

const resetArguments = parseLocalResetArguments(process.argv.slice(2));
const allowedDatabaseNames = (process.env.LOCAL_DATABASE_NAMES ?? "")
  .split(",")
  .map((databaseName) => databaseName.trim())
  .filter(Boolean);
const affectedTables = [
  "users (CASCADE)",
  "courses (CASCADE)",
  "faq_items",
  "audit_logs",
  "webhook_events",
].join(", ");
const target = assertSafeLocalDatabaseCommand({
  allowDestructiveLocalReset: resetArguments.allowDestructiveLocalReset,
  allowedDatabaseNames,
  confirmation: resetArguments.confirmation,
  databaseUrl: rawDatabaseUrl,
  environment: process.env.NODE_ENV ?? "development",
  operation: "reset",
});
const pool = new Pool({
  connectionString: withVerifiedSslMode(rawDatabaseUrl),
});

const main = async (): Promise<void> => {
  console.warn(
    `Reset local autorizado para banco ${target.databaseName} em ${target.host}. Tabelas afetadas: ${affectedTables}.`
  );
  const client = await pool.connect();

  try {
    await client.query("begin");
    await client.query("truncate table users cascade");
    await client.query("truncate table courses cascade");
    await client.query("truncate table faq_items cascade");
    await client.query("truncate table audit_logs cascade");
    await client.query("truncate table webhook_events cascade");
    await client.query("commit");
    console.log("Banco de dados local limpo.");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
};

await main();
