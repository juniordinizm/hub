import { sanitizeR2FileName } from "@/features/storage/r2-objects";

export const COURSE_COVER_VARIANTS = {
  thumb: { height: 270, maxSizeBytes: 350 * 1024, width: 480 },
  card: { height: 540, maxSizeBytes: 950 * 1024, width: 960 },
  hero: { height: 900, maxSizeBytes: 2200 * 1024, width: 1600 },
} as const;

export type CourseCoverVariant = keyof typeof COURSE_COVER_VARIANTS;

export const COURSE_COVER_ACCEPT = ".jpg,.jpeg,.png,.webp";

const MAX_ORIGINAL_COVER_BYTES = 12 * 1024 * 1024;
const ALLOWED_ORIGINAL_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const ALLOWED_VARIANT_TYPES = new Set(["image/webp", "image/jpeg"]);

export interface CourseCoverOriginal {
  contentType: string;
  fileName: string;
  key: string;
  sizeBytes: number;
}

export interface CourseCoverVariantImage {
  contentType: string;
  height: number;
  key: string;
  sizeBytes: number;
  width: number;
}

export interface CourseCoverImage {
  original: CourseCoverOriginal;
  variants: Partial<Record<CourseCoverVariant, CourseCoverVariantImage>>;
}

interface CourseCoverUploadRequest {
  courseId: string;
  original: {
    contentType: string;
    fileName: string;
    sizeBytes: number;
  };
  variants: Array<{
    contentType: string;
    sizeBytes: number;
    variant: string;
  }>;
}

const requiredVariants = Object.keys(
  COURSE_COVER_VARIANTS
) as CourseCoverVariant[];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const isPositiveInteger = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value > 0;

export const isCourseCoverVariant = (
  value: string
): value is CourseCoverVariant => value in COURSE_COVER_VARIANTS;

export const buildCourseCoverObjectKey = ({
  courseId,
  extension,
  nonce,
  variant,
}: {
  courseId: string;
  extension: string;
  nonce: string;
  variant: CourseCoverVariant | "original";
}): string =>
  `courses/${courseId}/cover/${nonce}-${variant}.${sanitizeR2FileName(extension).replaceAll(".", "")}`;

const validateOriginalCover = (
  original: CourseCoverUploadRequest["original"]
): void => {
  if (!original.fileName.trim()) {
    throw new Error("Informe o nome da imagem.");
  }

  if (!ALLOWED_ORIGINAL_TYPES.has(original.contentType)) {
    throw new Error("Tipo de imagem nao permitido.");
  }

  if (!(Number.isInteger(original.sizeBytes) && original.sizeBytes > 0)) {
    throw new Error("Tamanho da imagem invalido.");
  }

  if (original.sizeBytes > MAX_ORIGINAL_COVER_BYTES) {
    throw new Error("Imagem original maior que 12 MB.");
  }
};

export const validateCourseCoverUploadRequest = ({
  courseId,
  original,
  variants,
}: CourseCoverUploadRequest): void => {
  if (!courseId.trim()) {
    throw new Error("Curso invalido.");
  }

  validateOriginalCover(original);

  const variantNames = new Set(variants.map(({ variant }) => variant));

  if (!requiredVariants.every((variant) => variantNames.has(variant))) {
    throw new Error("Envie as variantes thumb, card e hero da capa.");
  }

  for (const candidate of variants) {
    if (!isCourseCoverVariant(candidate.variant)) {
      throw new Error("Variante de capa invalida.");
    }

    if (!ALLOWED_VARIANT_TYPES.has(candidate.contentType)) {
      throw new Error("Tipo de variante de capa invalido.");
    }

    if (!(Number.isInteger(candidate.sizeBytes) && candidate.sizeBytes > 0)) {
      throw new Error("Tamanho da variante invalido.");
    }

    if (
      candidate.sizeBytes >
      COURSE_COVER_VARIANTS[candidate.variant].maxSizeBytes
    ) {
      throw new Error("Variante da capa maior que o permitido.");
    }
  }
};

const parseOriginal = (value: unknown): CourseCoverOriginal | null => {
  if (!isRecord(value)) {
    return null;
  }

  if (
    !(
      typeof value.contentType === "string" &&
      typeof value.fileName === "string" &&
      typeof value.key === "string" &&
      isPositiveInteger(value.sizeBytes)
    )
  ) {
    return null;
  }

  return {
    contentType: value.contentType,
    fileName: value.fileName,
    key: value.key,
    sizeBytes: value.sizeBytes,
  };
};

const parseVariantImage = (value: unknown): CourseCoverVariantImage | null => {
  if (!isRecord(value)) {
    return null;
  }

  if (
    !(
      typeof value.contentType === "string" &&
      typeof value.key === "string" &&
      isPositiveInteger(value.height) &&
      isPositiveInteger(value.sizeBytes) &&
      isPositiveInteger(value.width)
    )
  ) {
    return null;
  }

  return {
    contentType: value.contentType,
    height: value.height,
    key: value.key,
    sizeBytes: value.sizeBytes,
    width: value.width,
  };
};

export const parseCourseCoverImage = (
  value: unknown
): CourseCoverImage | null => {
  if (!isRecord(value)) {
    return null;
  }

  const original = parseOriginal(value.original);

  if (!(original && isRecord(value.variants))) {
    return null;
  }

  const variants: CourseCoverImage["variants"] = {};

  for (const variant of requiredVariants) {
    const image = parseVariantImage(value.variants[variant]);

    if (image) {
      variants[variant] = image;
    }
  }

  return { original, variants };
};
