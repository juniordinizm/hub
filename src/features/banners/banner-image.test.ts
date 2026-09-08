import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("banner image", () => {
  it("keeps a blur placeholder visible until the final image loads", () => {
    const source = readFileSync(
      "src/features/banners/banner-image.tsx",
      "utf8"
    );

    expect(source).toContain('placeholder={blurDataUrl ? "blur" : "empty"}');
    expect(source).toContain("onLoad={() => setLoadedSource(src)}");
    expect(source).toContain("setFailedSource(src)");
    expect(source).toContain("opacity-0");
  });
});
