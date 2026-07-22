import {
  CERTIFICATE_BACKGROUND_HEIGHT,
  CERTIFICATE_BACKGROUND_WIDTH,
} from "./template-image-contract";

const FILE_EXTENSION_PATTERN = /\.[^.]+$/;

export interface CertificateCropArea {
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

export const createCertificateCropFile = async ({
  crop,
  originalName,
  sourceUrl,
}: {
  crop: CertificateCropArea;
  originalName: string;
  sourceUrl: string;
}): Promise<File> => {
  const image = await loadImage(sourceUrl);
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Nao foi possivel preparar o recorte.");
  }

  canvas.height = CERTIFICATE_BACKGROUND_HEIGHT;
  canvas.width = CERTIFICATE_BACKGROUND_WIDTH;
  context.drawImage(
    image,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    CERTIFICATE_BACKGROUND_WIDTH,
    CERTIFICATE_BACKGROUND_HEIGHT
  );

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (result) {
          resolve(result);
          return;
        }
        reject(new Error("Nao foi possivel gerar a arte em WebP."));
      },
      "image/webp",
      0.92
    );
  });
  const baseName =
    originalName.trim().replace(FILE_EXTENSION_PATTERN, "") || "certificado";

  return new File([blob], `${baseName}-certificado.webp`, {
    type: "image/webp",
  });
};
