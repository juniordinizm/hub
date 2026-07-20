import { resolve } from "node:path";
import { config } from "dotenv";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { withVerifiedSslMode } from "../src/db/connection-url";
import {
  createSmokeDatabaseName,
  replaceDatabaseName,
} from "../src/db/empty-database-smoke";
import { runInitialCatalogSeed } from "../src/db/initial-catalog-seed";
import { assertSafeLocalDatabaseCommand } from "../src/lib/local-database-command";

config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

const adminDatabaseUrl =
  process.env.SMOKE_DATABASE_URL ??
  process.env.DATABASE_URL_DIRECT ??
  process.env.DATABASE_URL;

if (!adminDatabaseUrl) {
  throw new Error(
    "SMOKE_DATABASE_URL, DATABASE_URL_DIRECT or DATABASE_URL is required."
  );
}

assertSafeLocalDatabaseCommand({
  databaseUrl: adminDatabaseUrl,
  environment: process.env.NODE_ENV ?? "development",
  operation: "seed",
});

const databaseName = createSmokeDatabaseName(Date.now());
const applicationDatabaseUrl = replaceDatabaseName(
  adminDatabaseUrl,
  databaseName
);
const adminPool = new Pool({
  connectionString: withVerifiedSslMode(adminDatabaseUrl),
});
const applicationPool = new Pool({
  connectionString: withVerifiedSslMode(applicationDatabaseUrl),
});

const assertSmokeInvariants = async (): Promise<void> => {
  const result = await applicationPool.query<{
    courses: string;
    enrollments_without_grants: string;
    faqRows: string;
    lessons: string;
    modules: string;
  }>(`
    select
      (select count(*) from courses where slug = 'protea-r') as courses,
      (select count(*) from modules join courses on courses.id = modules.course_id where courses.slug = 'protea-r') as modules,
      (select count(*) from lessons join modules on modules.id = lessons.module_id join courses on courses.id = modules.course_id where courses.slug = 'protea-r') as lessons,
      (select count(*) from faq_items) as "faqRows",
      (select count(*) from enrollments e where not exists (select 1 from enrollment_grants g where g.user_id = e.user_id and g.course_id = e.course_id and g.status = 'active')) as enrollments_without_grants
  `);
  const row = result.rows[0];

  if (
    row?.courses !== "1" ||
    row.modules !== "6" ||
    row.lessons !== "28" ||
    row.faqRows !== "3" ||
    row.enrollments_without_grants !== "0"
  ) {
    throw new Error(
      "O smoke de banco vazio encontrou invariantes divergentes."
    );
  }
};

const main = async (): Promise<void> => {
  try {
    await adminPool.query(`create database ${databaseName}`);
    const database = drizzle(applicationPool);
    await migrate(database, {
      migrationsFolder: resolve(import.meta.dirname, "../src/db/migrations"),
    });

    const client = await applicationPool.connect();
    try {
      await client.query("begin");
      await runInitialCatalogSeed(client);
      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }

    const retryClient = await applicationPool.connect();
    try {
      await retryClient.query("begin");
      await runInitialCatalogSeed(retryClient);
      await retryClient.query("commit");
    } catch (error) {
      await retryClient.query("rollback");
      throw error;
    } finally {
      retryClient.release();
    }

    await assertSmokeInvariants();
    console.log(`Smoke de banco vazio passou: ${databaseName}.`);
  } finally {
    await applicationPool.end();
    await adminPool.query(`drop database if exists ${databaseName}`);
    await adminPool.end();
  }
};

await main();
