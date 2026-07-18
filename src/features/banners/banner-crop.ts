import {
  BANNER_IMAGE_HEIGHT,
  BANNER_IMAGE_WIDTH,
} from "@/features/storage/banner-image";

const FILE_EXTENSION_PATTERN = /\.[^.]+$/;

export interface BannerCropArea {
  height: number;
  width: number;
  x: number;
  y: number;
}

const loadImage = (sourceUrl: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("error", () =>
      reject(new Error("Nao foi possivel abrir a imagem."))
    );
    image.addEventListener("load", () => resolve(image));
    image.src = sourceUrl;
  });

export const getBannerCropOutputName = (originalName: string): string => {
  const baseName =
    originalName.trim().replace(FILE_EXTENSION_PATTERN, "") || "banner";

  return `${baseName}-banner.webp`;
};

export const createBannerCropFile = async ({
  crop,
  originalName,
  sourceUrl,
}: {
  crop: BannerCropArea;
  originalName: string;
  sourceUrl: string;
}): Promise<File> => {
  const image = await loadImage(sourceUrl);
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Nao foi possivel preparar o recorte do banner.");
  }

  canvas.width = BANNER_IMAGE_WIDTH;
  canvas.height = BANNER_IMAGE_HEIGHT;
  context.drawImage(
    image,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    BANNER_IMAGE_WIDTH,
    BANNER_IMAGE_HEIGHT
  );

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (result) {
          resolve(result);
          return;
        }

        reject(new Error("Nao foi possivel gerar o banner em WebP."));
      },
      "image/webp",
      0.92
    );
  });

  return new File([blob], getBannerCropOutputName(originalName), {
    type: "image/webp",
  });
};
