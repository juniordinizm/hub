import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { assertFreshProductionBackup } from "../src/tooling/production-backup-check";
import {
  createProductionBackupR2Client,
  findLatestFrequentManifestKey,
  headProductionBackupObject,
  readProductionBackupManifest,
  resolveProductionRestoreR2Config,
} from "../src/tooling/production-backup-r2";

interface MigrationJournal {
  entries: Array<{ tag: string }>;
}

const MAXIMUM_AGE_MINUTES = 6 * 60 + 30;

const requiredEnvironmentValue = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
};

const main = async (): Promise<void> => {
  const journal = JSON.parse(
    await readFile(
      join(import.meta.dirname, "../src/db/migrations/meta/_journal.json"),
      "utf8"
    )
  ) as MigrationJournal;
  const knownMigrationTags = new Set(journal.entries.map(({ tag }) => tag));
  if (knownMigrationTags.size === 0) {
    throw new Error("Local migration journal is invalid.");
  }
  const r2Config = resolveProductionRestoreR2Config(process.env);
  const client = createProductionBackupR2Client(r2Config);
  try {
    const manifestKey = await findLatestFrequentManifestKey({
      bucketName: r2Config.bucketName,
      client,
    });
    const manifest = await readProductionBackupManifest({
      bucketName: r2Config.bucketName,
      client,
      key: manifestKey,
      knownMigrationTags,
    });
    const head = await headProductionBackupObject({
      bucketName: r2Config.bucketName,
      client,
      key: manifest.encryptedObjectKey,
    });
    const freshness = assertFreshProductionBackup({
      head,
      manifest,
      maximumAgeMinutes: MAXIMUM_AGE_MINUTES,
      now: new Date(),
      source: {
        neonBranchId: requiredEnvironmentValue("PRODUCTION_NEON_BRANCH_ID"),
        neonProjectId: requiredEnvironmentValue("PRODUCTION_NEON_PROJECT_ID"),
      },
    });
    process.stdout.write(
      `${JSON.stringify({
        ageMinutes: freshness.ageMinutes,
        backupId: manifest.backupId,
        createdAt: manifest.createdAt,
        migration: manifest.migrationTag,
        status: "fresh",
      })}\n`
    );
  } finally {
    client.destroy();
  }
};

if (import.meta.main) {
  try {
    await main();
  } catch {
    process.stderr.write(
      "Production backup is unavailable or stale. Dispatch the backup workflow and retry.\n"
    );
    process.exitCode = 1;
  }
}
