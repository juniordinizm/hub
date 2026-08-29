import {
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  type S3Client,
} from "@aws-sdk/client-s3";
import { describe, expect, it, vi } from "vitest";
import type { ProductionBackupManifestV1 } from "./production-backup";
import {
  createProductionBackupR2Client,
  findLatestBackupManifests,
  findLatestFrequentManifestKey,
  headProductionBackupObject,
  publishProductionBackup,
  readProductionBackupManifest,
  resolveProductionBackupR2Config,
  resolveProductionRestoreR2Config,
} from "./production-backup-r2";

const manifest: ProductionBackupManifestV1 = {
  backupId: "0198d6f4-c2a5-7000-8000-000000000001",
  cadenceHours: 6,
  compression: "pg-custom-z9",
  createdAt: "2026-08-24T00:17:00.000Z",
  dumpBytes: 2,
  dumpSha256: "a".repeat(64),
  encryptedBytes: 3,
  encryptedObjectKey:
    "postgres/production/frequent/0198d6f4-c2a5-7000-8000-000000000001.age",
  encryptedSha256: "b".repeat(64),
  encryption: "age-x25519",
  migrationTag: "0065_gray_siren",
  migrationTimestamp: 1_777_000_000_000,
  logicalDatabaseBytes: 4,
  pgDumpVersion: "18.1",
  postgresServerVersion: "18.1",
  releaseSha: "c".repeat(40),
  retentionClasses: ["frequent", "daily"],
  schemaVersion: 1,
  sourceEnvironment: "production",
  sourceNeonBranchId: "br-production",
  sourceNeonProjectId: "project-production",
};

describe("resolveProductionBackupR2Config", () => {
  it("accepts only the dedicated private-backup credentials", () => {
    expect(
      resolveProductionBackupR2Config({
        BACKUP_R2_ACCESS_KEY_ID: "access-key",
        BACKUP_R2_ACCOUNT_ID: "0123456789abcdef0123456789abcdef",
        BACKUP_R2_BUCKET_NAME: "hub-production-backups",
        BACKUP_R2_SECRET_ACCESS_KEY: "secret-key",
      })
    ).toMatchObject({
      bucketName: "hub-production-backups",
      endpoint:
        "https://0123456789abcdef0123456789abcdef.r2.cloudflarestorage.com",
      region: "auto",
    });
  });

  it("rejects missing, malformed or shared application configuration", () => {
    expect(() =>
      resolveProductionBackupR2Config({
        BACKUP_R2_ACCESS_KEY_ID: "access-key",
        BACKUP_R2_ACCOUNT_ID: "invalid/account",
        BACKUP_R2_BUCKET_NAME: "hub-production-backups",
        BACKUP_R2_SECRET_ACCESS_KEY: "secret-key",
      })
    ).toThrow();
    expect(() =>
      resolveProductionBackupR2Config({
        R2_ACCESS_KEY_ID: "application-key",
        R2_ACCOUNT_ID: "0123456789abcdef0123456789abcdef",
        R2_BUCKET_NAME: "shared-media",
        R2_SECRET_ACCESS_KEY: "application-secret",
      })
    ).toThrow("BACKUP_R2_ACCOUNT_ID");
  });
});

describe("createProductionBackupR2Client", () => {
  it("buffers streaming request bodies for retry-safe R2 uploads", () => {
    const client = createProductionBackupR2Client({
      accessKeyId: "access-key",
      bucketName: "hub-production-backups",
      endpoint:
        "https://0123456789abcdef0123456789abcdef.r2.cloudflarestorage.com",
      region: "auto",
      secretAccessKey: "secret-key",
    });

    const config = (
      client as unknown as {
        config: { requestStreamBufferSize?: number | false };
      }
    ).config;
    expect(config.requestStreamBufferSize).toBeGreaterThanOrEqual(8 * 1024);
  });
});

describe("publishProductionBackup", () => {
  it("uploads and verifies every cipher before publishing any manifest", async () => {
    const commands: unknown[] = [];
    const send = vi.fn((command: unknown) => {
      commands.push(command);
      if (command instanceof HeadObjectCommand) {
        return Promise.resolve({
          ContentLength: 3,
          Metadata: { sha256: manifest.encryptedSha256 },
        });
      }
      return Promise.resolve({});
    });

    await expect(
      publishProductionBackup({
        bucketName: "hub-production-backups",
        client: { send } as unknown as S3Client,
        createEncryptedBody: () => Buffer.from("age"),
        manifest,
      })
    ).resolves.toEqual({ objectCount: 4 });

    expect(commands.slice(0, 4)).toEqual([
      expect.any(PutObjectCommand),
      expect.any(HeadObjectCommand),
      expect.any(PutObjectCommand),
      expect.any(HeadObjectCommand),
    ]);
    expect(commands.slice(4)).toEqual([
      expect.any(PutObjectCommand),
      expect.any(PutObjectCommand),
    ]);
    const manifestPuts = commands.slice(4) as PutObjectCommand[];
    expect(
      manifestPuts.every(
        (command) => command.input.ContentType === "application/json"
      )
    ).toBe(true);
  });

  it("does not publish a manifest when HEAD metadata mismatches", async () => {
    const send = vi.fn((command: unknown) => {
      if (command instanceof HeadObjectCommand) {
        return Promise.resolve({ ContentLength: 2, Metadata: {} });
      }
      return Promise.resolve({});
    });

    await expect(
      publishProductionBackup({
        bucketName: "hub-production-backups",
        client: { send } as unknown as S3Client,
        createEncryptedBody: () => Buffer.from("age"),
        manifest,
      })
    ).rejects.toThrow("verification");
    expect(
      send.mock.calls.some(
        ([command]) =>
          command instanceof PutObjectCommand &&
          command.input.ContentType === "application/json"
      )
    ).toBe(false);
  });
});

describe("findLatestBackupManifests", () => {
  it("paginates by continuation token and finds the latest daily and weekly markers", async () => {
    const send = vi.fn((command: unknown) => {
      expect(command).toBeInstanceOf(ListObjectsV2Command);
      const list = command as ListObjectsV2Command;
      if (!list.input.ContinuationToken) {
        return Promise.resolve({
          Contents: [
            {
              Key: "postgres/production/manifests/daily/old.json",
              LastModified: new Date("2026-08-22T00:17:00.000Z"),
            },
          ],
          IsTruncated: true,
          NextContinuationToken: "page-2",
        });
      }
      return Promise.resolve({
        Contents: [
          {
            Key: "postgres/production/manifests/daily/new.json",
            LastModified: new Date("2026-08-23T00:17:00.000Z"),
          },
          {
            Key: "postgres/production/manifests/weekly/new.json",
            LastModified: new Date("2026-08-18T00:17:00.000Z"),
          },
        ],
        IsTruncated: false,
      });
    });

    await expect(
      findLatestBackupManifests({
        bucketName: "hub-production-backups",
        client: { send } as unknown as S3Client,
      })
    ).resolves.toEqual({
      daily: new Date("2026-08-23T00:17:00.000Z"),
      weekly: new Date("2026-08-18T00:17:00.000Z"),
    });
    expect(send).toHaveBeenCalledTimes(2);
  });
});

describe("readProductionBackupManifest", () => {
  it("parses only a small committed manifest with a known migration", async () => {
    const encoded = `${JSON.stringify(manifest)}\n`;
    const send = vi.fn((command: unknown) => {
      expect(command).toBeInstanceOf(GetObjectCommand);
      return Promise.resolve({
        Body: {
          transformToString: () => Promise.resolve(encoded),
        },
        ContentLength: Buffer.byteLength(encoded),
      });
    });
    await expect(
      readProductionBackupManifest({
        bucketName: "hub-production-backups",
        client: { send } as unknown as S3Client,
        key: "postgres/production/manifests/frequent/0198d6f4-c2a5-7000-8000-000000000001.json",
        knownMigrationTags: new Set(["0065_gray_siren"]),
      })
    ).resolves.toEqual(manifest);
  });

  it("uses separate read-only credentials for restore drills", () => {
    expect(
      resolveProductionRestoreR2Config({
        BACKUP_R2_ACCOUNT_ID: "0123456789abcdef0123456789abcdef",
        BACKUP_R2_BUCKET_NAME: "hub-production-backups",
        RESTORE_R2_ACCESS_KEY_ID: "restore-read-key",
        RESTORE_R2_SECRET_ACCESS_KEY: "restore-read-secret",
      })
    ).toMatchObject({
      accessKeyId: "restore-read-key",
      secretAccessKey: "restore-read-secret",
    });
  });
});

describe("release backup evidence", () => {
  it("selects the newest committed frequent manifest and reads cipher HEAD metadata", async () => {
    const send = vi.fn((command: unknown) => {
      if (command instanceof ListObjectsV2Command) {
        return Promise.resolve({
          Contents: [
            {
              Key: "postgres/production/manifests/frequent/old.json",
              LastModified: new Date("2026-08-23T00:17:00.000Z"),
            },
            {
              Key: "postgres/production/manifests/frequent/new.json",
              LastModified: new Date("2026-08-24T00:17:00.000Z"),
            },
          ],
          IsTruncated: false,
        });
      }
      expect(command).toBeInstanceOf(HeadObjectCommand);
      return Promise.resolve({
        ContentLength: 1024,
        Metadata: { sha256: "b".repeat(64) },
      });
    });
    const client = { send } as unknown as S3Client;
    await expect(
      findLatestFrequentManifestKey({
        bucketName: "hub-production-backups",
        client,
      })
    ).resolves.toBe("postgres/production/manifests/frequent/new.json");
    await expect(
      headProductionBackupObject({
        bucketName: "hub-production-backups",
        client,
        key: manifest.encryptedObjectKey,
      })
    ).resolves.toEqual({
      contentLength: 1024,
      metadataSha256: "b".repeat(64),
    });
  });
});
