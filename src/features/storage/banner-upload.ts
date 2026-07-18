export const MAX_BANNER_BYTES = 5 * 1024 * 1024; // 5MB

export const BANNER_IMAGE_PREVIEW = {
  aspectRatio: "21:9",
  maxSizeBytes: MAX_BANNER_BYTES,
} as const;

export const BANNER_ACCEPT = ".jpeg,.jpg,.png,.webp";

const ALLOWED_BANNER_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export const validateBannerUploadRequest = ({
  contentType,
  sizeBytes,
}: {
  contentType: string;
  sizeBytes: number;
}): void => {
  if (!ALLOWED_BANNER_CONTENT_TYPES.has(contentType)) {
    throw new Error("Formato de imagem nao suportado para banners.");
  }

  if (!(Number.isInteger(sizeBytes) && sizeBytes > 0)) {
    throw new Error("Tamanho de arquivo invalido.");
  }

  if (sizeBytes > MAX_BANNER_BYTES) {
    throw new Error("A imagem do banner excede o limite de 5MB.");
  }
};
