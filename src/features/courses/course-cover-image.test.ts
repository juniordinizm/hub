import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("course cover image", () => {
  it("keeps a blur or skeleton visible until the cover image loads", () => {
    const source = readFileSync(
      "src/features/courses/course-cover-image.tsx",
      "utf8"
    );

    expect(source).toContain('placeholder={blurDataUrl ? "blur" : "empty"}');
    expect(source).toContain("onLoad={() => setIsLoaded(true)}");
    expect(source).toContain("animate-pulse");
  });
});
