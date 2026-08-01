import {
  DeleteObjectsCommand,
  ListObjectsV2Command,
  S3Client,
} from "@aws-sdk/client-s3";
import { config } from "dotenv";
import { Pool, type PoolClient } from "pg";
import { withVerifiedSslMode } from "../src/db/connection-url";
import { assertStagingTarget } from "../src/db/staging-target";
import { resolveR2ClientEndpoint } from "../src/features/storage/r2-endpoint";

config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

const SAFE_IDENTIFIER = /^[a-z_][a-z0-9_]*$/;
const STAGING_PRIVATE_BUCKET = "hub-development-private";
const STAGING_PUBLIC_BUCKET = "hub-development-public";
const STAGING_PREFIX = "staging/";
const RESET_CONFIRMATION = "RESET_STAGING_DATA";
const execFileAsync = promisify(execFile);

type ResetMode = "execute" | "plan";

const readRequiredEnvironment = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required for the Staging reset.`);
  }
  return value;
};

const parseArguments = (): ResetMode => {
  const argumentsByName = new Map(
    process.argv.slice(2).map((argument) => {
      const separator = argument.indexOf("=");
      return [argument.slice(0, separator), argument.slice(separator + 1)];
    })
  );
  const allowedNames = new Set([
    "--mode",
    "--environment",
    "--confirm-reset",
    "--confirmation",
  ]);
  if (
    argumentsByName.size !== process.argv.slice(2).length ||
    [...argumentsByName.keys()].some((name) => !allowedNames.has(name))
  ) {
    throw new Error("Unsupported Staging reset argument.");
  }
  if (argumentsByName.get("--environment") !== "staging") {
    throw new Error("Use --environment=staging.");
  }
  const mode = argumentsByName.get("--mode");
  if (mode === "plan") {
    if (argumentsByName.size !== 2) {
      throw new Error("Plan accepts only --mode=plan --environment=staging.");
    }
    return "plan";
  }
  if (mode !== "execute") {
    throw new Error("Use --mode=plan or --mode=execute.");
  }
  if (argumentsByName.get("--confirm-reset") !== "true") {
    throw new Error("Execute requires --confirm-reset=true.");
  }
  if (argumentsByName.get("--confirmation") !== RESET_CONFIRMATION) {
    throw new Error("Execute requires --confirmation=RESET_STAGING_DATA.");
  }
  return "execute";
};

const readTableCounts = async (
  client: PoolClient
): Promise<Array<{ count: number; table: string }>> => {
  const { rows } = await client.query<{ table_name: string }>(
    `select table_name
       from information_schema.tables
      where table_schema = 'public'
        and table_type = 'BASE TABLE'
        and table_name <> '__drizzle_migrations'
      order by table_name`
  );
  const counts: Array<{ count: number; table: string }> = [];
  for (const { table_name: table } of rows) {
    if (!SAFE_IDENTIFIER.test(table)) {
      throw new Error("Staging reset found an unsafe table identifier.");
    }
    const result = await client.query<{ count: string }>(
      `select count(*)::text as count from "${table}"`
    );
    counts.push({
      count: Number.parseInt(result.rows[0]?.count ?? "0", 10),
      table,
    });
  }
  return counts;
};

const resetDatabase = async (
  pool: Pool,
  mode: ResetMode
): Promise<Array<{ count: number; table: string }>> => {
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query(
      "select pg_advisory_xact_lock(hashtext('reset:staging'))"
    );
    const counts = await readTableCounts(client);
    if (mode === "plan") {
      await client.query("rollback");
      return counts;
    }
    const tables = counts.map(({ table }) => `"${table}"`).join(", ");
    if (tables) {
      await client.query(`truncate table ${tables} RESTART IDENTITY CASCADE`);
    }
    await client.query("commit");
    return counts;
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
};

const seedAdmin = async (): Promise<void> => {
  await execFileAsync(
    "bun",
    ["--conditions=react-server", "scripts/seed-staging-admin.ts"],
    {
      env: process.env,
    }
  );
};

const deleteStagingObjects = async (): Promise<number> => {
  if (
    readRequiredEnvironment("R2_BUCKET_NAME") !== STAGING_PRIVATE_BUCKET ||
    readRequiredEnvironment("R2_PUBLIC_BUCKET_NAME") !==
      STAGING_PUBLIC_BUCKET ||
    readRequiredEnvironment("R2_OBJECT_PREFIX") !== "staging" ||
    readRequiredEnvironment("STAGING_R2_USES_DEVELOPMENT") !== "true"
  ) {
    throw new Error("Staging R2 cleanup target is invalid.");
  }
  const accountId = readRequiredEnvironment("R2_ACCOUNT_ID");
  const endpoint = resolveR2ClientEndpoint({
    accountId,
    e2eTestMode: false,
  });
  const client = new S3Client({
    credentials: {
      accessKeyId: readRequiredEnvironment("R2_ACCESS_KEY_ID"),
      secretAccessKey: readRequiredEnvironment("R2_SECRET_ACCESS_KEY"),
    },
    endpoint: endpoint.endpoint,
    forcePathStyle: endpoint.forcePathStyle,
    region: "auto",
  });
  let removed = 0;
  for (const bucket of [STAGING_PRIVATE_BUCKET, STAGING_PUBLIC_BUCKET]) {
    let continuationToken: string | undefined;
    do {
      const page = await client.send(
        new ListObjectsV2Command({
          Bucket: bucket,
          ContinuationToken: continuationToken,
          Prefix: STAGING_PREFIX,
        })
      );
      const keys = (page.Contents ?? [])
        .map(({ Key }) => Key)
        .filter((key): key is string =>
          Boolean(key?.startsWith(STAGING_PREFIX))
        );
      if (keys.length > 0) {
        await client.send(
          new DeleteObjectsCommand({
            Bucket: bucket,
            Delete: {
              Objects: keys.map((Key) => ({ Key })),
              Quiet: true,
            },
          })
        );
        removed += keys.length;
      }
      continuationToken = page.IsTruncated
        ? page.NextContinuationToken
        : undefined;
    } while (continuationToken);
  }
  client.destroy();
  return removed;
};

const mode = parseArguments();
const directDatabaseUrl = readRequiredEnvironment("DATABASE_URL_DIRECT");
assertStagingTarget({
  branchId: process.env.STAGING_NEON_BRANCH_ID,
  confirmation: process.env.STAGING_OPERATION_CONFIRMATION,
  databaseUrl: directDatabaseUrl,
  expectedBranchId: process.env.STAGING_NEON_BRANCH_ID,
  expectedHost: process.env.STAGING_DATABASE_HOST,
});
const pool = new Pool({
  application_name: "protea-r-staging-reset",
  connectionString: withVerifiedSslMode(directDatabaseUrl),
  max: 1,
});

try {
  const counts = await resetDatabase(pool, mode);
  if (mode === "plan") {
    process.stdout.write(`${JSON.stringify({ mode, tables: counts })}\n`);
  } else {
    await seedAdmin();
    try {
      const removedObjects = await deleteStagingObjects();
      process.stdout.write(
        `${JSON.stringify({ mode, removedObjects, tables: counts })}\n`
      );
    } catch {
      throw new Error(
        "Database reset committed; rerun the recoverable Staging R2 cleanup."
      );
    }
  }
} finally {
  await pool.end();
}

import { execFile } from "node:child_process";
import { promisify } from "node:util";
