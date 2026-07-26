export const MAX_CERTIFICATE_BACKGROUND_BYTES = 10 * 1024 * 1024;
export const MAX_CERTIFICATE_SIGNATURE_BYTES = 2 * 1024 * 1024;
export const CERTIFICATE_BACKGROUND_WIDTH = 2376;
export const CERTIFICATE_BACKGROUND_HEIGHT = 1680;
export const CERTIFICATE_BACKGROUND_ASPECT_RATIO =
  CERTIFICATE_BACKGROUND_WIDTH / CERTIFICATE_BACKGROUND_HEIGHT;
export const CERTIFICATE_IMAGE_ACCEPT = ".jpeg,.jpg,.png,.webp";

const CERTIFICATE_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export type CertificateImageKind = "background" | "signature";

export const validateCertificateImageFile = (
  file: Pick<File, "size" | "type">,
  kind: CertificateImageKind
): void => {
  if (!CERTIFICATE_IMAGE_MIME_TYPES.has(file.type)) {
    throw new Error("Envie uma imagem JPG, PNG ou WebP.");
  }

  const maxBytes =
    kind === "background"
      ? MAX_CERTIFICATE_BACKGROUND_BYTES
      : MAX_CERTIFICATE_SIGNATURE_BYTES;
  if (file.size > maxBytes) {
    const maxMegabytes = maxBytes / (1024 * 1024);
    throw new Error(`A imagem deve ter no maximo ${maxMegabytes} MB.`);
  }
};
