import {
  COURSE_COVER_CARD_HEIGHT,
  COURSE_COVER_CARD_WIDTH,
} from "@/features/storage/course-cover";

const FILE_EXTENSION_PATTERN = /\.[^.]+$/;

export interface CourseCoverCropArea {
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

export const getCourseCoverCropOutputName = (originalName: string): string => {
  const baseName =
    originalName.trim().replace(FILE_EXTENSION_PATTERN, "") || "capa";

  return `${baseName}-capa.webp`;
};

export const createCourseCoverCropFile = async ({
  crop,
  originalName,
  sourceUrl,
}: {
  crop: CourseCoverCropArea;
  originalName: string;
  sourceUrl: string;
}): Promise<File> => {
  const image = await loadImage(sourceUrl);
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Nao foi possivel preparar o recorte da capa.");
  }

  canvas.width = COURSE_COVER_CARD_WIDTH;
  canvas.height = COURSE_COVER_CARD_HEIGHT;
  context.drawImage(
    image,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    COURSE_COVER_CARD_WIDTH,
    COURSE_COVER_CARD_HEIGHT
  );

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (result) {
          resolve(result);
          return;
        }

        reject(new Error("Nao foi possivel gerar a capa em WebP."));
      },
      "image/webp",
      0.92
    );
  });

  return new File([blob], getCourseCoverCropOutputName(originalName), {
    type: "image/webp",
  });
};
