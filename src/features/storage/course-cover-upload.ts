import sharp from "sharp";
import {
  buildCourseCoverObjectKey,
  COURSE_COVER_VARIANTS,
  type CourseCoverImage,
  type CourseCoverVariant,
  validateCourseCoverUploadRequest,
} from "@/features/storage/course-cover";

const VARIANT_QUALITY: Record<CourseCoverVariant, number> = {
  card: 82,
  thumb: 80,
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

export interface CourseCoverFile {
  contentType: string;
  file: File;
  fileName: string;
  sizeBytes: number;
}

export interface CourseCoverUploadObject {
  body: Buffer;
  contentType: string;
  key: string;
}

export const readCourseCoverFile = (value: unknown): CourseCoverFile | null => {
  if (!(value instanceof File)) {
    return null;
  }

  const fileName = typeof value.name === "string" ? value.name : "";
  const isEmptyFormFile =
    value.size === 0 &&
    (!fileName.trim() || value.type === "application/octet-stream");

  if (isEmptyFormFile) {
    return null;
  }

  const coverFile = {
    contentType: value.type,
    file: value,
    fileName,
    sizeBytes: value.size,
  };

  validateCourseCoverUploadRequest({
    courseId: "pending-course",
    original: coverFile,
    variants: [
      {
        contentType: "image/webp",
        sizeBytes: 1,
        variant: "thumb",
      },
      {
        contentType: "image/webp",
        sizeBytes: 1,
        variant: "card",
      },
    ],
  });

  return coverFile;
};

export const createCourseCoverUploadParts = async ({
  courseId,
  file,
  nonce,
}: {
  courseId: string;
  file: CourseCoverFile | null;
  nonce: string;
}): Promise<{
  coverImage: CourseCoverImage;
  objects: CourseCoverUploadObject[];
}> => {
  if (!file) {
    throw new Error("Capa invalida.");
  }

  const originalBuffer = Buffer.from(await file.file.arrayBuffer());
  const blurDataUrl = `data:image/webp;base64,${(
    await sharp(originalBuffer)
      .rotate()
      .resize({ width: 10 })
      .webp({ quality: 20 })
      .toBuffer()
  ).toString("base64")}`;
  const originalKey = buildCourseCoverObjectKey({
    courseId,
    extension: getExtensionForContentType(file.contentType),
    nonce,
    variant: "original",
  });
  const coverImage: CourseCoverImage = {
    blurDataUrl,
    original: {
      contentType: file.contentType,
      fileName: file.fileName,
      key: originalKey,
      sizeBytes: file.sizeBytes,
    },
    variants: {},
  };
  const objects: CourseCoverUploadObject[] = [
    {
      body: originalBuffer,
      contentType: file.contentType,
      key: originalKey,
    },
  ];

  for (const variant of Object.keys(
    COURSE_COVER_VARIANTS
  ) as CourseCoverVariant[]) {
    const dimensions = COURSE_COVER_VARIANTS[variant];
    const body = await sharp(originalBuffer)
      .rotate()
      .resize(dimensions.width, dimensions.height, {
        fit: "cover",
        position: "centre",
      })
      .webp({ quality: VARIANT_QUALITY[variant] })
      .toBuffer();
    const key = buildCourseCoverObjectKey({
      courseId,
      extension: "webp",
      nonce,
      variant,
    });

    coverImage.variants[variant] = {
      contentType: "image/webp",
      height: dimensions.height,
      key,
      sizeBytes: body.length,
      width: dimensions.width,
    };
    objects.push({
      body,
      contentType: "image/webp",
      key,
    });
  }

  const variants = (
    Object.keys(COURSE_COVER_VARIANTS) as CourseCoverVariant[]
  ).map((variant) => {
    const image = coverImage.variants[variant];

    if (!image) {
      throw new Error("Variante da capa indisponivel.");
    }

    return {
      contentType: image.contentType,
      sizeBytes: image.sizeBytes,
      variant,
    };
  });

  validateCourseCoverUploadRequest({
    courseId,
    original: {
      contentType: file.contentType,
      fileName: file.fileName,
      sizeBytes: file.sizeBytes,
    },
    variants,
  });

  return { coverImage, objects };
};
