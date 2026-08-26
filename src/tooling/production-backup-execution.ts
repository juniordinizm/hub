import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdtemp, rm, stat, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { BackupCadenceHours } from "./production-backup";

type BackupEnvironment = Readonly<Record<string, string | undefined>>;

export interface ProductionBackupExecutionConfig {
  ageRecipient: string;
  cadenceHours: BackupCadenceHours;
  pgDumpArguments: readonly string[];
  pgEnvironment: NodeJS.ProcessEnv;
  productionBranchId: string;
  productionProjectId: string;
}

export interface ProductionBackupProviderEvidence {
  releaseSha: string;
  sourceNeonBranchId: string;
  sourceNeonProjectId: string;
}

export interface ProductionBackupDatabaseInspection {
  currentDatabase: string;
  currentUser: string;
  defaultReadOnly: boolean;
  logicalDatabaseBytes: number;
  migrationTag: string;
  migrationTimestamp: number;
  pgReadAllDataMember: boolean;
  postgresServerVersion: string;
  transactionReadOnly: boolean;
}

export interface BackupCommandInput {
  arguments_: readonly string[];
  environment: NodeJS.ProcessEnv;
  executable: "age" | "pg_dump" | "pg_restore";
}

export type BackupCommandRunner = (
  input: BackupCommandInput
) => Promise<{ stdout: string }>;

const AGE_RECIPIENT_PATTERN = /^age1(?!pq1)[0-9a-z]{50,100}$/;
const LEADING_V_PATTERN = /^v/;
const PG_DUMP_VERSION_OUTPUT_PATTERN = /PostgreSQL\)\s+(\d+(?:\.\d+){0,2})/;
const POSTGRES_VERSION_PATTERN = /^18(?:\.\d+){0,2}$/;
const RELEASE_SHA_PATTERN = /^[0-9a-f]{40}$/;
const SQLSTATE_PATTERN = /^[0-9A-Z]{5}$/;
const TRAILING_DOT_PATTERN = /\.$/;
const SUPPORTED_AGE_VERSION = "1.3.1";
const CADENCES = new Set<BackupCadenceHours>([6, 8, 12]);
const MAX_COMMAND_OUTPUT_BYTES = 4096;

export type ProductionBackupFailureCategory =
  | "backup-command"
  | "configuration"
  | "database-access"
  | "database-connection"
  | "database-credentials"
  | "database-identity"
  | "database-inspection"
  | "database-migration"
  | "database-read-only"
  | "database-schema"
  | "database-size"
  | "database-version"
  | "database-query"
  | `database-sqlstate-${string}`
  | "database"
  | "provider"
  | "storage"
  | "unexpected";

const SPECIFIC_FAILURE_PATTERNS: ReadonlyArray<
  readonly [ProductionBackupFailureCategory, readonly string[]]
> = [
  ["database-read-only", ["backup role is not read-only"]],
  [
    "database-access",
    ["pg_read_all_data", "permission denied", "not authorized"],
  ],
  ["database-size", ["logical database size"]],
  ["database-version", ["postgresql server major"]],
  ["database-migration", ["database migration"]],
  ["database-identity", ["database identity"]],
  ["database-inspection", ["database inspection is incomplete"]],
  [
    "database-schema",
    ["does not exist", "undefined table", "undefined schema"],
  ],
  ["configuration", ["required", "invalid", "must be", "unsupported"]],
  ["provider", ["provider", "provenance"]],
  ["database-connection", ["connection"]],
];

const matchesAny = (message: string, patterns: readonly string[]): boolean =>
  patterns.some((pattern) => message.includes(pattern));

const getErrorCode = (error: Error): string | undefined => {
  if (!("code" in error) || typeof error.code !== "string") {
    return;
  }
  return error.code;
};

const classifyDatabaseErrorCode = (
  code: string | undefined
): ProductionBackupFailureCategory | undefined => {
  if (code === "28P01") {
    return "database-credentials";
  }
  if (code === "42501") {
    return "database-access";
  }
  if (["3D000", "3F000", "42P01"].includes(code ?? "")) {
    return "database-schema";
  }
  if (
    code?.startsWith("08") ||
    [
      "57P03",
      "53300",
      "ECONNREFUSED",
      "ECONNRESET",
      "ETIMEDOUT",
      "ENOTFOUND",
    ].includes(code ?? "")
  ) {
    return "database-connection";
  }
  if (["42601", "42883"].includes(code ?? "")) {
    return "database-query";
  }
  if (code && SQLSTATE_PATTERN.test(code)) {
    return `database-sqlstate-${code}`;
  }
  return;
};

export const classifyProductionBackupFailure = (
  error: unknown
): ProductionBackupFailureCategory => {
  if (!(error instanceof Error)) {
    return "unexpected";
  }
  const codeCategory = classifyDatabaseErrorCode(getErrorCode(error));
  if (codeCategory) {
    return codeCategory;
  }
  const message = error.message.toLowerCase();
  for (const [category, patterns] of SPECIFIC_FAILURE_PATTERNS) {
    if (matchesAny(message, patterns)) {
      return category;
    }
  }
  if (
    message.includes("database") ||
    message.includes("migration") ||
    message.includes("read-only")
  ) {
    return "database-query";
  }
  if (
    message.includes("r2") ||
    message.includes("bucket") ||
    message.includes("object") ||
    message.includes("publish")
  ) {
    return "storage";
  }
  if (
    message.includes("pg_dump") ||
    message.includes("pg_restore") ||
    message.includes("age") ||
    message.includes("command")
  ) {
    return "backup-command";
  }
  return "unexpected";
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const stringValue = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;

const requiredEnvironmentValue = (
  environment: BackupEnvironment,
  name: string
): string => {
  const value = environment[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
};

const normalizeHost = (host: string): string =>
  host.trim().toLowerCase().replace(TRAILING_DOT_PATTERN, "");

const parseCadence = (value: string): BackupCadenceHours => {
  const cadence = Number(value);
  if (!CADENCES.has(cadence as BackupCadenceHours)) {
    throw new Error("BACKUP_CADENCE_HOURS must be 6, 8 or 12.");
  }
  return cadence as BackupCadenceHours;
};

const buildPgEnvironment = (databaseUrl: URL): NodeJS.ProcessEnv => {
  const database = decodeURIComponent(databaseUrl.pathname.slice(1));
  if (!(database && databaseUrl.username && databaseUrl.password)) {
    throw new Error(
      "BACKUP_DATABASE_URL must include database and credentials."
    );
  }
  const sslMode = databaseUrl.searchParams.get("sslmode");
  if (sslMode !== "verify-full") {
    throw new Error("BACKUP_DATABASE_URL must use sslmode=verify-full.");
  }
  const allowedParameters = new Set(["channel_binding", "sslmode"]);
  for (const name of databaseUrl.searchParams.keys()) {
    if (!allowedParameters.has(name)) {
      throw new Error("BACKUP_DATABASE_URL has an unsupported parameter.");
    }
  }

  const channelBinding = databaseUrl.searchParams.get("channel_binding");
  return {
    NODE_ENV: "production",
    PGDATABASE: database,
    PGHOST: databaseUrl.hostname,
    PGPASSWORD: decodeURIComponent(databaseUrl.password),
    PGPORT: databaseUrl.port || "5432",
    PGSSLMODE: sslMode,
    PGUSER: decodeURIComponent(databaseUrl.username),
    ...(channelBinding ? { PGCHANNELBINDING: channelBinding } : {}),
  };
};

export const resolveProductionBackupExecutionConfig = (
  environment: BackupEnvironment
): ProductionBackupExecutionConfig => {
  const rawDatabaseUrl = requiredEnvironmentValue(
    environment,
    "BACKUP_DATABASE_URL"
  );
  let databaseUrl: URL;
  try {
    databaseUrl = new URL(rawDatabaseUrl);
  } catch {
    throw new Error("BACKUP_DATABASE_URL is invalid.");
  }
  if (!["postgres:", "postgresql:"].includes(databaseUrl.protocol)) {
    throw new Error("BACKUP_DATABASE_URL must be PostgreSQL.");
  }
  const expectedHost = normalizeHost(
    requiredEnvironmentValue(environment, "PRODUCTION_DATABASE_HOST")
  );
  const targetHost = normalizeHost(databaseUrl.hostname);
  if (targetHost !== expectedHost || targetHost.includes("-pooler")) {
    throw new Error(
      "BACKUP_DATABASE_URL must target the direct Production host."
    );
  }

  const ageRecipient = requiredEnvironmentValue(
    environment,
    "BACKUP_AGE_RECIPIENT"
  );
  if (!AGE_RECIPIENT_PATTERN.test(ageRecipient)) {
    throw new Error("BACKUP_AGE_RECIPIENT must be an age X25519 recipient.");
  }
  return {
    ageRecipient,
    cadenceHours: parseCadence(
      requiredEnvironmentValue(environment, "BACKUP_CADENCE_HOURS")
    ),
    pgDumpArguments: [
      "--format=custom",
      "--compress=9",
      "--no-owner",
      "--no-acl",
    ],
    pgEnvironment: buildPgEnvironment(databaseUrl),
    productionBranchId: requiredEnvironmentValue(
      environment,
      "PRODUCTION_NEON_BRANCH_ID"
    ),
    productionProjectId: requiredEnvironmentValue(
      environment,
      "PRODUCTION_NEON_PROJECT_ID"
    ),
  };
};

export const verifyProductionBackupProviderEvidence = ({
  databaseHost,
  expected,
  neon,
  neonEndpoints,
  vercel,
}: {
  databaseHost: string;
  expected: {
    canonicalAlias: string;
    neonBranchId: string;
    neonProjectId: string;
    vercelProjectId: string;
  };
  neon: unknown;
  neonEndpoints: unknown;
  vercel: unknown;
}): ProductionBackupProviderEvidence => {
  const branch = isRecord(neon) && isRecord(neon.branch) ? neon.branch : null;
  const endpoints =
    isRecord(neonEndpoints) && Array.isArray(neonEndpoints.endpoints)
      ? neonEndpoints.endpoints.filter(isRecord)
      : [];
  const releaseSha =
    isRecord(vercel) && isRecord(vercel.meta)
      ? stringValue(vercel.meta.githubCommitSha ?? vercel.meta.githubCommitSHA)
      : undefined;
  const aliases =
    isRecord(vercel) && Array.isArray(vercel.alias)
      ? vercel.alias.map(stringValue).filter(Boolean)
      : [];
  const databaseEndpoint = endpoints.some(
    (endpoint) =>
      normalizeHost(stringValue(endpoint.host) ?? "") ===
        normalizeHost(databaseHost) && endpoint.current_state === "active"
  );
  const valid =
    branch?.id === expected.neonBranchId &&
    branch.project_id === expected.neonProjectId &&
    branch.current_state === "ready" &&
    databaseEndpoint &&
    isRecord(vercel) &&
    (vercel.readyState === "READY" || vercel.state === "READY") &&
    vercel.target === "production" &&
    stringValue(vercel.projectId ?? vercel.project) ===
      expected.vercelProjectId &&
    aliases.includes(expected.canonicalAlias) &&
    Boolean(releaseSha && RELEASE_SHA_PATTERN.test(releaseSha));
  if (!(valid && releaseSha)) {
    throw new Error("Production backup provider provenance mismatched.");
  }
  return {
    releaseSha,
    sourceNeonBranchId: expected.neonBranchId,
    sourceNeonProjectId: expected.neonProjectId,
  };
};

export const assertProductionBackupDatabase = (
  inspection: ProductionBackupDatabaseInspection,
  expectedMigration: { migrationTag: string; migrationTimestamp: number }
): void => {
  const problems: string[] = [];
  if (!(inspection.transactionReadOnly && inspection.defaultReadOnly)) {
    problems.push("backup role is not read-only");
  }
  if (!inspection.pgReadAllDataMember) {
    problems.push("backup role is not a member of pg_read_all_data");
  }
  if (
    !Number.isSafeInteger(inspection.logicalDatabaseBytes) ||
    inspection.logicalDatabaseBytes <= 0
  ) {
    problems.push("logical database size is invalid");
  }
  if (!POSTGRES_VERSION_PATTERN.test(inspection.postgresServerVersion)) {
    problems.push("PostgreSQL server major is not 18");
  }
  if (
    inspection.migrationTag !== expectedMigration.migrationTag ||
    inspection.migrationTimestamp !== expectedMigration.migrationTimestamp
  ) {
    problems.push("database migration does not match this release");
  }
  if (!(inspection.currentDatabase && inspection.currentUser)) {
    problems.push("database identity is incomplete");
  }
  if (problems.length > 0) {
    throw new Error(
      `Production backup precondition failed: ${problems.join("; ")}.`
    );
  }
};

export const runBackupCommand: BackupCommandRunner = async ({
  arguments_,
  environment,
  executable,
}) =>
  await new Promise((resolve, reject) => {
    const child = spawn(executable, arguments_, {
      env: environment,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    let stdout = "";
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      if (stdout.length < MAX_COMMAND_OUTPUT_BYTES) {
        stdout += chunk.slice(0, MAX_COMMAND_OUTPUT_BYTES - stdout.length);
      }
    });
    child.stderr.resume();
    child.once("error", () =>
      reject(new Error(`${executable} could not start.`))
    );
    child.once("close", (code) => {
      if (code === 0) {
        resolve({ stdout: stdout.trim() });
      } else {
        reject(new Error(`${executable} failed.`));
      }
    });
  });

const sha256File = async (path: string): Promise<string> =>
  await new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(path);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.once("error", reject);
    stream.once("end", () => resolve(hash.digest("hex")));
  });

const verifyToolVersions = async (
  runCommand: BackupCommandRunner,
  environment: NodeJS.ProcessEnv
): Promise<{ pgDumpVersion: string }> => {
  const [pgDump, age] = await Promise.all([
    runCommand({
      arguments_: ["--version"],
      environment,
      executable: "pg_dump",
    }),
    runCommand({ arguments_: ["--version"], environment, executable: "age" }),
  ]);
  const pgDumpVersion = pgDump.stdout.match(
    PG_DUMP_VERSION_OUTPUT_PATTERN
  )?.[1];
  if (!(pgDumpVersion && POSTGRES_VERSION_PATTERN.test(pgDumpVersion))) {
    throw new Error("pg_dump major version must be 18.");
  }
  if (age.stdout.replace(LEADING_V_PATTERN, "") !== SUPPORTED_AGE_VERSION) {
    throw new Error(`age version must be ${SUPPORTED_AGE_VERSION}.`);
  }
  return { pgDumpVersion };
};

export const withEncryptedProductionDump = async <Result>({
  ageRecipient,
  pgEnvironment,
  runCommand = runBackupCommand,
  processEncryptedDump,
}: {
  ageRecipient: string;
  pgEnvironment: NodeJS.ProcessEnv;
  runCommand?: BackupCommandRunner;
  processEncryptedDump: (input: {
    dumpBytes: number;
    dumpPath: string;
    dumpSha256: string;
    encryptedBytes: number;
    encryptedPath: string;
    encryptedSha256: string;
    pgDumpVersion: string;
  }) => Promise<Result>;
}): Promise<{
  dumpBytes: number;
  dumpSha256: string;
  encryptedBytes: number;
  encryptedSha256: string;
  pgDumpVersion: string;
  result: Result;
}> => {
  const temporaryDirectory = await mkdtemp(
    join(tmpdir(), "hub-production-backup-")
  );
  const dumpPath = join(temporaryDirectory, "production.dump");
  const encryptedPath = join(temporaryDirectory, "production.dump.age");
  try {
    const { pgDumpVersion } = await verifyToolVersions(
      runCommand,
      pgEnvironment
    );
    await runCommand({
      arguments_: [
        "--format=custom",
        "--compress=9",
        "--no-owner",
        "--no-acl",
        "--file",
        dumpPath,
      ],
      environment: pgEnvironment,
      executable: "pg_dump",
    });
    const [{ size: dumpBytes }, dumpSha256] = await Promise.all([
      stat(dumpPath),
      sha256File(dumpPath),
    ]);
    await runCommand({
      arguments_: [
        "--encrypt",
        "--recipient",
        ageRecipient,
        "--output",
        encryptedPath,
        dumpPath,
      ],
      environment: pgEnvironment,
      executable: "age",
    });
    await unlink(dumpPath);
    const [{ size: encryptedBytes }, encryptedSha256] = await Promise.all([
      stat(encryptedPath),
      sha256File(encryptedPath),
    ]);
    const result = await processEncryptedDump({
      dumpBytes,
      dumpPath,
      dumpSha256,
      encryptedBytes,
      encryptedPath,
      encryptedSha256,
      pgDumpVersion,
    });
    return {
      dumpBytes,
      dumpSha256,
      encryptedBytes,
      encryptedSha256,
      pgDumpVersion,
      result,
    };
  } finally {
    await rm(temporaryDirectory, { force: true, recursive: true });
  }
};
