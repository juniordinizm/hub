export const MAX_BANNER_BYTES = 5 * 1024 * 1024;

export const BANNER_IMAGE_WIDTH = 1680;
export const BANNER_IMAGE_HEIGHT = 420;
export const BANNER_IMAGE_ASPECT_RATIO =
  BANNER_IMAGE_WIDTH / BANNER_IMAGE_HEIGHT;

export const BANNER_IMAGE_PREVIEW = {
  aspectRatio: "4:1",
  height: BANNER_IMAGE_HEIGHT,
  maxSizeBytes: MAX_BANNER_BYTES,
  width: BANNER_IMAGE_WIDTH,
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
