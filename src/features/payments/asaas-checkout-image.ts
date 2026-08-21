import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const CHECKOUT_ITEM_IMAGE_PATH = resolve(
  process.cwd(),
  "public/protear/logo-negativo.svg"
);

let cachedImageBase64: string | undefined;

export const getAsaasCheckoutItemImageBase64 = (): string => {
  if (cachedImageBase64) {
    return cachedImageBase64;
  }

  cachedImageBase64 = readFileSync(CHECKOUT_ITEM_IMAGE_PATH).toString("base64");
  return cachedImageBase64;
};
