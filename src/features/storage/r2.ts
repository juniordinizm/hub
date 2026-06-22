import "server-only";
import { randomUUID } from "node:crypto";
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  buildCourseCoverObjectKey,
  COURSE_COVER_VARIANTS,
  type CourseCoverImage,
  type CourseCoverVariant,
  validateCourseCoverUploadRequest,
} from "@/features/storage/course-cover";
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

type CourseCoverUploadVariantInput = Array<{
  contentType: string;
  sizeBytes: number;
  variant: CourseCoverVariant;
}>;

interface CourseCoverUploadUrl {
  contentType: string;
  key: string;
  uploadUrl: string;
  variant: CourseCoverVariant | "original";
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

const getExtensionForContentType = (contentType: string): string => {
  if (contentType === "image/png") {
    return "png";
  }

  if (contentType === "image/jpeg") {
    return "jpg";
  }

  return "webp";
};

const createPutSignedUrl = async ({
  bucketName,
  client,
  contentType,
  key,
}: {
  bucketName: string;
  client: S3Client;
  contentType: string;
  key: string;
}): Promise<string> =>
  await getSignedUrl(
    client,
    new PutObjectCommand({
      Bucket: bucketName,
      ContentType: contentType,
      Key: key,
    }),
    {
      expiresIn: UPLOAD_URL_EXPIRES_SECONDS,
      signableHeaders: new Set(["content-type"]),
    }
  );

export const createCourseCoverUploadUrls = async ({
  courseId,
  original,
  variants,
}: {
  courseId: string;
  original: {
    contentType: string;
    fileName: string;
    sizeBytes: number;
  };
  variants: CourseCoverUploadVariantInput;
}): Promise<{
  coverImage: CourseCoverImage;
  uploads: CourseCoverUploadUrl[];
}> => {
  validateCourseCoverUploadRequest({ courseId, original, variants });

  const config = getR2Config();
  const client = getR2Client(config);
  const nonce = randomUUID();
  const originalKey = buildCourseCoverObjectKey({
    courseId,
    extension: getExtensionForContentType(original.contentType),
    nonce,
    variant: "original",
  });
  const uploads: CourseCoverUploadUrl[] = [
    {
      contentType: original.contentType,
      key: originalKey,
      uploadUrl: await createPutSignedUrl({
        bucketName: config.bucketName,
        client,
        contentType: original.contentType,
        key: originalKey,
      }),
      variant: "original",
    },
  ];
  const coverImage: CourseCoverImage = {
    original: {
      contentType: original.contentType,
      fileName: original.fileName,
      key: originalKey,
      sizeBytes: original.sizeBytes,
    },
    variants: {},
  };

  for (const variantInput of variants) {
    const dimensions = COURSE_COVER_VARIANTS[variantInput.variant];
    const key = buildCourseCoverObjectKey({
      courseId,
      extension: getExtensionForContentType(variantInput.contentType),
      nonce,
      variant: variantInput.variant,
    });

    uploads.push({
      contentType: variantInput.contentType,
      key,
      uploadUrl: await createPutSignedUrl({
        bucketName: config.bucketName,
        client,
        contentType: variantInput.contentType,
        key,
      }),
      variant: variantInput.variant,
    });
    coverImage.variants[variantInput.variant] = {
      contentType: variantInput.contentType,
      height: dimensions.height,
      key,
      sizeBytes: variantInput.sizeBytes,
      width: dimensions.width,
    };
  }

  return { coverImage, uploads };
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
