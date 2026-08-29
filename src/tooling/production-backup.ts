import { z } from "zod";

export const BACKUP_RETENTION_CLASSES = [
  "frequent",
  "daily",
  "weekly",
] as const;
export type BackupRetentionClass = (typeof BACKUP_RETENTION_CLASSES)[number];
export type BackupCadenceHours = 6 | 8 | 12;

export interface ProductionBackupManifestV1 {
  backupId: string;
  cadenceHours: BackupCadenceHours;
  compression: "pg-custom-z9";
  createdAt: string;
  dumpBytes: number;
  dumpSha256: string;
  encryptedBytes: number;
  encryptedObjectKey: string;
  encryptedSha256: string;
  encryption: "age-x25519";
  logicalDatabaseBytes: number;
  migrationTag: string;
  migrationTimestamp: number;
  pgDumpVersion: string;
  postgresServerVersion: string;
  releaseSha: string;
  retentionClasses: BackupRetentionClass[];
  schemaVersion: 1;
  sourceEnvironment: "production";
  sourceNeonBranchId: string;
  sourceNeonProjectId: string;
}

export interface ProductionBackupKeySet {
  encryptedObjectKey: string;
  manifestObjectKey: string;
  retentionClass: BackupRetentionClass;
}

const BACKUP_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const HASH_PATTERN = /^[0-9a-f]{64}$/;
const MIGRATION_TAG_PATTERN = /^\d{4}_[a-z0-9_]+$/;
const NEON_BRANCH_ID_PATTERN = /^br-[a-z0-9-]+$/;
const NEON_PROJECT_ID_PATTERN = /^[a-z0-9][a-z0-9-]+$/;
const POSTGRES_18_VERSION_PATTERN = /^18(?:\.\d+){0,2}(?:\s+\(\d+\))?$/;
const RELEASE_SHA_PATTERN = /^[0-9a-f]{40}$/;
const UTC_TIMESTAMP_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;

const manifestSchema = z
  .object({
    backupId: z.string().regex(BACKUP_ID_PATTERN),
    cadenceHours: z.union([z.literal(6), z.literal(8), z.literal(12)]),
    compression: z.literal("pg-custom-z9"),
    createdAt: z.string().regex(UTC_TIMESTAMP_PATTERN),
    dumpBytes: z.number().int().positive(),
    dumpSha256: z.string().regex(HASH_PATTERN),
    encryptedBytes: z.number().int().positive(),
    encryptedObjectKey: z.string(),
    encryptedSha256: z.string().regex(HASH_PATTERN),
    encryption: z.literal("age-x25519"),
    migrationTag: z.string().regex(MIGRATION_TAG_PATTERN),
    migrationTimestamp: z.number().int().positive(),
    logicalDatabaseBytes: z.number().int().positive(),
    pgDumpVersion: z.string().regex(POSTGRES_18_VERSION_PATTERN),
    postgresServerVersion: z.string().regex(POSTGRES_18_VERSION_PATTERN),
    releaseSha: z.string().regex(RELEASE_SHA_PATTERN),
    retentionClasses: z
      .array(z.enum(BACKUP_RETENTION_CLASSES))
      .min(1)
      .max(BACKUP_RETENTION_CLASSES.length),
    schemaVersion: z.literal(1),
    sourceEnvironment: z.literal("production"),
    sourceNeonBranchId: z.string().regex(NEON_BRANCH_ID_PATTERN),
    sourceNeonProjectId: z.string().regex(NEON_PROJECT_ID_PATTERN),
  })
  .strict();

export const buildProductionBackupKeys = (
  backupId: string,
  retentionClasses: readonly BackupRetentionClass[]
): ProductionBackupKeySet[] => {
  if (!BACKUP_ID_PATTERN.test(backupId)) {
    throw new Error("Backup ID is invalid.");
  }
  const uniqueClasses = new Set(retentionClasses);
  if (uniqueClasses.size !== retentionClasses.length) {
    throw new Error("Backup retention classes must be unique.");
  }

  return retentionClasses.map((retentionClass) => ({
    encryptedObjectKey: `postgres/production/${retentionClass}/${backupId}.age`,
    manifestObjectKey: `postgres/production/manifests/${retentionClass}/${backupId}.json`,
    retentionClass,
  }));
};

export const parseProductionBackupManifest = (
  input: unknown,
  { knownMigrationTags }: { knownMigrationTags: ReadonlySet<string> }
): ProductionBackupManifestV1 => {
  const manifest = manifestSchema.parse(input);
  const uniqueRetentionClasses = new Set(manifest.retentionClasses);
  if (
    uniqueRetentionClasses.size !== manifest.retentionClasses.length ||
    !uniqueRetentionClasses.has("frequent")
  ) {
    throw new Error(
      "Backup retention classes must be unique and include frequent."
    );
  }
  if (!knownMigrationTags.has(manifest.migrationTag)) {
    throw new Error("Backup migration is not known by this release.");
  }

  const expectedObjectKeys = new Set(
    buildProductionBackupKeys(manifest.backupId, manifest.retentionClasses).map(
      ({ encryptedObjectKey }) => encryptedObjectKey
    )
  );
  if (!expectedObjectKeys.has(manifest.encryptedObjectKey)) {
    throw new Error("Backup object key does not match its ID and namespace.");
  }

  return manifest;
};

const utcDateKey = (date: Date): string => date.toISOString().slice(0, 10);

const isoWeekKey = (date: Date): string => {
  const normalized = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
  const weekday = normalized.getUTCDay() || 7;
  normalized.setUTCDate(normalized.getUTCDate() + 4 - weekday);
  const yearStart = new Date(Date.UTC(normalized.getUTCFullYear(), 0, 1));
  const week = Math.ceil(
    ((normalized.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7
  );
  return `${normalized.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
};

const isValidDate = (date: Date): boolean => !Number.isNaN(date.getTime());

export const selectBackupRetentionClasses = ({
  createdAt,
  latestDailyCreatedAt,
  latestWeeklyCreatedAt,
}: {
  createdAt: Date;
  latestDailyCreatedAt?: Date;
  latestWeeklyCreatedAt?: Date;
}): BackupRetentionClass[] => {
  if (!isValidDate(createdAt)) {
    throw new Error("Backup creation time is invalid.");
  }
  const classes: BackupRetentionClass[] = ["frequent"];
  const hasDailyForPeriod =
    latestDailyCreatedAt &&
    isValidDate(latestDailyCreatedAt) &&
    utcDateKey(latestDailyCreatedAt) === utcDateKey(createdAt);
  if (!hasDailyForPeriod) {
    classes.push("daily");
  }

  const hasWeeklyForPeriod =
    latestWeeklyCreatedAt &&
    isValidDate(latestWeeklyCreatedAt) &&
    isoWeekKey(latestWeeklyCreatedAt) === isoWeekKey(createdAt);
  if (!hasWeeklyForPeriod) {
    classes.push("weekly");
  }
  return classes;
};

const FREE_STANDARD_STORAGE_BYTES = 10_000_000_000;
const FREE_CLASS_A_OPERATIONS = 1_000_000;
const FREE_CLASS_B_OPERATIONS = 10_000_000;
const FREE_TIER_RESERVE_RATIO = 0.8;
const MONTH_DAYS = 30;
const FREQUENT_RETENTION_HOURS = 48;
const DAILY_RETENTION_DAYS = 8;
const WEEKLY_RETENTION_DAYS = 29;

export interface BackupQuotaProjection {
  cadenceHours: BackupCadenceHours;
  classAOperations: number;
  classBOperations: number;
  storageBytes: number;
}

export const projectBackupQuota = ({
  cadenceHours,
  encryptedBytes,
  manifestBytes,
}: {
  cadenceHours: BackupCadenceHours;
  encryptedBytes: number;
  manifestBytes: number;
}): BackupQuotaProjection => {
  if (
    !Number.isSafeInteger(encryptedBytes) ||
    encryptedBytes <= 0 ||
    !Number.isSafeInteger(manifestBytes) ||
    manifestBytes <= 0
  ) {
    throw new Error("Backup quota inputs must be positive integer bytes.");
  }
  const bytesPerClass = encryptedBytes + manifestBytes;
  const frequentCopies = Math.ceil(FREQUENT_RETENTION_HOURS / cadenceHours);
  const dailyCopies = DAILY_RETENTION_DAYS;
  const weeklyCopies = Math.ceil(WEEKLY_RETENTION_DAYS / 7);
  const runsPerMonth = Math.ceil((MONTH_DAYS * 24) / cadenceHours);
  const dailyRunsPerMonth = MONTH_DAYS;
  const weeklyRunsPerMonth = Math.ceil(MONTH_DAYS / 7);
  const classCopiesPerMonth =
    runsPerMonth + dailyRunsPerMonth + weeklyRunsPerMonth;

  return {
    cadenceHours,
    classAOperations: classCopiesPerMonth * 2,
    classBOperations: classCopiesPerMonth,
    storageBytes: bytesPerClass * (frequentCopies + dailyCopies + weeklyCopies),
  };
};

export const recommendBackupCadence = ({
  encryptedBytes,
  manifestBytes,
  otherClassAOperations = 0,
  otherClassBOperations = 0,
  otherStorageBytes = 0,
}: {
  encryptedBytes: number;
  manifestBytes: number;
  otherClassAOperations?: number;
  otherClassBOperations?: number;
  otherStorageBytes?: number;
}): BackupQuotaProjection | null => {
  for (const cadenceHours of [6, 8, 12] as const) {
    const projection = projectBackupQuota({
      cadenceHours,
      encryptedBytes,
      manifestBytes,
    });
    if (
      projection.storageBytes + otherStorageBytes <=
        FREE_STANDARD_STORAGE_BYTES * FREE_TIER_RESERVE_RATIO &&
      projection.classAOperations + otherClassAOperations <=
        FREE_CLASS_A_OPERATIONS * FREE_TIER_RESERVE_RATIO &&
      projection.classBOperations + otherClassBOperations <=
        FREE_CLASS_B_OPERATIONS * FREE_TIER_RESERVE_RATIO
    ) {
      return projection;
    }
  }
  return null;
};
