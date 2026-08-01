import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { config } from "dotenv";
import { Pool } from "pg";
import { withVerifiedSslMode } from "../src/db/connection-url";
import { assertStagingTarget } from "../src/db/staging-target";
import { normalizeBuyerEmail } from "../src/features/payments/buyer-identity";

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
const target = assertStagingTarget({
  branchId: process.env.STAGING_NEON_BRANCH_ID,
  confirmation: process.env.STAGING_OPERATION_CONFIRMATION,
  databaseUrl: directDatabaseUrl,
  expectedBranchId: process.env.STAGING_NEON_BRANCH_ID,
  expectedHost: process.env.STAGING_DATABASE_HOST,
});
const email = normalizeBuyerEmail(
  readRequiredEnvironment("STAGING_ADMIN_EMAIL")
);
const password = readRequiredEnvironment("STAGING_ADMIN_PASSWORD");
readRequiredEnvironment("BETTER_AUTH_SECRET");
const passwordHash = await hashPassword(password);
const pool = new Pool({
  application_name: "protea-r-staging-admin-seed",
  connectionString: withVerifiedSslMode(directDatabaseUrl),
  max: 1,
});
const client = await pool.connect();
let outcome = "updated";

try {
  await client.query("begin");
  await client.query(
    "select pg_advisory_xact_lock(hashtext('seed:staging-admin'))"
  );
  const existing = await client.query<{ id: string }>(
    "select id from users where lower(email) = $1 limit 1",
    [email]
  );
  const userId = existing.rows[0]?.id ?? randomUUID();
  if (existing.rowCount === 0) {
    outcome = "created";
    await client.query(
      "insert into users (id, name, email, email_verified) values ($1, $2, $3, true)",
      [userId, "Admin Staging", email]
    );
  } else {
    await client.query(
      "update users set email = $2, email_verified = true, updated_at = now() where id = $1",
      [userId, email]
    );
  }

  const credentialAccounts = await client.query<{ id: string }>(
    "select id from accounts where user_id = $1 and provider_id = 'credential' order by created_at",
    [userId]
  );
  const accountId = credentialAccounts.rows[0]?.id ?? randomUUID();
  if (credentialAccounts.rowCount === 0) {
    await client.query(
      "insert into accounts (id, account_id, provider_id, user_id, password) values ($1, $2, 'credential', $2, $3)",
      [accountId, userId, passwordHash]
    );
  } else {
    await client.query(
      "update accounts set account_id = $2, password = $3, updated_at = now() where id = $1",
      [accountId, userId, passwordHash]
    );
    await client.query(
      "delete from accounts where user_id = $1 and provider_id = 'credential' and id <> $2",
      [userId, accountId]
    );
  }
  await client.query(
    "insert into profiles (user_id, role) values ($1, 'admin') on conflict (user_id) do update set role = 'admin', updated_at = now()",
    [userId]
  );
  await client.query("commit");
} catch (error) {
  await client.query("rollback");
  throw error;
} finally {
  client.release();
  await pool.end();
}

process.stdout.write(
  `Staging Admin ${outcome} on ${target.databaseName} at ${target.host}; branch ${target.branchId}.\n`
);
