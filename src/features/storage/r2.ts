import "server-only";
import { randomUUID } from "node:crypto";
import {
  CopyObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { validateBannerUploadRequest } from "@/features/storage/banner-image";
import {
  createBannerBlurDataUrl,
  validateBannerImageFile,
} from "@/features/storage/banner-upload";
import type { CourseCoverImage } from "@/features/storage/course-cover";
import {
  type CourseCoverFile,
  createCourseCoverUploadParts,
} from "@/features/storage/course-cover-upload";
import { buildPublicMediaUrl } from "@/features/storage/public-media";
import {
  buildLessonResourceObjectKey,
  buildLessonResourcePreviewObjectKey,
  validateLessonAttachmentUpload,
  validateLessonImagePreviewUpload,
} from "@/features/storage/r2-objects";

const UPLOAD_URL_EXPIRES_SECONDS = 10 * 60;
const DOWNLOAD_URL_EXPIRES_SECONDS = 5 * 60;
const DELETE_OBJECTS_BATCH_SIZE = 1000;

interface R2Config {
  accessKeyId: string;
  accountId: string;
  bucketName: string;
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
  secretAccessKey: readRequiredEnv("R2_SECRET_ACCESS_KEY"),
});

const getPublicR2Config = (): PublicR2Config => ({
  ...getR2Config(),
  publicBucketName: readRequiredEnv("R2_PUBLIC_BUCKET_NAME"),
});

const getR2Client = (config: R2Config): S3Client =>
  new S3Client({
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    region: "auto",
  });

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
      Key: key,
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
            Key: previewKey,
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

const buildBannerObjectKey = ({
  nonce,
  extension,
}: {
  nonce: string;
  extension: string;
}): string => `dashboard/banners/${nonce}.${extension}`;

export const createBannerUploadUrl = async ({
  contentType,
  sizeBytes,
  extension,
}: {
  contentType: string;
  sizeBytes: number;
  extension: string;
}): Promise<{ uploadUrl: string; key: string }> => {
  validateBannerUploadRequest({ contentType, sizeBytes });

  const config = getR2Config();
  const nonce = randomUUID();
  const key = buildBannerObjectKey({ nonce, extension });

  const client = getR2Client(config);
  const uploadUrl = await getSignedUrl(
    client,
    new PutObjectCommand({
      Bucket: config.bucketName,
      ContentType: contentType,
      Key: key,
    }),
    {
      expiresIn: UPLOAD_URL_EXPIRES_SECONDS,
      signableHeaders: new Set(["content-type"]),
    }
  );

  return { uploadUrl, key };
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
    new HeadObjectCommand({ Bucket: config.bucketName, Key: key })
  );

  return await getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: config.bucketName,
      Key: key,
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
        Key: object.key,
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
      Key: key,
    }),
    { expiresIn: DOWNLOAD_URL_EXPIRES_SECONDS }
  );
};

export const getPublicMediaUrl = (key: string): string =>
  buildPublicMediaUrl({
    baseUrl: readRequiredEnv("R2_PUBLIC_BASE_URL"),
    key,
  });

export const publishR2Object = async (key: string): Promise<void> => {
  const config = getPublicR2Config();

  await getR2Client(config).send(
    new CopyObjectCommand({
      Bucket: config.publicBucketName,
      CopySource: `/${config.bucketName}/${encodeURIComponent(key)}`,
      Key: key,
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
    new HeadObjectCommand({ Bucket: config.bucketName, Key: key })
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
          Objects: keyBatch.map((key) => ({ Key: key })),
          Quiet: true,
        },
      })
    );

    if (result.Errors?.length) {
      const failedKeys = result.Errors.map((error) => error.Key)
        .filter(Boolean)
        .join(", ");
      throw new Error(
        failedKeys
          ? `Nao foi possivel apagar arquivos do R2: ${failedKeys}`
          : "Nao foi possivel apagar arquivos do R2."
      );
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
          Objects: keyBatch.map((key) => ({ Key: key })),
          Quiet: true,
        },
      })
    );
  }
};

export const uploadDashboardBannerFile = async ({
  file,
}: {
  file: File;
}): Promise<{ blurDataUrl: string; key: string }> => {
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
      Key: key,
    })
  );

  return { blurDataUrl, key };
};
