import { readFileSync } from "node:fs";
import { config } from "dotenv";
import { Pool } from "pg";
import { withVerifiedSslMode } from "../src/db/connection-url";
import { LATEST_COMPATIBLE_MIGRATION_TIMESTAMP } from "../src/db/migration-state";
import {
  type ProductionDatabaseObservation,
  verifyDocumentedReleaseCheckpoint,
  verifyProductionReleaseState,
} from "../src/tooling/production-release-check";
import {
  parseReleaseStateDocument,
  type ReleaseState,
} from "../src/tooling/release-state";

config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

const API_TIMEOUT_MS = 10_000;
const CANONICAL_ALIAS = "app.neurocapacitar.com.br";
const FULL_GIT_SHA = /^[0-9a-f]{40}$/;
const HTTP_PROTOCOL_PREFIX = /^https?:\/\//u;
const TRAILING_SLASH = /\/$/u;

const argument = (name: string): string | undefined =>
  process.argv
    .slice(2)
    .find((value) => value.startsWith(`${name}=`))
    ?.slice(name.length + 1);

const required = (value: string | undefined, name: string): string => {
  const normalized = value?.trim();
  if (!normalized) {
    throw new Error(`${name} is required.`);
  }
  return normalized;
};

const readJson = async ({
  authorization,
  url,
}: {
  authorization: string;
  url: string;
}): Promise<unknown> => {
  const response = await fetch(url, {
    headers: { authorization },
    signal: AbortSignal.timeout(API_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`Provider read failed with HTTP ${response.status}.`);
  }
  return (await response.json()) as unknown;
};

const deploymentIdentifier = (value: string): string => {
  try {
    return new URL(value).hostname;
  } catch {
    return value.replace(HTTP_PROTOCOL_PREFIX, "").replace(TRAILING_SLASH, "");
  }
};

const inspectDatabase = async (
  databaseUrl: string
): Promise<ProductionDatabaseObservation> => {
  const pool = new Pool({
    connectionString: withVerifiedSslMode(databaseUrl),
    connectionTimeoutMillis: API_TIMEOUT_MS,
    max: 1,
  });
  const client = await pool.connect();
  try {
    await client.query("begin read only");
    await client.query("set local statement_timeout = '10s'");
    const version = await client.query<{ server_version_num: string }>(
      "show server_version_num"
    );
    const readOnly = await client.query<{ transaction_read_only: string }>(
      "show transaction_read_only"
    );
    const journal = await client.query<{
      entry_count: number;
      latest_migration_timestamp: string;
    }>(
      `select count(*)::int as entry_count,
              coalesce(max(created_at), 0)::bigint as latest_migration_timestamp
       from drizzle.__drizzle_migrations`
    );
    await client.query("rollback");
    return {
      journalEntryCount: journal.rows[0]?.entry_count ?? 0,
      latestMigrationTimestamp: Number(
        journal.rows[0]?.latest_migration_timestamp ?? 0
      ),
      readOnly: readOnly.rows[0]?.transaction_read_only === "on",
      serverMajorVersion: Math.floor(
        Number(version.rows[0]?.server_version_num ?? 0) / 10_000
      ),
    };
  } finally {
    client.release();
    await pool.end();
  }
};

const expectedJournalEntryCount = (): number => {
  const journal = JSON.parse(
    readFileSync("src/db/migrations/meta/_journal.json", "utf8")
  ) as { entries?: unknown };
  if (!Array.isArray(journal.entries)) {
    throw new Error("Local migration journal is invalid.");
  }
  return journal.entries.length;
};

const run = async (): Promise<void> => {
  const releaseSha = required(argument("--release-sha"), "--release-sha");
  if (!FULL_GIT_SHA.test(releaseSha)) {
    throw new Error("--release-sha must be a lowercase full Git SHA.");
  }
  const documentedCheckpoint = argument("--documented-checkpoint") as
    | keyof ReleaseState
    | undefined;
  if (
    documentedCheckpoint &&
    !(["deployed", "documented", "verified"] as const).includes(
      documentedCheckpoint
    )
  ) {
    throw new Error("--documented-checkpoint is invalid.");
  }
  const requireCanonicalAlias =
    required(
      argument("--require-canonical-alias"),
      "--require-canonical-alias"
    ) === "true";
  const deployment = required(argument("--deployment"), "--deployment");
  const vercelToken = required(process.env.VERCEL_TOKEN, "VERCEL_TOKEN");
  const vercelTeamId = required(process.env.VERCEL_ORG_ID, "VERCEL_ORG_ID");
  const vercelProjectId = required(
    process.env.VERCEL_PROJECT_ID,
    "VERCEL_PROJECT_ID"
  );
  const neonApiKey = required(process.env.NEON_API_KEY, "NEON_API_KEY");
  const neonProjectId = required(
    process.env.PRODUCTION_NEON_PROJECT_ID,
    "PRODUCTION_NEON_PROJECT_ID"
  );
  const neonBranchId = required(
    process.env.PRODUCTION_NEON_BRANCH_ID,
    "PRODUCTION_NEON_BRANCH_ID"
  );
  const databaseUrl = required(
    process.env.DATABASE_URL_DIRECT,
    "DATABASE_URL_DIRECT"
  );
  const releaseState = documentedCheckpoint
    ? parseReleaseStateDocument(
        readFileSync("docs/operations/release-state.md", "utf8")
      )
    : undefined;
  const checkpointErrors = verifyDocumentedReleaseCheckpoint({
    checkpoint: documentedCheckpoint,
    releaseSha,
    releaseState,
  });
  if (checkpointErrors.length > 0) {
    throw new Error(
      `Production release mismatch: ${checkpointErrors.join(", ")}.`
    );
  }

  const encodedDeployment = encodeURIComponent(
    deploymentIdentifier(deployment)
  );
  const encodedTeamId = encodeURIComponent(vercelTeamId);
  const encodedVercelProject = encodeURIComponent(vercelProjectId);
  const encodedNeonProject = encodeURIComponent(neonProjectId);
  const encodedNeonBranch = encodeURIComponent(neonBranchId);
  const [vercel, vercelDomains, neon, database] = await Promise.all([
    readJson({
      authorization: `Bearer ${vercelToken}`,
      url: `https://api.vercel.com/v13/deployments/${encodedDeployment}?teamId=${encodedTeamId}&withGitRepoInfo=true`,
    }),
    readJson({
      authorization: `Bearer ${vercelToken}`,
      url: `https://api.vercel.com/v9/projects/${encodedVercelProject}/domains?teamId=${encodedTeamId}`,
    }),
    readJson({
      authorization: `Bearer ${neonApiKey}`,
      url: `https://console.neon.tech/api/v2/projects/${encodedNeonProject}/branches/${encodedNeonBranch}`,
    }),
    inspectDatabase(databaseUrl),
  ]);
  const errors = verifyProductionReleaseState({
    database,
    expected: {
      canonicalAlias: CANONICAL_ALIAS,
      journalEntryCount: expectedJournalEntryCount(),
      latestMigrationTimestamp: LATEST_COMPATIBLE_MIGRATION_TIMESTAMP,
      neonBranchId,
      neonProjectId,
      releaseSha,
      requireCanonicalAlias,
      vercelProjectId,
    },
    neon,
    vercel,
    vercelDomains,
  });
  if (errors.length > 0) {
    throw new Error(`Production release mismatch: ${errors.join(", ")}.`);
  }
  process.stdout.write(
    `${JSON.stringify({
      canonicalAlias: requireCanonicalAlias ? "match" : "not_required",
      documentedCheckpoint: documentedCheckpoint ?? "not_required",
      database: "match",
      match: true,
      neon: "match",
      releaseSha,
      vercel: "match",
    })}\n`
  );
};

await run();
