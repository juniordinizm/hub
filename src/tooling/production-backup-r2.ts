import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import {
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  type PutObjectCommandInput,
  S3Client,
} from "@aws-sdk/client-s3";
import {
  buildProductionBackupKeys,
  type ProductionBackupManifestV1,
  parseProductionBackupManifest,
} from "./production-backup";

type BackupEnvironment = Readonly<Record<string, string | undefined>>;

export interface ProductionBackupR2Config {
  accessKeyId: string;
  bucketName: string;
  endpoint: string;
  region: "auto";
  secretAccessKey: string;
}

const ACCOUNT_ID_PATTERN = /^[0-9a-f]{32}$/;
const BUCKET_NAME_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])?$/;
const HASH_PATTERN = /^[0-9a-f]{64}$/;
const MAX_LIST_PAGES = 100;

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

export const resolveProductionBackupR2Config = (
  environment: BackupEnvironment
): ProductionBackupR2Config => {
  const accountId = requiredEnvironmentValue(
    environment,
    "BACKUP_R2_ACCOUNT_ID"
  );
  if (!ACCOUNT_ID_PATTERN.test(accountId)) {
    throw new Error("BACKUP_R2_ACCOUNT_ID is invalid.");
  }
  const bucketName = requiredEnvironmentValue(
    environment,
    "BACKUP_R2_BUCKET_NAME"
  );
  if (!BUCKET_NAME_PATTERN.test(bucketName)) {
    throw new Error("BACKUP_R2_BUCKET_NAME is invalid.");
  }

  return {
    accessKeyId: requiredEnvironmentValue(
      environment,
      "BACKUP_R2_ACCESS_KEY_ID"
    ),
    bucketName,
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    region: "auto",
    secretAccessKey: requiredEnvironmentValue(
      environment,
      "BACKUP_R2_SECRET_ACCESS_KEY"
    ),
  };
};

export const createProductionBackupR2Client = (
  config: ProductionBackupR2Config
): S3Client =>
  new S3Client({
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    endpoint: config.endpoint,
    region: config.region,
  });

const metadataValue = (
  metadata: Record<string, string> | undefined,
  name: string
): string | undefined =>
  Object.entries(metadata ?? {}).find(
    ([key]) => key.toLowerCase() === name.toLowerCase()
  )?.[1];

export const publishProductionBackup = async ({
  bucketName,
  client,
  createEncryptedBody,
  manifest,
}: {
  bucketName: string;
  client: S3Client;
  createEncryptedBody: () => NonNullable<PutObjectCommandInput["Body"]>;
  manifest: ProductionBackupManifestV1;
}): Promise<{ objectCount: number }> => {
  if (!HASH_PATTERN.test(manifest.encryptedSha256)) {
    throw new Error("Encrypted backup SHA-256 is invalid.");
  }
  const keys = buildProductionBackupKeys(
    manifest.backupId,
    manifest.retentionClasses
  );

  for (const key of keys) {
    await client.send(
      new PutObjectCommand({
        Body: createEncryptedBody(),
        Bucket: bucketName,
        ContentLength: manifest.encryptedBytes,
        ContentType: "application/octet-stream",
        IfNoneMatch: "*",
        Key: key.encryptedObjectKey,
        Metadata: {
          "backup-id": manifest.backupId,
          sha256: manifest.encryptedSha256,
        },
      })
    );
    const head = await client.send(
      new HeadObjectCommand({
        Bucket: bucketName,
        Key: key.encryptedObjectKey,
      })
    );
    if (
      head.ContentLength !== manifest.encryptedBytes ||
      metadataValue(head.Metadata, "sha256") !== manifest.encryptedSha256
    ) {
      throw new Error("Encrypted backup HEAD verification failed.");
    }
  }

  for (const key of keys) {
    const classManifest: ProductionBackupManifestV1 = {
      ...manifest,
      encryptedObjectKey: key.encryptedObjectKey,
    };
    await client.send(
      new PutObjectCommand({
        Body: Buffer.from(`${JSON.stringify(classManifest)}\n`, "utf8"),
        Bucket: bucketName,
        ContentType: "application/json",
        IfNoneMatch: "*",
        Key: key.manifestObjectKey,
        Metadata: {
          "backup-id": manifest.backupId,
          "schema-version": String(manifest.schemaVersion),
        },
      })
    );
  }

  return { objectCount: keys.length * 2 };
};

const latestDate = (left: Date | undefined, right: Date): Date =>
  !left || right.getTime() > left.getTime() ? right : left;

interface LatestBackupManifests {
  daily?: Date;
  weekly?: Date;
}

const mergeLatestBackupManifests = (
  current: LatestBackupManifests,
  objects: readonly {
    Key?: string | undefined;
    LastModified?: Date | undefined;
  }[]
): LatestBackupManifests => {
  let daily = current.daily;
  let weekly = current.weekly;
  for (const object of objects) {
    if (!(object.Key && object.LastModified)) {
      continue;
    }
    if (object.Key.startsWith("postgres/production/manifests/daily/")) {
      daily = latestDate(daily, object.LastModified);
    }
    if (object.Key.startsWith("postgres/production/manifests/weekly/")) {
      weekly = latestDate(weekly, object.LastModified);
    }
  }
  return {
    ...(daily ? { daily } : {}),
    ...(weekly ? { weekly } : {}),
  };
};

export const findLatestBackupManifests = async ({
  bucketName,
  client,
}: {
  bucketName: string;
  client: S3Client;
}): Promise<{ daily?: Date; weekly?: Date }> => {
  let continuationToken: string | undefined;
  let latest: LatestBackupManifests = {};

  for (let page = 0; page < MAX_LIST_PAGES; page += 1) {
    const result = await client.send(
      new ListObjectsV2Command({
        Bucket: bucketName,
        ...(continuationToken ? { ContinuationToken: continuationToken } : {}),
        Prefix: "postgres/production/manifests/",
      })
    );
    latest = mergeLatestBackupManifests(latest, result.Contents ?? []);
    if (!result.IsTruncated) {
      return latest;
    }
    if (!result.NextContinuationToken) {
      throw new Error("R2 returned a truncated page without a cursor.");
    }
    continuationToken = result.NextContinuationToken;
  }

  throw new Error("R2 manifest pagination exceeded the safety limit.");
};

export const resolveProductionRestoreR2Config = (
  environment: BackupEnvironment
): ProductionBackupR2Config =>
  resolveProductionBackupR2Config({
    BACKUP_R2_ACCESS_KEY_ID: environment.RESTORE_R2_ACCESS_KEY_ID,
    BACKUP_R2_ACCOUNT_ID: environment.BACKUP_R2_ACCOUNT_ID,
    BACKUP_R2_BUCKET_NAME: environment.BACKUP_R2_BUCKET_NAME,
    BACKUP_R2_SECRET_ACCESS_KEY: environment.RESTORE_R2_SECRET_ACCESS_KEY,
  });

export const readProductionBackupManifest = async ({
  bucketName,
  client,
  key,
  knownMigrationTags,
}: {
  bucketName: string;
  client: S3Client;
  key: string;
  knownMigrationTags: ReadonlySet<string>;
}): Promise<ProductionBackupManifestV1> => {
  const object = await client.send(
    new GetObjectCommand({ Bucket: bucketName, Key: key })
  );
  if (!(object.Body && (object.ContentLength ?? 0) <= 64 * 1024)) {
    throw new Error("Production backup manifest is missing or oversized.");
  }
  const contents = await object.Body.transformToString("utf8");
  return parseProductionBackupManifest(JSON.parse(contents) as unknown, {
    knownMigrationTags,
  });
};

export const downloadProductionBackupObject = async ({
  bucketName,
  client,
  destinationPath,
  key,
}: {
  bucketName: string;
  client: S3Client;
  destinationPath: string;
  key: string;
}): Promise<void> => {
  const object = await client.send(
    new GetObjectCommand({ Bucket: bucketName, Key: key })
  );
  if (!object.Body) {
    throw new Error("Production backup object body is missing.");
  }
  await pipeline(
    object.Body as NodeJS.ReadableStream,
    createWriteStream(destinationPath, { flags: "wx", mode: 0o600 })
  );
};

export const findLatestFrequentManifestKey = async ({
  bucketName,
  client,
}: {
  bucketName: string;
  client: S3Client;
}): Promise<string> => {
  let continuationToken: string | undefined;
  let latest: { key: string; uploadedAt: number } | undefined;
  for (let page = 0; page < MAX_LIST_PAGES; page += 1) {
    const result = await client.send(
      new ListObjectsV2Command({
        Bucket: bucketName,
        ...(continuationToken ? { ContinuationToken: continuationToken } : {}),
        Prefix: "postgres/production/manifests/frequent/",
      })
    );
    for (const object of result.Contents ?? []) {
      if (
        object.Key?.endsWith(".json") &&
        object.LastModified &&
        (!latest || object.LastModified.getTime() > latest.uploadedAt)
      ) {
        latest = {
          key: object.Key,
          uploadedAt: object.LastModified.getTime(),
        };
      }
    }
    if (!result.IsTruncated) {
      if (!latest) {
        throw new Error("No committed Production backup manifest was found.");
      }
      return latest.key;
    }
    if (!result.NextContinuationToken) {
      throw new Error("R2 returned a truncated page without a cursor.");
    }
    continuationToken = result.NextContinuationToken;
  }
  throw new Error("R2 manifest pagination exceeded the safety limit.");
};

export const headProductionBackupObject = async ({
  bucketName,
  client,
  key,
}: {
  bucketName: string;
  client: S3Client;
  key: string;
}): Promise<{ contentLength: number; metadataSha256?: string }> => {
  const head = await client.send(
    new HeadObjectCommand({ Bucket: bucketName, Key: key })
  );
  if (!Number.isSafeInteger(head.ContentLength)) {
    throw new Error("Production backup object length is unavailable.");
  }
  const sha256 = metadataValue(head.Metadata, "sha256");
  return {
    contentLength: head.ContentLength ?? -1,
    ...(sha256 ? { metadataSha256: sha256 } : {}),
  };
};
