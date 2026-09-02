import { describe, expect, it } from "vitest";
import {
  buildProductionBackupKeys,
  type ProductionBackupManifestV1,
  parseProductionBackupManifest,
  recommendBackupCadence,
  selectBackupRetentionClasses,
} from "./production-backup";

const validManifest = (): ProductionBackupManifestV1 => ({
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
  migrationTimestamp: 1_777_000_000_000,
  logicalDatabaseBytes: 4096,
  pgDumpVersion: "18.1",
  postgresServerVersion: "18.1",
  releaseSha: "c".repeat(40),
  retentionClasses: ["frequent", "daily", "weekly"],
  schemaVersion: 1,
  sourceEnvironment: "production",
  sourceNeonBranchId: "br-production",
  sourceNeonProjectId: "project-production",
});

describe("parseProductionBackupManifest", () => {
  it("parses the strict sanitized versioned contract", () => {
    expect(
      parseProductionBackupManifest(validManifest(), {
        knownMigrationTags: new Set(["0065_gray_siren"]),
      })
    ).toEqual(validManifest());
  });

  it("parses a Neon server version with a build suffix", () => {
    const manifest = {
      ...validManifest(),
      postgresServerVersion: "18.6 (3484359)",
    };

    expect(
      parseProductionBackupManifest(manifest, {
        knownMigrationTags: new Set(["0065_gray_siren"]),
      }).postgresServerVersion
    ).toBe("18.6 (3484359)");
  });

  it("parses the current Neon alphanumeric build suffix", () => {
    const manifest = {
      ...validManifest(),
      postgresServerVersion: "18.6 (c5250a2)",
    };

    expect(
      parseProductionBackupManifest(manifest, {
        knownMigrationTags: new Set(["0065_gray_siren"]),
      }).postgresServerVersion
    ).toBe("18.6 (c5250a2)");
  });

  it("accepts a committed daily manifest that points to its daily copy", () => {
    const daily = {
      ...validManifest(),
      encryptedObjectKey:
        "postgres/production/daily/0198d6f4-c2a5-7000-8000-000000000001.age",
    };
    expect(
      parseProductionBackupManifest(daily, {
        knownMigrationTags: new Set(["0065_gray_siren"]),
      }).encryptedObjectKey
    ).toContain("/daily/");
  });

  it.each([
    ["unknown migration", { migrationTag: "9999_unknown" }],
    ["uppercase hash", { dumpSha256: "A".repeat(64) }],
    ["non-UTC timestamp", { createdAt: "2026-08-24T00:17:00-03:00" }],
    ["secret-like object key", { encryptedObjectKey: "postgres://secret" }],
    ["unsupported server", { postgresServerVersion: "17.8" }],
  ])("rejects %s", (_label, overrides) => {
    expect(() =>
      parseProductionBackupManifest(
        { ...validManifest(), ...overrides },
        { knownMigrationTags: new Set(["0065_gray_siren"]) }
      )
    ).toThrow();
  });

  it("rejects unrecognized fields instead of retaining sensitive content", () => {
    expect(() =>
      parseProductionBackupManifest(
        { ...validManifest(), databaseUrl: "postgres://redacted" },
        { knownMigrationTags: new Set(["0065_gray_siren"]) }
      )
    ).toThrow();
  });
});

describe("backup retention and deterministic keys", () => {
  it("adds daily and weekly only to the first completed backup in each UTC period", () => {
    expect(
      selectBackupRetentionClasses({
        createdAt: new Date("2026-08-24T00:17:00.000Z"),
        latestDailyCreatedAt: new Date("2026-08-23T00:17:00.000Z"),
        latestWeeklyCreatedAt: new Date("2026-08-17T00:17:00.000Z"),
      })
    ).toEqual(["frequent", "daily", "weekly"]);

    expect(
      selectBackupRetentionClasses({
        createdAt: new Date("2026-08-24T06:17:00.000Z"),
        latestDailyCreatedAt: new Date("2026-08-24T00:17:00.000Z"),
        latestWeeklyCreatedAt: new Date("2026-08-24T00:17:00.000Z"),
      })
    ).toEqual(["frequent"]);
  });

  it("builds stable isolated keys for every retained copy and manifest", () => {
    expect(
      buildProductionBackupKeys("0198d6f4-c2a5-7000-8000-000000000001", [
        "frequent",
        "daily",
      ])
    ).toEqual([
      {
        encryptedObjectKey:
          "postgres/production/frequent/0198d6f4-c2a5-7000-8000-000000000001.age",
        manifestObjectKey:
          "postgres/production/manifests/frequent/0198d6f4-c2a5-7000-8000-000000000001.json",
        retentionClass: "frequent",
      },
      {
        encryptedObjectKey:
          "postgres/production/daily/0198d6f4-c2a5-7000-8000-000000000001.age",
        manifestObjectKey:
          "postgres/production/manifests/daily/0198d6f4-c2a5-7000-8000-000000000001.json",
        retentionClass: "daily",
      },
    ]);
  });
});

describe("recommendBackupCadence", () => {
  it("chooses the shortest cadence below the 80 percent free-tier reserve", () => {
    expect(
      recommendBackupCadence({
        encryptedBytes: 100 * 1024 * 1024,
        manifestBytes: 2048,
      })?.cadenceHours
    ).toBe(6);
  });

  it("falls back through 8 hours to 12 hours based on projected storage", () => {
    expect(
      recommendBackupCadence({
        encryptedBytes: 440 * 1024 * 1024,
        manifestBytes: 2048,
      })?.cadenceHours
    ).toBe(12);
  });

  it("returns null when no free cadence remains below the reserve", () => {
    expect(
      recommendBackupCadence({
        encryptedBytes: 600 * 1024 * 1024,
        manifestBytes: 2048,
      })
    ).toBeNull();
  });
});
