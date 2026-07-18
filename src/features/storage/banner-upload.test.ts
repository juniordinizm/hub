import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { validateBannerImageFile } from "./banner-upload";

const createBannerFile = async ({
  height,
  width,
}: {
  height: number;
  width: number;
}): Promise<File> => {
  const buffer = await sharp({
    create: {
      background: "#2563eb",
      channels: 3,
      height,
      width,
    },
  })
    .webp()
    .toBuffer();

  return new File([new Uint8Array(buffer)], "banner.webp", {
    type: "image/webp",
  });
};

describe("banner upload", () => {
  it("accepts a canonical 1680 by 420 WebP banner", async () => {
    await expect(
      validateBannerImageFile(
        await createBannerFile({ height: 420, width: 1680 })
      )
    ).resolves.toBeUndefined();
  });

  it("rejects a banner outside the canonical dimensions", async () => {
    await expect(
      validateBannerImageFile(
        await createBannerFile({ height: 480, width: 1680 })
      )
    ).rejects.toThrow("O banner deve ter 1680 × 420 px.");
  });
});
