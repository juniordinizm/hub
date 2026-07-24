import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { CertificateTemplateValidationError } from "./template-errors";
import { normalizeCertificateBackground } from "./template-image";
import {
  CERTIFICATE_BACKGROUND_HEIGHT,
  CERTIFICATE_BACKGROUND_WIDTH,
} from "./template-image-contract";

const createImageFile = async ({
  height,
  type = "image/png",
  width,
}: {
  height: number;
  type?: string;
  width: number;
}): Promise<File> => {
  const buffer = await sharp({
    create: { background: "#d8b98a", channels: 3, height, width },
  })
    .png()
    .toBuffer();

  return new File([new Uint8Array(buffer)], "arte.png", { type });
};

describe("normalizeCertificateBackground", () => {
  it("normalizes an A4 landscape image to the canonical WebP artifact", async () => {
    const image = await normalizeCertificateBackground(
      await createImageFile({
        height: CERTIFICATE_BACKGROUND_HEIGHT,
        width: CERTIFICATE_BACKGROUND_WIDTH,
      })
    );
    const metadata = await sharp(image.body).metadata();

    expect(image.contentType).toBe("image/webp");
    expect(metadata.height).toBe(CERTIFICATE_BACKGROUND_HEIGHT);
    expect(metadata.width).toBe(CERTIFICATE_BACKGROUND_WIDTH);
  });

  it("rejects a payload that only claims to be an image", async () => {
    const invalid = new File(["not an image"], "arte.png", {
      type: "image/png",
    });

    await expect(normalizeCertificateBackground(invalid)).rejects.toThrow(
      "Nao foi possivel ler a imagem do certificado."
    );
    await expect(
      normalizeCertificateBackground(invalid)
    ).rejects.toBeInstanceOf(CertificateTemplateValidationError);
  });

  it("crops a non-A4 image into the canonical A4 landscape dimensions", async () => {
    const image = await normalizeCertificateBackground(
      await createImageFile({ height: 1200, width: 1200 })
    );
    const metadata = await sharp(image.body).metadata();

    expect(metadata.height).toBe(CERTIFICATE_BACKGROUND_HEIGHT);
    expect(metadata.width).toBe(CERTIFICATE_BACKGROUND_WIDTH);
  });
});
