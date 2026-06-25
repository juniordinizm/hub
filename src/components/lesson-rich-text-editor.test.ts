import { describe, expect, it } from "vitest";
import { getBlockFormatValue } from "./lesson-rich-text-editor";

describe("lesson rich text editor controls", () => {
  it("derives the selected block format from the active editor state", () => {
    expect(
      getBlockFormatValue({
        isHeading1: false,
        isHeading2: false,
        isHeading3: false,
      })
    ).toBe("paragraph");

    expect(
      getBlockFormatValue({
        isHeading1: true,
        isHeading2: false,
        isHeading3: false,
      })
    ).toBe("heading-1");

    expect(
      getBlockFormatValue({
        isHeading1: false,
        isHeading2: true,
        isHeading3: false,
      })
    ).toBe("heading-2");

    expect(
      getBlockFormatValue({
        isHeading1: false,
        isHeading2: false,
        isHeading3: true,
      })
    ).toBe("heading-3");
  });
});
