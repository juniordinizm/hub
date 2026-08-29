import { createHash } from "node:crypto";
import { access, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { ProductionBackupManifestV1 } from "./production-backup";
import type { BackupCommandRunner } from "./production-backup-execution";
import {
  assertEmptyRestoreTarget,
  buildProductionRestorePoolOptions,
  resolveProductionRestoreConfig,
  runProductionRestore,
  validatePgRestoreList,
} from "./production-restore";

const hash = (value: string): string =>
  createHash("sha256").update(value).digest("hex");

const manifest = (): ProductionBackupManifestV1 => ({
  backupId: "0198d6f4-c2a5-7000-8000-000000000001",
  cadenceHours: 6,
  compression: "pg-custom-z9",
  createdAt: "2026-08-24T00:17:00.000Z",
  dumpBytes: Buffer.byteLength("dump"),
  dumpSha256: hash("dump"),
  encryptedBytes: Buffer.byteLength("cipher"),
  encryptedObjectKey:
    "postgres/production/frequent/0198d6f4-c2a5-7000-8000-000000000001.age",
  encryptedSha256: hash("cipher"),
  encryption: "age-x25519",
  migrationTag: "0065_gray_siren",
  migrationTimestamp: 1_787_541_858_811,
  logicalDatabaseBytes: 4096,
  pgDumpVersion: "18.6",
  postgresServerVersion: "18.6",
  releaseSha: "a".repeat(40),
  retentionClasses: ["frequent"],
  schemaVersion: 1,
  sourceEnvironment: "production",
  sourceNeonBranchId: "br-production",
  sourceNeonProjectId: "project-production",
});

const workspaceDirectory = resolve("test-fixtures", "workspace");
const offlineIdentityFile = resolve(
  workspaceDirectory,
  "..",
  "offline",
  "production-backup-identity.txt"
);
const restoreEnvironment = {
  BACKUP_DATABASE_URL:
    "postgresql://backup:secret@production.example.test/neondb?sslmode=verify-full",
  DEVELOPMENT_DATABASE_HOST: "development.example.test",
  PGSSLROOTCERT: "C:\\secure\\neon-ca-bundle.pem",
  Path: "C:\\secure\\bin",
  PRODUCTION_DATABASE_HOST: "production.example.test",
  RESTORE_AGE_IDENTITY_FILE: offlineIdentityFile,
  RESTORE_CONFIRMATION: "RESTORE_DISPOSABLE_PRODUCTION_BACKUP",
  RESTORE_DATABASE_URL:
    "postgresql://restore:secret@ephemeral.example.test/hub_restore_drill?sslmode=verify-full",
  RESTORE_MANIFEST_KEY:
    "postgres/production/manifests/frequent/0198d6f4-c2a5-7000-8000-000000000001.json",
  STAGING_DATABASE_HOST: "staging.example.test",
};

describe("resolveProductionRestoreConfig", () => {
  it("accepts a confirmed isolated target and an offline identity path", () => {
    const config = resolveProductionRestoreConfig(restoreEnvironment, {
      workspaceDirectory,
    });

    expect(config).toMatchObject({
      identityFile: offlineIdentityFile,
      manifestKey: restoreEnvironment.RESTORE_MANIFEST_KEY,
      targetDatabase: "hub_restore_drill",
      targetHost: "ephemeral.example.test",
    });
    expect(config.pgEnvironment).toMatchObject({
      PATH: restoreEnvironment.Path,
      PGSSLROOTCERT: restoreEnvironment.PGSSLROOTCERT,
    });
  });

  it.each([
    ["missing confirmation", { RESTORE_CONFIRMATION: "" }],
    [
      "Production target",
      { RESTORE_DATABASE_URL: restoreEnvironment.BACKUP_DATABASE_URL },
    ],
    [
      "Staging target",
      {
        RESTORE_DATABASE_URL: restoreEnvironment.RESTORE_DATABASE_URL.replace(
          "ephemeral",
          "staging"
        ),
      },
    ],
    [
      "non-disposable name",
      {
        RESTORE_DATABASE_URL: restoreEnvironment.RESTORE_DATABASE_URL.replace(
          "hub_restore_drill",
          "neondb"
        ),
      },
    ],
    [
      "identity inside repository",
      {
        RESTORE_AGE_IDENTITY_FILE: resolve(workspaceDirectory, "identity.txt"),
      },
    ],
    [
      "identity content instead of path",
      { RESTORE_AGE_IDENTITY_FILE: "AGE-SECRET-KEY-1EXAMPLE" },
    ],
    [
      "unexpected manifest namespace",
      { RESTORE_MANIFEST_KEY: "materials/manifest.json" },
    ],
  ])("rejects %s", (_label, overrides) => {
    expect(() =>
      resolveProductionRestoreConfig(
        { ...restoreEnvironment, ...overrides },
        { workspaceDirectory }
      )
    ).toThrow();
  });
});

describe("restore target and archive guards", () => {
  it("accepts only an empty target with no application relations", () => {
    expect(() =>
      assertEmptyRestoreTarget({
        applicationRelationCount: 0,
        currentDatabase: "hub_restore_drill",
        expectedDatabase: "hub_restore_drill",
      })
    ).not.toThrow();
    expect(() =>
      assertEmptyRestoreTarget({
        applicationRelationCount: 1,
        currentDatabase: "hub_restore_drill",
        expectedDatabase: "hub_restore_drill",
      })
    ).toThrow("empty");
  });

  it("rejects privileged or cross-database archive entries", () => {
    expect(() =>
      validatePgRestoreList(
        "; Archive created at 2026-08-24\n1; 0 0 TABLE public users backup\n2; 0 0 TABLE DATA public users backup\n3; 0 0 SEQUENCE OWNED BY drizzle __drizzle_migrations_id_seq backup\n4; 0 0 SEQUENCE SET drizzle __drizzle_migrations_id_seq backup"
      )
    ).not.toThrow();
    expect(() =>
      validatePgRestoreList("1; 0 0 DATABASE - neondb backup")
    ).toThrow("unsafe");
    expect(() =>
      validatePgRestoreList("1; 0 0 TABLE private secrets backup")
    ).toThrow("schema");
    expect(() =>
      validatePgRestoreList(
        "1; 0 0 SEQUENCE OWNED BY private __drizzle_migrations_id_seq backup"
      )
    ).toThrow("schema");
    expect(() =>
      validatePgRestoreList(
        "1; 0 0 SEQUENCE SET private __drizzle_migrations_id_seq backup"
      )
    ).toThrow("schema");
  });
});

describe("restore database connection", () => {
  it("passes the configured root certificate to the Node PostgreSQL pool", () => {
    const options = buildProductionRestorePoolOptions(
      restoreEnvironment.RESTORE_DATABASE_URL,
      "test root certificate"
    );

    expect(options).toMatchObject({
      ssl: {
        ca: "test root certificate",
        rejectUnauthorized: true,
      },
    });
    expect(options.connectionString).not.toContain("sslmode=");
  });
});

describe("runProductionRestore", () => {
  it("verifies both hashes, restores once and removes every temporary file", async () => {
    let temporaryDirectory = "";
    const commands: string[] = [];
    const runCommand: BackupCommandRunner = vi.fn(
      async ({ arguments_, executable }) => {
        commands.push(`${executable} ${arguments_.join(" ")}`);
        if (arguments_.includes("--version")) {
          return {
            stdout:
              executable === "age" ? "1.3.1" : "pg_restore (PostgreSQL) 18.6",
          };
        }
        if (executable === "age") {
          const outputPath = arguments_[arguments_.indexOf("--output") + 1];
          if (!outputPath) {
            throw new Error("Missing decrypted output path.");
          }
          temporaryDirectory = dirname(outputPath);
          await writeFile(outputPath, "dump");
          return { stdout: "" };
        }
        if (arguments_.includes("--list")) {
          return {
            stdout:
              "; archive\n1; 0 0 TABLE public users backup\n2; 0 0 TABLE DATA public users backup",
          };
        }
        return { stdout: "" };
      }
    );

    const result = await runProductionRestore({
      assertTargetEmpty: async () => undefined,
      downloadEncrypted: async (path) => writeFile(path, "cipher"),
      identityFile: restoreEnvironment.RESTORE_AGE_IDENTITY_FILE,
      manifest: manifest(),
      targetDatabase: "hub_restore_drill",
      pgEnvironment: {
        NODE_ENV: "production",
        PGDATABASE: "hub_restore_drill",
      },
      runCommand,
      verifyRestoredDatabase: async () => ({ tableCount: 44 }),
    });

    expect(result).toEqual({ tableCount: 44 });
    expect(
      commands.filter((command) => command.includes("--list"))
    ).toHaveLength(1);
    expect(
      commands.filter((command) => command.includes("--single-transaction"))
    ).toHaveLength(1);
    expect(
      commands.some((command) => command.includes("--dbname hub_restore_drill"))
    ).toBe(true);
    await expect(access(temporaryDirectory)).rejects.toThrow();
  });

  it("fails before decryption when the encrypted hash is wrong and still cleans up", async () => {
    let encryptedPath = "";
    const runCommand = vi.fn<BackupCommandRunner>();
    await expect(
      runProductionRestore({
        assertTargetEmpty: async () => undefined,
        downloadEncrypted: async (path) => {
          encryptedPath = path;
          await writeFile(path, "tampered");
        },
        identityFile: restoreEnvironment.RESTORE_AGE_IDENTITY_FILE,
        manifest: manifest(),
        targetDatabase: "hub_restore_drill",
        pgEnvironment: { NODE_ENV: "production" },
        runCommand,
        verifyRestoredDatabase: async () => ({ tableCount: 0 }),
      })
    ).rejects.toThrow("encrypted hash");
    expect(runCommand).not.toHaveBeenCalled();
    await expect(access(dirname(encryptedPath))).rejects.toThrow();
  });
});
