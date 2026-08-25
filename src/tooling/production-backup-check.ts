import type { ProductionBackupManifestV1 } from "./production-backup";

const MAXIMUM_FUTURE_SKEW_MS = 5 * 60 * 1000;

export const assertFreshProductionBackup = ({
  head,
  manifest,
  maximumAgeMinutes,
  now,
  source,
}: {
  head: { contentLength: number; metadataSha256?: string };
  manifest: ProductionBackupManifestV1;
  maximumAgeMinutes: number;
  now: Date;
  source: { neonBranchId: string; neonProjectId: string };
}): { ageMinutes: number } => {
  const createdAt = Date.parse(manifest.createdAt);
  if (
    !(Number.isFinite(createdAt) && Number.isSafeInteger(maximumAgeMinutes)) ||
    maximumAgeMinutes <= 0 ||
    Number.isNaN(now.getTime())
  ) {
    throw new Error("Production backup freshness input is invalid.");
  }
  const ageMilliseconds = now.getTime() - createdAt;
  if (ageMilliseconds < -MAXIMUM_FUTURE_SKEW_MS) {
    throw new Error("Production backup manifest is dated in the future.");
  }
  const ageMinutes = Math.max(0, Math.ceil(ageMilliseconds / 60_000));
  if (ageMinutes > maximumAgeMinutes) {
    throw new Error("Production backup is stale.");
  }
  if (
    head.contentLength !== manifest.encryptedBytes ||
    head.metadataSha256 !== manifest.encryptedSha256
  ) {
    throw new Error("Production backup HEAD evidence mismatched.");
  }
  if (
    manifest.sourceNeonBranchId !== source.neonBranchId ||
    manifest.sourceNeonProjectId !== source.neonProjectId
  ) {
    throw new Error("Production backup source evidence mismatched.");
  }
  return { ageMinutes };
};
