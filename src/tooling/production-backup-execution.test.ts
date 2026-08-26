import { access, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  assertProductionBackupDatabase,
  type BackupCommandRunner,
  classifyBackupCommandFailure,
  classifyProductionBackupFailure,
  resolveProductionBackupExecutionConfig,
  resolveProductionBackupFailureCategory,
  retainCommandOutputContext,
  verifyProductionBackupProviderEvidence,
  withEncryptedProductionDump,
} from "./production-backup-execution";

const environment = {
  BACKUP_AGE_RECIPIENT:
    "age1ql3z7hjy54pw3hyww5ayyfg7zqgvc7w3j2elw8zmrj2kg5sfn9aqmcac8p",
  BACKUP_CADENCE_HOURS: "6",
  BACKUP_DATABASE_URL:
    "postgresql://backup_user:private-password@production.example.test/neondb?sslmode=verify-full",
  GITHUB_SHA: "a".repeat(40),
  PRODUCTION_DATABASE_HOST: "production.example.test",
  PRODUCTION_NEON_BRANCH_ID: "br-production",
  PRODUCTION_NEON_PROJECT_ID: "project-production",
};
const SHA256_PATTERN = /^[0-9a-f]{64}$/;

describe("classifyProductionBackupFailure", () => {
  it.each([
    ["backup role is not read-only", "database-read-only"],
    ["backup role is not a member of pg_read_all_data", "database-access"],
    ["logical database size is invalid", "database-size"],
    ["PostgreSQL server major is not 18", "database-version"],
    ["database migration does not match this release", "database-migration"],
    ["database identity is incomplete", "database-identity"],
    [
      "Production backup database inspection is incomplete.",
      "database-inspection",
    ],
    ["permission denied for schema drizzle", "database-access"],
    [
      'relation "drizzle.__drizzle_migrations" does not exist',
      "database-schema",
    ],
  ])("classifies %s as %s", (message, category) => {
    expect(classifyProductionBackupFailure(new Error(message))).toBe(category);
  });

  it("distinguishes connection failures from precondition failures", () => {
    expect(
      classifyProductionBackupFailure(
        new Error("connection terminated unexpectedly: postgresql://secret")
      )
    ).toBe("database-connection");
  });

  it.each([
    ["pg_dump failed.", "backup-command-pg-dump"],
    ["age failed.", "backup-command-age"],
    ["pg_dump major version must be 18.", "backup-command-pg-dump-version"],
    ["age version must be 1.3.1.", "backup-command-age-version"],
    ["pg_dump version command failed.", "backup-command-pg-dump-version"],
    ["age version command failed.", "backup-command-age-version"],
    ["pg_dump version validation failed.", "backup-command-pg-dump-version"],
    ["age version validation failed.", "backup-command-age-version"],
    ["pg_dump failed (permission).", "backup-command-pg-dump-permission"],
    ["pg_dump failed (connection).", "backup-command-pg-dump-connection"],
    ["pg_dump failed (credentials).", "backup-command-pg-dump-credentials"],
    ["pg_dump failed (schema).", "backup-command-pg-dump-schema"],
    ["pg_dump failed (schema-oid).", "backup-command-pg-dump-schema-oid"],
    ["pg_dump failed (relation).", "backup-command-pg-dump-relation"],
    ["pg_dump failed (column).", "backup-command-pg-dump-column"],
    ["pg_dump failed (function).", "backup-command-pg-dump-function"],
    ["pg_dump failed (query).", "backup-command-pg-dump-query"],
    ["pg_dump failed (version).", "backup-command-pg-dump-version"],
  ])("identifies the failing backup command for %s", (message, category) => {
    expect(classifyProductionBackupFailure(new Error(message))).toBe(category);
  });

  it.each([
    ["28P01", "database-credentials"],
    ["42501", "database-access"],
    ["42P01", "database-schema"],
    ["08006", "database-connection"],
    ["42601", "database-query"],
    ["28000", "database-sqlstate-28000"],
  ])("classifies PostgreSQL code %s as %s", (code, category) => {
    const error = Object.assign(new Error("database operation failed"), {
      code,
    });
    expect(classifyProductionBackupFailure(error)).toBe(category);
  });

  it.each([
    ["transaction", "database-query-transaction"],
    ["settings", "database-query-settings"],
    ["identity", "database-query-identity"],
    ["migration", "database-query-migration"],
  ])("classifies the safe query phase %s as %s", (phase, category) => {
    expect(
      classifyProductionBackupFailure(
        new Error(`Production backup database query failed: ${phase}.`)
      )
    ).toBe(category);
  });

  it("returns a safe category without exposing provider error details", () => {
    const error = new Error(
      "Provider read failed with HTTP 500 at https://console.neon.tech/api/v2/projects/project?api_key=secret"
    );

    expect(classifyProductionBackupFailure(error)).toBe("provider");
    expect(classifyProductionBackupFailure(error)).not.toContain("https://");
    expect(classifyProductionBackupFailure(error)).not.toContain("secret");
  });

  it("uses unexpected for unknown failures", () => {
    expect(classifyProductionBackupFailure(new Error("private payload"))).toBe(
      "unexpected"
    );
    expect(classifyProductionBackupFailure("credential" as unknown)).toBe(
      "unexpected"
    );
  });

  it("falls back to the sanitized execution phase for unknown failures", () => {
    expect(
      resolveProductionBackupFailureCategory("unexpected", "storage")
    ).toBe("storage");
    expect(
      resolveProductionBackupFailureCategory("storage", "database-inspection")
    ).toBe("storage");
  });
});

describe("classifyBackupCommandFailure", () => {
  it.each([
    ["pg_dump: error: permission denied for table users", "permission"],
    ["pg_dump: error: connection to server failed", "connection"],
    [
      "pg_dump: error: connection to server at runner failed: file does not exist",
      "connection",
    ],
    ["pg_dump: error: password authentication failed", "credentials"],
    ['pg_dump: error: relation "users" does not exist', "relation"],
    ["pg_dump: error: server version mismatch", "version"],
    ['pg_dump: error: schema "missing" does not exist', "schema-other"],
    ['pg_dump: error: schema "drizzle" does not exist', "schema-drizzle"],
    ['pg_dump: error: schema "public" does not exist', "schema-public"],
    ['pg_dump: error: schema "pg_catalog" does not exist', "schema-system"],
    ['pg_dump: error: schema "other" does not exist', "schema-other"],
    ["pg_dump: error: schema with OID 12345 does not exist", "schema-oid"],
    ['pg_dump: error: relation "missing" does not exist', "relation"],
    ['pg_dump: error: column "missing" does not exist', "column"],
    ["pg_dump: error: function missing() does not exist", "function"],
    ["pg_dump: error: query failed", "query"],
    ["unrecognized provider output", "unknown"],
  ])("classifies sanitized stderr %s as %s", (stderr, reason) => {
    expect(classifyBackupCommandFailure(stderr)).toBe(reason);
  });
});

describe("retainCommandOutputContext", () => {
  it("keeps both the beginning and end of long command output", () => {
    const result = retainCommandOutputContext(
      "prefix",
      `${"x".repeat(100)}schema with OID 12345 does not exist`,
      100
    );

    expect(result.length).toBeLessThanOrEqual(100);
    expect(result).toContain("prefix");
    expect(result).toContain("schema with OID 12345 does not exist");
  });
});

describe("resolveProductionBackupExecutionConfig", () => {
  it("builds a libpq environment without putting the password in arguments", () => {
    const result = resolveProductionBackupExecutionConfig({
      ...environment,
      PATH: "/runner/tools:/usr/local/bin",
      PGSSLROOTCERT: "/etc/ssl/certs/ca-certificates.crt",
    });
    expect(result).toMatchObject({
      cadenceHours: 6,
      productionBranchId: "br-production",
      productionProjectId: "project-production",
    });
    expect(result).not.toHaveProperty("releaseSha");
    expect(result.pgEnvironment).toMatchObject({
      PATH: "/runner/tools:/usr/local/bin",
      PGDATABASE: "neondb",
      PGHOST: "production.example.test",
      PGPASSWORD: "private-password",
      PGSSLROOTCERT: "/etc/ssl/certs/ca-certificates.crt",
      PGSSLMODE: "verify-full",
      PGUSER: "backup_user",
    });
    expect(result.pgDumpArguments.join(" ")).not.toContain("private-password");
    expect(result.pgDumpArguments.join(" ")).not.toContain("postgresql://");
  });

  it.each([
    [
      "pooled host",
      {
        BACKUP_DATABASE_URL: environment.BACKUP_DATABASE_URL.replace(
          "production.",
          "production-pooler."
        ),
      },
    ],
    ["wrong host", { PRODUCTION_DATABASE_HOST: "other.example.test" }],
    ["unsupported cadence", { BACKUP_CADENCE_HOURS: "4" }],
    ["missing branch", { PRODUCTION_NEON_BRANCH_ID: "" }],
    ["non-X25519 recipient", { BACKUP_AGE_RECIPIENT: "age1pq1unsupported" }],
  ])("rejects %s", (_label, overrides) => {
    expect(() =>
      resolveProductionBackupExecutionConfig({ ...environment, ...overrides })
    ).toThrow();
  });
});

describe("verifyProductionBackupProviderEvidence", () => {
  it("derives the deployed commit and proves the dump host belongs to the declared Neon branch", () => {
    expect(
      verifyProductionBackupProviderEvidence({
        databaseHost: "production.example.test",
        expected: {
          canonicalAlias: "app.neurocapacitar.com.br",
          neonBranchId: "br-production",
          neonProjectId: "project-production",
          vercelProjectId: "project-hub",
        },
        neon: {
          branch: {
            current_state: "ready",
            id: "br-production",
            project_id: "project-production",
          },
        },
        neonEndpoints: {
          endpoints: [
            {
              current_state: "active",
              host: "production.example.test",
              type: "read_write",
            },
          ],
        },
        vercel: {
          alias: ["hub-neuro-capacitar.vercel.app"],
          meta: { githubCommitSha: "c".repeat(40) },
          projectId: "project-hub",
          readyState: "READY",
          target: "production",
        },
        vercelDomains: {
          domains: [
            {
              name: "app.neurocapacitar.com.br",
              projectId: "project-hub",
              verified: true,
            },
          ],
        },
      })
    ).toEqual({
      releaseSha: "c".repeat(40),
      sourceNeonBranchId: "br-production",
      sourceNeonProjectId: "project-production",
    });
  });

  it.each([
    ["wrong dump host", { databaseHost: "other.example.test" }],
    ["missing deployed commit", { vercel: { readyState: "READY" } }],
  ])("rejects %s", (_label, overrides) => {
    expect(() =>
      verifyProductionBackupProviderEvidence({
        databaseHost: "production.example.test",
        expected: {
          canonicalAlias: "app.neurocapacitar.com.br",
          neonBranchId: "br-production",
          neonProjectId: "project-production",
          vercelProjectId: "project-hub",
        },
        neon: {
          branch: {
            current_state: "ready",
            id: "br-production",
            project_id: "project-production",
          },
        },
        neonEndpoints: {
          endpoints: [
            {
              current_state: "active",
              host: "production.example.test",
              type: "read_write",
            },
          ],
        },
        vercel: {
          alias: ["app.neurocapacitar.com.br"],
          meta: { githubCommitSha: "c".repeat(40) },
          projectId: "project-hub",
          readyState: "READY",
          target: "production",
        },
        ...overrides,
      })
    ).toThrow();
  });
});

describe("assertProductionBackupDatabase", () => {
  it("accepts only PostgreSQL 18, the read-all role and the expected migration", () => {
    expect(() =>
      assertProductionBackupDatabase(
        {
          currentDatabase: "neondb",
          currentUser: "backup_user",
          defaultReadOnly: true,
          logicalDatabaseBytes: 2048,
          migrationTag: "0065_gray_siren",
          migrationTimestamp: 1_787_541_858_811,
          pgReadAllDataMember: true,
          postgresServerVersion: "18.6",
          transactionReadOnly: true,
        },
        {
          migrationTag: "0065_gray_siren",
          migrationTimestamp: 1_787_541_858_811,
        }
      )
    ).not.toThrow();
  });

  it("accepts the Neon PostgreSQL version format with a build suffix", () => {
    expect(() =>
      assertProductionBackupDatabase(
        {
          currentDatabase: "neondb",
          currentUser: "backup_user",
          defaultReadOnly: true,
          logicalDatabaseBytes: 2048,
          migrationTag: "0065_gray_siren",
          migrationTimestamp: 1_787_541_858_811,
          pgReadAllDataMember: true,
          postgresServerVersion: "18.6 (3484359)",
          transactionReadOnly: true,
        },
        {
          migrationTag: "0065_gray_siren",
          migrationTimestamp: 1_787_541_858_811,
        }
      )
    ).not.toThrow();
  });

  it.each([
    ["write transaction", { transactionReadOnly: false }],
    ["write default", { defaultReadOnly: false }],
    ["missing read-all membership", { pgReadAllDataMember: false }],
    ["old PostgreSQL", { postgresServerVersion: "17.9" }],
    ["invalid logical size", { logicalDatabaseBytes: 0 }],
    ["migration drift", { migrationTag: "0064_previous" }],
  ])("rejects %s", (_label, overrides) => {
    expect(() =>
      assertProductionBackupDatabase(
        {
          currentDatabase: "neondb",
          currentUser: "backup_user",
          defaultReadOnly: true,
          logicalDatabaseBytes: 2048,
          migrationTag: "0065_gray_siren",
          migrationTimestamp: 1_787_541_858_811,
          pgReadAllDataMember: true,
          postgresServerVersion: "18.6",
          transactionReadOnly: true,
          ...overrides,
        },
        {
          migrationTag: "0065_gray_siren",
          migrationTimestamp: 1_787_541_858_811,
        }
      )
    ).toThrow();
  });
});

describe("withEncryptedProductionDump", () => {
  it("deletes the clear dump before upload and removes all temporary files", async () => {
    let temporaryDirectory = "";
    const calls: Array<{ arguments_: readonly string[]; executable: string }> =
      [];
    const runCommand: BackupCommandRunner = vi.fn(
      async ({ arguments_, executable }) => {
        calls.push({ arguments_, executable });
        if (arguments_.includes("--version")) {
          return {
            stdout:
              executable === "pg_dump" ? "pg_dump (PostgreSQL) 18.6" : "1.3.1",
          };
        }
        const outputIndex = arguments_.findIndex(
          (argument: string) => argument === "--file" || argument === "--output"
        );
        const outputPath = arguments_[outputIndex + 1];
        if (!outputPath) {
          throw new Error("Test command output path is missing.");
        }
        temporaryDirectory = dirname(outputPath);
        await writeFile(
          outputPath,
          executable === "pg_dump" ? "plain-dump" : "age-cipher"
        );
        return { stdout: "" };
      }
    );

    const result = await withEncryptedProductionDump({
      ageRecipient: environment.BACKUP_AGE_RECIPIENT,
      pgEnvironment:
        resolveProductionBackupExecutionConfig(environment).pgEnvironment,
      runCommand,
      processEncryptedDump: async ({ dumpPath, encryptedPath }) => {
        await expect(access(dumpPath)).rejects.toThrow();
        await access(encryptedPath);
        return "uploaded";
      },
    });

    expect(result.result).toBe("uploaded");
    expect(result.dumpBytes).toBe(10);
    expect(result.dumpSha256).toMatch(SHA256_PATTERN);
    expect(result.encryptedSha256).toMatch(SHA256_PATTERN);
    await expect(access(temporaryDirectory)).rejects.toThrow();
    expect(
      calls.flatMap(({ arguments_ }) => arguments_).join(" ")
    ).not.toContain("private-password");
  });

  it("cleans the temporary directory after command failure", async () => {
    let dumpPath = "";
    const runCommand: BackupCommandRunner = ({ arguments_, executable }) => {
      if (arguments_.includes("--version")) {
        return Promise.resolve({
          stdout:
            executable === "pg_dump" ? "pg_dump (PostgreSQL) 18.6" : "1.3.1",
        });
      }
      dumpPath = String(arguments_[arguments_.indexOf("--file") + 1] ?? "");
      return Promise.reject(new Error("command failed"));
    };

    await expect(
      withEncryptedProductionDump({
        ageRecipient: environment.BACKUP_AGE_RECIPIENT,
        pgEnvironment:
          resolveProductionBackupExecutionConfig(environment).pgEnvironment,
        runCommand,
        processEncryptedDump: async () => undefined,
      })
    ).rejects.toThrow("pg_dump failed.");
    await expect(access(dirname(dumpPath))).rejects.toThrow();
  });

  it("labels a missing pg_dump output as a dump verification failure", async () => {
    const runCommand: BackupCommandRunner = vi.fn(
      ({ arguments_, executable }) => {
        if (arguments_.includes("--version")) {
          return Promise.resolve({
            stdout:
              executable === "pg_dump" ? "pg_dump (PostgreSQL) 18.6" : "1.3.1",
          });
        }
        return Promise.resolve({ stdout: "" });
      }
    );

    await expect(
      withEncryptedProductionDump({
        ageRecipient: environment.BACKUP_AGE_RECIPIENT,
        pgEnvironment:
          resolveProductionBackupExecutionConfig(environment).pgEnvironment,
        runCommand,
        processEncryptedDump: async () => undefined,
      })
    ).rejects.toThrow("pg_dump output verification failed.");
  });
});
