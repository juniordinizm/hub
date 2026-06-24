import sharp from "sharp";
import { describe, expect, it } from "vitest";
import {
  createCourseCoverUploadParts,
  readCourseCoverFile,
} from "./course-cover-upload";

const createImageFile = async ({
  contentType = "image/png",
  fileName = "cover.png",
  height = 720,
  width = 1280,
}: {
  contentType?: string;
  fileName?: string;
  height?: number;
  width?: number;
} = {}): Promise<File> => {
  const buffer = await sharp({
    create: {
      background: "#326c71",
      channels: 3,
      height,
      width,
    },
  })
    .png()
    .toBuffer();

  return new File([new Uint8Array(buffer)], fileName, { type: contentType });
};

describe("course cover upload", () => {
  it("treats an empty form file as no replacement", () => {
    const file = new File([], "", { type: "application/octet-stream" });

    expect(readCourseCoverFile(file)).toBeNull();
  });

  it("treats a phantom multipart file as no replacement", () => {
    const file = new File([], "undefined", {
      type: "application/octet-stream",
    });

    expect(readCourseCoverFile(file)).toBeNull();
  });

  it("rejects invalid cover files before processing", async () => {
    const invalidType = new File(["<svg />"], "cover.png", {
      type: "image/svg+xml",
    });

    expect(() => readCourseCoverFile(invalidType)).toThrow(
      "Tipo de imagem nao permitido."
    );

    const oversized = new File([new Uint8Array(5 * 1024 * 1024 + 1)], "x.png", {
      type: "image/png",
    });

    expect(() => readCourseCoverFile(oversized)).toThrow(
      "Imagem original maior que 5 MB."
    );

    const invalidExtension = await createImageFile({
      fileName: "cover.gif",
    });

    expect(() => readCourseCoverFile(invalidExtension)).toThrow(
      "Extensao de imagem nao permitida."
    );
  });

  it("creates original and responsive variants for a valid cover", async () => {
    const file = await createImageFile();
    const coverFile = readCourseCoverFile(file);

    expect(coverFile).not.toBeNull();

    const parts = await createCourseCoverUploadParts({
      courseId: "course-1",
      file: coverFile,
      nonce: "upload-1",
    });

    expect(parts.coverImage.original).toMatchObject({
      contentType: "image/png",
      fileName: "cover.png",
      key: "courses/course-1/cover/upload-1-original.png",
      sizeBytes: file.size,
    });
    expect(parts.coverImage.variants.card).toMatchObject({
      contentType: "image/webp",
      height: 540,
      key: "courses/course-1/cover/upload-1-card.webp",
      width: 960,
    });
    expect(parts.coverImage.variants.thumb).toMatchObject({
      contentType: "image/webp",
      height: 270,
      key: "courses/course-1/cover/upload-1-thumb.webp",
      width: 480,
    });
    expect(parts.objects).toHaveLength(3);
    expect(parts.objects.every((object) => object.body.length > 0)).toBe(true);
  });
});
