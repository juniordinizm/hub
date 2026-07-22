import sharp from "sharp";
import {
  CERTIFICATE_BACKGROUND_HEIGHT,
  CERTIFICATE_BACKGROUND_WIDTH,
  MAX_CERTIFICATE_BACKGROUND_BYTES,
  MAX_CERTIFICATE_SIGNATURE_BYTES,
} from "./template-image-contract";

const ALLOWED_IMAGE_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export interface NormalizedCertificateImage {
  body: Buffer;
  contentType: "image/webp";
}

const validateImageUploadRequest = ({
  contentType,
  maxBytes,
  sizeBytes,
}: {
  contentType: string;
  maxBytes: number;
  sizeBytes: number;
}): void => {
  if (!ALLOWED_IMAGE_CONTENT_TYPES.has(contentType)) {
    throw new Error("Envie uma imagem PNG, JPEG ou WebP.");
  }

  if (!(Number.isInteger(sizeBytes) && sizeBytes > 0)) {
    throw new Error("O arquivo de imagem esta vazio ou e invalido.");
  }

  if (sizeBytes > maxBytes) {
    throw new Error("A imagem excede o limite de tamanho permitido.");
  }
};

const readImage = async (file: File, maxBytes: number): Promise<Buffer> => {
  validateImageUploadRequest({
    contentType: file.type,
    maxBytes,
    sizeBytes: file.size,
  });

  const body = Buffer.from(await file.arrayBuffer());

  try {
    await sharp(body).metadata();
  } catch {
    throw new Error("Nao foi possivel ler a imagem do certificado.");
  }

  return body;
};

export const normalizeCertificateBackground = async (
  file: File
): Promise<NormalizedCertificateImage> => {
  const body = await readImage(file, MAX_CERTIFICATE_BACKGROUND_BYTES);

  return {
    body: await sharp(body)
      .rotate()
      .resize(CERTIFICATE_BACKGROUND_WIDTH, CERTIFICATE_BACKGROUND_HEIGHT, {
        fit: "cover",
        position: "centre",
      })
      .webp({ quality: 92 })
      .toBuffer(),
    contentType: "image/webp",
  };
};

export const normalizeCertificateSignature = async (
  file: File
): Promise<NormalizedCertificateImage> => {
  const body = await readImage(file, MAX_CERTIFICATE_SIGNATURE_BYTES);

  return {
    body: await sharp(body)
      .rotate()
      .resize({
        fit: "inside",
        height: 600,
        width: 1600,
        withoutEnlargement: true,
      })
      .webp({ quality: 92 })
      .toBuffer(),
    contentType: "image/webp",
  };
};
