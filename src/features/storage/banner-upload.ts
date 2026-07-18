import sharp from "sharp";
import {
  BANNER_IMAGE_HEIGHT,
  BANNER_IMAGE_WIDTH,
  validateBannerUploadRequest,
} from "./banner-image";

export const validateBannerImageFile = async (file: File): Promise<void> => {
  validateBannerUploadRequest({
    contentType: file.type,
    sizeBytes: file.size,
  });

  let metadata: sharp.Metadata;

  try {
    metadata = await sharp(Buffer.from(await file.arrayBuffer())).metadata();
  } catch {
    throw new Error("Nao foi possivel ler a imagem do banner.");
  }

  if (
    metadata.width !== BANNER_IMAGE_WIDTH ||
    metadata.height !== BANNER_IMAGE_HEIGHT
  ) {
    throw new Error(
      `O banner deve ter ${BANNER_IMAGE_WIDTH} × ${BANNER_IMAGE_HEIGHT} px.`
    );
  }
};
