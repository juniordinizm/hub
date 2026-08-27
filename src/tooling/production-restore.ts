import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative, resolve } from "node:path";
import type { ProductionBackupManifestV1 } from "./production-backup";
import {
  type BackupCommandRunner,
  runBackupCommand,
} from "./production-backup-execution";

type RestoreEnvironment = Readonly<Record<string, string | undefined>>;

export interface ProductionRestoreConfig {
  identityFile: string;
  manifestKey: string;
  pgEnvironment: NodeJS.ProcessEnv;
  targetDatabase: string;
  targetHost: string;
}

export interface ProductionRestorePoolOptions {
  application_name: string;
  connectionString: string;
  max: number;
  ssl?: {
    ca: string;
    rejectUnauthorized: true;
  };
}

export const buildProductionRestorePoolOptions = (
  targetUrl: string,
  rootCertificate?: string
): ProductionRestorePoolOptions => ({
  application_name: "protea-r-production-restore-drill",
  connectionString: targetUrl,
  max: 1,
  ...(rootCertificate
    ? { ssl: { ca: rootCertificate, rejectUnauthorized: true as const } }
    : {}),
});

const CONFIRMATION = "RESTORE_DISPOSABLE_PRODUCTION_BACKUP";
const AGE_IDENTITY_CONTENT_PATTERN = /^(?:AGE-SECRET-KEY-|AGE-PLUGIN-)/;
const AGE_VERSION_PATTERN = /^v?1\.3\.1$/;
const LINE_BREAK_PATTERN = /\r?\n/;
const MANIFEST_KEY_PATTERN =
  /^postgres\/production\/manifests\/(?:frequent|daily|weekly)\/[0-9a-f-]+\.json$/;
const PG_RESTORE_VERSION_PATTERN = /PostgreSQL\)\s+18(?:\.\d+){0,2}/;
const RESTORE_DATABASE_PATTERN = /^hub_restore_[a-z0-9_]+$/;
const TRAILING_DOT_PATTERN = /\.$/;
const UNSAFE_ARCHIVE_ENTRY_PATTERN =
  /\b(?:ACL|BLOB|DATABASE|EVENT TRIGGER|FOREIGN DATA WRAPPER|FOREIGN SERVER|OWNER|PROCEDURAL LANGUAGE|PUBLICATION|SECURITY LABEL|SUBSCRIPTION|TABLESPACE)\b/i;
const SCHEMA_SCOPED_ARCHIVE_TYPES = new Set([
  "CONSTRAINT",
  "DEFAULT",
  "FUNCTION",
  "INDEX",
  "SEQUENCE",
  "TABLE",
  "TRIGGER",
]);
const WHITESPACE_PATTERN = /\s+/;

const requiredEnvironmentValue = (
  environment: RestoreEnvironment,
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

const parseDatabaseUrl = (raw: string, name: string): URL => {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`${name} is invalid.`);
  }
  if (!["postgres:", "postgresql:"].includes(url.protocol)) {
    throw new Error(`${name} must be PostgreSQL.`);
  }
  if (url.searchParams.get("sslmode") !== "verify-full") {
    throw new Error(`${name} must use sslmode=verify-full.`);
  }
  return url;
};

const buildPgEnvironment = (
  url: URL,
  environment: RestoreEnvironment
): NodeJS.ProcessEnv => {
  const targetDatabase = decodeURIComponent(url.pathname.slice(1));
  if (!(targetDatabase && url.username && url.password)) {
    throw new Error(
      "RESTORE_DATABASE_URL must include database and credentials."
    );
  }
  const executablePath = environment.PATH ?? environment.Path;
  const rootCertificate = environment.PGSSLROOTCERT?.trim();
  return {
    ...(executablePath ? { PATH: executablePath } : {}),
    NODE_ENV: "production",
    PGDATABASE: targetDatabase,
    PGHOST: url.hostname,
    PGPASSWORD: decodeURIComponent(url.password),
    PGPORT: url.port || "5432",
    ...(rootCertificate ? { PGSSLROOTCERT: rootCertificate } : {}),
    PGSSLMODE: "verify-full",
    PGUSER: decodeURIComponent(url.username),
  };
};

const assertOfflineIdentityPath = (
  identityFile: string,
  workspaceDirectory: string
): string => {
  if (
    AGE_IDENTITY_CONTENT_PATTERN.test(identityFile) ||
    identityFile.includes("\n") ||
    !isAbsolute(identityFile)
  ) {
    throw new Error("RESTORE_AGE_IDENTITY_FILE must be an absolute file path.");
  }
  const resolvedIdentity = resolve(identityFile);
  const relativeToWorkspace = relative(
    resolve(workspaceDirectory),
    resolvedIdentity
  );
  if (
    relativeToWorkspace === "" ||
    !(relativeToWorkspace.startsWith("..") || isAbsolute(relativeToWorkspace))
  ) {
    throw new Error(
      "The age identity file must remain outside the repository."
    );
  }
  return resolvedIdentity;
};

export const resolveProductionRestoreConfig = (
  environment: RestoreEnvironment,
  { workspaceDirectory }: { workspaceDirectory: string }
): ProductionRestoreConfig => {
  if (environment.RESTORE_CONFIRMATION !== CONFIRMATION) {
    throw new Error(`RESTORE_CONFIRMATION must equal ${CONFIRMATION}.`);
  }
  const targetUrl = parseDatabaseUrl(
    requiredEnvironmentValue(environment, "RESTORE_DATABASE_URL"),
    "RESTORE_DATABASE_URL"
  );
  const targetHost = normalizeHost(targetUrl.hostname);
  const targetDatabase = decodeURIComponent(targetUrl.pathname.slice(1));
  if (!RESTORE_DATABASE_PATTERN.test(targetDatabase)) {
    throw new Error("Restore target database must start with hub_restore_.");
  }
  const protectedHosts = new Set(
    [
      environment.PRODUCTION_DATABASE_HOST,
      environment.STAGING_DATABASE_HOST,
      environment.DEVELOPMENT_DATABASE_HOST,
      ...(environment.PROTECTED_DATABASE_HOSTS?.split(",") ?? []),
    ]
      .filter((host): host is string => Boolean(host?.trim()))
      .map(normalizeHost)
  );
  if (protectedHosts.has(targetHost) || targetHost.includes("-pooler")) {
    throw new Error("Restore target must be an isolated disposable database.");
  }
  const manifestKey = requiredEnvironmentValue(
    environment,
    "RESTORE_MANIFEST_KEY"
  );
  if (!MANIFEST_KEY_PATTERN.test(manifestKey)) {
    throw new Error("RESTORE_MANIFEST_KEY is outside the backup namespace.");
  }

  return {
    identityFile: assertOfflineIdentityPath(
      requiredEnvironmentValue(environment, "RESTORE_AGE_IDENTITY_FILE"),
      workspaceDirectory
    ),
    manifestKey,
    pgEnvironment: buildPgEnvironment(targetUrl, environment),
    targetDatabase,
    targetHost,
  };
};

export const assertEmptyRestoreTarget = ({
  applicationRelationCount,
  currentDatabase,
  expectedDatabase,
}: {
  applicationRelationCount: number;
  currentDatabase: string;
  expectedDatabase: string;
}): void => {
  if (currentDatabase !== expectedDatabase || applicationRelationCount !== 0) {
    throw new Error("Restore target must be the confirmed empty database.");
  }
};

export const validatePgRestoreList = (contents: string): void => {
  const entries = contents
    .split(LINE_BREAK_PATTERN)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith(";"));
  if (entries.length === 0) {
    throw new Error("pg_restore archive list is empty.");
  }
  for (const entry of entries) {
    if (UNSAFE_ARCHIVE_ENTRY_PATTERN.test(entry)) {
      throw new Error("pg_restore archive contains an unsafe entry.");
    }
    const tokens = entry.split(WHITESPACE_PATTERN).slice(3);
    const objectType = tokens[0]?.toUpperCase();
    const schemaIndex =
      objectType === "TABLE" && tokens[1]?.toUpperCase() === "DATA" ? 2 : 1;
    const schema = tokens[schemaIndex];
    if (
      objectType &&
      SCHEMA_SCOPED_ARCHIVE_TYPES.has(objectType) &&
      schema !== "public" &&
      schema !== "drizzle"
    ) {
      throw new Error("pg_restore archive contains an unexpected schema.");
    }
  }
};

const sha256File = async (path: string): Promise<string> =>
  await new Promise((resolveHash, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(path);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.once("error", reject);
    stream.once("end", () => resolveHash(hash.digest("hex")));
  });

const verifyRestoreToolVersions = async (
  runCommand: BackupCommandRunner,
  pgEnvironment: NodeJS.ProcessEnv
): Promise<void> => {
  const [age, pgRestore] = await Promise.all([
    runCommand({
      arguments_: ["--version"],
      environment: pgEnvironment,
      executable: "age",
    }),
    runCommand({
      arguments_: ["--version"],
      environment: pgEnvironment,
      executable: "pg_restore",
    }),
  ]);
  if (
    !(
      AGE_VERSION_PATTERN.test(age.stdout) &&
      PG_RESTORE_VERSION_PATTERN.test(pgRestore.stdout)
    )
  ) {
    throw new Error("Restore tools do not match the supported versions.");
  }
};

export const runProductionRestore = async <Result>({
  assertTargetEmpty,
  downloadEncrypted,
  identityFile,
  manifest,
  pgEnvironment,
  runCommand = runBackupCommand,
  verifyRestoredDatabase,
}: {
  assertTargetEmpty: () => Promise<void>;
  downloadEncrypted: (path: string) => Promise<void>;
  identityFile: string;
  manifest: ProductionBackupManifestV1;
  pgEnvironment: NodeJS.ProcessEnv;
  runCommand?: BackupCommandRunner;
  verifyRestoredDatabase: () => Promise<Result>;
}): Promise<Result> => {
  const temporaryDirectory = await mkdtemp(
    join(tmpdir(), "hub-production-restore-")
  );
  const encryptedPath = join(temporaryDirectory, "production.dump.age");
  const dumpPath = join(temporaryDirectory, "production.dump");
  try {
    await downloadEncrypted(encryptedPath);
    const encryptedStat = await stat(encryptedPath);
    const encryptedSha256 = await sha256File(encryptedPath);
    if (
      encryptedStat.size !== manifest.encryptedBytes ||
      encryptedSha256 !== manifest.encryptedSha256
    ) {
      throw new Error("Production backup encrypted hash or size mismatched.");
    }
    await verifyRestoreToolVersions(runCommand, pgEnvironment);
    await runCommand({
      arguments_: [
        "--decrypt",
        "--identity",
        identityFile,
        "--output",
        dumpPath,
        encryptedPath,
      ],
      environment: pgEnvironment,
      executable: "age",
    });
    if ((await sha256File(dumpPath)) !== manifest.dumpSha256) {
      throw new Error("Production backup dump hash mismatched.");
    }
    const archive = await runCommand({
      arguments_: ["--list", dumpPath],
      environment: pgEnvironment,
      executable: "pg_restore",
    });
    validatePgRestoreList(archive.stdout);
    await assertTargetEmpty();
    await runCommand({
      arguments_: [
        "--exit-on-error",
        "--single-transaction",
        "--no-owner",
        "--no-privileges",
        dumpPath,
      ],
      environment: pgEnvironment,
      executable: "pg_restore",
    });
    return await verifyRestoredDatabase();
  } finally {
    await rm(temporaryDirectory, { force: true, recursive: true });
  }
};
