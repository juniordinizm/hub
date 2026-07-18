import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("student banners carousel", () => {
  it("uses the canonical 4:1 aspect ratio", () => {
    const source = readFileSync(
      "src/app/(student)/app/student-banners-carousel.tsx",
      "utf8"
    );

    expect(source).toContain("aspect-[4/1]");
  });

  it("disables drag interaction when there is only one banner", () => {
    const source = readFileSync(
      "src/app/(student)/app/student-banners-carousel.tsx",
      "utf8"
    );

    expect(source).toContain("watchDrag: banners.length > 1");
  });
});
