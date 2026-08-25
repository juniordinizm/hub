import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { config } from "dotenv";
import { Pool } from "pg";
import { withVerifiedSslMode } from "../src/db/connection-url";
import {
  resolveStagingAdminSeedAccounts,
  seedStagingAdminAccounts,
} from "../src/db/staging-admin-seed";
import { assertStagingTarget } from "../src/db/staging-target";

config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

const readRequiredEnvironment = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required for the Staging Admin seed.`);
  }
  return value;
};

const directDatabaseUrl = readRequiredEnvironment("DATABASE_URL_DIRECT");
assertStagingTarget({
  branchId: process.env.STAGING_NEON_BRANCH_ID,
  confirmation: process.env.STAGING_OPERATION_CONFIRMATION,
  databaseUrl: directDatabaseUrl,
  expectedBranchId: process.env.STAGING_NEON_BRANCH_ID,
  expectedHost: process.env.STAGING_DATABASE_HOST,
});
readRequiredEnvironment("BETTER_AUTH_SECRET");
const accounts = resolveStagingAdminSeedAccounts(process.env);
const pool = new Pool({
  application_name: "protea-r-staging-admin-seed",
  connectionString: withVerifiedSslMode(directDatabaseUrl),
  max: 1,
});
const client = await pool.connect();
let outcome: { created: number; updated: number };

try {
  outcome = await seedStagingAdminAccounts({
    accounts,
    client: {
      query: async (text, values) => await client.query(text, values),
    },
    createId: randomUUID,
    hashPassword,
  });
} finally {
  client.release();
  await pool.end();
}

process.stdout.write(
  `Staging Admin accounts ready: ${outcome.created} created, ${outcome.updated} updated; sessions revoked.\n`
);
