import { describe, expect, it } from "vitest";
import { getBannerCropOutputName } from "./banner-crop";

describe("banner crop", () => {
  it("creates a WebP name from the original image name", () => {
    expect(getBannerCropOutputName("curso.novo.png")).toBe(
      "curso.novo-banner.webp"
    );
  });

  it("uses a fallback name when the original file name is blank", () => {
    expect(getBannerCropOutputName("")).toBe("banner-banner.webp");
  });
});
