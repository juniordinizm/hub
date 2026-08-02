import "server-only";
import { randomUUID } from "node:crypto";
import {
  CopyObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { CourseCoverImage } from "@/features/storage/course-cover";
import type { CourseCoverFile } from "@/features/storage/course-cover-upload";
import { buildPublicMediaUrl } from "@/features/storage/public-media";
import { resolveR2ClientEndpoint } from "@/features/storage/r2-endpoint";
import { createR2ObjectNamespace } from "@/features/storage/r2-object-namespace";
import {
  buildLessonResourceObjectKey,
  buildLessonResourcePreviewObjectKey,
  validateLessonAttachmentUpload,
  validateLessonImagePreviewUpload,
} from "@/features/storage/r2-objects";
import {
  assertStagedAdminImageOwnership,
  buildStagedAdminImageUpload,
  STAGED_ADMIN_IMAGE_PREFIX,
  type StagedAdminImagePurpose,
  type StagedAdminImageReference,
} from "@/features/storage/staged-image-upload";

const UPLOAD_URL_EXPIRES_SECONDS = 10 * 60;
const DOWNLOAD_URL_EXPIRES_SECONDS = 5 * 60;
const DELETE_OBJECTS_BATCH_SIZE = 1000;

interface R2Config {
  accessKeyId: string;
  accountId: string;
  bucketName: string;
  namespace: ReturnType<typeof createR2ObjectNamespace>;
  secretAccessKey: string;
}

interface PublicR2Config extends R2Config {
  publicBucketName: string;
}

interface R2LessonResource {
  contentType: string;
  fileName: string;
  id: string;
  key: string;
  label: string;
  preview?: {
    contentType: "image/webp";
    height: number;
    key: string;
    sizeBytes: number;
    width: number;
  };
  sizeBytes: number;
  storage: "r2";
}

const readRequiredEnv = (key: string): string => {
  const value = process.env[key]?.trim();

  if (!value) {
    throw new Error(`Configure ${key} para usar anexos R2.`);
  }

  return value;
};

const getR2Config = (): R2Config => ({
  accessKeyId: readRequiredEnv("R2_ACCESS_KEY_ID"),
  accountId: readRequiredEnv("R2_ACCOUNT_ID"),
  bucketName: readRequiredEnv("R2_BUCKET_NAME"),
  namespace: createR2ObjectNamespace(process.env.R2_OBJECT_PREFIX),
  secretAccessKey: readRequiredEnv("R2_SECRET_ACCESS_KEY"),
});

const getPublicR2Config = (): PublicR2Config => ({
  ...getR2Config(),
  publicBucketName: readRequiredEnv("R2_PUBLIC_BUCKET_NAME"),
});

const getR2Client = (config: R2Config): S3Client => {
  const endpoint = resolveR2ClientEndpoint({
    accountId: config.accountId,
    e2eTestMode: process.env.E2E_TEST_MODE === "true",
    ...(process.env.R2_ENDPOINT
      ? { endpointOverride: process.env.R2_ENDPOINT }
      : {}),
  });

  return new S3Client({
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    endpoint: endpoint.endpoint,
    forcePathStyle: endpoint.forcePathStyle,
    region: "auto",
  });
};

export const createLessonResourceUploadUrl = async ({
  contentType,
  fileName,
  lessonId,
  preview,
  sizeBytes,
}: {
  contentType: string;
  fileName: string;
  lessonId: string;
  preview?:
    | {
        contentType: "image/webp";
        height: number;
        sizeBytes: number;
        width: number;
      }
    | undefined;
  sizeBytes: number;
}): Promise<{
  resource: R2LessonResource;
  previewUploadUrl?: string;
  uploadUrl: string;
}> => {
  validateLessonAttachmentUpload({ contentType, fileName, sizeBytes });
  if (preview) {
    validateLessonImagePreviewUpload(preview);
  }

  const config = getR2Config();
  const nonce = randomUUID();
  const key = buildLessonResourceObjectKey({
    fileName,
    lessonId,
    nonce,
  });
  const previewKey = preview
    ? buildLessonResourcePreviewObjectKey({ lessonId, nonce })
    : null;
  const resource: R2LessonResource = {
    contentType,
    fileName,
    id: `resource-${randomUUID()}`,
    key,
    label: fileName,
    ...(preview && previewKey
      ? {
          preview: {
            contentType: preview.contentType,
            height: preview.height,
            key: previewKey,
            sizeBytes: preview.sizeBytes,
            width: preview.width,
          },
        }
      : {}),
    sizeBytes,
    storage: "r2",
  };
  const client = getR2Client(config);
  const uploadUrl = await getSignedUrl(
    client,
    new PutObjectCommand({
      Bucket: config.bucketName,
      ContentType: contentType,
      Key: config.namespace.toPhysicalKey(key),
    }),
    {
      expiresIn: UPLOAD_URL_EXPIRES_SECONDS,
      signableHeaders: new Set(["content-type"]),
    }
  );
  const previewUploadUrl =
    preview && previewKey
      ? await getSignedUrl(
          client,
          new PutObjectCommand({
            Bucket: config.bucketName,
            ContentType: preview.contentType,
            Key: config.namespace.toPhysicalKey(previewKey),
          }),
          {
            expiresIn: UPLOAD_URL_EXPIRES_SECONDS,
            signableHeaders: new Set(["content-type"]),
          }
        )
      : undefined;

  return {
    resource,
    ...(previewUploadUrl ? { previewUploadUrl } : {}),
    uploadUrl,
  };
};

export const createStagedAdminImageUploadUrl = async ({
  actorUserId,
  aggregateId,
  contentType,
  fileName,
  purpose,
  sizeBytes,
}: {
  actorUserId: string;
  aggregateId: string;
  contentType: string;
  fileName: string;
  purpose: StagedAdminImagePurpose;
  sizeBytes: number;
}): Promise<{
  reference: StagedAdminImageReference;
  uploadUrl: string;
}> => {
  const reference = buildStagedAdminImageUpload({
    actorUserId,
    aggregateId,
    contentType,
    fileName,
    nonce: randomUUID(),
    purpose,
    sizeBytes,
  });
  const config = getR2Config();
  const uploadUrl = await getSignedUrl(
    getR2Client(config),
    new PutObjectCommand({
      Bucket: config.bucketName,
      ContentType: reference.contentType,
      Key: config.namespace.toPhysicalKey(reference.key),
    }),
    {
      expiresIn: UPLOAD_URL_EXPIRES_SECONDS,
      signableHeaders: new Set(["content-type"]),
    }
  );

  return { reference, uploadUrl };
};

export const readStagedAdminImageFile = async ({
  actorUserId,
  aggregateId,
  purpose,
  reference,
}: {
  actorUserId: string;
  aggregateId: string;
  purpose: StagedAdminImagePurpose;
  reference: StagedAdminImageReference;
}): Promise<File> => {
  assertStagedAdminImageOwnership({
    actorUserId,
    aggregateId,
    purpose,
    reference,
  });

  await verifyStagedAdminImageObject(reference);

  const config = getR2Config();
  const client = getR2Client(config);
  const object = await client.send(
    new GetObjectCommand({
      Bucket: config.bucketName,
      Key: config.namespace.toPhysicalKey(reference.key),
    })
  );
  if (!object.Body) {
    throw new Error("O arquivo temporario nao esta disponivel.");
  }

  const body = Uint8Array.from(await object.Body.transformToByteArray());
  return new File([body.buffer], reference.fileName, {
    type: reference.contentType,
  });
};

export const verifyStagedAdminImageObject = async (
  reference: StagedAdminImageReference
): Promise<void> => {
  const config = getR2Config();
  const objectHead = await getR2Client(config).send(
    new HeadObjectCommand({
      Bucket: config.bucketName,
      Key: config.namespace.toPhysicalKey(reference.key),
    })
  );
  if (
    objectHead.ContentLength !== reference.sizeBytes ||
    objectHead.ContentType !== reference.contentType
  ) {
    throw new Error("O arquivo enviado nao corresponde ao upload preparado.");
  }
};

export const createLessonResourceDownloadUrl = async ({
  fileName,
  key,
}: {
  fileName: string;
  key: string;
}): Promise<string> => {
  const config = getR2Config();
  const client = getR2Client(config);

  await client.send(
    new HeadObjectCommand({
      Bucket: config.bucketName,
      Key: config.namespace.toPhysicalKey(key),
    })
  );

  return await getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: config.bucketName,
      Key: config.namespace.toPhysicalKey(key),
      ResponseContentDisposition: `attachment; filename="${fileName.replaceAll('"', "")}"`,
    }),
    { expiresIn: DOWNLOAD_URL_EXPIRES_SECONDS }
  );
};

export const uploadCourseCoverFile = async ({
  courseId,
  file,
}: {
  courseId: string;
  file: CourseCoverFile;
}): Promise<CourseCoverImage> => {
  const { createCourseCoverUploadParts } = await import(
    "@/features/storage/course-cover-upload"
  );
  const { coverImage, objects } = await createCourseCoverUploadParts({
    courseId,
    file,
    nonce: randomUUID(),
  });
  const config = getR2Config();
  const client = getR2Client(config);

  for (const object of objects) {
    await client.send(
      new PutObjectCommand({
        Body: object.body,
        Bucket: config.bucketName,
        ContentType: object.contentType,
        Key: config.namespace.toPhysicalKey(object.key),
      })
    );
  }

  return coverImage;
};

export const createR2ObjectReadUrl = async ({
  key,
}: {
  key: string;
}): Promise<string> => {
  const config = getR2Config();

  return await getSignedUrl(
    getR2Client(config),
    new GetObjectCommand({
      Bucket: config.bucketName,
      Key: config.namespace.toPhysicalKey(key),
    }),
    { expiresIn: DOWNLOAD_URL_EXPIRES_SECONDS }
  );
};

export const uploadPrivateR2Object = async ({
  body,
  contentType,
  key,
}: {
  body: Buffer;
  contentType: string;
  key: string;
}): Promise<void> => {
  const config = getR2Config();
  await getR2Client(config).send(
    new PutObjectCommand({
      Body: body,
      Bucket: config.bucketName,
      ContentType: contentType,
      Key: config.namespace.toPhysicalKey(key),
    })
  );
};

const isPreconditionFailed = (error: unknown): boolean => {
  if (!(error instanceof Object && "$metadata" in error)) {
    return false;
  }
  const metadata = error.$metadata;
  return (
    metadata instanceof Object &&
    "httpStatusCode" in metadata &&
    metadata.httpStatusCode === 412
  );
};

export const uploadPrivateR2ObjectIfAbsent = async ({
  body,
  contentType,
  key,
}: {
  body: Buffer;
  contentType: string;
  key: string;
}): Promise<"created" | "existing"> => {
  const config = getR2Config();
  try {
    await getR2Client(config).send(
      new PutObjectCommand({
        Body: body,
        Bucket: config.bucketName,
        ContentType: contentType,
        IfNoneMatch: "*",
        Key: config.namespace.toPhysicalKey(key),
      })
    );
    return "created";
  } catch (error) {
    if (isPreconditionFailed(error)) {
      return "existing";
    }
    throw error;
  }
};

export const getPublicMediaUrl = (key: string): string => {
  const config = getR2Config();
  return buildPublicMediaUrl({
    baseUrl: readRequiredEnv("R2_PUBLIC_BASE_URL"),
    key,
    physicalKey: config.namespace.toPhysicalKey(key),
  });
};

export const publishR2Object = async (key: string): Promise<void> => {
  const config = getPublicR2Config();
  const physicalKey = config.namespace.toPhysicalKey(key);

  await getR2Client(config).send(
    new CopyObjectCommand({
      Bucket: config.publicBucketName,
      CopySource: `/${config.bucketName}/${encodeURIComponent(physicalKey)}`,
      Key: physicalKey,
    })
  );
};

export const confirmLessonResourceUpload = async ({
  contentType,
  key,
  sizeBytes,
}: {
  contentType: string;
  key: string;
  sizeBytes: number;
}): Promise<void> => {
  const config = getR2Config();
  const object = await getR2Client(config).send(
    new HeadObjectCommand({
      Bucket: config.bucketName,
      Key: config.namespace.toPhysicalKey(key),
    })
  );

  if (
    object.ContentLength !== sizeBytes ||
    object.ContentType !== contentType
  ) {
    throw new Error("O arquivo enviado não corresponde ao material preparado.");
  }
};

const chunkKeys = (keys: string[]): string[][] => {
  const chunks: string[][] = [];

  for (let index = 0; index < keys.length; index += DELETE_OBJECTS_BATCH_SIZE) {
    chunks.push(keys.slice(index, index + DELETE_OBJECTS_BATCH_SIZE));
  }

  return chunks;
};

export const deleteR2Objects = async (keys: string[]): Promise<void> => {
  const uniqueKeys = Array.from(new Set(keys.filter(Boolean)));

  if (uniqueKeys.length === 0) {
    return;
  }

  const config = getR2Config();
  const client = getR2Client(config);

  for (const keyBatch of chunkKeys(uniqueKeys)) {
    const result = await client.send(
      new DeleteObjectsCommand({
        Bucket: config.bucketName,
        Delete: {
          Objects: keyBatch.map((key) => ({
            Key: config.namespace.toPhysicalKey(key),
          })),
          Quiet: true,
        },
      })
    );

    if (result.Errors?.length) {
      throw new Error("Nao foi possivel apagar arquivos do R2.");
    }
  }
};

export const deletePublicR2Objects = async (keys: string[]): Promise<void> => {
  const uniqueKeys = Array.from(new Set(keys.filter(Boolean)));

  if (uniqueKeys.length === 0) {
    return;
  }

  const config = getPublicR2Config();
  const client = getR2Client(config);

  for (const keyBatch of chunkKeys(uniqueKeys)) {
    await client.send(
      new DeleteObjectsCommand({
        Bucket: config.publicBucketName,
        Delete: {
          Objects: keyBatch.map((key) => ({
            Key: config.namespace.toPhysicalKey(key),
          })),
          Quiet: true,
        },
      })
    );
  }
};

export const deleteExpiredStagedAdminImages = async ({
  olderThan,
  shouldContinue = async () => true,
}: {
  olderThan: Date;
  shouldContinue?: () => Promise<boolean>;
}): Promise<number> => {
  const config = getR2Config();
  const client = getR2Client(config);
  let continuationToken: string | undefined;
  let removed = 0;

  do {
    if (!(await shouldContinue())) {
      break;
    }
    const page = await client.send(
      new ListObjectsV2Command({
        Bucket: config.bucketName,
        ContinuationToken: continuationToken,
        Prefix: config.namespace.toPhysicalPrefix(
          `${STAGED_ADMIN_IMAGE_PREFIX}/`
        ),
      })
    );
    const expiredKeys = (page.Contents ?? [])
      .filter(
        (object) =>
          object.Key &&
          object.LastModified &&
          object.LastModified.getTime() < olderThan.getTime()
      )
      .map((object) => config.namespace.toLogicalKey(object.Key as string));

    if (expiredKeys.length > 0) {
      if (!(await shouldContinue())) {
        break;
      }
      await deleteR2Objects(expiredKeys);
      removed += expiredKeys.length;
    }
    continuationToken = page.IsTruncated
      ? page.NextContinuationToken
      : undefined;
  } while (continuationToken);

  return removed;
};

export const uploadDashboardBannerFile = async ({
  file,
}: {
  file: File;
}): Promise<{ blurDataUrl: string; key: string }> => {
  const { createBannerBlurDataUrl, validateBannerImageFile } = await import(
    "@/features/storage/banner-upload"
  );
  await validateBannerImageFile(file);
  const config = getR2Config();
  const client = getR2Client(config);

  const [blurDataUrl, buffer] = await Promise.all([
    createBannerBlurDataUrl(file),
    file.arrayBuffer(),
  ]);
  const extension = file.name.split(".").pop()?.toLowerCase() || "webp";
  const key = `banners/${randomUUID()}.${extension}`;

  await client.send(
    new PutObjectCommand({
      Body: Buffer.from(buffer),
      Bucket: config.bucketName,
      ContentType: file.type,
      Key: config.namespace.toPhysicalKey(key),
    })
  );

  return { blurDataUrl, key };
};
