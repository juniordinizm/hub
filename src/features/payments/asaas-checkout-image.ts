import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import sharp from "sharp";

const CHECKOUT_ITEM_IMAGE_PATH = resolve(
  process.cwd(),
  "public/protear/logo-negativo.svg"
);

let cachedImageBase64: Promise<string> | undefined;

export const getAsaasCheckoutItemImageBase64 = async (): Promise<string> => {
  if (!cachedImageBase64) {
    cachedImageBase64 = readFile(CHECKOUT_ITEM_IMAGE_PATH)
      .then((image) => sharp(image).png().toBuffer())
      .then((image) => image.toString("base64"));
  }

  return await cachedImageBase64;
};
