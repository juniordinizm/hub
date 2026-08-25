import { describe, expect, it } from "vitest";
import type { ProductionBackupManifestV1 } from "./production-backup";
import { assertFreshProductionBackup } from "./production-backup-check";

const manifest = (
  overrides: Partial<ProductionBackupManifestV1> = {}
): ProductionBackupManifestV1 => ({
  backupId: "0198d6f4-c2a5-7000-8000-000000000001",
  cadenceHours: 6,
  compression: "pg-custom-z9",
  createdAt: "2026-08-24T00:17:00.000Z",
  dumpBytes: 768,
  dumpSha256: "a".repeat(64),
  encryptedBytes: 1024,
  encryptedObjectKey:
    "postgres/production/frequent/0198d6f4-c2a5-7000-8000-000000000001.age",
  encryptedSha256: "b".repeat(64),
  encryption: "age-x25519",
  migrationTag: "0065_gray_siren",
  migrationTimestamp: 1_787_541_858_811,
  logicalDatabaseBytes: 4096,
  pgDumpVersion: "18.6",
  postgresServerVersion: "18.6",
  releaseSha: "c".repeat(40),
  retentionClasses: ["frequent"],
  schemaVersion: 1,
  sourceEnvironment: "production",
  sourceNeonBranchId: "br-production",
  sourceNeonProjectId: "project-production",
  ...overrides,
});

describe("assertFreshProductionBackup", () => {
  it("accepts a committed object inside RPO plus thirty minutes", () => {
    expect(
      assertFreshProductionBackup({
        head: {
          contentLength: 1024,
          metadataSha256: "b".repeat(64),
        },
        manifest: manifest(),
        maximumAgeMinutes: 390,
        now: new Date("2026-08-24T06:46:59.000Z"),
        source: {
          neonBranchId: "br-production",
          neonProjectId: "project-production",
        },
      })
    ).toEqual({ ageMinutes: 390 });
  });

  it.each([
    ["stale", { now: new Date("2026-08-24T06:47:01.000Z") }],
    ["future", { now: new Date("2026-08-23T23:00:00.000Z") }],
    [
      "wrong length",
      { head: { contentLength: 1, metadataSha256: "b".repeat(64) } },
    ],
    [
      "wrong hash metadata",
      { head: { contentLength: 1024, metadataSha256: "d".repeat(64) } },
    ],
    [
      "wrong source branch",
      {
        source: {
          neonBranchId: "br-other",
          neonProjectId: "project-production",
        },
      },
    ],
  ])("rejects %s evidence", (_label, overrides) => {
    expect(() =>
      assertFreshProductionBackup({
        head: {
          contentLength: 1024,
          metadataSha256: "b".repeat(64),
        },
        manifest: manifest(),
        maximumAgeMinutes: 390,
        now: new Date("2026-08-24T06:00:00.000Z"),
        source: {
          neonBranchId: "br-production",
          neonProjectId: "project-production",
        },
        ...overrides,
      })
    ).toThrow();
  });
});
