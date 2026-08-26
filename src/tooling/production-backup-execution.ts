import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdtemp, rm, stat, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { BackupCadenceHours } from "./production-backup";
import { vercelVerifiedProjectDomains } from "./production-release-check";

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
const POSTGRES_VERSION_PATTERN = /^18(?:\.\d+){0,2}(?:\s+\(\d+\))?$/;
const RELEASE_SHA_PATTERN = /^[0-9a-f]{40}$/;
const SQLSTATE_PATTERN = /^[0-9A-Z]{5}$/;
const TRAILING_DOT_PATTERN = /\.$/;
const SUPPORTED_AGE_VERSION = "1.3.1";
const CADENCES = new Set<BackupCadenceHours>([6, 8, 12]);
const MAX_COMMAND_OUTPUT_BYTES = 4096;
const SAFE_COMMAND_FAILURE_PATTERN =
  /^(?:pg_dump|age) failed \((?:column|connection|credentials|function|permission|query|relation|schema(?:-(?:drizzle|oid|other|public|system))?|version|unknown)\)\.$/;
const MISSING_SCHEMA_PATTERN = /schema\s+["']([^"']+)["']\s+does not exist/;
const MISSING_SCHEMA_OID_PATTERN = /schema\s+with\s+oid\s+\d+\s+does not exist/;
const COMMAND_OUTPUT_TRUNCATION_MARKER = "\n...[truncated]...\n";

export type BackupCommandFailureReason =
  | "column"
  | "connection"
  | "credentials"
  | "function"
  | "permission"
  | "query"
  | "relation"
  | "schema"
  | "schema-drizzle"
  | "schema-oid"
  | "schema-other"
  | "schema-public"
  | "schema-system"
  | "unknown"
  | "version";

const BACKUP_COMMAND_FAILURE_PATTERNS: ReadonlyArray<
  readonly [BackupCommandFailureReason, readonly string[]]
> = [
  ["credentials", ["password authentication failed", "no password supplied"]],
  ["permission", ["permission denied", "must be owner", "not authorized"]],
  ["schema", ["undefined table", "undefined schema", "does not exist"]],
  ["version", ["server version mismatch", "unsupported version"]],
  [
    "connection",
    [
      "could not connect",
      "connection to server",
      "connection refused",
      "timeout expired",
      "network is unreachable",
    ],
  ],
];

const classifyMissingSchema = (
  message: string
): BackupCommandFailureReason | undefined => {
  const missingSchema = message.match(MISSING_SCHEMA_PATTERN)?.[1];
  if (missingSchema === "drizzle") {
    return "schema-drizzle";
  }
  if (missingSchema === "public") {
    return "schema-public";
  }
  if (
    missingSchema === "information_schema" ||
    missingSchema?.startsWith("pg_")
  ) {
    return "schema-system";
  }
  if (missingSchema) {
    return "schema-other";
  }
  if (MISSING_SCHEMA_OID_PATTERN.test(message)) {
    return "schema-oid";
  }
  if (message.includes("schema") && message.includes("does not exist")) {
    return "schema";
  }
  return;
};

export const retainCommandOutputContext = (
  current: string,
  chunk: string,
  maxBytes: number = MAX_COMMAND_OUTPUT_BYTES
): string => {
  const combined = current + chunk;
  if (combined.length <= maxBytes) {
    return combined;
  }
  if (maxBytes <= COMMAND_OUTPUT_TRUNCATION_MARKER.length) {
    return combined.slice(0, maxBytes);
  }
  const visibleLength = maxBytes - COMMAND_OUTPUT_TRUNCATION_MARKER.length;
  const prefixLength = Math.ceil(visibleLength / 2);
  const suffixLength = visibleLength - prefixLength;
  return `${combined.slice(0, prefixLength)}${COMMAND_OUTPUT_TRUNCATION_MARKER}${combined.slice(-suffixLength)}`;
};

export const classifyBackupCommandFailure = (
  stderr: string
): BackupCommandFailureReason => {
  const message = stderr.toLowerCase();
  if (message.includes("query failed")) {
    return "query";
  }
  if (message.includes("column") && message.includes("does not exist")) {
    return "column";
  }
  if (message.includes("function") && message.includes("does not exist")) {
    return "function";
  }
  if (message.includes("relation") && message.includes("does not exist")) {
    return "relation";
  }
  const schemaReason = classifyMissingSchema(message);
  if (schemaReason) {
    return schemaReason;
  }
  for (const [reason, patterns] of BACKUP_COMMAND_FAILURE_PATTERNS) {
    if (patterns.some((pattern) => message.includes(pattern))) {
      return reason;
    }
  }
  return "unknown";
};

export type ProductionBackupFailureCategory =
  | "backup-command"
  | "backup-command-age"
  | "backup-command-age-column"
  | "backup-command-age-connection"
  | "backup-command-age-credentials"
  | "backup-command-age-function"
  | "backup-command-age-permission"
  | "backup-command-age-query"
  | "backup-command-age-relation"
  | "backup-command-age-schema"
  | "backup-command-age-schema-drizzle"
  | "backup-command-age-schema-oid"
  | "backup-command-age-schema-other"
  | "backup-command-age-schema-public"
  | "backup-command-age-schema-system"
  | "backup-command-age-version"
  | "backup-command-pg-dump"
  | "backup-command-pg-dump-column"
  | "backup-command-pg-dump-connection"
  | "backup-command-pg-dump-credentials"
  | "backup-command-pg-dump-function"
  | "backup-command-pg-dump-permission"
  | "backup-command-pg-dump-query"
  | "backup-command-pg-dump-relation"
  | "backup-command-pg-dump-schema"
  | "backup-command-pg-dump-schema-drizzle"
  | "backup-command-pg-dump-schema-oid"
  | "backup-command-pg-dump-schema-other"
  | "backup-command-pg-dump-schema-public"
  | "backup-command-pg-dump-schema-system"
  | "backup-command-pg-dump-version"
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
  | `database-query-${string}`
  | `database-sqlstate-${string}`
  | "database"
  | "provider"
  | "storage"
  | "unexpected";

export type ProductionBackupFailurePhase =
  | "backup-command"
  | "configuration-database"
  | "configuration-migration"
  | "configuration-storage"
  | "database-connection"
  | "database-inspection"
  | "provider"
  | "storage";

export const resolveProductionBackupFailureCategory = (
  category: ProductionBackupFailureCategory,
  phase: ProductionBackupFailurePhase
): ProductionBackupFailureCategory | ProductionBackupFailurePhase =>
  category === "database-query" ||
  category === "configuration" ||
  category === "unexpected"
    ? phase
    : category;

const SPECIFIC_FAILURE_PATTERNS: ReadonlyArray<
  readonly [ProductionBackupFailureCategory, readonly string[]]
> = [
  [
    "backup-command-pg-dump",
    [
      "pg_dump failed.",
      "pg_dump failed (unknown)",
      "pg_dump output verification failed",
    ],
  ],
  [
    "backup-command-age",
    ["age failed.", "age failed (unknown)", "age output verification failed"],
  ],
  ["backup-command-pg-dump-connection", ["pg_dump failed (connection)"]],
  ["backup-command-pg-dump-credentials", ["pg_dump failed (credentials)"]],
  ["backup-command-pg-dump-permission", ["pg_dump failed (permission)"]],
  ["backup-command-pg-dump-column", ["pg_dump failed (column)"]],
  ["backup-command-pg-dump-function", ["pg_dump failed (function)"]],
  ["backup-command-pg-dump-query", ["pg_dump failed (query)"]],
  ["backup-command-pg-dump-relation", ["pg_dump failed (relation)"]],
  ["backup-command-pg-dump-schema", ["pg_dump failed (schema)"]],
  [
    "backup-command-pg-dump-schema-drizzle",
    ["pg_dump failed (schema-drizzle)"],
  ],
  ["backup-command-pg-dump-schema-oid", ["pg_dump failed (schema-oid)"]],
  ["backup-command-pg-dump-schema-other", ["pg_dump failed (schema-other)"]],
  ["backup-command-pg-dump-schema-public", ["pg_dump failed (schema-public)"]],
  ["backup-command-pg-dump-schema-system", ["pg_dump failed (schema-system)"]],
  ["backup-command-age-column", ["age failed (column)"]],
  ["backup-command-age-connection", ["age failed (connection)"]],
  ["backup-command-age-credentials", ["age failed (credentials)"]],
  ["backup-command-age-permission", ["age failed (permission)"]],
  ["backup-command-age-function", ["age failed (function)"]],
  ["backup-command-age-query", ["age failed (query)"]],
  ["backup-command-age-relation", ["age failed (relation)"]],
  ["backup-command-age-schema", ["age failed (schema)"]],
  ["backup-command-age-schema-drizzle", ["age failed (schema-drizzle)"]],
  ["backup-command-age-schema-oid", ["age failed (schema-oid)"]],
  ["backup-command-age-schema-other", ["age failed (schema-other)"]],
  ["backup-command-age-schema-public", ["age failed (schema-public)"]],
  ["backup-command-age-schema-system", ["age failed (schema-system)"]],
  [
    "backup-command-pg-dump-version",
    [
      "pg_dump major version must be 18",
      "pg_dump version command failed",
      "pg_dump version validation failed",
      "pg_dump failed (version)",
    ],
  ],
  [
    "backup-command-age-version",
    [
      "age version must be 1.3.1",
      "age version command failed",
      "age version validation failed",
      "age failed (version)",
    ],
  ],
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
  ["database-query-transaction", ["database query failed: transaction"]],
  ["database-query-settings", ["database query failed: settings"]],
  ["database-query-identity", ["database query failed: identity"]],
  ["database-query-migration", ["database query failed: migration"]],
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

const buildPgEnvironment = (
  databaseUrl: URL,
  environment: BackupEnvironment
): NodeJS.ProcessEnv => {
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
  const path = environment.PATH ?? environment.Path;
  return {
    ...(path ? { PATH: path } : {}),
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
    pgEnvironment: buildPgEnvironment(databaseUrl, environment),
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
  vercelDomains,
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
  vercelDomains?: unknown;
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
  const projectDomains = vercelVerifiedProjectDomains(
    vercelDomains,
    expected.vercelProjectId
  );
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
    (aliases.includes(expected.canonicalAlias) ||
      projectDomains.includes(expected.canonicalAlias)) &&
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
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout = retainCommandOutputContext(stdout, chunk);
    });
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      stderr = retainCommandOutputContext(stderr, chunk);
    });
    child.once("error", () =>
      reject(
        new Error(
          `${executable} failed (${classifyBackupCommandFailure(stderr)}).`
        )
      )
    );
    child.once("close", (code) => {
      if (code === 0) {
        resolve({ stdout: stdout.trim() });
      } else {
        reject(
          new Error(
            `${executable} failed (${classifyBackupCommandFailure(stderr)}).`
          )
        );
      }
    });
  });

const runBackupCommandSafely = async ({
  runCommand,
  arguments_,
  environment,
  executable,
  failureMessage,
}: BackupCommandInput & {
  failureMessage: string;
  runCommand: BackupCommandRunner;
}): Promise<{
  stdout: string;
}> => {
  try {
    return await runCommand({ arguments_, environment, executable });
  } catch (error: unknown) {
    if (
      error instanceof Error &&
      SAFE_COMMAND_FAILURE_PATTERN.test(error.message)
    ) {
      throw error;
    }
    throw new Error(failureMessage);
  }
};

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
    runBackupCommandSafely({
      runCommand,
      arguments_: ["--version"],
      environment,
      executable: "pg_dump",
      failureMessage: "pg_dump version command failed.",
    }),
    runBackupCommandSafely({
      runCommand,
      arguments_: ["--version"],
      environment,
      executable: "age",
      failureMessage: "age version command failed.",
    }),
  ]);
  const pgDumpVersion = pgDump.stdout.match(
    PG_DUMP_VERSION_OUTPUT_PATTERN
  )?.[1];
  if (!(pgDumpVersion && POSTGRES_VERSION_PATTERN.test(pgDumpVersion))) {
    throw new Error("pg_dump version validation failed.");
  }
  if (age.stdout.replace(LEADING_V_PATTERN, "") !== SUPPORTED_AGE_VERSION) {
    throw new Error("age version validation failed.");
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
    await runBackupCommandSafely({
      runCommand,
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
      failureMessage: "pg_dump failed.",
    });
    let dumpBytes: number;
    let dumpSha256: string;
    try {
      [{ size: dumpBytes }, dumpSha256] = await Promise.all([
        stat(dumpPath),
        sha256File(dumpPath),
      ]);
    } catch {
      throw new Error("pg_dump output verification failed.");
    }
    await runBackupCommandSafely({
      runCommand,
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
      failureMessage: "age failed.",
    });
    let encryptedBytes: number;
    let encryptedSha256: string;
    try {
      await unlink(dumpPath);
      [{ size: encryptedBytes }, encryptedSha256] = await Promise.all([
        stat(encryptedPath),
        sha256File(encryptedPath),
      ]);
    } catch {
      throw new Error("age output verification failed.");
    }
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
