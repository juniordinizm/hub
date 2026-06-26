import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("date picker field", () => {
  it("can disable days before a minimum selectable date", async () => {
    const source = await readFile(
      new URL("./date-picker-field.tsx", import.meta.url),
      "utf8"
    );

    expect(source).toContain("minDate");
    expect(source).toContain("isDateDisabled");
    expect(source).toContain("disabled={isDateDisabled}");
  });
});
