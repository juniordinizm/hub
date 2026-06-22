import "server-only";
import { randomUUID } from "node:crypto";
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  buildLessonResourceObjectKey,
  validateLessonAttachmentUpload,
} from "@/features/storage/r2-objects";

const UPLOAD_URL_EXPIRES_SECONDS = 10 * 60;
const DOWNLOAD_URL_EXPIRES_SECONDS = 5 * 60;

interface R2Config {
  accessKeyId: string;
  accountId: string;
  bucketName: string;
  secretAccessKey: string;
}

interface R2LessonResource {
  contentType: string;
  fileName: string;
  id: string;
  key: string;
  label: string;
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
  sizeBytes,
}: {
  contentType: string;
  fileName: string;
  lessonId: string;
  sizeBytes: number;
}): Promise<{
  resource: R2LessonResource;
  uploadUrl: string;
}> => {
  validateLessonAttachmentUpload({ contentType, fileName, sizeBytes });

  const config = getR2Config();
  const key = buildLessonResourceObjectKey({
    fileName,
    lessonId,
    nonce: randomUUID(),
  });
  const resource: R2LessonResource = {
    contentType,
    fileName,
    id: `resource-${randomUUID()}`,
    key,
    label: fileName,
    sizeBytes,
    storage: "r2",
  };
  const uploadUrl = await getSignedUrl(
    getR2Client(config),
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

  return { resource, uploadUrl };
};

export const createLessonResourceDownloadUrl = async ({
  fileName,
  key,
}: {
  fileName: string;
  key: string;
}): Promise<string> => {
  const config = getR2Config();

  return await getSignedUrl(
    getR2Client(config),
    new GetObjectCommand({
      Bucket: config.bucketName,
      Key: key,
      ResponseContentDisposition: `attachment; filename="${fileName.replaceAll('"', "")}"`,
    }),
    { expiresIn: DOWNLOAD_URL_EXPIRES_SECONDS }
  );
};
