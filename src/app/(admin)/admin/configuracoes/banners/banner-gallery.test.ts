import { describe, expect, it } from "vitest";
import { readBannerFileSelection } from "./banner-file-selection";

describe("banner gallery file selection", () => {
  it("accepts exactly one selected file", () => {
    const file = new File(["banner"], "banner.webp", { type: "image/webp" });

    expect(readBannerFileSelection([file])).toBe(file);
  });

  it("rejects more than one selected file", () => {
    const files = [
      new File(["one"], "one.webp", { type: "image/webp" }),
      new File(["two"], "two.webp", { type: "image/webp" }),
    ];

    expect(() => readBannerFileSelection(files)).toThrow(
      "Envie um banner por vez."
    );
  });
});
